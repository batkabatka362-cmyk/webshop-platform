/**
 * WEBSHOP — CART SYSTEM
 * Domain Models
 *
 * Layer  : Layer 4 — Application Layer
 * System : Cart System
 * Module : models
 */

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

export type CartStatus       = 'active' | 'merged' | 'converted' | 'abandoned'
export type CartType         = 'guest' | 'user'
export type DiscountType     = 'percentage' | 'fixed_amount'
export type CartDiscountKind = 'coupon' | 'promotion' | 'automatic'

// ─────────────────────────────────────────────
// CART DISCOUNT MODEL
// ─────────────────────────────────────────────

export interface CartDiscountModel {
  id:            string
  cartId:        string
  kind:          CartDiscountKind
  code?:         string
  description:   string
  discountType:  DiscountType
  discountValue: number
  appliedAmount: number
  createdAt:     Date
}

// ─────────────────────────────────────────────
// CART ITEM MODEL
// ─────────────────────────────────────────────

export interface CartItemModel {
  id:           string
  cartId:       string
  productId:    string
  variantId?:   string
  quantity:     number
  unitPrice:    number        // snapshot at add-to-cart time
  totalPrice:   number        // unitPrice × quantity
  metadata?:    Record<string, unknown>
  createdAt:    Date
  updatedAt:    Date
}

// ─────────────────────────────────────────────
// CART MODEL
// ─────────────────────────────────────────────

export interface CartModel {
  id:          string
  customerId?: string         // null = guest cart
  sessionId?:  string         // guest identifier
  type:        CartType
  status:      CartStatus
  currency:    string
  couponCode?: string
  expiresAt:   Date
  createdAt:   Date
  updatedAt:   Date
  items?:      CartItemModel[]
  discounts?:  CartDiscountModel[]
}

// ─────────────────────────────────────────────
// CART TOTALS
// ─────────────────────────────────────────────

export interface CartTotals {
  itemCount:              number
  subtotal:               number
  discountTotal:          number
  taxTotal:               number
  grandTotal:             number
  currency:               string
  savings:                number
  freeShippingThreshold:  number
  freeShippingRemaining:  number
  hasFreeShipping:        boolean
}

// ─────────────────────────────────────────────
// HYDRATED CART ITEM (for responses)
// ─────────────────────────────────────────────

export interface HydratedCartItem extends CartItemModel {
  productName:  string
  variantName?: string
  sku:          string
  imageUrl?:    string
  slug:         string
  inStock:      boolean
  stockQty:     number
  currentPrice: number        // live price from Pricing Engine
  priceChanged: boolean       // true if price changed since add-to-cart
}

// ─── Domain Error Re-exports ──────────────────
// Controllers and external callers import errors from here,
// never from cart-engines or cart-storage directly.
export { CartError }     from '../cart-engines'
export { CartLockError } from '../cart-storage'
