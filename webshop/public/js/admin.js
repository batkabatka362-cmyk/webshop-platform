
const API = ''; // Use relative paths
let ALL_PRODS = [], cats = [], ALL_CUS = [], ALL_CP = [], ALL_SUP = [];
let editingId = null;
let editingTrackId = null;
let activeVariantProductId = null;

// V6 FETCH INTERCEPTOR
const origFetch = window.fetch.bind(window);
window.fetch = async function(url, config) {
  if(!config) config = {};
  if(!config.headers) config.headers = {};
  const t = localStorage.getItem('ws_token');
  if(t) config.headers['Authorization'] = `Bearer ${t}`;
  return origFetch(url, config);
};

// V6 AUTH LOGIN
async function doLogin() {
  const e=document.getElementById('l-email').value, p=document.getElementById('l-pass').value;
  try {
    const r = await origFetch(API+'/api/v1/auth/admin/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e,password:p})});
    const d = await r.json();
    if(d.success) {
      localStorage.setItem('ws_token', d.token);
      document.getElementById('login-screen').style.display='none';
      showT('Системд амжилттай нэвтэрлээ!');
      initApp();
    } else showT(d.message || 'Нэвтрэх эрхгүй байна!');
  }catch{ showT('Сервертэй холбогдох боломжгүй байна'); }
}

// V6 AUDIT LOGS
async function loadLogs() {
  try {
    const r=await window.fetch(API+'/api/v1/admin/logs'); const d=await r.json();
    document.getElementById('ltbody').innerHTML=d.data.map(l=>`<tr><td style="color:var(--dim);font-size:13px">${new Date(l.createdAt).toLocaleString()}</td><td><span style="font-weight:600;padding:4px 8px;background:var(--smoke);border-radius:4px;font-size:12px">${l.action}</span></td><td>${l.resource}</td><td style="font-size:12px;font-family:monospace">${l.resourceId||'-'} <br><span style="color:var(--dim)">${JSON.stringify(l.details)}</span></td></tr>`).join('');
  } catch{}
}

// Routing
const ALL_TABS = ['products', 'orders', 'customers', 'abandoned', 'marketing', 'coupons', 'suppliers', 'logs', 'settings', 'ai', 'conglomerate'];
function switchTab(t) {
  ALL_TABS.forEach(x => { document.getElementById('nt-'+x).classList.remove('active'); document.getElementById('view-'+x).style.display = 'none'; });
  document.getElementById('nt-'+t).classList.add('active'); document.getElementById('view-'+t).style.display = 'block';
  
  if(t === 'products') loadProds();
  if(t === 'orders') { loadOrders(); loadStats(); loadProds(); loadFunnel(); }
  if(t === 'settings') loadSettings();
  if(t === 'customers') loadCus();
  if(t === 'coupons') loadCp();
  if(t === 'suppliers') loadSup();
  if(t === 'abandoned') loadAband();
  if(t === 'logs') loadLogs();
  if(t === 'ai') loadAiStatus();
  if(t === 'conglomerate') { document.getElementById('ai-conglomerate-promos').innerHTML='Уншиж байна...'; document.getElementById('ai-conglomerate-products').innerHTML='Уншиж байна...'; loadConglomerate(); }
}
function showT(m){ const e = document.getElementById('toast'); e.textContent = m; e.classList.add('on'); setTimeout(()=>e.classList.remove('on'), 3500); }

// Generic Fetcher logic
async function loadProds() {
  try {
    const r=await fetch(API+'/api/v1/products?limit=100'); const d=await r.json();
    if(d.success) {
      ALL_PRODS = d.data.items;
      const totalValuation = ALL_PRODS.reduce((sum, p) => sum + ((p.attributes?.costPrice || p.basePrice) * 50), 0); // Mocking 50 units avg stock per item
      document.getElementById('p-valuation').innerHTML = `📦 Агуулахын нийт хөрөнгө: <span style="color:#16a34a;font-size:18px">₮${totalValuation.toLocaleString()}</span>`;
      document.getElementById('tbody').innerHTML = ALL_PRODS.map(p=>{
        const cb = p.basePrice || 0; const cc = p.attributes?.costPrice || 0; const mrgn = (cb && cc) ? Math.round(((cb - cc) / cb) * 100) : 0;
        const prcHtml = `₮${cb.toLocaleString()}<br><span style="color:${mrgn>0?'#16a34a':mrgn<0?'#ef4444':'var(--dim)'};font-size:12px;font-family:sans-serif">Ашиг: ${mrgn}% (₮${(cb-cc).toLocaleString()})</span>`;
        return `<tr><td><input type="checkbox" class="chk-prod" value="${p.id}"></td><td><img src="${p.media?.[0]?.url||'https://via.placeholder.com/44'}" class="p-img"></td><td style="font-weight:600">${p.name}</td><td>${p.category?.name||'Eрөнхий'}</td><td style="font-family:monospace">${prcHtml}</td><td><button class="btn-ghost" onclick="openVarM('${p.id}')">🛒 Хувилбар</button> <button class="btn-ghost" onclick="editP('${p.id}')" style="margin-left:8px">Засах</button> <button class="btn-ghost del-btn" onclick="delP('${p.id}')">Устгах</button></td></tr>`;
      }).join('');
      document.getElementById('mo-prod').innerHTML = ALL_PRODS.map(p=>`<option value="${p.id}" data-price="${p.basePrice}">${p.name} (₮${p.basePrice})</option>`).join('');
    }
  } catch{}
}

// AI Engine JS logic
async function loadAiStatus() {
  try {
    const r=await fetch(API+'/api/v1/ai/automation/status'); const d=await r.json();
    if(d.success) {
      document.getElementById('ai-model-name').textContent = d.data.model.toUpperCase() + ' (' + d.data.provider + ')';
      const stat = document.getElementById('ai-status-text');
      if(d.data.aiOnline) { stat.textContent = '● Систем хэвийн (Online)'; stat.style.color = '#10b981'; }
      else { stat.textContent = '● Систем холбогдсонгүй (Унасан эсвэл Mock)'; stat.style.color = '#f59e0b'; }
      document.getElementById('ai-provider').value = d.data.provider;
      document.getElementById('ai-model-input').value = d.data.model;
    }
  } catch{}
  
  // Load Agents State
  try {
    const r2 = await fetch(API+'/api/v1/ai/agents/state'); const d2 = await r2.json();
    if(d2.success) {
      document.getElementById('ai-watcher-toggle').checked = d2.active;
      
      // Update Budget
      document.getElementById('ai-budget-display').textContent = '₮' + d2.budget.toLocaleString();
      
      // Update Experiments
      const expBox = document.getElementById('ai-experiments-list');
      const esc = s => (s||'').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if(d2.experiments && d2.experiments.length) {
        let eh = '';
        d2.experiments.forEach(e => eh += `<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--smoke)">[<span style="color:#ef4444">${esc(e.status)}</span>] <b>${esc(e.title)}:</b> ${esc(e.hypothesis)} (Зарцуулсан: ₮${e.cost})</div>`);
        expBox.innerHTML = eh;
      } else {
        expBox.textContent = "Идэвхтэй туршилт алга. AI таамаглал дэвшүүлээгүй байна.";
      }

      // Update Memory & Logs
      const memBox = document.getElementById('ai-memory-list');
      if(d2.memory.length || d2.logs.length) {
        let h = '';
        d2.memory.forEach(m => h += `<div style="margin-bottom:4px"><span style="color:#9ca3af">[${new Date(m.createdAt).toLocaleTimeString()}]</span> <span style="color:#3b82f6">[MEMORY:${m.type}]</span> ${esc(m.context)}</div>`);
        d2.logs.forEach(l => h += `<div style="margin-bottom:4px"><span style="color:#9ca3af">[${new Date(l.createdAt).toLocaleTimeString()}]</span> <span style="color:#8b5cf6">[ACTION:${l.agent}]</span> ${esc(l.action)} -&gt; ${esc(JSON.stringify(l.details))}</div>`);
        memBox.innerHTML = h;
      } else {
        memBox.innerHTML = "<div>SYSTEM INITIALIZED. NO MEMORY FOUND.</div>";
      }
    }
  } catch{}
}
async function loadConglomerate() {
  try {
    const r3 = await fetch(API+'/api/v1/ai/conglomerate/status');
    const d3 = await r3.json();
    if(d3.success) {
      const pcBox = document.getElementById('ai-conglomerate-promos');
      const prBox = document.getElementById('ai-conglomerate-products');
      
      if (d3.data.roi) {
        document.getElementById('cg-roi-revenue').textContent = '₮' + d3.data.roi.totalAiRevenue.toLocaleString();
        document.getElementById('cg-roi-conversion').textContent = d3.data.roi.conversionRate + '%';
        document.getElementById('cg-roi-promos').textContent = `(${d3.data.roi.usedPromosCount} / ${d3.data.roi.totalPromos})`;
        document.getElementById('cg-roi-products').textContent = d3.data.aiProducts ? d3.data.aiProducts.length : 0;
      }
      
      if(d3.data.aiPromos && d3.data.aiPromos.length) {
        pcBox.innerHTML = d3.data.aiPromos.map(x => `<div style="padding:12px;margin-bottom:8px;border-radius:6px;background:rgba(255,255,255,0.05);border-left:3px solid #7c3aed"><b style="color:#7c3aed;font-size:14px">${x.code}</b> <span style="margin-left:8px;background:#7c3aed;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px">-${x.discountPct}%</span><br><div style="color:var(--dim);margin-top:4px">Дуусах: ${new Date(x.expiresAt).toLocaleString()} | Ашигласан: ${x.isUsed ? '<span style="color:#10b981">Тийм</span>' : 'Үгүй'}</div></div>`).join('');
      } else { pcBox.innerHTML = '<div style="color:var(--dim)">AI одоогоор ямар нэг хямдралын код үүсгээгүй байна.</div>'; }
      
      if(d3.data.aiProducts && d3.data.aiProducts.length) {
        prBox.innerHTML = d3.data.aiProducts.map(x => `<div style="padding:12px;margin-bottom:8px;border-radius:6px;background:rgba(255,255,255,0.05);border-left:3px solid #10b981"><b style="color:#10b981;font-size:14px">${x.name}</b> <span style="margin-left:8px;color:var(--bone)">₮${x.basePrice.toLocaleString()}</span><br><div style="color:var(--dim);margin-top:4px">SKU: ${x.sku} <br> SEO: ${x.seoTags || 'Хоосон'}</div></div>`).join('');
      } else { prBox.innerHTML = '<div style="color:var(--dim)">AI одоогоор шинэ бараа зохион бүтээгээгүй байна.</div>'; }
    }
  } catch{}
}
async function toggleAiWatcher() {
  const on = document.getElementById('ai-watcher-toggle').checked;
  try {
    const r = await fetch(API+'/api/v1/ai/agents/toggle', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({on})});
    const d = await r.json();
    showT(d.message);
  } catch{ showT('Алдаа гарлаа'); }
}
async function executeAiCommand() {
  const inp = document.getElementById('ai-commander-input');
  const prompt = inp.value.trim();
  if(!prompt) return;
  const memBox = document.getElementById('ai-memory-list');
  memBox.innerHTML += `<div style="color:#fff;margin-top:12px">&gt; EXEC: ${prompt}</div>`;
  memBox.scrollTop = memBox.scrollHeight;
  inp.value = '';
  inp.disabled = true;
  memBox.innerHTML += `<div id="ai-cmd-loading" style="color:#eab308">Команд биелүүлж байна (Awaiting connection...)...</div>`;
  try {
    const r = await fetch(API+'/api/v1/ai/agents/command', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})});
    const d = await r.json();
    if(document.getElementById('ai-cmd-loading')) document.getElementById('ai-cmd-loading').remove();
    memBox.innerHTML += `<div style="color:${d.success ? '#22c55e' : '#ef4444'};margin-bottom:12px">[RESPONSE]: ${d.message}</div>`;
    memBox.scrollTop = memBox.scrollHeight;
  } catch {
    if(document.getElementById('ai-cmd-loading')) document.getElementById('ai-cmd-loading').remove();
    memBox.innerHTML += `<div style="color:#ef4444">[ERROR]: Холболт салсан эсвэл алдаа гарлаа.</div>`;
  }
  inp.disabled = false;
  inp.focus();
}

async function updAiConfig() {
  const p = document.getElementById('ai-provider').value;
  const m = document.getElementById('ai-model-input').value;
  try {
    const r=await fetch(API+'/api/v1/ai/config', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:p, model:m})});
    const d=await r.json();
    if(d.success) { showT('AI Модел шинэчлэгдлээ!'); loadAiStatus(); }
  } catch{}
}
async function runAiBot(type) {
  showT('AI бодож байна...');
  document.getElementById('ai-'+type+'-res').textContent = 'Уншиж байна... (Түр хүлээнэ үү)';
  if (type === 'marketing') document.getElementById('ai-marketing-res').style.display='block';
  try {
    let body = {};
    if (type === 'marketing') body = {target: document.getElementById('ai-mk-target').value, goal: document.getElementById('ai-mk-goal').value};
    const r=await fetch(API+'/api/v1/ai/automation/'+type, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d=await r.json();
    if(d.success) {
      if(type==='marketing') {
        const c = d.data.campaign;
        document.getElementById('ai-marketing-res').innerHTML = `<b>Subject:</b> ${c.subject}<br><b>Discount:</b> ${c.discountPercent}%<br><br>${c.body.replace(/\n/g, '<br>')}`;
      } else {
        document.getElementById('ai-'+type+'-res').innerHTML = d.data.analysis.replace(/\n/g, '<br>');
        if(type==='orders') showT(`Хүлээгдэж буй захиалгуудаас ${d.data.stats?.autoProcessed||0} савлагдах руу автоматаар шилжлээ.`);
      }
    } else {
      document.getElementById('ai-'+type+'-res').textContent = 'Алдаа гарлаа.';
    }
  } catch(err) { document.getElementById('ai-'+type+'-res').textContent = 'Сүлжээний алдаа.'; showT('Сүлжээний алдаа'); }
}

let ALL_ORDERS = [];
async function loadOrders() {
  try {
    const r=await fetch(API+'/api/v1/orders'); const d=await r.json(); const tb = document.getElementById('otbody');
    if(d.success && d.data.length) {
      ALL_ORDERS = d.data;
      tb.innerHTML = ALL_ORDERS.map(o=>`<tr><td style="color:var(--dim);font-size:13px">${new Date(o.createdAt).toLocaleString()}</td><td style="font-weight:500">${o.shippingAddress?.name || 'Систем зочин'}</td><td style="font-size:13px;max-width:160px;text-overflow:ellipsis;white-space:nowrap;overflow:hidden">${o.items?.[0]?.productName || 'Бараа'}</td><td style="font-weight:600;font-family:monospace">₮${(o.grandTotal||o.subtotal||0).toLocaleString()}</td><td><div style="background:${o.status==='DELIVERED'?'#dcfce7':o.status==='CANCELLED'?'#fee2e2':'#fef3c7'};color:${o.status==='DELIVERED'?'#166534':o.status==='CANCELLED'?'#991b1b':'#d97706'};padding:4px 8px;border-radius:4px;font-size:12px;font-weight:600;display:inline-block;margin-bottom:4px">${o.status}</div><div style="font-size:11px;color:var(--dim);white-space:nowrap">${o.trackingNumber?('Трак: '+o.trackingNumber):'Кодгүй'}</div><br><span style="font-size:10px;color:${o.paymentStatus==='paid'?'#16a34a':o.paymentStatus==='partially_refunded'?'#ef4444':'#d97706'}">Төлбөр: ${o.paymentStatus==='paid'?'✅ Төлөгдсөн':o.paymentStatus}</span></td><td>${o.paymentStatus!=='paid'?`<button class="btn-ghost" style="background:#fef9c3;color:#854d0e;margin-bottom:4px" onclick="mockPayOrder('${o.id}')">&#128179; QPay</button><br>`:''}<button class="btn-ghost" onclick="printInvoice('${o.id}')">🖨️ Хэвлэх</button> <button class="btn-ghost" onclick="openTrackM('${o.id}', '${o.status}', '${o.trackingNumber||''}')" style="background:var(--smoke);color:var(--bone)">Төлөв</button> <button class="btn-ghost del-btn" onclick="refundOrder('${o.id}')">Буцаалт</button></td></tr>`).join('');
    } else tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--dim);padding:40px">Захиалга хоосон байна.</td></tr>';
  } catch{}
}

function printInvoice(id) {
  const o = ALL_ORDERS.find(x => x.id === id); if(!o) return;
  const items = o.orderItems || o.items || [];
  const html = `<div style="font-family:sans-serif;padding:40px;max-width:800px;margin:0 auto;color:#000;background:#fff;min-height:100vh"><div style="display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:20px;margin-bottom:20px"><div><h1 style="margin:0">НЭХЭМЖЛЭХ (INVOICE)</h1><div style="color:#666;margin-top:8px">Захиалгын дугаар: ${o.orderNumber || o.id.split('-')[0].toUpperCase()}</div><div style="color:#666;margin-top:4px">Огноо: ${new Date(o.createdAt).toLocaleDateString()}</div></div><div style="text-align:right"><img src="https://chart.googleapis.com/chart?chs=100x100&cht=qr&chl=${o.id}" style="border:1px solid #ccc;padding:4px;border-radius:4px" alt="QR Code"></div></div><div style="display:flex;justify-content:space-between;margin-bottom:30px;font-size:14px"><div><b>Худалдан авагч / Хүлээн авагч:</b><br>${o.shippingAddress?.name||'Зочин'}</div><div style="text-align:right"><b>WEBSHOP ХХК</b><br>Улаанбаатар хот<br>Утас: 7000-0000<br>И-мэйл: info@webshop.mn</div></div><table style="width:100%;border-collapse:collapse;margin-bottom:30px;font-size:14px"><tr style="background:#f4f4f5;border-bottom:2px solid #000"><th style="padding:12px;text-align:left">Барааны нэр</th><th style="padding:12px;text-align:right">Тоо ширхэг</th><th style="padding:12px;text-align:right">Нэгжийн үнэ</th><th style="padding:12px;text-align:right">Нийт үнэ</th></tr>${items.map(i=>`<tr><td style="padding:12px;border-bottom:1px solid #eee">${i.product?.name || i.productName || 'Бараа'}</td><td style="padding:12px;text-align:right;border-bottom:1px solid #eee">${i.quantity}</td><td style="padding:12px;text-align:right;border-bottom:1px solid #eee">₮${(i.unitPrice||0).toLocaleString()}</td><td style="padding:12px;text-align:right;border-bottom:1px solid #eee">₮${(i.totalPrice||0).toLocaleString()}</td></tr>`).join('')}</table><div style="text-align:right;font-size:20px"><b>НИЙТ ТӨЛӨХ ДҮН: ₮${(o.grandTotal||o.subtotal||0).toLocaleString()}</b></div><div style="margin-top:50px;text-align:center;color:#666;font-size:12px;border-top:1px dashed #ccc;padding-top:20px">Биднийг сонгон үйлчлүүлсэнд баярлалаа! Үүнийг хэвлэж баримтжуулан хадгална уу.</div></div>`;
  document.getElementById('print-area').innerHTML = html;
  document.getElementById('print-area').style.display = 'block';
  window.print();
  document.getElementById('print-area').style.display = 'none';
}
async function refundOrder(id) {
  const amt = prompt('Буцаалт хийх үнийн дүн (₮):');
  if(!amt) return;
  const reason = prompt('Буцаалтын шалтгаан:');
  await fetch(API+'/api/v1/orders/'+id+'/refund', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:Number(amt), reason:reason||''})});
  showT('Хэсэгчилсэн буцаалт амжилттай бүртгэгдлээ!');
  loadOrders();
}
async function loadStats(){ try{const r=await fetch(API+'/api/v1/admin/stats');const d=await r.json();if(d.success){document.getElementById('st-rev').textContent='₮'+(d.data.revenue||0).toLocaleString();document.getElementById('st-ord').textContent=d.data.orders||0;}}catch{} }

// Feature 2: Mock QPay payment simulator
async function mockPayOrder(orderId) {
  if(!confirm('💳 QPay Симуляци: Энэ захиалгыг “Төлөгдсөн” болгох уу?')) return;
  showT('QPay холбогдож байна...');
  try {
    const r = await fetch(API+'/api/v1/ai/payments/qpay/mock-pay', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId})});
    const d = await r.json();
    if(d.success) {
      showT('✅ ' + d.message);
      loadOrders();
      loadStats();
    } else {
      showT('❌ ' + (d.message || 'Алдаа гарлаа'));
    }
  } catch { showT('Сүлжээний алдаа'); }
}

// FUNNEL
async function loadFunnel() {
  try {
    const r=await fetch(API+'/api/v1/admin/funnel'); const d=await r.json();
    if(d.success) {
      document.getElementById('fnl-box').innerHTML = `
        <div style="flex:1;background:var(--bg);padding:16px;border-radius:8px"><h2>${d.data.visitors}</h2><div style="color:var(--dim);font-size:12px">Хуудас үзсэн</div></div>
        <div style="flex:1;background:var(--bg);padding:16px;border-radius:8px"><h2>${d.data.carts}</h2><div style="color:var(--dim);font-size:12px">Сагсалсан</div></div>
        <div style="flex:1;background:var(--bg);padding:16px;border-radius:8px"><h2>${d.data.checkouts}</h2><div style="color:var(--dim);font-size:12px">Төлөхөөр орсон</div></div>
        <div style="flex:1;background:#dcfce7;color:#166534;padding:16px;border-radius:8px"><h2>${d.data.conversions}</h2><div style="font-size:12px;font-weight:600">Амжилттай Захиалсан</div></div>
      `;
    }
  } catch{}
}
async function sendInvoice(id) { await fetch(API+'/api/v1/orders/'+id+'/invoice', {method:'POST'}); showT('Хэрэглэгчийн гар утас руу QPay холбоос бүхий нэхэмжлэх амжилттай илгээгдлээ! 📩'); }

// ABANDONED CARTS
async function loadAband() {
  try {
    const r=await fetch(API+'/api/v1/abandoned-carts'); const d=await r.json(); const tb=document.getElementById('atbody');
    if(d.success && d.data.length) {
      tb.innerHTML = d.data.map(c=>`<tr><td>${new Date(c.updatedAt).toLocaleString()}</td><td style="font-weight:600;color:var(--dim)">Орхигдсон (Идэвхтэй)</td><td>${c.items.length} бараа</td><td style="font-weight:600;font-family:monospace">₮${c.items.reduce((s,i)=>s+i.totalPrice,0).toLocaleString()}</td><td><button class="btn-ghost" style="color:#d97706;background:#fef3c7" onclick="sendRecoveryMail('${c.id}')">Урамшууллын санал илгээх 📩</button></td></tr>`).join('');
    } else tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--dim);padding:40px">Орхигдсон сагс алга байна. Борлуулалт сайн байна!</td></tr>';
  } catch{}
}
async function sendRecoveryMail(id) { showT('Урамшууллын и-мэйл хэрэглэгч рүү амжилттай илгээгдлээ! 🚀'); }

// MARKETING
async function sendMarketing() {
  const tgt = document.getElementById('mk-target').value;
  const sbj = document.getElementById('mk-sbj').value.trim();
  const t = document.getElementById('mk-body').value.trim();
  if(!t) return showT('Агуулгаа бичнэ үү!');
  await fetch(API+'/api/v1/marketing', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target:tgt, subject:sbj, body:t})}); 
  showT(`✨ ${tgt.toUpperCase()} сегмент рүү сурталчилгаа пуужин мэт хөөрлөө!`);
  document.getElementById('mk-body').value=''; document.getElementById('mk-sbj').value='';
}

// MATRIX VARIANTS
async function openVarM(id) {
  activeVariantProductId = id; document.getElementById('mo-var').classList.add('on');
  document.getElementById('v-name').value=''; document.getElementById('v-sku').value=''; document.getElementById('v-price').value=''; document.getElementById('v-stock').value='';
  loadVars();
}
async function loadVars() {
  try {
    const r=await fetch(API+'/api/v1/products/'+activeVariantProductId+'/variants'); const d=await r.json();
    document.getElementById('vtbody').innerHTML = d.data.map(v=>`<tr><td style="font-weight:600">${v.name}</td><td>${v.sku}</td><td>₮${v.price}</td><td><span style="font-weight:600;color:#16a34a">${v.stock} ширхэг</span></td><td><button class="btn-ghost del-btn" onclick="delVar('${v.id}')">Устгах</button></td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--dim);padding:20px">Мэтрикс хувилбар хоосон байна.</td></tr>';
  } catch{}
}
async function saveVar() {
  const p = {name: document.getElementById('v-name').value, sku: document.getElementById('v-sku').value, price: document.getElementById('v-price').value, stock: document.getElementById('v-stock').value};
  if(!p.name) return showT('Нэрээ бичнэ үү');
  await fetch(API+'/api/v1/products/'+activeVariantProductId+'/variants', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}); showT('Мэтрикс хувилбар нэмэгдлээ!'); loadVars();
}
async function delVar(id) { await fetch(API+'/api/v1/products/variants/'+id, {method:'DELETE'}); loadVars(); }

// SUPPLIERS
let editingSup = null;
async function loadSup() { try{const r=await fetch(API+'/api/v1/suppliers');const d=await r.json(); ALL_SUP = d.data; document.getElementById('stbody').innerHTML=d.data.map(c=>`<tr><td style="font-weight:600">${c.name}</td><td>${c.phone}</td><td><span style="color:#16a34a;font-weight:600">${c.status}</span></td><td><button class="btn-ghost" onclick="editSup('${c.id}')">Засах</button><button class="btn-ghost del-btn" onclick="delSup('${c.id}')">Устгах</button></td></tr>`).join('')}catch{}}
function openSupM() { editingSup=null; document.getElementById('sup-title').textContent='Нийлүүлэгч нэмэх'; document.getElementById('sup-n').value=''; document.getElementById('sup-p').value=''; document.getElementById('sup-s').value=''; document.getElementById('mo-sup').classList.add('on'); }
function editSup(id) { const s = ALL_SUP.find(x=>x.id===id); if(s) { editingSup=id; document.getElementById('sup-title').textContent='Нийлүүлэгч засах'; document.getElementById('sup-n').value=s.name; document.getElementById('sup-p').value=s.phone; document.getElementById('sup-s').value=s.status; document.getElementById('mo-sup').classList.add('on'); } }
async function saveSup() { const payload = {name: document.getElementById('sup-n').value, phone: document.getElementById('sup-p').value, status: document.getElementById('sup-s').value}; if(editingSup) await fetch(API+'/api/v1/suppliers/'+editingSup, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); else await fetch(API+'/api/v1/suppliers', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); document.getElementById('mo-sup').classList.remove('on'); showT('Амжилттай!'); loadSup(); }
async function delSup(id) { await fetch(API+'/api/v1/suppliers/'+id,{method:'DELETE'}); showT('Устгагдлаа'); loadSup(); }

// CUSTOMERS
let editingCus = null;
async function loadCus(){ try{const r=await fetch(API+'/api/v1/customers');const d=await r.json();ALL_CUS=d.data; const lvlC={Bronze:'#cd7f32',Silver:'#C0C0C0',Gold:'#FFD700',VIP:'#8b5cf6'}; document.getElementById('ctbody').innerHTML=d.data.map(c=>{const lvl=c.level||'Bronze';const xp=c.xp||0;const aff=c.affiliateCode||'-';return `<tr><td>${new Date(c.createdAt).toLocaleDateString()}</td><td style="font-weight:600">${c.firstName} ${c.lastName||''}</td><td>${c.email}</td><td><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:${lvlC[lvl]||'#cd7f32'};text-align:center;line-height:22px;font-size:10px;font-weight:700;color:#000">${lvl[0]}</span><span style="font-weight:600;color:${lvlC[lvl]||'#cd7f32'};font-size:13px">${lvl}</span><span style="font-size:11px;color:var(--dim)">${xp} XP</span></div><span style="font-size:11px;color:var(--dim)">₮${(c.ltv||0).toLocaleString()} | Хэтэвч: <b style="color:#eab308">₮${(c.walletBalance||c.wallet||0).toLocaleString()}</b></span><br><span style="font-size:10px;color:var(--dim);font-family:monospace">🔗 ${aff}</span></td><td><button class="btn-ghost" onclick="editCus('${c.id}')" style="background:var(--smoke);color:var(--bone)">Хавтас (CRM)</button></td></tr>`}).join('')}catch{}}

function editCus(id) { const c = ALL_CUS.find(x=>x.id===id); if(c) { editingCus=id; document.getElementById('ce-fn').value=c.firstName; document.getElementById('ce-ln').value=c.lastName||''; document.getElementById('ce-em').value=c.email; document.getElementById('mo-cus-edit').classList.add('on'); document.getElementById('ce-note-input').value=''; document.getElementById('ce-wallet-amt').value=''; loadCusNotes(id); } }
async function saveCus() { const payload = {firstName: document.getElementById('ce-fn').value, lastName: document.getElementById('ce-ln').value, email: document.getElementById('ce-em').value}; await fetch(API+'/api/v1/customers/'+editingCus, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); showT('Мэдээлэл шинэчлэгдлээ!'); loadCus(); }
async function loadCusNotes(id) { try { const r=await fetch(API+'/api/v1/customers/'+id+'/notes'); const d=await r.json(); document.getElementById('ce-notes-list').innerHTML=d.data.map(n=>`<div style="background:var(--surface);padding:12px;border-radius:6px;border:1px solid var(--smoke)"><div style="font-size:12px;color:var(--bone);line-height:1.4">${n.details?.note||'-'}</div><div style="font-size:10px;color:var(--dim);margin-top:6px;text-align:right">${new Date(n.createdAt).toLocaleString()}</div></div>`).join(''); } catch{} }
async function saveCusNote() { const v=document.getElementById('ce-note-input').value.trim(); if(!v)return; await fetch(API+'/api/v1/customers/'+editingCus+'/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({note:v})}); document.getElementById('ce-note-input').value=''; loadCusNotes(editingCus); showT('Тэмдэглэл хадгалагдлаа'); }
async function addWallet() { const w=document.getElementById('ce-wallet-amt').value; if(!w)return; await fetch(API+'/api/v1/customers/'+editingCus+'/wallet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:w,reason:'Admin Gift'})}); document.getElementById('ce-wallet-amt').value=''; showT('Wallet цэнэглэгдлээ!'); loadCus(); }

// COUPONS
let editingCp = null;
async function loadCp() { try{const r=await fetch(API+'/api/v1/coupons');const d=await r.json();ALL_CP=d.data;document.getElementById('cptbody').innerHTML=d.data.map(c=>`<tr><td style="font-weight:600">${c.code}</td><td>${c.discountValue}%</td><td><button class="btn-ghost" onclick="editCp('${c.id}')">Засах</button><button class="btn-ghost del-btn" onclick="delCp('${c.id}')">Устгах</button></td></tr>`).join('')}catch{}}
function openCpM() { editingCp=null; document.getElementById('cp-title').textContent='Урамшуулал үүсгэх'; document.getElementById('cp-code').value=''; document.getElementById('cp-val').value=''; document.getElementById('mo-cp').classList.add('on'); }
function editCp(id) { const c = ALL_CP.find(x=>x.id===id); if(c) { editingCp=id; document.getElementById('cp-title').textContent='Урамшуулал засах'; document.getElementById('cp-code').value=c.code; document.getElementById('cp-val').value=c.discountValue; document.getElementById('mo-cp').classList.add('on'); } }
async function saveCp() { const payload = {code: document.getElementById('cp-code').value.trim(), discountValue: document.getElementById('cp-val').value}; if(editingCp) await fetch(API+'/api/v1/coupons/'+editingCp, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); else await fetch(API+'/api/v1/coupons', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); document.getElementById('mo-cp').classList.remove('on'); showT('Амжилттай хадгаллаа!'); loadCp(); }
async function delCp(id) { await fetch(API+'/api/v1/coupons/'+id,{method:'DELETE'}); showT('Устгагдлаа'); loadCp(); }

// MANUAL ORDER
function openOM() { document.getElementById('mo-cus').value=''; document.getElementById('mo-price').value=''; document.getElementById('mo-order').classList.add('on'); }
async function saveOM() { const cus=document.getElementById('mo-cus').value.trim(); const sel=document.getElementById('mo-prod'); const pid=sel.value; const ppr=document.getElementById('mo-price').value||sel.options[sel.selectedIndex].dataset.price; await fetch(API+'/api/v1/orders/admin', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerName:cus||'Үл таних зочин', productId:pid, price:ppr})}); showT('Захиалга нэмэгдэж Нэхэмжлэх үүслээ!'); document.getElementById('mo-order').classList.remove('on'); loadOrders(); loadStats(); }

// TRACKING
function openTrackM(id, st, code) { editingTrackId = id; document.getElementById('mo-t-status').value = st; document.getElementById('mo-t-code').value = code || ''; document.getElementById('mo-track').classList.add('on'); }
async function saveTrack() { await fetch(API+'/api/v1/orders/'+editingTrackId+'/tracking', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:document.getElementById('mo-t-status').value, trackingNumber: document.getElementById('mo-t-code').value})}); showT('Хүргэлтийн мэдээлэл хадгалагдлаа!'); document.getElementById('mo-track').classList.remove('on'); loadOrders(); }
async function setOs(id, st) { if(confirm('Захиалгыг цуцлах уу?')) { await fetch(API+'/api/v1/orders/'+id+'/tracking', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:st})}); showT('Төлөв шинэчлэгдлээ!'); loadOrders(); } }

// SETTINGS & AI
function loadSettings(){ document.getElementById('set-name').value=localStorage.getItem('ws_store_name')||'WEBSHOP'; document.getElementById('set-ai').checked=localStorage.getItem('ws_ai_off')!=='true'; }
function saveSettings(){ localStorage.setItem('ws_store_name', document.getElementById('set-name').value); if(!document.getElementById('set-ai').checked) localStorage.setItem('ws_ai_off', 'true'); else localStorage.removeItem('ws_ai_off'); showT('Тохиргоо хадгалагдлаа!'); }
async function aiInsight(){ showT('📊 AI судалж байна...'); try{const r=await fetch(API+'/api/v1/ai/insights');const d=await r.json();if(d.success) alert('✨ AI Зах Зээлийн Зөвлөмж:\\n\\n'+d.data.insight);}catch{} }

// PRODUCTS
async function loadCats() { try { const r=await fetch(API+'/api/v1/categories'); const d=await r.json(); if(d.success) document.getElementById('p-cat').innerHTML = '<option value="">Ерөнхий</option>' + d.data.map(c=>`<option value="${c.id}">${c.name}</option>`).join(''); } catch{} }
function tickAll(el) { document.querySelectorAll('.chk-prod').forEach(c => c.checked = el.checked); }
async function bulkDelP() { 
  const ids = Array.from(document.querySelectorAll('.chk-prod:checked')).map(c => c.value);
  if(!ids.length) return showT('Устгах бараануудаа сонгоно уу!');
  if(confirm(ids.length + ' ширхэг барааг бүрмөсөн устгах уу?')){ await fetch(API+'/api/v1/products/bulk-delete', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})}); showT('Амжилттай устгагдлаа'); loadProds(); document.getElementById('chk-all').checked=false; }
}
function openM(isE=false){ if(!isE){editingId=null;document.getElementById('m-title').textContent='Шинэ бараа бүртгэх';['p-name','p-price','p-cost','p-sale','p-desc','p-tags','p-img'].forEach(x=>document.getElementById(x).value='');if(document.getElementById('p-img-file'))document.getElementById('p-img-file').value='';updatePv();} document.getElementById('mo').classList.add('on'); }
function closeM(){ document.getElementById('mo').classList.remove('on'); }
function previewFile(el) { if(el.files&&el.files[0]) { const r = new FileReader(); r.onload = e => { document.getElementById('p-pv').src = e.target.result; document.getElementById('p-pv').style.display='block'; }; r.readAsDataURL(el.files[0]); } }
function updatePv(){ const v=document.getElementById('p-img').value; const pv=document.getElementById('p-pv'); if(v){pv.src=v;pv.style.display='block'}else if(!document.getElementById('p-img-file')||!document.getElementById('p-img-file').files.length) {pv.style.display='none';} }
function editP(id){ const p=ALL_PRODS.find(x=>x.id===id); if(p){editingId=id;document.getElementById('m-title').textContent='Бараа засах';document.getElementById('p-name').value=p.name||'';document.getElementById('p-price').value=p.basePrice||'';document.getElementById('p-cost').value=p.attributes?.costPrice||'';document.getElementById('p-sale').value=p.attributes?.salePrice||'';document.getElementById('p-desc').value=p.description||'';document.getElementById('p-cat').value=p.categoryId||'';document.getElementById('p-img').value=p.media?.[0]?.url||'';if(document.getElementById('p-img-file'))document.getElementById('p-img-file').value='';updatePv();openM(true);} }
async function autoGen(){ const n=document.getElementById('p-name').value.trim(); if(!n)return showT('НЭР үү?'); const b=document.getElementById('aibtn'); b.textContent='Бодож байна...'; try{const r=await fetch(API+'/api/v1/ai/generate-product',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n})});const d=await r.json();if(d.success){document.getElementById('p-desc').value=d.data.description;document.getElementById('p-tags').value=d.data.seoTags;if(!document.getElementById('p-price').value)document.getElementById('p-price').value=d.data.pricePrediction;showT('AI зохиолоо! ✨')}}catch{} b.textContent='✨ AI Auto-Generate'; }
async function saveP() {
  let mediaUrl = document.getElementById('p-img').value;
  const fileInput = document.getElementById('p-img-file');
  if(fileInput && fileInput.files.length > 0) {
    const fd = new FormData(); fd.append('image', fileInput.files[0]);
    showT('Зураг хуулж байна...');
    try {
      const uResp = await fetch(API+'/api/v1/admin/products/upload', { method:'POST', headers:{'Authorization':'Bearer '+localStorage.getItem('ws_token')}, body:fd });
      const uData = await uResp.json();
      if(uData.success) { mediaUrl = uData.data.url || uData.data; document.getElementById('p-img').value = mediaUrl; }
    } catch(e) { return showT('Зураг алдаа: ' + e); }
  }

  const data = {
    name: document.getElementById('p-name').value.trim(), basePrice: Number(document.getElementById('p-price').value),
    sku: 'WS-' + Date.now().toString(36).toUpperCase(),
    attributes: { costPrice: Number(document.getElementById('p-cost').value||0), salePrice: Number(document.getElementById('p-sale').value||0) },
    description: document.getElementById('p-desc').value, categoryId: document.getElementById('p-cat').value||undefined
  };
  if(!data.name||!data.basePrice) return showT('Нэр, Үнэ шаардлагатай!');
  
  try {
    let pId = editingId;
    if(editingId) await fetch(API+'/api/v1/products/'+editingId, { method:'PATCH', headers:{'Content-Type':'application/json','Authorization':'Bearer '+localStorage.getItem('ws_token')}, body:JSON.stringify(data) });
    else { const pResp = await fetch(API+'/api/v1/products', { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+localStorage.getItem('ws_token')}, body:JSON.stringify(data) }); const pData = await pResp.json(); if(pData.success) pId = pData.data.id; }
    
    if(mediaUrl && pId) { await fetch(API+'/api/v1/products/'+pId+'/media', { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+localStorage.getItem('ws_token')}, body:JSON.stringify({url:mediaUrl,type:'image',position:0}) }); }
    closeM(); loadProds(); showT('Амжилттай хадгаллаа!');
  } catch(e) { showT('Бараа хадгалахад алдаа'); }
}
async function delP(id){ if(confirm('Устгах уу?')){await fetch(API+'/api/v1/products/'+id,{method:'DELETE'});showT('Устгагдлаа');loadProds();} }

// INITIALIZATION
let revChartInstance = null;
let catChartInstance = null;
let topChartInstance = null;

async function initChart() {
  // Feature 1: Load LIVE analytics data from DB
  const ctx = document.getElementById('revChart');
  const catCtx = document.getElementById('catChart');
  const topCtx = document.getElementById('topChart');
  if (!ctx) return;

  // Revenue chart
  try {
    const r = await fetch(API+'/api/v1/ai/admin/revenue-chart');
    const d = await r.json();
    if (revChartInstance) revChartInstance.destroy();
    revChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: d.data.labels,
        datasets: [{ label: 'Борлуулалт (₮)', data: d.data.data, borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.1)', tension: 0.4, fill: true }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { callback: v => '₮' + v.toLocaleString() } } }
      }
    });
    if (d.data.limited) ctx.parentElement.querySelector('.dim') && (ctx.parentElement.querySelector('.dim').textContent = '📊 Limited mode — Дэвсгэх орлого уруусанаа хүлээнэ');
  } catch {
    revChartInstance = new Chart(ctx, { type: 'line', data: { labels: ['Дав','Мяг','Лха','Пүр','Баа','Бям','Ням'], datasets: [{ label: 'Борлуулалт', data: [0,0,0,0,0,0,0], borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.1)', tension: 0.4, fill: true }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
  }

  // Category breakdown
  if (catCtx) {
    try {
      const r2 = await fetch(API+'/api/v1/ai/admin/category-breakdown');
      const d2 = await r2.json();
      if (catChartInstance) catChartInstance.destroy();
      catChartInstance = new Chart(catCtx, {
        type: 'doughnut',
        data: { labels: d2.data.labels, datasets: [{ data: d2.data.data, backgroundColor: d2.data.colors }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
      });
    } catch {
      catChartInstance = new Chart(catCtx, { type: 'doughnut', data: { labels: ['Даалалгүй'], datasets: [{ data: [1], backgroundColor: ['#e5e7eb'] }] }, options: { responsive: true, maintainAspectRatio: false } });
    }
  }

  // Top products
  if (topCtx) {
    try {
      const r3 = await fetch(API+'/api/v1/ai/admin/top-products');
      const d3 = await r3.json();
      if (topChartInstance) topChartInstance.destroy();
      topChartInstance = new Chart(topCtx, {
        type: 'bar',
        data: { labels: d3.data.labels.length ? d3.data.labels : ['Даалалгүй'], datasets: [{ label: 'Зарагдсан тоо', data: d3.data.data.length ? d3.data.data : [0], backgroundColor: '#8b5cf6' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    } catch {
      topChartInstance = new Chart(topCtx, { type: 'bar', data: { labels: ['Даалалгүй'], datasets: [{ label: 'Тоо', data: [0], backgroundColor: '#8b5cf6' }] }, options: { responsive: true, maintainAspectRatio: false } });
    }
  }
}
function initApp() {
  loadCats(); loadProds(); initChart();
  
  // V44: Real-time Socket.io listeners
  if (typeof io !== 'undefined') {
    const socket = io();
    
    // Join secure admin room
    const token = localStorage.getItem('ws_token');
    if (token) socket.emit('join_admin', token);

    socket.on('disconnect', () => {
      const s = document.getElementById('sys-conn-status');
      if(s) { s.style.color = '#ef4444'; s.style.borderColor = '#ef4444'; s.textContent = '⚫ DISCONNECTED'; s.style.background = 'rgba(239,68,68,0.15)'; }
    });
    socket.on('connect', () => {
      const s = document.getElementById('sys-conn-status');
      if(s) { s.style.color = '#22c55e'; s.style.borderColor = '#22c55e'; s.textContent = '🟢 CONNECTED'; s.style.background = 'rgba(34,197,94,0.15)'; }
    });

    socket.on('payment_confirmed', (data) => {
      showT(`✅ Төлбөр: ${data.orderNumber} — ₮${(data.total||0).toLocaleString()}`);
      loadOrders();
      loadStats();
      initChart(); // Refresh live chart
      
      // Live Operations Log
      rtCounters.purchase++;
      flashRtDot('dot-orders');
      addRtLog('rt-log-orders', 'live_purchase', `<b style="color:#a855f7">PURCHASE CONFIRMED</b> ${data.orderNumber} — ₮${(data.total||0).toLocaleString()}`);
    });

    socket.on('new_order', (data) => {
      showT(`🆕 Шинэ захиалга: ${data.orderNumber} - ₮${data.total.toLocaleString()}`);
      // Play notification sound
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(() => {});
      } catch(e) {}
      
      // Auto-refresh if orders view is active
      const view = document.getElementById('view-orders');
      if (view && view.style.display !== 'none') {
        loadOrders();
        loadStats();
        loadFunnel();
      }

      // Live Operations Log
      rtCounters.orders++;
      flashRtDot('dot-orders');
      addRtLog('rt-log-orders', 'new_order', `<b style="color:#3b82f6">NEW ORDER</b> #${data.orderNumber} — ₮${(data.total||0).toLocaleString()} — ${data.customer}`);
    });

    socket.on('stock_low', (data) => {
      showT(`⚠️ Нөөц бага: ${data.name} (${data.quantity} үлдсэн)`);
      // Live Operations Log
      rtCounters.stock++;
      flashRtDot('dot-stock');
      addRtLog('rt-log-stock', 'stock_low', `<b style="color:#f59e0b">LOW STOCK</b> ${data.name} — ${data.quantity} left (threshold: ${data.threshold})`);
    });

    socket.on('price_drop', (data) => {
      rtCounters.price++;
      flashRtDot('dot-stock');
      addRtLog('rt-log-stock', 'price_drop', `<b style="color:#ef4444">PRICE DROP</b> ${data.name} — ₮${data.oldPrice} → ₮${data.newPrice} (-${data.pct}%)`);
    });

    socket.on('ai_brain_feed', (log) => {
      const memBox = document.getElementById('ai-memory-list');
      if (memBox) {
        const esc = s => (s||'').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const time = new Date(log.createdAt).toLocaleTimeString();
        memBox.innerHTML = `<div style="margin-bottom:4px; border-left: 2px solid #8b5cf6; padding-left: 8px; animation: glow 2s ease-out;"><span style="color:#9ca3af">[${time}]</span> <span style="color:#8b5cf6">[RT:${log.agent}]</span> ${esc(log.action)}</div>` + memBox.innerHTML;
      }

      // Live Operations Log
      rtCounters.ai++;
      flashRtDot('dot-ai');
      addRtLog('rt-log-ai', 'ai_brain_feed', `<b style="color:#10b981">[${log.agent||'AI'}]</b> ${log.action||''} → ${(JSON.stringify(log.details||log)).substring(0, 120)}`);
    });
  }
}

// --- LIVE OPERATIONS (RT) HELPERS ---
const rtCounters = { total: 0, orders: 0, stock: 0, purchase: 0, ai: 0, price: 0 };
let rtEventsThisSec = 0;

setInterval(() => {
  const epsEl = document.getElementById('rt-eps');
  if (epsEl) epsEl.textContent = rtEventsThisSec;
  rtEventsThisSec = 0;
}, 1000);

function updateRtStats() {
  const etbl = document.getElementById('rt-total');
  if(!etbl) return;
  etbl.textContent = rtCounters.total;
  document.getElementById('rt-orders').textContent = rtCounters.orders;
  document.getElementById('rt-purchase').textContent = rtCounters.purchase;
}

function addRtLog(panel, cls, text) {
  const log = document.getElementById(panel);
  if(!log) return;
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = `<span style="color:#71717a">[${new Date().toLocaleTimeString()}]</span> ${text}`;
  log.prepend(d);
  if (log.children.length > 200) log.removeChild(log.lastChild);
  rtCounters.total++;
  rtEventsThisSec++;
  updateRtStats();
}

function flashRtDot(id) {
  const dot = document.getElementById(id);
  if(dot) {
    dot.classList.add('on');
    setTimeout(() => dot.classList.remove('on'), 500);
  }
}

async function fireStress(total) {
  try {
    const r = await fetch(API+'/api/v1/test/realtime/stress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: total })
    });
    const d = await r.json();
    if (!d.success) addRtLog('rt-log-ai', '', '<span style="color:#ef4444">Stress API Error: ' + d.message + '</span>');
  } catch(e) {
    addRtLog('rt-log-ai', '', '<span style="color:#ef4444">Fetch Error: ' + e.message + '</span>');
  }
}

function clearRtLogs() {
  ['rt-log-orders', 'rt-log-stock', 'rt-log-ai'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.innerHTML = '';
  });
  Object.keys(rtCounters).forEach(k => rtCounters[k] = 0);
  updateRtStats();
}
// --- END LIVE OPERATIONS HELPERS ---

// Boot checks
if(!localStorage.getItem('ws_token')) { document.getElementById('login-screen').style.display = 'flex'; }
else { initApp(); }
