/**
 * WEBSHOP — CHECKOUT SYSTEM
 * Repositories
 *
 * Layer  : Layer 4 — Application Layer
 * System : Checkout System
 * Module : repositories
 *
 * Note: Repositories write to DB only when checkout is
 * finalized (completed/failed). Active sessions live in Redis.
 */

import { PrismaClient }     from '@prisma/client'
import { CheckoutModel, CheckoutStatus, AddressModel, CheckoutItemModel } from '../models'

declare const prisma: PrismaClient

// ─────────────────────────────────────────────
// CHECKOUT REPOSITORY
// ─────────────────────────────────────────────

export class CheckoutRepository {

  async findById(id: string): Promise<CheckoutModel | null> {
    return prisma.checkout.findUnique({ where: { id } }) as Promise<CheckoutModel | null>
  }

  async findByCartId(cartId: string): Promise<CheckoutModel | null> {
    return prisma.checkout.findFirst({
      where:   { cartId, status: { not: 'expired' } },
      orderBy: { createdAt: 'desc' },
    }) as Promise<CheckoutModel | null>
  }

  /**
   * Persists the checkout record to DB when finalized.
   * Called only at confirm step.
   */
  async create(data: Omit<CheckoutModel, 'createdAt' | 'updatedAt'>): Promise<CheckoutModel> {
    return prisma.checkout.create({ data: data as any }) as Promise<CheckoutModel>
  }

  async updateStatus(id: string, status: CheckoutStatus): Promise<void> {
    await prisma.checkout.update({
      where: { id },
      data:  { status, updatedAt: new Date() },
    })
  }

  async markCompleted(id: string, orderId: string): Promise<void> {
    await prisma.checkout.update({
      where: { id },
      data:  {
        status:      'completed',
        orderId,
        completedAt: new Date(),
        updatedAt:   new Date(),
      },
    })
  }

  async markExpiredAsExpired(): Promise<number> {
    const result = await prisma.checkout.updateMany({
      where: {
        status:    { in: ['created', 'in_progress'] },
        expiresAt: { lt: new Date() },
      },
      data: { status: 'expired' },
    })
    return result.count
  }
}

// ─────────────────────────────────────────────
// CHECKOUT ITEM REPOSITORY
// ─────────────────────────────────────────────

export class CheckoutItemRepository {

  async findByCheckoutId(checkoutId: string): Promise<CheckoutItemModel[]> {
    return prisma.checkoutItem.findMany({
      where: { checkoutId },
    }) as Promise<CheckoutItemModel[]>
  }

  async createMany(checkoutId: string, items: CheckoutItemModel[]): Promise<void> {
    await prisma.checkoutItem.createMany({
      data: items.map((i) => ({ ...i, checkoutId })),
    })
  }
}

// ─────────────────────────────────────────────
// CHECKOUT ADDRESS REPOSITORY
// ─────────────────────────────────────────────

export class CheckoutAddressRepository {

  async findByCheckoutId(checkoutId: string): Promise<AddressModel[]> {
    return prisma.checkoutAddress.findMany({
      where: { checkoutId },
    }) as Promise<AddressModel[]>
  }

  async upsertShipping(checkoutId: string, address: AddressModel): Promise<AddressModel> {
    return prisma.checkoutAddress.upsert({
      where:  { checkoutId_type: { checkoutId, type: 'shipping' } },
      create: { ...address, checkoutId, type: 'shipping' } as any,
      update: { ...address } as any,
    }) as Promise<AddressModel>
  }

  async upsertBilling(checkoutId: string, address: AddressModel): Promise<AddressModel> {
    return prisma.checkoutAddress.upsert({
      where:  { checkoutId_type: { checkoutId, type: 'billing' } },
      create: { ...address, checkoutId, type: 'billing' } as any,
      update: { ...address } as any,
    }) as Promise<AddressModel>
  }
}

// ─────────────────────────────────────────────
// CHECKOUT PAYMENT REPOSITORY
// ─────────────────────────────────────────────

export class CheckoutPaymentRepository {

  async findByCheckoutId(checkoutId: string) {
    return prisma.checkoutPayment.findFirst({ where: { checkoutId } })
  }

  async create(data: {
    checkoutId:      string
    gateway:         string
    paymentSessionId?: string
    amount:          number
    currency:        string
  }) {
    return prisma.checkoutPayment.create({ data: data as any })
  }

  async updateStatus(checkoutId: string, status: string): Promise<void> {
    await prisma.checkoutPayment.updateMany({
      where: { checkoutId },
      data:  { status },
    })
  }
}
