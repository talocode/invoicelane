import type { IncomingMessage } from 'node:http'

export function extractApiKey(req: IncomingMessage): string | null {
  const auth = req.headers['authorization']
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim()
  }
  const xKey = req.headers['x-api-key']
  if (typeof xKey === 'string') {
    return xKey.trim()
  }
  return null
}

export function redactApiKey(key: string): string {
  if (key.length <= 8) return '****'
  return key.slice(0, 4) + '...' + key.slice(-4)
}

export function validateApiKey(key: string): boolean {
  return typeof key === 'string' && key.length > 0
}

export interface AuthResult {
  ok: true
  key: string
}

export function requireAuth(req: IncomingMessage): AuthResult {
  const key = extractApiKey(req)
  if (!key || !validateApiKey(key)) {
    const err = new Error('Unauthorized: missing or invalid API key') as Error & { status: number; body: string }
    err.status = 401
    err.body = JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED', details: 'Provide a valid API key via Authorization: Bearer or X-Api-Key header.' })
    throw err
  }
  return { ok: true, key }
}
