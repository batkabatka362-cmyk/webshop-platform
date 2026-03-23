/**
 * WEBSHOP — Database Seed
 * Creates: admin user, categories, products, inventory
 * Run: npx ts-node backend/data-platform/database/seed.ts
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function seed() {
  console.log('🌱 Seeding database...\n')

  // ─── Admin User ─────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@webshop.mn'
  const adminPass  = process.env.ADMIN_PASSWORD || 'Admin1234!'
  const hash = await bcrypt.hash(adminPass, 12)

  const admin = await prisma.adminUser.upsert({
    where:  { email: adminEmail },
    update: {},
    create: {
      email: adminEmail, passwordHash: hash,
      firstName: 'Admin', lastName: 'Webshop',
      role: 'super_admin', isActive: true,
    },
  })
  console.log(`✅ Admin: ${admin.email}`)

  // ─── Categories ─────────────────────────────
  // Use deterministic slugs so upsert works reliably on repeated runs
  const cats = [
    { slug: 'utas',     name: 'Утас',      desc: 'Гар утас, ухаалаг утас' },
    { slug: 'computer', name: 'Компьютер', desc: 'Зөөврийн компьютер, tablet, камер' },
    { slug: 'audio',    name: 'Дуут',      desc: 'Чихэвч, чанга яригч, аудио' },
    { slug: 'shoes',    name: 'Гутал',     desc: 'Спорт гутал, пүүз' },
    { slug: 'home',     name: 'Гэр ахуй',  desc: 'Зурагт, тоос сорогч, гэрийн бараа' },
  ]

  const catMap: Record<string, string> = {}
  for (const [i, c] of cats.entries()) {
    const cat = await prisma.category.upsert({
      where:  { slug: c.slug },
      update: { name: c.name, description: c.desc },
      create: { slug: c.slug, name: c.name, description: c.desc, isActive: true, position: i },
    })
    catMap[c.name] = cat.id
    console.log(`✅ Category: ${cat.name}`)
  }

  // ─── Products ───────────────────────────────
  const products = [
    { name: 'Samsung Galaxy S24 Ultra',  cat: 'Утас',      sku: 'WS-SGS24U',  price: 2500000, desc: 'Хамгийн сүүлийн үеийн Samsung flagship утас. 200MP камер, Titanium frame, S Pen дэмжлэг.' },
    { name: 'iPhone 15 Pro Max 256GB',   cat: 'Утас',      sku: 'WS-IP15PM',  price: 3200000, desc: 'Apple-ийн хамгийн хүчирхэг утас. A17 Pro чип, Titanium дизайн, USB-C.' },
    { name: 'MacBook Air M3 13"',        cat: 'Компьютер', sku: 'WS-MBA-M3',  price: 4200000, desc: 'Хамгийн нимгэн, хөнгөн MacBook. M3 чип, 18 цагийн батерей.' },
    { name: 'Sony WH-1000XM5',           cat: 'Дуут',      sku: 'WS-SNXM5',   price: 850000,  desc: 'Дэлхийн хамгийн сайн дуу тусгаарлагч чихэвч.' },
    { name: 'Nike Air Max 270',          cat: 'Гутал',     sku: 'WS-NAM270',  price: 320000,  desc: 'Тав тухтай, хөнгөн спорт гутал.' },
    { name: 'iPad Air 5 Wi-Fi 64GB',     cat: 'Компьютер', sku: 'WS-IPA5',    price: 1850000, desc: 'M1 чиптэй iPad Air. 10.9 инч Liquid Retina дэлгэц.' },
    { name: 'JBL Charge 5',             cat: 'Дуут',      sku: 'WS-JBLC5',   price: 420000,  desc: 'Усанд тэсвэртэй Bluetooth чанга яригч.' },
    { name: 'Xiaomi 14 Pro',            cat: 'Утас',      sku: 'WS-XI14P',   price: 1400000, desc: 'Leica камертай Xiaomi flagship.' },
    { name: 'Adidas Ultraboost 23',     cat: 'Гутал',     sku: 'WS-ADUB23',  price: 450000,  desc: 'BOOST технологитой гүйлтийн гутал.' },
    { name: 'LG OLED C3 55"',           cat: 'Гэр ахуй',  sku: 'WS-LGOC3',   price: 3800000, desc: '4K OLED зурагт. α9 Gen6 процессор.' },
    { name: 'Dyson V15 Detect',         cat: 'Гэр ахуй',  sku: 'WS-DV15',    price: 1950000, desc: 'Лазер тоос илрүүлэгч бүхий тоос сорогч.' },
    { name: 'Canon EOS R50 Kit',        cat: 'Компьютер', sku: 'WS-CNSR50',  price: 1250000, desc: 'Эхлэгчдэд зориулсан mirrorless камер.' },
  ]

  for (const p of products) {
    // Idempotent: skip if SKU already exists
    const existing = await prisma.product.findFirst({ where: { sku: p.sku } })
    if (existing) { console.log(`  ⏭  Product exists: ${p.name}`); continue }

    // Deterministic slug from SKU
    const productSlug = p.sku.toLowerCase()

    const product = await prisma.product.create({
      data: {
        slug:        productSlug,
        name:        p.name,
        description: p.desc,
        sku:         p.sku,
        basePrice:   p.price,
        currency:    'MNT',
        categoryId:  catMap[p.cat] || null,
        status:      'active',
      },
    })

    // Create inventory
    await prisma.inventory.create({
      data: {
        productId:         product.id,
        quantity:          Math.floor(Math.random() * 50) + 10,
        reserved:          0,
        lowStockThreshold: 10,
        reorderPoint:      5,
        status:            'in_stock',
      },
    })

    console.log(`✅ Product: ${p.name} (₮${p.price.toLocaleString()})`)
  }

  // ─── Shipping Methods ───────────────────────
  const methods = [
    { methodId: 'standard', name: 'Стандарт хүргэлт', baseFee: 5000,  estimatedDays: { min: 2, max: 5 } },
    { methodId: 'express',  name: 'Экспресс хүргэлт', baseFee: 10000, estimatedDays: { min: 1, max: 2 } },
    { methodId: 'pickup',   name: 'Өөрөө авах',       baseFee: 0,     estimatedDays: { min: 0, max: 1 } },
  ]

  for (const m of methods) {
    await prisma.shippingMethod.upsert({
      where:  { methodId: m.methodId },
      update: {},
      create: { ...m, isActive: true },
    })
  }
  console.log('✅ Shipping methods created')

  console.log('\n🎉 Seed complete!')
  console.log(`\n  Admin login:`)
  console.log(`  Email:    ${adminEmail}`)
  console.log(`  Password: ${adminPass}`)
}

seed()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
