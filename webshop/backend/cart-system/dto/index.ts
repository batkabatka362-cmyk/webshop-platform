/**
 * WEBSHOP — CART SYSTEM
 * Data Transfer Objects
 */

import { CartTotals } from '../models'

// ─── Request DTOs ─────────────────────────────

export interface AddItemDTO {
  productId:  string
  variantId?: string
  quantity:   number
}

export interface UpdateQuantityDTO {
  quantity: number
}

export interface ApplyCouponDTO {
  couponCode: string
}

export interface MergeCartDTO {
  sessionId:  string
  customerId: string
}

// ─── Response DTOs ────────────────────────────

export interface CartItemResponseDTO {
  id:           string
  productId:    string
  variantId?:   string
  productName:  string
  variantName?: string
  sku:          string
  slug:         string
  imageUrl?:    string
  quantity:     number
  unitPrice:    number
  totalPrice:   number
  currentPrice: number
  priceChanged: boolean
  inStock:      boolean
  stockQty:     number
}

export interface CartSummaryDTO extends CartTotals {
  discounts: {
    id:            string
    kind:          string
    code?:         string
    description:   string
    discountType:  string
    appliedAmount: number
  }[]
}

export interface CartResponseDTO {
  id:         string
  type:       string
  status:     string
  currency:   string
  couponCode?: string
  expiresAt?: string
  updatedAt?: string
  items:      CartItemResponseDTO[]
  summary:    CartSummaryDTO
}
