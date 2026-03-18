// @ts-nocheck
/**
 * WEBSHOP — ORDER SYSTEM
 * Complete: Models + Repository + Service + Controller
 */

import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { z } from 'zod'

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

// ═══════════════════════════════════════════════
// ORDER NUMBER GENERATOR
// ═══════════════════════════════════════════════

const prefix = process.env.ORDER_NUMBER_PREFIX || 'WS'
const pad    = parseInt(process.env.ORDER_NUMBER_SEQUENCE_PAD || '6', 10)

async function generateOrderNumber(): Promise<string> {
  const count = await prisma.order.count()
  const seq   = String(count + 1).padStart(pad, '0')
  return `${prefix}-${seq}`
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

    const statusField: any = {}
    if (status === 'confirmed')  statusField.confirmedAt  = new Date()
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
      paymentStatus:  'paid',
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
    return order
  }

  async getOrder(idOrNumber: string) {
    return this.repo.findById(idOrNumber) || this.repo.findByOrderNumber(idOrNumber)
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
    if (['shipped', 'delivered', 'completed', 'cancelled'].includes(order.status)) {
      throw new Error(`Cannot cancel order in '${order.status}' status`)
    }
    return this.repo.updateStatus(orderId, 'cancelled', actorId, 'customer', reason || 'Cancelled by customer')
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

// PATCH /orders/:id/status — Update status (admin)
orderRouter.patch('/:id/status', handle(async (req, res) => {
  const { status, note } = req.body
  const adminId = (req as any).admin?.id || req.headers['x-admin-id'] as string
  const order = await orderService.updateStatus(req.params.id, status, adminId, 'admin', note)
  res.json({ success: true, data: order })
}))

// POST /orders/:id/cancel
orderRouter.post('/:id/cancel', handle(async (req, res) => {
  const customerId = (req as any).user?.id || req.headers['x-customer-id'] as string
  const order = await orderService.cancelOrder(req.params.id, customerId, req.body.reason)
  res.json({ success: true, data: order })
}))
