/**
 * WEBSHOP — Notification System — Types
 */

export type NotificationType  = 'email' | 'sms' | 'push'
export type NotificationEvent = 'order_created' | 'payment_success' | 'order_shipped' | 'order_delivered' | 'password_reset' | 'welcome'
export type NotificationStatus = 'pending' | 'sent' | 'failed'

export interface SendEmailParams {
  to:       string
  subject:  string
  body:     string
  event:    NotificationEvent
  metadata?: Record<string, any>
}

export interface NotificationResult {
  id:      string
  status:  NotificationStatus
  sentAt?: Date
}

/**
 * Mail provider interface — implement this for SendGrid, Mailgun, etc.
 */
export interface MailProvider {
  name: string
  send(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }>
}
