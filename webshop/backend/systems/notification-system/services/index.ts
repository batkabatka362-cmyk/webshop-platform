/**
 * WEBSHOP — Notification System — Service
 *
 * Architecture:
 *   NotificationService  → orchestrates sending
 *   MailProvider          → pluggable interface (mock → SendGrid)
 *   Templates             → event-based email templates
 */

import { PrismaClient } from '@prisma/client'
import { MailProvider, SendEmailParams, NotificationEvent, NotificationResult } from '../types'

declare const prisma: PrismaClient

// ═══════════════════════════════════════════════
// MOCK MAIL PROVIDER (replace with SendGrid)
// ═══════════════════════════════════════════════

export class MockMailProvider implements MailProvider {
  name = 'mock'

  async send(params: SendEmailParams) {
    console.info(`[MAIL:MOCK] To: ${params.to}`)
    console.info(`[MAIL:MOCK] Subject: ${params.subject}`)
    console.info(`[MAIL:MOCK] Body: ${params.body.substring(0, 100)}...`)
    console.info(`[MAIL:MOCK] Event: ${params.event}`)

    // Simulate 50ms network delay
    await new Promise((r) => setTimeout(r, 50))

    return { success: true, messageId: `mock_${Date.now()}` }
  }
}

// ═══════════════════════════════════════════════
// SENDGRID PROVIDER (plug in when ready)
// ═══════════════════════════════════════════════
//
// import sgMail from '@sendgrid/mail'
//
// export class SendGridProvider implements MailProvider {
//   name = 'sendgrid'
//
//   constructor() {
//     sgMail.setApiKey(process.env.SENDGRID_API_KEY || '')
//   }
//
//   async send(params: SendEmailParams) {
//     try {
//       const result = await sgMail.send({
//         to:      params.to,
//         from:    process.env.SENDGRID_FROM || 'noreply@webshop.mn',
//         subject: params.subject,
//         html:    params.body,
//       })
//       return { success: true, messageId: result[0]?.headers?.['x-message-id'] }
//     } catch (err: any) {
//       return { success: false, error: err.message }
//     }
//   }
// }

// ═══════════════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════════════

const templates: Record<NotificationEvent, (data: any) => { subject: string; body: string }> = {

  order_created: (data) => ({
    subject: `WEBSHOP — Захиалга #${data.orderNumber} амжилттай үүслээ`,
    body: `
      <h2>Сайн байна уу, ${data.customerName || 'хэрэглэгч'}!</h2>
      <p>Таны захиалга #${data.orderNumber} амжилттай бүртгэгдлээ.</p>
      <p><strong>Нийт дүн:</strong> ₮${(data.grandTotal || 0).toLocaleString()}</p>
      <p><strong>Статус:</strong> Хүлээгдэж байна</p>
      <p>Төлбөр баталгаажсны дараа захиалга боловсруулагдана.</p>
      <br>
      <p>Баярлалаа,<br>WEBSHOP баг</p>
    `,
  }),

  payment_success: (data) => ({
    subject: `WEBSHOP — Төлбөр амжилттай! Захиалга #${data.orderNumber}`,
    body: `
      <h2>Төлбөр амжилттай!</h2>
      <p>Таны захиалга #${data.orderNumber}-ийн төлбөр баталгаажлаа.</p>
      <p><strong>Төлсөн дүн:</strong> ₮${(data.amount || 0).toLocaleString()}</p>
      <p><strong>Төлбөрийн арга:</strong> ${data.gateway || 'QPay'}</p>
      <p>Захиалга боловсруулж эхэллээ. Хүргэлтийн мэдээллийг удахгүй илгээнэ.</p>
      <br>
      <p>Баярлалаа,<br>WEBSHOP баг</p>
    `,
  }),

  order_shipped: (data) => ({
    subject: `WEBSHOP — Захиалга #${data.orderNumber} илгээгдлээ!`,
    body: `
      <h2>Таны захиалга замдаа!</h2>
      <p>Захиалга #${data.orderNumber} илгээгдлээ.</p>
      ${data.trackingNumber ? `<p><strong>Tracking дугаар:</strong> ${data.trackingNumber}</p>` : ''}
      ${data.courier ? `<p><strong>Зөөвөрлөгч:</strong> ${data.courier}</p>` : ''}
      <p><strong>Хүргэлтийн хугацаа:</strong> ${data.estimatedDays || '2-5'} хоног</p>
      <br>
      <p>Баярлалаа,<br>WEBSHOP баг</p>
    `,
  }),

  order_delivered: (data) => ({
    subject: `WEBSHOP — Захиалга #${data.orderNumber} хүргэгдлээ!`,
    body: `
      <h2>Захиалга хүргэгдлээ!</h2>
      <p>Захиалга #${data.orderNumber} амжилттай хүргэгдлээ.</p>
      <p>Бүтээгдэхүүндээ сэтгэл хангалуун байвал бидэнд сэтгэгдэл үлдээнэ үү!</p>
      <br>
      <p>Баярлалаа,<br>WEBSHOP баг</p>
    `,
  }),

  password_reset: (data) => ({
    subject: 'WEBSHOP — Нууц үг сэргээх',
    body: `
      <h2>Нууц үг сэргээх хүсэлт</h2>
      <p>Доорх линкээр нууц үгээ солино уу:</p>
      <p><a href="${data.resetUrl}">${data.resetUrl}</a></p>
      <p>Линк 1 цагийн дотор хүчинтэй.</p>
    `,
  }),

  welcome: (data) => ({
    subject: 'WEBSHOP-д тавтай морил!',
    body: `
      <h2>Сайн байна уу, ${data.firstName}!</h2>
      <p>WEBSHOP-д бүртгүүлсэнд баярлалаа.</p>
      <p>Манай дэлгүүрээс хамгийн сүүлийн үеийн бараа бүтээгдэхүүнийг олж авна уу!</p>
      <br>
      <p>WEBSHOP баг</p>
    `,
  }),
}

// ═══════════════════════════════════════════════
// NOTIFICATION SERVICE
// ═══════════════════════════════════════════════

export class NotificationService {
  private mailProvider: MailProvider

  constructor(provider?: MailProvider) {
    this.mailProvider = provider || new MockMailProvider()
    console.info(`[NOTIFICATION] Using mail provider: ${this.mailProvider.name}`)
  }

  /**
   * Send a notification for a specific event.
   */
  async notify(event: NotificationEvent, recipientEmail: string, data: any, recipientId?: string): Promise<NotificationResult> {
    const template = templates[event]
    if (!template) throw new Error(`No template for event: ${event}`)

    const { subject, body } = template(data)

    // Save notification record
    const notification = await prisma.notification.create({
      data: {
        type:        'email',
        event,
        recipientId,
        recipient:   recipientEmail,
        subject,
        body,
        status:      'pending',
        metadata:    data,
      },
    })

    // Send via mail provider
    try {
      const result = await this.mailProvider.send({ to: recipientEmail, subject, body, event, metadata: data })

      if (result.success) {
        await prisma.notification.update({
          where: { id: notification.id },
          data:  { status: 'sent', sentAt: new Date() },
        })
        return { id: notification.id, status: 'sent', sentAt: new Date() }
      } else {
        await prisma.notification.update({
          where: { id: notification.id },
          data:  { status: 'failed', failReason: result.error },
        })
        return { id: notification.id, status: 'failed' }
      }
    } catch (err) {
      await prisma.notification.update({
        where: { id: notification.id },
        data:  { status: 'failed', failReason: (err as Error).message },
      })
      return { id: notification.id, status: 'failed' }
    }
  }

  // ─── Convenience methods ────────────────────

  async onOrderCreated(email: string, orderData: { orderNumber: string; grandTotal: number; customerName?: string }, customerId?: string) {
    return this.notify('order_created', email, orderData, customerId)
  }

  async onPaymentSuccess(email: string, paymentData: { orderNumber: string; amount: number; gateway: string }, customerId?: string) {
    return this.notify('payment_success', email, paymentData, customerId)
  }

  async onOrderShipped(email: string, shipData: { orderNumber: string; trackingNumber?: string; courier?: string; estimatedDays?: string }, customerId?: string) {
    return this.notify('order_shipped', email, shipData, customerId)
  }

  async onOrderDelivered(email: string, data: { orderNumber: string }, customerId?: string) {
    return this.notify('order_delivered', email, data, customerId)
  }

  /**
   * Get notification history.
   */
  async getHistory(page = 1, limit = 20, event?: string) {
    const skip  = (page - 1) * limit
    const where: any = {}
    if (event) where.event = event

    const [items, total] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.notification.count({ where }),
    ])

    return { items, total, page, limit }
  }

  /**
   * Retry failed notifications.
   */
  async retryFailed(notificationId: string): Promise<NotificationResult> {
    const n = await prisma.notification.findUnique({ where: { id: notificationId } })
    if (!n || n.status !== 'failed') throw new Error('Notification not found or not in failed state')

    return this.notify(n.event as NotificationEvent, n.recipient, n.metadata, n.recipientId || undefined)
  }
}

export const notificationService = new NotificationService()
