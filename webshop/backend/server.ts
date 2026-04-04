// @ts-nocheck
/**
 * WEBSHOP — Server Entry Point
 * 
 * Layer  : Infrastructure
 * System : Platform Boot
 */

import express from 'express'
import cors from 'cors'
import path from 'path'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import os from 'os'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { Logger } from './middleware/logger'
import { AppError } from './utils/AppError'

// ─── Mailer Utility ───────────────────────────
const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: Number(process.env.SMTP_PORT) || 587,
  auth: { user: process.env.SMTP_USER || 'test', pass: process.env.SMTP_PASS || 'test' }
});

async function sendOrderConfirmationAsync(order: any) {
  try {
    const to = order.guestEmail; // order.customer?.email could be used if joined, but guestEmail captures both if synced properly or we rely on it directly.
    if(!to) return;
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#2c3e50;padding:20px;border:1px solid #eaeaea;border-radius:8px">
        <h2 style="color:#d4a843;border-bottom:1px solid #eaeaea;padding-bottom:10px">🛒 Захиалга баталгаажлаа</h2>
        <p>Сайн байна уу? Таны <strong>${order.orderNumber}</strong> дугаартай захиалгын төлбөр амжилттай төлөгдлөө.</p>
        <div style="background:#f9f9f9;padding:15px;border-radius:8px;margin:20px 0">
          <p style="margin:5px 0"><strong>💰 Төлсөн дүн:</strong> ₮${order.grandTotal.toLocaleString()}</p>
          <p style="margin:5px 0"><strong>📅 Огноо:</strong> ${new Date(order.placedAt).toLocaleString()}</p>
        </div>
        <p style="font-size:14px;color:#666">Бид таны барааг тун удахгүй хүргэж өгөх болно. Биднийг сонгосонд баярлалаа!</p>
      </div>`;
    await mailer.sendMail({ from: '"WEBSHOP Team" <noreply@webshop.mn>', to, subject: `Таны захиалга баталгаажлаа: ${order.orderNumber}`, html });
    console.log(`[EMAIL] Order confirmation sent to ${to}`);
  } catch (err: any) { console.error(`[EMAIL ERROR] Confirmation failed:`, err.message); }
}

// ─── Global Prisma Instance ───────────────────
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
})

// Make prisma available globally for repositories that use `declare const prisma`
;(global as any).prisma = prisma

// ─── V42: HEAVY ENTERPRISE CACHE MANAGER ──────
export class CacheManager {
  private cache = new Map<string, { value: any, expiresAt: number }>();
  
  get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }
  
  set(key: string, value: any, ttlSeconds: number = 60) {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  del(key: string) { this.cache.delete(key); }
  clear() { this.cache.clear(); }
}
export const AppCache = new CacheManager();

import { runJobWorker, runSystemMonitor, runSystemRecoveryWorker } from './infrastructure/workers';



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
import { storefrontRouter } from './systems/storefront-system/routes'
import { aiRouter } from './modules/ai/routes'

// ─── App Setup ────────────────────────────────
const app = express()
const httpServer = createServer(app)
export const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

// Real-time connection handler
io.on('connection', (socket) => {
  Logger.info('REALTIME', 'client.connected', { id: socket.id })
  
  // V45: Secure Admin Room Join Logic
  socket.on('join_admin', (token: string) => {
    try {
      const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET || 'webshop-admin-secret-2026');
      if (decoded && (decoded as any).role === 'ADMIN') {
        socket.join('admin_room');
        Logger.info('REALTIME', 'admin.joined', { id: socket.id, email: (decoded as any).email });
      }
    } catch (err) {
      Logger.warn('REALTIME', 'admin.join.failed', { id: socket.id, error: (err as any).message });
    }
  });

  socket.on('disconnect', () => {
    Logger.info('REALTIME', 'client.disconnected', { id: socket.id })
  })
})

const PORT = parseInt(process.env.PORT || '4000', 10)
const API_PREFIX = process.env.API_PREFIX || '/api'
const API_VERSION = process.env.API_VERSION || 'v1'
const BASE = `${API_PREFIX}/${API_VERSION}`

// ─── Middleware ────────────────────────────────
// V43 FIX: trust proxy for correct req.ip behind NGINX/reverse proxy (fixes admin audit IP logging)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}
app.use(helmet({ contentSecurityPolicy: false }))
// V43 FIX: Use CORS_ORIGIN env var in production instead of allowing all origins
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.CORS_ORIGIN || true)
    : true,
  credentials: true,
}))
app.use(compression())
app.use(express.json({ limit: process.env.BODY_LIMIT || '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(process.cwd(), 'public')))

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
}

// ─── Request Timing / Observability ──────────
app.use(`${BASE}`, (req, _res, next) => {
  const start = Date.now()
  _res.on('finish', () => {
    const ms = Date.now() - start
    if (ms > 2000) {
      Logger.warn('HTTP', 'request.slow', { method: req.method, path: req.path, statusCode: _res.statusCode, durationMs: ms })
    } else {
      Logger.info('HTTP', 'request.completed', { method: req.method, path: req.path, statusCode: _res.statusCode, durationMs: ms })
    }
  })
  next()
})

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

// V42: EXTERNAL API SECURITY (Third-Party Integrations)
const apiKeyAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const key = req.headers['x-api-key'] || req.query.apiKey;
  if (!key) return res.status(401).json({ success: false, message: 'API Key missing' });
  const apiKey = await prisma.apiKey.findUnique({ where: { key: String(key) } });
  if (!apiKey || !apiKey.isActive) return res.status(401).json({ success: false, message: 'Invalid API Key' });
  
  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsed: new Date() } });
  next();
};

app.get(`${BASE}/external/test`, apiKeyAuth, (req, res) => {
  res.json({ success: true, message: 'Heavy Enterprise API Connected. Welcome B2B Partner!' });
});

// ─── AUTH ─────────────────────────────────────
// Customer authentication is handled exclusively by:
// customer-system/services → customerRouter
// Routes: POST /customers/register, POST /customers/login, GET /customers/profile
// Inline auth removed — was a duplicate with no account locking, no Zod validation, no token refresh.


// ─── One-time Remote Seed Endpoint ────────────
app.post(`${BASE}/admin/seed-once`, async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ success: false, message: 'Forbidden in production' });
  if (req.headers['x-seed-secret'] !== (process.env.SEED_SECRET || 'webshop-seed-2026')) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  try {
    const bcryptLib = await import('bcrypt');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@webshop.mn';
    const adminPass  = process.env.ADMIN_PASSWORD || 'Admin1234!';
    const hash = await bcryptLib.default.hash(adminPass, 12);
    await prisma.adminUser.upsert({
      where: { email: adminEmail }, update: {},
      create: { email: adminEmail, passwordHash: hash, firstName: 'Admin', lastName: 'Webshop', role: 'super_admin', isActive: true }
    });

    const cats = [
      { slug: 'utas',     name: 'Утас',      desc: 'Гар утас, ухаалаг утас' },
      { slug: 'computer', name: 'Компьютер', desc: 'Зөөврийн компьютер, tablet, камер' },
      { slug: 'audio',    name: 'Дуут',      desc: 'Чихэвч, чанга яригч, аудио' },
      { slug: 'shoes',    name: 'Гутал',     desc: 'Спорт гутал, пүүз' },
      { slug: 'home',     name: 'Гэр ахуй',  desc: 'Зурагт, тоос сорогч, гэрийн бараа' },
    ];
    const catMap: Record<string, string> = {};
    for (const [i, c] of cats.entries()) {
      const cat = await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: { slug: c.slug, name: c.name, description: c.desc, isActive: true, position: i } });
      catMap[c.name] = cat.id;
    }

    const products = [
      { name: 'Samsung Galaxy S24 Ultra',  cat: 'Утас',      sku: 'WS-SGS24U',  price: 2500000 },
      { name: 'iPhone 15 Pro Max 256GB',   cat: 'Утас',      sku: 'WS-IP15PM',  price: 3200000 },
      { name: 'MacBook Air M3 13"',        cat: 'Компьютер', sku: 'WS-MBA-M3',  price: 4200000 },
      { name: 'Sony WH-1000XM5',           cat: 'Дуут',      sku: 'WS-SNXM5',   price: 850000  },
      { name: 'Nike Air Max 270',          cat: 'Гутал',     sku: 'WS-NAM270',  price: 320000  },
      { name: 'iPad Air 5 Wi-Fi 64GB',     cat: 'Компьютер', sku: 'WS-IPA5',    price: 1850000 },
      { name: 'JBL Charge 5',             cat: 'Дуут',      sku: 'WS-JBLC5',   price: 420000  },
      { name: 'Xiaomi 14 Pro',            cat: 'Утас',      sku: 'WS-XI14P',   price: 1400000 },
      { name: 'Adidas Ultraboost 23',     cat: 'Гутал',     sku: 'WS-ADUB23',  price: 450000  },
      { name: 'LG OLED C3 55"',           cat: 'Гэр ахуй',  sku: 'WS-LGOC3',   price: 3800000 },
      { name: 'Dyson V15 Detect',         cat: 'Гэр ахуй',  sku: 'WS-DV15',    price: 1950000 },
      { name: 'Canon EOS R50 Kit',        cat: 'Компьютер', sku: 'WS-CNSR50',  price: 1250000 },
    ];
    let seeded = 0;
    for (const p of products) {
      const existing = await prisma.product.findFirst({ where: { sku: p.sku } });
      if (existing) continue;
      const product = await prisma.product.create({ data: { slug: p.sku.toLowerCase(), name: p.name, sku: p.sku, basePrice: p.price, currency: 'MNT', categoryId: catMap[p.cat] || null, status: 'active' } });
      await prisma.inventory.create({ data: { productId: product.id, quantity: Math.floor(Math.random() * 50) + 10, reserved: 0, lowStockThreshold: 10, reorderPoint: 5, status: 'in_stock' } });
      seeded++;
    }
    res.json({ success: true, message: `Seeded ${seeded} products and ${cats.length} categories.` });
  } catch(err: any) {
    console.error('[SEED ERROR]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── LIVE FEED (first registration removed — see canonical route below at /storefront/live-feed)


// ─── CHECKOUT ─────────────────────────────────
// Checkout is handled exclusively by:
// checkout-system/controllers → checkoutRouter
// Routes: POST /checkout/initiate, POST /checkout/:id/confirm, etc.
// Inline checkout removed — it bypassed InventoryService, OrderService, CouponService,
// and the shipping contract. All business logic must go through the service layer.






// Static media files
app.use('/media', express.static(process.env.MEDIA_STORAGE_PATH || './uploads'))

// ─── Temporary DB Seeder ─────────────────
app.get(`${BASE}/seed-db-temp`, async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ success: false, message: 'Forbidden in production' });
  try {
     const products = [
      { name: 'Samsung Galaxy S24 Ultra', basePrice: 2500000, desc: 'Хамгийн сүүлийн үеийн Samsung flagship утас.' },
      { name: 'iPhone 15 Pro Max 256GB', basePrice: 3200000, desc: 'Apple-ийн хамгийн хүчирхэг утас.' },
      { name: 'MacBook Air M3 13"', basePrice: 4200000, desc: 'Хамгийн нимгэн, хөнгөн MacBook.' },
      { name: 'Sony WH-1000XM5', basePrice: 850000, desc: 'Дэлхийн хамгийн сайн дуу тусгаарлагч чихэвч.' },
      { name: 'Nike Air Max 270', basePrice: 320000, desc: 'Тав тухтай, хөнгөн спорт гутал.' },
      { name: 'iPad Air 5 Wi-Fi 64GB', basePrice: 1850000, desc: 'M1 чиптэй iPad Air. 10.9 инч Liquid Retina дэлгэц.' },
      { name: 'JBL Charge 5', basePrice: 420000, desc: 'Усанд тэсвэртэй Bluetooth чанга яригч.' },
      { name: 'Xiaomi 14 Pro', basePrice: 1400000, desc: 'Leica камертай Xiaomi flagship.' },
      { name: 'LG OLED C3 55"', basePrice: 3800000, desc: '4K OLED зурагт. α9 Gen6 процессор.' },
      { name: 'Dyson V15 Detect', basePrice: 1950000, desc: 'Лазер тоос илрүүлэгч бүхий тоос сорогч.' }
     ];
     
     let cat = await prisma.category.findFirst({ where: { name: 'Ерөнхий' } });
     if(!cat) cat = await prisma.category.create({ data: { name: 'Ерөнхий', slug: 'general-'+Date.now() } });

     const imgs = ['https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&q=80','https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80','https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&q=80','https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&q=80'];

     let count = 0;
     for(let i=0; i<products.length; i++) {
        const p = products[i];
        const existing = await prisma.product.findFirst({ where: { name: p.name } });
        if(existing) continue;

        const sku = 'WS-'+Math.random().toString(36).substring(2, 8).toUpperCase();
        const slug = p.name.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase() + '-' + sku.toLowerCase();
        
        await prisma.product.create({
           data: {
             name: p.name, slug, sku, description: p.desc, basePrice: p.basePrice,
             categoryId: cat.id, status: 'active',
             media: { create: { url: imgs[i % imgs.length] } },
             inventory: { create: { quantity: 50, reserved: 0, lowStockThreshold: 10, reorderPoint: 5, status: 'in_stock' } }
           }
        });
        count++;
     }
     res.json({ success: true, message: `Seeded ${count} items successfully` });
  } catch(e: any) {
     res.status(500).json({ success: false, error: e.message });
  }
});

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

// ─── API Routes ───────────────────────────────
app.use(`${BASE}/auth`, customerRouter)

// Admin/System Core
app.use(`${BASE}/admin/auth`, adminAuthRouter)
app.use(`${BASE}/admin/dashboard`, dashboardRouter)
app.use(`${BASE}/admin/products`, fileUploadRouter)
app.use(`${BASE}/admin`, productAdminRouter)

// Legacy compatibility for current Frontend
app.use(`${BASE}/admin/stats`,  dashboardRouter)
app.use(`${BASE}/admin/funnel`, dashboardRouter)
app.use(`${BASE}/customers`,    productAdminRouter)

// System Services
app.use(`${BASE}/system`, rateLimitRouter)
app.use(`${BASE}/storefront`, storefrontRouter)
app.use(`${BASE}/search`, searchRouter)
app.use(`${BASE}/coupons/admin`, couponAdminRouter)
app.use(`${BASE}/coupons/checkout`, couponCheckoutRouter)
app.use(`${BASE}/notifications`, notificationRouter)
app.use(`${BASE}/shipping/admin`, shippingAdminRouter)
app.use(`${BASE}/shipping/tracking`, trackingRouter)

// AI Automation & Root AI Services
app.use(`${BASE}`, aiRouter)



// ─── Real-time Test Endpoints (Dev Only) ──────
app.get('/test-ping', (req, res) => {
  console.log('TEST PING OK, BASE =', BASE);
  res.json({ success: true, base: BASE });
});

app.post(`${BASE}/test/realtime`, (req: any, res: any) => {
  const { type, count = 1 } = req.body;
  const products = ['iPhone 16 Pro', 'MacBook Pro M4', 'AirPods Max', 'Samsung S25', 'iPad Air M3', 'Pixel 9 Pro', 'Sony WH-1000XM6'];
  const names = ['Батболд', 'Оюунчимэг', 'Дорж', 'Сарантуяа', 'Ганбаатар', 'Номин', 'Тэмүүлэн'];
  
  for (let i = 0; i < count; i++) {
    const prod = products[Math.floor(Math.random() * products.length)];
    const name = names[Math.floor(Math.random() * names.length)];
    const price = Math.floor(Math.random() * 5000000) + 50000;
    const qty = Math.floor(Math.random() * 8) + 1;
    
    switch(type) {
      case 'new_order':
        io.emit('new_order', { id: `test-${Date.now()}-${i}`, orderNumber: `WS-${100000 + Math.floor(Math.random()*9999)}`, total: price, customer: `${name}@test.mn`, time: new Date().toLocaleTimeString() });
        io.emit('live_purchase', { name, product: prod, time: 'саяхан', img: '' });
        break;
      case 'stock_low':
        io.emit('stock_low', { id: `inv-${i}`, name: prod, quantity: qty, threshold: 10 });
        break;
      case 'live_purchase':
        io.emit('live_purchase', { name, product: prod, time: 'саяхан', img: '' });
        break;
      case 'ai_brain_feed':
        io.emit('ai_brain_feed', { agent: ['WatcherAgent','PricingBot','SourceBot','MarketingBot'][Math.floor(Math.random()*4)], action: ['scan_inventory','apply_discount','generate_product','send_campaign'][Math.floor(Math.random()*4)], details: { product: prod, result: 'success', confidence: (Math.random()*100).toFixed(1)+'%' }, createdAt: new Date() });
        break;
      case 'price_drop':
        const oldP = price; const newP = Math.floor(price * (0.7 + Math.random() * 0.2));
        io.emit('price_drop', { id: `p-${i}`, name: prod, oldPrice: oldP, newPrice: newP, pct: Math.round((1 - newP/oldP)*100) });
        break;
    }
  }
  res.json({ success: true, message: `Emitted ${count} "${type}" event(s)` });
});

app.post(`${BASE}/test/realtime/stress`, (req: any, res: any) => {
  const { count = 10 } = req.body;
  const types = ['new_order', 'stock_low', 'live_purchase', 'ai_brain_feed', 'price_drop'];
  const products = ['iPhone 16 Pro', 'MacBook Pro M4', 'AirPods Max', 'Samsung S25', 'iPad Air M3'];
  const names = ['Батболд', 'Оюунчимэг', 'Дорж', 'Сарантуяа', 'Ганбаатар'];
  let emitted = 0;
  
  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const prod = products[Math.floor(Math.random() * products.length)];
    const name = names[Math.floor(Math.random() * names.length)];
    const price = Math.floor(Math.random() * 5000000) + 50000;
    
    switch(type) {
      case 'new_order':
        io.emit('new_order', { id: `stress-${i}`, orderNumber: `WS-STRESS-${i}`, total: price, customer: `${name}@stress.mn`, time: new Date().toLocaleTimeString() });
        io.emit('live_purchase', { name, product: prod, time: 'саяхан' });
        emitted += 2;
        break;
      case 'stock_low':
        io.emit('stock_low', { id: `stress-inv-${i}`, name: prod, quantity: Math.floor(Math.random()*5)+1, threshold: 10 });
        emitted++;
        break;
      case 'live_purchase':
        io.emit('live_purchase', { name, product: prod, time: 'саяхан' });
        emitted++;
        break;
      case 'ai_brain_feed':
        io.emit('ai_brain_feed', { agent: 'StressBot', action: `stress_action_${i}`, details: { iteration: i, product: prod }, createdAt: new Date() });
        emitted++;
        break;
      case 'price_drop':
        io.emit('price_drop', { id: `stress-p-${i}`, name: prod, oldPrice: price, newPrice: Math.floor(price*0.75), pct: 25 });
        emitted++;
        break;
    }
  }
  res.json({ success: true, message: `STRESS TEST: Emitted ${emitted} events across ${count} iterations` });
});

// ─── 404 Handler (API only) ───────────────────
app.all(`${BASE}/*`, (req, res) => {
  console.log('[404 DEBUG] Unmatched API Route:', req.method, req.originalUrl);
  res.status(404).json({ success: false, error: { message: 'Endpoint not found' } })
})

// Catch-all: serve index.html for non-API requests (Frontend SPA)
app.get('*', (_req, res) => {
  const indexPath = path.join(process.cwd(), 'public', 'index.html');
  res.sendFile(indexPath);
})

// ─── Global Error Handler ─────────────────────
app.use((err: any, req: any, res: any, _next: any) => {
  let error = { ...err };
  error.message = err.message;
  
  // Convert standard Error to AppError if it isn't one already
  if (!(err instanceof AppError)) {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    error = new AppError(message, statusCode, err.code || 'unknown_error', false);
  }

  // Log non-operational errors (like syntax errors, unexpected DB drops) heavily
  if (!error.isOperational) {
    console.error('🔥 [CRITICAL ERROR] 🔥', err);
    // Record critical errors to AI Memory for dashboard observation
    prisma.aiMemory.create({
      data: { context: `[CRITICAL]: ${req.method} ${req.url} - ${error.message}`, type: 'error' }
    }).catch(console.error);
  } else {
    // Standard operational error logging (e.g., validation failed)
    console.warn(`[WARN] ${req.method} ${req.url}:`, error.message);
  }

  // Obscure internal server errors on production
  if (process.env.NODE_ENV === 'production' && !error.isOperational) {
    error.message = 'Дотоод алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу.';
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      message: error.message,
      code: error.code || 'internal_error',
    },
  });
});

// ─── Start Server ─────────────────────────────
async function bootstrap() {
  let dbConnected = false;
  try {
    await prisma.$connect()
    console.info('✅ Database connected')
    dbConnected = true;
    
    // V42: Start heavy enterprise workers
    try {
      const { runJobWorker, runSystemMonitor, runSystemRecoveryWorker } = require('./infrastructure/workers');
      runJobWorker();
      runSystemMonitor();
      runSystemRecoveryWorker();
    } catch (workerErr) {
      console.warn('⚠️ Workers failed to start:', (workerErr as any).message);
    }
  } catch (dbErr) {
    console.warn('⚠️ Database unavailable — starting in LIMITED mode (Socket.io + Static files only)')
    console.warn('   DB Error:', (dbErr as any).message?.substring(0, 120))
  }

  const PORT = parseInt(process.env.PORT || '4000', 10);
  httpServer.listen(PORT, () => {
    console.info(`
  ╔═══════════════════════════════════════╗
  ║   🛍️  WEBSHOP Server Running (RT)     ║
  ║   Port: ${PORT}                         ║
  ║   ENV:  ${process.env.NODE_ENV || 'development'}                ║
  ║   API:  ${BASE}                  ║
  ║   Realtime: Socket.io ACTIVE          ║
  ║   Database: ${dbConnected ? 'CONNECTED ✅' : 'OFFLINE ⚠️ '}        ║
  ╚═══════════════════════════════════════╝
    `)
  })
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
