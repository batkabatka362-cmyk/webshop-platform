// @ts-nocheck
import { prisma } from '../../server';
import { Logger } from '../../middleware/logger';

// ─── V42: SELF-HEALING RECOVERY WORKER ────────
export function runSystemRecoveryWorker() {
  Logger.info('RECOVERY_WORKER', 'worker.started', { tickMs: 60000 })
  setInterval(async () => {
    try {
      // V43 FIX: Only check orders that have been pending for >30 minutes (truly stuck)
      // Previously loaded ALL pending orders including freshly created ones + no limit = RAM overflow risk
      const stuckThreshold = new Date(Date.now() - 30 * 60 * 1000)
      const stuckOrders = await prisma.order.findMany({
        where: { status: 'pending', createdAt: { lt: stuckThreshold } },
        take: 50
      });
      
      for (const order of stuckOrders) {
        const payment = await prisma.payment.findFirst({ 
          where: { orderId: order.id, status: 'paid' } 
        });
        
        if (payment) {
          Logger.warn('RECOVERY_WORKER', 'order.stuck.detected', { orderId: order.id, paymentId: payment.id })
          const { OrderService } = await import('../../order-system/services');
          const orderSvc = new OrderService();
          
          await orderSvc.updateStatus(order.id, 'paid', 'system', 'system', 'Recovered by Self-Healing Worker');
          await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'paid' } });
          Logger.info('RECOVERY_WORKER', 'order.healed', { orderId: order.id })
          
          const cp = await prisma.checkoutPayment.findFirst({ where: { paymentSessionId: payment.id } });
          if (cp?.checkoutId) {
             const { InventoryService } = await import('../../inventory-system/services');
             const invSvc = new InventoryService();
             try {
               await invSvc.confirmReservation(cp.checkoutId);
             } catch (confErr: any) {
               Logger.warn('RECOVERY_WORKER', 'inventory.confirm.fallback', { checkoutId: cp.checkoutId, msg: confErr.message });
               // Fetch order items to do manual deductive fallback
               const orderWithItems = await prisma.order.findUnique({ where: { id: order.id }, include: { items: true } });
               if (orderWithItems && orderWithItems.items) {
                 for (const item of orderWithItems.items) {
                   await invSvc.adjustStock(item.productId, -item.quantity, 'fulfillment', order.id, 'Self-healing late deduction fallback').catch(err => {
                     Logger.error('RECOVERY_WORKER', 'inventory.fallback.failed', { productId: item.productId, error: err.message });
                   });
                 }
               }
             }
          }
        }
      }

      const { InventoryService } = await import('../../inventory-system/services');
      const invResult = await new InventoryService().cleanExpiredReservations();
      if (invResult.cleaned > 0) {
        Logger.info('RECOVERY_WORKER', 'inventory.reservations.cleaned', { count: invResult.cleaned })
      }

    } catch (e) { 
      Logger.error('RECOVERY_WORKER', 'worker.tick.failed', {}, e)
    }
  }, 60000);
}
