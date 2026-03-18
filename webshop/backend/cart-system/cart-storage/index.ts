/**
 * WEBSHOP — CART SYSTEM
 * Cart Storage
 *
 * Layer  : Layer 4 — Application Layer
 * System : Cart System
 * Module : cart-storage
 *
 * Modules:
 *   session_cart    → Guest cart Redis storage
 *   user_cart       → Persistent user cart with cache
 *   cart_cache      → Redis cache manager
 */

import { createClient, RedisClientType } from 'redis'
import { CartModel } from '../models'
import { cartConfig } from '../config/cart_config'
import { guestCartKey, userCartKey, cartLockKey } from '../utils'

// ─────────────────────────────────────────────
// REDIS CLIENT SINGLETON
// ─────────────────────────────────────────────

let redisClient: RedisClientType | null = null

export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    redisClient = createClient({ url: cartConfig.redis.url }) as RedisClientType
    redisClient.on('error', (err) => console.error('[CART REDIS] Error:', err))
    redisClient.on('connect', ()  => console.info('[CART REDIS] Connected'))
    await redisClient.connect()
  }
  return redisClient
}

// ─────────────────────────────────────────────
// REDIS CART CACHE
// ─────────────────────────────────────────────

export class RedisCacheManager {

  async get(key: string): Promise<CartModel | null> {
    const client = await getRedisClient()
    const raw    = await client.get(key)
    if (!raw) return null
    try {
      return JSON.parse(raw) as CartModel
    } catch {
      return null
    }
  }

  async set(key: string, cart: CartModel, ttlSeconds: number): Promise<void> {
    const client = await getRedisClient()
    await client.setEx(key, ttlSeconds, JSON.stringify(cart))
  }

  async delete(key: string): Promise<void> {
    const client = await getRedisClient()
    await client.del(key)
  }

  async exists(key: string): Promise<boolean> {
    const client = await getRedisClient()
    return (await client.exists(key)) === 1
  }

  async setPrice(variantId: string, price: number): Promise<void> {
    const client = await getRedisClient()
    await client.setEx(
      cartConfig.keys.price(variantId),
      cartConfig.ttl.priceCache,
      String(price)
    )
  }

  async getPrice(variantId: string): Promise<number | null> {
    const client = await getRedisClient()
    const raw    = await client.get(cartConfig.keys.price(variantId))
    return raw ? parseFloat(raw) : null
  }
}

// ─────────────────────────────────────────────
// GUEST CART STORAGE (Session Cart)
// ─────────────────────────────────────────────

export class GuestCartStorage {
  private cache = new RedisCacheManager()

  async get(sessionId: string): Promise<CartModel | null> {
    return this.cache.get(guestCartKey(sessionId))
  }

  async save(sessionId: string, cart: CartModel): Promise<void> {
    await this.cache.set(guestCartKey(sessionId), cart, cartConfig.ttl.guest)
  }

  async delete(sessionId: string): Promise<void> {
    await this.cache.delete(guestCartKey(sessionId))
  }

  async exists(sessionId: string): Promise<boolean> {
    return this.cache.exists(guestCartKey(sessionId))
  }

  /**
   * Refreshes the TTL of a guest cart (extend on activity).
   */
  async refresh(sessionId: string): Promise<void> {
    const cart = await this.get(sessionId)
    if (cart) {
      await this.save(sessionId, cart)
    }
  }
}

// ─────────────────────────────────────────────
// USER CART SYNC (Persistent Cart + Cache)
// ─────────────────────────────────────────────

export class UserCartSync {
  private cache = new RedisCacheManager()

  /**
   * Gets user cart — cache first, falls back to DB query.
   * Caller is responsible for DB fallback.
   */
  async getFromCache(customerId: string): Promise<CartModel | null> {
    return this.cache.get(userCartKey(customerId))
  }

  /**
   * Writes cart to Redis cache after DB write.
   */
  async writeToCache(customerId: string, cart: CartModel): Promise<void> {
    await this.cache.set(userCartKey(customerId), cart, cartConfig.ttl.user)
  }

  /**
   * Invalidates cached cart — forces next read from DB.
   */
  async invalidate(customerId: string): Promise<void> {
    await this.cache.delete(userCartKey(customerId))
  }
}

// ─────────────────────────────────────────────
// DISTRIBUTED CART LOCK
// Prevents concurrent item additions from corrupting totals
// ─────────────────────────────────────────────

export class CartLock {

  async acquire(cartId: string, ttlMs = 3000): Promise<boolean> {
    const client = await getRedisClient()
    const key    = cartLockKey(cartId)
    const result = await client.set(key, '1', {
      NX: true,
      PX: ttlMs,
    })
    return result === 'OK'
  }

  async release(cartId: string): Promise<void> {
    const client = await getRedisClient()
    await client.del(cartLockKey(cartId))
  }

  async withLock<T>(cartId: string, fn: () => Promise<T>): Promise<T> {
    const acquired = await this.acquire(cartId)
    if (!acquired) {
      throw new CartLockError(`Cart '${cartId}' is locked. Please try again.`)
    }
    try {
      return await fn()
    } finally {
      await this.release(cartId)
    }
  }
}

export class CartLockError extends Error {
  public readonly statusCode = 409
  constructor(message: string) {
    super(message)
    this.name = 'CartLockError'
  }
}

export const guestCartStorage = new GuestCartStorage()
export const userCartSync     = new UserCartSync()
export const cartLock         = new CartLock()
export const cacheManager     = new RedisCacheManager()
