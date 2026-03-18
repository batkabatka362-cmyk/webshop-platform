/**
 * WEBSHOP — CHECKOUT SYSTEM
 * Validators — Zod Schemas
 *
 * Layer  : Layer 4 — Application Layer
 * System : Checkout System
 * Module : validators
 */

import { z } from 'zod'

// ─── Address Validator ────────────────────────

export const ShippingAddressSchema = z.object({
  firstName:   z.string().min(1).max(255),
  lastName:    z.string().min(1).max(255),
  phone:       z.string().min(8).max(50),
  country:     z.string().min(2).max(100),
  city:        z.string().min(1).max(255),
  district:    z.string().min(1).max(255),
  street:      z.string().min(1).max(500),
  postalCode:  z.string().max(20).optional(),
})

export const BillingAddressSchema = ShippingAddressSchema.extend({
  sameAsShipping: z.boolean().default(true),
})

// ─── Customer Info Validator ──────────────────

export const CustomerInfoSchema = z.object({
  email:     z.string().email('Invalid email address'),
  phone:     z.string().min(8).max(50),
  firstName: z.string().min(1).max(255),
  lastName:  z.string().min(1).max(255),
})

// ─── Shipping Method Validator ────────────────

export const ShippingMethodSchema = z.object({
  shippingMethodId: z.string().min(1),
})

// ─── Payment Method Validator ─────────────────

export const PaymentMethodSchema = z.object({
  gateway: z.enum(['qpay', 'card', 'bank_transfer', 'cash']),
  method:  z.string().optional(),
})

// ─── Checkout Step Validator ──────────────────

export const CreateCheckoutSchema = z.object({
  cartId:          z.string().uuid('Invalid cart ID'),
  customerId:      z.string().uuid().optional(),
  guestSessionId:  z.string().optional(),
  currency:        z.string().length(3).default('MNT'),
  idempotencyKey:  z.string().max(100).optional(),
}).refine(
  (d) => d.customerId || d.guestSessionId,
  { message: 'Either customerId or guestSessionId is required' }
)

// ─── Order Review Validator ───────────────────

export const ConfirmOrderSchema = z.object({
  checkoutId:     z.string().uuid(),
  idempotencyKey: z.string().min(1).max(100),
  agreedToTerms:  z.boolean().refine((v) => v === true, {
    message: 'You must agree to the terms and conditions',
  }),
})
