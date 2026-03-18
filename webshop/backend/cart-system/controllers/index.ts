// @ts-nocheck
/**
 * WEBSHOP — CART SYSTEM
 * Controllers + Routes
 */

import { Router, Request, Response, NextFunction } from 'express'
import { CartService, CartItemService, CartPricingService } from '../services'
import { CartError } from '../cart-engines'
import { CartLockError } from '../cart-storage'
import { z } from 'zod'

// ─── Validators ───────────────────────────────

const AddItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity:  z.number().int().min(1).max(999).default(1),
})

const UpdateQuantitySchema = z.object({
  quantity: z.number().int().min(1).max(999),
})

const ApplyCouponSchema = z.object({
  couponCode: z.string().min(1).max(50),
})

const MergeCartSchema = z.object({
  sessionId:  z.string().min(1),
  customerId: z.string().uuid(),
})

// ─── Identity Helper ──────────────────────────

function getIdentity(req: Request): { customerId?: string; sessionId?: string } {
  return {
    customerId: (req as any).user?.id || req.headers['x-customer-id'] as string,
    sessionId:  req.headers['x-session-id'] as string || req.query.sessionId as string,
  }
}

// ─── Error Handler ────────────────────────────

function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch((err) => {
      if (err instanceof CartError || err instanceof CartLockError) {
        res.status(err.statusCode || 400).json({
          success: false,
          error: { code: (err as any).code || 'CART_ERROR', message: err.message },
        })
      } else if (err instanceof z.ZodError) {
        res.status(422).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: err.errors },
        })
      } else {
        next(err)
      }
    })
  }
}

const ok      = (res: Response, data: unknown) => res.json({ success: true, data })
const created = (res: Response, data: unknown) => res.status(201).json({ success: true, data })

// ─── Services ─────────────────────────────────

const cartService        = new CartService()
const cartItemService    = new CartItemService()
const cartPricingService = new CartPricingService()

// ═══════════════════════════════════════════════
// CART ROUTER
// ═══════════════════════════════════════════════

export const cartRouter = Router()

// GET /cart — Get current cart
cartRouter.get('/', handle(async (req, res) => {
  const identity = getIdentity(req)
  const cart = await cartService.getCart(identity)
  ok(res, cart)
}))

// DELETE /cart — Clear cart
cartRouter.delete('/', handle(async (req, res) => {
  const identity = getIdentity(req)
  await cartService.clearCart(identity)
  res.status(204).send()
}))

// POST /cart/items — Add item to cart
cartRouter.post('/items', handle(async (req, res) => {
  const identity = getIdentity(req)
  const dto = AddItemSchema.parse(req.body)
  const cart = await cartItemService.addItem(identity, dto)
  created(res, cart)
}))

// DELETE /cart/items/:itemId — Remove item
cartRouter.delete('/items/:itemId', handle(async (req, res) => {
  const identity = getIdentity(req)
  const cart = await cartItemService.removeItem(identity, req.params.itemId)
  ok(res, cart)
}))

// PATCH /cart/items/:itemId — Update quantity
cartRouter.patch('/items/:itemId', handle(async (req, res) => {
  const identity = getIdentity(req)
  const dto = UpdateQuantitySchema.parse(req.body)
  const cart = await cartItemService.updateQuantity(identity, req.params.itemId, dto)
  ok(res, cart)
}))

// POST /cart/coupon — Apply coupon
cartRouter.post('/coupon', handle(async (req, res) => {
  const identity = getIdentity(req)
  const dto = ApplyCouponSchema.parse(req.body)
  const cart = await cartService.applyCoupon(identity, dto)
  ok(res, cart)
}))

// DELETE /cart/coupon/:code — Remove coupon
cartRouter.delete('/coupon/:code', handle(async (req, res) => {
  const identity = getIdentity(req)
  const cart = await cartService.removeCoupon(identity, req.params.code)
  ok(res, cart)
}))

// POST /cart/merge — Merge guest cart into user cart
cartRouter.post('/merge', handle(async (req, res) => {
  const dto = MergeCartSchema.parse(req.body)
  const cart = await cartService.mergeCart(dto)
  ok(res, cart)
}))

// POST /cart/validate — Validate cart for checkout
cartRouter.post('/validate', handle(async (req, res) => {
  const identity = getIdentity(req)
  const result = await cartPricingService.validateForCheckout(identity)
  ok(res, result)
}))

// POST /cart/refresh-prices — Revalidate all prices
cartRouter.post('/refresh-prices', handle(async (req, res) => {
  const identity = getIdentity(req)
  const result = await cartPricingService.revalidatePrices(identity)
  ok(res, result)
}))
