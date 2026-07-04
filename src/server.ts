import http from 'node:http'
import crypto from 'node:crypto'
import { config } from './config.js'
import { extractApiKey, validateApiKey, requireAuth } from './auth.js'
import { chargeCredits } from './billing.js'
import { extractFromText, extractInvoiceFromText, extractReceiptFromText, validateFields, toCsv } from './engine.js'
import type { ExtractionInput, ValidateInput, ExportCsvInput, ReceiptExtractInput, InvoiceExtractInput, HealthResponse } from './types.js'

const VERSION = '0.1.0'
const SERVICE = 'invoicelane'

function jsonResponse(res: http.ServerResponse, status: number, data: unknown, requestId?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (requestId) headers['x-request-id'] = requestId
  res.writeHead(status, headers)
  res.end(JSON.stringify(data))
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

const CREDIT_COST_EXTRACT = 5
const CREDIT_COST_VALIDATE = 2
const CREDIT_COST_EXPORT = 1

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const requestId = crypto.randomUUID()

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const method = req.method || 'GET'
    const path = url.pathname

    if (method === 'GET' && (path === '/health' || path === '/v1/invoicelane/health')) {
      const response: HealthResponse = { ok: true, service: SERVICE, version: VERSION }
      return jsonResponse(res, 200, response, requestId)
    }

    if (method !== 'POST') {
      return jsonResponse(res, 405, { error: 'Method not allowed' }, requestId)
    }

    const bodyStr = await readBody(req)
    let body: Record<string, unknown>
    try {
      body = JSON.parse(bodyStr)
    } catch {
      return jsonResponse(res, 400, { error: 'Invalid JSON body' }, requestId)
    }

    let apiKey: string | null = null
    if (!config.allowLocalUnauth) {
      const auth = requireAuth(req)
      apiKey = auth.key
    } else {
      apiKey = extractApiKey(req)
      if (apiKey && !validateApiKey(apiKey)) apiKey = null
    }

    let billingResult
    if (apiKey) {
      process.env.TALOCODE_API_KEY = apiKey
    }

    switch (path) {
      case '/v1/invoicelane/extract': {
        const input = body as ExtractionInput
        const text = input.text || ''

        if (!text && (input.fileUrl || input.base64)) {
          return jsonResponse(res, 400, {
            error: 'OCR/PDF parsing not available in v0.1',
            code: 'OCR_NOT_AVAILABLE',
            details: 'Provide text input directly or configure an OCR provider.',
          }, requestId)
        }

        if (apiKey) {
          billingResult = await chargeCredits('extract', CREDIT_COST_EXTRACT, { route: path, mode: 'text', inputType: input.type || 'auto', inputSize: text.length })
          if (!billingResult.success) {
            return jsonResponse(res, 402, { error: billingResult.error, code: 'INSUFFICIENT_CREDITS' }, requestId)
          }
        }

        const result = extractFromText(text, { type: input.type, currency: input.currency, locale: input.locale })
        return jsonResponse(res, 200, { ...result, creditsRemaining: billingResult?.remainingCredits }, requestId)
      }

      case '/v1/invoicelane/receipt/extract': {
        const input = body as ReceiptExtractInput
        const text = input.text || ''

        if (!text && (input.fileUrl || input.base64)) {
          return jsonResponse(res, 400, {
            error: 'OCR/PDF parsing not available in v0.1',
            code: 'OCR_NOT_AVAILABLE',
            details: 'Provide text input directly or configure an OCR provider.',
          }, requestId)
        }

        if (apiKey) {
          billingResult = await chargeCredits('extract', CREDIT_COST_EXTRACT, { route: path, mode: 'text', inputType: 'receipt', inputSize: text.length })
          if (!billingResult.success) {
            return jsonResponse(res, 402, { error: billingResult.error, code: 'INSUFFICIENT_CREDITS' }, requestId)
          }
        }

        const result = extractReceiptFromText(text, { currency: input.currency, locale: input.locale })
        return jsonResponse(res, 200, { ...result, creditsRemaining: billingResult?.remainingCredits }, requestId)
      }

      case '/v1/invoicelane/invoice/extract': {
        const input = body as InvoiceExtractInput
        const text = input.text || ''

        if (!text && (input.fileUrl || input.base64)) {
          return jsonResponse(res, 400, {
            error: 'OCR/PDF parsing not available in v0.1',
            code: 'OCR_NOT_AVAILABLE',
            details: 'Provide text input directly or configure an OCR provider.',
          }, requestId)
        }

        if (apiKey) {
          billingResult = await chargeCredits('extract', CREDIT_COST_EXTRACT, { route: path, mode: 'text', inputType: 'invoice', inputSize: text.length })
          if (!billingResult.success) {
            return jsonResponse(res, 402, { error: billingResult.error, code: 'INSUFFICIENT_CREDITS' }, requestId)
          }
        }

        const result = extractInvoiceFromText(text, { currency: input.currency, locale: input.locale })
        return jsonResponse(res, 200, { ...result, creditsRemaining: billingResult?.remainingCredits }, requestId)
      }

      case '/v1/invoicelane/validate': {
        const input = body as unknown as ValidateInput

        if (apiKey) {
          billingResult = await chargeCredits('validate', CREDIT_COST_VALIDATE, { route: path, mode: 'fields', inputType: input.documentType, inputSize: JSON.stringify(input.fields).length })
          if (!billingResult.success) {
            return jsonResponse(res, 402, { error: billingResult.error, code: 'INSUFFICIENT_CREDITS' }, requestId)
          }
        }

        const result = validateFields(input)
        return jsonResponse(res, 200, { ...result, creditsRemaining: billingResult?.remainingCredits }, requestId)
      }

      case '/v1/invoicelane/export/csv': {
        const input = body as unknown as ExportCsvInput
        const rows = input.rows || []

        if (apiKey) {
          billingResult = await chargeCredits('export_csv', CREDIT_COST_EXPORT, { route: path, mode: 'export', inputType: 'csv', inputSize: rows.length })
          if (!billingResult.success) {
            return jsonResponse(res, 402, { error: billingResult.error, code: 'INSUFFICIENT_CREDITS' }, requestId)
          }
        }

        const csv = toCsv(rows)
        return jsonResponse(res, 200, { filename: 'export.csv', contentType: 'text/csv', csv, creditsRemaining: billingResult?.remainingCredits }, requestId)
      }

      default:
        return jsonResponse(res, 404, { error: 'Not found', code: 'NOT_FOUND' }, requestId)
    }
  } catch (err: unknown) {
    const error = err as { status?: number; body?: string; message?: string }
    if (error.status && error.body) {
      res.writeHead(error.status, { 'Content-Type': 'application/json', 'x-request-id': requestId })
      res.end(error.body)
      return
    }
    const message = error.message || 'Internal server error'
    return jsonResponse(res, 500, { error: message, code: 'INTERNAL_ERROR' }, requestId)
  }
}

const server = http.createServer(handleRequest)

server.listen(config.port, '0.0.0.0', () => {
  console.log(`InvoiceLane server v${VERSION} listening on 0.0.0.0:${config.port}`)
})

function shutdown() {
  console.log('InvoiceLane shutting down...')
  server.close(() => process.exit(0))
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

export { server }
