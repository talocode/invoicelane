import type { ExtractionType, ExtractedDocument, ExtractedItem, ValidateInput, ValidateResult } from './types.js'

const KNOWN_CURRENCIES: Record<string, string> = {
  '₦': 'NGN',
  'NGN': 'NGN',
  'naira': 'NGN',
  '$': 'USD',
  'USD': 'USD',
  '€': 'EUR',
  'EUR': 'EUR',
  '£': 'GBP',
  'GBP': 'GBP',
}

function parseDate(text: string): string | undefined {
  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (isoMatch) return isoMatch[1]

  const usMatch = text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/)
  if (usMatch) {
    const [, m, d, y] = usMatch
    return `${y}-${m}-${d}`
  }

  const textualMatch = text.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/i)
  if (textualMatch) {
    const months: Record<string, string> = {
      january: '01', jan: '01', february: '02', feb: '02', march: '03', mar: '03',
      april: '04', apr: '04', may: '05', june: '06', jun: '06', july: '07', jul: '07',
      august: '08', aug: '08', september: '09', sep: '09', october: '10', oct: '10',
      november: '11', nov: '11', december: '12', dec: '12',
    }
    const month = months[textualMatch[2].toLowerCase()]
    if (month) {
      return `${textualMatch[3]}-${month}-${String(textualMatch[1]).padStart(2, '0')}`
    }
  }

  return undefined
}

function parseAmount(str: string): number | undefined {
  const cleaned = str.replace(/[,$]/g, '').trim()
  const num = Number(cleaned)
  return isNaN(num) ? undefined : num
}

function detectCurrency(text: string): { currency?: string; warnings: string[] } {
  const warnings: string[] = []
  const matched: string[] = []
  for (const [symbol, code] of Object.entries(KNOWN_CURRENCIES)) {
    if (text.includes(symbol)) {
      matched.push(code)
    }
  }
  if (matched.length === 0) return { warnings }
  if (matched.length > 1) {
    warnings.push(`Ambiguous currency: detected ${matched.join(', ')}. Using ${matched[0]}.`)
  }
  return { currency: matched[0], warnings }
}

function extractInvoiceFromTextImpl(text: string, options?: { currency?: string; locale?: string }): ExtractedDocument {
  const warnings: string[] = []
  const currencyWarnings: string[] = []
  let confidence = 0.1
  const items: ExtractedItem[] = []

  let currency = options?.currency
  if (!currency) {
    const detected = detectCurrency(text)
    currency = detected.currency
    currencyWarnings.push(...detected.warnings)
  }
  if (currency) confidence += 0.15

  const invoiceNumberMatch = text.match(/Invoice\s*(?:No|Number|#|№)?[:\s]*([A-Za-z0-9][-A-Za-z0-9/]+)/i)
  const invoiceNumber = invoiceNumberMatch?.[1]
  if (invoiceNumber) confidence += 0.15

  const receiptNumberMatch = text.match(/Receipt\s*(?:No|Number|#)?[:\s]*([A-Za-z0-9][-A-Za-z0-9/]+)/i)
  const receiptNumber = receiptNumberMatch?.[1]

  const merchantMatch = text.match(/(?:Merchant|Vendor|Seller|Store|From)[:\s]+(.+)/i)
  const merchant = merchantMatch?.[1]?.trim()
  if (merchant) confidence += 0.15

  const customerMatch = text.match(/(?:Customer|Billed\s*To|Client|Bill\s*To|To)[:\s]+(.+)/i)
  const customer = customerMatch?.[1]?.trim()
  if (customer) confidence += 0.15

  const dateStr = parseDate(text)
  if (dateStr) {
    confidence += 0.15
  } else {
    warnings.push('Could not parse date from input')
  }

  const dueDateMatch = text.match(/Due\s*Date[:\s]+(.+)/i)
  let dueDate: string | undefined
  if (dueDateMatch) {
    dueDate = parseDate(dueDateMatch[1])
    if (dueDate) confidence += 0.15
  }

  const totalMatch = text.match(/\b(?:Total|Amount\s*Due|Grand\s*Total|Balance\s*Due)\b[:\s]*[$₦€£]?\s*([\d,]+\.?\d*)/i)
  const total = totalMatch ? parseAmount(totalMatch[1]) : undefined
  if (total !== undefined) {
    confidence += 0.15
    if (total < 0.01) warnings.push('Unusually low total amount')
    if (total > 9_999_999) warnings.push('Unusually high total amount')
  }

  const subtotalMatch = text.match(/\b(?:Subtotal|Sub\s*Total)\b[:\s]*[$₦€£]?\s*([\d,]+\.?\d*)/i)
  const subtotal = subtotalMatch ? parseAmount(subtotalMatch[1]) : undefined
  if (subtotal !== undefined) confidence += 0.15

  const taxPercentMatch = text.match(/(?:VAT|Tax|GST)[:\s]*([\d,.]+)\s*%/i)
  let tax: number | undefined
  if (taxPercentMatch) {
    const pct = parseAmount(taxPercentMatch[1])
    if (pct !== undefined && total !== undefined) {
      tax = Math.round(((total / (1 + pct / 100)) * pct / 100) * 100) / 100
    }
    confidence += 0.15
  } else {
    const taxAmountMatch = text.match(/(?:VAT|Tax|GST)[:\s]*[$₦€£]?\s*([\d,]+\.?\d*)/i)
    if (taxAmountMatch) {
      tax = parseAmount(taxAmountMatch[1])
      if (tax !== undefined) confidence += 0.15
    }
  }

  const discountMatch = text.match(/(?:Discount|DISCOUNT)[:\s]*[$₦€£]?\s*([\d,]+\.?\d*)/i)
  const discount = discountMatch ? parseAmount(discountMatch[1]) : undefined

  const paymentMatch = text.match(/(?:Payment\s*Method|Paid\s*Via|Payment)[:\s]+(.+)/i)
  const paymentMethod = paymentMatch?.[1]?.trim()
  if (paymentMethod) confidence += 0.15

  const lines = text.split('\n')
  let itemMode = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/item|product|description|qty|quantity|price|amount/i.test(trimmed) && /\b(qty|quantity|price|amount)\b/i.test(trimmed)) {
      itemMode = true
      continue
    }
    if (itemMode && /^[-=+_]{3,}$/.test(trimmed)) continue
    if (itemMode && /total|subtotal|vat|tax/i.test(trimmed)) {
      itemMode = false
      continue
    }
    if (itemMode) {
      const parts = trimmed.split(/\s{2,}|\t+/)
      if (parts.length >= 2) {
        const numbers = parts.map(p => parseAmount(p)).filter((n): n is number => n !== undefined)
        const item: ExtractedItem = { description: parts[0].trim() }
        if (numbers.length === 1) item.total = numbers[0]
        if (numbers.length === 2) { item.quantity = numbers[0]; item.total = numbers[1] }
        if (numbers.length >= 3) { item.quantity = numbers[0]; item.unitPrice = numbers[1]; item.total = numbers[2] }
        items.push(item)
      } else if (/\d/.test(trimmed)) {
        const num = parseAmount(trimmed.replace(/^[$₦€£]/, ''))
        if (num !== undefined) {
          items.push({ description: trimmed.replace(/[$₦€£][\d,.]+/, '').trim() || 'Item', total: num })
        }
      }
    }
  }
  if (items.length > 0) confidence += 0.15

  if (text.trim().length > 0 && !invoiceNumber && !receiptNumber && total === undefined && !merchant) {
    if (confidence === 0.1) {
      warnings.push('Minimal structured data found')
    }
  }

  if (text.trim().length === 0) {
    return { documentType: 'auto', items: [], confidence: 0, warnings: ['No text provided'] }
  }

  confidence = Math.min(confidence, 0.98)

  const documentType: ExtractionType = receiptNumber ? 'receipt' : 'invoice'

  warnings.push(...currencyWarnings)

  return {
    documentType,
    merchant,
    customer,
    invoiceNumber,
    receiptNumber,
    date: dateStr,
    dueDate,
    currency,
    subtotal,
    tax,
    discount,
    total,
    items,
    paymentMethod,
    confidence: Math.round(confidence * 100) / 100,
    warnings,
  }
}

export function extractInvoiceFromText(text: string, options?: { currency?: string; locale?: string }): ExtractedDocument {
  const result = extractInvoiceFromTextImpl(text, options)
  return { ...result, documentType: 'invoice' }
}

export function extractReceiptFromText(text: string, options?: { currency?: string; locale?: string }): ExtractedDocument {
  const result = extractInvoiceFromTextImpl(text, options)
  return { ...result, documentType: 'receipt' }
}

export function extractFromText(text: string, options?: { type?: ExtractionType; currency?: string; locale?: string }): ExtractedDocument {
  if (options?.type === 'invoice') return extractInvoiceFromText(text, options)
  if (options?.type === 'receipt') return extractReceiptFromText(text, options)
  if (!text || !text.trim()) {
    return {
      documentType: 'auto',
      items: [],
      confidence: 0,
      warnings: ['OCR/PDF parsing not available in v0.1. Use text input or configure an OCR provider.'],
    }
  }
  return extractInvoiceFromTextImpl(text, options)
}

export function validateFields(input: ValidateInput): ValidateResult {
  const standardFields: Record<string, string[]> = {
    invoice: ['total', 'currency'],
    receipt: ['total', 'currency'],
    document: [],
  }

  const required = standardFields[input.documentType.toLowerCase()] || []
  const missingFields: string[] = []
  const warnings: string[] = []
  const normalized: Record<string, unknown> = {}

  for (const field of required) {
    const val = input.fields[field]
    if (val === undefined || val === null || val === '') {
      missingFields.push(field)
    } else {
      normalized[field] = val
    }
  }

  if (input.fields.total !== undefined) {
    const num = Number(input.fields.total)
    if (!isNaN(num)) {
      normalized.total = num
    } else {
      warnings.push('total field is not a valid number')
    }
  }

  for (const [key, val] of Object.entries(input.fields)) {
    if (!(key in normalized)) {
      normalized[key] = val
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
    warnings,
    normalized,
  }
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''

  const headers = [...new Set(rows.flatMap(r => Object.keys(r)))]
  const escapeCell = (val: unknown): string => {
    const str = val === null || val === undefined ? '' : String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const lines: string[] = []
  lines.push(headers.map(escapeCell).join(','))
  for (const row of rows) {
    lines.push(headers.map(h => escapeCell(row[h])).join(','))
  }
  return lines.join('\n')
}
