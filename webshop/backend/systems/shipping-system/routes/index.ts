// @ts-nocheck
/**
 * WEBSHOP — Shipping Tracking System — Routes
 *
 * POST /api/v1/admin/orders/:id/ship         — Ship order (admin)
 * PATCH /api/v1/admin/shipping/:orderId/status — Update status (admin)
 * GET  /api/v1/admin/shipping                 — List shipments (admin)
 * GET  /api/v1/orders/:id/tracking            — Get tracking (public)
 */

import { Router, Request, Response, NextFunction } from 'express'
import { shippingTrackingService } from '../services'
import { z } from 'zod'

function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch((err) => {
    res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } })
  })
}

const ShipOrderSchema = z.object({
  trackingNumber:    z.string().min(1).max(100),
  courier:           z.string().max(100).optional(),
  trackingUrl:       z.string().url().optional(),
  shippingMethodId:  z.string().optional(),
  note:              z.string().max(500).optional(),
})

const UpdateStatusSchema = z.object({
  status:      z.enum(['processing', 'shipped', 'in_transit', 'delivered']),
  location:    z.string().max(255).optional(),
  description: z.string().max(500).optional(),
})

// ─── Admin Shipping Routes ────────────────────

export const shippingAdminRouter = Router()

// POST /admin/orders/:id/ship — Ship an order
shippingAdminRouter.post('/orders/:id/ship', handle(async (req, res) => {
  const dto     = ShipOrderSchema.parse(req.body)
  const adminId = (req as any).admin?.id
  const result  = await shippingTrackingService.shipOrder(req.params.id, dto, adminId)
  res.json({ success: true, data: result })
}))

// PATCH /admin/shipping/:orderId/status — Update shipping status
shippingAdminRouter.patch('/shipping/:orderId/status', handle(async (req, res) => {
  const dto    = UpdateStatusSchema.parse(req.body)
  const result = await shippingTrackingService.updateStatus(
    req.params.orderId, dto.status, dto.location, dto.description
  )
  res.json({ success: true, data: result })
}))

// GET /admin/shipping — List all shipments
shippingAdminRouter.get('/shipping', handle(async (req, res) => {
  const page   = parseInt(req.query.page as string) || 1
  const limit  = parseInt(req.query.limit as string) || 20
  const status = req.query.status as string
  const data   = await shippingTrackingService.listShipments(page, limit, status)
  res.json({ success: true, data })
}))

// ─── Public Tracking Route ────────────────────

export const trackingRouter = Router()

// GET /orders/:id/tracking — Get tracking info
trackingRouter.get('/:id/tracking', handle(async (req, res) => {
  const tracking = await shippingTrackingService.getTracking(req.params.id)
  res.json({ success: true, data: tracking })
}))
