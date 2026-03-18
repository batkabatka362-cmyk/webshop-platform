/**
 * WEBSHOP — Coupon System — Types
 */

export type DiscountType = 'percentage' | 'fixed'

export interface CouponModel {
  id:              string
  code:            string
  discountType:    DiscountType
  discountValue:   number
  minOrderAmount:  number
  maxDiscountAmount?: number
  expiresAt:       Date | null
  usageLimit:      number
  usageCount:      number
  active:          boolean
  description?:    string
  createdAt:       Date
  updatedAt:       Date
}

export interface CreateCouponDTO {
  code:              string
  discountType:      DiscountType
  discountValue:     number
  minOrderAmount?:   number
  maxDiscountAmount?: number
  expiresAt?:        string
  usageLimit?:       number
  description?:      string
}

export interface ApplyCouponResult {
  valid:          boolean
  discountAmount: number
  couponCode:     string
  message:        string
}
