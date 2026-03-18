/**
 * WEBSHOP — CART SYSTEM
 * Utilities
 */

import crypto from 'crypto'
import { cartConfig } from '../config/cart_config'
import { CartItemModel, CartDiscountModel, CartTotals } from '../models'

export function generateSessionId(): string {
  return `sess_${crypto.randomBytes(16).toString('hex')}`
}

export function cartExpiresAt(type: 'guest' | 'user'): Date {
  const ttl = type === 'guest' ? cartConfig.ttl.guest : cartConfig.ttl.user
  return new Date(Date.now() + ttl * 1000)
}

export function guestCartKey(sessionId: string): string {
  return cartConfig.keys.guest(sessionId)
}

export function userCartKey(customerId: string): string {
  return cartConfig.keys.user(customerId)
}

export function cartLockKey(cartId: string): string {
  return cartConfig.keys.lock(cartId)
}

export function calculateItemTotal(unitPrice: number, quantity: number): number {
  return Math.round(unitPrice * quantity * 100) / 100
}

export function calculateCartTotals(
  items: CartItemModel[],
  discounts: CartDiscountModel[]
): CartTotals {
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)

  let discountTotal = 0
  for (const d of discounts) {
    if (d.discountType === 'percentage') {
      discountTotal += subtotal * (d.discountValue / 100)
    } else {
      discountTotal += d.discountValue
    }
  }
  discountTotal = Math.min(discountTotal, subtotal)

  const taxableAmount = Math.max(0, subtotal - discountTotal)
  const taxTotal = Math.round(taxableAmount * cartConfig.taxRate * 100) / 100
  const grandTotal = Math.round((subtotal - discountTotal + taxTotal) * 100) / 100
  const savings = Math.round(discountTotal * 100) / 100

  const freeShippingThreshold = cartConfig.freeShippingThreshold
  const hasFreeShipping = subtotal >= freeShippingThreshold
  const freeShippingRemaining = hasFreeShipping ? 0 : freeShippingThreshold - subtotal

  return {
    itemCount,
    subtotal: Math.round(subtotal * 100) / 100,
    discountTotal: Math.round(discountTotal * 100) / 100,
    taxTotal,
    grandTotal,
    currency: cartConfig.currency,
    savings,
    freeShippingThreshold,
    freeShippingRemaining,
    hasFreeShipping,
  }
}
