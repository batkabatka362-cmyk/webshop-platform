/**
 * WEBSHOP — CHECKOUT SYSTEM
 * Checkout Storage
 *
 * Layer  : Layer 4 — Application Layer
 * System : Checkout System
 * Module : checkout-storage
 *
 * Modules:
 *   checkout_session_store → Full session in Redis
 *   checkout_cache         → Summary + pricing cache
 */

import { createClient, RedisClientType } from 'redis'
import { CheckoutSession, CheckoutPricing } from '../models'
import { checkoutConfig }                   from '../config/checkout_config'
import { checkoutSessionKey, checkoutLockKey, checkoutSummaryKey } from '../utils'

// ─────────────────────────────────────────────
// REDIS CLIENT
// ─────────────────────────────────────────────

let redisClient: RedisClientType | null = null

export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    redisClient = createClient({ url: checkoutConfig.redis.url }) as RedisClientType
    redisClient.on('error', (err) => console.error('[CHECKOUT REDIS] Error:', err))
    await redisClient.connect()
  }
  return redisClient
}

// ─────────────────────────────────────────────
// CHECKOUT SESSION STORE
// ─────────────────────────────────────────────

export class CheckoutSessionStore {

  async get(checkoutId: string): Promise<CheckoutSession | null> {
    const client = await getRedisClient()
    const raw    = await client.get(checkoutSessionKey(checkoutId))
    if (!raw) return null
    try {
      return JSON.parse(raw) as CheckoutSession
    } catch {
      return null
    }
  }

  async save(session: CheckoutSession): Promise<void> {
    const client = await getRedisClient()
    const ttl    = checkoutConfig.session.idleTtlSeconds

    // Update timestamps
    session.updatedAt  = new Date().toISOString()
    session.expiresAt  = new Date(Date.now() + ttl * 1000).toISOString()

    await client.setEx(
      checkoutSessionKey(session.id),
      ttl,
      JSON.stringify(session)
    )
  }

  async delete(checkoutId: string): Promise<void> {
    const client = await getRedisClient()
    await client.del(checkoutSessionKey(checkoutId))
  }

  async exists(checkoutId: string): Promise<boolean> {
    const client = await getRedisClient()
    return (await client.exists(checkoutSessionKey(checkoutId))) === 1
  }

  /**
   * Refreshes TTL without changing session data.
   */
  async refresh(checkoutId: string): Promise<void> {
    const session = await this.get(checkoutId)
    if (session) await this.save(session)
  }
}

// ─────────────────────────────────────────────
// CHECKOUT CACHE
// ─────────────────────────────────────────────

export class CheckoutSummaryCache {

  async getSummary(checkoutId: string): Promise<unknown | null> {
    const client = await getRedisClient()
    const raw    = await client.get(checkoutSummaryKey(checkoutId))
    return raw ? JSON.parse(raw) : null
  }

  async setSummary(checkoutId: string, summary: unknown): Promise<void> {
    const client = await getRedisClient()
    await client.setEx(
      checkoutSummaryKey(checkoutId),
      checkoutConfig.cache.summaryTtl,
      JSON.stringify(summary)
    )
  }

  async invalidateSummary(checkoutId: string): Promise<void> {
    const client = await getRedisClient()
    await client.del(checkoutSummaryKey(checkoutId))
  }

  async setPrice(variantId: string, price: number): Promise<void> {
    const client = await getRedisClient()
    await client.setEx(
      checkoutConfig.keys.price(variantId),
      checkoutConfig.cache.priceTtl,
      String(price)
    )
  }

  async getPrice(variantId: string): Promise<number | null> {
    const client = await getRedisClient()
    const raw    = await client.get(checkoutConfig.keys.price(variantId))
    return raw ? parseFloat(raw) : null
  }
}

// ─────────────────────────────────────────────
// CHECKOUT LOCK
// Prevents concurrent step submissions
// ─────────────────────────────────────────────

export class CheckoutLock {

  async acquire(checkoutId: string, ttlMs = 5000): Promise<boolean> {
    const client = await getRedisClient()
    const result = await client.set(checkoutLockKey(checkoutId), '1', {
      NX: true,
      PX: ttlMs,
    })
    return result === 'OK'
  }

  async release(checkoutId: string): Promise<void> {
    const client = await getRedisClient()
    await client.del(checkoutLockKey(checkoutId))
  }

  async withLock<T>(checkoutId: string, fn: () => Promise<T>): Promise<T> {
    const acquired = await this.acquire(checkoutId)
    if (!acquired) {
      throw new CheckoutError(
        'Checkout is being processed. Please wait.',
        'CHECKOUT_LOCKED',
        409
      )
    }
    try {
      return await fn()
    } finally {
      await this.release(checkoutId)
    }
  }
}

// ─────────────────────────────────────────────
// CHECKOUT ERROR
// ─────────────────────────────────────────────

export class CheckoutError extends Error {
  public readonly statusCode: number
  public readonly code:       string

  constructor(message: string, code: string, statusCode = 400) {
    super(message)
    this.name       = 'CheckoutError'
    this.code       = code
    this.statusCode = statusCode
  }
}

export const sessionStore   = new CheckoutSessionStore()
export const summaryCache   = new CheckoutSummaryCache()
export const checkoutLock   = new CheckoutLock()
