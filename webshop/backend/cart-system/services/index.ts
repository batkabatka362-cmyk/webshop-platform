/**
 * WEBSHOP — CART SYSTEM
 * Services
 *
 * Layer  : Layer 4 — Application Layer
 * System : Cart System
 * Module : services
 */

import {
  cartManagement,
  cartItems,
  cartCalculation,
} from '../cart-core'
import {
  cartPricingEngine,
  cartValidationEngine,
  CartError,
} from '../cart-engines'
import {
  CartRepository,
  CartDiscountRepository,
  CartItemRepository,
} from '../repositories'
import {
  CartResponseDTO,
  CartItemResponseDTO,
  CartSummaryDTO,
  AddItemDTO,
  UpdateQuantityDTO,
  ApplyCouponDTO,
  MergeCartDTO,
} from '../dto'
import { HydratedCartItem } from '../models'
import { cartConfig }       from '../config/cart_config'

const cartRepo     = new CartRepository()
const itemRepo     = new CartItemRepository()
const discountRepo = new CartDiscountRepository()

// ─────────────────────────────────────────────
// CART SERVICE
// ─────────────────────────────────────────────

export class CartService {

  async getCart(identity: { customerId?: string; sessionId?: string }): Promise<CartResponseDTO> {
    const cart     = await cartManagement.getOrCreateCart(identity)
    const items    = await cartItems.listItems(cart.id)
    const totals   = await cartCalculation.calculateTotals(cart.id)
    const discounts = await discountRepo.findByCartId(cart.id)

    return toCartResponseDTO(cart, items, totals, discounts)
  }

  async clearCart(identity: { customerId?: string; sessionId?: string }): Promise<void> {
    const cart = await cartManagement.getOrCreateCart(identity)
    await cartManagement.clearCart(cart.id, identity)
  }

  async mergeCart(dto: MergeCartDTO): Promise<CartResponseDTO> {
    const merged  = await cartManagement.mergeGuestCart(dto.sessionId, dto.customerId)
    const items   = await cartItems.listItems(merged.id)
    const totals  = await cartCalculation.calculateTotals(merged.id)
    const discounts = await discountRepo.findByCartId(merged.id)

    return toCartResponseDTO(merged, items, totals, discounts)
  }

  async applyCoupon(
    identity:   { customerId?: string; sessionId?: string },
    dto:        ApplyCouponDTO
  ): Promise<CartResponseDTO> {
    const cart = await cartManagement.getOrCreateCart(identity)

    // Check if coupon already applied
    const existing = await discountRepo.findByCouponCode(cart.id, dto.couponCode)
    if (existing) throw new CartError('Coupon already applied', 'COUPON_ALREADY_APPLIED')

    // Calculate subtotal first
    const rawItems   = await itemRepo.findByCartId(cart.id)
    const subtotal   = rawItems.reduce((sum, i) => sum + i.totalPrice, 0)

    // Validate and calculate discount
    const discount   = await cartPricingEngine.applyCoupon(dto.couponCode, subtotal)

    await discountRepo.create({ cartId: cart.id, ...discount })
    await cartRepo.setCoupon(cart.id, dto.couponCode)

    return this.getCart(identity)
  }

  async removeCoupon(
    identity:   { customerId?: string; sessionId?: string },
    couponCode: string
  ): Promise<CartResponseDTO> {
    const cart = await cartManagement.getOrCreateCart(identity)
    await discountRepo.deleteByCouponCode(cart.id, couponCode)
    await cartRepo.setCoupon(cart.id, null)
    return this.getCart(identity)
  }
}

// ─────────────────────────────────────────────
// CART ITEM SERVICE
// ─────────────────────────────────────────────

export class CartItemService {

  async addItem(
    identity: { customerId?: string; sessionId?: string },
    dto:      AddItemDTO
  ): Promise<CartResponseDTO> {
    const cart = await cartManagement.getOrCreateCart(identity)

    await cartItems.addItem(
      cart.id,
      dto.productId,
      dto.variantId,
      dto.quantity,
      identity
    )

    return getCartResponse(cart.id, identity)
  }

  async removeItem(
    identity: { customerId?: string; sessionId?: string },
    itemId:   string
  ): Promise<CartResponseDTO> {
    const cart = await cartManagement.getOrCreateCart(identity)
    await cartItems.removeItem(itemId, cart.id, identity)
    return getCartResponse(cart.id, identity)
  }

  async updateQuantity(
    identity: { customerId?: string; sessionId?: string },
    itemId:   string,
    dto:      UpdateQuantityDTO
  ): Promise<CartResponseDTO> {
    const cart = await cartManagement.getOrCreateCart(identity)
    await cartItems.updateQuantity(itemId, cart.id, dto.quantity, identity)
    return getCartResponse(cart.id, identity)
  }
}

// ─────────────────────────────────────────────
// CART PRICING SERVICE
// ─────────────────────────────────────────────

export class CartPricingService {

  /**
   * Revalidates all cart item prices against current Pricing Engine values.
   * Updates stale prices in DB and returns the updated cart.
   */
  async revalidatePrices(
    identity: { customerId?: string; sessionId?: string }
  ): Promise<{ cart: CartResponseDTO; priceChanges: { itemId: string; old: number; new: number }[] }> {
    const cart      = await cartManagement.getOrCreateCart(identity)
    const rawItems  = await itemRepo.findByCartId(cart.id)
    const changes:  { itemId: string; old: number; new: number }[] = []

    for (const item of rawItems) {
      const { currentPrice, changed } = await cartValidationEngine.validatePrice(
        item.variantId, item.productId, item.unitPrice
      )

      if (changed) {
        changes.push({ itemId: item.id, old: item.unitPrice, new: currentPrice })
        await itemRepo.updateUnitPrice(item.id, currentPrice, item.quantity)
      }
    }

    return { cart: await getCartResponse(cart.id, identity), priceChanges: changes }
  }

  /**
   * Validates the cart for checkout handoff.
   * Checks all stock levels and prices.
   */
  async validateForCheckout(
    identity: { customerId?: string; sessionId?: string }
  ): Promise<{ valid: boolean; errors: string[] }> {
    const cart     = await cartManagement.getOrCreateCart(identity)
    const rawItems = await itemRepo.findByCartId(cart.id)

    if (!rawItems.length) {
      return { valid: false, errors: ['Cart is empty'] }
    }

    const { valid, errors } = await cartValidationEngine.validateCartForCheckout(rawItems)
    return { valid, errors }
  }
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

async function getCartResponse(
  cartId:   string,
  identity: { customerId?: string; sessionId?: string }
): Promise<CartResponseDTO> {
  const cart      = await cartRepo.findById(cartId)
  if (!cart) throw new CartError('Cart not found', 'CART_NOT_FOUND', 404)

  const items     = await cartItems.listItems(cartId)
  const totals    = await cartCalculation.calculateTotals(cartId)
  const discounts = await discountRepo.findByCartId(cartId)

  return toCartResponseDTO(cart, items, totals, discounts)
}

function toCartResponseDTO(
  cart:      any,
  items:     HydratedCartItem[],
  totals:    any,
  discounts: any[]
): CartResponseDTO {
  const summary: CartSummaryDTO = {
    ...totals,
    discounts: discounts.map((d) => ({
      id:            d.id,
      kind:          d.kind,
      code:          d.code,
      description:   d.description,
      discountType:  d.discountType,
      appliedAmount: d.appliedAmount,
    })),
  }

  return {
    id:          cart.id,
    type:        cart.type,
    status:      cart.status,
    currency:    cart.currency,
    couponCode:  cart.couponCode,
    expiresAt:   cart.expiresAt?.toISOString(),
    updatedAt:   cart.updatedAt?.toISOString(),
    items:       items.map(toItemResponseDTO),
    summary,
  }
}

function toItemResponseDTO(item: HydratedCartItem): CartItemResponseDTO {
  return {
    id:           item.id,
    productId:    item.productId,
    variantId:    item.variantId,
    productName:  item.productName,
    variantName:  item.variantName,
    sku:          item.sku,
    slug:         item.slug,
    imageUrl:     item.imageUrl,
    quantity:     item.quantity,
    unitPrice:    item.unitPrice,
    totalPrice:   item.totalPrice,
    currentPrice: item.currentPrice,
    priceChanged: item.priceChanged,
    inStock:      item.inStock,
    stockQty:     item.stockQty,
  }
}
