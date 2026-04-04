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
import { CheckoutError, summaryCache, checkoutLock } from '../checkout-storage'
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
    return checkoutLock.withLock(checkoutId, async () => {
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

    // Hard inventory reservation (creates a lock but doesn't deduct quantity)
    const { InventoryService } = await import('../../inventory-system/services')
    const inv = new InventoryService()
    const successfullyReserved: { productId: string, quantity: number }[] = []
    
    for (const item of session.items) {
      try { 
        await inv.hardReserve(item.productId, item.quantity, checkoutId)
        successfullyReserved.push({ productId: item.productId, quantity: item.quantity })
      } catch (e) {
        console.warn(`[PAYMENT PREP] Reserve warning: ${(e as Error).message}`)
        await inv.releaseReservation(checkoutId).catch((rollbackErr: any) => {
          console.error('[CHECKOUT] Inventory rollback failed after reserve error for', checkoutId, rollbackErr?.message)
        })
        
        throw new CheckoutError(
          `Insufficient stock while reserving ${item.productName}: ${(e as Error).message}`,
          'INSUFFICIENT_STOCK'
        )
      }
    }

    // Persist checkout to DB FIRST so the Order can read it
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

    // CREATE THE ORDER INSTANTLY (Status: PENDING)
    const { OrderService } = await import('../../order-system/services')
    const orderServiceInstance = new OrderService()
    let order: any
    try {
      order = await orderServiceInstance.createOrder({
        checkoutId,
        customerId:  session.customerId,
        guestEmail:  session.customerInfo?.email,
        guestPhone:  session.customerInfo?.phone,
        paymentId:   'pending_gateway',
        currency:    session.currency ?? 'MNT',
      })
    } catch (err) {
      // Rollback reservations
      await inv.releaseReservation(checkoutId).catch((rollbackErr: any) => {
        console.error('[CHECKOUT] Inventory rollback failed after order creation error for', checkoutId, rollbackErr?.message)
      })
      throw new CheckoutError(`Order creation failed before payment: ${(err as Error).message}`, 'ORDER_CREATION_FAILED', 500)
    }

    // Prepare payment session with gateway using the ACTUAL order.id
    const paymentSession = await paymentSelectionEngine.preparePaymentSession(
      session.paymentGateway,
      session.pricing.grandTotal,
      session.currency,
      order.id
    )

    // Update session
    session.status           = 'pending_payment'
    session.paymentSessionId = paymentSession.paymentSessionId
    session.idempotencyKey   = idempotencyKey
    await checkoutSessionManager.updateSession(session)

    await checkoutPaymentRepo.create({
      checkoutId,
      gateway:         session.paymentGateway,
      paymentSessionId: paymentSession.paymentSessionId,
      amount:          session.pricing.grandTotal,
      currency:        session.currency,
    })

    // Clear the cart securely now that Order is created
    if (session.cartId) {
      // Bypass import cycle via raw DB call since we're in the prep stage
      await (global as any).prisma.cart.update({ where: { id: session.cartId }, data: { status: 'converted' } }).catch((e: any) => {
        console.error('[CHECKOUT] Failed to mark cart as converted for cartId', session.cartId, e?.message)
      })
      await checkoutCartLink.unlockCart(session.cartId).catch((e: any) => {
        console.error('[CHECKOUT] Failed to unlock cart for cartId', session.cartId, e?.message)
      })

      // V43 FIX (BUG-20): Increment coupon usage count after successful order creation.
      // couponService.incrementUsage() existed but was never called — coupons could be reused infinitely.
      try {
        const cart = await (global as any).prisma.cart.findUnique({ where: { id: session.cartId } })
        if (cart?.couponCode) {
          const { couponService } = await import('../../systems/coupon-system/services')
          await couponService.incrementUsage(cart.couponCode)
          console.info(`[CHECKOUT] Coupon usage incremented: ${cart.couponCode}`)
        }
      } catch (e) {
        console.warn('[CHECKOUT] Coupon usage increment warning:', (e as Error).message)
      }
    }

    return {
      success:         true,
      checkoutId,
      status:          'pending_payment',
      paymentUrl:      paymentSession.paymentUrl,
      paymentQrCode:   paymentSession.qrCode,
      message:         'Payment initiated successfully. Order generated.',
    }
   })
  }

  /**
   * Called by Frontend when user finishes payment loop.
   * THIS MUST BE A READ-ONLY VIEW! The webhook is the source of truth.
   */
  async handlePaymentSuccess(checkoutId: string, paymentId: string): Promise<CheckoutResultDTO> {
    const existingCheckout = await checkoutRepo.findById(checkoutId)
    if (!existingCheckout) {
      throw new CheckoutError('Checkout not found', 'CHECKOUT_NOT_FOUND', 404)
    }

    const { OrderService } = await import('../../order-system/services')
    const orderSvc = new OrderService()
    
    // Find the order that was linked to this checkout.
    // Since we created it earlier, we can find it by checkoutId (which was passed earlier but the schema didn't link directly to checkoutId).
    // Let's lookup via CheckoutPayment to get the paymentSessionId, which maps to orderId in Payment DB!
    const cp = await (global as any).prisma.checkoutPayment.findUnique({ where: { checkoutId } })
    let orderRecord: any = null
    
    // Read the Order
    if (cp?.paymentSessionId) {
      const p = await (global as any).prisma.payment.findUnique({ where: { id: cp.paymentSessionId } })
      if (p?.orderId) orderRecord = await orderSvc.getOrder(p.orderId)
    }

    // Default response assuming webhook will handle true fulfillment
    return {
      success:     true,
      checkoutId,
      status:      orderRecord?.paymentStatus === 'paid' ? 'completed' : 'pending_payment',
      orderId:     orderRecord?.id,
      orderNumber: orderRecord?.orderNumber,
      message:     orderRecord?.paymentStatus === 'paid' ? 'Payment verified securely!' : 'Validating payment asynchronously via gateway...',
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
        // V43 FIX (BUG-28): Was using addresses?.[0]?.phone as email — phone is not an email address
        const shippingAddr = addresses?.find((a: any) => a.type === 'shipping')
        const email = checkout.sessionId || shippingAddr?.firstName // Log context for now
        // Log for now — proper email is stored in customerInfo on the Redis session, not on CheckoutAddress
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
