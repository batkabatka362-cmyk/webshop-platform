const fs = require('fs');
let content = fs.readFileSync('c:/Users/local_ybjuj27/Desktop/webshop-production-final/webshop-frontend/index.html', 'utf8');

// The goal: 
// - Header
// - Search
// - Horizontal Categories (Angilal)
// - Banner overlaying "yagaad bidniig songoh we" maybe further down
// - Products Grid

const newCSS = `
/* Additional App UI CSS for exact structural matching */
.app-cats-wrapper { padding: 16px 0 16px 24px; background: #fff; margin-bottom: 8px; border-bottom: 1px solid #f0f0f0; }
.app-cats-title { font-size: 16px; font-weight: 700; color: #1a1a1a; margin-bottom: 16px; display: flex; justify-content: space-between; padding-right: 24px; }
.app-cats-scroll { display: flex; gap: 16px; overflow-x: auto; scrollbar-width: none; padding-right: 24px; padding-bottom: 8px; }
.app-cats-scroll::-webkit-scrollbar { display: none; }
.cat-bubble { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 72px; cursor: pointer; }
.cat-bubble-icon { width: 56px; height: 56px; border-radius: 50%; background: #f0f4f8; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #007bff; border: 1px solid #e2e8f0; transition: transform 0.2s; }
.cat-bubble-icon:hover { transform: translateY(-3px); box-shadow: 0 4px 12px rgba(0,123,255,0.15); border-color: #007bff; }
.cat-bubble-name { font-size: 11px; font-weight: 600; color: #333; text-align: center; }

.app-h-scroll-section { padding: 24px 0 24px 24px; background: #fff; margin-bottom: 8px; }
.app-h-scroll-title { font-size: 16px; font-weight: 700; color: #1a1a1a; margin-bottom: 16px; display: flex; justify-content: space-between; padding-right: 24px; align-items: end; }
.app-h-scroll-more { font-size: 12px; color: #007bff; font-weight: 600; text-decoration: none; }
.h-prod-scroll { display: flex; gap: 16px; overflow-x: auto; scrollbar-width: none; padding-right: 24px; padding-bottom: 16px; scroll-snap-type: x mandatory; }
.h-prod-scroll::-webkit-scrollbar { display: none; }
.h-prod-card { flex: 0 0 160px; scroll-snap-align: start; }

.pgrid { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; padding: 0 16px !important; }
.pc { border-radius: 12px !important; }
`;

// Insert the CSS before </style> securely
content = content.replace('</style>', newCSS + '\n</style>');

// Build the new specific DOM layout for the body top
const layoutDOM = `
<header class="app-header">
  <div class="h-left">
    <a href="index.html" class="h-logo"><img src="https://ui-avatars.com/api/?name=WS&background=random" style="width:28px;height:28px;border-radius:50%;margin-right:8px;vertical-align:middle;"> WEB<span>SHOP</span></a>
  </div>
  <div class="h-right">
    <button class="icon-btn" onclick="tC()"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></button>
    <button class="icon-btn" onclick="document.getElementById('nlinks').classList.toggle('mob-open')"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
  </div>
</header>

<div class="app-search" style="padding-bottom:12px; border-bottom:none;">
  <div class="search-box" onclick="oS()" style="background:#f4f5f7; border:none;">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <span style="color:#666; font-size:14px; font-weight:500;">Бүтээгдэхүүн хайх...</span>
  </div>
</div>

<div class="app-cats-wrapper" id="hz-cats">
  <div class="app-cats-scroll" id="hz-cat-scroll">
    <!-- Categories injected here -->
    <div class="cat-bubble"><div class="cat-bubble-icon">📱</div><div class="cat-bubble-name">Утас</div></div>
    <div class="cat-bubble"><div class="cat-bubble-icon">💻</div><div class="cat-bubble-name">Компьютер</div></div>
    <div class="cat-bubble"><div class="cat-bubble-icon">🎧</div><div class="cat-bubble-name">Чихэвч</div></div>
    <div class="cat-bubble"><div class="cat-bubble-icon">👟</div><div class="cat-bubble-name">Гутал</div></div>
    <div class="cat-bubble"><div class="cat-bubble-icon">👕</div><div class="cat-bubble-name">Хувцас</div></div>
    <div class="cat-bubble"><div class="cat-bubble-icon">🏠</div><div class="cat-bubble-name">Гэр ахуй</div></div>
  </div>
</div>

<div class="app-banner" style="padding-top:8px;">
  <img src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=1000&auto=format&fit=crop" style="width:100%;height:160px;object-fit:cover;border-radius:16px;box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
</div>
`;

// Find the start of app-header and the end of app-why
const startHeader = content.indexOf('<header class="app-header">');
const endWhy = content.indexOf('</div>\n</div>\n', content.indexOf('<div class="app-why">')) + 14;

if(startHeader !== -1 && endWhy !== -1) {
  content = content.substring(0, startHeader) + layoutDOM + content.substring(endWhy);
}

// Ensure products section matches UI better
content = content.replace(/<div class="s-head-row reveal-up">/, '<div class="app-h-scroll-title" style="padding:0"><div><h2 class="why-title" style="margin-bottom:0">Бүх <span>бүтээгдэхүүн</span></h2></div></div><div class="s-head-row reveal-up" style="display:none">');

// Override loadCats function natively to populate the new horizontal scroll
const catScript = `
async function loadCats() { 
  try { 
    const r=await fetch(API+'/api/v1/categories'); 
    const d=await r.json(); 
    if(d.success && d.data.length > 0) {
       const icons = ['✨','🔥','📦','🏷️','💎','🌟'];
       let hhtml = '';
       d.data.forEach((c, i) => {
         hhtml += \`<div class="cat-bubble" onclick="selCat('\${c.name}')"><div class="cat-bubble-icon">\${icons[i%icons.length]}</div><div class="cat-bubble-name">\${c.name}</div></div>\`;
       });
       const scroll = document.getElementById('hz-cat-scroll');
       if(scroll) scroll.innerHTML = hhtml;
    }
  } catch{} 
}
`;
content = content.replace(/async function loadCats\(\).*?\}\s*}/g, catScript);

fs.writeFileSync('c:/Users/local_ybjuj27/Desktop/webshop-production-final/webshop-frontend/index.html', content, 'utf8');
console.log('Update Complete Part 2!');
