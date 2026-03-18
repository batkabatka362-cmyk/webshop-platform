/**
 * WEBSHOP — CHECKOUT SYSTEM
 * Checkout Core
 *
 * Layer  : Layer 4 — Application Layer
 * System : Checkout System
 * Module : checkout-core
 *
 * Sub-modules:
 *   checkout-session    → create, load, update, expire
 *   checkout-cart-link  → attach, validate, lock
 *   checkout-flow       → step-by-step progression
 */

import {
  CheckoutSession,
  CheckoutStep,
  CheckoutStatus,
  CheckoutItemModel,
  CustomerInfo,
  AddressModel,
} from '../models'
import {
  sessionStore,
  summaryCache,
  checkoutLock,
  CheckoutError,
} from '../checkout-storage'
import {
  checkoutValidationEngine,
  checkoutPricingEngine,
  shippingSelectionEngine,
  paymentSelectionEngine,
} from '../checkout-engines'
import {
  generateCheckoutId,
  sessionExpiresAt,
  nextStep,
  completedSteps,
  calculateCheckoutPricing,
} from '../utils'
import { checkoutConfig } from '../config/checkout_config'
import { CustomerInfoDTO, ShippingAddressDTO, ShippingMethodDTO, PaymentMethodDTO } from '../dto'
import { CartRepository, CartItemRepository } from '../../cart-system/repositories'
import { cartItems as cartItemsService }       from '../../cart-system/cart-core'
const cartRepo     = new CartRepository()
const cartItemRepo = new CartItemRepository()

// ─────────────────────────────────────────────
// CHECKOUT SESSION MANAGEMENT
// ─────────────────────────────────────────────

export class CheckoutSessionManager {

  /**
   * Creates a new checkout session from a cart.
   * Locks the cart to prevent modification.
   */
  async createSession(data: {
    cartId:          string
    customerId?:     string
    guestSessionId?: string
    currency?:       string
    idempotencyKey?: string
    cartItems:       CheckoutItemModel[]
    discountTotal?:  number
  }): Promise<CheckoutSession> {
    const id  = generateCheckoutId()
    const now = new Date().toISOString()

    // Build initial pricing (no shipping yet)
    const pricing = checkoutPricingEngine.calculate(
      data.cartItems,
      0,                         // shipping TBD
      data.discountTotal ?? 0
    )

    const session: CheckoutSession = {
      id,
      cartId:          data.cartId,
      customerId:      data.customerId,
      guestSessionId:  data.guestSessionId,
      status:          'created',
      step:            'customer_info',
      currency:        data.currency ?? checkoutConfig.currency,
      sameAsShipping:  true,
      items:           data.cartItems,
      pricing,
      idempotencyKey:  data.idempotencyKey,
      createdAt:       now,
      updatedAt:       now,
      expiresAt:       sessionExpiresAt().toISOString(),
    }

    await sessionStore.save(session)

    // Lock cart to prevent modifications during checkout
    try {
      await cartRepo.updateStatus(data.cartId, 'locked' as any)
      console.info(`[CHECKOUT CORE] Cart locked: ${data.cartId}`)
    } catch (e) {
      console.warn(`[CHECKOUT CORE] Cart lock warning:`, (e as Error).message)
    }

    return session
  }

  async loadSession(checkoutId: string): Promise<CheckoutSession> {
    const session = await sessionStore.get(checkoutId)
    if (!session) {
      throw new CheckoutError('Checkout session not found or expired', 'SESSION_NOT_FOUND', 404)
    }
    if (session.status === 'expired') {
      throw new CheckoutError('Checkout session has expired', 'SESSION_EXPIRED', 410)
    }
    if (session.status === 'completed') {
      throw new CheckoutError('Checkout already completed', 'SESSION_COMPLETED', 409)
    }
    return session
  }

  async updateSession(session: CheckoutSession): Promise<CheckoutSession> {
    session.status    = 'in_progress'
    session.updatedAt = new Date().toISOString()
    await sessionStore.save(session)
    await summaryCache.invalidateSummary(session.id)
    return session
  }

  async expireSession(checkoutId: string): Promise<void> {
    const session = await sessionStore.get(checkoutId)
    if (session) {
      session.status = 'expired'
      await sessionStore.save(session)

      // Release cart lock
      try {
        await cartRepo.updateStatus(session.cartId, 'active')
        console.info(`[CHECKOUT CORE] Cart unlocked: ${session.cartId}`)
      } catch (e) {
        console.warn(`[CHECKOUT CORE] Cart unlock warning:`, (e as Error).message)
      }

      // Release any inventory reservations
      try {
        const { InventoryService } = await import('../../inventory-system/services')
        const inv = new InventoryService()
        await inv.releaseReservation(session.cartId)
        console.info(`[CHECKOUT CORE] Inventory reservations released for cart: ${session.cartId}`)
      } catch (e) {
        console.warn(`[CHECKOUT CORE] Inventory release warning:`, (e as Error).message)
      }
    }
    await sessionStore.delete(checkoutId)
  }
}

// ─────────────────────────────────────────────
// CHECKOUT CART LINK
// ─────────────────────────────────────────────

export class CheckoutCartLink {

  /**
   * Validates cart before attaching it to checkout session.
   * Returns snapshot of cart items (price-locked).
   */
  async validateAndSnapshotCart(cartId: string): Promise<CheckoutItemModel[]> {
    const cart = await cartRepo.findById(cartId)
    if (!cart || cart.status !== 'active') {
      throw new CheckoutError('Cart is not available for checkout', 'CART_UNAVAILABLE', 422)
    }

    const items = await cartItemsService.listItems(cartId)
    if (!items.length) {
      throw new CheckoutError('Cannot checkout an empty cart', 'EMPTY_CART', 422)
    }

    // Price-lock: use server-side stored prices, never trust client
    return items.map(item => ({
      productId:   item.productId,
      variantId:   item.variantId ?? undefined,
      productName: item.productName,
      variantName: item.variantName ?? undefined,
      sku:         item.sku,
      imageUrl:    (item as any).imageUrl ?? undefined,
      quantity:    item.quantity,
      unitPrice:   item.unitPrice,
      totalPrice:  item.unitPrice * item.quantity,
    }))
  }

  /**
   * Locks cart for checkout — prevents add/remove during active session.
   */
  async lockCart(cartId: string): Promise<void> {
    await cartRepo.updateStatus(cartId, 'locked' as any)
  }

  /**
   * Unlocks cart — called on session expiry or cancellation.
   */
  async unlockCart(cartId: string): Promise<void> {
    await cartRepo.updateStatus(cartId, 'active')
  }
}

// ─────────────────────────────────────────────
// CHECKOUT FLOW — Step Handlers
// ─────────────────────────────────────────────

export class CheckoutFlow {

  private sessionManager = new CheckoutSessionManager()

  /**
   * STEP 1 — Customer Information
   */
  async setCustomerInfo(
    checkoutId: string,
    dto: CustomerInfoDTO
  ): Promise<CheckoutSession> {
    return checkoutLock.withLock(checkoutId, async () => {
      const session = await this.sessionManager.loadSession(checkoutId)

      session.customerInfo = {
        customerId: session.customerId,
        email:      dto.email,
        phone:      dto.phone,
        firstName:  dto.firstName,
        lastName:   dto.lastName,
      }
      session.step = 'shipping_address'

      return this.sessionManager.updateSession(session)
    })
  }

  /**
   * STEP 2 — Shipping Address
   */
  async setShippingAddress(
    checkoutId: string,
    dto: ShippingAddressDTO
  ): Promise<CheckoutSession> {
    return checkoutLock.withLock(checkoutId, async () => {
      const session = await this.sessionManager.loadSession(checkoutId)

      if (!session.customerInfo) {
        throw new CheckoutError('Complete customer information first', 'STEP_INCOMPLETE')
      }

      session.shippingAddress = { ...dto, type: 'shipping' }

      // Auto-copy billing if sameAsShipping
      if (session.sameAsShipping) {
        session.billingAddress = { ...dto, type: 'billing' }
      }

      // Load available shipping methods for the address
      const methods = await shippingSelectionEngine.loadShippingOptions({
        city:    dto.city,
        country: dto.country,
      })

      session.step = 'shipping_method'

      const saved = await this.sessionManager.updateSession(session)
      return { ...saved, _availableShippingMethods: methods } as any
    })
  }

  /**
   * STEP 3 — Shipping Method Selection
   */
  async setShippingMethod(
    checkoutId: string,
    dto: ShippingMethodDTO
  ): Promise<CheckoutSession> {
    return checkoutLock.withLock(checkoutId, async () => {
      const session = await this.sessionManager.loadSession(checkoutId)

      if (!session.shippingAddress) {
        throw new CheckoutError('Set shipping address first', 'STEP_INCOMPLETE')
      }

      // Estimate total weight: 0.5kg per item (until product weight field added)
      const totalWeight = session.items.reduce((sum, i) => sum + i.quantity * 0.5, 0)
      const subtotal    = checkoutPricingEngine.subtotal(session.items)
      const shipping    = shippingSelectionEngine.buildSelectedShipping(
        dto.shippingMethodId,
        totalWeight,
        subtotal
      )

      session.shippingMethod = shipping

      // Recalculate pricing with shipping fee
      session.pricing = checkoutPricingEngine.calculate(
        session.items,
        shipping.fee,
        session.pricing.discountTotal
      )

      session.step = 'payment_method'
      return this.sessionManager.updateSession(session)
    })
  }

  /**
   * STEP 4 — Payment Method Selection
   */
  async setPaymentMethod(
    checkoutId: string,
    dto: PaymentMethodDTO
  ): Promise<CheckoutSession> {
    return checkoutLock.withLock(checkoutId, async () => {
      const session = await this.sessionManager.loadSession(checkoutId)

      if (!session.shippingMethod) {
        throw new CheckoutError('Select a shipping method first', 'STEP_INCOMPLETE')
      }

      paymentSelectionEngine.validatePaymentMethod(dto.gateway)
      session.paymentGateway = dto.gateway
      session.step           = 'order_review'

      return this.sessionManager.updateSession(session)
    })
  }

  /**
   * STEP 5 — Order Review & Final Validation
   * Returns session with all validation results.
   */
  async reviewOrder(checkoutId: string): Promise<{
    session:    CheckoutSession
    validation: Awaited<ReturnType<typeof checkoutValidationEngine.cartIntegrityCheck>>
  }> {
    const session    = await this.sessionManager.loadSession(checkoutId)
    const validation = await checkoutValidationEngine.cartIntegrityCheck(session.items)

    return { session, validation }
  }
}

export const checkoutSessionManager = new CheckoutSessionManager()
export const checkoutCartLink       = new CheckoutCartLink()
export const checkoutFlow           = new CheckoutFlow()
