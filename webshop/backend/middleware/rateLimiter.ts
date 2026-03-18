/**
 * WEBSHOP — Rate Limiter Middleware
 *
 * Usage in server.ts:
 *   import { applyRateLimits } from './middleware/rateLimiter'
 *   applyRateLimits(app, BASE)
 */

import { Express } from 'express'
import {
  authLimiter,
  checkoutLimiter,
  paymentLimiter,
  orderLimiter,
  generalLimiter,
} from '../systems/rate-limit-system/services'

export function applyRateLimits(app: Express, basePath: string) {
  // Auth endpoints: 5 req/min
  app.use(`${basePath}/auth`,     authLimiter)

  // Checkout endpoints: 10 req/min
  app.use(`${basePath}/checkout`, checkoutLimiter)

  // Payment endpoints: 10 req/min
  app.use(`${basePath}/payments`, paymentLimiter)

  // Order endpoints: 10 req/min
  app.use(`${basePath}/orders`,   orderLimiter)

  // All other endpoints: 100 req/min
  app.use(`${basePath}`,          generalLimiter)

  console.info('[RATE LIMIT] Rate limiting enabled for all API routes')
}

export {
  authLimiter,
  checkoutLimiter,
  paymentLimiter,
  orderLimiter,
  generalLimiter,
}
