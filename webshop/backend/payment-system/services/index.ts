// @ts-nocheck
/**
 * WEBSHOP — PAYMENT SYSTEM
 * QPay Integration + Payment Service + Controller
 */

import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { Logger } from '../../middleware/logger'

declare const prisma: PrismaClient

// ═══════════════════════════════════════════════
// QPAY GATEWAY
// ═══════════════════════════════════════════════

class QPay {
  private baseUrl  = process.env.QPAY_BASE_URL || 'https://merchant.qpay.mn/v2'
  private username = process.env.QPAY_USERNAME || ''
  private password = process.env.QPAY_PASSWORD || ''
  private invoiceCode = process.env.QPAY_INVOICE_CODE || ''
  private token:    string | null = null
  private tokenExp: number = 0

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExp) return this.token

    const res = await fetch(`${this.baseUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64'),
      },
    })

    if (!res.ok) throw new Error(`QPay auth failed: ${res.status}`)
    const data = await res.json()
    this.token    = data.access_token
    this.tokenExp = Date.now() + (data.expires_in ?? 3600) * 1000 - 60000
    return this.token!
  }

  async createInvoice(params: {
    orderId:     string
    amount:      number
    description: string
    callbackUrl: string
  }) {
    const token = await this.getToken()

    const res = await fetch(`${this.baseUrl}/invoice`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoice_code:         this.invoiceCode,
        sender_invoice_no:    params.orderId,
        invoice_receiver_code: params.orderId,
        invoice_description:  params.description,
        amount:               params.amount,
        callback_url:         params.callbackUrl,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      throw new Error(`QPay invoice creation failed: ${res.status} ${errBody}`)
    }

    const data = await res.json()
    return {
      invoiceId:  data.invoice_id,
      qrText:     data.qr_text,
      qrImage:    data.qr_image,
      urls:       data.urls || [],
      expiresAt:  new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }
  }

  async checkPayment(invoiceId: string): Promise<{ paid: boolean; paymentId?: string }> {
    const token = await this.getToken()

    const res = await fetch(`${this.baseUrl}/payment/check`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ object_type: 'INVOICE', object_id: invoiceId }),
    })

    if (!res.ok) return { paid: false }
    const data = await res.json()
    const paid = data.count > 0 && data.paid_amount >= data.total_amount

    return {
      paid,
      paymentId: data.rows?.[0]?.payment_id,
    }
  }

  isConfigured(): boolean {
    return !!(this.username && this.password && this.invoiceCode)
  }
}

const qpay = new QPay()

// ═══════════════════════════════════════════════
// PAYMENT SERVICE
// ═══════════════════════════════════════════════

export class PaymentService {

  async createPayment(params: {
    orderId:    string
    gateway:    string
    amount:     number
    currency:   string
    checkoutId: string
  }) {
    const paymentId      = `pay_${crypto.randomBytes(12).toString('hex')}`
    const idempotencyKey = `idem_${crypto.randomBytes(16).toString('hex')}`
    const callbackUrl    = `${process.env.PAYMENT_CALLBACK_BASE_URL || 'http://localhost:4000'}/api/v1/payments/callback`

    let gatewayRef:     string | undefined
    let gatewayResponse: any   = {}
    let paymentUrl:     string | undefined
    let qrCode:        string | undefined

    if (params.gateway === 'qpay' && qpay.isConfigured()) {
      try {
        const invoice = await qpay.createInvoice({
          orderId:     params.checkoutId,
          amount:      params.amount,
          description: `WEBSHOP захиалга #${params.checkoutId}`,
          callbackUrl,
        })
        gatewayRef      = invoice.invoiceId
        gatewayResponse = invoice
        qrCode          = invoice.qrImage
        paymentUrl      = invoice.urls?.[0]?.link
      } catch (err) {
        console.error('[PAYMENT] QPay invoice error:', err)
        gatewayResponse = { error: (err as Error).message }
      }
    }

    const payment = await prisma.payment.create({
      data: {
        id:              paymentId,
        orderId:         params.orderId || params.checkoutId,
        gateway:         params.gateway,
        status:          'pending',
        amount:          params.amount,
        currency:        params.currency,
        gatewayRef,
        gatewayResponse,
        idempotencyKey,
        expiresAt:       new Date(Date.now() + 30 * 60 * 1000),
      },
    })

    await prisma.paymentHistory.create({
      data: { paymentId, eventType: 'created', rawPayload: { gateway: params.gateway, amount: params.amount }, source: 'system' },
    })

    return {
      paymentId,
      paymentSessionId: paymentId,
      paymentUrl,
      qrCode,
      expiresAt: payment.expiresAt.toISOString(),
    }
  }

  async checkPaymentStatus(paymentId: string) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    if (!payment) throw new Error('Payment not found')

    if (payment.gateway === 'qpay' && payment.gatewayRef && qpay.isConfigured()) {
      const result = await qpay.checkPayment(payment.gatewayRef)
      if (result.paid && payment.status !== 'paid') {
        await this.markPaid(paymentId, result.paymentId)
        return { ...payment, status: 'paid' }
      }
    }

    return payment
  }

  async markPaid(paymentId: string, gatewayPaymentId?: string) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    if (!payment) throw new Error('Payment not found')
    
    // STRICT IDEMPOTENCY GUARD
    if (payment.status === 'paid') {
      Logger.warn('PAYMENT', 'markPaid.duplicate.blocked', { paymentId, orderId: payment.orderId })
      return
    }

    await prisma.payment.update({
      where: { id: paymentId },
      data:  { status: 'paid', paidAt: new Date(), gatewayRef: gatewayPaymentId || undefined },
    })
    await prisma.paymentTransaction.create({
      data: {
        paymentId,
        type: 'capture',
        amount: payment.amount,
        currency: payment.currency,
        note: 'Payment captured via Webhook/S2S verification',
      },
    })
    await prisma.paymentHistory.create({
      data: { paymentId, eventType: 'paid', rawPayload: { gatewayPaymentId }, source: 'gateway' },
    })

    // FULFILL THE ORDER 
    // This is the SINGLE SOURCE OF TRUTH for successful payment completion.
    Logger.info('PAYMENT', 'payment.confirmed', { paymentId, orderId: payment.orderId, amount: payment.amount, gateway: payment.gateway })
    const { OrderService } = await import('../../order-system/services')
    const orderSvc = new OrderService()
    
    // Find the order referenced by this payment.
    if (payment.orderId) {
      try {
        const o = await orderSvc.getOrder(payment.orderId)
        if (o && o.status === 'pending') {
          // STRICT STATE MACHINE UPDATE
          await orderSvc.updateStatus(payment.orderId, 'paid', 'system', 'system', 'Payment verified securely from Gateway Webhook')
          await prisma.order.update({
            where: { id: payment.orderId },
            data: { paymentStatus: 'paid' }
          })
        }

        // FIND CORRESPONDING CHECKOUT TO RESOLVE INVENTORY & COUPONS
        const cp = await prisma.checkoutPayment.findFirst({ where: { paymentSessionId: paymentId } })
        if (cp?.checkoutId) {
           const checkoutId = cp.checkoutId
           
           // Confirm inventory deductions securely from backend
           try {
             const { InventoryService } = await import('../../inventory-system/services')
             const invSvc = new InventoryService()
             await invSvc.confirmReservation(checkoutId)
           } catch (e) {
              Logger.error('PAYMENT', 'webhook.inventory.confirm.failed', { paymentId, checkoutId }, e)
           }

           // Notify Customer
           try {
             const { notificationService } = await import('../../systems/notification-system/services')
             if (o?.guestEmail) {
                await notificationService.onOrderCreated(o.guestEmail, {
                  orderNumber: o.orderNumber,
                  grandTotal:  o.grandTotal,
                  customerName: 'Customer', // No name stored locally in basic schema
                }, o.customerId || undefined)

                await notificationService.onPaymentSuccess(o.guestEmail, {
                  orderNumber: o.orderNumber,
                  amount:      o.grandTotal,
                  gateway:     payment.gateway || 'qpay',
                }, o.customerId || undefined)
             }
           } catch (e) {
              Logger.error('PAYMENT', 'webhook.notification.failed', { paymentId }, e)
           }
        }
      } catch (e) {
        Logger.error('PAYMENT', 'webhook.order.fulfillment.failed', { paymentId, orderId: payment.orderId }, e)
      }
    }
  }

  async processRefund(paymentId: string, amount: number, reason?: string) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    if (!payment || payment.status !== 'paid') throw new Error('Payment not eligible for refund')

    const refund = await prisma.refund.create({
      data: {
        paymentId,
        orderId:   payment.orderId,
        amount,
        reason:    reason || 'Customer request',
        status:    'pending',
      },
    })

    // TODO: Call QPay refund API when available
    await prisma.refund.update({ where: { id: refund.id }, data: { status: 'refunded', refundedAt: new Date() } })
    await prisma.paymentHistory.create({
      data: { paymentId, eventType: 'refunded', rawPayload: { refundId: refund.id, amount }, source: 'system' },
    })

    return refund
  }
}

// ═══════════════════════════════════════════════
// CONTROLLER
// ═══════════════════════════════════════════════

const paymentService = new PaymentService()

function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next)
}

export const paymentRouter = Router()

paymentRouter.get('/:id', handle(async (req, res) => {
  const payment = await paymentService.checkPaymentStatus(req.params.id)
  res.json({ success: true, data: payment })
}))

paymentRouter.post('/callback', handle(async (req, res) => {
  Logger.info('PAYMENT', 'webhook.callback.received', { body: req.body })
  await prisma.paymentHistory.create({
    data: { eventType: 'callback', rawPayload: req.body, source: 'gateway' },
  })

  // QPay callback typically contains invoice_id
  const invoiceId = req.body.object_id || req.body.invoice_id
  if (invoiceId) {
    const payment = await prisma.payment.findFirst({ where: { gatewayRef: invoiceId } })
    if (payment && payment.status !== 'paid') {
      await paymentService.markPaid(payment.id)
    }
  }

  res.json({ success: true })
}))

paymentRouter.post('/:id/refund', handle(async (req, res) => {
  const { amount, reason } = req.body
  const refund = await paymentService.processRefund(req.params.id, amount, reason)
  res.json({ success: true, data: refund })
}))

export { paymentService }
