/**
 * WEBSHOP — CART SYSTEM
 * Configuration
 */

import { z } from 'zod'

const CartEnvSchema = z.object({
  CART_MAX_ITEMS:               z.string().transform(Number).default('50'),
  CART_MAX_QUANTITY_PER_ITEM:   z.string().transform(Number).default('999'),
  CART_GUEST_TTL_SECONDS:       z.string().transform(Number).default('86400'),
  CART_USER_TTL_SECONDS:        z.string().transform(Number).default('604800'),
  CART_PRICE_CACHE_TTL_SECONDS: z.string().transform(Number).default('60'),
  CART_TAX_RATE:                z.string().transform(Number).default('0.10'),
  CART_FREE_SHIPPING_THRESHOLD: z.string().transform(Number).default('100000'),
  CART_CURRENCY:                z.string().default('MNT'),
  REDIS_URL:                    z.string().default('redis://localhost:6379'),
})

function parseEnv() {
  const result = CartEnvSchema.safeParse(process.env)
  if (!result.success) {
    console.error('❌ [CART CONFIG] Invalid environment:')
    result.error.issues.forEach((i) => console.error(`  → ${i.path}: ${i.message}`))
    process.exit(1)
  }
  return result.data
}

const env = parseEnv()

export const cartConfig = {
  limits: {
    maxItems:           env.CART_MAX_ITEMS,
    maxQuantityPerItem: env.CART_MAX_QUANTITY_PER_ITEM,
  },
  ttl: {
    guest:      env.CART_GUEST_TTL_SECONDS,
    user:       env.CART_USER_TTL_SECONDS,
    priceCache: env.CART_PRICE_CACHE_TTL_SECONDS,
  },
  taxRate:               env.CART_TAX_RATE,
  freeShippingThreshold: env.CART_FREE_SHIPPING_THRESHOLD,
  currency:              env.CART_CURRENCY,
  redis: {
    url: env.REDIS_URL,
  },
  keys: {
    guest:  (id: string) => `cart:guest:${id}`,
    user:   (id: string) => `cart:user:${id}`,
    lock:   (id: string) => `cart:lock:${id}`,
    price:  (id: string) => `cart:price:${id}`,
  },
}

export const pricingRulesConfig = {
  taxRate:               env.CART_TAX_RATE,
  freeShippingThreshold: env.CART_FREE_SHIPPING_THRESHOLD,
  currency:              env.CART_CURRENCY,
}

export default { cartConfig, pricingRulesConfig }
