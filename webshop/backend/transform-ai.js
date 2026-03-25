const fs = require('fs');
let code = fs.readFileSync('modules/ai/routes.ts', 'utf-8');

// Provide missing boilerplate
const header = `// @ts-nocheck
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../../middleware/logger';

export const aiRouter = Router();
// ISOLATED PRISMA INSTANCE (Rule 3)
const prisma = new PrismaClient({ log: ['error'] });

`;

code = header + code;

// Replace app.method with aiRouter.method
code = code.replace(/app\.(get|post|put|delete|all|use)\(/g, 'aiRouter.$1(');

// Replace template strings like `${BASE}/ai/recommend` with `'/recommend'` 
// Actually since we will mount at /api/v1 (or /api/v1/ai), let's strip ${BASE} and strip /ai if we mount at /ai, 
// or let's mount at BASE and just replace `${BASE}/` with `/`.
code = code.replace(/\`\$\{BASE\}\//g, "'/");

// Export runAiWatcher and others if needed
code = code.replace('function runAiWatcher', 'export function runAiWatcher');

fs.writeFileSync('modules/ai/routes.ts', code);
console.log('Transformed modules/ai/routes.ts');
