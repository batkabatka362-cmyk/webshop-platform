import { PrismaClient } from '@prisma/client';
import { InventoryService } from '../backend/inventory-system/services';
import { RealtimeService } from '../backend/infrastructure/realtime.service';

const prisma = new PrismaClient();
const inventoryService = new InventoryService();

// Mock out the RealtimeService temporarily to avoid socket init errors in pure script run
RealtimeService.notifyStockLow = () => {};

async function runStressTest() {
  console.log('--- STARTING STRESS TEST ---');
  
  // 1. Create a dummy product
  const sku = `STRESS-${Date.now()}`;
  const product = await prisma.product.create({
    data: {
      name: 'Stress Test Item',
      slug: sku.toLowerCase(),
      sku: sku,
      basePrice: 1000,
      status: 'active'
    }
  });

  // 2. Initialize inventory to 10
  await inventoryService.initInventory(product.id, 10, 'TEST_WH');
  
  // Verify initial
  const startInv = await inventoryService.getStock(product.id);
  console.log(`Initial stock: quantity=${startInv.quantity}, reserved=${startInv.reserved}, available=${startInv.available}`);

  // 3. Attempt 50 concurrent hard reservations of 1 item each
  console.log('Launching 50 concurrent reservation requests...');
  const promises = [];
  for (let i = 0; i < 50; i++) {
    // We expect only 10 to succeed, and 40 to fail.
    // If the race condition exists, way more might succeed!
    promises.push(
      inventoryService.hardReserve(product.id, 1, `ref-${i}`)
        .then(() => '✅ SUCCESS')
        .catch(err => `❌ FAILED: ${err.message}`)
    );
  }

  const results = await Promise.all(promises);
  const successes = results.filter(r => r.includes('SUCCESS')).length;
  console.log(`\nResults: ${successes} successful reservations out of 50 attempts.`);

  // 4. Verify final state
  const finalInv = await inventoryService.getStock(product.id);
  console.log(`Final stock: quantity=${finalInv.quantity}, reserved=${finalInv.reserved}, available=${finalInv.available}`);
  
  if (successes > 10) {
    console.log('💥 BUG DETECTED: Overselling occurred. Concurrency race condition is present.');
  } else {
    console.log('👌 SAFE: No overselling occurred.');
  }

  // 5. Cleanup depends on if user wanted to keep it. We won't delete the dummy product 
  // because user explicitly said "ustgahgvi" (do not delete).
  console.log('--- STRESS TEST FINISHED ---');
  await prisma.$disconnect();
}

runStressTest().catch(console.error);
