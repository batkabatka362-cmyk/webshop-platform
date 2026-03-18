// @ts-nocheck
/**
 * WEBSHOP — CART SYSTEM
 * Repositories
 *
 * Layer  : Layer 4 — Application Layer
 * System : Cart System
 * Module : repositories
 */

import { PrismaClient }    from '@prisma/client'
import { CartModel, CartItemModel, CartDiscountModel, CartStatus } from '../models'
import { cartExpiresAt }   from '../utils'

declare const prisma: PrismaClient

// ─────────────────────────────────────────────
// CART REPOSITORY
// ─────────────────────────────────────────────

export class CartRepository {

  async findById(id: string): Promise<CartModel | null> {
    return prisma.cart.findUnique({
      where:   { id },
      include: { items: true, discounts: true },
    }) as Promise<CartModel | null>
  }

  async findByCustomerId(customerId: string): Promise<CartModel | null> {
    return prisma.cart.findFirst({
      where:   { customerId, status: 'active' },
      include: { items: true, discounts: true },
      orderBy: { createdAt: 'desc' },
    }) as Promise<CartModel | null>
  }

  async findBySessionId(sessionId: string): Promise<CartModel | null> {
    return prisma.cart.findFirst({
      where:   { sessionId, status: 'active' },
      include: { items: true, discounts: true },
    }) as Promise<CartModel | null>
  }

  async create(data: {
    customerId?: string
    sessionId?:  string
    currency?:   string
  }): Promise<CartModel> {
    const type = data.customerId ? 'user' : 'guest'
    return prisma.cart.create({
      data: {
        customerId: data.customerId,
        sessionId:  data.sessionId,
        type,
        status:     'active',
        currency:   data.currency ?? 'MNT',
        expiresAt:  cartExpiresAt(type),
      },
      include: { items: true, discounts: true },
    }) as Promise<CartModel>
  }

  async updateStatus(id: string, status: CartStatus): Promise<void> {
    await prisma.cart.update({ where: { id }, data: { status } })
  }

  async setCoupon(id: string, couponCode: string | null): Promise<void> {
    await prisma.cart.update({ where: { id }, data: { couponCode } })
  }

  async touchExpiry(id: string, type: 'guest' | 'user'): Promise<void> {
    await prisma.cart.update({
      where: { id },
      data:  { expiresAt: cartExpiresAt(type), updatedAt: new Date() },
    })
  }

  async delete(id: string): Promise<void> {
    await prisma.cart.delete({ where: { id } })
  }

  /**
   * Marks all carts that have passed their expiry as 'abandoned'.
   * Run as a scheduled job.
   */
  async markExpiredAsAbandoned(): Promise<number> {
    const result = await prisma.cart.updateMany({
      where:  { status: 'active', expiresAt: { lt: new Date() } },
      data:   { status: 'abandoned' },
    })
    return result.count
  }
}

// ─────────────────────────────────────────────
// CART ITEM REPOSITORY
// ─────────────────────────────────────────────

export class CartItemRepository {

  async findByCartId(cartId: string): Promise<CartItemModel[]> {
    return prisma.cartItem.findMany({
      where:   { cartId },
      orderBy: { createdAt: 'asc' },
    }) as Promise<CartItemModel[]>
  }

  async findByCartAndVariant(
    cartId:    string,
    productId: string,
    variantId?: string
  ): Promise<CartItemModel | null> {
    return prisma.cartItem.findFirst({
      where: {
        cartId,
        productId,
        ...(variantId ? { variantId } : { variantId: null }),
      },
    }) as Promise<CartItemModel | null>
  }

  async create(data: {
    cartId:    string
    productId: string
    variantId?: string
    quantity:  number
    unitPrice: number
    metadata?: Record<string, unknown>
  }): Promise<CartItemModel> {
    const totalPrice = data.unitPrice * data.quantity
    return prisma.cartItem.create({
      data: { ...data, totalPrice },
    }) as Promise<CartItemModel>
  }

  async updateQuantity(id: string, quantity: number, unitPrice: number): Promise<CartItemModel> {
    return prisma.cartItem.update({
      where: { id },
      data:  { quantity, totalPrice: unitPrice * quantity, updatedAt: new Date() },
    }) as Promise<CartItemModel>
  }

  async updateUnitPrice(id: string, unitPrice: number, quantity: number): Promise<void> {
    await prisma.cartItem.update({
      where: { id },
      data:  { unitPrice, totalPrice: unitPrice * quantity },
    })
  }

  async delete(id: string): Promise<void> {
    await prisma.cartItem.delete({ where: { id } })
  }

  async deleteByCartId(cartId: string): Promise<void> {
    await prisma.cartItem.deleteMany({ where: { cartId } })
  }

  async countByCartId(cartId: string): Promise<number> {
    return prisma.cartItem.count({ where: { cartId } })
  }
}

// ─────────────────────────────────────────────
// CART DISCOUNT REPOSITORY
// ─────────────────────────────────────────────

export class CartDiscountRepository {

  async findByCartId(cartId: string): Promise<CartDiscountModel[]> {
    return prisma.cartDiscount.findMany({
      where: { cartId },
    }) as Promise<CartDiscountModel[]>
  }

  async findByCouponCode(cartId: string, code: string): Promise<CartDiscountModel | null> {
    return prisma.cartDiscount.findFirst({
      where: { cartId, code },
    }) as Promise<CartDiscountModel | null>
  }

  async create(data: Omit<CartDiscountModel, 'id' | 'createdAt'>): Promise<CartDiscountModel> {
    return prisma.cartDiscount.create({ data: data as any }) as Promise<CartDiscountModel>
  }

  async deleteByCartId(cartId: string): Promise<void> {
    await prisma.cartDiscount.deleteMany({ where: { cartId } })
  }

  async deleteByCouponCode(cartId: string, code: string): Promise<void> {
    await prisma.cartDiscount.deleteMany({ where: { cartId, code } })
  }
}
