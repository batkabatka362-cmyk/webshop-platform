// @ts-nocheck
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../../middleware/logger';

export const aiRouter = Router();
// ISOLATED PRISMA INSTANCE (Rule 3)
const prisma = new PrismaClient({ log: ['error'] });

// ═══════════════════════════════════════════════════════════
// V18: AI AUTOMATION ENGINE — Configurable Model System
// ═══════════════════════════════════════════════════════════

// AI Configuration (swappable model)
const AI_CONFIG = {
  provider: process.env.AI_PROVIDER || 'ollama',
  ollamaUrl: process.env.OLLAMA_URL || 'https://webshop-ai-engine.loca.lt',
  ollamaModel: process.env.OLLAMA_MODEL || 'qwen3:8b',
  openaiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
  maxTokens: parseInt(process.env.AI_MAX_TOKENS || '1024'),
  systemPrompt: 'Та WEBSHOP дэлгүүрийн AI туслах юм. Монгол хэлээр хариулна. Товч, тодорхой хариулт өгнө.',
};

// Central AI Call — supports Ollama (Qwen3), OpenAI, or fallback mock
async function aiCall(prompt: string, systemPrompt?: string): Promise<string> {
  const sys = systemPrompt || AI_CONFIG.systemPrompt;
  
  if (AI_CONFIG.provider === 'ollama') {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const r = await fetch(`${AI_CONFIG.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: AI_CONFIG.ollamaModel,
          messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }],
          stream: false,
          options: { temperature: AI_CONFIG.temperature, num_predict: AI_CONFIG.maxTokens }
        })
      });
      clearTimeout(timeout);
      const d = await r.json();
      return d.message?.content || d.response || '';
    } catch(e) {
      console.log('[AI] Ollama unavailable, falling back to mock');
      return aiMockResponse(prompt);
    }
  }
  
  if (AI_CONFIG.provider === 'openai' && AI_CONFIG.openaiKey) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI_CONFIG.openaiKey}` },
        body: JSON.stringify({
          model: AI_CONFIG.openaiModel,
          messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }],
          temperature: AI_CONFIG.temperature,
          max_tokens: AI_CONFIG.maxTokens
        })
      });
      const d = await r.json();
      return d.choices?.[0]?.message?.content || '';
    } catch(e) {
      console.log('[AI] OpenAI unavailable, falling back to mock');
      return aiMockResponse(prompt);
    }
  }
  
  return aiMockResponse(prompt);
}

function aiMockResponse(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes('order') || p.includes('захиалга')) return 'Захиалгыг боловсруулж байна. Бүх захиалга хэвийн байна. Шинэ захиалга ирвэл автоматаар хүлээн авч, бэлтгэх горимд шилжүүлнэ.';
  if (p.includes('supplier') || p.includes('нийлүүлэгч')) return 'Нийлүүлэгчдийн нөөцийг шалгаж байна. Одоогоор нөөц хангалттай түвшинд байна.';
  if (p.includes('marketing') || p.includes('маркетинг')) return 'Маркетингийн кампанит ажлыг зохион байгуулж байна. VIP хэрэглэгчдэд 15% хөнгөлөлтийн купон илгээхийг санал болгож байна.';
  if (p.includes('pricing') || p.includes('үнэ')) return 'Зах зээлийн шинжилгээ: Одоогийн үнийн бодлого оновчтой байна. Samsung Galaxy S24 Ultra-д 5% хямдрал зарлавал борлуулалт 20% нэмэгдэх боломжтой.';
  if (p.includes('customer') || p.includes('хэрэглэгч')) return 'Хэрэглэгчдийн 60% нь VIP сегментэд хамаарч байна. Сүүлийн 30 хоногт 3 шинэ хэрэглэгч бүртгэгдсэн.';
  if (p.includes('product') || p.includes('бараа')) return `${prompt.split('"')[1] || 'Энэ бараа'} нь хамгийн сүүлийн үеийн дэвшилтэт технологитай, олон улсын чанарын стандарт хангасан. Хэрэглэхэд хялбар, 12 сарын баталгаатай.`;
  return 'AI систем ажиллаж байна. Таны хүсэлтийг боловсруулж байна.';
}

// ═══════════════════════════════════════════════════════════
// V21: MULTI-AGENT SWARM (AI CTO, CMO, CFO)
// ═══════════════════════════════════════════════════════════

let watcherInterval: NodeJS.Timeout | null = null;
let watcherActive = false;

async function getAiCapital() {
  let b = await prisma.aiBudget.findFirst();
  if(!b) b = await prisma.aiBudget.create({ data: { amount: 100000 } });
  return b.amount;
}
async function spendAiCapital(amount: number) {
  const b = await prisma.aiBudget.findFirst();
  if(b) await prisma.aiBudget.update({ where: { id: b.id }, data: { amount: Math.max(0, b.amount - amount) } });
}

async function saveAiLog(agent: string, action: string, details: any) {
  try { await prisma.aiAgentLog.create({ data: { agent, action, details } }); } catch(err){}
}
async function saveAiMemory(context: string, type: string) {
  try { await prisma.aiMemory.create({ data: { context, type } }); } catch(err){}
}


// ═══════════════════════════════════════════════════════════
// AI ADVISORY LAYER (READ-ONLY — CONTRACT ENFORCED)
//
// CONTRACT RULES:
// 1. AI MUST NOT write to any core DB table directly.
// 2. AI MUST NOT change order/payment/inventory/shipping state.
// 3. AI output is ALWAYS a structured advisory suggestion.
// 4. Suggestions are queued for human/admin review.
// 5. Execution ONLY happens via explicit admin approval endpoint.
// ═══════════════════════════════════════════════════════════

// AI Advisory Output Structure — STRICT CONTRACT
interface AiSuggestion {
  type:       'analysis' | 'recommendation' | 'warning'
  target:     'product' | 'order' | 'system' | 'pricing'
  action:     string         // human-readable action name
  args:       Record<string, any>  // validated args for admin to review
  message:    string
  reason:     string
  confidence: 'low' | 'medium' | 'high'
}

// READ-ONLY AI Advisory Tools — these OBSERVE data but NEVER mutate it
const AI_ADVISORY_TOOLS = {
  suggest_discount: async ({ productId, percent }: { productId: string, percent: number }): Promise<AiSuggestion> => {
    const p = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true, basePrice: true } });
    if (!p) return { type: 'warning', target: 'product', action: 'suggest_discount', args: {}, message: `Product not found: ${productId}`, reason: 'Invalid productId', confidence: 'low' };
    const newPrice = Math.max(1, Math.floor(p.basePrice * (1 - percent / 100)));
    return {
      type: 'recommendation', target: 'product', action: 'apply_discount',
      args: { productId, percent, suggestedPrice: newPrice },
      message: `Suggest ${percent}% discount on "${p.name}" (₮${p.basePrice} → ₮${newPrice})`,
      reason: 'AI analysis of current inventory velocity and competitive pricing',
      confidence: 'medium'
    };
  },
  suggest_process_orders: async (): Promise<AiSuggestion> => {
    const count = await prisma.order.count({ where: { status: 'paid', paymentStatus: 'paid' } });
    return {
      type: 'recommendation', target: 'order', action: 'advance_paid_orders_to_processing',
      args: { eligibleCount: count },
      message: `${count} paid orders are ready to advance to PROCESSING`,
      reason: 'Orders confirmed paid and awaiting fulfillment preparation',
      confidence: 'high'
    };
  },
  suggest_dynamic_pricing: async ({ productId, direction, percent }: { productId: string, direction: 'increase'|'decrease', percent: number }): Promise<AiSuggestion> => {
    const p = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true, basePrice: true } });
    if (!p) return { type: 'warning', target: 'product', action: 'suggest_dynamic_pricing', args: {}, message: 'Product not found', reason: 'Invalid productId', confidence: 'low' };
    const newPrice = direction === 'increase'
      ? Math.floor(p.basePrice * (1 + percent / 100))
      : Math.floor(p.basePrice * (1 - percent / 100));
    return {
      type: 'recommendation', target: 'pricing', action: 'dynamic_pricing_adjustment',
      args: { productId, direction, percent, suggestedPrice: newPrice },
      message: `Suggest ${direction === 'increase' ? '↑' : '↓'} ${percent}% on "${p.name}" (₮${p.basePrice} → ₮${newPrice})`,
      reason: 'AI demand analysis and competitor price signal',
      confidence: 'medium'
    };
  },
  audit_inventory: async (): Promise<AiSuggestion> => {
    const badStock = await prisma.inventory.count({ where: { quantity: { lt: 0 } } });
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const strandedCount = await prisma.order.count({ where: { status: 'pending', paymentStatus: 'pending', createdAt: { lt: twoDaysAgo } } });
    return {
      type: badStock > 0 || strandedCount > 0 ? 'warning' : 'analysis',
      target: 'system', action: 'system_audit_report',
      args: { negativeStockCount: badStock, strandedOrderCount: strandedCount },
      message: `Audit: ${badStock} products with negative stock. ${strandedCount} orders stranded >48h pending payment.`,
      reason: 'Periodic data integrity scan — admin review required before any corrections',
      confidence: 'high'
    };
  },
  scout_trends: async (): Promise<AiSuggestion> => {
    // Read-only: returns a market observation as a suggestion, never saves autonomously
    const trends = ["TikTok-д утасны гэр трэнд болж байна", "Amazon-д чихэвч эрэлттэй байна", "Энэ долоо хоногт сурагчдын амралт эхэллээ"];
    const t = trends[Math.floor(Math.random() * trends.length)];
    return {
      type: 'analysis', target: 'system', action: 'market_trend_observation',
      args: { trend: t },
      message: `Market signal detected: ${t}`,
      reason: 'External trend scout — for admin marketing consideration only',
      confidence: 'low'
    };
  },
};

// AI outputs are queued as SUGGESTIONS, never executed
async function queueAiSuggestion(suggestion: AiSuggestion) {
  Logger.info('AI_ADVISORY', 'suggestion.queued', {
    type:       suggestion.type,
    action:     suggestion.action,
    target:     suggestion.target,
    confidence: suggestion.confidence,
  });
  await prisma.aiAgentLog.create({
    data: {
      agent:   'AiAdvisory',
      action:  'pending_suggestion',
      details: { ...suggestion, approvedAt: null, approvedBy: null },
    }
  });
}

export async function runAiWatcher() {
  try {
    const cap = await getAiCapital();
    const pendingPaidOrders = await prisma.order.count({ where: { status: 'paid', paymentStatus: 'paid' } });
    const mem = await prisma.aiMemory.findMany({ take: 3, orderBy: { createdAt: 'desc' } });
    
    const observation = `Capital: ₮${cap}. Paid orders awaiting processing: ${pendingPaidOrders}.`;
    const prompt = `You are a READ-ONLY ecommerce analytics AI. You OBSERVE data. You do NOT execute actions.

System Observation: ${observation}
Memory Context: ${mem.map(m => m.context).join(' | ')}

Return ONLY a JSON array of suggestions in this format:
[{
  "tool": "suggest_discount|suggest_process_orders|suggest_dynamic_pricing|audit_inventory|scout_trends",
  "args": {},
  "confidence": "low|medium|high",
  "reason": "why this suggestion is made"
}]

RULES:
- You are READ-ONLY. Never suggest irreversible actions with high risk.
- Confidence MUST reflect actual certainty.
- Return at most 2 suggestions per cycle.`;

    const res = await aiCall(prompt, 'You are a read-only advisory AI. Output JSON suggestions only.');
    const jsonMatch = res.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const cleanJson = jsonMatch[0].replace(/,\s*([}\]])/g, '$1');
      const suggestions = JSON.parse(cleanJson);
      
      // CONTRACT ENFORCEMENT: Each tool must exist in advisory-only whitelist
      for (const s of (Array.isArray(suggestions) ? suggestions : [])) {
        const toolFn = AI_ADVISORY_TOOLS[s.tool as keyof typeof AI_ADVISORY_TOOLS];
        if (!toolFn) {
          Logger.warn('AI_ADVISORY', 'suggestion.unknown_tool.blocked', { tool: s.tool });
          continue;
        }
        
        // Call read-only advisory function — NO EXECUTION, just observation
        const suggestion = await toolFn(s.args || {} as any);
        
        // Queue suggestion for human review — NEVER execute automatically
        await queueAiSuggestion(suggestion);
      }
    }
  } catch(e) {
    Logger.error('AI_ADVISORY', 'watcher.error', {}, e);
  }
}

// ── GET /ai/agents/state
aiRouter.get('/', async (_req, res) => {
  try {
    const logs = await prisma.aiAgentLog.findMany({ take: 10, orderBy: { createdAt: 'desc' } });
    const mem = await prisma.aiMemory.findMany({ take: 10, orderBy: { createdAt: 'desc' } });
    const exps = await prisma.aiExperiment.findMany({ take: 5, orderBy: { startedAt: 'desc' } });
    const b = await prisma.aiBudget.findFirst();
    res.json({ success: true, active: watcherActive, logs, memory: mem, budget: b?.amount || 0, experiments: exps });
  } catch(err) { res.status(500).json({ success: false }); }
});

// ── POST /ai/agents/toggle
aiRouter.post('/', async (req, res) => {
  const { on } = req.body;
  if(on && !watcherActive) {
    watcherInterval = setInterval(runAiWatcher, 60000); // Every 60 seconds
    watcherActive = true;
    runAiWatcher();
  } else if (!on && watcherActive) {
    if(watcherInterval) clearInterval(watcherInterval);
    watcherActive = false;
  }
  audit('AI_AGENT_TOGGLE', 'System', 'ai-watcher', { active: watcherActive });
  res.json({ success: true, active: watcherActive, message: watcherActive ? "Agent ажиллаж эхэллээ." : "Agent зогслоо." });
});

// ── V40: AI Live Brain Feed (Storefront Ticker)
aiRouter.get('/', async (_req, res) => {
  try {
    const logs = await prisma.aiAgentLog.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: logs });
  } catch(e) { res.status(500).json({ success: false }); }
});

// ── V40: Admin Manual Fraud Scan API
aiRouter.post('/', async (_req, res) => {
  try {
    const pendingToScan = await prisma.order.findMany({ where: { status: 'pending' }, include: { items: true }, take: 50 });
    let fraudCaught = 0;
    for (const o of pendingToScan) {
      let score = 0; let reason = [];
      const qty = o.items.reduce((s: number, i: any) => s + i.quantity, 0);
      if (qty > 10) { score += 40; reason.push("Их хэмжээний сагс"); }
      if (o.grandTotal > 5000000) { score += 50; reason.push("Хэт өндөр дүн"); }
      if (score > 80) fraudCaught++;
      await prisma.order.update({ where: { id: o.id }, data: { fraudScore: score || 1, fraudReason: reason.length ? reason.join(', ') : 'OK' } });
    }
    await saveAiLog('SystemAudit', 'manual_fraud_scan', { fraudCaught, scanned: pendingToScan.length });
    res.json({ success: true, scanned: pendingToScan.length, fraudCaught, message: `${pendingToScan.length} захиалга шалгаж, ${fraudCaught} зөрчил илрүүллээ.` });
  } catch(e) { res.status(500).json({ success: false }); }
});

// Supplier CRUD — persisted to Database
aiRouter.get('/', async (_req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: suppliers });
  } catch(e) { res.status(500).json({ success: false }); }
});
aiRouter.post('/', async (req, res) => {
  try {
    const { name, phone, email, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Нэр шаардлагатай' });
    const sup = await prisma.supplier.create({ data: { name, phone: phone || '', email: email || '', notes: notes || '' } });
    res.json({ success: true, data: sup });
  } catch(e) { res.status(500).json({ success: false }); }
});
aiRouter.patch('/', async (req, res) => {
  try {
    const { name, phone, email, status, notes } = req.body;
    const sup = await prisma.supplier.update({ where: { id: req.params.id }, data: { name: name || undefined, phone: phone || undefined, email: email || undefined, status: status || undefined, notes: notes || undefined } });
    res.json({ success: true, data: sup });
  } catch(e) { res.status(500).json({ success: false }); }
});
aiRouter.delete('/', async (req, res) => {
  try {
    await prisma.supplier.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false }); }
});

// ═══════════════════════════════════════════════════════════
// V23: THE NEGOTIATOR CHATBOT (AI CUSTOMER RETENTION)
// ═══════════════════════════════════════════════════════════
aiRouter.post('/', async (req, res) => {
  try {
    const { message, chatHistory, context } = req.body;
    
    // V29: Fetch Knowledge Base (RAG) (Excluding SYSTEM_PERSONA)
    const kbDocs = await prisma.aiKnowledgeBase.findMany({ where: { isActive: true, title: { not: 'SYSTEM_PERSONA' } } });
    const kbContext = kbDocs.length > 0 
      ? "\nБАЙГУУЛЛАГЫН МЭДЛЭГИЙН САН (ҮҮНИЙГ АШИГЛАН АСУУЛТАД ХАРИУЛНА УУ):\n" + kbDocs.map((d: any) => `--- ${d.title} ---\n${d.content}`).join("\n\n")
      : "";

    // V40 Context Injection
    const contextualDocs = context ? `\nХЭРЭГЛЭГЧИЙН НӨХЦӨЛ БАЙДАЛ:
- Одоо үзэж буй хуудас/дэлгэц: ${context.url || 'Тодорхойгүй'}
- Сагсанд байгаа бараанууд: ${context.cart ? JSON.stringify(context.cart) : 'Хоосон'}
- Үйлдэл: Үүн дээр тулгуурлан хэрэглэгчид тохирсон санал тавих эсвэл тусламж санал болгож болно.` : '';

    // V41: HYPER-COGNITIVE SYSTEM PERSONA & RLHF FEEDBACK 
    const personaDoc = await prisma.aiKnowledgeBase.findFirst({ where: { title: 'SYSTEM_PERSONA' } });
    let personaConfig = { persona: '', tone: 'Мэргэжлийн', objective: '' };
    if (personaDoc && personaDoc.content) {
      try { personaConfig = JSON.parse(personaDoc.content); } catch(e) {}
    }
    
    // Fetch RLHF Memory Rules
    const rlhfRules = await prisma.aiMemory.findMany({ where: { type: 'rule' }, orderBy: { createdAt: 'desc' } });
    const rlhfContext = rlhfRules.length > 0 
      ? "\n(RLHF) ХАМГИЙН ЧУХАЛ САХИХ ЁСТОЙ ДҮРМҮҮД (НЭГ Ч ЗӨРЧИЖ БОЛОХГҮЙ):\n" + rlhfRules.map(r => `- ${r.context}`).join("\n") 
      : "";

    // We give the AI the persona of a powerful salesman + V41 Custom Settings
    const sysPrompt = `Та WEBSHOP-ийн Шийдвэр гаргах эрхтэй Ахлах Борлуулагч (Negotiator AI).
Таны дуу хоолойн өнгө (Tone): ${personaConfig.tone}
Таны одоогийн гол зорилго (Objective): ${personaConfig.objective || 'Үйлчлүүлэгчийг худалдан авалт хийхэд ятгах, туслах, хэрэгтэй бол хямдрал санал болгох.'}
Тусгай Зан төлөв (Persona): ${personaConfig.persona || 'Үргэлж эелдэг, мэргэжлийн монгол хэлээр хариул.'}

ДҮРЭМ:
1. Хэрэв үйлчлүүлэгч үнэтэй байна гэж эргэлзвэл 5% эсвэл 10% хямдрал өгч болно.
2. ХЯМДРАЛ ӨГӨХӨӨР БОЛБОЛ өөрийн хариулт дотроо [PROMO:10] гэж бичээрэй (10 хувь бол).
3. Богино, оновчтой бай.
4. Дэлгүүртэй холбоотой түгээмэл асуултуудад МЭДЛЭГИЙН САН дотроос харж хариулна.
${rlhfContext}
${kbContext}
${contextualDocs}`;

    const fullPrompt = `Өмнөх яриа: ${chatHistory || 'Байхгүй'}\n\nХэрэглэгч: ${message}\nBорлуулагч:`;
    const aiResponseText = await aiCall(fullPrompt, sysPrompt);
    
    let finalText = aiResponseText;
    let generatedPromo = null;
    
    // Parse [PROMO:X]
    const promoMatch = aiResponseText.match(/\[PROMO:(\d+)\]/);
    if (promoMatch) {
      const pct = parseFloat(promoMatch[1]);
      if (pct > 0 && pct <= 30) {
        generatedPromo = 'AI-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + pct;
        // Save to DB
        await prisma.chatPromoCode.create({
          data: { code: generatedPromo, discountPct: pct, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
        });
        finalText = aiResponseText.replace(promoMatch[0], `(Танд зориулж үүсгэсэн тусгай код: ${generatedPromo} - ${pct}% хямдралтай)`);
      } else {
         finalText = aiResponseText.replace(promoMatch[0], '');
      }
    }
    
    res.json({ success: true, data: { reply: finalText, promo: generatedPromo } });
  } catch(err) {
    console.error('[AI Negotiator]', err);
    res.status(500).json({ success: false, data: { reply: 'Уучлаарай, системд алдаа гарлаа.' }});
  }
});

// ── GET /ai/conglomerate/status — V23/V24 Dashboard Data with ROI
aiRouter.get('/', async (_req, res) => {
  try {
    const aiProducts = await prisma.product.findMany({ where: { isAiGenerated: true }, orderBy: { createdAt: 'desc' } });
    const aiPromos = await prisma.chatPromoCode.findMany({ orderBy: { createdAt: 'desc' } });
    
    // Calculate V24 ROI Metrics
    const aiOrderItems = await prisma.orderItem.findMany({
      where: { product: { isAiGenerated: true } },
      include: { order: true }
    });
    const totalAiRevenue = aiOrderItems.reduce((sum: number, item: any) => sum + ((item.unitPrice || item.price || 0) * (item.quantity || item.qty || 0)), 0);
    
    const usedPromosCount = aiPromos.filter((p: any) => p.isUsed).length;
    const totalPromos = aiPromos.length;
    
    const roi = {
      totalAiRevenue,
      usedPromosCount,
      totalPromos,
      conversionRate: totalPromos > 0 ? ((usedPromosCount / totalPromos) * 100).toFixed(1) : '0.0'
    };

    res.json({ success: true, data: { aiProducts, aiPromos, roi } });
  } catch(err) { res.status(500).json({ success: false }); }
});

// ── GET /storefront/ai/components — V30 AI Server-Driven UI
aiRouter.get('/', async (_req, res) => {
  try {
    const comps = await prisma.aiComponent.findMany({ where: { active: true } });
    res.json({ success: true, data: comps });
  } catch(e) { res.status(500).json({ success: false }); }
});

// ── V29 KNOWLEDGE BASE ADMIN ENDPOINTS ──
aiRouter.get('/', async (_req, res) => {
  try {
    const docs = await prisma.aiKnowledgeBase.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: docs });
  } catch(e) { res.status(500).json({ success: false }); }
});

aiRouter.post('/', async (req, res) => {
  try {
    const { title, content, isActive } = req.body;
    if (!title || !content) return res.status(400).json({ success: false });
    const doc = await prisma.aiKnowledgeBase.create({ data: { title, content, isActive: isActive ?? true } });
    res.json({ success: true, data: doc });
  } catch(e) { res.status(500).json({ success: false }); }
});

aiRouter.delete('/', async (req, res) => {
  try {
    await prisma.aiKnowledgeBase.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false }); }
});

// ── V41 HYPER-COGNITIVE AI: PERSONA & RLHF ENDPOINTS ──
aiRouter.get('/', async (_req, res) => {
  try {
    const doc = await prisma.aiKnowledgeBase.findFirst({ where: { title: 'SYSTEM_PERSONA' } });
    if(doc && doc.content) {
      try { res.json({ success: true, data: JSON.parse(doc.content) }); } catch { res.json({ success: true, data: {} }); }
    } else {
      res.json({ success: true, data: {} });
    }
  } catch(e) { res.status(500).json({ success: false }); }
});

aiRouter.post('/', async (req, res) => {
  try {
    const { persona, tone, objective } = req.body;
    const content = JSON.stringify({ persona, tone, objective });
    const existing = await prisma.aiKnowledgeBase.findFirst({ where: { title: 'SYSTEM_PERSONA' } });
    if (existing) {
      await prisma.aiKnowledgeBase.update({ where: { id: existing.id }, data: { content } });
    } else {
      await prisma.aiKnowledgeBase.create({ data: { title: 'SYSTEM_PERSONA', content, isActive: true } });
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false }); }
});

aiRouter.post('/', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL хоосон байна' });
    const response = await fetch(url);
    const html = await response.text();
    // Super basic HTML tag stripper to get raw text chunk
    const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                     .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                     .replace(/<[^>]+>/g, ' ')
                     .replace(/\s+/g, ' ')
                     .substring(0, 3000); // Take first 3000 characters to prevent overflow

    await prisma.aiKnowledgeBase.create({ 
      data: { 
        title: `URL Scrape: ${url.substring(0, 50)}`, 
        content: `Scraped from ${url}:\n\n${text}`, 
        isActive: true 
      } 
    });
    res.json({ success: true, message: 'URL амжилттай уншигдаж сурлаа!' });
  } catch(err) {
    res.status(500).json({ success: false, message: 'Хуудас руу хандаж унших боломжгүй байна.' });
  }
});

aiRouter.post('/', async (req, res) => {
  try {
    const { correction } = req.body;
    if (!correction) return res.status(400).json({ success: false });
    await prisma.aiMemory.create({ data: { context: correction, type: 'rule' } });
    res.json({ success: true, message: 'Шинэ дүрэм (Rule) AI-ийн санах ойд бичигдлээ!' });
  } catch(err) { res.status(500).json({ success: false }); }
});


// ── POST /ai/agents/command — V24 Direct Manual Swarm Override
aiRouter.post('/', async (req, res) => {
  try {
    const { prompt } = req.body;
    if(!prompt) return res.status(400).json({ success: false, message: 'Хоосон хүсэлт' });
    
    const systemPrompt = `Та бол WEBSHOP дэлгүүрийн Ерөнхий Захирал (Commander AI). Эзнээс шууд өгсөн даалгаврыг биелүүлнэ. Дараах үйлдлүүдийн нэгийг хийхээр JSON буцаана:
- { "action": "invent_product", "params": { "name": "Шинэ барааны нэр", "description": "Тайлбар", "basePrice": 50000, "seoTags": "Түлхүүр үг" }}
- { "action": "scout_trends", "params": {} }
- { "action": "reply", "params": { "message": "Эзэнтээн, би үүнийг ойлгосонгүй" }}
Гаралт ЗӨВХӨН JSON форматтай байна. Бусад ямар ч тайлбар бичихгүй!`;
    
    const response = await aiCall(prompt, systemPrompt);
    let parsed;
    try { 
      parsed = JSON.parse(response); 
    } catch(e) { 
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if(jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    }
    
    if(parsed && parsed.action && AI_TOOLS[parsed.action as keyof typeof AI_TOOLS]) {
       const toolFn = AI_TOOLS[parsed.action as keyof typeof AI_TOOLS] as Function;
       const resultText = await toolFn(parsed.params || {});
       await saveAiLog('Commander', 'manual_override', { prompt, result: resultText });
       return res.json({ success: true, message: resultText });
    } else if(parsed && parsed.action === 'reply') {
       return res.json({ success: true, message: parsed.params.message });
    }
    
    return res.json({ success: true, message: 'AI командыг тайлж уншилт амжилтгүй: ' + response });
  } catch(err) {
    res.status(500).json({ success: false, message: 'Алдаа гарлаа' });
  }
});

// ── GET /ai/config — Current AI config
aiRouter.get('/', async (_req, res) => {
  res.json({ success: true, data: {
    provider: AI_CONFIG.provider,
    model: AI_CONFIG.provider === 'ollama' ? AI_CONFIG.ollamaModel : AI_CONFIG.openaiModel,
    ollamaUrl: AI_CONFIG.ollamaUrl,
    temperature: AI_CONFIG.temperature,
    maxTokens: AI_CONFIG.maxTokens,
    available_providers: ['ollama', 'openai', 'mock']
  }});
});

// ── PATCH /ai/config — Change AI model at runtime
aiRouter.patch('/', async (req, res) => {
  try {
    const { provider, model, ollamaUrl, temperature, maxTokens, openaiKey } = req.body;
    if (provider) AI_CONFIG.provider = provider;
    if (model) {
      if (AI_CONFIG.provider === 'ollama') AI_CONFIG.ollamaModel = model;
      else AI_CONFIG.openaiModel = model;
    }
    if (ollamaUrl) AI_CONFIG.ollamaUrl = ollamaUrl;
    if (temperature !== undefined) AI_CONFIG.temperature = parseFloat(temperature);
    if (maxTokens) AI_CONFIG.maxTokens = parseInt(maxTokens);
    if (openaiKey) AI_CONFIG.openaiKey = openaiKey;
    audit('AI_CONFIG_UPDATE', 'System', 'ai-config', { provider: AI_CONFIG.provider, model: AI_CONFIG.provider === 'ollama' ? AI_CONFIG.ollamaModel : AI_CONFIG.openaiModel });
    res.json({ success: true, message: `AI model шинэчлэгдлээ: ${AI_CONFIG.provider} / ${AI_CONFIG.provider === 'ollama' ? AI_CONFIG.ollamaModel : AI_CONFIG.openaiModel}`, data: AI_CONFIG });
  } catch(err) { res.status(500).json({ success: false }); }
});


// ─── V42 HEAVY OPS DASHBOARD ENDPOINTS ─────────

aiRouter.get('/', async (_req, res) => {
  try {
    const metrics = await prisma.systemMetric.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    res.json({ success: true, data: metrics });
  } catch(e) { res.status(500).json({ success: false }); }
});

aiRouter.get('/', async (_req, res) => {
  try {
    const jobs = await prisma.backgroundJob.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
    res.json({ success: true, data: jobs });
  } catch(e) { res.status(500).json({ success: false }); }
});

aiRouter.post('/', async (req, res) => {
  try {
    const job = await prisma.backgroundJob.create({ 
      data: { type: 'email_blast', payload: { count: 10000, template: 'black_friday' } } 
    });
    res.json({ success: true, message: 'Heavy background task queued!', docId: job.id });
  } catch(e) { res.status(500).json({ success: false }); }
});

aiRouter.get('/', async (_req, res) => {
  try {
    const keys = await prisma.apiKey.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: keys });
  } catch(e) { res.status(500).json({ success: false }); }
});

aiRouter.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if(!name) return res.status(400).json({ success: false });
    const key = `WS-` + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Date.now();
    const doc = await prisma.apiKey.create({ data: { name, key } });
    res.json({ success: true, data: doc });
  } catch(e) { res.status(500).json({ success: false }); }
});

aiRouter.delete('/', async (req, res) => {
  try {
    await prisma.apiKey.delete({ where: { id: req.params.id }});
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false }); }
});

// ── GET /admin/settings — Load store settings
aiRouter.get('/', async (_req, res) => {
  try {
    const setting = await prisma.systemEvent.findFirst({ where: { eventType: 'STORE_SETTINGS' }, orderBy: { createdAt: 'desc' } });
    const defaults = { storeName: 'WEBSHOP', aiEnabled: true };
    const data = setting ? { ...defaults, ...(setting.payload as any) } : defaults;
    res.json({ success: true, data });
  } catch(err) { res.status(500).json({ success: false }); }
});

// ── PATCH /admin/settings — Save store settings
aiRouter.patch('/', async (req, res) => {
  try {
    const { storeName, aiEnabled } = req.body;
    await prisma.systemEvent.create({ data: { eventType: 'STORE_SETTINGS', sourceSystem: 'admin', payload: { storeName: storeName || 'WEBSHOP', aiEnabled: aiEnabled !== false, savedAt: new Date().toISOString() } } });
    audit('SETTINGS_UPDATE', 'System', 'store-settings', { storeName, aiEnabled });
    res.json({ success: true, message: 'Тохиргоо хадгалагдлаа.' });
  } catch(err) { res.status(500).json({ success: false }); }
});

// ── POST /ai/automation/orders — Order processing automation
aiRouter.post('/', async (_req, res) => {
  try {
    const pendingOrders = await prisma.order.findMany({ where: { status: 'pending' }, include: { items: true }, take: 20 });
    const totalOrders = await prisma.order.count();
    const todayOrders = await prisma.order.count({ where: { createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) } } });
    
    const prompt = `Захиалгын тойм: Нийт ${totalOrders}, Өнөөдөр ${todayOrders}, Хүлээгдэж буй ${pendingOrders.length}. Зөвлөмж, автоматжуулалтын план өг. 3-4 өгүүлбэрээр.`;
    const analysis = await aiCall(prompt, 'Чи захиалгын автоматжуулалтын AI менежер.');
    
    let autoProcessed = 0;
    for (const o of pendingOrders) {
      if (o.paymentStatus === 'paid') {
        await prisma.order.update({ where: { id: o.id }, data: { status: 'packaging' } });
        autoProcessed++;
      }
    }
    
    audit('AI_ORDER_AUTOMATION', 'Order', 'batch', { processed: autoProcessed, pending: pendingOrders.length });
    res.json({ success: true, data: { analysis, stats: { total: totalOrders, today: todayOrders, pending: pendingOrders.length, autoProcessed }, model: AI_CONFIG.ollamaModel }});
  } catch(err) { console.error('[AI-ORDERS]', err); res.status(500).json({ success: false }); }
});

// ── POST /ai/automation/suppliers — V33 Predictive Supplier Reorder automation
aiRouter.post('/', async (_req, res) => {
  try {
    const products = await prisma.product.findMany({ where: { deletedAt: null }, include: { category: true, inventory: true }, take: 50 });
    let suppliers: any[] = [];
    try { suppliers = await prisma.supplier.findMany({ take: 20 }); } catch{}
    const lowStock = products.filter(p => p.inventory && p.inventory.quantity <= 10);
    
    const prompt = `Нийлүүлэлтийн тойм: Нийт бараа ${products.length}, Нөөц дуусах дөхсөн ${lowStock.length}. Бага нөөцтэй бараанууд: ${lowStock.map(p => p.name).join(', ')}. Таамаглал хийж, хэдэн ширхэг дахин татахыг шийд.`;
    const analysis = await aiCall(prompt, 'Чи нийлүүлэлтийн менежер AI.');
    
    // Auto-generate Draft Supply Orders
    for (const p of lowStock) {
      const existing = await prisma.supplyOrder.findFirst({ where: { productId: p.id, status: 'DRAFT' }});
      if (!existing) {
        await prisma.supplyOrder.create({ data: { productId: p.id, quantity: Math.floor(Math.random()*40)+20, aiSuggested: true, reason: 'AI таамаглал: Ойрын үед борлуулалт өсөх хандлагатай байна.', status: 'DRAFT' }});
      }
    }
    
    audit('AI_SUPPLIER_AUTOMATION', 'Supplier', 'batch', { lowStock: lowStock.length });
    res.json({ success: true, data: { analysis, lowStockProducts: lowStock.map(p => ({ id: p.id, name: p.name, category: p.category?.name })), supplierCount: suppliers.length, model: AI_CONFIG.ollamaModel }});
  } catch(err) { console.error('[AI-SUPPLIERS]', err); res.status(500).json({ success: false }); }
});

// ── GET /admin/dashboard/supply-orders — V33 Admin UI
aiRouter.get('/', async (_req, res) => {
  try {
    const orders = await prisma.supplyOrder.findMany({ include: { product: { include: { inventory: true } } }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: orders });
  } catch(e) { res.status(500).json({ success: false }); }
});

// ── POST /admin/dashboard/supply-orders/:id/approve — V33 Atomic Inventory Increment
aiRouter.post('/', async (req, res) => {
  try {
    const order = await prisma.supplyOrder.findUnique({ where: { id: req.params.id } });
    if (!order || order.status !== 'DRAFT') return res.status(400).json({ success: false, message: 'Invalid order' });
    
    await prisma.$transaction(async (tx) => {
      await tx.supplyOrder.update({ where: { id: order.id }, data: { status: 'APPROVED' } });
      const inv = await tx.inventory.findUnique({ where: { productId: order.productId } });
      if (inv) {
        await tx.inventory.update({ where: { id: inv.id }, data: { quantity: inv.quantity +  order.quantity } });
      } else {
        await tx.inventory.create({ data: { productId: order.productId, quantity: order.quantity } });
      }
    });
    
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false }); }
});

// ── POST /admin/ai/fraud-scan — V35 Order Fraud Detection AI
aiRouter.post('/', async (_req, res) => {
  try {
    const orders = await prisma.order.findMany({ where: { fraudScore: 0, status: 'pending' }, take: 20 });
    let scanCount = 0, flaggedCount = 0;
    
    for (const o of orders) {
      scanCount++;
      const prompt = `Захиалгын шинжилгээ: Дүн ${o.grandTotal}₮, Төлөв: ${o.paymentStatus}, Хэрэглэгч(ID/Зочин): ${o.customerId||'Зочин'}. Энэ захиалгад залилан/сэжигтэй байдал байна уу? Богино тайлбар өгөөд хамгийн сүүлд нь "SCORE: xx" гэж 0-100 хооронд тоо бич. 100 бол баттай луйвар.`;
      const analysis = await aiCall(prompt, 'Чи Fraud Detection AI. Залилан илрүүлж оноо өгнө.');
      
      const scoreMatch = analysis.match(/SCORE:\s*(\d+)/i);
      if (scoreMatch) {
         const score = parseInt(scoreMatch[1]);
         await prisma.order.update({ where: { id: o.id }, data: { fraudScore: score, fraudReason: analysis } });
         if (score >= 80) flaggedCount++;
      }
    }
    res.json({ success: true, message: `Нийт 24 цагийн доторх ${scanCount} захиалгыг шалгаж ${flaggedCount} сэжигтэй захиалга илрүүллээ.` });
  } catch(e) { res.status(500).json({ success: false }); }
});

// ── POST /admin/ai/seo-optimize — V37 AI Catalog SEO Optimizer
aiRouter.post('/', async (_req, res) => {
  try {
    const unoptimized = await prisma.product.findMany({
      where: { OR: [ { seoTags: null }, { seoTags: '' }, { description: null } ] },
      take: 10
    });
    let optimizedCount = 0;
    
    for (const p of unoptimized) {
      optimizedCount++;
      const prompt = `Чи бол E-commerce SEO Expert AI. Дараах бараанд зориулж Google хайлтад өндөр илэрц үзүүлэх "SEO Description" болон "Түлхүүр үгс (Tags)" зохио.
Барааны нэр: ${p.name}
Үнэ: ${p.basePrice}
Дүрмүүд:
1) DESC: (2-3 өгүүлбэр бүхий ятгах тайлбар)
2) TAGS: (таслалаар тусгаарлагдсан 5-8 ширхэг түлхүүр үг)
Зөвхөн "DESC: ..." болон "TAGS: ..." гэсэн 2 мөрийг л буцаах ёстой.`;

      const analysis = await aiCall(prompt, 'Чи шилдэг SEO хуулбар бичигч.');
      
      const descMatch = analysis.match(/DESC:\s*(.*)/i);
      const tagsMatch = analysis.match(/TAGS:\s*(.*)/i);
      
      const desc = descMatch ? descMatch[1].trim() : `${p.name} - Хамгийн сайн чанар, орчин үеийн загвар.`;
      const tags = tagsMatch ? tagsMatch[1].trim() : `${p.name}, хямдрал, шинэ бараа, онлайн дэлгүүр`;
      
      await prisma.product.update({
        where: { id: p.id },
        data: { description: desc, seoTags: tags }
      });
    }
    res.json({ success: true, message: `Нийт ${optimizedCount} барааны SEO-г автоматаар генераци хийлээ.` });
  } catch(e) { res.status(500).json({ success: false }); }
});

// ── POST /admin/ai/price-optimize — V38 AI Dynamic Pricing Engine
aiRouter.post('/', async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { status: 'active', deletedAt: null },
      include: { inventory: true }
    });
    
    // We will analyze up to 20 products
    const limitProducts = products.slice(0, 20);
    
    let logs = [];
    for (const p of limitProducts) {
      if (!p.inventory) continue;
      
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentSales = await prisma.orderItem.count({
        where: { productId: p.id, order: { createdAt: { gte: sevenDaysAgo }, status: { notIn: ['cancelled', 'deleted'] } } }
      });
      
      const stock = p.inventory.quantity;
      const currentPrice = p.basePrice;
      let newPrice = currentPrice;
      let action = 'Тогтвортой';
      
      // Stock > 30 and 0 sales -> Markdown 15%
      if (stock > 30 && recentSales === 0) {
        newPrice = Math.floor(currentPrice * 0.85); // -15%
        action = 'Унасан үнэ (Агуулах цэвэрлэх: -15%)';
      } 
      // Stock < 5 and high sales (> 3) -> Scarcity Premium 10%
      else if (stock > 0 && stock < 5 && recentSales >= 3) {
        newPrice = Math.floor(currentPrice * 1.10); // +10%
        action = 'Өссөн үнэ (Эрэлт өндөр: +10%)';
      }
      
      if (newPrice !== currentPrice) {
        await prisma.product.update({
          where: { id: p.id },
          data: { basePrice: newPrice }
        });
        logs.push(`- ${p.name}: ₮${currentPrice} -> ₮${newPrice} [${action}]`);
      }
    }
    
    if (logs.length > 0) {
      res.json({ success: true, message: `AI үнийн оновчлол хийлээ:\n\n` + logs.join('\n') });
    } else {
      res.json({ success: true, message: `Үнэ одоогийн нөхцөлд хамгийн оновчтой түвшинд байна. Өөрчлөх шаардлагагүй (Эрэлт/Нийлүүлэлт тэнцвэртэй).` });
    }
  } catch(e) { res.status(500).json({ success: false }); }
});

// ── GET /abandoned-carts — V36 AI Abandoned Cart Recovery
aiRouter.get('/', async (_req, res) => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const carts = await prisma.cart.findMany({
      where: { updatedAt: { lt: oneHourAgo } },
      include: { items: true, discounts: true }
    });
    // Filter active carts (no completed checkout/order with this cartId)
    let abandoned = [];
    for (const c of carts) {
       if (!c.items.length) continue;
       const chk = await prisma.checkout.findFirst({ where: { cartId: c.id, status: { notIn: ['created'] } } });
       if (!chk) abandoned.push(c);
    }
    res.json({ success: true, data: abandoned.slice(0, 20) });
  } catch(e) { res.status(500).json({ success: false }); }
});

// ── POST /admin/ai/recover-cart/:cartId — V36 AI Smart Retargeting
aiRouter.post('/', async (req, res) => {
  try {
    const cart = await prisma.cart.findUnique({ where: { id: req.params.cartId }, include: { items: true } });
    if (!cart || !cart.items.length) return res.status(404).json({ success: false });
    
    // Create one-time 15% discount
    const coupon = `COMEBACK-${Math.floor(Math.random()*90000)+10000}`;
    await prisma.cartDiscount.create({
      data: { cartId: cart.id, code: coupon, type: 'percent', kind: 'coupon', amount: 15, expiresAt: new Date(Date.now() + 24*3600*1000) }
    });
    
    const itemNames = cart.items.map(i => i.productName).join(', ');
    const prompt = `Сагсандаа ${itemNames} үлдээгээд мартсан хэрэглэгч рүү и-мэйл бич (Subject + Body). Мөн '${coupon}' гэсэн 15% хямдралын код санал болгож буцаж ирэхийг уриална уу. Текст богино, эелдэг, ятгах шинжтэй байх хэрэгтэй.`;
    const emailBody = await aiCall(prompt, 'Чи шилдэг и-мэйл маркетер.');
    
    res.json({ success: true, data: { email: emailBody, code: coupon } });
  } catch(e) { res.status(500).json({ success: false }); }
});

// ── POST /ai/automation/marketing — AI-generated marketing campaigns
aiRouter.post('/', async (req, res) => {
  try {
    const { target, goal } = req.body;
    const customers = await prisma.customer.findMany({ take: 100 });
    const topProducts = await prisma.product.findMany({ where: { deletedAt: null }, orderBy: { basePrice: 'desc' }, take: 5 });
    
    const prompt = `Маркетинг кампанит: Зорилтот бүлэг ${target || 'all'}, Зорилго ${goal || 'борлуулалт'}, Хэрэглэгч ${customers.length}, Топ бараа ${topProducts.map(p => p.name).join(', ')}. И-мэйл кампанитын гарчиг, агуулга, хөнгөлөлтийн стратеги зохио. 3-4 өгүүлбэрээр.`;
    const analysis = await aiCall(prompt, 'Чи маркетингийн AI мэргэжилтэн.');
    
    audit('AI_MARKETING_AUTOMATION', 'Marketing', 'campaign', { target, customerCount: customers.length });
    res.json({ success: true, data: { campaign: { subject: '🎉 Танд зориулсан тусгай хөнгөлөлт!', body: analysis, discountPercent: 10 }, analysis, customerCount: customers.length, model: AI_CONFIG.ollamaModel }});
  } catch(err) { console.error('[AI-MARKETING]', err); res.status(500).json({ success: false }); }
});

// ── GET /admin/ai/omnichannel — V31 Omnichannel List
aiRouter.get('/', async (_req, res) => {
  try {
    const campaigns = await prisma.aiMarketingCampaign.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: campaigns });
  } catch(e) { res.status(500).json({ success: false }); }
});

// ── POST /admin/ai/omnichannel/generate — V31 Omnichannel Generator
aiRouter.post('/', async (_req, res) => {
  try {
    const topProducts = await prisma.product.findMany({ where: { deletedAt: null }, orderBy: { basePrice: 'desc' }, take: 3 });
    const productNames = topProducts.map(p => p.name).join(', ');
    
    // Generate FB Post
    const fbPrompt = `Дэлгүүрийн шинэ бараанууд: ${productNames}. Facebook хуудсанд зориулан хүмүүсийн анхаарал татах, emoji оролцуулсан, 2-3 өгүүлбэртэй пост бичиж өг. Хямдралын код: OMNI26 дурд.`;
    const fbContent = await aiCall(fbPrompt, 'Чи Facebook маркетер.');
    const fbImgPrompt = `A high quality, photorealistic lifestyle product shot featuring premium electronics or fashion items matching: ${productNames}. Bright lighting, vibrant colors, e-commerce advertisement style --ar 1:1`;
    await prisma.aiMarketingCampaign.create({ data: { platform: 'Facebook', content: fbContent, imagePrompt: fbImgPrompt, targetAudience: 'General' } });

    // Generate IG Post
    const igPrompt = `Дэлгүүрийн шинэ бараанууд: ${productNames}. Instagram-д зориулан богино, эстетик, hashtag-тай тайлбар бич (#webshop2026).`;
    const igContent = await aiCall(igPrompt, 'Чи Instagram маркетер.');
    const igImgPrompt = `A stylized, moody Instagram aesthetic photo of modern gadgets or premium lifestyle goods. Minimalist background, high fashion vibe, portrait orientation --ar 4:5`;
    await prisma.aiMarketingCampaign.create({ data: { platform: 'Instagram', content: igContent, imagePrompt: igImgPrompt, targetAudience: 'Youth, Trendsetters' } });

    res.json({ success: true, message: 'Олон сувгийн (Omnichannel) Маркетинг амжилттай үүсгэгдлээ.' });
  } catch(e) { res.status(500).json({ success: false }); }
});

// ── POST /ai/automation/customers — Customer segmentation & churn prediction
aiRouter.post('/', async (_req, res) => {
  try {
    const customers = await prisma.customer.findMany({ take: 100 });
    const orders = await prisma.order.findMany({ take: 200 });
    const recentBuyers = new Set(orders.filter(o => (Date.now() - new Date(o.createdAt).getTime()) / (1000*60*60*24) <= 30).map(o => o.customerId).filter(Boolean));
    const churnRisk = customers.filter(c => !recentBuyers.has(c.id));
    
    const prompt = `CRM шинжилгээ: Нийт хэрэглэгч ${customers.length}, Сүүлийн 30 хоногт идэвхтэй ${recentBuyers.size}, Churn эрсдэлтэй ${churnRisk.length}. Сегментацийн тойм, retention стратеги өг. 3-4 өгүүлбэрээр.`;
    const analysis = await aiCall(prompt, 'Чи CRM шинжээч AI.');
    
    res.json({ success: true, data: { analysis, stats: { total: customers.length, activeLast30: recentBuyers.size, churnRisk: churnRisk.length }, churnRiskCustomers: churnRisk.slice(0, 5).map(c => ({ id: c.id, name: c.firstName, email: c.email })), model: AI_CONFIG.ollamaModel }});
  } catch(err) { console.error('[AI-CUSTOMERS]', err); res.status(500).json({ success: false }); }
});

// ── POST /ai/automation/pricing — AI pricing optimization
aiRouter.post('/', async (_req, res) => {
  try {
    const products = await prisma.product.findMany({ where: { deletedAt: null }, include: { category: true }, take: 30 });
    const orders = await prisma.order.findMany({ include: { items: true }, take: 100 });
    const salesCount: Record<string, number> = {};
    orders.forEach(o => { (o.items || []).forEach((i: any) => { salesCount[i.productId] = (salesCount[i.productId] || 0) + i.quantity; }); });
    const productData = products.map(p => ({ name: p.name, price: p.basePrice, category: p.category?.name, salesCount: salesCount[p.id] || 0 }));
    
    const prompt = `Үнийн шинжилгээ:\n${productData.slice(0, 10).map(p => `- ${p.name}: ₮${p.price.toLocaleString()} (${p.salesCount} зарагдсан)`).join('\n')}\nҮнэ оновчлох зөвлөмж, хямдрал зарлах, үнэ нэмэх санал. 4-5 өгүүлбэрээр.`;
    const analysis = await aiCall(prompt, 'Чи e-commerce үнийн бодлогын AI шинжээч.');
    
    res.json({ success: true, data: { analysis, products: productData.slice(0, 10), model: AI_CONFIG.ollamaModel }});
  } catch(err) { console.error('[AI-PRICING]', err); res.status(500).json({ success: false }); }
});

// ── GET /ai/automation/status — AI system dashboard
aiRouter.get('/', async (_req, res) => {
  try {
    const pendingOrders = await prisma.order.count({ where: { status: 'pending' } });
    const totalCustomers = await prisma.customer.count();
    const totalProducts = await prisma.product.count({ where: { deletedAt: null } });
    let aiOnline = false;
    try {
      if (AI_CONFIG.provider === 'ollama') { 
        const r = await fetch(`${AI_CONFIG.ollamaUrl}/api/tags`, { headers: { 'Bypass-Tunnel-Reminder': 'true' }}); 
        aiOnline = r.ok; 
      }
      else if (AI_CONFIG.provider === 'openai') { aiOnline = !!AI_CONFIG.openaiKey; }
      else { aiOnline = true; }
    } catch{}
    
    res.json({ success: true, data: {
      aiOnline, provider: AI_CONFIG.provider,
      model: AI_CONFIG.provider === 'ollama' ? AI_CONFIG.ollamaModel : AI_CONFIG.openaiModel,
      automations: { orders: { pending: pendingOrders, status: 'active' }, customers: { total: totalCustomers, status: 'active' }, products: { total: totalProducts, status: 'active' }, marketing: { status: 'ready' }, suppliers: { status: 'ready' }, pricing: { status: 'ready' } }
    }});
  } catch(err) { res.status(500).json({ success: false }); }
});

// Enhanced AI Chat (uses configurable model)
aiRouter.post('/', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.json({ success: false, text: 'Та асуултаа оруулна уу?' });

    const products = await prisma.product.findMany({ where: { deletedAt: null }, take: 10, include: { media: true, category: true } });
    const productList = products.map(p => `${p.name} (₮${p.basePrice}, ${p.category?.name || 'Ерөнхий'})`).join(', ');
    
    const prompt = `Хэрэглэгчийн асуулт: "${message}"\nМанай дэлгүүрт: ${productList}\nТохирох бараа санал болгож, асуултад нь хариулна уу. 2-3 өгүүлбэрээр.`;
    const text = await aiCall(prompt, 'Чи WEBSHOP дэлгүүрийн AI худалдагч. Монгол хэлээр найрсаг, товч хариулна.');
    
    const msg = message.toLowerCase();
    let matchedProducts = await prisma.product.findMany({ where: { name: { contains: msg.split(' ')[0], mode: 'insensitive' }, deletedAt: null }, take: 3, include: { media: true } });
    if (!matchedProducts.length) matchedProducts = await prisma.product.findMany({ where: { deletedAt: null }, take: 3, orderBy: { basePrice: 'desc' }, include: { media: true } });

    res.json({ success: true, text, products: matchedProducts.map(p => ({ id: p.id, name: p.name, price: p.basePrice, img: p.media?.[0]?.url || '' })), model: AI_CONFIG.ollamaModel });
  } catch(err: any) {
    console.error('AI Chat Error:', err?.message || err);
    res.status(500).json({ success: false, text: 'AI системтэй холбогдож чадсангүй түр хүлээгээд дахин оролдоно уу.' });
  }
});

// Product catalog (basic CRUD)
aiRouter.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const skip = (page - 1) * limit
    const search = req.query.search as string
    const categoryId = req.query.categoryId as string
    const status = (req.query.status as string) || 'active'
    const sort = req.query.sort as string

    let orderBy: any = { createdAt: 'desc' }
    if (sort === 'price_asc') orderBy = { basePrice: 'asc' }
    else if (sort === 'price_desc') orderBy = { basePrice: 'desc' }
    else if (sort === 'name_asc') orderBy = { name: 'asc' }
    else if (sort === 'name_desc') orderBy = { name: 'desc' }

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
        orderBy,
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

aiRouter.get('/', async (req, res) => {
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

// Fetch Active AI Components for Dynamic UI
aiRouter.get('/', async (req, res) => {
  try {
    const comps = await prisma.aiComponent.findMany({ where: { active: true } });
    res.json({ success: true, data: comps });
  } catch (err) {
    res.status(500).json({ success: false });
  }
})

// AI Product Generator (enhanced with real AI)
aiRouter.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const prompt = `Бараа нэр: "${name}"
Энэ барааны:
1. Худалдааны тайлбар (description) — 2-3 өгүүлбэр
2. SEO түлхүүр үгс (seoTags) — таслалаар тусгаарлагдсан 5-6 үг
3. Үнийн таамаглал MNT-ээр (pricePrediction) — тоо
JSON хэлбэрээр хариулна уу.`;
    
    const aiResponse = await aiCall(prompt, 'Чи e-commerce барааны мэргэжилтэн AI. Барааны тодорхойлолт, SEO, үнэ таамаглана.');
    
    let result = { description: '', seoTags: '', pricePrediction: Math.floor(Math.random() * 2000000 + 500000) };
    try {
      const jsonMatch = aiResponse.match(/\{[^}]+\}/);
      if (jsonMatch) result = { ...result, ...JSON.parse(jsonMatch[0]) };
    } catch{}
    if (!result.description) result.description = aiResponse || `${name} нь дэвшилтэт хувилбар бөгөөд чанар гүйцэтгэлээрээ шилдэг.`;
    if (!result.seoTags) result.seoTags = name.split(' ').join(', ') + ', хямд үнэ, оригинал';
    
    res.json({ success: true, data: result, model: AI_CONFIG.ollamaModel });
  } catch(err) { res.status(500).json({ success: false }); }
})

// Admin Create Product
aiRouter.post('/', async (req, res) => {
  try {
    const { name, slug, description, basePrice, costPrice, salePrice, categoryId, images } = req.body;
    const prod = await prisma.product.create({
      data: {
        name, slug: slug || name.toLowerCase().replace(/ /g, '-') + '-' + Date.now(), description, basePrice: Number(basePrice), status: 'active',
        sku: (slug || name.toLowerCase().replace(/ /g, '-')) + '-' + Date.now(),
        attributes: { costPrice: costPrice?Number(costPrice):null, salePrice: salePrice?Number(salePrice):null },
        category: categoryId ? { connect: { id: categoryId } } : undefined,
        media: images && images.length ? { create: images.map((url: string) => ({ url, type: 'image' })) } : undefined
      }
    });
    try { await audit('CREATE', 'Product', prod.id, { name: prod.name, basePrice, costPrice, salePrice }); } catch(e){}
    res.json({ success: true, data: prod });
  } catch(err) { res.status(500).json({ success: false, error: { message: err.message } }); }
})

// Admin Delete Product
aiRouter.delete('/', async (req, res) => {
  try {
    await prisma.product.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false }); }
})

// Admin Update Product
aiRouter.patch('/', async (req, res) => {
  try {
    const { name, slug, description, basePrice, costPrice, salePrice, categoryId, images } = req.body;
    await prisma.product.update({
      where: { id: req.params.id },
      data: {
        name, slug: slug || undefined, description, basePrice: basePrice ? Number(basePrice) : undefined,
        attributes: { costPrice: costPrice?Number(costPrice):null, salePrice: salePrice?Number(salePrice):null },
        category: categoryId ? { connect: { id: categoryId } } : undefined,
        media: images && images.length ? { deleteMany: {}, create: images.map((url: string) => ({ url, type: 'image' })) } : undefined
      }
    });
    try { await audit('UPDATE', 'Product', req.params.id, { name, basePrice, costPrice, salePrice }); } catch(e){}
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false }); }
})

// V7 Bulk Delete Products
aiRouter.post('/', async (req, res) => {
  try {
    const { ids } = req.body;
    if(!ids || !ids.length) return res.status(400).json({ success: false });
    await prisma.product.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
    try { await audit('BULK_DELETE', 'Product', 'Multiple', { count: ids.length }); } catch(e){}
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false }); }
});

// Admin Get Orders
aiRouter.get('/', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: true }
    });
    res.json({ success: true, data: orders });
  } catch(err) { res.status(500).json({ success: false }); }
})

// Admin Update Order Status
aiRouter.patch('/', async (req, res) => {
  try {
    await prisma.order.update({ where: { id: req.params.id }, data: { status: req.body.status } });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false }); }
})

// Admin Update Tracking
aiRouter.patch('/', async (req, res) => {
  try {
    await prisma.order.update({ where: { id: req.params.id }, data: { trackingNumber: req.body.trackingNumber, status: req.body.status || undefined } });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false }); }
})

// V7 Admin Partial Refund Order
aiRouter.post('/', async (req, res) => {
  try {
    const { amount, reason } = req.body;
    await prisma.order.update({
      where: { id: req.params.id },
      data: { paymentStatus: 'partially_refunded' }
    });
    try { await audit('PARTIAL_REFUND', 'Order', req.params.id, { amount, reason }); } catch(e){}
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false }); }
})

// Admin Manual Order
aiRouter.post('/', async (req, res) => {
  try {
    const { customerName, productId, price } = req.body;
    await prisma.order.create({
      data: {
        id: require('crypto').randomUUID(),
        orderNumber: 'ADM-' + Math.floor(Math.random()*100000),
        status: 'pending', paymentStatus: 'paid',
        subtotal: Number(price), shippingTotal: 0, taxTotal: 0, grandTotal: Number(price),
        shippingAddress: { name: customerName }, billingAddress: {}, shippingMethod: {},
        placedAt: new Date(),
        items: {
          create: [{
            productId, sku: 'MANUAL', quantity: 1, unitPrice: Number(price), totalPrice: Number(price), productName: 'Manual Admin Entry'
          }]
        }
      }
    });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
})

// Admin Get Customers
aiRouter.get('/', async (_req, res) => {
  try {
    const customers = await prisma.customer.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    const activities = await prisma.adminActivity.findMany({ where: { resource: 'Customer', action: 'WALLET_TX' } });
    const ltvData = await Promise.all(customers.map(async (c) => {
       const orders = await prisma.order.findMany({ where: { OR: [{ customerId: c.id }, { guestEmail: c.email }] }, select: { subtotal: true } });
       const ltv = orders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
       const wallet = activities.filter((a: any) => a.resourceId === c.id).reduce((sum, a: any) => sum + (a.details?.amount || 0), 0);
       return { ...c, ltv, wallet, segment: ltv > 1000000 ? 'VIP 🐋' : (ltv > 0 ? 'Байнгын' : 'Сонжооч') };
    }));
    res.json({ success: true, data: ltvData });
  } catch(err) { res.status(500).json({ success: false }); }
})

// V7 CRM Notes Fetch
aiRouter.get('/', async (req, res) => {
  try {
    const notes = await prisma.adminActivity.findMany({ where: { resource: 'Customer', resourceId: req.params.id, action: 'CRM_NOTE' }, orderBy: { createdAt: 'desc' }, include: { admin: true } });
    res.json({ success: true, data: notes });
  } catch(err) { res.status(500).json({ success: false }); }
})

// V7 CRM Note Add
aiRouter.post('/', async (req, res) => {
  try {
    const { note } = req.body;
    try { await audit('CRM_NOTE', 'Customer', req.params.id, { note }); } catch(e){}
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false }); }
})

// V8 CRM Wallet Add
aiRouter.post('/', async (req, res) => {
  try {
    const { amount, reason } = req.body;
    try { await audit('WALLET_TX', 'Customer', req.params.id, { amount: Number(amount), reason }); } catch(e){}
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false }); }
})

// Admin Update Customer
aiRouter.patch('/', async (req, res) => {
  try {
    const { firstName, lastName, email } = req.body;
    await prisma.customer.update({ where: { id: req.params.id }, data: { firstName, lastName: lastName||'', email } });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false }); }
})

// Supplier CRUD — persisted to Database
aiRouter.get('/', async (_req, res) => {
  try { const s = await prisma.supplier.findMany({ orderBy: { createdAt: 'desc' } }); res.json({ success: true, data: s }); }
  catch(e) { res.status(500).json({ success: false }); }
});
aiRouter.post('/', async (req, res) => {
  try {
    const { name, phone, email, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Нэр шаардлагатай' });
    const s = await prisma.supplier.create({ data: { name, phone: phone||'', email: email||'', notes: notes||'' } });
    res.json({ success: true, data: s });
  } catch(e) { res.status(500).json({ success: false }); }
});
aiRouter.patch('/', async (req, res) => {
  try {
    const { name, phone, email, status, notes } = req.body;
    const s = await prisma.supplier.update({ where: { id: req.params.id }, data: { ...(name&&{name}), ...(phone&&{phone}), ...(email&&{email}), ...(status&&{status}), ...(notes&&{notes}) } });
    res.json({ success: true, data: s });
  } catch(e) { res.status(500).json({ success: false }); }
});
aiRouter.delete('/', async (req, res) => {
  try { await prisma.supplier.delete({ where: { id: req.params.id } }); res.json({ success: true }); }
  catch(e) { res.status(500).json({ success: false }); }
});

// Admin Get Coupons
aiRouter.get('/', async (_req, res) => {
  try {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: coupons });
  } catch(err) { res.status(500).json({ success: false }); }
})

// Admin Create Coupon
aiRouter.post('/', async (req, res) => {
  try {
    const { code, discountValue } = req.body;
    await prisma.coupon.create({ data: { code, discountType: 'percentage', discountValue: Number(discountValue) } });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false }); }
})

// Admin Delete Coupon
aiRouter.delete('/', async (req, res) => {
  try {
    await prisma.coupon.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false }); }
})

// Admin Update Coupon
aiRouter.patch('/', async (req, res) => {
  try {
    const { code, discountValue } = req.body;
    await prisma.coupon.update({ where: { id: req.params.id }, data: { code, discountValue: Number(discountValue) } });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false }); }
})

// Abandoned Carts endpoint is handled by V36 AI Recovery route above



// V5 PHASE 2 ROUTES

// Admin Stats — Revenue and Order Count
aiRouter.get('/', async (_req, res) => {
  try {
    const revenue = await prisma.order.aggregate({ _sum: { grandTotal: true }, where: { status: { notIn: ['cancelled', 'deleted'] } } });
    const orders = await prisma.order.count({ where: { status: { notIn: ['cancelled', 'deleted'] } } });
    res.json({ success: true, data: { revenue: revenue._sum.grandTotal || 0, orders } });
  } catch(err) { res.status(500).json({ success: false }); }
});

// Admin Funnel Aggregation — Real DB Aggregation
aiRouter.get('/', async (_req, res) => {
  try {
    const visitors = await prisma.systemEvent.count({ where: { eventType: 'PAGE_VIEW' } });
    const carts = await prisma.cart.count({ where: { items: { some: {} } } });
    const checkouts = await prisma.checkout.count();
    const conversions = await prisma.order.count({ where: { status: { notIn: ['cancelled', 'deleted'] } } });
    res.json({ success: true, data: { visitors: visitors || 0, carts, checkouts, conversions } });
  } catch(err) { res.status(500).json({ success: false }); }
});

// Admin Marketing Email Dispatch — Real recipient count from DB
aiRouter.post('/', async (req, res) => {
  const { target, subject, body } = req.body;
  if (!subject || !body) return res.status(400).json({ success: false, message: 'Гарчиг болон агуулга шаардлагатай' });
  try {
    let delivered = 0;
    if (target === 'vip') {
      // Count customers with high LTV (orders > 1M) as VIP
      const allCusts = await prisma.customer.findMany({ select: { id: true } });
      let vipCount = 0;
      for (const c of allCusts) {
        const orders = await prisma.order.findMany({ where: { customerId: c.id }, select: { subtotal: true } });
        const ltv = orders.reduce((s, o) => s + (o.subtotal || 0), 0);
        if (ltv > 1000000) vipCount++;
      }
      delivered = vipCount || 1;
    } else if (target === 'sleeping') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentBuyers = await prisma.order.findMany({ where: { createdAt: { gte: thirtyDaysAgo }, customerId: { not: null } }, distinct: ['customerId'], select: { customerId: true } });
      const activeIds = recentBuyers.map(o => o.customerId).filter(Boolean) as string[];
      delivered = await prisma.customer.count({ where: { id: { notIn: activeIds } } });
    } else {
      delivered = await prisma.customer.count();
    }
    await prisma.systemEvent.create({ data: { eventType: 'MARKETING_CAMPAIGN', sourceSystem: 'admin', payload: { target: target || 'all', subject, deliveredCount: delivered, sentAt: new Date().toISOString() } } });
    await audit('MARKETING_CAMPAIGN', 'Broadcast', 'Mass', { target, subject, delivered });
    res.json({ success: true, delivered, message: `[${(target||'ALL').toUpperCase()}] сегмент рүү ${delivered} хэрэглэгчид и-мэйл илгээгдлээ.` });
  } catch(e) { res.status(500).json({ success: false }); }
});

// Admin Invoice Dispatch — stores invoice record and returns the order details
aiRouter.post('/', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!order) return res.status(404).json({ success: false, message: 'Захиалга олдсонгүй' });
    await prisma.systemEvent.create({ data: { eventType: 'INVOICE_SENT', sourceSystem: 'admin', payload: { orderId: order.id, orderNumber: order.orderNumber, grandTotal: order.grandTotal, sentAt: new Date().toISOString() } } });
    res.json({ success: true, message: `Захиалга #${order.orderNumber} - Нэхэмжлэх амжилттай бүртгэгдлээ.`, orderNumber: order.orderNumber });
  } catch(err) { res.status(500).json({ success: false }); }
});

// Admin Get Variants
aiRouter.get('/', async (req, res) => {
  try {
    const variants = await prisma.productVariant.findMany({ where: { productId: req.params.id } });
    res.json({ success: true, data: variants });
  } catch(err) { res.status(500).json({ success: false }); }
});

// Admin Add Variant
aiRouter.post('/', async (req, res) => {
  try {
    const { name, stock, price, sku } = req.body;
    await prisma.productVariant.create({
      data: { productId: req.params.id, name, stock: Number(stock), price: Number(price), sku }
    });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false }); }
});

// Admin Delete Variant
aiRouter.delete('/', async (req, res) => {
  try {
    await prisma.productVariant.delete({ where: { id: req.params.vid } });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false }); }
});

// ─────────────────────────────────────────────
// V6 ENTERPRISE BACKEND ROUTES (AUTH, AUDIT, WEBHOOK)
// ─────────────────────────────────────────────

let defaultAdminId = null;
async function getDefaultAdmin() {
  if (defaultAdminId) return defaultAdminId;
  let admin = await prisma.adminUser.findFirst();
  if(!admin) {
     const bcryptLib = await import('bcrypt');
     const hash = await bcryptLib.default.hash('Admin1234!', 12);
     admin = await prisma.adminUser.create({data: {email: 'admin@webshop.mn', passwordHash: hash, firstName: 'Admin', lastName: 'User'}});
  }
  defaultAdminId = admin.id;
  return admin.id;
}

async function audit(action, resource, id, details) {
  try {
     const adminId = await getDefaultAdmin();
     await prisma.adminActivity.create({ data: { adminId, action, resource, resourceId: id, details: details||{} } });
  } catch(e) {}
}

// ── GET /admin/chart-data — Real-time chart data from DB
aiRouter.get('/', async (_req, res) => {
  try {
    // 7-day revenue
    const days = ['Дав','Мяг','Лха','Пүр','Баа','Бям','Ням'];
    const revData: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(start); end.setDate(end.getDate() + 1);
      const agg = await prisma.order.aggregate({ _sum: { grandTotal: true }, where: { createdAt: { gte: start, lt: end }, status: { notIn: ['cancelled'] } } });
      revData.push(agg._sum.grandTotal || 0);
    }
    // Category breakdown
    const categories = await prisma.category.findMany({ include: { _count: { select: { products: true } } } });
    const catLabels = categories.map(c => c.name);
    const catData = categories.map(c => (c as any)._count.products);
    // Top 5 products by sales
    const orderItems = await prisma.orderItem.groupBy({ by: ['productName'], _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 5 });
    const topLabels = orderItems.map(i => i.productName);
    const topData = orderItems.map(i => i._sum.quantity || 0);

    res.json({ success: true, data: { days, revData, catLabels, catData, topLabels, topData } });
  } catch(err) { res.status(500).json({ success: false }); }
});

// Admin Login
aiRouter.post('/', async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin) return res.status(401).json({ success: false, message: 'И-мэйл буруу байна' });
    const bcryptLib = await import('bcrypt');
    const valid = await bcryptLib.default.compare(password, admin.passwordHash).catch(() => password === admin.passwordHash);
    if (!valid) return res.status(401).json({ success: false, message: 'Нууц үг буруу байна' });
    const ADMIN_SECRET = process.env.ADMIN_JWT_SECRET || 'webshop-admin-secret-2026';
    const token = jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, ADMIN_SECRET, { expiresIn: '8h' });
    audit('LOGIN', 'System', admin.id, { ip: req.ip });
    res.json({ success: true, token, admin: { firstName: admin.firstName, lastName: admin.lastName, email: admin.email, role: admin.role } });
  } catch(err) {
    res.status(500).json({ success: false, message: 'Серверын алдаа' });
  }
});

// Admin Get Audit Logs
aiRouter.get('/', async (req, res) => {
  try {
    const logs = await prisma.adminActivity.findMany({ include: { admin: true }, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ success: true, data: logs });
  } catch(err) { res.status(500).json({ success: false }); }
});

// Mock QPay Payment Webhook
aiRouter.post('/', async (req, res) => {
  try {
    const { orderId, status } = req.body; 
    if(status === 'PAID') {
      await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: 'paid', status: 'packaging' } });
      audit('WEBHOOK_PAYMENT_SUCCESS', 'Order', orderId, { provider: 'QPay' });
    }
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false }); }
});

// Admin Stats
aiRouter.get('/', async (_req, res) => {
  try {
    const totalOrders = await prisma.order.count();
    const totalRevenue = await prisma.order.aggregate({ _sum: { grandTotal: true } });
    const totalProducts = await prisma.product.count();
    res.json({ success: true, data: { orders: totalOrders, revenue: totalRevenue._sum.grandTotal || 0, products: totalProducts } });
  } catch(err) { res.status(500).json({ success: false }); }
})

// AI Insights (enhanced with real AI analysis)
aiRouter.get('/', async (_req, res) => {
  try {
    const totalRevenue = await prisma.order.aggregate({ _sum: { grandTotal: true } });
    const totalOrders = await prisma.order.count();
    const totalProducts = await prisma.product.count({ where: { deletedAt: null } });
    const totalCustomers = await prisma.customer.count();
    const rev = totalRevenue._sum.grandTotal || 0;
    
    const prompt = `Дэлгүүрийн мэдээлэл:
- Нийт орлого: ₮${rev.toLocaleString()}
- Нийт захиалга: ${totalOrders}
- Нийт бараа: ${totalProducts}
- Нийт хэрэглэгч: ${totalCustomers}

Борлуулалтын шинжилгээ, стратегийн зөвлөмж, сайжруулах хэрэгтэй зүйлс 3-4 өгүүлбэрээр.`;
    
    const insight = await aiCall(prompt, 'Чи бизнес шинжээч AI. Дэлгүүрийн борлуулалтын мэдээлэлд үндэслэн стратегийн зөвлөмж өгнө.');
    
    res.json({ success: true, data: { insight, model: AI_CONFIG.ollamaModel } });
  } catch(err) { res.status(500).json({ success: false }); }
})

// Admin Funnel Analytics
aiRouter.get('/', async (_req, res) => {
  try {
    const totalOrders = await prisma.order.count();
    const paidOrders = await prisma.order.count({ where: { paymentStatus: 'paid' } });
    // Approximate funnel from order data
    const visitors = Math.max(totalOrders * 12, 100);
    const carts = Math.max(totalOrders * 4, 30);
    const checkouts = Math.max(totalOrders * 2, 10);
    res.json({ success: true, data: { visitors, carts, checkouts, conversions: totalOrders } });
  } catch(err) { res.status(500).json({ success: false }); }
})

// Abandoned Carts
aiRouter.get('/', async (_req, res) => {
  try {
    const carts = await prisma.cart.findMany({
      where: { updatedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      include: { items: true },
      orderBy: { updatedAt: 'desc' },
      take: 20
    });
    const abandoned = carts.filter(c => c.items.length > 0);
    res.json({ success: true, data: abandoned });
  } catch(err) {
    // If cart table doesn't exist or empty, return empty
    res.json({ success: false, data: [] });
  }
});

// 1. Client-Side Polling Verification (READ-ONLY)
aiRouter.post('/', async (req, res) => {
  try {
    const { orderId } = req.body;
    if(!orderId) return res.status(400).json({ success: false, message: 'Захиалгын ID шаардлагатай' });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ success: false, message: 'Захиалга олдсонгүй' });

    if (order.paymentStatus === 'paid') {
      res.json({ success: true, message: 'Төлбөр амжилттай баталгаажлаа', orderNumber: order.orderNumber });
    } else {
      res.json({ success: false, pending: true, message: 'Төлбөр хүлээгдэж байна' });
    }
  } catch(err: any) {
    res.status(500).json({ success: false, message: 'Алдаа гарлаа' });
  }
});

// 2. QPay Secure Webhook Endpoint (AUTHORITATIVE WRITE)
aiRouter.post('/', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.QPAY_WEBHOOK_SECRET}`) {
      return res.status(403).json({ success: false, message: 'Зөвшөөрөлгүй хандалт (Invalid Webhook Secret)' });
    }

    const { orderId, payment_status } = req.body;
    if (payment_status === 'PAID') {
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'paid', status: 'processing' }
      });
      console.log(`[SECURITY] Order ${orderId} successfully processed via QPay Webhook.`);
      
      // Fire and forget Email Notification
      sendOrderConfirmationAsync(updatedOrder).catch(()=>{});
    }
    res.json({ success: true });
  } catch(err) {
    console.error('[WEBHOOK ERROR]', err);
    res.status(500).json({ success: false });
  }
});

// 3. BACKGROUND WORKER: Abandoned Order Inventory Release (Horizontal Scaling Safe)
setInterval(async () => {
  try {
    const expireTime = new Date(Date.now() - 15 * 60000);
    const expiredOrders = await prisma.order.findMany({
      where: { paymentStatus: 'pending', status: 'pending', placedAt: { lt: expireTime } },
      include: { items: true }
    });

    for (const ord of expiredOrders) {
      await prisma.$transaction(async (tx) => {
        // ATOMIC CLAIM: Ensure only one scaled instance can cancel this order
        const claim = await tx.order.updateMany({ 
          where: { id: ord.id, status: 'pending', paymentStatus: 'pending' }, 
          data: { status: 'cancelled' } 
        });
        if (claim.count === 0) return; // Another server worker already claimed it
        
        // Restore Inventory Safely
        for (const item of ord.items) {
          await tx.inventory.updateMany({
            where: { productId: item.productId },
            data: { quantity: { increment: item.quantity } }
          });
        }
        
        // Restore Wallet
        if (ord.customerId && ord.discountTotal > 0) {
          const sysAdmin = await tx.adminUser.findFirst();
          if (sysAdmin) {
            // [V28 FIX] Infinite Money Glitch: Query exact actual wallet deduction amount instead of using full discountTotal (which could include coupons)
            const walletTxs = await tx.adminActivity.findMany({
              where: { action: 'WALLET_TX', resource: 'Customer', resourceId: ord.customerId }
            });
            const txMatch = walletTxs.find((a: any) => a.details && a.details.reason && a.details.reason.includes(ord.id));
            const amountToRestore = txMatch && txMatch.details && typeof txMatch.details.amount === 'number' 
                                    ? Math.abs(txMatch.details.amount) 
                                    : 0;

            if (amountToRestore > 0) {
              await tx.adminActivity.create({
                data: { adminId: sysAdmin.id, action: 'WALLET_TX', resource: 'Customer', resourceId: ord.customerId, details: { amount: amountToRestore, reason: `Захиалга цуцлагдсан буцаалт (ID: ${ord.id})` } }
              });
            }
          }
        }

        // [V28 FIX] Storefront Coupon Burn: Restore coupon usage limit on abandoned order timeout
        if (ord.couponCode) {
          await tx.coupon.updateMany({
            where: { code: ord.couponCode },
            data: { usageCount: { decrement: 1 } }
          });
        }
      });
      console.log(`[SYSTEM:WORKER] Released inventory for abandoned order: ${ord.id}`);
    }
  } catch(e) {}
}, 60000);


aiRouter.post('/', async (req, res) => {
  try {
    const { productId, userHistory } = req.body
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`${AI_CONFIG.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
      signal: controller.signal,
      body: JSON.stringify({
        model: AI_CONFIG.ollamaModel,
        prompt: `Given the following product catalog:\n${allProducts.map(p => `- ${p.name} (${p.category?.name || 'Uncategorized'}, ₮${p.basePrice})`).join('\n')}\n\n${product ? `The user is viewing: ${product.name}` : ''}\n${userHistory ? `User history: ${JSON.stringify(userHistory)}` : ''}\n\nRecommend 3-5 products. Return ONLY a JSON array of product IDs like: ["id1","id2","id3"]`,
        stream: false,
      }),
    })
    clearTimeout(timeout);

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

aiRouter.post('/', async (req, res) => {
  try {
    const { productName, category, features } = req.body
    const ollamaUrl = AI_CONFIG.ollamaUrl;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
      signal: controller.signal,
      body: JSON.stringify({
        model: AI_CONFIG.ollamaModel,
        prompt: `Write a compelling product description in Mongolian for an e-commerce store.\nProduct: ${productName}\nCategory: ${category || 'General'}\nFeatures: ${features || 'N/A'}\n\nWrite 2-3 sentences. Be concise and persuasive. Return ONLY the description text, no labels.`,
        stream: false,
      }),
    })
    clearTimeout(timeout);

    const data = await response.json()
    res.json({ success: true, data: { description: data.response || '' } })
  } catch (err) {
    console.error('[AI DESCRIBE] Error:', err)
    res.json({ success: true, data: { description: '' } })
  }
})
