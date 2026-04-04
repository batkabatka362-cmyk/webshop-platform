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

const ADMIN_SECRET      = process.env.ADMIN_JWT_SECRET || 'webshop-admin-secret-2026'
const ADMIN_REFRESH     = process.env.ADMIN_REFRESH_SECRET || 'webshop-admin-refresh-2026'
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
  // B80 FIX: Return 'token' field at top level so frontend d.token works correctly
  // Previously returned { data: { accessToken } } but frontend expected { token }
  res.json({ success: true, token: accessToken, refreshToken, data: { admin: safe, accessToken, refreshToken } })
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
  const [revenue, orders] = await Promise.all([
    prisma.order.aggregate({ _sum: { grandTotal: true }, where: { status: { notIn: ['cancelled', 'deleted'] } } }),
    prisma.order.count({ where: { status: { notIn: ['cancelled', 'deleted'] } } })
  ]);
  res.json({ success: true, data: { revenue: revenue._sum.grandTotal || 0, orders } });
}))

dashboardRouter.get('/funnel', handle(async (_req, res) => {
  const [visitors, carts, checkouts, conversions] = await Promise.all([
    prisma.systemEvent.count({ where: { eventType: 'PAGE_VIEW' } }),
    prisma.cart.count({ where: { items: { some: {} } } }),
    prisma.checkout.count(),
    prisma.order.count({ where: { status: { notIn: ['cancelled', 'deleted'] } } })
  ]);
  res.json({ success: true, data: { visitors: visitors || 0, carts, checkouts, conversions } });
}))


dashboardRouter.post('/ai/predict-inventory', handle(async (req, res) => {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // 1. Get all active products with inventory
  const products = await prisma.product.findMany({
    where: { status: 'active', deletedAt: null },
    include: { inventory: true },
  })

  // V50 FIX: Eliminate N+1 Database Query Problem
  // Compute all sales volumes in a single RAW SQL query instead of iterating per product
  const salesSql = await prisma.$queryRaw<any[]>`
    SELECT oi."productId", SUM(oi.quantity) as total_sold
    FROM "order_item" oi
    JOIN "order" o ON o.id = oi."orderId"
    WHERE o."paymentStatus" = 'paid'
    AND o."createdAt" >= ${thirtyDaysAgo}
    GROUP BY oi."productId"
  `
  const salesMap: Record<string, number> = {}
  salesSql.forEach(s => { salesMap[s.productId] = Number(s.total_sold) || 0 })

  // Also fetch all DRAFTs in ONE query
  const existingDraftsList = await prisma.supplyOrder.findMany({
    where: { status: 'DRAFT' },
    select: { productId: true }
  })
  const existingDraftsMap = new Set(existingDraftsList.map((d: any) => d.productId))

  const generatedDRAFTS = []

  for (const p of products) {
    if (!p.inventory) continue

    // 2. Access atomic sales map O(1)
    const sold30d = salesMap[p.id] || 0
    const dailyVelocity = sold30d / 30

    // 3. Threshold check: Less than 14 days of stock remaining?
    if (dailyVelocity > 0 && p.inventory.quantity < (dailyVelocity * 14)) {
      
      // 4. Concurrency Safety Object Map O(1)
      if (!existingDraftsMap.has(p.id)) {
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
  // V49 FIX (BUG-39): Atomic state claim to prevent double-restock if two admins approve at the same time
  const claimResult = await prisma.supplyOrder.updateMany({
    where: { id: req.params.id, status: 'DRAFT' },
    data: { status: 'PROCESSING' }
  })
  if (claimResult.count === 0) {
    throw Object.assign(new Error('Order is already approved or invalid'), { statusCode: 400 })
  }

  const order = await prisma.supplyOrder.findUnique({ where: { id: req.params.id } })
  if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 })

  try {
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
  } catch (err) {
    // Revert if inventory adjustment fails
    await prisma.supplyOrder.update({ where: { id: order.id }, data: { status: 'DRAFT' } })
    throw err
  }

  // Commit supply order status
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
// B84 FIX: Add Zod validation for variant creation — previously raw body went straight to DB
const VariantSchema = z.object({
  name:       z.string().min(1).max(255),
  sku:        z.string().min(1).max(100),
  price:      z.number().min(0),
  stock:      z.number().int().min(0).default(0),
  attributes: z.any().optional(),
})

productAdminRouter.post('/products/:id/variants', handle(async (req, res) => {
  const dto = VariantSchema.parse(req.body)
  const variant = await prisma.productVariant.create({
    data: { productId: req.params.id, ...dto },
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
  const customers = await prisma.customer.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const activities = await prisma.adminActivity.findMany({ where: { resource: 'Customer', action: { in: ['WALLET_TX', 'CRM_NOTE'] } } });
  
  const ltvData = await Promise.all(customers.map(async (c) => {
     const orders = await prisma.order.findMany({ where: { OR: [{ customerId: c.id }, { guestEmail: c.email }], status: { not: 'cancelled' } }, select: { subtotal: true } });
     const ltv = orders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
     const wallet = activities.filter((a: any) => a.resourceId === c.id && a.action === 'WALLET_TX').reduce((sum, a: any) => sum + (a.details?.amount || 0), 0);
     const segment = ltv > 1000000 ? 'VIP 🐋' : (ltv > 0 ? 'Байнгын' : 'Сонжооч');
     return { ...c, ltv, wallet, segment };
  }));
  res.json({ success: true, data: ltvData });
}))

productAdminRouter.get('/customers/:id/notes', handle(async (req, res) => {
  const notes = await prisma.adminActivity.findMany({ 
    where: { resource: 'Customer', resourceId: req.params.id, action: 'CRM_NOTE' }, 
    orderBy: { createdAt: 'desc' }, 
    include: { admin: { select: { firstName: true, lastName: true } } } 
  });
  res.json({ success: true, data: notes });
}))

productAdminRouter.post('/customers/:id/notes', handle(async (req, res) => {
  const { note } = req.body;
  if (!note) return res.status(400).json({ success: false, message: 'Note required' });
  await logActivity(req, 'CRM_NOTE', 'Customer', req.params.id, { note });
  res.json({ success: true });
}))

productAdminRouter.post('/customers/:id/wallet', handle(async (req, res) => {
  const { amount, reason } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Valid amount required' });
  await logActivity(req, 'WALLET_TX', 'Customer', req.params.id, { amount: Number(amount), reason: reason || 'Manual adjustment' });
  res.json({ success: true });
}))

productAdminRouter.patch('/customers/:id', handle(async (req, res) => {
  const { firstName, lastName, email } = req.body;
  const customer = await prisma.customer.update({ where: { id: req.params.id }, data: { firstName, lastName: lastName || '', email } });
  await logActivity(req, 'update', 'Customer', customer.id);
  res.json({ success: true });
}))


// Activity log — NEVER silently fail (audit must be reliable)
async function logActivity(req: Request, action: string, resource: string, resourceId?: string, details?: any) {
  const adminId = (req as any).admin?.id
  if (!adminId) return
  try {
    await prisma.adminActivity.create({
      data: { adminId, action, resource, resourceId, ipAddress: req.ip, details: details || {} },
    })
  } catch (err) {
    console.error(`[ADMIN AUDIT FAILURE] Failed to log: admin=${adminId} action=${action} resource=${resource}/${resourceId}`, err)
  }
}

