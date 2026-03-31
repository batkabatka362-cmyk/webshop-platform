// @ts-nocheck
/**
 * WEBSHOP — ADMIN SYSTEM
 * Auth + Dashboard + Product CRUD + Order Management
 */

import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import crypto from 'crypto'

declare const prisma: PrismaClient

const ADMIN_SECRET      = process.env.ADMIN_JWT_SECRET || 'dev-admin-secret'
const ADMIN_REFRESH     = process.env.ADMIN_REFRESH_SECRET || 'dev-admin-refresh'
const ADMIN_EXP         = process.env.ADMIN_JWT_EXPIRES_IN || '8h'
const ADMIN_REFRESH_EXP = process.env.ADMIN_REFRESH_EXPIRES_IN || '1d'
const BCRYPT_ROUNDS     = parseInt(process.env.ADMIN_BCRYPT_ROUNDS || '12', 10)

// ═══════════════════════════════════════════════
// AUTH MIDDLEWARE
// ═══════════════════════════════════════════════

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { message: 'Admin authentication required' } })
  }
  try {
    const payload = jwt.verify(header.slice(7), ADMIN_SECRET) as any
    ;(req as any).admin = { id: payload.sub, email: payload.email, role: payload.role }
    next()
  } catch {
    res.status(401).json({ success: false, error: { message: 'Invalid or expired admin token' } })
  }
}

function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch((err) => {
    res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } })
  })
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\u0400-\u04ff]+/g, '-').replace(/(^-|-$)/g, '')
}

// ═══════════════════════════════════════════════
// ADMIN AUTH ROUTES
// ═══════════════════════════════════════════════

export const adminAuthRouter = Router()

adminAuthRouter.post('/login', handle(async (req, res) => {
  const { email, password } = req.body
  const admin = await prisma.adminUser.findUnique({ where: { email } })
  if (!admin || !admin.isActive) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 })

  const valid = await bcrypt.compare(password, admin.passwordHash)
  if (!valid) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 })

  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } })

  const accessToken  = jwt.sign({ sub: admin.id, email: admin.email, role: admin.role }, ADMIN_SECRET, { expiresIn: ADMIN_EXP } as any)
  const refreshToken = jwt.sign({ sub: admin.id, type: 'admin-refresh' }, ADMIN_REFRESH, { expiresIn: ADMIN_REFRESH_EXP } as any)

  await prisma.adminActivity.create({
    data: { adminId: admin.id, action: 'login', resource: 'auth', ipAddress: req.ip },
  })

  const { passwordHash, ...safe } = admin
  res.json({ success: true, data: { admin: safe, accessToken, refreshToken } })
}))

adminAuthRouter.get('/me', adminAuth, handle(async (req, res) => {
  const admin = await prisma.adminUser.findUnique({ where: { id: (req as any).admin.id } })
  if (!admin) return res.status(404).json({ success: false, error: { message: 'Not found' } })
  const { passwordHash, ...safe } = admin
  res.json({ success: true, data: safe })
}))

// ═══════════════════════════════════════════════
// DASHBOARD ROUTES
// ═══════════════════════════════════════════════

export const dashboardRouter = Router()
dashboardRouter.use(adminAuth)

dashboardRouter.get('/stats', handle(async (_req, res) => {
  const now       = new Date()
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalProducts, totalCustomers, totalOrders,
    todayOrders, pendingOrders, revenue, monthlyRevenue,
    lowStockCount, recentOrders
  ] = await Promise.all([
    prisma.product.count({ where: { deletedAt: null } }),
    prisma.customer.count(),
    prisma.order.count({ where: { deletedAt: null } }),
    prisma.order.count({ where: { createdAt: { gte: today }, deletedAt: null } }),
    prisma.order.count({ where: { status: 'pending', deletedAt: null } }),
    prisma.order.aggregate({ where: { paymentStatus: 'paid', deletedAt: null }, _sum: { grandTotal: true } }),
    prisma.order.aggregate({ where: { paymentStatus: 'paid', createdAt: { gte: thisMonth }, deletedAt: null }, _sum: { grandTotal: true } }),
    prisma.inventory.count({ where: { status: { in: ['low_stock', 'out_of_stock'] } } }),
    prisma.order.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 10, include: { items: true } }),
  ])

  res.json({
    success: true,
    data: {
      totalProducts, totalCustomers, totalOrders,
      todayOrders, pendingOrders, lowStockCount,
      totalRevenue:   revenue._sum.grandTotal || 0,
      monthlyRevenue: monthlyRevenue._sum.grandTotal || 0,
      recentOrders,
    },
  })
}))

dashboardRouter.post('/ai/predict-inventory', handle(async (req, res) => {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // 1. Get all active products with their current inventory
  const products = await prisma.product.findMany({
    where: { status: 'active', deletedAt: null },
    include: { inventory: true },
  })

  const generatedDRAFTS = []

  for (const p of products) {
    if (!p.inventory) continue

    // 2. Calculate 30-day Sales Velocity atomically
    const sales = await prisma.orderItem.aggregate({
      where: {
        productId: p.id,
        order: {
          paymentStatus: 'paid',
          createdAt: { gte: thirtyDaysAgo }
        }
      },
      _sum: { quantity: true }
    })

    const sold30d = sales._sum.quantity || 0
    const dailyVelocity = sold30d / 30

    // 3. Threshold check: Less than 14 days of stock remaining?
    if (dailyVelocity > 0 && p.inventory.quantity < (dailyVelocity * 14)) {
      
      // 4. Concurrency Safety: Is there already a DRAFT order pending?
      const existingDraft = await prisma.supplyOrder.findFirst({
        where: { productId: p.id, status: 'DRAFT' }
      })

      if (!existingDraft) {
        // 5. LLM Prediction (Fallbacks safely if offline)
        let suggestedQty = Math.ceil(dailyVelocity * 30) // Fallback default
        let reason = `System detected high velocity: ${sold30d} sold last month. Stock will deplete in <14 days.`
        
        try {
          const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
          const prompt = `Product: ${p.name}. Stock: ${p.inventory.quantity}. Sold in 30 days: ${sold30d}. Daily velocity: ${dailyVelocity.toFixed(2)}. Suggest restock quantity for next 30 days. Reply ONLY in JSON format: {"suggestedQuantity": N, "reason": "..."}`
          
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10000)
          
          const response = await fetch(`${ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: process.env.OLLAMA_MODEL || 'llama3.2', prompt, stream: false }),
            signal: controller.signal
          })
          clearTimeout(timeoutId)
          
          if (response.ok) {
            const data = await response.json()
            const jsonText = data.response.replace(/```json/g, '').replace(/```/g, '').trim()
            const result = JSON.parse(jsonText)
            if (result.suggestedQuantity) suggestedQty = result.suggestedQuantity
            if (result.reason) reason = result.reason
          }
        } catch (e) {
          // LLM fail -> use the static mathematical fallback computed above
        }

        // 6. Create DRAFT SupplyOrder (Atomic insert)
        const order = await prisma.supplyOrder.create({
          data: {
            productId: p.id,
            quantity: suggestedQty,
            reason: reason,
            aiSuggested: true,
            status: 'DRAFT'
          }
        })
        await logActivity(req, 'ai_predict', 'supply_order', order.id)
        generatedDRAFTS.push(order)
      }
    }
  }

  res.json({ success: true, data: { generated: generatedDRAFTS.length, orders: generatedDRAFTS } })
}))

dashboardRouter.get('/supply-orders', handle(async (req, res) => {
  const orders = await prisma.supplyOrder.findMany({
    orderBy: { createdAt: 'desc' },
    include: { product: { include: { inventory: true } } }
  })
  res.json({ success: true, data: orders })
}))

dashboardRouter.post('/supply-orders/:id/approve', handle(async (req, res) => {
  const order = await prisma.supplyOrder.findUnique({ where: { id: req.params.id } })
  if (!order || order.status !== 'DRAFT') throw Object.assign(new Error('Invalid order'), { statusCode: 400 })

  // Use InventoryService for safe stock update — validates thresholds, logs history, and updates status
  const { InventoryService } = await import('../../inventory-system/services')
  const invSvc = new InventoryService()
  await invSvc.adjustStock(
    order.productId,
    order.quantity,
    'supply_approved',
    order.id,
    `Supply order #${order.id} approved by admin ${(req as any).admin.id}`
  )

  // Commit supply order status in a separate atomic transaction
  const [approvedOrder] = await prisma.$transaction([
    prisma.supplyOrder.update({ where: { id: order.id }, data: { status: 'COMPLETED' } }),
    prisma.adminActivity.create({
      data: { adminId: (req as any).admin.id, action: 'approve', resource: 'supply_order', resourceId: order.id, ipAddress: req.ip }
    })
  ])
  
  res.json({ success: true, data: approvedOrder })
}))

// ═══════════════════════════════════════════════
// PRODUCT ADMIN ROUTES
// ═══════════════════════════════════════════════

export const productAdminRouter = Router()
productAdminRouter.use(adminAuth)

const ProductSchema = z.object({
  name:        z.string().min(1).max(500),
  description: z.string().optional(),
  sku:         z.string().min(1).max(100),
  basePrice:   z.number().min(0),
  categoryId:  z.string().uuid().optional().nullable(),
  status:      z.enum(['draft', 'active', 'archived']).default('draft'),
  attributes:  z.any().optional(),
})

const CategorySchema = z.object({
  name:        z.string().min(1).max(255),
  description: z.string().optional(),
  parentId:    z.string().uuid().optional().nullable(),
  position:    z.number().int().default(0),
  isActive:    z.boolean().default(true),
})

// Products CRUD
productAdminRouter.post('/products', handle(async (req, res) => {
  const dto  = ProductSchema.parse(req.body)
  const slug = slugify(dto.name) + '-' + crypto.randomBytes(3).toString('hex')

  const product = await prisma.product.create({
    data: { ...dto, slug },
    include: { category: true, media: true, variants: true },
  })

  await logActivity(req, 'create', 'product', product.id)
  res.status(201).json({ success: true, data: product })
}))

productAdminRouter.put('/products/:id', handle(async (req, res) => {
  const dto = ProductSchema.partial().parse(req.body)
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data:  dto,
    include: { category: true, media: true, variants: true },
  })
  await logActivity(req, 'update', 'product', product.id)
  res.json({ success: true, data: product })
}))

productAdminRouter.delete('/products/:id', handle(async (req, res) => {
  await prisma.product.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } })
  await logActivity(req, 'delete', 'product', req.params.id)
  res.status(204).send()
}))

// Variants
productAdminRouter.post('/products/:id/variants', handle(async (req, res) => {
  const { name, sku, price, attributes, stock } = req.body
  const variant = await prisma.productVariant.create({
    data: { productId: req.params.id, name, sku, price, attributes, stock: stock || 0 },
  })
  await logActivity(req, 'create_variant', 'product_variant', variant.id)
  res.status(201).json({ success: true, data: variant })
}))

// Media
productAdminRouter.post('/products/:id/media', handle(async (req, res) => {
  const { url, type, altText, position } = req.body
  const media = await prisma.productMedia.create({
    data: { productId: req.params.id, url, type: type || 'image', altText, position: position || 0 },
  })
  await logActivity(req, 'create_media', 'product_media', media.id)
  res.status(201).json({ success: true, data: media })
}))

// Categories CRUD
productAdminRouter.post('/categories', handle(async (req, res) => {
  const dto  = CategorySchema.parse(req.body)
  const slug = slugify(dto.name) + '-' + crypto.randomBytes(2).toString('hex')
  const cat  = await prisma.category.create({ data: { ...dto, slug } })
  res.status(201).json({ success: true, data: cat })
}))

productAdminRouter.put('/categories/:id', handle(async (req, res) => {
  const dto = CategorySchema.partial().parse(req.body)
  const cat = await prisma.category.update({ where: { id: req.params.id }, data: dto })
  res.json({ success: true, data: cat })
}))

productAdminRouter.delete('/categories/:id', handle(async (req, res) => {
  await prisma.category.update({ where: { id: req.params.id }, data: { isActive: false } })
  res.status(204).send()
}))

// Customers list (admin)
productAdminRouter.get('/customers', handle(async (req, res) => {
  const page  = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit, take: limit,
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, isActive: true, createdAt: true, lastLoginAt: true },
    }),
    prisma.customer.count(),
  ])
  res.json({ success: true, data: { items, total, page, limit } })
}))

// Activity log — NEVER silently fail (audit must be reliable)
async function logActivity(req: Request, action: string, resource: string, resourceId?: string) {
  const adminId = (req as any).admin?.id
  if (!adminId) return
  try {
    await prisma.adminActivity.create({
      data: { adminId, action, resource, resourceId, ipAddress: req.ip },
    })
  } catch (err) {
    // Audit log failure is CRITICAL — surface in server error log
    console.error(`[ADMIN AUDIT FAILURE] Failed to log: admin=${adminId} action=${action} resource=${resource}/${resourceId}`, err)
  }
}
