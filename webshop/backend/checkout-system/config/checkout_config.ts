/**
 * WEBSHOP — CHECKOUT SYSTEM
 * Configuration
 *
 * Layer  : Layer 4 — Application Layer
 * System : Checkout System
 * Module : config
 */

import { z } from 'zod'

// ─── Checkout Config Schema ───────────────────

const CheckoutEnvSchema = z.object({
  CHECKOUT_SESSION_TTL_SECONDS:     z.string().transform(Number).default('900'),    // 15 min idle
  CHECKOUT_MAX_SESSION_TTL_SECONDS: z.string().transform(Number).default('3600'),   // 60 min max
  CHECKOUT_CURRENCY:                z.string().default('MNT'),
  CHECKOUT_TAX_RATE:                z.string().transform(Number).default('0.10'),
  CHECKOUT_MIN_ORDER_AMOUNT:        z.string().transform(Number).default('1000'),
  CHECKOUT_PRICE_CACHE_TTL_SECONDS: z.string().transform(Number).default('60'),     // 1 min
  CHECKOUT_SUMMARY_CACHE_TTL:       z.string().transform(Number).default('300'),    // 5 min
  REDIS_URL:                        z.string().url().default('redis://localhost:6379'),
})

function parseEnv() {
  const result = CheckoutEnvSchema.safeParse(process.env)
  if (!result.success) {
    console.error('❌ [CHECKOUT CONFIG] Invalid environment:')
    result.error.issues.forEach((i) => console.error(`  → ${i.path}: ${i.message}`))
    process.exit(1)
  }
  return result.data
}

const env = parseEnv()

export const checkoutConfig = {
  session: {
    idleTtlSeconds: env.CHECKOUT_SESSION_TTL_SECONDS,
    maxTtlSeconds:  env.CHECKOUT_MAX_SESSION_TTL_SECONDS,
  },
  currency:       env.CHECKOUT_CURRENCY,
  taxRate:        env.CHECKOUT_TAX_RATE,
  minOrderAmount: env.CHECKOUT_MIN_ORDER_AMOUNT,
  cache: {
    priceTtl:   env.CHECKOUT_PRICE_CACHE_TTL_SECONDS,
    summaryTtl: env.CHECKOUT_SUMMARY_CACHE_TTL,
  },
  redis: {
    url: env.REDIS_URL,
  },
  keys: {
    session: (id: string) => `checkout:session:${id}`,
    lock:    (id: string) => `checkout:lock:${id}`,
    summary: (id: string) => `checkout:summary:${id}`,
    price:   (id: string) => `checkout:price:${id}`,
  },
}

// ─── Shipping Rules Config ────────────────────

export const shippingRulesConfig = {
  freeShippingThreshold: 100000,   // ₮100,000

  methods: [
    {
      id:             'standard',
      name:           'Стандарт хүргэлт',
      baseFee:        5000,
      estimatedDays:  { min: 2, max: 5 },
      isActive:       true,
    },
    {
      id:             'express',
      name:           'Экспресс хүргэлт',
      baseFee:        10000,
      estimatedDays:  { min: 1, max: 2 },
      isActive:       true,
    },
    {
      id:             'pickup',
      name:           'Өөрөө авах',
      baseFee:        0,
      estimatedDays:  { min: 0, max: 1 },
      isActive:       true,
    },
  ],

  weightRates: [
    { maxWeightKg: 1,  extraFee: 0    },
    { maxWeightKg: 5,  extraFee: 1000 },
    { maxWeightKg: 10, extraFee: 2000 },
    { maxWeightKg: 999, extraFee: 5000 },
  ],
}

export default { checkoutConfig, shippingRulesConfig }
