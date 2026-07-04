export type ExtractionType = 'invoice' | 'receipt' | 'document' | 'auto'

export type InputMode = 'text' | 'fileUrl' | 'base64' | 'fields'

export interface ExtractionInput {
  type?: ExtractionType
  text?: string
  fileUrl?: string
  base64?: string
  currency?: string
  locale?: string
  fields?: string[]
}

export interface ExtractedItem {
  description: string
  quantity?: number
  unitPrice?: number
  total?: number
  sku?: string
}

export interface ExtractedDocument {
  documentType: ExtractionType
  merchant?: string
  vendor?: string
  customer?: string
  invoiceNumber?: string
  receiptNumber?: string
  date?: string
  dueDate?: string
  currency?: string
  subtotal?: number
  tax?: number
  discount?: number
  total?: number
  items: ExtractedItem[]
  paymentMethod?: string
  confidence: number
  warnings: string[]
}

export interface ValidateInput {
  documentType: string
  fields: Record<string, unknown>
}

export interface ValidateResult {
  valid: boolean
  missingFields: string[]
  warnings: string[]
  normalized: Record<string, unknown>
}

export interface ExportCsvInput {
  rows: Record<string, unknown>[]
}

export interface ExportCsvResult {
  filename: string
  contentType: string
  csv: string
}

export interface BillingResult {
  success: boolean
  remainingCredits?: number
  error?: string
}

export interface HealthResponse {
  ok: boolean
  service: string
  version: string
}

export interface ErrorResponse {
  error: string
  code?: string
  details?: string
}

export interface ReceiptExtractInput {
  text?: string
  fileUrl?: string
  base64?: string
  currency?: string
  locale?: string
}

export interface InvoiceExtractInput {
  text?: string
  fileUrl?: string
  base64?: string
  currency?: string
  locale?: string
}
