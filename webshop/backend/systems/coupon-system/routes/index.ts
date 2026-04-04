// @ts-nocheck
/**
 * WEBSHOP — Coupon System — Routes
 *
 * POST   /api/v1/admin/coupons         — Create coupon
 * GET    /api/v1/admin/coupons         — List coupons
 * PUT    /api/v1/admin/coupons/:id     — Update coupon
 * DELETE /api/v1/admin/coupons/:id     — Delete coupon
 * POST   /api/v1/checkout/apply-coupon — Apply coupon to checkout
 */

import { Router, Request, Response, NextFunction } from 'express'
import { couponService } from '../services'
import { z } from 'zod'

// V85: Shared Prisma to prevent connection leaks
declare const prisma: any;

function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch((err) => {
    res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } })
  })
}

const CouponSchema = z.object({
  code:              z.string().min(1).max(50),
  discountType:      z.enum(['percentage', 'fixed']),
  discountValue:     z.number().positive(),
  minOrderAmount:    z.number().min(0).default(0),
  maxDiscountAmount: z.number().positive().optional(),
  expiresAt:         z.string().optional(),
  usageLimit:        z.number().int().min(0).default(0),
  description:       z.string().optional(),
})

// ─── Admin Coupon Routes ──────────────────────
import { adminAuth } from '../../../admin-system/services'

export const couponAdminRouter = Router()

// Protect all admin routes with adminAuth
couponAdminRouter.use(adminAuth)

couponAdminRouter.post('/', handle(async (req, res) => {
  const dto    = CouponSchema.parse(req.body)
  const coupon = await couponService.create(dto)
  res.status(201).json({ success: true, data: coupon })
}))

couponAdminRouter.get('/', handle(async (req, res) => {
  const page  = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const data  = await couponService.findAll(page, limit)
  res.json({ success: true, data })
}))

couponAdminRouter.put('/:id', handle(async (req, res) => {
  const rawBody = req.body
  if ('usageCount' in rawBody) delete rawBody.usageCount
  const dto    = CouponSchema.partial().parse(rawBody)
  const coupon = await couponService.update(req.params.id, dto as any)
  res.json({ success: true, data: coupon })
}))

couponAdminRouter.delete('/:id', handle(async (req, res) => {
  const coupon = await couponService.deactivate(req.params.id)
  res.json({ success: true, data: { id: coupon.id, active: false, message: 'Coupon deactivated (preserved for audit)' } })
}))

// ─── Checkout Apply Coupon Route ──────────────

export const couponCheckoutRouter = Router()

couponCheckoutRouter.post('/apply-coupon', handle(async (req, res) => {
  const { code, subtotal } = req.body

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ success: false, error: { message: 'Coupon code is required' } })
  }
  if (!subtotal || typeof subtotal !== 'number' || subtotal <= 0) {
    return res.status(400).json({ success: false, error: { message: 'Valid subtotal is required' } })
  }

  const result = await couponService.validateAndApply(code, subtotal)

  if (!result.valid) {
    return res.status(422).json({ success: false, error: { code: 'INVALID_COUPON', message: result.message } })
  }

  res.json({ success: true, data: result })
}))

couponCheckoutRouter.post('/validate', handle(async (req, res) => {
  const { code } = req.body
  if (!code) return res.status(400).json({ success: false, message: 'Code required' })
  
  // Use existing service logic instead of duplicating it
  const result = await couponService.validateAndApply(code, 99999999); // Use huge amount just to check if it exists/active/expired
  
  if (!result.valid && result.message === 'Coupon not found') return res.json({ success: false });
  if (!result.valid && result.message === 'Coupon is inactive') return res.json({ success: false });
  if (!result.valid && result.message === 'Coupon has expired') return res.json({ success: false });

  // Fetch full details if basic checks pass
  const coupon = await couponService.findByCode(code);
  if (!coupon) return res.json({ success: false });

  res.json({ success: true, data: { discountValue: coupon.discountValue, type: coupon.discountType } })
}))
