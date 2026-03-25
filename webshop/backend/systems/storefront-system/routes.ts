// @ts-nocheck
import { Router } from 'express';
import { prisma } from '../../server';

export const storefrontRouter = Router();

// V13: Newsletter Subscription
storefrontRouter.post('/newsletter', async (req, res) => {
  try {
    const { name, email } = req.body;
    if(!email) return res.status(400).json({ success: false, message: 'И-мэйл оруулна уу' });
    await prisma.systemEvent.create({ data: { eventType: 'NEWSLETTER_SUBSCRIBE', sourceSystem: 'storefront', payload: { name: name || '', email, date: new Date().toISOString() } } });
    res.json({ success: true, message: 'Амжилттай бүртгэгдлээ!' });
  } catch(err) { res.status(500).json({ success: false }); }
});

// ─────────────────────────────────────────────
// V14: CREATIVE FEATURES BACKEND
// ─────────────────────────────────────────────

// 🎰 Spin Wheel — Random prize with cooldown
storefrontRouter.post('/spin-wheel', async (req, res) => {
  try {
    const prizes = [
      { label: '5% хөнгөлөлт', code: 'SPIN5', discount: 5, weight: 30 },
      { label: '10% хөнгөлөлт', code: 'SPIN10', discount: 10, weight: 20 },
      { label: '15% хөнгөлөлт', code: 'SPIN15', discount: 15, weight: 10 },
      { label: 'Үнэгүй хүргэлт', code: 'FREESHIP', discount: 0, weight: 15 },
      { label: 'Дахин оролд', code: null, discount: 0, weight: 25 },
    ];
    // Weighted random selection
    const totalWeight = prizes.reduce((s, p) => s + p.weight, 0);
    let rand = Math.random() * totalWeight;
    let selected = prizes[prizes.length - 1];
    for (const p of prizes) {
      rand -= p.weight;
      if (rand <= 0) { selected = p; break; }
    }
    // Log the spin
    await prisma.systemEvent.create({ data: { eventType: 'SPIN_WHEEL', sourceSystem: 'storefront', payload: { prize: selected.label, code: selected.code, ip: req.ip, date: new Date().toISOString() } } });
    res.json({ success: true, prize: selected });
  } catch(err) { res.status(500).json({ success: false }); }
});

// ⚡ Flash Sales — Time-limited deals
storefrontRouter.get('/flash-sales', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { deletedAt: null, status: 'active' },
      take: 3,
      orderBy: { basePrice: 'desc' },
      include: { media: true }
    });
    // Flash sale ends at midnight tonight
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const endsAt = endOfDay.toISOString();
    const flashItems = await Promise.all(products.map(async p => {
      let stock = 10;
      try { const inv = await prisma.inventory.findUnique({ where: { productId: p.id } }); stock = inv?.quantity || 10; } catch{}
      return {
        id: p.id, name: p.name,
        originalPrice: p.basePrice,
        salePrice: Math.floor(p.basePrice * 0.7),
        discount: 30,
        img: p.media?.[0]?.url || '',
        stock: Math.min(stock, 50)
      };
    }));
    res.json({ success: true, data: { items: flashItems, endsAt } });
  } catch(err) { res.status(500).json({ success: false }); }
});

// 🎁 Gift Card — Create
storefrontRouter.post('/gift-cards', async (req, res) => {
  try {
    const { amount, senderName, recipientEmail, message } = req.body;
    if(!amount || !recipientEmail) return res.status(400).json({ success: false, message: 'Дүн болон имэйл шаардлагатай' });
    const code = 'GC-' + Math.random().toString(36).slice(2, 8).toUpperCase() + '-' + Date.now().toString(36).slice(-4).toUpperCase();
    await prisma.systemEvent.create({ data: { eventType: 'GIFT_CARD_CREATED', sourceSystem: 'storefront', payload: { code, amount: Number(amount), senderName, recipientEmail, message, used: false, date: new Date().toISOString() } } });
    res.json({ success: true, code, amount: Number(amount) });
  } catch(err) { res.status(500).json({ success: false }); }
});

// 🎁 Gift Card — Redeem
storefrontRouter.post('/gift-cards/redeem', async (req, res) => {
  try {
    const { code } = req.body;
    const events = await prisma.systemEvent.findMany({ where: { eventType: 'GIFT_CARD_CREATED' } });
    const card = events.find((e: any) => e.payload?.code === code && !e.payload?.used);
    if(!card) return res.status(404).json({ success: false, message: 'Бэлгийн карт олдсонгүй эсвэл ашиглагдсан' });
    await prisma.systemEvent.update({ where: { id: card.id }, data: { payload: { ...(card.payload as any), used: true, usedAt: new Date().toISOString() } } });
    res.json({ success: true, amount: (card.payload as any).amount });
  } catch(err) { res.status(500).json({ success: false }); }
});

// 🔔 Price Alert — Subscribe to price drop
storefrontRouter.post('/price-alert', async (req, res) => {
  try {
    const { productId, email, targetPrice } = req.body;
    if(!productId || !email) return res.status(400).json({ success: false });
    await prisma.systemEvent.create({ data: { eventType: 'PRICE_ALERT', sourceSystem: 'storefront', payload: { productId, email, targetPrice, date: new Date().toISOString() } } });
    res.json({ success: true, message: 'Үнэ буурахад танд мэдэгдэх болно!' });
  } catch(err) { res.status(500).json({ success: false }); }
});

// 👻 Live Feed — Recent purchases for social proof
storefrontRouter.get('/live-feed', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { items: true }
    });
    const feed = orders.map(o => {
      const item = o.items?.[0];
      const addr = o.shippingAddress as any;
      const customerName = addr?.name || addr?.firstName || 'Хэрэглэгч';
      const mins = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000);
      return {
        name: customerName,
        product: item?.productName || 'Бараа',
        time: mins < 60 ? `${mins} мин` : `${Math.floor(mins/60)} цаг`,
        img: item?.imageUrl || ''
      };
    });
    res.json({ success: true, data: feed });
  } catch(err) { res.status(500).json({ success: false }); }
});

storefrontRouter.post('/products/:id/reviews', async (req, res) => {
  try {
    const { rating, text, userName } = req.body;
    await prisma.systemEvent.create({ data: { eventType: 'PRODUCT_REVIEW', sourceSystem: 'storefront', payload: { productId: req.params.id, rating, text, userName, date: new Date().toISOString() } } });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false }); }
});

storefrontRouter.get('/products/:id/reviews', async (req, res) => {
  try {
    const events = await prisma.systemEvent.findMany({ where: { eventType: 'PRODUCT_REVIEW', payload: { path: ['productId'], equals: req.params.id } } });
    const reviews = events.map(e => e.payload);
    res.json({ success: true, reviews });
  } catch(err) {
    // Fallback: some DBs don't support JSON path filtering
    try {
      const events = await prisma.systemEvent.findMany({ where: { eventType: 'PRODUCT_REVIEW' } });
      const reviews = events.map(e => e.payload).filter((p: any) => p.productId === req.params.id);
      res.json({ success: true, reviews });
    } catch { res.status(500).json({ success: false }); }
  }
});
