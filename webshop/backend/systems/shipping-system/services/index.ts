/**
 * WEBSHOP — Shipping Tracking System — Service
 */

import { PrismaClient } from '@prisma/client'
import { ShipOrderDTO, TrackingInfo, ShippingStatus } from '../types'

declare const prisma: PrismaClient

export class ShippingTrackingService {

  /**
   * Ship an order — creates shipping record + updates order status.
   * Called by admin when physically shipping the package.
   */
  async shipOrder(orderId: string, dto: ShipOrderDTO, adminId?: string): Promise<TrackingInfo> {
    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 })

    if (!['pending', 'confirmed', 'processing'].includes(order.status)) {
      throw Object.assign(
        new Error(`Cannot ship order in '${order.status}' status`),
        { statusCode: 422 }
      )
    }

    const now = new Date()
    const DAY = 24 * 60 * 60 * 1000

    // Check if shipping record exists
    const existingShipping = await prisma.shipping.findUnique({ where: { orderId } })

    let shipping: any
    if (existingShipping) {
      shipping = await prisma.shipping.update({
        where:  { orderId },
        data: {
          trackingNumber: dto.trackingNumber,
          courier:        dto.courier,
          trackingUrl:    dto.trackingUrl,
          status:         'shipped',
          shippedAt:      now,
        },
      })
    } else {
      shipping = await prisma.shipping.create({
        data: {
          orderId,
          methodId:        dto.shippingMethodId || 'standard',
          methodName:      dto.courier || 'Стандарт хүргэлт',
          courier:         dto.courier,
          trackingNumber:  dto.trackingNumber,
          trackingUrl:     dto.trackingUrl,
          status:          'shipped',
          shippingFee:     order.shippingTotal,
          shippingAddress: order.shippingAddress as any,
          estimatedMin:    new Date(now.getTime() + 1 * DAY),
          estimatedMax:    new Date(now.getTime() + 5 * DAY),
          shippedAt:       now,
        },
      })
    }

    // Add tracking event
    await prisma.shippingTracking.create({
      data: {
        shippingId:  shipping.id,
        status:      'shipped',
        description: dto.note || 'Захиалга илгээгдлээ',
        occurredAt:  now,
      },
    })

    // Update order status + tracking number
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status:         'shipped',
        trackingNumber: dto.trackingNumber,
        shippedAt:      now,
      },
    })

    // Order status history
    await prisma.orderStatusHistory.create({
      data: {
        orderId,
        status:         'shipped',
        previousStatus: order.status,
        actorId:        adminId,
        actorType:      'admin',
        note:           `Shipped with tracking: ${dto.trackingNumber}`,
      },
    })

    // Send shipping notification
    try {
      const { notificationService } = await import('../../notification-system/services')
      const customerEmail = order.guestEmail || undefined
      if (customerEmail) {
        await notificationService.onOrderShipped(customerEmail, {
          orderNumber:    order.orderNumber,
          trackingNumber: dto.trackingNumber,
          courier:        dto.courier,
          estimatedDays:  '2-5',
        }, order.customerId || undefined)
      }
    } catch (e) {
      console.warn('[SHIPPING] Notification warning:', (e as Error).message)
    }

    return this.getTracking(orderId)
  }

  /**
   * Update shipping status (in_transit, delivered).
   */
  async updateStatus(
    orderId:     string,
    status:      ShippingStatus,
    location?:   string,
    description?: string
  ): Promise<TrackingInfo> {
    const shipping = await prisma.shipping.findUnique({ where: { orderId } })
    if (!shipping) throw Object.assign(new Error('Shipping record not found'), { statusCode: 404 })

    const now = new Date()
    const updateData: any = { status }

    if (status === 'delivered') {
      updateData.deliveredAt = now
      // Also update order
      const order = await prisma.order.update({
        where: { id: orderId },
        data:  { status: 'delivered', deliveredAt: now },
      })
      await prisma.orderStatusHistory.create({
        data: { orderId, status: 'delivered', previousStatus: 'shipped', actorType: 'system', note: 'Package delivered' },
      })
      // Delivery notification
      try {
        const { notificationService } = await import('../../notification-system/services')
        const email = order.guestEmail || undefined
        if (email) {
          await notificationService.onOrderDelivered(email, { orderNumber: order.orderNumber }, order.customerId || undefined)
        }
      } catch (e) {
        console.warn('[SHIPPING] Delivery notification warning:', (e as Error).message)
      }
    }

    await prisma.shipping.update({ where: { orderId }, data: updateData })

    await prisma.shippingTracking.create({
      data: {
        shippingId:  shipping.id,
        status,
        location,
        description: description || `Status updated to ${status}`,
        occurredAt:  now,
      },
    })

    return this.getTracking(orderId)
  }

  /**
   * Get full tracking info for an order.
   */
  async getTracking(orderId: string): Promise<TrackingInfo> {
    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 })

    const shipping = await prisma.shipping.findUnique({
      where:   { orderId },
      include: { trackingEvents: { orderBy: { occurredAt: 'desc' } } },
    })

    return {
      orderId:        order.id,
      orderNumber:    order.orderNumber,
      trackingNumber: shipping?.trackingNumber || order.trackingNumber || undefined,
      courier:        shipping?.courier || undefined,
      trackingUrl:    shipping?.trackingUrl || undefined,
      status:         shipping?.status || order.status,
      shippedAt:      shipping?.shippedAt || order.shippedAt || undefined,
      deliveredAt:    shipping?.deliveredAt || order.deliveredAt || undefined,
      estimatedMin:   shipping?.estimatedMin || undefined,
      estimatedMax:   shipping?.estimatedMax || undefined,
      events:         (shipping?.trackingEvents || []).map((e) => ({
        status:      e.status as ShippingStatus,
        location:    e.location || undefined,
        description: e.description,
        occurredAt:  e.occurredAt,
      })),
    }
  }

  /**
   * List all shipments (admin).
   */
  async listShipments(page = 1, limit = 20, status?: string) {
    const skip  = (page - 1) * limit
    const where: any = {}
    if (status) where.status = status

    const [items, total] = await Promise.all([
      prisma.shipping.findMany({
        where,
        include: { trackingEvents: { orderBy: { occurredAt: 'desc' }, take: 1 } },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
      }),
      prisma.shipping.count({ where }),
    ])

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
  }
}

export const shippingTrackingService = new ShippingTrackingService()
