// @ts-nocheck
/**
 * WEBSHOP — INVENTORY SYSTEM
 * Stock Management + Reservation + Service + Controller
 */

import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { Logger } from '../../middleware/logger'

declare const prisma: PrismaClient

// ═══════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════

export class InventoryService {

  async getStock(productId: string) {
    const inv = await prisma.inventory.findFirst({ where: { productId } })
    if (!inv) return { productId, quantity: 0, reserved: 0, available: 0, status: 'out_of_stock' }
    const available = Math.max(0, inv.quantity - inv.reserved)
    return { ...inv, available }
  }

  async adjustStock(productId: string, change: number, type: string, referenceId?: string, note?: string) {
    const inv = await prisma.inventory.findFirst({ where: { productId } })
    if (!inv) throw new Error(`Inventory not found for product ${productId}`)

    const before = inv.quantity
    const after  = before + change
    if (after < 0 && !inv.allowBackorder) throw new Error('Insufficient stock')

    const status = after <= 0 ? 'out_of_stock' : after <= inv.lowStockThreshold ? 'low_stock' : 'in_stock'

    await prisma.$transaction([
      prisma.inventory.update({
        where: { id: inv.id },
        data:  { quantity: after, status },
      }),
      prisma.stockHistory.create({
        data: {
          inventoryId:    inv.id,
          type,
          quantityBefore: before,
          quantityChange: change,
          referenceId,
          referenceType:  type,
          note:           note || `${type}: ${change > 0 ? '+' : ''}${change}`,
        },
      }),
    ])

    Logger.info('INVENTORY', 'stock.adjusted', {
      productId,
      type,
      before,
      after,
      change,
      status,
      referenceId,
    })

    if (status === 'low_stock') {
      Logger.warn('INVENTORY', 'stock.low', { productId, quantity: after, threshold: inv.lowStockThreshold })
    }

    return { productId, before, after, status }
  }

  async softReserve(productId: string, quantity: number, referenceId: string) {
    const inv = await prisma.inventory.findFirst({ where: { productId } })
    if (!inv) throw new Error('Inventory not found')

    const available = inv.quantity - inv.reserved
    if (available < quantity && !inv.allowBackorder) {
      throw new Error(`Insufficient stock: need ${quantity}, available ${available}`)
    }

    const ttl = parseInt(process.env.INVENTORY_SOFT_RESERVE_TTL_SEC || '1800', 10)

    const [reservation] = await prisma.$transaction([
      prisma.stockReservation.create({
        data: {
          inventoryId:   inv.id,
          productId,
          quantity,
          type:          'soft',
          status:        'active',
          referenceId,
          referenceType: 'cart',
          expiresAt:     new Date(Date.now() + ttl * 1000),
        },
      }),
      prisma.inventory.update({
        where: { id: inv.id },
        data:  { reserved: inv.reserved + quantity },
      }),
    ])

    Logger.info('INVENTORY', 'reservation.soft', { productId, quantity, referenceId, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() })
    return reservation
  }

  async hardReserve(productId: string, quantity: number, referenceId: string) {
    const inv = await prisma.inventory.findFirst({ where: { productId } })
    if (!inv) throw new Error('Inventory not found')

    const available = inv.quantity - inv.reserved
    if (available < quantity) throw new Error('Insufficient stock for hard reservation')

    const ttl = parseInt(process.env.INVENTORY_HARD_RESERVE_TTL_SEC || '900', 10)

    const [reservation] = await prisma.$transaction([
      prisma.stockReservation.create({
        data: {
          inventoryId:   inv.id,
          productId,
          quantity,
          type:          'hard',
          status:        'active',
          referenceId,
          referenceType: 'checkout',
          expiresAt:     new Date(Date.now() + ttl * 1000),
        },
      }),
      prisma.inventory.update({
        where: { id: inv.id },
        data:  { reserved: inv.reserved + quantity },
      }),
    ])

    Logger.info('INVENTORY', 'reservation.hard', { productId, quantity, referenceId })
    return reservation
  }

  async releaseReservation(referenceId: string) {
    const reservations = await prisma.stockReservation.findMany({
      where: { referenceId, status: 'active' },
    })

    for (const r of reservations) {
      await prisma.$transaction([
        prisma.stockReservation.update({ where: { id: r.id }, data: { status: 'released' } }),
        prisma.inventory.update({
          where: { id: r.inventoryId },
          data:  { reserved: { decrement: r.quantity } },
        }),
      ])
    }

    Logger.info('INVENTORY', 'reservation.released', { referenceId, count: reservations.length })
    return { released: reservations.length }
  }

  async confirmReservation(referenceId: string) {
    const reservations = await prisma.stockReservation.findMany({
      where: { referenceId, status: 'active' },
    })

    for (const r of reservations) {
      await prisma.$transaction([
        prisma.stockReservation.update({ where: { id: r.id }, data: { status: 'confirmed' } }),
        prisma.inventory.update({
          where: { id: r.inventoryId },
          data: {
            quantity: { decrement: r.quantity },
            reserved: { decrement: r.quantity },
          },
        }),
      ])

      await this.checkLowStock(r.productId)
    }

    Logger.info('INVENTORY', 'reservation.confirmed', { referenceId, count: reservations.length })
    return { confirmed: reservations.length }
  }

  async cleanExpiredReservations() {
    const expired = await prisma.stockReservation.findMany({
      where: { status: 'active', expiresAt: { lt: new Date() } },
    })

    for (const r of expired) {
      await prisma.$transaction([
        prisma.stockReservation.update({ where: { id: r.id }, data: { status: 'expired' } }),
        prisma.inventory.update({
          where: { id: r.inventoryId },
          data:  { reserved: { decrement: r.quantity } },
        }),
      ])
    }

    return { cleaned: expired.length }
  }

  async initInventory(productId: string, quantity: number, warehouseLocation?: string) {
    const existing = await prisma.inventory.findFirst({ where: { productId } })
    if (existing) throw new Error('Inventory already exists for this product')

    const threshold = parseInt(process.env.INVENTORY_LOW_STOCK_THRESHOLD || '10', 10)
    const reorder   = parseInt(process.env.INVENTORY_REORDER_POINT || '5', 10)

    return prisma.inventory.create({
      data: {
        productId,
        quantity,
        reserved: 0,
        lowStockThreshold: threshold,
        reorderPoint:      reorder,
        warehouseLocation,
        status: quantity <= 0 ? 'out_of_stock' : quantity <= threshold ? 'low_stock' : 'in_stock',
      },
    })
  }

  private async checkLowStock(productId: string) {
    const inv = await prisma.inventory.findFirst({ where: { productId } })
    if (!inv) return

    const available = inv.quantity - inv.reserved
    let status = 'in_stock'
    if (available <= 0) status = 'out_of_stock'
    else if (available <= inv.lowStockThreshold) status = 'low_stock'

    if (status !== inv.status) {
      await prisma.inventory.update({ where: { id: inv.id }, data: { status } })
    }
  }
}

// ═══════════════════════════════════════════════
// CONTROLLER
// ═══════════════════════════════════════════════

const inventoryService = new InventoryService()

function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next)
}

export const inventoryRouter = Router()

inventoryRouter.get('/:productId', handle(async (req, res) => {
  const stock = await inventoryService.getStock(req.params.productId)
  res.json({ success: true, data: stock })
}))

inventoryRouter.post('/:productId/init', handle(async (req, res) => {
  const { quantity, warehouseLocation } = req.body
  const inv = await inventoryService.initInventory(req.params.productId, quantity, warehouseLocation)
  res.status(201).json({ success: true, data: inv })
}))

inventoryRouter.post('/:productId/adjust', handle(async (req, res) => {
  const { change, type, note } = req.body
  const result = await inventoryService.adjustStock(req.params.productId, change, type || 'manual', undefined, note)
  res.json({ success: true, data: result })
}))

inventoryRouter.post('/cleanup', handle(async (_req, res) => {
  const result = await inventoryService.cleanExpiredReservations()
  res.json({ success: true, data: result })
}))

export { inventoryService }
