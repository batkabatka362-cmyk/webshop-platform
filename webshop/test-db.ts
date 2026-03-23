import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
console.log(Object.keys(p));
