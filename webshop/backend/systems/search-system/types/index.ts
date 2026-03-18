/**
 * WEBSHOP — Search System — Types
 */

export interface SearchParams {
  query:       string
  categoryId?: string
  minPrice?:   number
  maxPrice?:   number
  status?:     string
  sortBy?:     'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'name'
  page:        number
  limit:       number
}

export interface SearchResult {
  items:      any[]
  total:      number
  page:       number
  limit:      number
  totalPages: number
  query:      string
  took:       number   // ms
}
