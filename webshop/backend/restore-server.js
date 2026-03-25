const fs = require('fs');

let serverContents = fs.readFileSync('server.ts', 'utf8');

// Find where // Categories starts. If it exists, cut from there to the end.
const catIdx = serverContents.indexOf('// Categories');
if (catIdx !== -1) {
    serverContents = serverContents.substring(0, catIdx);
}

// Ensure the end is clean before appending
serverContents = serverContents.trimEnd();

const correctEnding = `

// Categories
app.get(\`\${BASE}/categories\`, async (_req, res) => {
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
app.use(\`\${BASE}/cart\`, cartRouter)

// Checkout routes
app.use(\`\${BASE}/checkout\`, checkoutRouter)

// Order routes
app.use(\`\${BASE}/orders\`, orderRouter)

// Payment routes
app.use(\`\${BASE}/payments\`, paymentRouter)

// Inventory routes (admin)
app.use(\`\${BASE}/inventory\`, inventoryRouter)

// Customer auth routes
app.use(\`\${BASE}/auth\`, customerRouter)

// Admin routes
app.use(\`\${BASE}/admin/auth\`, adminAuthRouter)
app.use(\`\${BASE}/admin/dashboard\`, dashboardRouter)
app.use(\`\${BASE}/admin\`, productAdminRouter)

// System info
app.use(\`\${BASE}/system\`, rateLimitRouter)

// Storefront features
app.use(\`\${BASE}/storefront\`, storefrontRouter)

// AI Automation
app.use(\`\${BASE}\`, aiRouter)

// ─── 404 Handler (API only) ───────────────────
app.all(\`\${BASE}/*\`, (_req, res) => {
  res.status(404).json({ success: false, error: { message: 'Endpoint not found' } })
})

// Catch-all: serve index.html for non-API requests (Frontend SPA)
const path = require('path');
app.get('*', (_req, res) => {
  const indexPath = path.join(process.cwd(), 'public', 'index.html');
  res.sendFile(indexPath);
})

// ─── Global Error Handler ─────────────────────
app.use((err: any, req: any, res: any, _next: any) => {
  console.error('[SERVER ERROR]', err)
  
  if (err && err.message) {
      prisma.aiMemory.create({
        data: { context: \`[СИСТЕМИЙН АЛДАА]: \${req.method} \${req.url} - \${err.message}\`, type: 'error' }
      }).catch(console.error);
  }

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
    
    // V42: Start heavy enterprise workers
    const { runJobWorker, runSystemMonitor, runSystemRecoveryWorker } = require('./infrastructure/workers');
    runJobWorker();
    runSystemMonitor();
    runSystemRecoveryWorker(); // <-- The self-healing loop

    const PORT = parseInt(process.env.PORT || '4000', 10);
    app.listen(PORT, () => {
      console.info(\`
  ╔═══════════════════════════════════════╗
  ║   🛍️  WEBSHOP Server Running          ║
  ║   Port: \${PORT}                         ║
  ║   ENV:  \${process.env.NODE_ENV || 'development'}                ║
  ║   API:  \${BASE}                  ║
  ╚═══════════════════════════════════════╝
      \`)
    })
  } catch (err) {
    console.error('❌ Failed to start server:', err)
    process.exit(1)
  }
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.info(\`\\n🛑 \${signal} received — shutting down gracefully...\`)
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

bootstrap()

export default app
`;

fs.writeFileSync('server.ts', serverContents + correctEnding);
console.log('Restored the correct end block of server.ts');
