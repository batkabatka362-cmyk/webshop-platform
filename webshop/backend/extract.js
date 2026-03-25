const fs = require('fs');
const lines = fs.readFileSync('server.ts', 'utf-8').split('\n');
const start = lines.findIndex(l => l.includes('V18: AI AUTOMATION ENGINE'));
const end = lines.findIndex(l => l.includes('Static media files'));
if (start !== -1 && end !== -1) {
  // Take lines from "V18" to "Static media files"
  const extracted = lines.slice(start - 1, end).join('\n');
  fs.writeFileSync('modules/ai/routes.ts', extracted);
  // Reconstruct server.ts without the AI block
  const remaining = [...lines.slice(0, start - 1), ...lines.slice(end)].join('\n');
  fs.writeFileSync('server.ts', remaining);
  console.log('SUCCESS: Extracted lines ' + start + ' to ' + end);
} else {
  console.log('FAILED: start=' + start + ' end=' + end);
}
