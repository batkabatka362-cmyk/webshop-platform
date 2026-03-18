/**
 * WEBSHOP — File Upload System — Types
 */

export interface UploadResult {
  filename:    string
  originalName: string
  path:        string
  url:         string
  size:        number
  mimeType:    string
}

export interface UploadConfig {
  dest:            string
  maxSizeMB:       number
  allowedFormats:  string[]
}

export const UPLOAD_CONFIG: UploadConfig = {
  dest:           './uploads/products',
  maxSizeMB:      5,
  allowedFormats: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
}

export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
