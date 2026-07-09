import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractFromText,
  extractInvoiceFromText,
  extractReceiptFromText,
  validateFields,
  toCsv,
} from '../src/engine.js'

void describe('engine', () => {
  void describe('extractFromText', () => {
    void it('extracts invoice with all fields', () => {
      const invoice = `Invoice No: INV-001
Merchant: ABC Ltd
Date: 2026-07-04
Due Date: 2026-08-04
Customer: John Doe
Subtotal: $1,000.00
Tax: 7.5%
Total: $1,075.00
Payment Method: Credit Card`

      const result = extractFromText(invoice, { type: 'invoice' })
      assert.equal(result.documentType, 'invoice')
      assert.equal(result.invoiceNumber, 'INV-001')
      assert.equal(result.merchant, 'ABC Ltd')
      assert.equal(result.date, '2026-07-04')
      assert.equal(result.dueDate, '2026-08-04')
      assert.equal(result.customer, 'John Doe')
      assert.equal(result.subtotal, 1000)
      assert.equal(result.total, 1075)
      assert.equal(result.currency, 'USD')
      assert.ok(result.confidence > 0.8)
      assert.equal(result.warnings.length, 0)
    })

    void it('extracts receipt', () => {
      const receipt = `Receipt #12345
Store: Corner Shop
Date: 2026-07-04
Total: $25.50`

      const result = extractFromText(receipt, { type: 'receipt' })
      assert.equal(result.documentType, 'receipt')
      assert.equal(result.receiptNumber, '12345')
      assert.equal(result.merchant, 'Corner Shop')
      assert.equal(result.total, 25.5)
    })

    void it('empty text returns low confidence warning', () => {
      const result = extractFromText('')
      assert.equal(result.confidence, 0)
      assert.ok(result.warnings.length > 0)
    })

    void it('fileUrl/base64 with empty text returns unsupported warning', () => {
      const result = extractFromText('', { type: 'auto' })
      assert.equal(result.confidence, 0)
      assert.ok(result.warnings.some(w => w.toLowerCase().includes('ocr')))
    })
  })

  void describe('extractInvoiceFromText', () => {
    void it('extracts invoice number and total', () => {
      const result = extractInvoiceFromText('Invoice No: INV-001\nDate: 2026-07-04\nTotal: $1,234.56')
      assert.equal(result.documentType, 'invoice')
      assert.equal(result.invoiceNumber, 'INV-001')
      assert.equal(result.total, 1234.56)
      assert.equal(result.date, '2026-07-04')
    })

    void it('parses different date formats', () => {
      const iso = extractInvoiceFromText('Invoice-123\nDate: 2026-07-04\nTotal: $100')
      assert.equal(iso.date, '2026-07-04')

      const us = extractInvoiceFromText('Invoice-456\nDate: 07/04/2026\nTotal: $100')
      assert.equal(us.date, '2026-07-04')

      const textual = extractInvoiceFromText('Invoice-789\nDate: 4 July 2026\nTotal: $100')
      assert.equal(textual.date, '2026-07-04')
    })
  })

  void describe('extractReceiptFromText', () => {
    void it('extracts receipt number', () => {
      const result = extractReceiptFromText('Receipt #RCP-001\nDate: 2026-07-04\nTotal: $50')
      assert.equal(result.documentType, 'receipt')
      assert.equal(result.receiptNumber, 'RCP-001')
    })
  })

  void describe('total with currencies', () => {
    void it('parses USD total', () => {
      const r = extractInvoiceFromText('Invoice-1\nTotal: $1,234.56')
      assert.equal(r.total, 1234.56)
      assert.equal(r.currency, 'USD')
    })

    void it('parses NGN total', () => {
      const r = extractInvoiceFromText('Invoice-2\nTotal: ₦12,500')
      assert.equal(r.total, 12500)
      assert.equal(r.currency, 'NGN')
    })

    void it('parses EUR total', () => {
      const r = extractInvoiceFromText('Invoice-3\nTotal: €999.99')
      assert.equal(r.total, 999.99)
      assert.equal(r.currency, 'EUR')
    })

    void it('parses GBP total', () => {
      const r = extractInvoiceFromText('Invoice-4\nTotal: £500.50')
      assert.equal(r.total, 500.5)
      assert.equal(r.currency, 'GBP')
    })

    void it('parses total with commas', () => {
      const r = extractInvoiceFromText('Invoice-5\nTotal: $1,234,567.89')
      assert.equal(r.total, 1234567.89)
    })
  })

  void describe('line items', () => {
    void it('detects multiple line items', () => {
      const text = `Invoice-6
Description          Qty   Price   Amount
Widget A             2     10.00   20.00
Widget B             1     15.00   15.00
Total                          $35.00`

      const result = extractInvoiceFromText(text)
      assert.ok(result.items.length >= 2)
      assert.equal(result.total, 35)
    })
  })

  void describe('validateFields', () => {
    void it('all fields present returns valid', () => {
      const result = validateFields({
        documentType: 'invoice',
        fields: {
          invoiceNumber: 'INV-1',
          total: 100,
          currency: 'USD',
          date: '2026-07-04',
        },
      })
      assert.equal(result.valid, true)
      assert.equal(result.missingFields.length, 0)
    })

    void it('missing fields populated', () => {
      const result = validateFields({ documentType: 'invoice', fields: {} })
      assert.equal(result.valid, false)
      assert.ok(result.missingFields.length > 0)
      assert.ok(result.missingFields.includes('invoiceNumber'))
      assert.ok(result.missingFields.includes('total'))
    })

    void it('flags totals mismatch', () => {
      const result = validateFields({
        documentType: 'invoice',
        fields: {
          invoiceNumber: 'X',
          total: 999,
          currency: 'USD',
          date: '2026-01-01',
          subtotal: 100,
          tax: 10,
        },
      })
      assert.equal(result.valid, false)
      assert.equal(result.totalsConsistent, false)
    })
  })

  void describe('schema contract', () => {
    void it('includes missingFields and vendor on extract', () => {
      const result = extractInvoiceFromText(
        'Invoice No: INV-001\nMerchant: ABC\nDate: 2026-07-04\nTotal: $100',
      )
      assert.ok(Array.isArray(result.missingFields))
      assert.equal(result.vendor, 'ABC')
      assert.equal(result.engine, 'rules')
      assert.equal(result.version, '0.2.0')
    })
  })

  void describe('toCsv', () => {
    void it('generates basic CSV', () => {
      const csv = toCsv([{ merchant: 'ABC', total: 100 }, { merchant: 'XYZ', total: 200 }])
      assert.ok(csv.includes('merchant,total'))
      assert.ok(csv.includes('ABC,100'))
      assert.ok(csv.includes('XYZ,200'))
    })

    void it('escapes commas and quotes', () => {
      const csv = toCsv([{ name: 'Doe, John', note: 'He said "hello"' }])
      assert.ok(csv.includes('"Doe, John"'))
      assert.ok(csv.includes('"He said ""hello"""'))
    })
  })
})
