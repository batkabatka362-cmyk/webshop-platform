# WEBSHOP — Монгол E-Commerce Platform

Full-stack e-commerce platform with local AI integration (Ollama), QPay payment gateway, and Mongolian language support.

## Tech Stack

**Backend:** Node.js, Express, TypeScript, Prisma, PostgreSQL, Redis
**Frontend:** HTML/CSS/JS (dark theme), Next.js (planned)
**AI:** Ollama (local LLM — Llama 3.2)
**Payment:** QPay (Mongolia)

## Quick Start

```bash
# 1. Clone and install
cd webshop
npm install

# 2. Setup environment
cp .env.example .env.development

# 3. Start PostgreSQL and Redis (Docker)
docker-compose up -d postgres redis

# 4. Setup database
npx prisma db push
npx prisma generate

# 5. Seed initial data (admin + products)
npm run db:seed

# 6. Start dev server
npm run dev
```

Server runs at: http://localhost:4000
Health check: http://localhost:4000/health

## Docker (Full Stack)

```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@webshop.mn | Admin1234! |

## Backend Systems (13)

| System | Status | Description |
|--------|--------|-------------|
| Customer Auth | ✅ | Register, login, JWT, profile |
| Admin Auth | ✅ | Admin login, roles, activity log |
| Product Catalog | ✅ | Products, variants, categories, media |
| Cart | ✅ | Guest/user carts, Redis cache, merge |
| Checkout | ✅ | 5-step flow, session management |
| Order | ✅ | Create, status flow, history |
| Payment (QPay) | ✅ | Invoice, QR, callback, refund |
| Inventory | ✅ | Stock, soft/hard reserve, alerts |
| Rate Limiting | ✅ | Per-endpoint limits |
| File Upload | ✅ | Product images (Multer) |
| Search | ✅ | PostgreSQL full-text search |
| Coupon | ✅ | Percentage/fixed, limits, expiry |
| Notification | ✅ | Email templates, SendGrid-ready |
| Shipping | ✅ | Tracking, status updates |

## API Routes

### Public
```
GET  /health
GET  /api/v1/products
GET  /api/v1/products/:idOrSlug
GET  /api/v1/products/search?q=keyword
GET  /api/v1/products/suggest?q=keyword
GET  /api/v1/categories
GET  /api/v1/orders/:id/tracking
```

### Customer Auth
```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
GET  /api/v1/auth/profile
PATCH /api/v1/auth/profile
POST /api/v1/auth/change-password
```

### Cart
```
GET    /api/v1/cart
POST   /api/v1/cart/items
PATCH  /api/v1/cart/items/:itemId
DELETE /api/v1/cart/items/:itemId
DELETE /api/v1/cart
POST   /api/v1/cart/coupon
DELETE /api/v1/cart/coupon/:code
POST   /api/v1/cart/merge
POST   /api/v1/cart/validate
```

### Checkout
```
POST   /api/v1/checkout
GET    /api/v1/checkout/:id
DELETE /api/v1/checkout/:id
POST   /api/v1/checkout/:id/steps/customer
POST   /api/v1/checkout/:id/steps/shipping-address
POST   /api/v1/checkout/:id/steps/shipping-method
POST   /api/v1/checkout/:id/steps/payment-method
GET    /api/v1/checkout/:id/steps/review
POST   /api/v1/checkout/:id/confirm
POST   /api/v1/checkout/apply-coupon
```

### Orders
```
GET    /api/v1/orders
GET    /api/v1/orders/my
GET    /api/v1/orders/stats
GET    /api/v1/orders/:id
POST   /api/v1/orders/:id/cancel
```

### Payment
```
GET    /api/v1/payments/:id
POST   /api/v1/payments/callback
POST   /api/v1/payments/:id/refund
```

### Admin
```
POST   /api/v1/admin/auth/login
GET    /api/v1/admin/auth/me
GET    /api/v1/admin/dashboard/stats
POST   /api/v1/admin/products
PUT    /api/v1/admin/products/:id
DELETE /api/v1/admin/products/:id
POST   /api/v1/admin/products/:id/upload
POST   /api/v1/admin/products/upload
POST   /api/v1/admin/coupons
GET    /api/v1/admin/coupons
PUT    /api/v1/admin/coupons/:id
DELETE /api/v1/admin/coupons/:id
POST   /api/v1/admin/orders/:id/ship
PATCH  /api/v1/admin/shipping/:orderId/status
GET    /api/v1/admin/shipping
GET    /api/v1/admin/notifications
PATCH  /api/v1/orders/:id/status
```

### AI (Ollama)
```
POST   /api/v1/ai/chat
POST   /api/v1/ai/recommend
POST   /api/v1/ai/describe
```

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| /api/v1/auth/* | 5 req/min |
| /api/v1/checkout/* | 10 req/min |
| /api/v1/payments/* | 10 req/min |
| /api/v1/orders/* | 10 req/min |
| All others | 100 req/min |

## Database

35 Prisma models: Product, ProductVariant, ProductMedia, Category, Customer, CustomerAddress, Cart, CartItem, CartDiscount, Checkout, CheckoutItem, CheckoutAddress, CheckoutPayment, Order, OrderItem, OrderStatusHistory, OrderHistory, Payment, PaymentTransaction, PaymentHistory, Refund, Inventory, StockReservation, StockHistory, Shipping, ShippingMethod, ShippingTracking, AdminUser, AdminRole, AdminActivity, SystemEvent, SystemLog, SystemRuntime, Coupon, Notification

## npm Scripts

```bash
npm run dev          # Development server
npm run build        # TypeScript compile
npm run start        # Production server
npm run db:generate  # Prisma client
npm run db:push      # Push schema
npm run db:migrate   # Run migrations
npm run db:seed      # Seed data
npm run db:studio    # Prisma Studio
npm run typecheck    # Type check
```

## License

Private — WEBSHOP Platform
