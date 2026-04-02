import { io } from '../server';
import { Logger } from '../middleware/logger';

/**
 * WEBSHOP — Real-time Service
 * 
 * Provides a unified way to emit events across the platform.
 */
export const RealtimeService = {
  /**
   * Notify admins of a new order
   */
  notifyNewOrder(order: any) {
    Logger.info('REALTIME', 'emit.new_order', { orderId: order.id });
    io.to('admin_room').emit('new_order', {
      id: order.id,
      orderNumber: order.orderNumber,
      total: order.grandTotal,
      customer: order.guestEmail || 'Зочин',
      time: new Date().toLocaleTimeString()
    });
    
    // Also notify storefront for social proof
    this.notifyLivePurchase(order);
  },

  /**
   * Social proof for storefront
   */
  notifyLivePurchase(order: any) {
    io.emit('live_purchase', {
      name: order.guestEmail ? order.guestEmail.split('@')[0] : 'Хэрэглэгч',
      product: order.items?.[0]?.productName || 'Бараа',
      time: 'саяхан',
      img: order.items?.[0]?.imageUrl || ''
    });
  },

  /**
   * Alert admins of low stock
   */
  notifyStockLow(product: any, quantity: number) {
    io.to('admin_room').emit('stock_low', {
      id: product.id,
      name: product.name,
      quantity,
      threshold: product.inventory?.lowStockThreshold || 10
    });
  },

  emitAiBrain(log: any) {
    io.to('admin_room').emit('ai_brain_feed', log);
  },

  /**
   * Broadcast price drop to interested users
   */
  notifyPriceDrop(product: any, oldPrice: number, newPrice: number) {
    io.emit('price_drop', {
      id: product.id,
      name: product.name,
      oldPrice,
      newPrice,
      pct: Math.round((1 - newPrice / oldPrice) * 100)
    });
  }
};
