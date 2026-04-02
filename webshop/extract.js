const fs = require('fs');
fs.mkdirSync('public/css', {recursive: true});
fs.mkdirSync('public/js', {recursive: true});

function extract(filePath, styleOut, scriptOut) {
  let html = fs.readFileSync(filePath, 'utf8');
  
  // Extract CSS
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  if (styleMatch) {
    fs.writeFileSync(styleOut, styleMatch[1]);
    html = html.replace(styleMatch[0], `<link rel="stylesheet" href="/${styleOut.replace('public/', '')}">`);
  }
  
  const scriptRegex = /<script>([\s\S]*?)<\/script>/;
  const scriptMatch = html.match(scriptRegex);
  
  if (scriptMatch) {
    fs.writeFileSync(scriptOut, scriptMatch[1]);
    html = html.replace(scriptMatch[0], `<script src="/${scriptOut.replace('public/', '')}" defer></script>`);
  }

  fs.writeFileSync(filePath, html);
  console.log(`Extracted ${filePath} -> CSS: ${styleOut}, JS: ${scriptOut}`);
}

extract('public/index.html', 'public/css/global.css', 'public/js/storefront.js');
extract('public/admin.html', 'public/css/admin.css', 'public/js/admin.js');
