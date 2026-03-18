/**
 * WEBSHOP — CART SYSTEM
 * Cart Engines
 *
 * Engines:
 *   CartError               → Domain error class
 *   cartValidationEngine    → Product/stock/price validation
 *   cartPricingEngine       → Price lookup + coupon application
 */

import { PrismaClient } from '@prisma/client'
import { cacheManager } from '../cart-storage'
import { CartItemModel, CartDiscountModel } from '../models'

declare const prisma: PrismaClient

// ─────────────────────────────────────────────
// CART ERROR
// ─────────────────────────────────────────────

export class CartError extends Error {
  public readonly statusCode: number
  public readonly code: string

  constructor(message: string, code: string, statusCode = 400) {
    super(message)
    this.name = 'CartError'
    this.code = code
    this.statusCode = statusCode
  }
}

// ─────────────────────────────────────────────
// CART VALIDATION ENGINE
// ─────────────────────────────────────────────

export class CartValidationEngine {

  async checkProductExists(
    productId: string,
    variantId?: string
  ): Promise<{ name: string; variantName?: string; sku: string; slug: string }> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    })

    if (!product || product.status !== 'active' || product.deletedAt) {
      throw new CartError('Product not found or inactive', 'PRODUCT_NOT_FOUND', 404)
    }

    let variantName: string | undefined
    let sku = product.sku

    if (variantId) {
      const variant = product.variants.find((v) => v.id === variantId)
      if (!variant) {
        throw new CartError('Product variant not found', 'VARIANT_NOT_FOUND', 404)
      }
      variantName = variant.name
      sku = variant.sku
    }

    return { name: product.name, variantName, sku, slug: product.slug }
  }

  async checkStock(
    variantId: string | undefined,
    productId: string,
    requestedQty: number
  ): Promise<{ inStock: boolean; available: number }> {
    const inventory = await prisma.inventory.findFirst({
      where: { productId },
    })

    if (!inventory) {
      // No inventory tracking — assume in stock
      return { inStock: true, available: 999 }
    }

    const available = inventory.quantity - inventory.reserved
    const inStock = inventory.allowBackorder || available >= requestedQty

    return { inStock, available: Math.max(0, available) }
  }

  async validatePrice(
    variantId: string | undefined,
    productId: string,
    snapshotPrice: number
  ): Promise<{ currentPrice: number; changed: boolean }> {
    const currentPrice = await cartPricingEngine.lookupPrice(variantId ?? productId)
    return { currentPrice, changed: currentPrice !== snapshotPrice }
  }

  async validateCartForCheckout(
    items: CartItemModel[]
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    for (const item of items) {
      try {
        await this.checkProductExists(item.productId, item.variantId)
      } catch {
        errors.push(`Product "${item.productId}" is no longer available`)
      }

      const stock = await this.checkStock(item.variantId, item.productId, item.quantity)
      if (!stock.inStock) {
        errors.push(`Insufficient stock for "${item.productId}" (need ${item.quantity}, have ${stock.available})`)
      }
    }

    return { valid: errors.length === 0, errors }
  }
}

// ─────────────────────────────────────────────
// CART PRICING ENGINE
// ─────────────────────────────────────────────

export class CartPricingEngine {

  async lookupPrice(productOrVariantId: string): Promise<number> {
    // Check cache first
    const cached = await cacheManager.getPrice(productOrVariantId)
    if (cached !== null) return cached

    // Try variant first
    const variant = await prisma.productVariant.findUnique({
      where: { id: productOrVariantId },
    })
    if (variant) {
      await cacheManager.setPrice(productOrVariantId, variant.price)
      return variant.price
    }

    // Fall back to product base price
    const product = await prisma.product.findUnique({
      where: { id: productOrVariantId },
    })
    if (product) {
      await cacheManager.setPrice(productOrVariantId, product.basePrice)
      return product.basePrice
    }

    throw new CartError('Price not found for item', 'PRICE_NOT_FOUND', 404)
  }

  async applyCoupon(
    couponCode: string,
    subtotal: number
  ): Promise<Omit<CartDiscountModel, 'id' | 'cartId' | 'createdAt'>> {
    // Use real Coupon system from DB
    try {
      const { couponService } = await import('../../systems/coupon-system/services')
      const result = await couponService.validateAndApply(couponCode, subtotal)

      if (!result.valid) {
        throw new CartError(result.message, 'INVALID_COUPON')
      }

      // Find coupon details for discount type
      const coupon = await couponService.findByCode(couponCode)

      return {
        kind:          'coupon',
        code:          result.couponCode,
        description:   result.message,
        discountType:  (coupon?.discountType === 'fixed' ? 'fixed_amount' : 'percentage') as any,
        discountValue: coupon?.discountValue ?? result.discountAmount,
        appliedAmount: result.discountAmount,
      }
    } catch (err) {
      if (err instanceof CartError) throw err
      throw new CartError((err as Error).message || 'Invalid coupon code', 'INVALID_COUPON')
    }
  }
}

// Singletons
export const cartValidationEngine = new CartValidationEngine()
export const cartPricingEngine = new CartPricingEngine()
