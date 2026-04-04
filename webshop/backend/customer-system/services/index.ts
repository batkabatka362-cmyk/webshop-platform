// @ts-nocheck
/**
 * WEBSHOP — CUSTOMER SYSTEM
 * Auth (Register/Login/JWT) + Profile + Middleware
 */

import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { z } from 'zod'

declare const prisma: PrismaClient

const ACCESS_SECRET  = process.env.ACCESS_JWT_SECRET  || 'dev-access-secret'
const REFRESH_SECRET = process.env.REFRESH_JWT_SECRET || 'dev-refresh-secret'
const ACCESS_EXP     = process.env.ACCESS_TOKEN_EXPIRES_IN  || '15m'
const REFRESH_EXP    = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
const BCRYPT_ROUNDS  = parseInt(process.env.BCRYPT_ROUNDS || '12', 10)
const MAX_ATTEMPTS   = 5
const LOCK_MINUTES   = parseInt(process.env.ACCOUNT_LOCK_DURATION_MIN || '15', 10)

// ═══════════════════════════════════════════════
// VALIDATORS
// ═══════════════════════════════════════════════

const RegisterSchema = z.object({
  email:     z.string().email(),
  phone:     z.string().min(8).max(20).optional(),
  password:  z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
})

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

const UpdateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName:  z.string().min(1).max(100).optional(),
  phone:     z.string().min(8).max(20).optional(),
})

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8).max(128),
})

// ═══════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════

export class CustomerAuthService {

  async register(data: z.infer<typeof RegisterSchema>, refCode?: string) {
    const existing = await prisma.customer.findUnique({ where: { email: data.email } })
    if (existing) throw Object.assign(new Error('Email already registered'), { statusCode: 409 })

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS)

    // Generate unique affiliate code: FirstName initials + last 4 of a random hex
    const baseCode = (data.firstName.slice(0, 3) + data.lastName.slice(0, 2)).toUpperCase().replace(/[^A-Z]/g, 'X')
    const affiliateCode = `${baseCode}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

    const customer = await prisma.customer.create({
      data: {
        email:        data.email,
        phone:        data.phone,
        passwordHash,
        firstName:    data.firstName,
        lastName:     data.lastName,
        affiliateCode,
        xp:           100, // Welcome bonus XP
        level:        'Bronze',
      },
    })

    // If registered via a referral link, reward the referrer
    if (refCode) {
      const referrer = await prisma.customer.findUnique({ where: { affiliateCode: refCode } })
      if (referrer) {
        await prisma.customer.update({
          where: { id: referrer.id },
          data: { xp: { increment: 200 } }, // Referrer gets 200 XP bonus
        })
      }
    }

    const tokens = this.generateTokens(customer.id, customer.email)
    return {
      customer: this.sanitize(customer),
      ...tokens,
    }
  }

  async login(email: string, password: string) {
    const customer = await prisma.customer.findUnique({ where: { email } })
    if (!customer || !customer.isActive) {
      throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 })
    }

    if (customer.lockedUntil && customer.lockedUntil > new Date()) {
      const mins = Math.ceil((customer.lockedUntil.getTime() - Date.now()) / 60000)
      throw Object.assign(new Error(`Account locked. Try again in ${mins} minutes.`), { statusCode: 423 })
    }

    const valid = await bcrypt.compare(password, customer.passwordHash)
    if (!valid) {
      const attempts = customer.loginAttempts + 1
      const lockData: any = { loginAttempts: attempts }
      if (attempts >= MAX_ATTEMPTS) {
        lockData.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
      }
      await prisma.customer.update({ where: { id: customer.id }, data: lockData })
      throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 })
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data:  { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    })

    const tokens = this.generateTokens(customer.id, customer.email)
    return { customer: this.sanitize(customer), ...tokens }
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, REFRESH_SECRET) as any
      const customer = await prisma.customer.findUnique({ where: { id: payload.sub } })
      if (!customer || !customer.isActive) throw new Error('Invalid')

      return this.generateTokens(customer.id, customer.email)
    } catch {
      throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 })
    }
  }

  async getProfile(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where:   { id: customerId },
      include: { addresses: true },
    })
    if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 })
    
    // Fetch orders separately since relation is missing in schema
    const orders = await prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' }
    })

    // Compute next level threshold
    const levelInfo = this.computeLevel(customer.xp || 0)
    
    return { 
      ...this.sanitize(customer), 
      orders,
      gamification: {
        xp:            customer.xp || 0,
        level:         customer.level || 'Bronze',
        walletBalance: customer.walletBalance || 0,
        affiliateCode: customer.affiliateCode,
        affiliateLink: `https://webshop-platform-production.up.railway.app?ref=${customer.affiliateCode}`,
        nextLevel:     levelInfo.next,
        xpToNextLevel: levelInfo.xpToNext,
        progress:      levelInfo.progress,
      }
    }
  }

  computeLevel(xp: number) {
    const thresholds = [
      { level: 'Bronze', min: 0,     next: 'Silver', required: 1000 },
      { level: 'Silver', min: 1000,  next: 'Gold',   required: 5000 },
      { level: 'Gold',   min: 5000,  next: 'VIP',    required: 10000 },
      { level: 'VIP',    min: 10000, next: null,      required: null },
    ]
    const current = thresholds.findLast((t) => xp >= t.min) || thresholds[0]
    const progress = current.required ? Math.min(100, Math.round(((xp - current.min) / (current.required - current.min)) * 100)) : 100
    return { next: current.next, xpToNext: current.required ? current.required - xp : 0, progress }
  }

  async spendWallet(customerId: string, amount: number) {
    if (amount <= 0) throw Object.assign(new Error('Invalid amount'), { statusCode: 400 })
    
    // V48 FIX (BUG-38): Atomic check-and-decrement to prevent negative wallet balance
    // due to concurrent requests (Race Condition)
    const result = await prisma.customer.updateMany({ 
      where: { id: customerId, walletBalance: { gte: amount } }, 
      data: { walletBalance: { decrement: amount } } 
    })
    
    if (result.count === 0) {
      throw Object.assign(new Error('Insufficient wallet balance or customer not found'), { statusCode: 400 })
    }
    
    const updated = await prisma.customer.findUnique({ where: { id: customerId } })
    return this.sanitize(updated)
  }

  async addWallet(customerId: string, amount: number, reason: string) {
    if (amount <= 0) throw Object.assign(new Error('Invalid amount'), { statusCode: 400 })

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: { walletBalance: { increment: amount } }
    })
    
    // Log the manual admin credit event
    await prisma.adminActivity.create({
      data: { action: 'wallet_topup', resource: 'customer', resourceId: customerId, ipAddress: 'SYSTEM_INTERNAL' }
    }).catch(e => console.error('Admin log failed', e))

    return this.sanitize(updated)
  }

  async updateProfile(customerId: string, data: z.infer<typeof UpdateProfileSchema>) {
    const customer = await prisma.customer.update({
      where: { id: customerId },
      data,
    })
    return this.sanitize(customer)
  }

  async changePassword(customerId: string, currentPassword: string, newPassword: string) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } })
    if (!customer) throw new Error('Customer not found')

    const valid = await bcrypt.compare(currentPassword, customer.passwordHash)
    if (!valid) throw Object.assign(new Error('Current password is incorrect'), { statusCode: 400 })

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    await prisma.customer.update({ where: { id: customerId }, data: { passwordHash } })
    return { success: true }
  }

  private generateTokens(id: string, email: string) {
    const accessToken  = jwt.sign({ sub: id, email, type: 'customer' }, ACCESS_SECRET,  { expiresIn: ACCESS_EXP  } as any)
    const refreshToken = jwt.sign({ sub: id, email, type: 'refresh'  }, REFRESH_SECRET, { expiresIn: REFRESH_EXP } as any)
    return { accessToken, refreshToken }
  }

  private sanitize(customer: any) {
    const { passwordHash, loginAttempts, lockedUntil, ...safe } = customer
    return safe
  }
}

// ═══════════════════════════════════════════════
// AUTH MIDDLEWARE
// ═══════════════════════════════════════════════

export function customerAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { message: 'Authentication required' } })
  }

  try {
    const token   = header.slice(7)
    const payload = jwt.verify(token, ACCESS_SECRET) as any
    ;(req as any).user = { id: payload.sub, email: payload.email }
    next()
  } catch {
    res.status(401).json({ success: false, error: { message: 'Invalid or expired token' } })
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      const token   = header.slice(7)
      const payload = jwt.verify(token, ACCESS_SECRET) as any
      ;(req as any).user = { id: payload.sub, email: payload.email }
    } catch { /* ignore */ }
  }
  next()
}

// ═══════════════════════════════════════════════
// CONTROLLER
// ═══════════════════════════════════════════════

const authService = new CustomerAuthService()

function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch((err) => {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, error: { message: err.message } })
  })
}

export const customerRouter = Router()

customerRouter.post('/register', handle(async (req, res) => {
  const dto    = RegisterSchema.parse(req.body)
  const refCode = req.query.ref as string | undefined
  const result = await authService.register(dto, refCode)
  res.status(201).json({ success: true, data: result })
}))

customerRouter.post('/login', handle(async (req, res) => {
  const dto    = LoginSchema.parse(req.body)
  const result = await authService.login(dto.email, dto.password)
  res.json({ success: true, data: result })
}))

customerRouter.post('/refresh', handle(async (req, res) => {
  // B92 FIX: Added Zod check for body before passing to refresh service
  const { refreshToken } = z.object({ refreshToken: z.string().min(1) }).parse(req.body)
  const tokens = await authService.refreshToken(refreshToken)
  res.json({ success: true, data: tokens })
}))

customerRouter.get('/profile', customerAuth, handle(async (req, res) => {
  const profile = await authService.getProfile((req as any).user.id)
  res.json({ success: true, data: profile })
}))

customerRouter.patch('/profile', customerAuth, handle(async (req, res) => {
  const dto     = UpdateProfileSchema.parse(req.body)
  const profile = await authService.updateProfile((req as any).user.id, dto)
  res.json({ success: true, data: profile })
}))

customerRouter.post('/change-password', customerAuth, handle(async (req, res) => {
  const dto    = ChangePasswordSchema.parse(req.body)
  const result = await authService.changePassword((req as any).user.id, dto.currentPassword, dto.newPassword)
  res.json({ success: true, data: result })
}))

// Gamification: Use wallet balance to pay
customerRouter.post('/wallet/spend', customerAuth, handle(async (req, res) => {
  const { amount } = req.body
  if (!amount || amount <= 0) throw Object.assign(new Error('Invalid amount'), { statusCode: 400 })
  const updated = await authService.spendWallet((req as any).user.id, amount)
  res.json({ success: true, data: { walletBalance: updated.walletBalance } })
}))

// Admin route: Give wallet balance to customer
import { adminAuth } from '../../admin-system/services'
customerRouter.post('/:id/wallet', adminAuth, handle(async (req, res) => {
  // B94 FIX: Missing route for admin wallet top-ups (called by admin dash v55)
  const { amount, reason } = req.body
  const result = await authService.addWallet(req.params.id, Number(amount), reason || 'Admin Credit')
  res.json({ success: true, data: { walletBalance: result.walletBalance } })
}))
