const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$connect()
  .then(() => { console.log('✅ DB CONNECTION OK'); return p.$disconnect(); })
  .catch((e) => { console.error('❌ DB FAIL:', e.message); process.exit(1); });
