// @ts-nocheck
/**
 * WEBSHOP — Search System — Routes
 *
 * GET /api/v1/products/search?q=keyword&page=1&limit=20
 * GET /api/v1/products/suggest?q=keyword
 */

import { Router, Request, Response, NextFunction } from 'express'
import { searchService } from '../services'
import { SearchParams } from '../types'

function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next)
}

export const searchRouter = Router()

// GET /search?q=keyword&categoryId=xxx&minPrice=0&maxPrice=999999&sortBy=relevance&page=1&limit=20
searchRouter.get('/search', handle(async (req, res) => {
  const q = (req.query.q as string || '').trim()

  if (!q || q.length < 2) {
    return res.status(400).json({
      success: false,
      error: { code: 'QUERY_TOO_SHORT', message: 'Search query must be at least 2 characters' },
    })
  }

  const params: SearchParams = {
    query:      q,
    categoryId: req.query.categoryId as string,
    minPrice:   req.query.minPrice  ? parseFloat(req.query.minPrice as string)  : undefined,
    maxPrice:   req.query.maxPrice  ? parseFloat(req.query.maxPrice as string)  : undefined,
    sortBy:     (req.query.sortBy   as SearchParams['sortBy']) || 'relevance',
    page:       Math.max(1, parseInt(req.query.page as string) || 1),
    limit:      Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20)),
  }

  const result = await searchService.search(params)
  res.json({ success: true, data: result })
}))

// GET /suggest?q=keyword
searchRouter.get('/suggest', handle(async (req, res) => {
  const q     = (req.query.q as string || '').trim()
  const limit = Math.min(20, parseInt(req.query.limit as string) || 10)

  const suggestions = await searchService.suggest(q, limit)
  res.json({ success: true, data: suggestions })
}))
