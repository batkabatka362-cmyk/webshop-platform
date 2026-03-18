/**
 * WEBSHOP — CHECKOUT SYSTEM
 * Utilities
 *
 * Layer  : Layer 4 — Application Layer
 * System : Checkout System
 * Module : utils
 */

import crypto from 'crypto'
import { checkoutConfig } from '../config/checkout_config'
import { AddressModel, CheckoutPricing, CheckoutItemModel } from '../models'

// ─────────────────────────────────────────────
// CHECKOUT ID GENERATOR
// ─────────────────────────────────────────────

export function generateCheckoutId(): string {
  return `co_${crypto.randomBytes(12).toString('hex')}`
}

export function generateIdempotencyKey(): string {
  return `idem_${crypto.randomBytes(16).toString('hex')}`
}

export function checkoutSessionKey(id: string): string {
  return checkoutConfig.keys.session(id)
}

export function checkoutLockKey(id: string): string {
  return checkoutConfig.keys.lock(id)
}

export function checkoutSummaryKey(id: string): string {
  return checkoutConfig.keys.summary(id)
}

export function sessionExpiresAt(offsetSeconds?: number): Date {
  const ttl = offsetSeconds ?? checkoutConfig.session.idleTtlSeconds
  return new Date(Date.now() + ttl * 1000)
}

// ─────────────────────────────────────────────
// ADDRESS FORMATTER
// ─────────────────────────────────────────────

export function formatAddress(address: AddressModel): string {
  return [
    `${address.firstName} ${address.lastName}`,
    address.street,
    address.district,
    address.city,
    address.country,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(', ')
}

export function addressToSnapshot(address: AddressModel): Record<string, unknown> {
  return {
    firstName:  address.firstName,
    lastName:   address.lastName,
    phone:      address.phone,
    country:    address.country,
    city:       address.city,
    district:   address.district,
    street:     address.street,
    postalCode: address.postalCode ?? null,
  }
}

// ─────────────────────────────────────────────
// CURRENCY FORMATTER
// ─────────────────────────────────────────────

export function formatMNT(amount: number): string {
  return new Intl.NumberFormat('mn-MN', {
    style:                 'currency',
    currency:              'MNT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100
}

// ─────────────────────────────────────────────
// PRICING CALCULATOR
// ─────────────────────────────────────────────

export function calculateCheckoutPricing(
  items:         CheckoutItemModel[],
  shippingFee:   number,
  discountTotal: number,
  taxRate:       number,
  currency:      string
): CheckoutPricing {
  const subtotal = roundMoney(
    items.reduce((sum, i) => sum + i.totalPrice, 0)
  )

  const shippingTotal = roundMoney(shippingFee)

  // Tax is applied on (subtotal - discount)
  const taxableAmount = Math.max(0, subtotal - discountTotal)
  const taxTotal      = roundMoney(taxableAmount * taxRate)

  const grandTotal = roundMoney(
    subtotal - discountTotal + shippingTotal + taxTotal
  )

  return {
    subtotal,
    discountTotal: roundMoney(discountTotal),
    shippingTotal,
    taxTotal,
    grandTotal,
    currency,
  }
}

// ─────────────────────────────────────────────
// STEP ORDERING
// ─────────────────────────────────────────────

const STEP_ORDER = [
  'customer_info',
  'shipping_address',
  'shipping_method',
  'payment_method',
  'order_review',
  'confirmed',
] as const

export type CheckoutStep = typeof STEP_ORDER[number]

export function nextStep(current: CheckoutStep): CheckoutStep | null {
  const idx = STEP_ORDER.indexOf(current)
  return idx >= 0 && idx < STEP_ORDER.length - 1
    ? STEP_ORDER[idx + 1]
    : null
}

export function completedSteps(current: CheckoutStep): CheckoutStep[] {
  const idx = STEP_ORDER.indexOf(current)
  return STEP_ORDER.slice(0, idx) as CheckoutStep[]
}

export function isStepComplete(session: { step: CheckoutStep }, target: CheckoutStep): boolean {
  return STEP_ORDER.indexOf(session.step) > STEP_ORDER.indexOf(target)
}
