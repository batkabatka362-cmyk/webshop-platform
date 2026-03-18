/**
 * WEBSHOP — CHECKOUT SYSTEM
 * Data Transfer Objects
 *
 * Layer  : Layer 4 — Application Layer
 * System : Checkout System
 * Module : dto
 */

import {
  CheckoutStatus,
  CheckoutStep,
  CheckoutItemModel,
  AddressModel,
  SelectedShipping,
  CheckoutPricing,
  PaymentGateway,
  CustomerInfo,
  ShippingMethod,
} from '../models'

// ─────────────────────────────────────────────
// REQUEST DTOs
// ─────────────────────────────────────────────

export interface CreateCheckoutDTO {
  cartId:          string
  customerId?:     string
  guestSessionId?: string
  currency?:       string
  idempotencyKey?: string
}

export interface CustomerInfoDTO {
  email:     string
  phone:     string
  firstName: string
  lastName:  string
}

export interface ShippingAddressDTO {
  firstName:   string
  lastName:    string
  phone:       string
  country:     string
  city:        string
  district:    string
  street:      string
  postalCode?: string
}

export interface BillingAddressDTO extends ShippingAddressDTO {
  sameAsShipping: boolean
}

export interface ShippingMethodDTO {
  shippingMethodId: string
}

export interface PaymentMethodDTO {
  gateway:  PaymentGateway
  method?:  string
}

// ─────────────────────────────────────────────
// CHECKOUT SUMMARY DTO
// ─────────────────────────────────────────────

export interface CheckoutItemDTO {
  productId:    string
  variantId?:   string
  productName:  string
  variantName?: string
  sku:          string
  imageUrl?:    string
  quantity:     number
  unitPrice:    number
  totalPrice:   number
}

export interface CheckoutSummaryDTO {
  checkoutId:       string
  status:           CheckoutStatus
  step:             CheckoutStep
  currency:         string

  customerInfo?:    CustomerInfo
  shippingAddress?: AddressModel
  billingAddress?:  AddressModel
  sameAsShipping:   boolean

  availableShippingMethods?: ShippingMethod[]
  selectedShipping?:         SelectedShipping

  paymentGateway?:   PaymentGateway
  paymentSessionId?: string

  items:   CheckoutItemDTO[]
  pricing: CheckoutPricing

  // What steps are complete
  completedSteps: CheckoutStep[]
  nextStep:       CheckoutStep | null

  expiresAt:  string
  updatedAt:  string
}

// ─────────────────────────────────────────────
// CHECKOUT RESULT DTO
// ─────────────────────────────────────────────

export interface CheckoutResultDTO {
  success:         boolean
  checkoutId:      string
  status:          CheckoutStatus
  orderId?:        string
  orderNumber?:    string
  paymentUrl?:     string       // QPay payment URL
  paymentQrCode?:  string       // QPay QR code
  message:         string
}

// ─────────────────────────────────────────────
// VALIDATION RESULT DTO
// ─────────────────────────────────────────────

export interface ValidationResultDTO {
  valid:        boolean
  errors:       string[]
  warnings:     string[]        // e.g. price changed warnings
  priceChanges: {
    productName: string
    oldPrice:    number
    newPrice:    number
  }[]
}
