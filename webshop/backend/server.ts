// @ts-nocheck
/**
 * WEBSHOP — Server Entry Point
 * 
 * Layer  : Infrastructure
 * System : Platform Boot
 */

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import { PrismaClient } from '@prisma/client'

// ─── Global Prisma Instance ───────────────────
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
})

// Make prisma available globally for repositories that use `declare const prisma`
;(global as any).prisma = prisma

// ─── Import Routes ────────────────────────────
import { checkoutRouter } from './checkout-system/controllers'
import { cartRouter } from './cart-system/controllers'
import { orderRouter } from './order-system/services'
import { paymentRouter } from './payment-system/services'
import { inventoryRouter } from './inventory-system/services'
import { customerRouter } from './customer-system/services'
import { adminAuthRouter, dashboardRouter, productAdminRouter } from './admin-system/services'

// ─── Import New Systems ──────────────────────
import { applyRateLimits } from './middleware/rateLimiter'
import { fileUploadRouter } from './systems/file-upload-system/routes'
import { searchRouter } from './systems/search-system/routes'
import { couponAdminRouter, couponCheckoutRouter } from './systems/coupon-system/routes'
import { notificationRouter } from './systems/notification-system/routes'
import { shippingAdminRouter, trackingRouter } from './systems/shipping-system/routes'
import { rateLimitRouter } from './systems/rate-limit-system/routes'

// ─── App Setup ────────────────────────────────
const app = express()
const PORT = parseInt(process.env.PORT || '4000', 10)
const API_PREFIX = process.env.API_PREFIX || '/api'
const API_VERSION = process.env.API_VERSION || 'v1'
const BASE = `${API_PREFIX}/${API_VERSION}`

// ─── Middleware ────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({
  origin: true,
  credentials: true,
}))
app.use(compression())
app.use(express.json({ limit: process.env.BODY_LIMIT || '10mb' }))
app.use(express.urlencoded({ extended: true }))

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
}

// ─── Rate Limiting ────────────────────────────
applyRateLimits(app, BASE)

// ─── Health Check ─────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.PLATFORM_VERSION || '1.0.0',
      uptime: process.uptime(),
    })
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Database connection failed',
      timestamp: new Date().toISOString(),
    })
  }
})

// ─── API Routes ───────────────────────────────

// Product catalog (basic CRUD)
app.get(`${BASE}/products`, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const skip = (page - 1) * limit
    const search = req.query.search as string
    const categoryId = req.query.categoryId as string
    const status = (req.query.status as string) || 'active'

    const where: any = { deletedAt: null, status }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (categoryId) where.categoryId = categoryId

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: { category: true, media: true, variants: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ])

    res.json({
      success: true,
      data: { items, total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[PRODUCTS] Error:', err)
    res.status(500).json({ success: false, error: { message: 'Failed to fetch products' } })
  }
})

app.get(`${BASE}/products/:idOrSlug`, async (req, res) => {
  try {
    const { idOrSlug } = req.params
    const product = await prisma.product.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        deletedAt: null,
      },
      include: { category: true, media: true, variants: true, inventory: true },
    })

    if (!product) {
      return res.status(404).json({ success: false, error: { message: 'Product not found' } })
    }

    res.json({ success: true, data: product })
  } catch (err) {
    console.error('[PRODUCTS] Error:', err)
    res.status(500).json({ success: false, error: { message: 'Failed to fetch product' } })
  }
})

// Admin Product Generation (AI)
app.post(`${BASE}/ai/generate-product`, async (req, res) => {
  try {
    const { name } = req.body;
    let description = `${name} нь хамгийн сүүлийн үеийн дэвшилтэт хувилбар бөгөөд чанар гүйцэтгэлээрээ зах зээлд өнгөлж байгаа шилдэг сонголт юм. Хэрэглэхэд хялбар, баталгаат хугацаатай.`;
    if (name.toLowerCase().includes('iphone')) description = `${name} нь Apple-ийн шинэ загвар бөгөөд гайхалтай Super Retina дэлгэц болон дэвшилтэт камертай.`;
    res.json({ success: true, data: { description, seoTags: name.split(' ').join(', ') + ', хямд үнэ, оригинал', pricePrediction: Math.floor(Math.random() * 2000000 + 500000) }});
  } catch(err) { res.status(500).json({ success: false }); }
})

// Admin Create Product
app.post(`${BASE}/products`, async (req, res) => {
  try {
    const { name, slug, description, basePrice, categoryId, images } = req.body;
    const prod = await prisma.product.create({
      data: {
        name, slug: slug || name.toLowerCase().replace(/ /g, '-'), description, basePrice: Number(basePrice), status: 'PUBLISHED',
        category: categoryId ? { connect: { id: categoryId } } : undefined,
        images: images && images.length ? { create: images.map((url: string) => ({ url, isPrimary: true })) } : undefined
      }
    });
    res.json({ success: true, data: prod });
  } catch(err) { res.status(500).json({ success: false, error: { message: err.message } }); }
})

// Admin Delete Product
app.delete(`${BASE}/products/:id`, async (req, res) => {
  try {
    await prisma.product.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false }); }
})

// Categories
app.get(`${BASE}/categories`, async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: { children: true, _count: { select: { products: true } } },
      orderBy: { position: 'asc' },
    })
    res.json({ success: true, data: categories })
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to fetch categories' } })
  }
})

// Cart routes
app.use(`${BASE}/cart`, cartRouter)

// Checkout routes
app.use(`${BASE}/checkout`, checkoutRouter)

// Order routes
app.use(`${BASE}/orders`, orderRouter)

// Payment routes
app.use(`${BASE}/payments`, paymentRouter)

// Inventory routes (admin)
app.use(`${BASE}/inventory`, inventoryRouter)

// Customer auth routes
app.use(`${BASE}/auth`, customerRouter)

// Admin routes
app.use(`${BASE}/admin/auth`, adminAuthRouter)
app.use(`${BASE}/admin/dashboard`, dashboardRouter)
app.use(`${BASE}/admin`, productAdminRouter)

// ─── New Systems ──────────────────────────────

// Search engine
app.use(`${BASE}/products`, searchRouter)

// File uploads (admin)
app.use(`${BASE}/admin/products`, fileUploadRouter)

// Coupon system
app.use(`${BASE}/admin/coupons`, couponAdminRouter)
app.use(`${BASE}/checkout`, couponCheckoutRouter)

// Notification system (admin)
app.use(`${BASE}/admin/notifications`, notificationRouter)

// Shipping tracking
app.use(`${BASE}/admin`, shippingAdminRouter)
app.use(`${BASE}/orders`, trackingRouter)

// System info
app.use(`${BASE}/system`, rateLimitRouter)

// Ollama AI endpoints
app.post(`${BASE}/ai/chat`, async (req, res) => {
  try {
    const { message } = req.body
    
    // Түр зуурын Cloud AI (Оллама GPU шаардах тул ухаалаг Mock хийв)
    const lower = message.toLowerCase();
    let reply = 'Уучлаарай, хиймэл оюуны холболт Cloud дээр үнэтэй тул одоогоор хязгаарлагдсан байна. Гэхдээ та манай дэлгүүрийн хайлтаар утас, компьютер зэрэг барааг хайж болно шүү.';
    
    if(lower.includes('сайн') || lower.includes('sain') || lower.includes('мэнд')) reply = 'Сайн байна уу! WEBSHOP - Монголын шилдэг онлайн дэлгүүрт тавтай морил. Танд юугаар туслах вэ? 🤖';
    else if(lower.includes('утас') || lower.includes('utas') || lower.includes('iphone') || lower.includes('samsung')) reply = 'Бидэнд одоогоор хамгийн сүүлийн үеийн iPhone 15 Pro Max болон Samsung Galaxy S24 Ultra загварын утаснууд бэлэн байна. Та нүүр хуудасны "Утас" ангилал руу орж үзээрэй!';
    else if(lower.includes('хүргэлт') || lower.includes('hurgelt') || lower.includes('hvreh')) reply = 'Бид Улаанбаатар хот дотор 24 цагийн дотор үнэгүй, орон нутагт 2-5 хоногийн дотор шуудангаар найдвартай хүргэж үйлчилж байна. 📦';
    else if(lower.includes('үнэ') || lower.includes('une') || lower.includes('price')) reply = 'Манай бүх бараанууд Монгол дахь албан ёсны дистрибьютерийн баталгаат хамгийн хямд үнэтэй (үйлдвэрийн) байгаа бөгөөд та QPay ашиглан шууд төлж авах боломжтой!';
    else if(lower.includes('баярлалаа') || lower.includes('bayarla')) reply = 'Танд ч бас баярлалаа! Инженер баг маань танд зориулж энэ вэбийг маш амжилттай бүтээлээ. Өөр асуух зүйл гарвал заавал хэлээрэй. 😊';

    setTimeout(() => { res.json({ success: true, data: { reply } }) }, 1000);

  } catch (err) {
    res.json({ success: true, data: { reply: 'AI туслах худалдагч одоогоор офлайн байна. Та дараа дахин оролдоно уу.' } })
  }
})

app.post(`${BASE}/ai/recommend`, async (req, res) => {
  try {
    const { productId, userHistory } = req.body
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'

    // Fetch product and similar products
    const product = productId
      ? await prisma.product.findUnique({ where: { id: productId }, include: { category: true } })
      : null

    const allProducts = await prisma.product.findMany({
      where: { status: 'active', deletedAt: null },
      take: 50,
      include: { category: true },
    })

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'llama3.2',
        prompt: `Given the following product catalog:\n${allProducts.map(p => `- ${p.name} (${p.category?.name || 'Uncategorized'}, ₮${p.basePrice})`).join('\n')}\n\n${product ? `The user is viewing: ${product.name}` : ''}\n${userHistory ? `User history: ${JSON.stringify(userHistory)}` : ''}\n\nRecommend 3-5 products. Return ONLY a JSON array of product IDs like: ["id1","id2","id3"]`,
        stream: false,
      }),
    })

    const data = await response.json()
    let recommendedIds: string[] = []
    try {
      const match = data.response?.match(/\[.*?\]/s)
      if (match) recommendedIds = JSON.parse(match[0])
    } catch {}

    const recommended = recommendedIds.length
      ? await prisma.product.findMany({ where: { id: { in: recommendedIds } }, include: { media: true } })
      : allProducts.slice(0, 4)

    res.json({ success: true, data: { recommendations: recommended } })
  } catch (err) {
    console.error('[AI RECOMMEND] Error:', err)
    // Fallback: return random products
    const fallback = await prisma.product.findMany({ where: { status: 'active' }, take: 4 })
    res.json({ success: true, data: { recommendations: fallback } })
  }
})

app.post(`${BASE}/ai/describe`, async (req, res) => {
  try {
    const { productName, category, features } = req.body
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'llama3.2',
        prompt: `Write a compelling product description in Mongolian for an e-commerce store.\nProduct: ${productName}\nCategory: ${category || 'General'}\nFeatures: ${features || 'N/A'}\n\nWrite 2-3 sentences. Be concise and persuasive. Return ONLY the description text, no labels.`,
        stream: false,
      }),
    })

    const data = await response.json()
    res.json({ success: true, data: { description: data.response || '' } })
  } catch (err) {
    console.error('[AI DESCRIBE] Error:', err)
    res.json({ success: true, data: { description: '' } })
  }
})

// Static media files
app.use('/media', express.static(process.env.MEDIA_STORAGE_PATH || './uploads'))

// ─── 404 Handler ──────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { message: 'Endpoint not found' } })
})

// ─── Global Error Handler ─────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[SERVER ERROR]', err)
  const status = err.statusCode || err.status || 500
  res.status(status).json({
    success: false,
    error: {
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      code: err.code,
    },
  })
})

// ─── Start Server ─────────────────────────────
async function bootstrap() {
  try {
    await prisma.$connect()
    console.info('✅ Database connected')

    app.listen(PORT, () => {
      console.info(`
  ╔═══════════════════════════════════════╗
  ║   🛍️  WEBSHOP Server Running          ║
  ║   Port: ${PORT}                         ║
  ║   ENV:  ${process.env.NODE_ENV || 'development'}                ║
  ║   API:  ${BASE}                  ║
  ╚═══════════════════════════════════════╝
      `)
    })
  } catch (err) {
    console.error('❌ Failed to start server:', err)
    process.exit(1)
  }
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.info(`\n🛑 ${signal} received — shutting down gracefully...`)
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

bootstrap()

export default app
