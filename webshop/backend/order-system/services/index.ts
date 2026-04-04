// @ts-nocheck
/**
 * WEBSHOP — ORDER SYSTEM
 * Complete: Models + Repository + Service + Controller
 */

import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { z } from 'zod'
import { Logger } from '../../middleware/logger'
import { RealtimeService } from '../../infrastructure/realtime.service'

declare const prisma: PrismaClient

// ═══════════════════════════════════════════════
// MODELS
// ═══════════════════════════════════════════════

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'cancelled'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export interface CreateOrderDTO {
  checkoutId:   string
  customerId?:  string
  guestEmail?:  string
  guestPhone?:  string
  paymentId:    string
  currency?:    string
}

// ADMIN-ONLY STATUS TRANSITIONS — only these are allowed via admin API
const ADMIN_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  'paid':        ['processing'],
  'processing':  ['shipped'],
  'shipped':     ['delivered'],
}

// ═══════════════════════════════════════════════
// ORDER NUMBER GENERATOR
// ═══════════════════════════════════════════════

const prefix = process.env.ORDER_NUMBER_PREFIX || 'WS'
const pad    = parseInt(process.env.ORDER_NUMBER_SEQUENCE_PAD || '6', 10)

async function generateOrderNumber(): Promise<string> {
  // B81 FIX: count()-based numbering has a race condition under concurrency.
  // Use timestamp + cryptographic random suffix for guaranteed uniqueness.
  const ts  = Date.now().toString(36).toUpperCase()
  const rnd = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `${prefix}-${ts}-${rnd}`
}

function generateOrderId(): string {
  return `ord_${crypto.randomBytes(12).toString('hex')}`
}

// ═══════════════════════════════════════════════
// REPOSITORY
// ═══════════════════════════════════════════════

export class OrderRepository {
  async findById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: { items: true, statusHistory: true },
    })
  }

  async findByOrderNumber(orderNumber: string) {
    return prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true, statusHistory: true },
    })
  }

  async findByCustomerId(customerId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where: { customerId, deletedAt: null },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
      }),
      prisma.order.count({ where: { customerId, deletedAt: null } }),
    ])
    return { items, total, page, limit }
  }

  async findAll(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit
    const where: any = { deletedAt: null }
    if (status) where.status = status
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where, include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
      }),
      prisma.order.count({ where }),
    ])
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async create(data: any) {
    return prisma.order.create({ data, include: { items: true } })
  }

  async updateStatus(id: string, status: string, actorId?: string, actorType = 'system', note?: string) {
    const order = await prisma.order.findUnique({ where: { id } })
    if (!order) throw new Error('Order not found')

    // EXACT STATE MACHINE ENFORCEMENT
    const allowedTransitions: Record<string, string[]> = {
      'pending': ['paid', 'cancelled'],
      'paid': ['processing', 'cancelled'],
      'processing': ['shipped', 'cancelled'],
      'shipped': ['delivered'],
      'delivered': [],
      'completed': [],
      'cancelled': []
    }
    
    // Ignore updates that don't change status to prevent idempotency bugs
    if (order.status === status) return order;

    if (!allowedTransitions[order.status]?.includes(status)) {
      throw new Error(`Forbidden transition: Cannot move order from ${order.status} to ${status}`);
    }

    const statusField: any = {}
    if (status === 'confirmed')  statusField.confirmedAt  = new Date() // Keeping for compat
    if (status === 'processing') statusField.processedAt  = new Date()
    if (status === 'shipped')    statusField.shippedAt    = new Date()
    if (status === 'delivered')  statusField.deliveredAt  = new Date()
    if (status === 'completed')  statusField.completedAt  = new Date()
    if (status === 'cancelled')  statusField.cancelledAt  = new Date()

    await prisma.$transaction([
      prisma.order.update({ where: { id }, data: { status, ...statusField } }),
      prisma.orderStatusHistory.create({
        data: {
          orderId: id, status,
          previousStatus: order.status,
          actorId, actorType,
          note: note || `Status changed to ${status}`,
        },
      }),
    ])

    Logger.info('ORDER', 'order.status.changed', {
      orderId: id,
      from: order.status,
      to: status,
      actorId,
      actorType,
    })

    return this.findById(id)
  }

  async getDashboardStats() {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [totalOrders, todayOrders, pendingOrders, revenue, monthlyRevenue] = await Promise.all([
      prisma.order.count({ where: { deletedAt: null } }),
      prisma.order.count({ where: { createdAt: { gte: today }, deletedAt: null } }),
      prisma.order.count({ where: { status: 'pending', deletedAt: null } }),
      prisma.order.aggregate({ where: { paymentStatus: 'paid', deletedAt: null }, _sum: { grandTotal: true } }),
      prisma.order.aggregate({ where: { paymentStatus: 'paid', createdAt: { gte: thisMonth }, deletedAt: null }, _sum: { grandTotal: true } }),
    ])

    return {
      totalOrders,
      todayOrders,
      pendingOrders,
      totalRevenue: revenue._sum.grandTotal || 0,
      monthlyRevenue: monthlyRevenue._sum.grandTotal || 0,
    }
  }
}

// ═══════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════

export class OrderService {
  private repo = new OrderRepository()

  async createOrder(dto: CreateOrderDTO) {
    const checkout = await prisma.checkout.findUnique({
      where: { id: dto.checkoutId },
      include: { items: true, addresses: true },
    })
    if (!checkout) throw new Error(`Checkout ${dto.checkoutId} not found`)

    const orderId = generateOrderId()
    const orderNumber = await generateOrderNumber()

    const shippingAddr = checkout.addresses.find((a) => a.type === 'shipping')
    const billingAddr  = checkout.addresses.find((a) => a.type === 'billing') || shippingAddr

    const order = await this.repo.create({
      id: orderId,
      orderNumber,
      customerId:     dto.customerId,
      guestEmail:     dto.guestEmail,
      guestPhone:     dto.guestPhone,
      status:         'pending',
      paymentStatus:  'pending',
      paymentId:      dto.paymentId,
      currency:       checkout.currency,
      subtotal:       checkout.subtotal,
      discountTotal:  checkout.discountTotal,
      shippingTotal:  checkout.shippingTotal,
      taxTotal:       checkout.taxTotal,
      grandTotal:     checkout.grandTotal,
      shippingAddress: shippingAddr ? JSON.parse(JSON.stringify(shippingAddr)) : {},
      billingAddress:  billingAddr  ? JSON.parse(JSON.stringify(billingAddr))  : {},
      shippingMethod:  {},
      placedAt:       new Date(),
      items: {
        create: checkout.items.map((item) => ({
          productId:   item.productId,
          variantId:   item.variantId,
          productName: item.productName,
          variantName: item.variantName,
          sku:         item.sku,
          imageUrl:    item.imageUrl,
          quantity:    item.quantity,
          unitPrice:   item.unitPrice,
          totalPrice:  item.totalPrice,
        })),
      },
    })

    // Log status history
    await prisma.orderStatusHistory.create({
      data: {
        orderId, status: 'pending',
        actorType: 'system',
        note: 'Order created from checkout',
      },
    })

    console.info(`[ORDER] Created order ${orderNumber} from checkout ${dto.checkoutId}`)
    
    // V44: Real-time notification
    RealtimeService.notifyNewOrder(order)

    // ── GAMIFICATION: Award XP to the buyer ──────────────────────────────
    if (dto.customerId) {
      try {
        const xpEarned = Math.floor(checkout.grandTotal / 1000) // 1 XP per 1,000₮
        const affiliateCode = (dto as any).affiliateCode

        await prisma.customer.update({
          where: { id: dto.customerId },
          data: { xp: { increment: Math.max(xpEarned, 1) } }, // Minimum 1 XP
        })

        // Recompute level based on new XP
        const updated = await prisma.customer.findUnique({ where: { id: dto.customerId } })
        if (updated) {
          const thresholds = [
            { level: 'Bronze', min: 0 },
            { level: 'Silver', min: 1000 },
            { level: 'Gold',   min: 5000 },
            { level: 'VIP',    min: 10000 },
          ]
          const newLevel = thresholds.findLast((t) => (updated.xp || 0) >= t.min)?.level || 'Bronze'
          if (newLevel !== updated.level) {
            await prisma.customer.update({ where: { id: dto.customerId }, data: { level: newLevel } })
          }
        }

        // ── AFFILIATE: Give 5% wallet credit to the referrer ──────────────
        if (affiliateCode) {
          const referrer = await (prisma as any).customer.findUnique({ where: { affiliateCode } })
          if (referrer && referrer.id !== dto.customerId) {
            const reward = Math.round(checkout.grandTotal * 0.05)
            await (prisma as any).customer.update({
              where: { id: referrer.id },
              data: { walletBalance: { increment: reward }, xp: { increment: 50 } },
            })
            // Also mark the order with the affiliate info
            await prisma.order.update({
              where: { id: orderId },
              data: { affiliateCode, affiliateReward: reward } as any,
            })
            console.info(`[AFFILIATE] Rewarded ${reward}₮ to referrer ${referrer.id} for order ${orderNumber}`)
          }
        }
      } catch (e) {
        console.warn('[GAMIFICATION] Non-critical error:', e)
      }
    }
    // ── END GAMIFICATION ─────────────────────────────────────────────────
    
    return order
  }

  async getOrder(idOrNumber: string) {
    // V43 FIX: Must await findById — Promise is always truthy so || never fell through
    const byId = await this.repo.findById(idOrNumber)
    if (byId) return byId
    return this.repo.findByOrderNumber(idOrNumber)
  }

  async getCustomerOrders(customerId: string, page?: number, limit?: number) {
    return this.repo.findByCustomerId(customerId, page, limit)
  }

  async getAllOrders(page?: number, limit?: number, status?: string) {
    return this.repo.findAll(page, limit, status)
  }

  async updateStatus(orderId: string, status: OrderStatus, actorId?: string, actorType?: string, note?: string) {
    return this.repo.updateStatus(orderId, status, actorId, actorType, note)
  }

  async cancelOrder(orderId: string, actorId?: string, reason?: string) {
    const order = await this.repo.findById(orderId)
    if (!order) throw new Error('Order not found')

    // B82 FIX: IDOR — verify the requesting customer owns this order
    // Previously any authenticated customer could cancel any order by guessing the ID
    if (actorId && order.customerId && order.customerId !== actorId) {
      throw Object.assign(new Error('Forbidden: You do not own this order'), { statusCode: 403 })
    }

    if (['shipped', 'delivered', 'completed', 'cancelled'].includes(order.status)) {
      throw new Error(`Cannot cancel order in '${order.status}' status`)
    }
    const updated = await this.repo.updateStatus(orderId, 'cancelled', actorId, 'customer', reason || 'Cancelled by customer')

    // V45 FIX (BUG-35): Release or Restock inventory upon order cancellation
    try {
      const { InventoryService } = await import('../../inventory-system/services')
      const invSvc = new InventoryService()
      
      if (order.paymentStatus === 'paid') {
        // Fully deducted, so add it back
        for (const item of order.items) {
          await invSvc.adjustStock(item.productId, item.quantity, 'restock', orderId, `Order ${order.orderNumber} cancelled`)
        }
      } else {
        // Only reserved, so release the reservation via checkoutId
        if (order.paymentId) {
          const cp = await (prisma as any).checkoutPayment.findFirst({ where: { paymentSessionId: order.paymentId } })
          if (cp?.checkoutId) {
            await invSvc.releaseReservation(cp.checkoutId).catch((e: any) => {
              Logger.warn('ORDER', 'cancel.inventory.release.warn', { checkoutId: cp.checkoutId, error: e.message })
            })
          }
        }
      }
    } catch (e) {
      Logger.error('ORDER', 'cancel.inventory_restore.failed', { orderId }, e)
    }

    return updated
  }

  async getDashboardStats() {
    return this.repo.getDashboardStats()
  }
}

// ═══════════════════════════════════════════════
// CONTROLLER
// ═══════════════════════════════════════════════

const orderService = new OrderService()

function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next)
}

export const orderRouter = Router()

// GET /orders — List all orders (admin)
orderRouter.get('/', handle(async (req, res) => {
  const page   = parseInt(req.query.page as string) || 1
  const limit  = parseInt(req.query.limit as string) || 20
  const status = req.query.status as string
  const result = await orderService.getAllOrders(page, limit, status)
  res.json({ success: true, data: result })
}))

// GET /orders/stats — Dashboard stats
orderRouter.get('/stats', handle(async (_req, res) => {
  const stats = await orderService.getDashboardStats()
  res.json({ success: true, data: stats })
}))

// GET /orders/my — Customer orders
orderRouter.get('/my', handle(async (req, res) => {
  const customerId = (req as any).user?.id || req.headers['x-customer-id'] as string
  if (!customerId) return res.status(401).json({ success: false, error: { message: 'Authentication required' } })
  const result = await orderService.getCustomerOrders(customerId)
  res.json({ success: true, data: result })
}))

// GET /orders/:id
orderRouter.get('/:id', handle(async (req, res) => {
  const order = await orderService.getOrder(req.params.id)
  if (!order) return res.status(404).json({ success: false, error: { message: 'Order not found' } })
  res.json({ success: true, data: order })
}))

// PATCH /orders/:id/status — Admin-controlled status update (strict validation)
const AdminStatusUpdateSchema = z.object({
  status: z.enum(['processing', 'shipped', 'delivered']),
  note:   z.string().max(500).optional(),
})

// B83 FIX: This route was missing adminAuth middleware — any request with a forged
// admin-looking payload could escalate order status without a valid admin token.
import { adminAuth } from '../admin-system/services'
orderRouter.patch('/:id/status', adminAuth, handle(async (req, res) => {
  const adminId = (req as any).admin?.id
  if (!adminId) {
    return res.status(403).json({ success: false, error: { message: 'Admin authentication required to update order status' } })
  }

  // Validate input — reject unknown statuses at the API gateway layer
  const dto = AdminStatusUpdateSchema.safeParse(req.body)
  if (!dto.success) {
    return res.status(422).json({ success: false, error: { message: `Invalid status: ${dto.error.errors.map(e => e.message).join(', ')}` } })
  }

  // Enforce admin transition rules — fetch current order first
  const existing = await prisma.order.findUnique({ where: { id: req.params.id } })
  if (!existing) return res.status(404).json({ success: false, error: { message: 'Order not found' } })

  const allowed = ADMIN_ALLOWED_TRANSITIONS[existing.status] || []
  if (!allowed.includes(dto.data.status)) {
    return res.status(422).json({
      success: false,
      error: { message: `Admin cannot transition order from '${existing.status}' to '${dto.data.status}'. Forbidden by system contract.` }
    })
  }

  // Additional rule: PROCESSING→SHIPPED requires tracking number
  if (dto.data.status === 'shipped' && !existing.trackingNumber) {
    return res.status(422).json({
      success: false,
      error: { message: 'Order must have a tracking number before it can be marked SHIPPED. Use the /ship endpoint instead.' }
    })
  }

  const order = await orderService.updateStatus(req.params.id, dto.data.status, adminId, 'admin', dto.data.note)
  res.json({ success: true, data: order })
}))

// POST /orders/:id/cancel — Customer self-cancel (requires authenticated customer token)
orderRouter.post('/:id/cancel', handle(async (req, res) => {
  const customerId = (req as any).user?.id
  if (!customerId) {
    return res.status(401).json({ success: false, error: { message: 'Customer authentication required to cancel an order' } })
  }
  const order = await orderService.cancelOrder(req.params.id, customerId, req.body.reason)
  res.json({ success: true, data: order })
}))
