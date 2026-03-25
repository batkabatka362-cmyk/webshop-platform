/**
 * WEBSHOP — CHECKOUT SYSTEM
 * Checkout Engines
 *
 * Layer  : Layer 4 — Application Layer
 * System : Checkout System
 * Module : checkout-engines
 *
 * Engines:
 *   checkout_validation_engine  → cart, inventory, price checks
 *   checkout_pricing_engine     → subtotal, tax, shipping, total
 *   shipping_selection_engine   → options, rates, estimates
 *   payment_selection_engine    → methods, validation, session prep
 */

import { CheckoutItemModel, ShippingMethod, SelectedShipping } from '../models'
import { summaryCache }          from '../checkout-storage'
import { checkoutConfig, shippingRulesConfig } from '../config/checkout_config'
import { CheckoutError }         from '../checkout-storage'
import { calculateCheckoutPricing, roundMoney } from '../utils'
import { ValidationResultDTO }   from '../dto'
import { PrismaClient } from '@prisma/client'

declare const prisma: PrismaClient

// ─────────────────────────────────────────────
// CHECKOUT VALIDATION ENGINE
// ─────────────────────────────────────────────

export class CheckoutValidationEngine {

  /**
   * Verifies cart integrity: items still exist, are active, prices valid.
   * → Calls: Product Catalog System
   */
  async cartIntegrityCheck(items: CheckoutItemModel[]): Promise<ValidationResultDTO> {
    const errors:       string[] = []
    const warnings:     string[] = []
    const priceChanges: ValidationResultDTO['priceChanges'] = []

    if (!items.length) {
      errors.push('Cart is empty. Please add items before checkout.')
      return { valid: false, errors, warnings, priceChanges }
    }

    for (const item of items) {
      // Validate product exists and is active
      const product = await prisma.product.findUnique({ where: { id: item.productId } })
      if (!product || product.status !== 'active' || product.deletedAt) {
        errors.push(`Product "${item.productName}" is no longer available.`)
        continue
      }
      if (item.variantId) {
        const variant = await prisma.productVariant.findUnique({ where: { id: item.variantId } })
        if (!variant) {
          errors.push(`Variant for "${item.productName}" is no longer available.`)
          continue
        }
      }

      // Price revalidation
      const currentPrice = await this.fetchCurrentPrice(item.variantId ?? item.productId)
      if (currentPrice !== item.unitPrice) {
        const diff = Math.abs(currentPrice - item.unitPrice)
        const pct  = (diff / item.unitPrice) * 100

        if (pct > 1) {
          warnings.push(
            `Price changed for "${item.productName}": ` +
            `₮${item.unitPrice} → ₮${currentPrice}`
          )
          priceChanges.push({
            productName: item.productName,
            oldPrice:    item.unitPrice,
            newPrice:    currentPrice,
          })
        }
      }
    }

    return {
      valid:   errors.length === 0,
      errors,
      warnings,
      priceChanges,
    }
  }

  /**
   * Final inventory check before payment initiation.
   * → Calls: Inventory Engine (hard check)
   */
  async inventoryFinalCheck(items: CheckoutItemModel[]): Promise<{
    available: boolean
    issues: { productName: string; requested: number; available: number }[]
  }> {
    const issues: { productName: string; requested: number; available: number }[] = []

    for (const item of items) {
      const invRecord = await prisma.inventory.findFirst({ where: { productId: item.variantId ?? item.productId } })
      const stock = invRecord
        ? { available: Math.max(0, invRecord.quantity - invRecord.reserved), allowBackorder: invRecord.allowBackorder }
        : { available: 0, allowBackorder: false } // [V27 FIX]: Assume 0 stock if no inventory record exists (Phantom Inventory Bug)

      if (!stock.allowBackorder && stock.available < item.quantity) {
        issues.push({
          productName: item.productName,
          requested:   item.quantity,
          available:   stock.available,
        })
      }
    }

    return { available: issues.length === 0, issues }
  }

  /**
   * Re-validates all prices one final time before payment.
   * This is the tamper-proof guard — server always re-checks.
   */
  async priceRevalidation(items: CheckoutItemModel[]): Promise<{
    valid:   boolean
    updates: { itemId: string; productName: string; newPrice: number }[]
  }> {
    const updates: { itemId: string; productName: string; newPrice: number }[] = []

    for (const item of items) {
      const currentPrice = await this.fetchCurrentPrice(item.variantId ?? item.productId)
      if (currentPrice !== item.unitPrice) {
        updates.push({
          itemId:      item.id ?? '',
          productName: item.productName,
          newPrice:    currentPrice,
        })
      }
    }

    return { valid: updates.length === 0, updates }
  }

  private async fetchCurrentPrice(id: string): Promise<number> {
    const cached = await summaryCache.getPrice(id)
    if (cached !== null) return cached

    // Real price lookup from database
    const variant = await prisma.productVariant.findUnique({ where: { id } }).catch(() => null)
    if (variant) {
      await summaryCache.setPrice(id, variant.price)
      return variant.price
    }
    const product = await prisma.product.findUnique({ where: { id } }).catch(() => null)
    const price = product?.basePrice ?? 0

    await summaryCache.setPrice(id, price)
    return price
  }
}

// ─────────────────────────────────────────────
// CHECKOUT PRICING ENGINE
// ─────────────────────────────────────────────

export class CheckoutPricingEngine {

  calculate(
    items:         CheckoutItemModel[],
    shippingFee:   number,
    discountTotal: number
  ) {
    return calculateCheckoutPricing(
      items,
      shippingFee,
      discountTotal,
      checkoutConfig.taxRate,
      checkoutConfig.currency
    )
  }

  subtotal(items: CheckoutItemModel[]): number {
    return roundMoney(items.reduce((sum, i) => sum + i.totalPrice, 0))
  }

  tax(taxableAmount: number): number {
    return roundMoney(Math.max(0, taxableAmount) * checkoutConfig.taxRate)
  }

  total(subtotal: number, discount: number, shipping: number, tax: number): number {
    return roundMoney(subtotal - discount + shipping + tax)
  }
}

// ─────────────────────────────────────────────
// SHIPPING SELECTION ENGINE
// ─────────────────────────────────────────────

export class ShippingSelectionEngine {

  /**
   * Loads available shipping methods from DB, falls back to config.
   */
  async loadShippingOptions(address: {
    city:    string
    country: string
  }): Promise<ShippingMethod[]> {
    try {
      const dbMethods = await prisma.shippingMethod.findMany({ where: { isActive: true } })
      if (dbMethods.length > 0) {
        return dbMethods.map((m: any) => ({
          id:            m.methodId,
          name:          m.name,
          baseFee:       m.baseFee,
          estimatedDays: typeof m.estimatedDays === 'object' ? m.estimatedDays : { min: 2, max: 5 },
          isActive:      m.isActive,
        }))
      }
    } catch {
      // DB not ready or table missing — use config fallback
    }
    return shippingRulesConfig.methods.filter((m) => m.isActive)
  }

  /**
   * Calculates shipping fee for a selected method + cart weight.
   */
  calculateShippingRate(
    methodId:    string,
    totalWeight: number,
    subtotal:    number
  ): number {
    const method = shippingRulesConfig.methods.find((m) => m.id === methodId)
    if (!method) throw new CheckoutError(`Shipping method '${methodId}' not found`, 'INVALID_SHIPPING_METHOD')

    // Free shipping threshold (guard against undefined threshold)
    const threshold = shippingRulesConfig.freeShippingThreshold ?? 100000
    if (subtotal >= threshold) return 0

    // Pickup is always free
    if (methodId === 'pickup') return 0

    // Base fee + weight surcharge
    const weightRate = shippingRulesConfig.weightRates.find(
      (r) => totalWeight <= r.maxWeightKg
    )
    const extraFee = weightRate?.extraFee ?? 0

    return roundMoney(method.baseFee + extraFee)
  }

  /**
   * Returns estimated delivery date range.
   */
  estimateDelivery(methodId: string): { min: Date; max: Date } {
    const method = shippingRulesConfig.methods.find((m) => m.id === methodId)
    if (!method) throw new CheckoutError('Invalid shipping method', 'INVALID_SHIPPING_METHOD')

    const now = Date.now()
    const DAY = 24 * 60 * 60 * 1000

    return {
      min: new Date(now + method.estimatedDays.min * DAY),
      max: new Date(now + method.estimatedDays.max * DAY),
    }
  }

  buildSelectedShipping(
    methodId:    string,
    totalWeight: number,
    subtotal:    number
  ): SelectedShipping {
    const method = shippingRulesConfig.methods.find((m) => m.id === methodId)
    if (!method) throw new CheckoutError('Shipping method not found', 'INVALID_SHIPPING_METHOD')

    const fee = this.calculateShippingRate(methodId, totalWeight, subtotal)

    return {
      methodId,
      methodName:    method.name,
      fee,
      estimatedDays: method.estimatedDays,
    }
  }
}

// ─────────────────────────────────────────────
// PAYMENT SELECTION ENGINE
// ─────────────────────────────────────────────

export interface PaymentSessionResult {
  paymentSessionId: string
  paymentUrl?:      string
  qrCode?:          string
  expiresAt:        string
}

export class PaymentSelectionEngine {

  /**
   * Returns all available payment methods.
   */
  getAvailableMethods(): { gateway: string; name: string; isActive: boolean }[] {
    return [
      { gateway: 'qpay',          name: 'QPay',           isActive: true  },
      { gateway: 'card',          name: 'Картаар төлөх',  isActive: true  },
      { gateway: 'bank_transfer', name: 'Банкаар шилжүүлэх', isActive: true },
      { gateway: 'cash',          name: 'Бэлнээр',        isActive: true  },
    ]
  }

  /**
   * Validates that the selected payment method is available.
   */
  validatePaymentMethod(gateway: string): void {
    const methods   = this.getAvailableMethods()
    const available = methods.find((m) => m.gateway === gateway && m.isActive)
    if (!available) {
      throw new CheckoutError(
        `Payment method '${gateway}' is not available`,
        'INVALID_PAYMENT_METHOD'
      )
    }
  }

  /**
   * Prepares a payment session with the selected gateway.
   * → Calls: Payment System (Phase 6)
   *
   * QPay: creates invoice, returns QR URL
   * Card: creates payment intent
   */
  async preparePaymentSession(
    gateway:    string,
    amount:     number,
    currency:   string,
    orderId:    string
  ): Promise<PaymentSessionResult> {
    this.validatePaymentMethod(gateway)

    // Use real PaymentService to create payment session (QPay, etc.)
    try {
      const { PaymentService } = await import('../../payment-system/services')
      const paymentSvc = new PaymentService()
      const result = await paymentSvc.createPayment({
        orderId:    orderId,
        gateway,
        amount,
        currency,
        checkoutId: orderId, // Legacy compat
      })

      return {
        paymentSessionId: result.paymentSessionId,
        paymentUrl:       result.paymentUrl,
        qrCode:           result.qrCode,
        expiresAt:        result.expiresAt,
      }
    } catch (err) {
      console.warn(`[PAYMENT ENGINE] PaymentService error, using fallback:`, (err as Error).message)

      // Fallback if PaymentService fails (e.g. QPay not configured)
      return {
        paymentSessionId: `ps_${orderId}`,
        paymentUrl:       gateway === 'qpay' ? `https://qpay.mn/payment/${orderId}` : undefined,
        qrCode:           undefined,
        expiresAt:        new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      }
    }
  }
}

// Singletons
export const checkoutValidationEngine = new CheckoutValidationEngine()
export const checkoutPricingEngine    = new CheckoutPricingEngine()
export const shippingSelectionEngine  = new ShippingSelectionEngine()
export const paymentSelectionEngine   = new PaymentSelectionEngine()
