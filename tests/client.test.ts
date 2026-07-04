import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { InvoiceLaneClient, createInvoiceLaneClient } from '../src/client.js'

void describe('InvoiceLaneClient', () => {
  void it('creates with apiKey', () => {
    const client = new InvoiceLaneClient({ apiKey: 'test-key-123' })
    assert.ok(client instanceof InvoiceLaneClient)
  })

  void it('createInvoiceLaneClient returns client', () => {
    const client = createInvoiceLaneClient({ apiKey: 'test-key-123' })
    assert.ok(client instanceof InvoiceLaneClient)
  })

  void it('health() calls correct path', async () => {
    let calledPath = ''
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (url: RequestInfo | URL) => {
      calledPath = typeof url === 'string' ? url : url.toString()
      return new Response(JSON.stringify({ ok: true, service: 'invoicelane', version: '0.1.0' }), { status: 200 })
    }

    const client = new InvoiceLaneClient({ apiKey: 'test-key-123', baseUrl: 'https://api.talocode.site' })
    await client.health()
    assert.ok(calledPath.includes('/v1/invoicelane/health'))

    globalThis.fetch = originalFetch
  })

  void it('invoiceExtract() calls correct path', async () => {
    let calledPath = ''
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (url: RequestInfo | URL) => {
      calledPath = typeof url === 'string' ? url : url.toString()
      return new Response(JSON.stringify({ documentType: 'invoice', total: 100, items: [], confidence: 0.5, warnings: [] }), { status: 200 })
    }

    const client = new InvoiceLaneClient({ apiKey: 'test-key-123', baseUrl: 'https://api.talocode.site' })
    await client.invoiceExtract({ text: 'Invoice-1\nTotal: $100' })
    assert.ok(calledPath.includes('/v1/invoicelane/invoice/extract'))

    globalThis.fetch = originalFetch
  })

  void it('validate() calls correct path', async () => {
    let calledPath = ''
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (url: RequestInfo | URL) => {
      calledPath = typeof url === 'string' ? url : url.toString()
      return new Response(JSON.stringify({ valid: true, missingFields: [], warnings: [], normalized: {} }), { status: 200 })
    }

    const client = new InvoiceLaneClient({ apiKey: 'test-key-123', baseUrl: 'https://api.talocode.site' })
    await client.validate({ documentType: 'invoice', fields: { total: 100 } })
    assert.ok(calledPath.includes('/v1/invoicelane/validate'))

    globalThis.fetch = originalFetch
  })

  void it('exportCsv() calls correct path', async () => {
    let calledPath = ''
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (url: RequestInfo | URL) => {
      calledPath = typeof url === 'string' ? url : url.toString()
      return new Response(JSON.stringify({ filename: 'export.csv', contentType: 'text/csv', csv: 'a,b\n1,2' }), { status: 200 })
    }

    const client = new InvoiceLaneClient({ apiKey: 'test-key-123', baseUrl: 'https://api.talocode.site' })
    await client.exportCsv({ rows: [{ a: 1, b: 2 }] })
    assert.ok(calledPath.includes('/v1/invoicelane/export/csv'))

    globalThis.fetch = originalFetch
  })
})
