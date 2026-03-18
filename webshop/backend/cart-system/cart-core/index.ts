/**
 * WEBSHOP — CART SYSTEM
 * Cart Core
 *
 * Layer  : Layer 4 — Application Layer
 * System : Cart System
 * Module : cart-core
 *
 * Sub-modules:
 *   cart-management    → create, get, clear, merge
 *   cart-items         → add, remove, update, list
 *   cart-calculation   → subtotal, discount, tax, total
 */

import {
  CartRepository,
  CartItemRepository,
  CartDiscountRepository,
} from '../repositories'
import {
  cartValidationEngine,
  cartPricingEngine,
  CartError,
} from '../cart-engines'
import {
  guestCartStorage,
  userCartSync,
  cartLock,
} from '../cart-storage'
import {
  CartModel,
  CartItemModel,
  CartTotals,
  HydratedCartItem,
} from '../models'
import {
  calculateCartTotals,
  calculateItemTotal,
  cartExpiresAt,
  generateSessionId,
} from '../utils'
import { cartConfig } from '../config/cart_config'

const cartRepo     = new CartRepository()
const itemRepo     = new CartItemRepository()
const discountRepo = new CartDiscountRepository()

// ─────────────────────────────────────────────
// CART MANAGEMENT
// ─────────────────────────────────────────────

export class CartManagement {

  /**
   * Creates a new cart for a guest (session) or user.
   */
  async createCart(data: {
    customerId?: string
    sessionId?:  string
    currency?:   string
  }): Promise<CartModel> {
    // For guests: generate session ID if not provided
    const sessionId = !data.customerId
      ? (data.sessionId ?? generateSessionId())
      : undefined

    const cart = await cartRepo.create({ ...data, sessionId })

    // Cache immediately
    if (cart.customerId) {
      await userCartSync.writeToCache(cart.customerId, cart)
    } else if (sessionId) {
      await guestCartStorage.save(sessionId, cart)
    }

    return cart
  }

  /**
   * Gets a cart by customer ID (user) or session ID (guest).
   * Creates a new cart if none exists.
   */
  async getOrCreateCart(identity: {
    customerId?: string
    sessionId?:  string
  }): Promise<CartModel> {
    let cart: CartModel | null = null

    if (identity.customerId) {
      // Try cache first
      cart = await userCartSync.getFromCache(identity.customerId)
      if (!cart) {
        cart = await cartRepo.findByCustomerId(identity.customerId)
        if (cart) await userCartSync.writeToCache(identity.customerId, cart)
      }
    } else if (identity.sessionId) {
      cart = await guestCartStorage.get(identity.sessionId)
      if (!cart) {
        cart = await cartRepo.findBySessionId(identity.sessionId)
        if (cart) await guestCartStorage.save(identity.sessionId, cart)
      }
    }

    if (!cart) {
      cart = await this.createCart({
        customerId: identity.customerId,
        sessionId:  identity.sessionId,
      })
    }

    return cart
  }

  /**
   * Clears all items and discounts from a cart.
   */
  async clearCart(cartId: string, identity: { customerId?: string; sessionId?: string }): Promise<void> {
    await cartLock.withLock(cartId, async () => {
      await itemRepo.deleteByCartId(cartId)
      await discountRepo.deleteByCartId(cartId)
      await cartRepo.setCoupon(cartId, null)

      // Invalidate cache
      if (identity.customerId) await userCartSync.invalidate(identity.customerId)
      if (identity.sessionId)  await guestCartStorage.delete(identity.sessionId)
    })
  }

  /**
   * Merges a guest cart into a user cart on login.
   * Guest cart items transfer to user cart.
   * Duplicate variants → quantity added.
   * Guest cart is deleted after merge.
   */
  async mergeGuestCart(sessionId: string, customerId: string): Promise<CartModel> {
    const [guestCart, userCart] = await Promise.all([
      this.getOrCreateCart({ sessionId }),
      this.getOrCreateCart({ customerId }),
    ])

    const guestItems  = await itemRepo.findByCartId(guestCart.id)
    if (!guestItems.length) return userCart

    await cartLock.withLock(userCart.id, async () => {
      for (const guestItem of guestItems) {
        const existing = await itemRepo.findByCartAndVariant(
          userCart.id,
          guestItem.productId,
          guestItem.variantId
        )

        if (existing) {
          // Add quantities
          const newQty = existing.quantity + guestItem.quantity
          await itemRepo.updateQuantity(existing.id, newQty, existing.unitPrice)
        } else {
          // Copy item to user cart
          await itemRepo.create({
            cartId:    userCart.id,
            productId: guestItem.productId,
            variantId: guestItem.variantId,
            quantity:  guestItem.quantity,
            unitPrice: guestItem.unitPrice,
            metadata:  guestItem.metadata,
          })
        }
      }

      // Destroy guest cart
      await cartRepo.updateStatus(guestCart.id, 'merged')
      await guestCartStorage.delete(sessionId)
    })

    // Return fresh user cart
    const merged = await cartRepo.findByCustomerId(customerId)
    if (merged) await userCartSync.writeToCache(customerId, merged)
    return merged ?? userCart
  }
}

// ─────────────────────────────────────────────
// CART ITEMS
// ─────────────────────────────────────────────

export class CartItems {

  /**
   * Adds a product to the cart or increases quantity if already present.
   */
  async addItem(
    cartId:    string,
    productId: string,
    variantId: string | undefined,
    quantity:  number,
    identity:  { customerId?: string; sessionId?: string }
  ): Promise<CartItemModel> {
    return cartLock.withLock(cartId, async () => {
      // 1. Validate product exists
      await cartValidationEngine.checkProductExists(productId, variantId)

      // 2. Check stock
      const stock = await cartValidationEngine.checkStock(variantId, productId, quantity)
      if (!stock.inStock) {
        throw new CartError('Product is out of stock', 'OUT_OF_STOCK')
      }

      // 3. Check cart item limit
      const itemCount = await itemRepo.countByCartId(cartId)
      if (itemCount >= cartConfig.limits.maxItems) {
        throw new CartError(
          `Cart cannot have more than ${cartConfig.limits.maxItems} items`,
          'CART_LIMIT_EXCEEDED'
        )
      }

      // 4. Fetch current price
      const unitPrice = await cartPricingEngine.lookupPrice(variantId ?? productId)

      // 5. Check if item already in cart — if so, increase quantity
      const existing = await itemRepo.findByCartAndVariant(cartId, productId, variantId)

      let item: CartItemModel
      if (existing) {
        const newQty = existing.quantity + quantity

        if (newQty > cartConfig.limits.maxQuantityPerItem) {
          throw new CartError(
            `Maximum quantity per item is ${cartConfig.limits.maxQuantityPerItem}`,
            'QUANTITY_EXCEEDED'
          )
        }
        if (newQty > stock.available) {
          throw new CartError(
            `Only ${stock.available} units available`,
            'INSUFFICIENT_STOCK'
          )
        }

        item = await itemRepo.updateQuantity(existing.id, newQty, unitPrice)
      } else {
        item = await itemRepo.create({ cartId, productId, variantId, quantity, unitPrice })
      }

      // 6. Invalidate cache
      await this.invalidateCache(identity)
      return item
    })
  }

  /**
   * Removes an item from the cart.
   */
  async removeItem(
    itemId:   string,
    cartId:   string,
    identity: { customerId?: string; sessionId?: string }
  ): Promise<void> {
    return cartLock.withLock(cartId, async () => {
      await itemRepo.delete(itemId)
      await this.invalidateCache(identity)
    })
  }

  /**
   * Updates the quantity of a cart item.
   */
  async updateQuantity(
    itemId:   string,
    cartId:   string,
    quantity: number,
    identity: { customerId?: string; sessionId?: string }
  ): Promise<CartItemModel> {
    return cartLock.withLock(cartId, async () => {
      const item = await itemRepo.findByCartId(cartId)
        .then((items) => items.find((i) => i.id === itemId))

      if (!item) throw new CartError('Cart item not found', 'ITEM_NOT_FOUND', 404)

      // Stock check for new quantity
      const stock = await cartValidationEngine.checkStock(
        item.variantId, item.productId, quantity
      )
      if (quantity > stock.available) {
        throw new CartError(`Only ${stock.available} units available`, 'INSUFFICIENT_STOCK')
      }

      const updated = await itemRepo.updateQuantity(itemId, quantity, item.unitPrice)
      await this.invalidateCache(identity)
      return updated
    })
  }

  /**
   * Lists all items in a cart with product details hydrated.
   */
  async listItems(cartId: string): Promise<HydratedCartItem[]> {
    const items = await itemRepo.findByCartId(cartId)

    return Promise.all(
      items.map(async (item) => {
        const productInfo = await cartValidationEngine.checkProductExists(
          item.productId, item.variantId
        )
        const currentPrice = await cartPricingEngine.lookupPrice(
          item.variantId ?? item.productId
        )
        const stock = await cartValidationEngine.checkStock(
          item.variantId, item.productId, item.quantity
        )

        return {
          ...item,
          productName:  productInfo.name,
          variantName:  productInfo.variantName,
          sku:          productInfo.sku,
          slug:         productInfo.slug,
          inStock:      stock.inStock,
          stockQty:     stock.available,
          currentPrice,
          priceChanged: currentPrice !== item.unitPrice,
        } as HydratedCartItem
      })
    )
  }

  private async invalidateCache(identity: { customerId?: string; sessionId?: string }): Promise<void> {
    if (identity.customerId) await userCartSync.invalidate(identity.customerId)
    if (identity.sessionId)  await guestCartStorage.delete(identity.sessionId)
  }
}

// ─────────────────────────────────────────────
// CART CALCULATION
// ─────────────────────────────────────────────

export class CartCalculation {

  async calculateTotals(cartId: string): Promise<CartTotals> {
    const [items, discounts] = await Promise.all([
      itemRepo.findByCartId(cartId),
      discountRepo.findByCartId(cartId),
    ])
    return calculateCartTotals(items, discounts)
  }
}

// Singletons
export const cartManagement  = new CartManagement()
export const cartItems       = new CartItems()
export const cartCalculation = new CartCalculation()
