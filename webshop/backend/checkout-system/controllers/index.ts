// @ts-nocheck
/**
 * WEBSHOP — CHECKOUT SYSTEM
 * Controllers + Routes
 *
 * Layer  : Layer 4 — Application Layer
 * System : Checkout System
 * Module : controllers / routes
 */

import { Router, Request, Response, NextFunction } from 'express'
import {
  checkoutService,
  checkoutPricingService,
  shippingService,
  paymentPreparationService,
} from '../services'
import { checkoutFlow } from '../checkout-core'
// FIX: import errors from models/, not from storage layer
import { CheckoutError } from '../models'
import {
  CreateCheckoutSchema,
  CustomerInfoSchema,
  ShippingAddressSchema,
  ShippingMethodSchema,
  PaymentMethodSchema,
  ConfirmOrderSchema,
} from '../validators'

// ─── Error Handler ────────────────────────────

function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch((err) => {
      if (err instanceof CheckoutError) {
        res.status(err.statusCode).json({
          success: false,
          error:   { code: err.code, message: err.message },
        })
      } else {
        next(err)
      }
    })
  }
}

const ok      = (res: Response, data: unknown) => res.status(200).json({ success: true, data })
const created = (res: Response, data: unknown) => res.status(201).json({ success: true, data })

// ═══════════════════════════════════════════════
// CHECKOUT ROUTES — Main flow
// ═══════════════════════════════════════════════

export const checkoutRouter = Router()

// POST /checkout — Create checkout session from cart
checkoutRouter.post('/', handle(async (req, res) => {
  const dto     = CreateCheckoutSchema.parse(req.body)
  const summary = await checkoutService.createCheckout(dto)
  created(res, summary)
}))

// GET /checkout/:id — Get checkout session
checkoutRouter.get('/:id', handle(async (req, res) => {
  const summary = await checkoutService.getCheckout(req.params.id)
  ok(res, summary)
}))

// DELETE /checkout/:id — Cancel checkout
checkoutRouter.delete('/:id', handle(async (req, res) => {
  await checkoutService.cancelCheckout(req.params.id)
  res.status(204).send()
}))

// GET /checkout/:id/shipping-methods — Available shipping options
checkoutRouter.get('/:id/shipping-methods', handle(async (req, res) => {
  const methods = await shippingService.getAvailableMethods(req.params.id)
  ok(res, methods)
}))

// GET /checkout/:id/payment-methods — Available payment methods
checkoutRouter.get('/:id/payment-methods', handle(async (req, res) => {
  const methods = paymentPreparationService['paymentSelectionEngine']
    ? []
    : [
        { gateway: 'qpay',          name: 'QPay'              },
        { gateway: 'card',          name: 'Картаар төлөх'     },
        { gateway: 'bank_transfer', name: 'Банкаар шилжүүлэх' },
        { gateway: 'cash',          name: 'Бэлнээр'           },
      ]
  ok(res, methods)
}))

// GET /checkout/:id/validate — Validate before confirm
checkoutRouter.get('/:id/validate', handle(async (req, res) => {
  const result = await checkoutPricingService.validateAndGetSummary(req.params.id)
  ok(res, result)
}))

// POST /checkout/:id/confirm — Confirm order & initiate payment
checkoutRouter.post('/:id/confirm', handle(async (req, res) => {
  const dto    = ConfirmOrderSchema.parse({ ...req.body, checkoutId: req.params.id })
  const result = await paymentPreparationService.confirmAndInitiatePayment(
    req.params.id,
    dto.idempotencyKey
  )
  ok(res, result)
}))

// POST /checkout/payment/success — Payment success callback (from Payment System)
checkoutRouter.post('/payment/success', handle(async (req, res) => {
  const { checkoutId, paymentId } = req.body
  const result = await paymentPreparationService.handlePaymentSuccess(checkoutId, paymentId)
  ok(res, result)
}))

// POST /checkout/payment/failure — Payment failure callback
checkoutRouter.post('/payment/failure', handle(async (req, res) => {
  const { checkoutId } = req.body
  await paymentPreparationService.handlePaymentFailure(checkoutId)
  ok(res, { handled: true })
}))

// ═══════════════════════════════════════════════
// CHECKOUT STEP ROUTES
// ═══════════════════════════════════════════════

export const checkoutStepRouter = Router()

// POST /checkout/:id/steps/customer — Step 1: Customer info
checkoutStepRouter.post('/:id/steps/customer', handle(async (req, res) => {
  const dto     = CustomerInfoSchema.parse(req.body)
  const session = await checkoutFlow.setCustomerInfo(req.params.id, dto)
  ok(res, { step: session.step, customerInfo: session.customerInfo })
}))

// POST /checkout/:id/steps/shipping-address — Step 2: Shipping address
checkoutStepRouter.post('/:id/steps/shipping-address', handle(async (req, res) => {
  const dto     = ShippingAddressSchema.parse(req.body)
  const session = await checkoutFlow.setShippingAddress(req.params.id, dto)
  ok(res, {
    step:            session.step,
    shippingAddress: session.shippingAddress,
  })
}))

// POST /checkout/:id/steps/shipping-method — Step 3: Shipping method
checkoutStepRouter.post('/:id/steps/shipping-method', handle(async (req, res) => {
  const dto     = ShippingMethodSchema.parse(req.body)
  const session = await checkoutFlow.setShippingMethod(req.params.id, dto)
  ok(res, {
    step:           session.step,
    shippingMethod: session.shippingMethod,
    pricing:        session.pricing,
  })
}))

// POST /checkout/:id/steps/payment-method — Step 4: Payment method
checkoutStepRouter.post('/:id/steps/payment-method', handle(async (req, res) => {
  const dto     = PaymentMethodSchema.parse(req.body) as any
  const session = await checkoutFlow.setPaymentMethod(req.params.id, dto)
  ok(res, {
    step:           session.step,
    paymentGateway: session.paymentGateway,
  })
}))

// GET /checkout/:id/steps/review — Step 5: Order review
checkoutStepRouter.get('/:id/steps/review', handle(async (req, res) => {
  const { session, validation } = await checkoutFlow.reviewOrder(req.params.id)
  ok(res, {
    step:       session.step,
    session,
    validation,
    readyToConfirm: validation.valid,
  })
}))

// Mount step router onto main checkout router
checkoutRouter.use('/', checkoutStepRouter)
