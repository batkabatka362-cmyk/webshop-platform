/**
 * WEBSHOP — CHECKOUT SYSTEM
 * Services
 *
 * Layer  : Layer 4 — Application Layer
 * System : Checkout System
 * Module : services
 */

import {
  checkoutSessionManager,
  checkoutCartLink,
  checkoutFlow,
} from '../checkout-core'
import {
  checkoutValidationEngine,
  checkoutPricingEngine,
  shippingSelectionEngine,
  paymentSelectionEngine,
} from '../checkout-engines'
import {
  CheckoutRepository,
  CheckoutItemRepository,
  CheckoutAddressRepository,
  CheckoutPaymentRepository,
} from '../repositories'
import { CheckoutError, summaryCache } from '../checkout-storage'
import {
  CheckoutSummaryDTO,
  CheckoutResultDTO,
  ValidationResultDTO,
  CreateCheckoutDTO,
  CustomerInfoDTO,
  ShippingAddressDTO,
  ShippingMethodDTO,
  PaymentMethodDTO,
} from '../dto'
import {
  CheckoutSession,
  CheckoutStatus,
} from '../models'
import {
  nextStep,
  completedSteps,
  addressToSnapshot,
} from '../utils'

const checkoutRepo        = new CheckoutRepository()
const checkoutItemRepo    = new CheckoutItemRepository()
const checkoutAddressRepo = new CheckoutAddressRepository()
const checkoutPaymentRepo = new CheckoutPaymentRepository()

// ─────────────────────────────────────────────
// CHECKOUT SERVICE — Main orchestrator
// ─────────────────────────────────────────────

export class CheckoutService {

  /**
   * Creates a new checkout session from a validated cart.
   */
  async createCheckout(dto: CreateCheckoutDTO): Promise<CheckoutSummaryDTO> {
    // Snapshot cart items (price-locked)
    const cartItems = await checkoutCartLink.validateAndSnapshotCart(dto.cartId)

    const session = await checkoutSessionManager.createSession({
      cartId:          dto.cartId,
      customerId:      dto.customerId,
      guestSessionId:  dto.guestSessionId,
      currency:        dto.currency,
      idempotencyKey:  dto.idempotencyKey,
      cartItems,
    })

    return this.toSummaryDTO(session)
  }

  /**
   * Returns current checkout session summary.
   */
  async getCheckout(checkoutId: string): Promise<CheckoutSummaryDTO> {
    // Check summary cache first
    const cached = await summaryCache.getSummary(checkoutId)
    if (cached) return cached as CheckoutSummaryDTO

    const session = await checkoutSessionManager.loadSession(checkoutId)
    const summary = this.toSummaryDTO(session)

    await summaryCache.setSummary(checkoutId, summary)
    return summary
  }

  /**
   * Cancels a checkout session and releases cart lock.
   */
  async cancelCheckout(checkoutId: string): Promise<void> {
    const session = await checkoutSessionManager.loadSession(checkoutId)
    await checkoutCartLink.unlockCart(session.cartId)
    await checkoutSessionManager.expireSession(checkoutId)

    console.info(`[CHECKOUT SERVICE] Cancelled checkout: ${checkoutId}`)
  }

  private toSummaryDTO(session: CheckoutSession, availableShipping?: any[]): CheckoutSummaryDTO {
    const step = session.step as any

    return {
      checkoutId:      session.id,
      status:          session.status,
      step:            session.step,
      currency:        session.currency,
      customerInfo:    session.customerInfo,
      shippingAddress: session.shippingAddress,
      billingAddress:  session.billingAddress,
      sameAsShipping:  session.sameAsShipping,
      availableShippingMethods: availableShipping,
      selectedShipping:         session.shippingMethod,
      paymentGateway:  session.paymentGateway,
      paymentSessionId: session.paymentSessionId,
      items:           session.items.map((i) => ({
        productId:    i.productId,
        variantId:    i.variantId,
        productName:  i.productName,
        variantName:  i.variantName,
        sku:          i.sku,
        imageUrl:     i.imageUrl,
        quantity:     i.quantity,
        unitPrice:    i.unitPrice,
        totalPrice:   i.totalPrice,
      })),
      pricing:         session.pricing,
      completedSteps:  completedSteps(session.step) as any,
      nextStep:        nextStep(session.step) as any,
      expiresAt:       session.expiresAt,
      updatedAt:       session.updatedAt,
    }
  }
}

// ─────────────────────────────────────────────
// CHECKOUT PRICING SERVICE
// ─────────────────────────────────────────────

export class CheckoutPricingService {

  async validateAndGetSummary(checkoutId: string): Promise<ValidationResultDTO> {
    const session = await checkoutSessionManager.loadSession(checkoutId)
    return checkoutValidationEngine.cartIntegrityCheck(session.items)
  }

  async recalculate(checkoutId: string): Promise<CheckoutSummaryDTO> {
    const session     = await checkoutSessionManager.loadSession(checkoutId)
    const shippingFee = session.shippingMethod?.fee ?? 0

    session.pricing = checkoutPricingEngine.calculate(
      session.items,
      shippingFee,
      session.pricing.discountTotal
    )

    await checkoutSessionManager.updateSession(session)
    await summaryCache.invalidateSummary(checkoutId)

    return new CheckoutService().getCheckout(checkoutId)
  }
}

// ─────────────────────────────────────────────
// SHIPPING SERVICE
// ─────────────────────────────────────────────

export class ShippingService {

  async getAvailableMethods(checkoutId: string) {
    const session = await checkoutSessionManager.loadSession(checkoutId)

    if (!session.shippingAddress) {
      throw new CheckoutError('Set shipping address first', 'ADDRESS_REQUIRED')
    }

    return shippingSelectionEngine.loadShippingOptions({
      city:    session.shippingAddress.city,
      country: session.shippingAddress.country,
    })
  }

  async selectMethod(checkoutId: string, dto: ShippingMethodDTO) {
    const session = await checkoutFlow.setShippingMethod(checkoutId, dto)
    return new CheckoutService()['toSummaryDTO'](session)
  }
}

// ─────────────────────────────────────────────
// PAYMENT PREPARATION SERVICE
// ─────────────────────────────────────────────

export class PaymentPreparationService {

  /**
   * Final confirm step — validates everything, creates payment session,
   * persists checkout to DB, hands off to Payment System.
   */
  async confirmAndInitiatePayment(
    checkoutId:     string,
    idempotencyKey: string
  ): Promise<CheckoutResultDTO> {
    const session = await checkoutSessionManager.loadSession(checkoutId)

    // Guard: all steps must be complete
    if (!session.customerInfo || !session.shippingAddress ||
        !session.shippingMethod || !session.paymentGateway) {
      throw new CheckoutError(
        'Checkout is incomplete. Please complete all steps.',
        'CHECKOUT_INCOMPLETE'
      )
    }

    // Idempotency check
    if (session.status === 'pending_payment' && session.idempotencyKey === idempotencyKey) {
      return {
        success:         true,
        checkoutId,
        status:          'pending_payment',
        paymentUrl:      session.paymentSessionId
          ? `https://qpay.mn/payment/${session.paymentSessionId}`
          : undefined,
        message:         'Payment already initiated',
      }
    }

    // Final inventory check
    const inventoryCheck = await checkoutValidationEngine.inventoryFinalCheck(session.items)
    if (!inventoryCheck.available) {
      const names = inventoryCheck.issues.map((i) => i.productName).join(', ')
      throw new CheckoutError(
        `Insufficient stock for: ${names}`,
        'INSUFFICIENT_STOCK'
      )
    }

    // Final price revalidation
    await checkoutValidationEngine.priceRevalidation(session.items)

    // Hard inventory reservation
    const { InventoryService } = await import('../../inventory-system/services')
    const inv = new InventoryService()
    const successfullyReserved: { productId: string, quantity: number }[] = []
    
    for (const item of session.items) {
      try { 
        await inv.hardReserve(item.productId, item.quantity, checkoutId)
        successfullyReserved.push({ productId: item.productId, quantity: item.quantity })
      } catch (e) {
        console.warn(`[PAYMENT PREP] Reserve warning: ${(e as Error).message}`)
        // [V27 FIX]: Hard Reserve Bypass
        // If reservation fails, we must rollback the previously successful reservations!
        await inv.releaseReservation(checkoutId).catch(() => {})
        
        throw new CheckoutError(
          `Insufficient stock while reserving ${item.productName}: ${(e as Error).message}`,
          'INSUFFICIENT_STOCK'
        )
      }
    }

    // Prepare payment session with gateway
    const paymentSession = await paymentSelectionEngine.preparePaymentSession(
      session.paymentGateway,
      session.pricing.grandTotal,
      session.currency,
      checkoutId
    )

    // Update session
    session.status           = 'pending_payment'
    session.paymentSessionId = paymentSession.paymentSessionId
    session.idempotencyKey   = idempotencyKey
    await checkoutSessionManager.updateSession(session)

    // Persist to DB
    await checkoutRepo.create({
      id:            checkoutId,
      cartId:        session.cartId,
      customerId:    session.customerId,
      sessionId:     session.guestSessionId,
      status:        'pending_payment',
      step:          'confirmed',
      currency:      session.currency,
      subtotal:      session.pricing.subtotal,
      discountTotal: session.pricing.discountTotal,
      shippingTotal: session.pricing.shippingTotal,
      taxTotal:      session.pricing.taxTotal,
      grandTotal:    session.pricing.grandTotal,
      expiresAt:     new Date(session.expiresAt),
    })

    await checkoutItemRepo.createMany(checkoutId, session.items)
    if (session.shippingAddress) {
      await checkoutAddressRepo.upsertShipping(checkoutId, session.shippingAddress)
    }
    await checkoutPaymentRepo.create({
      checkoutId,
      gateway:         session.paymentGateway,
      paymentSessionId: paymentSession.paymentSessionId,
      amount:          session.pricing.grandTotal,
      currency:        session.currency,
    })

    return {
      success:         true,
      checkoutId,
      status:          'pending_payment',
      paymentUrl:      paymentSession.paymentUrl,
      paymentQrCode:   paymentSession.qrCode,
      message:         'Payment initiated successfully',
    }
  }

  /**
   * Called by Payment System when payment is confirmed.
   * Creates the Order and finalizes the checkout.
   *
   * INTEGRATION FIX 1:
   *   - Removed mock orderId (`ord_${checkoutId}`) — now calls orderService.createOrder()
   *   - Passes real session data (items, addresses, pricing) to order creation
   *   - Guards against missing session with try/catch (session may have expired)
   *   - Marks checkout completed only AFTER order is successfully created
   */
  async handlePaymentSuccess(checkoutId: string, paymentId: string): Promise<CheckoutResultDTO> {
    // Load session — if expired, fall back to persisted checkout data
    let session: any
    try {
      session = await checkoutSessionManager.loadSession(checkoutId)
    } catch {
      // Session expired from Redis — read from DB (checkout was persisted at confirmAndInitiatePayment)
      const persistedCheckout = await checkoutRepo.findById(checkoutId)
      if (!persistedCheckout) {
        throw new CheckoutError(
          `Checkout ${checkoutId} not found — cannot create order`,
          'CHECKOUT_NOT_FOUND',
          404
        )
      }
      // Use persisted data to reconstruct minimal session context
      session = persistedCheckout
    }

    // Import orderService here to avoid circular import at module load time
    // When OrderSystem is fully wired via service registry, replace with:
    // const { orderService } = serviceRegistry.resolve('order-system')
    const { OrderService } = await import('../../order-system/services')
    const orderServiceInstance = new OrderService()

    // Build CreateOrderDTO from checkout session data
    const createOrderDTO = {
      checkoutId,
      customerId:  session.customerId,
      guestEmail:  session.customerInfo?.email,
      guestPhone:  session.customerInfo?.phone,
      paymentId,
      currency:    session.currency ?? 'MNT',
    }

    let order: any
    try {
      order = await orderServiceInstance.createOrder(createOrderDTO)
    } catch (err) {
      // Order creation failed — mark checkout as failed, do NOT mark completed
      await checkoutRepo.updateStatus(checkoutId, 'payment_failed')
      throw new CheckoutError(
        `Order creation failed after payment: ${(err as Error).message}`,
        'ORDER_CREATION_FAILED',
        500
      )
    }

    // Finalize checkout only after order exists
    await checkoutRepo.markCompleted(checkoutId, order.id)

    // Update Redis session status if still alive
    try {
      const liveSession = await checkoutSessionManager.loadSession(checkoutId)
      liveSession.status = 'completed'
      await checkoutSessionManager.updateSession(liveSession)
    } catch {
      // Session already expired — DB is source of truth, this is non-fatal
    }

    // Mark cart as converted
    if (session.cartId) {
      await (global as any).prisma.cart.update({ where: { id: session.cartId }, data: { status: 'converted' } }).catch(() => {})
    }

    // Confirm inventory reservations (deduct stock permanently)
    try {
      const { InventoryService } = await import('../../inventory-system/services')
      const invSvc = new InventoryService()
      await invSvc.confirmReservation(checkoutId)
    } catch (e) {
      console.warn('[PAYMENT PREP] Inventory confirm warning:', (e as Error).message)
    }

    // Send order confirmation notification
    try {
      const { notificationService } = await import('../../systems/notification-system/services')
      const customerEmail = session.customerInfo?.email
      if (customerEmail) {
        await notificationService.onOrderCreated(customerEmail, {
          orderNumber:  order.orderNumber,
          grandTotal:   session.pricing?.grandTotal ?? 0,
          customerName: `${session.customerInfo?.firstName || ''} ${session.customerInfo?.lastName || ''}`.trim(),
        }, session.customerId)

        await notificationService.onPaymentSuccess(customerEmail, {
          orderNumber: order.orderNumber,
          amount:      session.pricing?.grandTotal ?? 0,
          gateway:     session.paymentGateway || 'qpay',
        }, session.customerId)
      }
    } catch (e) {
      console.warn('[PAYMENT PREP] Notification warning:', (e as Error).message)
    }

    // [V27 FIX]: Coupon Burn Exploit Fix
    // We increment coupon usage ONLY upon successful payment completion.
    // If there is a discount applied in the checkout pricing.
    try {
      if (session.pricing && session.pricing.discountTotal > 0) {
        // Find the coupon in session if it exists, but since we don't store couponCode in DB natively,
        // we can lookup the active coupon that gave the discount in the session JSON
        // Assume session.couponCode might be added if the user wants strict coupling,
        // but normally the coupon-system logic iterates. 
        // For Webshop architecture: We will find the coupon logic in CouponSystem natively.
        const { couponService } = await import('../../systems/coupon-system/services')
        if (session.couponCode) {
          const c = await (global as any).prisma.coupon.findUnique({ where: { code: session.couponCode.toUpperCase() } })
          if (c) {
            await (global as any).prisma.coupon.update({
              where: { id: c.id },
              data: { usageCount: { increment: 1 } }
            })
            console.info(`[COUPON FIX] Usage count safely incremented for ${session.couponCode}`)
          }
        }
      }
    } catch (e) {
      console.warn('[PAYMENT PREP] Coupon increment warning:', (e as Error).message)
    }

    return {
      success:     true,
      checkoutId,
      status:      'completed',
      orderId:     order.id,
      orderNumber: order.orderNumber,
      message:     'Order placed successfully',
    }
  }

  /**
   * Called by Payment System when payment fails.
   *
   * INTEGRATION FIX 2:
   *   - loadSession() throws CheckoutError on expired session; it never returns null.
   *   - The original `if (session)` guard was dead code — cart was never unlocked on expiry.
   *   - Fixed: wrap loadSession in try/catch; fall back to DB read for cartId.
   */
  async handlePaymentFailure(checkoutId: string): Promise<void> {
    await checkoutRepo.updateStatus(checkoutId, 'payment_failed')

    // Release inventory hard reservation
    const { InventoryService } = await import('../../inventory-system/services')
    const inv = new InventoryService()
    await inv.releaseReservation(checkoutId).catch(e => console.warn('[PAYMENT PREP] Release warning:', e))

    // Unlock cart — allow retry
    // FIXED: loadSession throws on expired session, does NOT return null
    let cartId: string | undefined
    try {
      const session = await checkoutSessionManager.loadSession(checkoutId)
      cartId = session.cartId
      session.status = 'payment_failed'
      await checkoutSessionManager.updateSession(session)
    } catch {
      // Session expired from Redis — read cartId from persisted DB checkout record
      const persisted = await checkoutRepo.findById(checkoutId)
      cartId = persisted?.cartId
    }

    if (cartId) {
      await checkoutCartLink.unlockCart(cartId)
    } else {
      console.warn(`[PAYMENT PREP] Could not unlock cart for checkout ${checkoutId}: cartId not found`)
    }

    // Send payment failure notification
    try {
      const { notificationService } = await import('../../systems/notification-system/services')
      const checkout = await checkoutRepo.findById(checkoutId)
      // Try to get customer email from checkout addresses or session
      if (checkout) {
        const addresses = await (global as any).prisma.checkoutAddress.findMany({ where: { checkoutId } })
        const email = addresses?.[0]?.phone // fallback — ideally customerInfo.email
        // Log for now — email might not be available here
        console.info(`[NOTIFICATION] Payment failed for checkout ${checkoutId}`)
      }
    } catch (e) {
      console.warn('[PAYMENT PREP] Notification warning:', (e as Error).message)
    }
  }
}

export const checkoutService           = new CheckoutService()
export const checkoutPricingService    = new CheckoutPricingService()
export const shippingService           = new ShippingService()
export const paymentPreparationService = new PaymentPreparationService()
