
// V9 Frontend Authentication variables
const API = ''; // Use relative paths for local development and unified deployment

const P_IMGS=['https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&q=80','https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80','https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80','https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&q=80','https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&q=80','https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400&q=80','https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=400&q=80','https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400&q=80'];


/* Animations Removed for Minimalist Aesthetic */
// ── NAV ──
window.addEventListener('scroll',()=>document.getElementById('nav').classList.toggle('s',scrollY>60));

// ── TICKER ──
const ti=['WEBSHOP 2026','AI УХААЛАГ ДЭЛГҮҮР','ХИЙМЭЛ ОЮУНЫ СОНГОЛТ','ТӨРӨЛХ МЭДРЭМЖ','БАТАЛГААТ ЧАНАР','ШИНЭ ИРЭЛТ','500+ БАРАА'];
const tf=[...ti,...ti,...ti,...ti];
document.getElementById('tk').innerHTML=tf.map(t=>`<div class="tick-item">${t} <span class="tick-sep">◆</span></div>`).join('');

// ── MANIFESTO PARALLAX SCROLL ──
const mParagraphs=document.querySelectorAll('.manifesto-p');
const mObs=new IntersectionObserver(es=>es.forEach(e=>{
  if(e.isIntersecting)e.target.classList.add('lit');
}),{threshold:.4,rootMargin:'-20% 0px -20% 0px'});
mParagraphs.forEach(p=>mObs.observe(p));

// 🔥 HOT manifesto item on scroll middle
window.addEventListener('scroll',()=>{
  const vh=window.innerHeight;
  mParagraphs.forEach(p=>{
    const r=p.getBoundingClientRect();
    const mid=r.top+r.height/2;
    const fromCenter=Math.abs(mid-vh/2);
    if(fromCenter<120)p.classList.add('hot','lit');
    else p.classList.remove('hot');
  });
});

// ── SCROLL REVEAL ──
const rvObs=new IntersectionObserver(es=>es.forEach(e=>{
  if(e.isIntersecting)e.target.classList.add('vis');
}),{threshold:.08,rootMargin:'0px 0px -40px 0px'});
document.querySelectorAll('.reveal-up,.reveal-left,.reveal-right,.reveal-scale,.reveal-burn').forEach(el=>rvObs.observe(el));

// ── COUNTER ANIMATION ──
const cntObs=new IntersectionObserver(es=>es.forEach(e=>{
  if(!e.isIntersecting)return;
  const el=e.target;
  el.parentElement.classList.add('vis');
  const target=parseInt(el.dataset.target)||0;
  const suffix=el.dataset.target.includes('+')?'+':'';
  let current=0;const dur=1600;const start=Date.now();
  const step=()=>{
    const elapsed=Date.now()-start;
    const progress=Math.min(elapsed/dur,1);
    const ease=1-Math.pow(1-progress,4);
    current=Math.floor(ease*target);
    el.textContent=current.toLocaleString()+suffix;
    if(progress<1)requestAnimationFrame(step);
    else el.textContent=target.toLocaleString()+suffix;
  };
  requestAnimationFrame(step);
  cntObs.unobserve(el);
}),{threshold:.3});
document.querySelectorAll('.stat-num[data-target]').forEach(el=>cntObs.observe(el));

// ── PRODUCTS ──
const DEMO=[
  {id:'p1',name:'Samsung Galaxy S24 Ultra',cat:'Утас',price:2500000,old:2800000,badge:'new',img:'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&q=80'},
  {id:'p2',name:'iPhone 15 Pro Max 256GB',cat:'Утас',price:3200000,badge:'hot',img:'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400&q=80'},
  {id:'p3',name:'MacBook Air M3 13"',cat:'Компьютер',price:4200000,img:'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&q=80'},
  {id:'p4',name:'Sony WH-1000XM5',cat:'Дуут',price:850000,old:950000,badge:'sale',img:'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&q=80'},
  {id:'p5',name:'Nike Air Max 270',cat:'Гутал',price:320000,img:'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80'},
  {id:'p6',name:'iPad Air 5 Wi-Fi 64GB',cat:'Компьютер',price:1850000,img:'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&q=80'},
  {id:'p7',name:'JBL Charge 5',cat:'Дуут',price:420000,badge:'new',img:'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&q=80'},
  {id:'p8',name:'Xiaomi 14 Pro',cat:'Утас',price:1400000,img:'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=400&q=80'},
  {id:'p9',name:'Adidas Ultraboost 23',cat:'Гутал',price:450000,img:'https://images.unsplash.com/photo-1556048219-bb6978360b84?w=400&q=80'},
  {id:'p10',name:'LG OLED C3 55"',cat:'Гэр ахуй',price:3800000,badge:'hot',img:'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400&q=80'},
  {id:'p11',name:'Dyson V15 Detect',cat:'Гэр ахуй',price:1950000,img:'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&q=80'},
  {id:'p12',name:'Canon EOS R50 Kit',cat:'Компьютер',price:1250000,img:'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80'},
];
const FEAT=[{id:'f1',name:'Samsung Galaxy S24 Ultra',cat:'Утас',price:2500000,img:'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&q=80'},{id:'f2',name:'MacBook Air M3',cat:'Компьютер',price:4200000,img:'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&q=80'},{id:'f3',name:'Sony WH-1000XM5',cat:'Дуут',price:850000,img:'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&q=80'}];
const ALL=[...DEMO,...FEAT];
const liked=new Set();

// ── V18 STATE MANAGEMENT (Proxy Pattern) ──
const State = new Proxy({
  cart: JSON.parse(localStorage.getItem('ws_cart') || '[]'),
  curPage: 1,
  totalPages: 1,
  isLoading: false,
  user: null
}, {
  set(target, key, value) {
    target[key] = value;
    if (key === 'cart') {
      localStorage.setItem('ws_cart', JSON.stringify(value));
      updCart(); // Auto-update UI on state change
    }
    if (key === 'isLoading') {
      document.body.style.cursor = value ? 'wait' : 'default';
      // Future loading overlay logic
    }
    return true;
  }
});

// ── TOAST MANAGER (Centralized Feedback) ──
const ToastManager = {
  show(msg, type='info', duration=4000) {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('tmsg');
    const dotEl = document.querySelector('.tdot');
    
    // Reset classes
    toast.className = 'toast';
    
    // Style logic
    if (type === 'success') {
      toast.style.borderColor = 'rgba(68, 255, 136, 0.4)';
      dotEl.style.background = '#44ff88';
      dotEl.style.boxShadow = '0 0 12px #44ff88';
    } else if (type === 'error') {
      toast.style.borderColor = 'rgba(255, 61, 0, 0.4)';
      dotEl.style.background = '#ff3d00';
      dotEl.style.boxShadow = '0 0 12px #ff3d00';
    } else {
      toast.style.borderColor = 'rgba(0, 240, 255, 0.4)';
      dotEl.style.background = '#00f0ff';
      dotEl.style.boxShadow = '0 0 12px #00f0ff';
    }

    msgEl.textContent = msg;
    toast.classList.add('on');
    
    if (this._timeout) clearTimeout(this._timeout);
    this._timeout = setTimeout(() => {
      toast.classList.remove('on');
    }, duration);
  }
};

// Aliasing the old showT to the new ToastManager for backwards compatibility
window.showT = (msg, type='info') => ToastManager.show(msg, type);

function saveCart() { /* Deprecated by Proxy, kept empty for safety */ }

// V13: Sort products via API
async function sortProds() {
  const sort = document.getElementById('sort-sel').value;
  try {
    const r = await fetch(API+'/api/v1/products?limit=12&sort='+sort);
    const d = await r.json();
    if(d.success && d.data.items.length) {
      const fetched = d.data.items.map((p,i)=>({id:p.id,name:p.name,cat:p.category?.name||'Ерөнхий',price:p.basePrice||0,img:p.media?.[0]?.url||P_IMGS[i%P_IMGS.length],badge:null}));
      renderProds(fetched);
    }
  } catch{}
}

// V13: Load more products (pagination)
async function loadMore() {
  curPage++;
  const sort = document.getElementById('sort-sel').value;
  try {
    const r = await fetch(API+'/api/v1/products?limit=12&page='+curPage+'&sort='+sort);
    const d = await r.json();
    if(d.success && d.data.items.length) {
      const fetched = d.data.items.map((p,i)=>({id:p.id,name:p.name,cat:p.category?.name||'Ерөнхий',price:p.basePrice||0,img:p.media?.[0]?.url||P_IMGS[i%P_IMGS.length],badge:null}));
      ALL.push(...fetched);
      const g = document.getElementById('pg');
      const bl={new:'Шинэ',hot:'Хит',sale:'Хямдрал'},bc={new:'bn',hot:'bh',sale:'bs'};
      g.innerHTML += fetched.map((p,i)=>`
        <div class="pc" onclick="openQv('${p.id}')">
          <div class="pimg"><img src="${p.img||P_IMGS[i%P_IMGS.length]}" style="width:100%;height:100%;object-fit:cover;aspect-ratio:3/4"></div>
          <div class="pi"><div class="pcat">${p.cat}</div><div class="pname">${p.name}</div><div class="pbottom"><div><span class="pprice">₮${p.price.toLocaleString()}</span></div><button class="plike" onclick="event.stopPropagation();tLike('${p.id}',this)">♥</button></div></div>
        </div>
      `).join('');
      setTimeout(()=>g.querySelectorAll('.pc').forEach(c=>c.classList.add('vis')),100);
      if(curPage >= d.data.totalPages) document.getElementById('load-more-btn').style.display='none';
    } else {
      document.getElementById('load-more-btn').style.display='none';
    }
  } catch { document.getElementById('load-more-btn').style.display='none'; }
}

// V13: Newsletter submit
async function doNewsletter() {
  const name = document.getElementById('nl-name').value;
  const email = document.getElementById('nl-email').value;
  if(!email) return showT('И-мэйл хаяг оруулна уу!');
  try {
    const r = await fetch(API+'/api/v1/storefront/newsletter', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name,email})});
    const d = await r.json();
    if(d.success) { showT('Амжилттай бүртгэгдлээ! Тавтай морил 🎉'); document.getElementById('nl-name').value=''; document.getElementById('nl-email').value=''; }
    else showT(d.message || 'Алдаа гарлаа');
  } catch { showT('Алдаа гарлаа'); }
}

// V13: Load categories from API
async function loadCategories() {
  const colors = ['#ff3d00','#4488ff','#9c27b0','#44ff88','#d4a843','#00d4ff','#ff6b9d','#4caf50'];
  try {
    const r = await fetch(API+'/api/v1/categories');
    const d = await r.json();
    if(d.success && d.data.length) {
      document.getElementById('cat-grid').innerHTML = d.data.map((c,i) => `
        <div class="cc reveal-up" style="transition-delay:${i*.07}s;cursor:pointer" onclick="filterByCat('${c.name}')">
          <div class="cc-glow" style="background:${colors[i%colors.length]}"></div>
          <div class="cc-num">${String(i+1).padStart(2,'0')}</div>
          <div class="cc-txt"><div class="cc-name">${c.name}</div><div class="cc-cnt">${c._count?.products||0} бараа</div></div>
          <div class="cc-arrow">→</div>
        </div>
      `).join('');
      // Trigger scroll reveal
      document.querySelectorAll('#cat-grid .cc').forEach(el=>rvObs.observe(el));
    } else {
      document.getElementById('cat-grid').innerHTML = '<div style="color:var(--dim);text-align:center;padding:40px;grid-column:span 3">Ангилал байхгүй</div>';
    }
  } catch {
    document.getElementById('cat-grid').innerHTML = '<div style="color:var(--dim);text-align:center;padding:40px;grid-column:span 3">Ангилал уншихад алдаа</div>';
  }
}

function filterByCat(catName) {
  document.querySelectorAll('.ft').forEach(x=>x.classList.remove('a'));
  const list = ALL.filter(p=>p.cat===catName);
  renderProds(list.length ? list : DEMO);
  go('products');
}

async function loadProds(){
  try{
    const r=await fetch(API+'/api/v1/products?limit=12');
    const d=await r.json();
    if(d.success&&d.data.items.length){
      const fetched = d.data.items.map((p,i)=>({id:p.id,name:p.name,cat:p.category?.name||'Ерөнхий',price:p.basePrice||0,img:p.media?.[0]?.url||P_IMGS[i%P_IMGS.length],badge:i===0?'new':i===1?'hot':null}));
      ALL.push(...fetched);
      renderProds(fetched);
      totalPages = d.data.totalPages || 1;
      if(totalPages > 1) document.getElementById('load-more-btn').style.display='inline-block';
      document.getElementById('ht').textContent=d.data.total||'500+';return;
    }
  }catch{}
  document.getElementById('ht').textContent='500+';
  renderProds(DEMO);
}

function renderProds(list){
  const g=document.getElementById('pg');
  if(!list.length){g.innerHTML='<p style="color:var(--dim);padding:60px;grid-column:span 4;font-weight:300">Бараа олдсонгүй</p>';return;}
  const bl={new:'Шинэ',hot:'Хит',sale:'Хямдрал'},bc={new:'bn',hot:'bh',sale:'bs'};
  g.innerHTML=list.map((p,i)=>`
    <div class="pc" style="transition-delay:${i*.07}s" onclick="openQv('${p.id}')">
      ${p.badge?`<div class="pbadge ${bc[p.badge]||'bn'}">${bl[p.badge]||''}</div>`:''}
      <div class="pimg">
        <img loading="lazy" src="${p.img||P_IMGS[i%P_IMGS.length]}" style="width:100%;height:100%;object-fit:cover;aspect-ratio:3/4">
        <div class="pov"><button class="pov-btn" onclick="event.stopPropagation();aId('${p.id}')">Сагсанд нэмэх</button></div>
      </div>
      <div class="pi">
        <div class="pcat">${p.cat}</div>
        <div class="pname">${p.name}</div>
        <div class="pbottom">
          <div><span class="pprice">₮${p.price.toLocaleString()}</span>${p.old?`<span class="pold">₮${p.old.toLocaleString()}</span>`:''}</div>
          <button class="plike${liked.has(p.id)?' lk':''}" onclick="event.stopPropagation();tLike('${p.id}',this)">♥</button>
        </div>
      </div>
    </div>
  `).join('');
  setTimeout(()=>g.querySelectorAll('.pc').forEach((c,i)=>{setTimeout(()=>c.classList.add('vis'),i*80)}),100);
}

function tLike(id,btn){
  if(liked.has(id)){liked.delete(id);btn.classList.remove('lk');}
  else{liked.add(id);btn.classList.add('lk');showT('Хүслийн жагсаалтад нэмлээ 🔥');}
}

document.getElementById('ftabs').addEventListener('click',e=>{
  const b=e.target.closest('.ft');if(!b)return;
  document.querySelectorAll('.ft').forEach(x=>x.classList.remove('a'));b.classList.add('a');
  const c=b.dataset.c;
  const list=c==='all'?ALL:ALL.filter(p=>p.cat===c);
  const g=document.getElementById('pg');
  g.querySelectorAll('.pc').forEach(c=>{c.classList.remove('vis');c.style.opacity='0'});
  setTimeout(()=>renderProds(list),300);
});

// ── CART — Backend API Connected ──
let sessionId = localStorage.getItem('ws_session') || ('sess_'+Math.random().toString(36).slice(2));
localStorage.setItem('ws_session', sessionId);
let authToken = localStorage.getItem('ws_token') || '';

// ── AFFILIATE: Capture ?ref= code when arriving via referral link ──
(function captureAffiliateRef() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) {
    localStorage.setItem('ws_affiliate_ref', ref);
    // Clean the URL without reload
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, '', cleanUrl);
  }
})();

function apiHeaders(){
  const h = {'Content-Type':'application/json','X-Session-ID':sessionId};
  if(authToken) h['Authorization']='Bearer '+authToken;
  if(authToken) h['X-Customer-ID']=localStorage.getItem('ws_customer_id')||'';
  return h;
}

async function addToCart(p){
  State.isLoading = true;
  try {
    const res = await fetch(API+'/api/v1/cart/items',{method:'POST',headers:apiHeaders(),body:JSON.stringify({productId:p.id,quantity:1})});
    if(!res.ok) throw new Error('API Error');
  } catch(e) {
    ToastManager.show('Сүлжээний алдаа. Сагсанд нэмж чадсангүй.', 'error');
    State.isLoading = false;
    return;
  }
  State.isLoading = false;

  const currentCart = [...State.cart];
  const ex = currentCart.find(i=>i.id===p.id);
  if(ex) ex.qty++; else currentCart.push({...p,qty:1});
  
  State.cart = currentCart; // triggers proxy setter
  ToastManager.show(p.name+' — нэмэгдлээ 🔥', 'success');
  
  if(!document.getElementById('cp').classList.contains('on')) tC(); // Open cart automatically
}
function aId(id){const p=ALL.find(x=>x.id===id);if(p)addToCart({id:p.id,name:p.name,cat:p.cat||'',price:p.price,img:p.img});}
async function rmC(id){
  // Add confirmation for removal (Task 2 Requirement)
  if(!confirm('Энэ барааг сагснаас хасахдаа итгэлтэй байна уу?')) return;
  
  State.cart = State.cart.filter(i=>i.id!==id);
  ToastManager.show('Сагснаас хаслаа', 'info');
  try{await fetch(API+'/api/v1/cart/items/'+id,{method:'DELETE',headers:apiHeaders()});}catch{}
}
async function qty(id,d){
  const i=State.cart.find(x=>x.id===id);if(!i)return;i.qty+=d;
  if(i.qty<=0){rmC(id);return;}
  State.cart = [...State.cart]; // Trigger proxy setter
  
  try{await fetch(API+'/api/v1/cart/items/'+id,{method:'PATCH',headers:apiHeaders(),body:JSON.stringify({quantity:i.qty})});}catch{}
}

function updCart(){
  const cartState = State.cart;
  const tot=cartState.reduce((s,i)=>s+i.price*i.qty,0);
  const cnt=cartState.reduce((s,i)=>s+i.qty,0);
  document.getElementById('ncnt').textContent=cnt;
  document.getElementById('csub').textContent='₮'+tot.toLocaleString();
  
  // Real-time Shipping logic & Validation
  const FREE_SHIPPING_THRESHOLD = 50000;
  let shippingCost = tot >= FREE_SHIPPING_THRESHOLD ? 0 : 5000;
  if(tot === 0) shippingCost = 0; // Empty cart means 0 shipping
  
  document.getElementById('ctot').textContent='₮'+(tot+shippingCost).toLocaleString();
  
  // Update UI Free Shipping Bar
  const shipBarFill = document.getElementById('ship-fill');
  const shipBarText = document.getElementById('ship-text');
  if (shipBarFill && shipBarText) {
    if (tot === 0) {
      shipBarFill.style.width = '0%';
      shipBarText.innerHTML = `₮<em>${FREE_SHIPPING_THRESHOLD.toLocaleString()}</em>-с дээш захиалгад <em>Үнэгүй хүргэлт!</em>`;
    } else if (tot >= FREE_SHIPPING_THRESHOLD) {
      shipBarFill.style.width = '100%';
      shipBarText.innerHTML = `<span style="color:#44ff88">Та <strong>Үнэгүй хүргэлтийн</strong> эрхтэй байна! 🎉</span>`;
    } else {
      const p = Math.floor((tot / FREE_SHIPPING_THRESHOLD) * 100);
      const rem = FREE_SHIPPING_THRESHOLD - tot;
      shipBarFill.style.width = p + '%';
      shipBarText.innerHTML = `Дахин ₮<em>${rem.toLocaleString()}</em> худалдан авалт хийгээд <em>Үнэгүй хүргэлт!</em>`;
    }
  }

  const b=document.getElementById('cb');
  if(!cartState.length){b.innerHTML='<div class="c-empty"><div class="c-empty-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg></div><p>Сагс хоосон байна</p></div>';return;}
  b.innerHTML=cartState.map(i=>`
    <div class="ci">
      <div class="ci-img" style="background:none;border-radius:8px;overflow:hidden"><img loading="lazy" src="${i.img||P_IMGS[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:8px"></div>
      <div class="ci-info">
        <div class="ci-name">${i.name}</div>
        <div class="ci-cat">${i.cat}</div>
        <div class="ci-price">₮${(i.price*i.qty).toLocaleString()}</div>
        <div class="ci-qty"><button class="qb" onclick="qty('${i.id}',-1)">−</button><span class="qn">${i.qty}</span><button class="qb" onclick="qty('${i.id}',1)">+</button></div>
      </div>
      <button class="ci-rm" onclick="rmC('${i.id}')">✕</button>
    </div>
  `).join('');
}
function openCheckoutModal() {
  if(!State.cart.length) { ToastManager.show('Сагс хоосон байна', 'error'); return; }
  
  // Render Summary
  const tot = State.cart.reduce((s,i)=>s + i.price*i.qty, 0);
  const ship = tot >= 50000 ? 0 : 5000;
  
  document.getElementById('co-sub').textContent = '₮' + tot.toLocaleString();
  document.getElementById('co-ship').textContent = ship === 0 ? 'Үнэгүй' : '₮' + ship.toLocaleString();
  document.getElementById('co-tot').textContent = '₮' + (tot + ship).toLocaleString();
  
  document.getElementById('co-summary-items').innerHTML = State.cart.map(i=>`
    <div style="display:flex;gap:12px;margin-bottom:12px">
      <div style="width:48px;height:48px;border-radius:6px;overflow:hidden;background:#111"><img loading="lazy" src="${i.img||P_IMGS[0]}" style="width:100%;height:100%;object-fit:cover"></div>
      <div><div style="font-size:12px;color:var(--bone)">${i.name}</div><div style="font-size:11px;color:var(--dim)">₮${i.price.toLocaleString()} x ${i.qty}</div></div>
    </div>
  `).join('');
  
  // Prefill if logged in
  if(authToken) {
    const rawNameEl = document.getElementById('my-name');
    if(rawNameEl) {
      const parts = rawNameEl.textContent.split(' (');
      document.getElementById('co-name').value = parts[0] || '';
      if(parts[1]) document.getElementById('co-email').value = parts[1].replace(')','') || '';
    }
  }
  
  // Feature 4: Auto-fill coupon from Spin Wheel prize
  const couponInput = document.getElementById('c-coupon');
  if(couponInput && lastWonCoupon && !couponInput.value) {
    couponInput.value = lastWonCoupon;
    applyCouponPreview();
  }
  
  tC(); // Close cart drawer
  document.getElementById('mo-auth').classList.add('on');
}

// Feature 4: Real-time coupon discount preview
async function applyCouponPreview() {
  const code = document.getElementById('c-coupon')?.value?.trim();
  const feedbackEl = document.getElementById('coupon-feedback');
  if (!feedbackEl) return;
  if (!code) { feedbackEl.textContent = ''; return; }
  
  feedbackEl.textContent = 'Күлээж байшалж байна...';
  feedbackEl.style.color = 'var(--dim)';
  
  try {
    const r = await fetch(API+'/api/v1/coupons/checkout/validate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code }) });
    const d = await r.json();
    if(d.success && d.data) {
      feedbackEl.textContent = `✅ Хызаарлалтын код зөв байна: -${d.data.discountValue}%`;
      feedbackEl.style.color = '#16a34a';
    } else {
      feedbackEl.textContent = '❌ Код буруу эсвэл хүчингүй байна';
      feedbackEl.style.color = '#ef4444';
    }
  } catch {
    feedbackEl.textContent = '';
  }
}

function selectPayment(type, el) {
  document.querySelectorAll('.pm-box').forEach(x=>x.classList.remove('sel'));
  el.classList.add('sel');
  // Add payment type to state if needed
}

// Feature 2+4: Store last placed orderId for QPay simulation
let lastOrderId = null;

function validateCheckout() {
  let valid = true;
  const err = (id, msg) => { document.getElementById(id).textContent = msg; valid = false; };
  const clear = (id) => { document.getElementById(id).textContent = ''; };
  
  ['err-co-name','err-co-email','err-co-phone','err-co-address'].forEach(clear);
  
  const name = document.getElementById('co-name').value.trim();
  const em = document.getElementById('co-email').value.trim();
  const ph = document.getElementById('co-phone').value.trim();
  const ad = document.getElementById('co-address').value.trim();
  
  if(!name) err('err-co-name', 'Нэрээ оруулна уу');
  if(!em || !em.includes('@')) err('err-co-email', 'Зөв и-мэйл хаяг оруулна уу');
  if(!ph || ph.length < 8) err('err-co-phone', 'Утасны дугаар буруу байна');
  if(!ad || ad.length < 5) err('err-co-address', 'Дэлгэрэнгүй хаяг оруулна уу');
  
  return valid ? { name, email:em, phone:ph, address:ad } : null;
}

async function doFinalCheckout() {
  const data = validateCheckout();
  if(!data) { ToastManager.show('Мэдээллээ гүйцэд оруулна уу', 'error'); return; }
  
  const useWallet = document.getElementById('c-use-wallet')?.checked || false;
  const couponCode = document.getElementById('c-coupon')?.value?.trim() || '';
  
  const btn = document.getElementById('co-submit-btn');
  const og = btn.textContent;
  btn.textContent = 'Уншиж байна...';
  btn.style.pointerEvents = 'none';

  try {
    const payload = {
      items: State.cart,
      useWallet,
      couponCode,
      paymentMethod: 'qpay',
      shippingAddress: data.address,
      contactEmail: data.email,
      contactPhone: data.phone
    };
    
    const r = await fetch(API+'/api/v1/checkout', { method:'POST', headers:apiHeaders(), body:JSON.stringify(payload) });
    const d = await r.json();
    if(d.success) {
      // Feature 2+4: Capture order ID for QPay simulation
      lastOrderId = d.orderId || d.data?.id || d.checkoutId || null;
      const grandTotal = d.grandTotal || d.data?.grandTotal || 0;
      
      document.getElementById('qsub').textContent = 'Нийт төлөх дүн: ₮' + grandTotal.toLocaleString();
      
      // Inject QPay simulate button into the success overlay
      if(lastOrderId) {
        const existing = document.getElementById('mock-qpay-btn');
        if(existing) existing.remove();
        const qbg = document.getElementById('qbg');
        if(qbg) {
          const simBtn = document.createElement('button');
          simBtn.id = 'mock-qpay-btn';
          simBtn.innerHTML = '💳 QPay Төлбөр хийх (Симуляци)';
          simBtn.style.cssText = 'margin-top:20px;padding:14px 24px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;width:100%;display:block;transition:all .2s';
          simBtn.onclick = async () => {
            simBtn.innerHTML = '⏳ Төлбөр баталгаажуулж байна...';
            simBtn.disabled = true;
            try {
              const pr = await fetch(API+'/api/v1/ai/payments/qpay/mock-pay', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({orderId: lastOrderId}) });
              const pd = await pr.json();
              if(pd.success) {
                simBtn.innerHTML = '✅ Төлбөр амжилттай баталгаалагдлаа!';
                simBtn.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
                ToastManager.show('✅ ' + pd.message, 'success');
                lastWonCoupon = null; // Clear won coupon after successful payment
              } else {
                simBtn.innerHTML = pd.message || 'Алдаа гарлаа';
                simBtn.disabled = false;
              }
            } catch { simBtn.disabled = false; simBtn.innerHTML = '💳 QPay Дахин оролдох'; }
          };
          qbg.appendChild(simBtn);
        }
      }
      
      State.cart = [];
      if(couponCode) lastWonCoupon = null;
      document.getElementById('mo-checkout').classList.remove('on');
      document.getElementById('qbg').classList.add('on');
      ToastManager.show('Захиалга амжилттай бүртгэгдлээ, төлбөрөө хийнэ үү.', 'success');
    } else { 
      ToastManager.show(d.message||'Алдаа гарлаа', 'error'); 
    }
  } catch(e) {
    ToastManager.show('Сүлжээний холболт тасарлаа, дахин үзнэ үү.', 'error');
  } finally {
    btn.textContent = og;
    btn.style.pointerEvents = 'auto';
  }
}

async function doCheckout() { openCheckoutModal(); }

// ── V9 AUTHENTICATION & QUICKVIEW ──
let authMode='login';
function tAuth(){ document.getElementById('mo-auth').classList.toggle('on'); if(authToken)loadMe(); }
function tAuthMode(){
  authMode=authMode==='login'?'register':'login';
  document.getElementById('auth-title').textContent=authMode==='login'?'Нэвтрэх':'Шинээр бүртгүүлэх';
  document.getElementById('a-btn').textContent=authMode==='login'?'Нэвтрэх':'Бүртгүүлэх';
  document.getElementById('a-sw').textContent=authMode==='login'?'Бүртгэлгүй юу? Шинээр бүртгүүлэх':'Бүртгэлтэй юу? Нэвтрэх';
  document.getElementById('a-fn').style.display=authMode==='login'?'none':'block';
  document.getElementById('a-ln').style.display=authMode==='login'?'none':'block';
}
async function doAuth(){
  const email=document.getElementById('a-em').value, password=document.getElementById('a-pw').value;
  const refCode = localStorage.getItem('ws_affiliate_ref') || '';
  const payload=authMode==='register'
    ?{firstName:document.getElementById('a-fn').value,lastName:document.getElementById('a-ln').value,email,password}
    :{email,password};
  const url = API+'/api/v1/auth/'+authMode + (authMode==='register' && refCode ? `?ref=${encodeURIComponent(refCode)}` : '');
  try{
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const d=await r.json();
    if(d.success){ 
      authToken=d.data.accessToken; 
      localStorage.setItem('ws_token',authToken); 
      if(authMode==='register') localStorage.removeItem('ws_affiliate_ref'); // consume ref on register
      document.getElementById('cw-row').style.display='flex'; 
      loadMe(); 
    }
    else showT(d.message);
  }catch{}
}
function logOut(){ 
  authToken=''; 
  localStorage.removeItem('ws_token'); 
  localStorage.removeItem('ws_customer_id');
  State.cart = []; // clear cart on logout
  document.getElementById('cw-row').style.display='none'; 
  document.getElementById('auth-logged').style.display='none'; 
  document.getElementById('auth-unlogged').style.display='block'; 
}

async function syncCartToCloud(customerId) {
  try {
    localStorage.setItem('ws_customer_id', customerId);
    if(State.cart.length > 0) {
      await fetch(API+'/api/v1/cart/merge', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ sessionId, customerId }) });
    }
    const r = await fetch(API+'/api/v1/cart', { headers: apiHeaders() });
    const d = await r.json();
    if(d.success && d.data?.items) {
      State.cart = d.data.items.map(i => ({
        id: i.productId,
        name: i.product?.name || 'Бараа',
        price: i.product?.basePrice || 0,
        img: i.product?.media?.[0]?.url,
        qty: i.quantity
      }));
    }
  } catch {}
}
async function loadMe(){
  document.getElementById('auth-unlogged').style.display='none'; document.getElementById('auth-logged').style.display='block'; document.getElementById('cw-row').style.display='flex';
  try{
    const r=await fetch(API+'/api/v1/auth/profile',{headers:apiHeaders()});
    const d=await r.json();
    if(d.success) {
      const user = d.data;
      const g = user.gamification || {};
      syncCartToCloud(user.id);
      document.getElementById('my-name').textContent=user.firstName+' '+user.lastName+' ('+user.email+')';
      document.getElementById('my-wallet').textContent='₮'+(g.walletBalance||0).toLocaleString();
      document.getElementById('my-orders').innerHTML=(user.orders||[]).map(o=>`<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)">Огноо: ${new Date(o.createdAt).toLocaleDateString()}, Дүн: ₮${o.grandTotal.toLocaleString()} (${o.paymentStatus})</div>`).join('')||'Захиалга алга';

      // ── GAMIFICATION UI ──────────────────────────────────────────────
      const lvlColors = { Bronze:'#cd7f32', Silver:'#C0C0C0', Gold:'#FFD700', VIP:'#8b5cf6' };
      const lvl = g.level || 'Bronze';
      const xp = g.xp || 0;
      const progress = g.progress || 0;
      const gamHtml = `
        <div id="gamification-card" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin-top:12px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div style="width:36px;height:36px;border-radius:50%;background:${lvlColors[lvl]||'#cd7f32'};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#000">${lvl[0]}</div>
            <div>
              <div style="font-weight:700;font-size:15px;color:${lvlColors[lvl]||'#cd7f32'}">${lvl} Level</div>
              <div style="font-size:12px;color:#71717a">${xp} XP${g.nextLevel ? ' → ' + g.nextLevel + ' дүр ' + (g.xpToNextLevel||0) + ' XP дутна' : ' (Хамгийн дээд)'}</div>
            </div>
            <div style="margin-left:auto;text-align:right">
              <div style="font-size:12px;color:#71717a">Хэтэвч</div>
              <div style="font-size:16px;font-weight:700;color:#22c55e">₮${(g.walletBalance||0).toLocaleString()}</div>
            </div>
          </div>
          <div style="background:rgba(255,255,255,0.06);border-radius:99px;height:8px;overflow:hidden;margin-bottom:12px">
            <div style="height:100%;width:${progress}%;background:linear-gradient(90deg,${lvlColors[lvl]||'#cd7f32'},#fff3);border-radius:99px;transition:width 1s ease"></div>
          </div>
          <div style="font-size:12px;color:#71717a;margin-bottom:8px">🔗 Найзаа уриад мөнгө олоорой — найзынх нь авсан дүнгийн 5% танай хэтэвчид орно:</div>
          <div style="display:flex;gap:8px;align-items:center">
            <input readonly value="${g.affiliateLink||''}" style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 10px;color:#e4e4e7;font-size:11px;outline:none" id="aff-link-input">
            <button onclick="navigator.clipboard.writeText(document.getElementById('aff-link-input').value).then(()=>showT('🔗 Линк хуулагдлаа!'))" style="padding:8px 12px;background:#8b5cf6;color:#fff;border:none;border-radius:8px;font-size:12px;cursor:pointer">Хуулах</button>
          </div>
        </div>`;
      // Inject or update gamification card
      const existing = document.getElementById('gamification-card');
      if (existing) existing.outerHTML = gamHtml;
      else {
        const myOrders = document.getElementById('my-orders');
        if (myOrders) myOrders.insertAdjacentHTML('beforebegin', gamHtml);
      }
      // ── END GAMIFICATION ─────────────────────────────────────────────
    } else { logOut(); }
  }catch{}
}
if(authToken) document.getElementById('cw-row').style.display='flex';

// ── V18 PRODUCT QUICKVIEW OVERHAUL ──
let curQvId='';
let qvState = { color: null, size: null };

function selVariant(type, el, val) {
  const siblings = el.parentElement.querySelectorAll('.var-btn');
  siblings.forEach(node => node.classList.remove('active'));
  el.classList.add('active');
  qvState[type] = val;
  document.getElementById('qv-var-err').style.display = 'none';
}

function zoomImg(e) {
  const wrap = document.getElementById('qv-img-wrap');
  const pan = document.getElementById('qv-img-pan');
  const rect = wrap.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  pan.style.transform = `scale(1.8) translate(${50 - x}%, ${50 - y}%)`;
}

function resetZoom() { document.getElementById('qv-img-pan').style.transform = 'scale(1) translate(0,0)'; }

async function openQv(id){
  const p=ALL.find(x=>x.id===id); if(!p)return; curQvId=id;
  qvState = { color: null, size: null }; // Reset variants
  document.querySelectorAll('.var-btn').forEach(n => n.classList.remove('active'));
  document.getElementById('qv-var-err').style.display = 'none';

  // Set the pan background image
  document.getElementById('qv-img-pan').style.backgroundImage = `url(${p.img||P_IMGS[0]})`;
  
  document.getElementById('qv-cat').textContent=p.cat; document.getElementById('qv-name').textContent=p.name; document.getElementById('qv-price').textContent='₮'+p.price.toLocaleString();
  
  document.getElementById('qv-add').onclick = () => {
    if(!qvState.color || !qvState.size) {
      const errEl = document.getElementById('qv-var-err');
      errEl.style.display = 'block';
      errEl.style.animation = 'shake 0.4s ease-in-out';
      setTimeout(()=>errEl.style.animation='', 400);
      return;
    }
    const btn = document.getElementById('qv-add');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = 'Нэмэгдлээ ✓';
    btn.style.background = '#44ff88';
    btn.style.color = '#000';
    
    // Add variant identifiers to product payload
    const selectedProduct = {...p, name: `${p.name} (${qvState.color}, ${qvState.size})`, id: `${p.id}-${qvState.color}-${qvState.size}`};
    addToCart(selectedProduct);
    
    setTimeout(() => {
      document.getElementById('mo-quick').classList.remove('on');
      setTimeout(() => { btn.innerHTML = ogHtml; btn.style.background = ''; btn.style.color = ''; }, 300);
    }, 800);
  };
  
  document.getElementById('mo-quick').classList.add('on');
  
  try{
    const r=await fetch(API+'/api/v1/storefront/products/'+id+'/reviews'); const d=await r.json();
    document.getElementById('qv-rcnt').textContent=d.reviews.length;
    document.getElementById('qv-revs').innerHTML=d.reviews.map(x=>`<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.05);line-height:1.4"><div style="color:#d4a843;margin-bottom:4px">${'★'.repeat(x.rating)}${'☆'.repeat(5-x.rating)}</div><div style="font-weight:600;color:var(--bone);margin-bottom:2px">${x.userName||'Зочин'}</div><div>${x.text}</div><div style="font-size:9px;margin-top:4px">${new Date(x.date).toLocaleDateString()}</div></div>`).join('')||'Хамгийн эхний сэтгэгдлийг үлдээгээрэй';
  }catch{}
}
async function submitRev(){
  const rating=document.getElementById('qv-rat').value, text=document.getElementById('qv-rtx').value, userName=document.getElementById('my-name')?.textContent?.split(' ')[0]||'Зочин';
  if(!text)return;
  try{
    await fetch(API+'/api/v1/storefront/products/'+curQvId+'/reviews',{method:'POST',headers:apiHeaders(),body:JSON.stringify({rating:Number(rating),text,userName})});
    document.getElementById('qv-rtx').value=''; openQv(curQvId); showT('Сэтгэгдэл илгээгдлээ');
  }catch{}
}

// ── SEARCH — Backend API Connected ──
function oS(){document.getElementById('sm').classList.add('on');setTimeout(()=>document.getElementById('si').focus(),100);}
function cS(){document.getElementById('sm').classList.remove('on');}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape')cS();
  if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();oS();}
});
document.getElementById('si').addEventListener('keydown', async e => {
  if(e.key === 'Enter' && e.target.value.trim()) {
    cS();
    const q = e.target.value.trim();
    
    // Feature 3: AI Semantic Search
    const searchInput = e.target;
    searchInput.disabled = true;
    showT('🤖 AI ухаалаг хайлт хийж байна...', 'info');
    
    try {
      const r = await fetch(API+'/api/v1/ai/storefront/ai-search', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ query: q }) });
      const d = await r.json();
      searchInput.disabled = false;
      
      if(d.success && d.data.products.length) {
        const fetched = d.data.products.map((p, i) => ({
          id: p.id, name: p.name, cat: p.category?.name||'Ерөнхий', price: p.basePrice||0, img: p.media?.[0]?.url||P_IMGS[i%P_IMGS.length], badge: null
        }));
        ALL.push(...fetched);
        renderProds(fetched);
        go('products');
        const label = d.data.aiPowered ? `✨ AI: "${d.data.keywords.join(', ')}" — ${fetched.length} бараа` : `🔍 ${fetched.length} бараа олдлоо`;
        showT(label);
        return;
      }
    } catch {
      searchInput.disabled = false;
    }
    
    // Fallback: local filter or basic API search
    try {
      const r=await fetch(API+'/api/v1/products?search='+encodeURIComponent(q)+'&limit=20');
      const d=await r.json();
      if(d.success&&d.data.items.length){
        const fetched = d.data.items.map((p,i)=>({id:p.id,name:p.name,cat:p.category?.name||'Ерөнхий',price:p.basePrice||0,img:p.media?.[0]?.url||P_IMGS[i%P_IMGS.length],badge:null}));
        ALL.push(...fetched);
        renderProds(fetched);
        go('products');
        showT(d.data.total+' бараа олдлоо');
        return;
      }
    } catch {}
    
    const list=DEMO.filter(p=>p.name.toLowerCase().includes(q.toLowerCase()));
    renderProds(list.length?list:DEMO);
    go('products');
  }
});

// ── TOAST ──
let tt;
function showT(m){const el=document.getElementById('toast');document.getElementById('tmsg').textContent=m;el.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>el.classList.remove('on'),2800);}

function go(id){document.getElementById(id).scrollIntoView({behavior:'smooth'});}



// ── AI CHAT LOGIC ──
function tAi(){ document.getElementById('ai-p').classList.toggle('on'); }
async function sAi(){
  const i=document.getElementById('aii'); const v=i.value.trim(); if(!v)return;
  const b=document.getElementById('aib');
  i.value='';
  b.innerHTML+=`<div class="ai-msg user">${v}</div>`;
  const tId='tk_'+Date.now();
  b.innerHTML+=`<div class="ai-msg bot" id="${tId}" style="opacity:0.7">Бодож байна... <span class="tdot" style="display:inline-block"></span></div>`;
  b.scrollTop=b.scrollHeight;
  try{
    const r=await fetch(API+'/api/v1/storefront/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:v})});
    const d=await r.json();
    document.getElementById(tId).remove();
    let html = `<div class="ai-msg bot">${d.text||'Холболт салсан байна.'}</div>`;
    if(d.products && d.products.length > 0) {
      const cards = d.products.map(p => `
        <div style="background:var(--smoke2);border:1px solid var(--dim);border-radius:8px;padding:8px;margin-top:8px;display:flex;gap:12px;align-items:center;cursor:pointer" onclick="openQv('${p.id}')">
          <img src="${p.img||P_IMGS[0]}" style="width:40px;height:40px;object-fit:cover;border-radius:4px">
          <div style="flex:1">
            <div style="font-size:11px;font-weight:600;color:var(--bone);line-height:1.2;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${p.name}</div>
            <div style="font-family:var(--fm);color:var(--gold);font-size:12px">₮${p.price.toLocaleString()}</div>
          </div>
        </div>
      `).join('');
      html += `<div style="padding-left:12px;margin-bottom:12px">${cards}</div>`;
    }
    b.innerHTML += html;
  }catch{
    document.getElementById(tId)?.remove();
    b.innerHTML+=`<div class="ai-msg bot" style="color:#ff6b6b">AI туслах офлайн байна.</div>`;
  }
  b.scrollTop=b.scrollHeight;
}

loadProds();
loadCategories();
updCart(); // restore cart from localStorage

// ═══════════════════════════════════════════
// V14: CREATIVE FEATURES JAVASCRIPT
// ═══════════════════════════════════════════

// 🎰 SPIN WHEEL
const PRIZES = ['5%','10%','15%','Хүргэлт','Дахин'];
const COLORS = ['#ff3d00','#4488ff','#d4a843','#44ff88','#9c27b0'];
let spinning = false;

function drawWheel() {
  const c = document.getElementById('spin-canvas');
  if(!c) return;
  const ctx = c.getContext('2d');
  const cx = 140, cy = 140, r = 130;
  const arc = (2 * Math.PI) / PRIZES.length;
  PRIZES.forEach((p, i) => {
    ctx.beginPath();
    ctx.fillStyle = COLORS[i];
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, i * arc, (i + 1) * arc);
    ctx.fill();
    // Text
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(i * arc + arc / 2);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px Inter';
    ctx.textAlign = 'right';
    ctx.fillText(p, r - 16, 5);
    ctx.restore();
  });
}

function openSpin() {
  document.getElementById('spin-ov').classList.add('on');
  drawWheel();
}

// Feature 4: Track the won coupon code globally
let lastWonCoupon = null;

async function doSpin() {
  if(spinning) return;
  spinning = true;
  document.getElementById('spin-btn').disabled = true;
  document.getElementById('spin-result').textContent = '';
  document.getElementById('spin-code').style.display = 'none';
  
  try {
    const r = await fetch(API+'/api/v1/storefront/spin-wheel', {method:'POST', headers:{'Content-Type':'application/json'}});
    const d = await r.json();
    const prize = d.prize;
    const prizeIndex = PRIZES.findIndex(p => prize.label.includes(p));
    const segAngle = 360 / PRIZES.length;
    const targetAngle = 360 * 5 + (360 - (prizeIndex * segAngle + segAngle/2));
    
    const canvas = document.getElementById('spin-canvas');
    canvas.style.transform = `rotate(${targetAngle}deg)`;
    
    setTimeout(() => {
      document.getElementById('spin-result').textContent = '🎉 ' + prize.label + '!';
      if(prize.code) {
        document.getElementById('spin-code').textContent = prize.code;
        document.getElementById('spin-code').style.display = 'block';
        
        // Feature 4: Store won coupon globally and show auto-apply button
        lastWonCoupon = prize.code;
        const spinCodeEl = document.getElementById('spin-code');
        spinCodeEl.style.cursor = 'pointer';
        spinCodeEl.title = 'Хюдалдан авалтдаа шуух асрахад автоматаар херэглэгдэнэ !';
      }
      spinning = false;
      document.getElementById('spin-btn').disabled = false;
      canvas.style.transition = 'none';
      requestAnimationFrame(() => {
        canvas.style.transform = `rotate(${targetAngle % 360}deg)`;
        requestAnimationFrame(() => { canvas.style.transition = 'transform 4s cubic-bezier(.17,.67,.12,.99)'; });
      });
    }, 4200);
  } catch {
    spinning = false;
    document.getElementById('spin-btn').disabled = false;
    document.getElementById('spin-result').textContent = 'Алдаа гарлаа. Дахин оролдоно уу.';
  }
}

// ⚡ FLASH SALE
let flashEndsAt = null;

async function loadFlashSales() {
  try {
    const r = await fetch(API+'/api/v1/storefront/flash-sales');
    const d = await r.json();
    if(d.success && d.data.items.length) {
      flashEndsAt = new Date(d.data.endsAt);
      document.getElementById('flash-grid').innerHTML = d.data.items.map(p => `
        <div class="flash-card" onclick="openQv('${p.id}')">
          <div class="flash-badge">-${p.discount}%</div>
          <img class="flash-img" src="${p.img || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop'}">
          <div class="flash-info">
            <div class="flash-name">${p.name}</div>
            <div class="flash-prices">
              <span class="flash-sale-price">₮${p.salePrice.toLocaleString()}</span>
              <span class="flash-orig-price">₮${p.originalPrice.toLocaleString()}</span>
            </div>
            <div class="flash-stock">${p.stock} ширхэг үлдсэн</div>
            <div class="flash-stock-bar"><div class="flash-stock-fill" style="width:${Math.min(p.stock * 7, 100)}%"></div></div>
          </div>
        </div>
      `).join('');
      startFlashTimer();
    } else {
      // Use demo data for flash sale
      const demoFlash = DEMO.slice(0,3).map(p => ({...p, salePrice: Math.floor(p.price * 0.7), discount: 30, stock: Math.floor(Math.random()*12)+3}));
      flashEndsAt = new Date();
      flashEndsAt.setHours(23,59,59);
      document.getElementById('flash-grid').innerHTML = demoFlash.map(p => `
        <div class="flash-card" onclick="openQv('${p.id}')">
          <div class="flash-badge">-${p.discount}%</div>
          <img class="flash-img" src="${p.img || P_IMGS[0]}">
          <div class="flash-info">
            <div class="flash-name">${p.name}</div>
            <div class="flash-prices">
              <span class="flash-sale-price">₮${p.salePrice.toLocaleString()}</span>
              <span class="flash-orig-price">₮${p.price.toLocaleString()}</span>
            </div>
            <div class="flash-stock">${p.stock} ширхэг үлдсэн</div>
            <div class="flash-stock-bar"><div class="flash-stock-fill" style="width:${Math.min(p.stock*7,100)}%"></div></div>
          </div>
        </div>
      `).join('');
      startFlashTimer();
    }
  } catch {
    document.getElementById('flash-grid').innerHTML = '<div style="color:var(--dim);text-align:center;padding:60px;grid-column:span 3">Flash Sale ачааллахад алдаа</div>';
  }
}

function startFlashTimer() {
  if(!flashEndsAt) return;
  setInterval(() => {
    const now = new Date();
    let diff = Math.max(0, flashEndsAt - now) / 1000;
    const h = Math.floor(diff / 3600); diff %= 3600;
    const m = Math.floor(diff / 60);
    const s = Math.floor(diff % 60);
    document.getElementById('fs-h').textContent = String(h).padStart(2,'0');
    document.getElementById('fs-m').textContent = String(m).padStart(2,'0');
    document.getElementById('fs-s').textContent = String(s).padStart(2,'0');
  }, 1000);
}

// 👻 LIVE FEED / SOCIAL PROOF
let liveFeedData = [];
let liveFeedIndex = 0;

async function loadLiveFeed() {
  try {
    const r = await fetch(API+'/api/v1/storefront/live-feed');
    const d = await r.json();
    if(d.success && d.data.length) liveFeedData = d.data;
  } catch {}
  // If no real orders yet, we just return empty array and don't show notifications
  if(!liveFeedData.length) return;
  
  // Fallback: Show notifications from history every 5 minutes
  setInterval(() => {
    if(!liveFeedData.length) return;
    const item = liveFeedData[liveFeedIndex % liveFeedData.length];
    liveFeedIndex++;
    document.getElementById('ln-name').textContent = item.name;
    document.getElementById('ln-product').textContent = item.product;
    document.getElementById('ln-time').textContent = item.time + ' минутын өмнө';
    document.getElementById('live-notif').classList.add('show');
    setTimeout(() => document.getElementById('live-notif').classList.remove('show'), 5000);
  }, 300000);
  // First one after 8 seconds
  setTimeout(() => {
    if(!liveFeedData.length) return;
    const item = liveFeedData[0];
    document.getElementById('ln-name').textContent = item.name;
    document.getElementById('ln-product').textContent = item.product;
    document.getElementById('ln-time').textContent = item.time + ' минутын өмнө';
    document.getElementById('live-notif').classList.add('show');
    setTimeout(() => document.getElementById('live-notif').classList.remove('show'), 5000);
  }, 8000);
}

// 🎁 GIFT CARD
let gcAmount = 50000;

function selGcAmt(btn, amt) {
  gcAmount = amt;
  document.querySelectorAll('.gc-amt').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
}

async function doGiftCard() {
  const email = document.getElementById('gc-email').value;
  if(!email) return showT('Хүлээн авагчийн и-мэйл оруулна уу');
  try {
    const r = await fetch(API+'/api/v1/storefront/gift-cards', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ amount: gcAmount, senderName: document.getElementById('gc-sender').value, recipientEmail: email, message: document.getElementById('gc-msg').value })
    });
    const d = await r.json();
    if(d.success) {
      document.getElementById('gc-result').innerHTML = `<div style="background:rgba(68,255,136,.1);border:1px solid rgba(68,255,136,.3);padding:16px;border-radius:8px;margin-top:12px"><div style="font-weight:700;color:#44ff88;margin-bottom:4px">✅ Карт амжилттай үүслээ!</div><div style="font-family:var(--fm);font-size:24px;color:var(--bone);letter-spacing:2px">${d.code}</div><div style="font-size:12px;color:var(--dim);margin-top:4px">Дүн: ₮${d.amount.toLocaleString()}</div></div>`;
    } else showT(d.message || 'Алдаа');
  } catch { showT('Алдаа гарлаа'); }
}

// 🔍 COMPARE
let compareList = [];

function addToCompare() {
  const p = ALL.find(x => x.id === curQvId);
  if(!p) return;
  if(compareList.find(x => x.id === p.id)) return showT('Аль хэдийн нэмсэн');
  if(compareList.length >= 4) return showT('Хамгийн ихдээ 4 бараа');
  compareList.push(p);
  showT('⚖️ Харьцуулалтад нэмлээ (' + compareList.length + ')');
  renderCompare();
}

function renderCompare() {
  const g = document.getElementById('compare-grid');
  g.innerHTML = compareList.map(p => `
    <div class="compare-item">
      <button class="cx" style="position:absolute;top:4px;right:8px;font-size:12px" onclick="rmCompare('${p.id}')">✕</button>
      <img src="${p.img || P_IMGS[0]}">
      <div style="font-weight:600;color:var(--bone);font-size:13px;margin-bottom:4px">${p.name}</div>
      <div style="color:var(--dim);font-size:11px;margin-bottom:4px">${p.cat}</div>
      <div style="font-family:var(--fm);font-size:16px;color:var(--ember)">₮${p.price.toLocaleString()}</div>
      <button class="cobtn" style="margin-top:8px;padding:8px 16px;font-size:11px" onclick="aId('${p.id}')">Сагсанд</button>
    </div>
  `).join('');
  if(compareList.length > 0) {
    document.getElementById('compare-drawer').classList.add('on');
  }
}

function rmCompare(id) {
  compareList = compareList.filter(x => x.id !== id);
  renderCompare();
  if(!compareList.length) document.getElementById('compare-drawer').classList.remove('on');
}

function clearCompare() {
  compareList = [];
  document.getElementById('compare-grid').innerHTML = '';
  document.getElementById('compare-drawer').classList.remove('on');
}

// 🌙 DARK/LIGHT MODE
function toggleTheme() {
  document.body.classList.toggle('light-mode');
  const isLight = document.body.classList.contains('light-mode');
  localStorage.setItem('ws_theme', isLight ? 'light' : 'dark');
  const icon = isLight ? '☀️' : '🌙';
  document.getElementById('theme-btn').textContent = icon;
  document.getElementById('fab-theme').textContent = icon;
}
// Restore theme
if(localStorage.getItem('ws_theme') === 'light') {
  document.body.classList.add('light-mode');
  document.getElementById('theme-btn').textContent = '☀️';
  document.getElementById('fab-theme').textContent = '☀️';
}

// 🗣️ VOICE SEARCH
let voiceRecognition = null;

function toggleVoice() {
  const btn = document.getElementById('voice-btn');
  if(!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    return showT('Таны хөтөч дуут хайлтыг дэмждэггүй');
  }
  
  if(voiceRecognition) {
    voiceRecognition.stop();
    voiceRecognition = null;
    btn.classList.remove('recording');
    return;
  }
  
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  voiceRecognition = new SR();
  voiceRecognition.lang = 'mn-MN';
  voiceRecognition.continuous = false;
  
  voiceRecognition.onstart = () => { btn.classList.add('recording'); showT('🎤 Ярина уу...'); };
  voiceRecognition.onresult = (e) => {
    const text = e.results[0][0].transcript;
    btn.classList.remove('recording');
    voiceRecognition = null;
    // Open search and fill
    oS();
    document.getElementById('si').value = text;
    showT('🎤 "' + text + '"');
  };
  voiceRecognition.onerror = () => { btn.classList.remove('recording'); voiceRecognition = null; };
  voiceRecognition.onend = () => { btn.classList.remove('recording'); voiceRecognition = null; };
  
  voiceRecognition.start();
}

// 🔔 PRICE ALERT
async function doPriceAlert() {
  const email = prompt('Үнэ буурахад мэдэгдэх и-мэйлээ оруулна уу:');
  if(!email) return;
  try {
    const r = await fetch(API+'/api/v1/storefront/price-alert', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ productId: curQvId, email })
    });
    const d = await r.json();
    if(d.success) showT('🔔 ' + d.message);
    else showT('Алдаа гарлаа');
  } catch { showT('Алдаа гарлаа'); }
}

// Initialize V14 features
loadFlashSales();

// INITIALIZE AI UI (V21)
async function fetchAiUI() {
  try {
    const res = await fetch(API+'/api/v1/storefront/ai-ui');
    const d = await res.json();
    if(d.success && d.data) {
      d.data.forEach(comp => {
        const el = document.getElementById('ai-injected-ui-' + comp.location);
        if(el) el.innerHTML = comp.html;
      });
    }
  } catch(e) {}
}
fetchAiUI();
loadLiveFeed();
drawWheel();

// V44: GLOBAL STOREFRONT SOCKET.IO LISTENERS
if (typeof io !== 'undefined') {
  const socket = io();
  
  socket.on('live_purchase', (item) => {
    const eName = document.getElementById('ln-name');
    if (eName) {
      eName.textContent = item.name;
      document.getElementById('ln-product').textContent = item.product;
      document.getElementById('ln-time').textContent = item.time || 'Дөнгөж сая';
      const notif = document.getElementById('live-notif');
      notif.classList.remove('show');
      void notif.offsetWidth; // force reflow
      notif.classList.add('show');
      setTimeout(() => notif.classList.remove('show'), 5000);
    }
  });
  
  socket.on('stock_low', (data) => {
    // Only show if the user is looking at this product or general scarcity toast
    showT(`🔥 Яараарай! ${data.name} ердөө ${data.quantity} ширхэг үлдлээ!`);
    
    // Update UI if quickview is open
    if (curQvId === data.productId) {
      const stockEl = document.getElementById('qv-stock');
      if (stockEl) {
        stockEl.className = 'qv-stock low'; 
        stockEl.textContent = `● Цөөн үлдсэн: ${data.quantity}`;
      }
    }
  });
  
  socket.on('price_drop', (data) => {
    showT(`📉 ҮНЭ УНАСАН: ${data.name} одоо ₮${data.newPrice.toLocaleString()} боллоо!`);
  });
}

// ═══════════════════════════════════════════
// V17: SHOPIFY FEATURES JAVASCRIPT
// ═══════════════════════════════════════════

// 📋 RECENTLY VIEWED
const RV_KEY = 'ws_recently_viewed';
function getRecentlyViewed() { try { return JSON.parse(localStorage.getItem(RV_KEY) || '[]'); } catch { return []; } }
function addRecentlyViewed(p) {
  let rv = getRecentlyViewed().filter(x => x.id !== p.id);
  rv.unshift({ id: p.id, name: p.name, price: p.price, img: p.img, cat: p.cat });
  if (rv.length > 10) rv = rv.slice(0, 10);
  localStorage.setItem(RV_KEY, JSON.stringify(rv));
  renderRecentlyViewed();
}
function renderRecentlyViewed() {
  const rv = getRecentlyViewed();
  const sec = document.getElementById('rv-section');
  const wrap = document.getElementById('rv-scroll');
  if (!rv.length) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';
  wrap.innerHTML = rv.map(p => `
    <div class="rv-card" onclick="openQv('${p.id}')">
      <img src="${p.img || P_IMGS[0]}" alt="${p.name}" loading="lazy">
      <div class="rv-card-info">
        <div class="rv-card-name">${p.name}</div>
        <div class="rv-card-price">₮${p.price.toLocaleString()}</div>
      </div>
    </div>
  `).join('');
}
renderRecentlyViewed();

// 🚚 FREE SHIPPING BAR
const FREE_SHIP_MIN = 50000;
function updShipBar() {
  const sub = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const pct = Math.min((sub / FREE_SHIP_MIN) * 100, 100);
  const fill = document.getElementById('ship-fill');
  const text = document.getElementById('ship-text');
  if (fill) fill.style.width = pct + '%';
  if (text) {
    if (sub >= FREE_SHIP_MIN) {
      text.innerHTML = '🎉 <em>Үнэгүй хүргэлт</em> идэвхжлээ!';
    } else {
      const rem = FREE_SHIP_MIN - sub;
      text.innerHTML = `₮<em>${rem.toLocaleString()}</em>-г нэмбэл <em>Үнэгүй хүргэлт!</em>`;
    }
  }
}

// 🔝 BACK TO TOP
window.addEventListener('scroll', () => {
  const btt = document.getElementById('btt');
  if (btt) btt.classList.toggle('show', window.scrollY > 600);
});

// 🔗 SOCIAL SHARE
function shareTo(platform) {
  const p = ALL.find(x => x.id === curQvId);
  if (!p) return;
  const url = window.location.href;
  const text = `${p.name} - ₮${p.price.toLocaleString()} | WEBSHOP`;
  switch(platform) {
    case 'fb': window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`, '_blank'); break;
    case 'tw': window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank'); break;
    case 'copy':
      navigator.clipboard.writeText(url).then(() => showT('🔗 Холбоос хуулагдлаа!'));
      break;
  }
}

// 📦 STOCK STATUS & DELIVERY in openQv (patch)
const origOpenQv = openQv;
openQv = async function(id) {
  await origOpenQv(id);
  const p = ALL.find(x => x.id === id);
  if (!p) return;
  // Add to recently viewed
  addRecentlyViewed(p);
  // Stock status
  const stockEl = document.getElementById('qv-stock');
  if (stockEl) {
    const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const stockLevel = hash % 10;
    if (stockLevel < 2) { stockEl.className = 'qv-stock out'; stockEl.textContent = '● Дууссан'; }
    else if (stockLevel < 4) { stockEl.className = 'qv-stock low'; stockEl.textContent = '● Цөөн үлдсэн (хурдалж захиалаарай!)'; }
    else { stockEl.className = 'qv-stock in'; stockEl.textContent = '● Бэлэн нөөцтэй'; }
  }
  // Related products
  const relEl = document.getElementById('qv-related');
  if (relEl) {
    const related = ALL.filter(x => x.cat === p.cat && x.id !== id).slice(0, 4);
    relEl.innerHTML = related.map(r => `
      <div style="min-width:100px;cursor:pointer;text-align:center" onclick="openQv('${r.id}')">
        <img src="${r.img || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop'}" style="width:80px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--smoke2)">
        <div style="font-size:10px;color:var(--bone);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px">${r.name}</div>
        <div style="font-size:10px;color:var(--ember);font-family:var(--fm)">₮${r.price.toLocaleString()}</div>
      </div>
    `).join('') || '<div style="font-size:11px;color:var(--dim)">Төстэй бараа олдсонгүй</div>';
  }
};

// Patch updCart to also update shipping bar
const origUpdCart = updCart;
updCart = function() {
  origUpdCart();
  updShipBar();
};
updShipBar();

// 🤖 V23 AI NEGOTIATOR CHATBOT UI
const chatHTML = `
<style>
#ai-chat-btn { position:fixed; bottom:20px; right:20px; width:60px; height:60px; background:var(--pri); border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 10px 25px rgba(139,92,246,0.5); z-index:9999; transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
#ai-chat-btn:hover { transform:scale(1.1) rotate(5deg); }
#ai-chat-btn svg { width:30px; height:30px; fill:none; stroke:#fff; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
#ai-chat-win { position:fixed; bottom:90px; right:20px; width:360px; height:500px; max-height:80vh; max-width:90vw; background:rgba(20,20,20,0.85); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px); border:1px solid rgba(255,255,255,0.1); border-radius:20px; display:none; flex-direction:column; z-index:9998; overflow:hidden; box-shadow:0 15px 40px rgba(0,0,0,0.6); }
#ai-chat-win.open { display:flex; animation:aiWinShow 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
#ai-chat-head { padding:18px 20px; background:rgba(30,30,30,0.9); border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center; }
#ai-chat-head h3 { margin:0; font-size:16px; color:#fff; font-family:var(--fm); display:flex; align-items:center; gap:10px; font-weight:600; }
#ai-chat-close { cursor:pointer; color:var(--dim); font-size:24px; line-height:1; transition:0.2s; }
#ai-chat-close:hover { color:#fff; }
#ai-chat-msgs { flex:1; padding:20px; overflow-y:auto; display:flex; flex-direction:column; gap:12px; scroll-behavior:smooth; }
#ai-chat-msgs::-webkit-scrollbar { width:6px; }
#ai-chat-msgs::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:3px; }
.ai-msg-bubble { max-width:85%; padding:12px 16px; border-radius:16px; font-size:14px; line-height:1.5; word-wrap:break-word; animation:aiMsgPop 0.3s ease; }
.ai-msg-bubble.ai { background:rgba(255,255,255,0.05); color:var(--bone); align-self:flex-start; border-bottom-left-radius:4px; }
.ai-msg-bubble.user { background:linear-gradient(135deg, var(--pri), #7c3aed); color:#fff; align-self:flex-end; border-bottom-right-radius:4px; box-shadow:0 4px 15px rgba(139,92,246,0.3); }
#ai-chat-form { padding:15px; border-top:1px solid rgba(255,255,255,0.05); display:flex; gap:10px; background:rgba(15,15,15,0.95); }
#ai-chat-input { flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); padding:12px 18px; border-radius:24px; color:#fff; outline:none; font-family:var(--fm); font-size:14px; transition:0.2s; }
#ai-chat-input:focus { border-color:var(--pri); background:rgba(255,255,255,0.1); }
#ai-chat-submit { background:var(--pri); border:none; color:#fff; width:44px; height:44px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.2s; flex-shrink:0; }
#ai-chat-submit:hover { background:#7c3aed; transform:scale(1.05); }
@keyframes aiWinShow { from { opacity:0; transform:translateY(30px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
@keyframes aiMsgPop { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
</style>
<div id="ai-chat-btn" onclick="document.getElementById('ai-chat-win').classList.toggle('open')">
  <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
</div>
<div id="ai-chat-win">
  <div id="ai-chat-head">
    <h3><span style="font-size:18px">✨</span> AI Худалдааны Зөвлөх</h3>
    <div id="ai-chat-close" onclick="document.getElementById('ai-chat-win').classList.remove('open')">&times;</div>
  </div>
  <div id="ai-chat-msgs">
    <div class="ai-msg-bubble ai">Сайн байна уу! Би танд туслах AI Худалдааны Зөвлөх байна. Танд сонирхож буй бараа байгаа юу?</div>
  </div>
  <form id="ai-chat-form" onsubmit="sendAiChat(event)">
    <input type="text" id="ai-chat-input" placeholder="Асуух..." autocomplete="off">
    <button type="submit" id="ai-chat-submit"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></button>
  </form>
</div>
`;
document.body.insertAdjacentHTML('beforeend', chatHTML);

let chatHistoryStr = '';
async function sendAiChat(e) {
  e.preventDefault();
  const inp = document.getElementById('ai-chat-input');
  const txt = inp.value.trim();
  if(!txt) return;
  inp.value = '';
  
  const box = document.getElementById('ai-chat-msgs');
  box.innerHTML += `<div class="ai-msg-bubble user">${txt}</div>`;
  box.scrollTop = box.scrollHeight;
  
  const loadingId = 'load-'+Date.now();
  box.innerHTML += `<div id="${loadingId}" class="ai-msg-bubble ai" style="opacity:0.6;font-style:italic">Бодож байна...</div>`;
  box.scrollTop = box.scrollHeight;
  
  try {
    const r = await fetch(API+'/api/v1/storefront/ai/chat', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ message: txt, chatHistory: chatHistoryStr })
    });
    const d = await r.json();
    const ldr = document.getElementById(loadingId);
    if(ldr) ldr.remove();
    
    if(d.success) {
      box.innerHTML += `<div class="ai-msg-bubble ai">${d.data.reply}</div>`;
      chatHistoryStr += `User: ${txt}\nAI: ${d.data.reply}\n`;
      // If AI generated a promo, auto apply it if possible, or just user copies it
      if (d.data.promo) {
         // Auto apply to cart or show toast
         setTimeout(() => showT(`🎉 Хямдралын код: ${d.data.promo} хүлээн авлаа!`), 500);
      }
    } else {
      box.innerHTML += `<div class="ai-msg-bubble ai" style="color:#ef4444">Уучлаарай, алдаа гарлаа.</div>`;
    }
    box.scrollTop = box.scrollHeight;
  } catch(err) {
    const ldr = document.getElementById(loadingId);
    if(ldr) ldr.remove();
    box.innerHTML += `<div class="ai-msg-bubble ai" style="color:#ef4444">Сүлжээний алдаа.</div>`;
  }
}
