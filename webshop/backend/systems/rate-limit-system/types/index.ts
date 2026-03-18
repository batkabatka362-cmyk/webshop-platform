/**
 * WEBSHOP — Rate Limit System — Types
 */

export interface RateLimitConfig {
  windowMs:  number
  max:       number
  message:   string
  keyPrefix: string
}

export interface RateLimitInfo {
  limit:     number
  remaining: number
  resetAt:   Date
}
