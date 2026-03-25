const fs = require('fs');

let aiContents = fs.readFileSync('modules/ai/routes.ts', 'utf8').split('\n');

const startIdx = aiContents.findIndex(l => l.includes('// Categories'));
const endIdx = aiContents.findIndex(l => l.includes('// Storefront features'));

if (startIdx !== -1 && endIdx !== -1) {
    // We need to extract from startIdx up to endIdx + 2 (to include the app.use line)
    // Wait, let's just grab everything until the blank line after storefrontRouter
    let extracted = aiContents.slice(startIdx, endIdx + 2).join('\n');
    
    // Fix syntax
    extracted = extracted.replace(/aiRouter\.get\('\/categories',/g, 'app.get(`${BASE}/categories`,');
    extracted = extracted.replace(/aiRouter\.use\('\/([^']+)',/g, 'app.use(`${BASE}/$1`,');

    // Remove from AI routes
    aiContents.splice(startIdx, endIdx - startIdx + 3);
    fs.writeFileSync('modules/ai/routes.ts', aiContents.join('\n'));

    // Insert into server.ts at the correct location
    let serverContents = fs.readFileSync('server.ts', 'utf8');
    serverContents = serverContents.replace('app.use(BASE, aiRouter)', extracted + '\n\napp.use(BASE, aiRouter)');
    fs.writeFileSync('server.ts', serverContents);

    console.log('SUCCESS: Moved routes back to server.ts');
} else {
    console.log('FAILED to find indices in AI routes');
}
