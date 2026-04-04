// @ts-nocheck
/**
 * WEBSHOP — INVENTORY SYSTEM
 * Stock Management + Reservation + Service + Controller
 */

import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { Logger } from '../../middleware/logger'
// V43 FIX (BUG-30): Import admin auth to protect mutation endpoints
import { adminAuth } from '../../admin-system/services'
import { RealtimeService } from '../../infrastructure/realtime.service'

declare const prisma: PrismaClient

// ═══════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════

export class InventoryService {

  async getStock(productId: string) {
    // V43 FIX (BUG-08): productId is @unique in schema, use findUnique for index optimization
    const inv = await prisma.inventory.findUnique({ where: { productId } })
    if (!inv) return { productId, quantity: 0, reserved: 0, available: 0, status: 'out_of_stock' }
    const available = Math.max(0, inv.quantity - inv.reserved)
    return { ...inv, available }
  }

  async adjustStock(productId: string, change: number, type: string, referenceId?: string, note?: string) {
    return await prisma.$transaction(async (tx) => {
      const rows: any[] = await tx.$queryRaw`SELECT * FROM "inventory" WHERE "productId" = ${productId} FOR UPDATE`;
      if (!rows || rows.length === 0) throw new Error(`Inventory not found for product ${productId}`);
      
      const inv = rows[0];
      const before = inv.quantity;
      const after  = before + change;
      if (after < 0 && !inv.allowBackorder) throw new Error('Insufficient stock');

      const status = after <= 0 ? 'out_of_stock' : after <= inv.lowStockThreshold ? 'low_stock' : 'in_stock';

      await tx.inventory.update({
        where: { id: inv.id },
        data:  { quantity: after, status },
      });

      await tx.stockHistory.create({
        data: {
          inventoryId:    inv.id,
          type,
          quantityBefore: before,
          quantityChange: change,
          referenceId,
          referenceType:  type,
          note:           note || `${type}: ${change > 0 ? '+' : ''}${change}`,
        },
      });

      Logger.info('INVENTORY', 'stock.adjusted', { productId, type, before, after, change, status, referenceId });
      if (status === 'low_stock') {
        Logger.warn('INVENTORY', 'stock.low', { productId, quantity: after, threshold: inv.lowStockThreshold });
      }

      return { productId, before, after, status };
    });
  }

  async softReserve(productId: string, quantity: number, referenceId: string) {
    return await prisma.$transaction(async (tx) => {
      const rows: any[] = await tx.$queryRaw`SELECT * FROM "inventory" WHERE "productId" = ${productId} FOR UPDATE`;
      if (!rows || rows.length === 0) throw new Error('Inventory not found');

      const inv = rows[0];
      const available = inv.quantity - inv.reserved;
      if (available < quantity && !inv.allowBackorder) {
        throw new Error(`Insufficient stock: need ${quantity}, available ${available}`);
      }

      const ttl = parseInt(process.env.INVENTORY_SOFT_RESERVE_TTL_SEC || '1800', 10);

      const reservation = await tx.stockReservation.create({
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
      });

      await tx.inventory.update({
        where: { id: inv.id },
        data:  { reserved: inv.reserved + quantity },
      });

      Logger.info('INVENTORY', 'reservation.soft', { productId, quantity, referenceId, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() });
      return reservation;
    });
  }

  async hardReserve(productId: string, quantity: number, referenceId: string) {
    return await prisma.$transaction(async (tx) => {
      const rows: any[] = await tx.$queryRaw`SELECT * FROM "inventory" WHERE "productId" = ${productId} FOR UPDATE`;
      if (!rows || rows.length === 0) throw new Error('Inventory not found');

      const inv = rows[0];
      const available = inv.quantity - inv.reserved;
      if (available < quantity) throw new Error('Insufficient stock for hard reservation');

      const ttl = parseInt(process.env.INVENTORY_HARD_RESERVE_TTL_SEC || '900', 10);

      const reservation = await tx.stockReservation.create({
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
      });

      await tx.inventory.update({
        where: { id: inv.id },
        data:  { reserved: inv.reserved + quantity },
      });

      Logger.info('INVENTORY', 'reservation.hard', { productId, quantity, referenceId });
      return reservation;
    });
  }

  async releaseReservation(referenceId: string) {
    const reservations = await prisma.stockReservation.findMany({
      where: { referenceId, status: 'active' },
    })

    for (const r of reservations) {
      await prisma.$transaction(async (tx) => {
        const updateRes = await tx.stockReservation.updateMany({
          where: { id: r.id, status: 'active' },
          data: { status: 'released' }
        })
        if (updateRes.count > 0) {
          await tx.inventory.update({
            where: { id: r.inventoryId },
            data:  { reserved: { decrement: r.quantity } },
          })
        }
      })
    }

    Logger.info('INVENTORY', 'reservation.released', { referenceId, count: reservations.length })
    return { released: reservations.length }
  }

  async confirmReservation(referenceId: string) {
    const reservations = await prisma.stockReservation.findMany({
      where: { referenceId, status: 'active' },
    })

    for (const r of reservations) {
      await prisma.$transaction(async (tx) => {
        const updateRes = await tx.stockReservation.updateMany({
          where: { id: r.id, status: 'active' },
          data: { status: 'confirmed' }
        })
        if (updateRes.count > 0) {
          await tx.inventory.update({
            where: { id: r.inventoryId },
            data: {
              quantity: { decrement: r.quantity },
              reserved: { decrement: r.quantity },
            },
          })
        }
      })

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
      await prisma.$transaction(async (tx) => {
        const updateRes = await tx.stockReservation.updateMany({
          where: { id: r.id, status: 'active' },
          data: { status: 'expired' }
        })
        if (updateRes.count > 0) {
          await tx.inventory.update({
            where: { id: r.inventoryId },
            data:  { reserved: { decrement: r.quantity } },
          })
        }
      })
    }

    return { cleaned: expired.length }
  }

  async initInventory(productId: string, quantity: number, warehouseLocation?: string) {
    const existing = await prisma.inventory.findUnique({ where: { productId } })
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
    const inv = await prisma.inventory.findUnique({ where: { productId } })
    if (!inv) return

    const available = inv.quantity - inv.reserved
    let status = 'in_stock'
    if (available <= 0) status = 'out_of_stock'
    else if (available <= inv.lowStockThreshold) status = 'low_stock'

    if (status !== inv.status) {
      await prisma.inventory.update({ where: { id: inv.id }, data: { status } })
      
      // V44: Real-time notification for low stock
      if (status === 'low_stock' || status === 'out_of_stock') {
        const product = await prisma.product.findUnique({ where: { id: productId } })
        if (product) RealtimeService.notifyStockLow(product, available)
      }
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

// V45 FIX (BUG-30): Protect mutation and cleanup endpoints with admin auth + Zod validation
import { z } from 'zod'

const adjustSchema = z.object({
  change: z.number(),
  type: z.string().optional().default('manual'),
  note: z.string().optional()
})

inventoryRouter.post('/:productId/init', adminAuth, handle(async (req, res) => {
  const { quantity, warehouseLocation } = req.body
  const inv = await inventoryService.initInventory(req.params.productId, Number(quantity), warehouseLocation)
  res.status(201).json({ success: true, data: inv })
}))

inventoryRouter.post('/:productId/adjust', adminAuth, handle(async (req, res) => {
  const { change, type, note } = adjustSchema.parse(req.body)
  const result = await inventoryService.adjustStock(req.params.productId, change, type, undefined, note)
  res.json({ success: true, data: result })
}))

inventoryRouter.post('/cleanup', adminAuth, handle(async (_req, res) => {
  const result = await inventoryService.cleanExpiredReservations()
  res.json({ success: true, data: result })
}))

export { inventoryService }
