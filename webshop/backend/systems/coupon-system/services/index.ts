/**
 * WEBSHOP — Coupon System — Service
 */

import { PrismaClient } from '@prisma/client'
import { CreateCouponDTO, ApplyCouponResult } from '../types'

declare const prisma: PrismaClient

export class CouponService {

  async create(dto: CreateCouponDTO) {
    // Check uniqueness
    const existing = await prisma.coupon.findUnique({ where: { code: dto.code.toUpperCase() } })
    if (existing) throw Object.assign(new Error('Coupon code already exists'), { statusCode: 409 })

    return prisma.coupon.create({
      data: {
        code:              dto.code.toUpperCase(),
        discountType:      dto.discountType,
        discountValue:     dto.discountValue,
        minOrderAmount:    dto.minOrderAmount ?? 0,
        maxDiscountAmount: dto.maxDiscountAmount,
        expiresAt:         dto.expiresAt ? new Date(dto.expiresAt) : null,
        usageLimit:        dto.usageLimit ?? 0,
        description:       dto.description,
        active:            true,
      },
    })
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.coupon.count(),
    ])
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findByCode(code: string) {
    return prisma.coupon.findUnique({ where: { code: code.toUpperCase() } })
  }

  async update(id: string, data: Partial<CreateCouponDTO> & { active?: boolean }) {
    const updateData: any = { ...data }
    if (data.code)      updateData.code = data.code.toUpperCase()
    if (data.expiresAt) updateData.expiresAt = new Date(data.expiresAt)
    return prisma.coupon.update({ where: { id }, data: updateData })
  }

  async delete(id: string) {
    return prisma.coupon.delete({ where: { id } })
  }

  /**
   * Validate and apply a coupon to an order subtotal.
   * Returns the discount amount or throws on invalid coupon.
   */
  async validateAndApply(code: string, subtotal: number): Promise<ApplyCouponResult> {
    const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } })

    if (!coupon) {
      return { valid: false, discountAmount: 0, couponCode: code, message: 'Coupon not found' }
    }

    if (!coupon.active) {
      return { valid: false, discountAmount: 0, couponCode: code, message: 'Coupon is inactive' }
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return { valid: false, discountAmount: 0, couponCode: code, message: 'Coupon has expired' }
    }

    if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
      return { valid: false, discountAmount: 0, couponCode: code, message: 'Coupon usage limit reached' }
    }

    if (subtotal < coupon.minOrderAmount) {
      return {
        valid: false, discountAmount: 0, couponCode: code,
        message: `Minimum order amount is ₮${coupon.minOrderAmount.toLocaleString()}`,
      }
    }

    // Calculate discount
    let discountAmount: number
    if (coupon.discountType === 'percentage') {
      discountAmount = Math.round(subtotal * (coupon.discountValue / 100))
    } else {
      discountAmount = coupon.discountValue
    }

    // Cap at max discount if set
    if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
      discountAmount = coupon.maxDiscountAmount
    }

    // Cannot exceed subtotal
    discountAmount = Math.min(discountAmount, subtotal)

    return {
      valid:          true,
      discountAmount: Math.round(discountAmount),
      couponCode:     coupon.code,
      message:        coupon.discountType === 'percentage'
        ? `${coupon.discountValue}% хөнгөлөлт хэрэглэгдлээ`
        : `₮${coupon.discountValue.toLocaleString()} хөнгөлөлт хэрэглэгдлээ`,
    }
  }

  /**
   * Increment usage count after successful order.
   */
  async incrementUsage(code: string): Promise<void> {
    await prisma.coupon.update({
      where: { code: code.toUpperCase() },
      data:  { usageCount: { increment: 1 } },
    })
  }
}

export const couponService = new CouponService()
