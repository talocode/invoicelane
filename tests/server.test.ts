import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

const PORT = 3099

function request(method: string, path: string, body?: unknown, apiKey?: string): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const opts: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: { 'Content-Type': 'application/json' } as Record<string, string>,
    }
    if (apiKey) (opts.headers as Record<string, string>)['Authorization'] = `Bearer ${apiKey}`
    const req = http.request(opts, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8')
        let data: unknown
        try { data = JSON.parse(raw) } catch { data = raw }
        resolve({ status: res.statusCode || 0, data })
      })
    })
    req.on('error', reject)
    if (body !== undefined) req.write(JSON.stringify(body))
    req.end()
  })
}

void describe('server', () => {
  let server: http.Server

  before(async () => {
    process.env.PORT = String(PORT)
    process.env.INVOICELANE_ALLOW_LOCAL_UNAUTH = 'true'
    const mod = await import('../src/server.js')
    server = mod.server
    await new Promise<void>(resolve => server.on('listening', resolve))
  })

  after(() => {
    server.close()
    delete process.env.PORT
    delete process.env.INVOICELANE_ALLOW_LOCAL_UNAUTH
  })

  void it('GET /health returns 200', async () => {
    const res = await request('GET', '/health')
    assert.equal(res.status, 200)
    const d = res.data as Record<string, unknown>
    assert.equal(d.ok, true)
    assert.equal(d.service, 'invoicelane')
  })

  void it('POST /v1/invoicelane/extract without auth returns 401', async () => {
    process.env.INVOICELANE_ALLOW_LOCAL_UNAUTH = 'false'
    const res = await request('POST', '/v1/invoicelane/extract', { text: 'Invoice-1\nTotal: $100' })
    assert.equal(res.status, 401)
    process.env.INVOICELANE_ALLOW_LOCAL_UNAUTH = 'true'
  })

  void it('POST /v1/invoicelane/extract returns 200 with extraction', async () => {
    const res = await request('POST', '/v1/invoicelane/extract', { text: 'Invoice-1\nTotal: $100' })
    assert.equal(res.status, 200)
    const d = res.data as Record<string, unknown>
    assert.equal(d.documentType, 'invoice')
    assert.equal(d.total, 100)
  })

  void it('POST /v1/invoicelane/export/csv returns CSV', async () => {
    const res = await request('POST', '/v1/invoicelane/export/csv', { rows: [{ merchant: 'ABC', total: 100 }] })
    assert.equal(res.status, 200)
    const d = res.data as Record<string, unknown>
    assert.equal(d.contentType, 'text/csv')
    assert.ok(typeof d.csv === 'string')
    assert.ok((d.csv as string).includes('ABC'))
  })

  void it('POST /v1/invoicelane/invoice/extract returns 200', async () => {
    const res = await request('POST', '/v1/invoicelane/invoice/extract', { text: 'Invoice-1\nDate: 2026-07-04\nTotal: $250' })
    assert.equal(res.status, 200)
    const d = res.data as Record<string, unknown>
    assert.equal(d.documentType, 'invoice')
    assert.equal(d.total, 250)
  })

  void it('POST missing route returns 404', async () => {
    const res = await request('POST', '/v1/invoicelane/nonexistent', {})
    assert.equal(res.status, 404)
  })
})
