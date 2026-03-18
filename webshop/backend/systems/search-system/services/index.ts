/**
 * WEBSHOP — Search System — Service
 * PostgreSQL full-text search via Prisma raw queries
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { SearchParams, SearchResult } from '../types'

declare const prisma: PrismaClient

export class SearchService {

  /**
   * Full-text search across product name, description, and category.
   * Uses PostgreSQL ts_rank + to_tsvector/to_tsquery.
   */
  async search(params: SearchParams): Promise<SearchResult> {
    const start  = Date.now()
    const offset = (params.page - 1) * params.limit

    // Sanitize query for tsquery: replace spaces with & for AND matching
    const sanitized = params.query
      .trim()
      .replace(/[^\w\s\u0400-\u04ff\u1800-\u18af]/g, '')  // keep alphanumeric + Cyrillic + Mongolian
      .split(/\s+/)
      .filter(Boolean)
      .join(' & ')

    if (!sanitized) {
      return { items: [], total: 0, page: params.page, limit: params.limit, totalPages: 0, query: params.query, took: 0 }
    }

    // Build WHERE clauses
    const conditions: string[] = [
      `p."deletedAt" IS NULL`,
      `p."status" = 'active'`,
    ]
    const queryParams: any[] = []
    let paramIdx = 1

    // Full-text condition
    conditions.push(`(
      to_tsvector('simple', coalesce(p."name", '') || ' ' || coalesce(p."description", '')) @@
      to_tsquery('simple', $${paramIdx})
      OR p."name" ILIKE $${paramIdx + 1}
      OR p."description" ILIKE $${paramIdx + 1}
    )`)
    queryParams.push(sanitized, `%${params.query.trim()}%`)
    paramIdx += 2

    // Category filter
    if (params.categoryId) {
      conditions.push(`p."categoryId" = $${paramIdx}`)
      queryParams.push(params.categoryId)
      paramIdx++
    }

    // Price range
    if (params.minPrice !== undefined) {
      conditions.push(`p."basePrice" >= $${paramIdx}`)
      queryParams.push(params.minPrice)
      paramIdx++
    }
    if (params.maxPrice !== undefined) {
      conditions.push(`p."basePrice" <= $${paramIdx}`)
      queryParams.push(params.maxPrice)
      paramIdx++
    }

    const whereClause = conditions.join(' AND ')

    // Sort
    let orderClause: string
    switch (params.sortBy) {
      case 'price_asc':  orderClause = `p."basePrice" ASC`; break
      case 'price_desc': orderClause = `p."basePrice" DESC`; break
      case 'newest':     orderClause = `p."createdAt" DESC`; break
      case 'name':       orderClause = `p."name" ASC`; break
      case 'relevance':
      default:
        orderClause = `ts_rank(
          to_tsvector('simple', coalesce(p."name", '') || ' ' || coalesce(p."description", '')),
          to_tsquery('simple', $1)
        ) DESC, p."createdAt" DESC`
    }

    // Count query
    const countSql = `SELECT COUNT(*)::int as total FROM products p WHERE ${whereClause}`
    const countResult: any[] = await prisma.$queryRawUnsafe(countSql, ...queryParams)
    const total = countResult[0]?.total || 0

    // Main search query with joins
    const searchSql = `
      SELECT
        p.*,
        c."name" as "categoryName",
        c."slug" as "categorySlug",
        ts_rank(
          to_tsvector('simple', coalesce(p."name", '') || ' ' || coalesce(p."description", '')),
          to_tsquery('simple', $1)
        ) as relevance
      FROM products p
      LEFT JOIN categories c ON p."categoryId" = c."id"
      WHERE ${whereClause}
      ORDER BY ${orderClause}
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `
    queryParams.push(params.limit, offset)

    const items: any[] = await prisma.$queryRawUnsafe(searchSql, ...queryParams)

    const took = Date.now() - start

    return {
      items,
      total,
      page:       params.page,
      limit:      params.limit,
      totalPages: Math.ceil(total / params.limit),
      query:      params.query,
      took,
    }
  }

  /**
   * Autocomplete / suggestions.
   */
  async suggest(query: string, limit = 10): Promise<{ name: string; slug: string; category?: string }[]> {
    if (!query || query.length < 2) return []

    const results: any[] = await prisma.$queryRawUnsafe(`
      SELECT p."name", p."slug", c."name" as "category"
      FROM products p
      LEFT JOIN categories c ON p."categoryId" = c."id"
      WHERE p."deletedAt" IS NULL
        AND p."status" = 'active'
        AND p."name" ILIKE $1
      ORDER BY p."name" ASC
      LIMIT $2
    `, `%${query}%`, limit)

    return results.map(r => ({
      name:     r.name,
      slug:     r.slug,
      category: r.category,
    }))
  }
}

export const searchService = new SearchService()
