// @ts-nocheck
/**
 * WEBSHOP — File Upload System — Routes
 *
 * POST /api/v1/admin/products/upload          — single image
 * POST /api/v1/admin/products/:id/upload      — attach to product
 * POST /api/v1/admin/products/:id/upload-many — multiple images
 * DELETE /api/v1/admin/products/media/:mediaId — delete image
 */

import { Router, Request, Response, NextFunction } from 'express'
import { upload, fileUploadService } from '../services'

function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next)
}

export const fileUploadRouter = Router()

// POST /upload — Upload a single product image (standalone, returns URL)
fileUploadRouter.post(
  '/upload',
  upload.single('image'),
  handle(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } })
    }
    const result = fileUploadService.processUpload(req.file)
    res.status(201).json({ success: true, data: result })
  })
)

// POST /:id/upload — Upload and attach image to a product
fileUploadRouter.post(
  '/:id/upload',
  upload.single('image'),
  handle(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } })
    }
    const result = await fileUploadService.uploadProductImage(
      req.params.id,
      req.file,
      req.body.altText
    )
    res.status(201).json({ success: true, data: result })
  })
)

// POST /:id/upload-many — Upload multiple images
fileUploadRouter.post(
  '/:id/upload-many',
  upload.array('images', 10),
  handle(async (req, res) => {
    const files = req.files as Express.Multer.File[]
    if (!files || !files.length) {
      return res.status(400).json({ success: false, error: { message: 'No files uploaded' } })
    }
    const results = await fileUploadService.uploadMultiple(req.params.id, files)
    res.status(201).json({ success: true, data: results })
  })
)

// DELETE /media/:mediaId — Delete product image
fileUploadRouter.delete(
  '/media/:mediaId',
  handle(async (req, res) => {
    await fileUploadService.deleteProductImage(req.params.mediaId)
    res.status(204).send()
  })
)

// Multer error handler
fileUploadRouter.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof Error && err.message.includes('Invalid file type')) {
    return res.status(422).json({ success: false, error: { code: 'INVALID_FILE_TYPE', message: err.message } })
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'File exceeds 5MB limit' } })
  }
  next(err)
})
