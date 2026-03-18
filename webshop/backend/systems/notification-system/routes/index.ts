// @ts-nocheck
/**
 * WEBSHOP — Notification System — Routes
 *
 * GET  /api/v1/admin/notifications         — List notifications
 * POST /api/v1/admin/notifications/:id/retry — Retry failed
 */

import { Router, Request, Response, NextFunction } from 'express'
import { notificationService } from '../services'

function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next)
}

export const notificationRouter = Router()

notificationRouter.get('/', handle(async (req, res) => {
  const page  = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const event = req.query.event as string
  const data  = await notificationService.getHistory(page, limit, event)
  res.json({ success: true, data })
}))

notificationRouter.post('/:id/retry', handle(async (req, res) => {
  const result = await notificationService.retryFailed(req.params.id)
  res.json({ success: true, data: result })
}))
