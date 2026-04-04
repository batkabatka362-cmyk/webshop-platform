const fs = require('fs');
let content = fs.readFileSync('c:/Users/local_ybjuj27/Desktop/webshop-production-final/webshop-frontend/index.html', 'utf8');

// 1. Force light mode globally by overriding CSS root
const newCSSOverride = `
/* APP OVERRIDE CSS */
:root {
  --void: #ffffff !important;
  --deep: #f8f9fa !important;
  --bone: #1a1a1a !important;
  --text: #333333 !important;
  --dim: #777777 !important;
  --smoke: #e5e7eb !important;
  --smoke2: #f3f4f6 !important;
  --ember: #007bff !important;
  --ember2: #0056b3 !important;
}
body { background: var(--void) !important; color: var(--text) !important; font-family: -apple-system, sans-serif !important; }
.noise, .smoke-bg, canvas#particles-c, #cur, #cur2, #cur3, .ticker { display: none !important; }

/* LAYOUT */
.app-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background: #fff; position: sticky; top: 0; z-index: 100; }
.h-logo { display: flex; align-items: center; font-size: 16px; font-weight: 800; letter-spacing: -0.5px; color: #000; text-transform: uppercase; text-decoration: none; }
.h-logo span { color: #f00; font-weight: 400; }
.icon-btn { background: none; border: none; padding: 8px; cursor: pointer; color: #333; }
.app-search { padding: 4px 24px 16px; background: #fff; border-bottom: 1px solid #eee; }
.search-box { width: 100%; border: 1px solid #e0e0e0; border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; gap: 12px; color: #999; cursor: pointer; background: #fafafa; font-size: 14px; }
.app-banner { padding: 16px 24px; }
.app-why { padding: 32px 24px; text-align: center; }
.why-title { font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
.why-title span { color: #007bff; }
.why-sub { font-size: 13px; color: #666; margin-bottom: 32px; line-height: 1.5; padding: 0 10%; }
.why-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.wc { background: #fafafa; border: 1px solid #f0f0f0; border-radius: 16px; padding: 24px 16px; text-align: center; transition: all .2s; }
.wci { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; margin: 0 auto 16px; color: #fff; }
.wci-blue { background: #007bff; }
.wci-teal { background: #20c997; }
.wci-purple { background: #8a2be2; }
.wci-pink { background: linear-gradient(135deg, #e83e8c, #ff758c); }
.wcn { font-size: 14px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
.wcd { font-size: 12px; color: #777; line-height: 1.4; }

.bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; height: 60px; background: #fff; border-top: 1px solid #eee; display: flex; justify-content: space-around; align-items: center; z-index: 1000; padding-bottom: env(safe-area-inset-bottom); }
.bn-item { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-decoration: none; color: #999; font-size: 10px; font-weight: 600; width: 60px; }
.bn-item.active { color: #007bff; }
.bn-icon { font-size: 20px; }
.bn-item.active .bn-icon { filter: drop-shadow(0 2px 4px rgba(0,123,255,0.3)); }

.fab-bot { position: fixed; bottom: 80px; right: 24px; width: 56px; height: 56px; border-radius: 50%; background: #007bff; border: none; box-shadow: 0 4px 12px rgba(0,123,255,0.3); color: #fff; font-size: 24px; cursor: pointer; z-index: 999; display: flex; align-items: center; justify-content: center; }
.fab-bot::after { content: ''; position: absolute; top: 4px; right: 4px; width: 10px; height: 10px; background: #44ff88; border-radius: 50%; border: 2px solid #fff; }

/* Hiding old redundant sections */
nav#nav, .hero, .sp#featured, .manifesto, .promo3, .nl, footer, .btt, .stats-section, #home_banner, .trust-section, .rv-section { display: none !important; }
.pgrid { background: transparent !important; gap: 16px !important; padding: 0 24px; border: none !important; }
.pc { background: #fff !important; border: 1px solid #eee !important; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.03) !important; padding:0; flex-direction: column; }
.pph::after { display: none !important; }
.pname { color: #1a1a1a !important; font-weight: 600 !important; font-size: 14px !important; margin-bottom: 4px !important; }
.pprice { color: #1a1a1a !important; font-size: 16px !important; font-weight: 700 !important; }
.pcat { color: #888 !important; font-size: 11px !important; margin-bottom: 8px !important; }
.pi { padding: 16px !important; border-top: 1px solid #eee !important; background: #fafafa; border-radius: 0 0 16px 16px; }
.cgrid { background: transparent !important; gap: 16px !important; padding: 0 24px; grid-template-columns: repeat(2, 1fr) !important; border: none !important; }
.cc { background: #f8f9fa !important; border-radius: 16px; min-height: 120px !important; padding: 20px !important; border: 1px solid #eee; display: flex; align-items: flex-end; justify-content: flex-start;  }
.cc-name { color: #1a1a1a !important; font-size: 16px !important; letter-spacing: 0 !important; font-weight: 600 !important; text-align: left; }
.cc::before { display: none !important; }
.cc-arrow { background: #fff !important; border-color: #eee !important; color: #333 !important; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }

/* Remove global dark borders */
.sp { border: none !important; padding: 40px 0 !important; }
.s-title { line-height: 1.2 !important; font-size: 20px !important; background: transparent; padding: 0 24px; color: #1a1a1a !important; }
.s-ey { padding: 0 24px; color: #007bff !important; }
.ftabs { padding: 0 24px !important; margin-bottom: 24px !important; }

</style>
`;

content = content.replace('</style>', newCSSOverride);

// 2. Insert new DOM after body open
const newDOM = `
<header class="app-header">
  <div class="h-left">
    <a href="index.html" class="h-logo"><img src="https://ui-avatars.com/api/?name=WS&background=random" style="width:28px;height:28px;border-radius:50%;margin-right:8px;vertical-align:middle;"> WEB<span>SHOP</span></a>
  </div>
  <div class="h-right">
    <button class="icon-btn" onclick="tC()"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></button>
    <button class="icon-btn" onclick="document.getElementById('nlinks').classList.toggle('mob-open')"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
  </div>
</header>
<div class="app-search">
  <div class="search-box" onclick="oS()">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <span>Хайх...</span>
  </div>
</div>
<div class="app-banner">
  <img src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=1000&auto=format&fit=crop" style="width:100%;height:140px;object-fit:cover;border-radius:16px;">
</div>
<div class="app-why">
  <h2 class="why-title">Яагаад <span>биднийг</span> сонгох вэ?</h2>
  <p class="why-sub">Манай үйлчилгээний давуу тал, чанартай бүтээгдэхүүн</p>
  <div class="why-grid">
    <div class="wc"><div class="wci wci-blue">⚡</div><div class="wcn">Хурдан хүргэлт</div><div class="wcd">Улаанбаатар хотод ойрхон өдөр хүргэлт</div></div>
    <div class="wc"><div class="wci wci-teal">🛡️</div><div class="wcn">Баталгаа</div><div class="wcd">Бүх бүтээгдэхүүнд албан ёсны баталгаа</div></div>
    <div class="wc"><div class="wci wci-purple">🎧</div><div class="wcn">24/7 дэмжлэг</div><div class="wcd">Техникийн дэмжлэг, зөвлөгөө үйлчилгээ</div></div>
    <div class="wc"><div class="wci wci-pink">🛍️</div><div class="wcn">Олон төрөл</div><div class="wcd">10,000+ бүтээгдэхүүний сонголт</div></div>
  </div>
</div>
`;

content = content.replace('<body>', '<body>\n' + newDOM);

// 3. Insert FAB and Bottom Nav right before </body>
const bottomDOM = `
<button class="fab-bot" onclick="tAi()" aria-label="Chat">🤖</button>
<div class="bottom-nav">
  <a href="#" class="bn-item active"><div class="bn-icon">🏠</div><div>Нүүр</div></a>
  <a href="#products" class="bn-item"><div class="bn-icon">📦</div><div>Бараа</div></a>
  <a href="#cats" class="bn-item"><div class="bn-icon">🗂️</div><div>Ангилал</div></a>
  <a href="javascript:doGiftCard()" class="bn-item"><div class="bn-icon">🔧</div><div>Үйлчилгээ</div></a>
  <a href="javascript:tAuth()" class="bn-item"><div class="bn-icon">👤</div><div>Нэвтрэх</div></a>
</div>
<div style="height:80px"></div>
`;

content = content.replace('</body>', bottomDOM + '\n</body>');

fs.writeFileSync('c:/Users/local_ybjuj27/Desktop/webshop-production-final/webshop-frontend/index.html', content, 'utf8');
console.log('Update Complete!');
