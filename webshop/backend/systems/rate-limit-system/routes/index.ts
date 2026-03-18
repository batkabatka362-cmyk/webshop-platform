/**
 * WEBSHOP — Rate Limit System — Routes
 */

import { Router } from 'express'
import { getRateLimitConfigs } from '../services'

export const rateLimitRouter = Router()

// GET /api/v1/system/rate-limits — View rate limit config (admin)
rateLimitRouter.get('/rate-limits', (_req, res) => {
  const configs = getRateLimitConfigs()
  const info = Object.entries(configs).map(([name, cfg]) => ({
    name,
    windowMs: cfg.windowMs,
    maxRequests: cfg.max,
  }))
  res.json({ success: true, data: info })
})
