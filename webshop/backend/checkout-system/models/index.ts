/**
 * WEBSHOP — CHECKOUT SYSTEM
 * Domain Models
 *
 * Layer  : Layer 4 — Application Layer
 * System : Checkout System
 * Module : models
 */

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

export type CheckoutStatus =
  | 'created'
  | 'in_progress'
  | 'pending_payment'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'payment_failed'

export type CheckoutStep =
  | 'customer_info'
  | 'shipping_address'
  | 'shipping_method'
  | 'payment_method'
  | 'order_review'
  | 'confirmed'

export type PaymentGateway = 'qpay' | 'card' | 'bank_transfer' | 'cash'

// ─────────────────────────────────────────────
// ADDRESS MODELS
// ─────────────────────────────────────────────

export interface AddressModel {
  id?:         string
  checkoutId?: string
  type:        'shipping' | 'billing'
  firstName:   string
  lastName:    string
  phone:       string
  country:     string
  city:        string
  district:    string
  street:      string
  postalCode?: string
}

// ─────────────────────────────────────────────
// CHECKOUT ITEM MODEL (price-locked snapshot)
// ─────────────────────────────────────────────

export interface CheckoutItemModel {
  id?:          string
  checkoutId?:  string
  productId:    string
  variantId?:   string
  productName:  string
  variantName?: string
  sku:          string
  imageUrl?:    string
  quantity:     number
  unitPrice:    number     // IMMUTABLE — snapshot, tamper-proof
  totalPrice:   number
}

// ─────────────────────────────────────────────
// SHIPPING METHOD
// ─────────────────────────────────────────────

export interface ShippingMethod {
  id:            string
  name:          string
  baseFee:       number
  estimatedDays: { min: number; max: number }
  isActive:      boolean
}

export interface SelectedShipping {
  methodId:       string
  methodName:     string
  fee:            number
  estimatedDays:  { min: number; max: number }
}

// ─────────────────────────────────────────────
// CUSTOMER INFO
// ─────────────────────────────────────────────

export interface CustomerInfo {
  customerId?: string
  email:       string
  phone:       string
  firstName:   string
  lastName:    string
}

// ─────────────────────────────────────────────
// CHECKOUT PRICING
// ─────────────────────────────────────────────

export interface CheckoutPricing {
  subtotal:       number
  discountTotal:  number
  shippingTotal:  number
  taxTotal:       number
  grandTotal:     number
  currency:       string
}

// ─────────────────────────────────────────────
// CHECKOUT SESSION (Redis)
// Full in-memory session — steps are updated progressively
// ─────────────────────────────────────────────

export interface CheckoutSession {
  id:               string
  cartId:           string
  customerId?:      string
  guestSessionId?:  string
  status:           CheckoutStatus
  step:             CheckoutStep
  currency:         string

  // Step data — populated as checkout progresses
  customerInfo?:    CustomerInfo
  shippingAddress?: AddressModel
  billingAddress?:  AddressModel
  sameAsShipping:   boolean
  shippingMethod?:  SelectedShipping
  paymentGateway?:  PaymentGateway
  paymentSessionId?: string   // QPay invoice ID etc.

  // Locked cart snapshot
  items:            CheckoutItemModel[]
  pricing:          CheckoutPricing

  // Metadata
  idempotencyKey?:  string
  createdAt:        string
  updatedAt:        string
  expiresAt:        string
}

// ─────────────────────────────────────────────
// CHECKOUT MODEL (PostgreSQL — finalized only)
// ─────────────────────────────────────────────

export interface CheckoutModel {
  id:             string
  cartId:         string
  customerId?:    string
  sessionId?:     string
  status:         CheckoutStatus
  step:           CheckoutStep
  currency:       string
  subtotal:       number
  discountTotal:  number
  shippingTotal:  number
  taxTotal:       number
  grandTotal:     number
  orderId?:       string
  expiresAt:      Date
  completedAt?:   Date
  createdAt:      Date
  updatedAt:      Date
}

// ─── Domain Error Re-exports ──────────────────
export { CheckoutError } from '../checkout-storage'
