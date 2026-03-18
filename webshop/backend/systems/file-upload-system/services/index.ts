/**
 * WEBSHOP — File Upload System — Service
 */

import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs'
import { PrismaClient } from '@prisma/client'
import { UPLOAD_CONFIG, ALLOWED_EXTENSIONS, UploadResult } from '../types'

declare const prisma: PrismaClient

// Ensure upload directory exists
const uploadDir = path.resolve(UPLOAD_CONFIG.dest)
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir)
  },
  filename: (_req, file, cb) => {
    const ext    = path.extname(file.originalname).toLowerCase()
    const unique = crypto.randomBytes(16).toString('hex')
    const name   = `${Date.now()}-${unique}${ext}`
    cb(null, name)
  },
})

// File filter
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase()
  if (UPLOAD_CONFIG.allowedFormats.includes(file.mimetype) && ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true)
  } else {
    cb(new Error(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`))
  }
}

// Multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: UPLOAD_CONFIG.maxSizeMB * 1024 * 1024,
  },
})

// Service functions

export class FileUploadService {

  /**
   * Process uploaded file and return metadata.
   */
  processUpload(file: Express.Multer.File): UploadResult {
    const baseUrl = process.env.MEDIA_BASE_URL || 'http://localhost:4000/media'
    return {
      filename:     file.filename,
      originalName: file.originalname,
      path:         file.path,
      url:          `${baseUrl}/products/${file.filename}`,
      size:         file.size,
      mimeType:     file.mimetype,
    }
  }

  /**
   * Upload and attach image to a product.
   */
  async uploadProductImage(productId: string, file: Express.Multer.File, altText?: string): Promise<any> {
    const result = this.processUpload(file)

    // Get current media count for position
    const count = await prisma.productMedia.count({ where: { productId } })

    const media = await prisma.productMedia.create({
      data: {
        productId,
        url:      result.url,
        type:     'image',
        position: count,
        altText:  altText || file.originalname,
      },
    })

    return { media, upload: result }
  }

  /**
   * Delete an uploaded file from disk and DB.
   */
  async deleteProductImage(mediaId: string): Promise<void> {
    const media = await prisma.productMedia.findUnique({ where: { id: mediaId } })
    if (!media) throw new Error('Media not found')

    // Extract filename from URL and delete from disk
    const filename = media.url.split('/').pop()
    if (filename) {
      const filePath = path.join(uploadDir, filename)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }

    await prisma.productMedia.delete({ where: { id: mediaId } })
  }

  /**
   * Bulk upload multiple images for a product.
   */
  async uploadMultiple(productId: string, files: Express.Multer.File[]): Promise<any[]> {
    const results = []
    for (const file of files) {
      const result = await this.uploadProductImage(productId, file)
      results.push(result)
    }
    return results
  }
}

export const fileUploadService = new FileUploadService()
