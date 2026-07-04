import type { ExtractionInput, ReceiptExtractInput, InvoiceExtractInput, ValidateInput, ExportCsvInput, HealthResponse, ExtractedDocument, ValidateResult, ExportCsvResult } from './types.js'

export class InvoiceLaneError extends Error {
  code?: string
  status?: number
  details?: string

  constructor(message: string, options?: { code?: string; status?: number; details?: string }) {
    super(message)
    this.name = 'InvoiceLaneError'
    this.code = options?.code
    this.status = options?.status
    this.details = options?.details
  }
}

export class InvoiceLaneAuthError extends InvoiceLaneError {
  constructor(message = 'Authentication failed', details?: string) {
    super(message, { code: 'UNAUTHORIZED', status: 401, details })
    this.name = 'InvoiceLaneAuthError'
  }
}

export class InvoiceLaneInsufficientCreditsError extends InvoiceLaneError {
  constructor(message = 'Insufficient credits', details?: string) {
    super(message, { code: 'INSUFFICIENT_CREDITS', status: 402, details })
    this.name = 'InvoiceLaneInsufficientCreditsError'
  }
}

export class InvoiceLaneValidationError extends InvoiceLaneError {
  constructor(message = 'Validation failed', details?: string) {
    super(message, { code: 'VALIDATION_ERROR', status: 400, details })
    this.name = 'InvoiceLaneValidationError'
  }
}

export class InvoiceLaneRateLimitError extends InvoiceLaneError {
  constructor(message = 'Rate limit exceeded', details?: string) {
    super(message, { code: 'RATE_LIMITED', status: 429, details })
    this.name = 'InvoiceLaneRateLimitError'
  }
}

export class InvoiceLaneClient {
  private apiKey: string | undefined
  private baseUrl: string

  constructor(options: { apiKey?: string; baseUrl?: string } = {}) {
    this.apiKey = options.apiKey || process.env.TALOCODE_API_KEY
    this.baseUrl = (options.baseUrl || process.env.TALOCODE_BASE_URL || 'https://api.talocode.site').replace(/\/+$/, '')
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      const errData = data as { error?: string; code?: string; details?: string }

      if (response.status === 401) {
        throw new InvoiceLaneAuthError(errData.error, errData.details)
      }
      if (response.status === 402) {
        throw new InvoiceLaneInsufficientCreditsError(errData.error, errData.details)
      }
      if (response.status === 400) {
        throw new InvoiceLaneValidationError(errData.error, errData.details)
      }
      if (response.status === 429) {
        throw new InvoiceLaneRateLimitError(errData.error, errData.details)
      }

      throw new InvoiceLaneError(errData.error || `HTTP ${response.status}`, {
        code: errData.code,
        status: response.status,
        details: errData.details,
      })
    }

    return response.json() as Promise<T>
  }

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('GET', '/v1/invoicelane/health')
  }

  async extract(input: ExtractionInput): Promise<ExtractedDocument> {
    return this.request<ExtractedDocument>('POST', '/v1/invoicelane/extract', input)
  }

  async receiptExtract(input: ReceiptExtractInput): Promise<ExtractedDocument> {
    return this.request<ExtractedDocument>('POST', '/v1/invoicelane/receipt/extract', input)
  }

  async invoiceExtract(input: InvoiceExtractInput): Promise<ExtractedDocument> {
    return this.request<ExtractedDocument>('POST', '/v1/invoicelane/invoice/extract', input)
  }

  async validate(input: ValidateInput): Promise<ValidateResult> {
    return this.request<ValidateResult>('POST', '/v1/invoicelane/validate', input)
  }

  async exportCsv(input: ExportCsvInput): Promise<ExportCsvResult> {
    return this.request<ExportCsvResult>('POST', '/v1/invoicelane/export/csv', input)
  }
}

export function createInvoiceLaneClient(options?: { apiKey?: string; baseUrl?: string }): InvoiceLaneClient {
  return new InvoiceLaneClient(options)
}
