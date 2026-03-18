/**
 * WEBSHOP — Rate Limit System — Service
 */

import rateLimit from 'express-rate-limit'
import { RateLimitConfig } from '../types'

const configs: Record<string, RateLimitConfig> = {
  auth: {
    windowMs:  60 * 1000,
    max:       5,
    message:   'Too many auth requests. Please try again after 1 minute.',
    keyPrefix: 'rl:auth:',
  },
  checkout: {
    windowMs:  60 * 1000,
    max:       10,
    message:   'Too many checkout requests. Please slow down.',
    keyPrefix: 'rl:checkout:',
  },
  payments: {
    windowMs:  60 * 1000,
    max:       10,
    message:   'Too many payment requests. Please wait.',
    keyPrefix: 'rl:payments:',
  },
  orders: {
    windowMs:  60 * 1000,
    max:       10,
    message:   'Too many order requests. Please slow down.',
    keyPrefix: 'rl:orders:',
  },
  general: {
    windowMs:  60 * 1000,
    max:       100,
    message:   'Too many requests. Please try again later.',
    keyPrefix: 'rl:general:',
  },
}

function createLimiter(config: RateLimitConfig) {
  return rateLimit({
    windowMs:             config.windowMs,
    max:                  config.max,
    message:              { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: config.message } },
    standardHeaders:      true,
    legacyHeaders:        false,
    keyGenerator:         (req) => req.ip || req.headers['x-forwarded-for'] as string || 'unknown',
    skip:                 (req) => req.method === 'OPTIONS',
  })
}

export const authLimiter     = createLimiter(configs.auth)
export const checkoutLimiter = createLimiter(configs.checkout)
export const paymentLimiter  = createLimiter(configs.payments)
export const orderLimiter    = createLimiter(configs.orders)
export const generalLimiter  = createLimiter(configs.general)

export function getRateLimitConfigs() { return configs }
