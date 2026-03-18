/**
 * WEBSHOP — Shipping Tracking System — Types
 */

export type ShippingStatus = 'processing' | 'shipped' | 'in_transit' | 'delivered'

export interface ShipOrderDTO {
  trackingNumber:  string
  courier?:        string
  trackingUrl?:    string
  shippingMethodId?: string
  note?:           string
}

export interface TrackingEvent {
  status:      ShippingStatus
  location?:   string
  description: string
  occurredAt:  Date
}

export interface TrackingInfo {
  orderId:         string
  orderNumber:     string
  trackingNumber?: string
  courier?:        string
  trackingUrl?:    string
  status:          string
  shippedAt?:      Date
  deliveredAt?:    Date
  estimatedMin?:   Date
  estimatedMax?:   Date
  events:          TrackingEvent[]
}
