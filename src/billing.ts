import crypto from 'node:crypto'
import { config } from './config.js'
import type { BillingResult } from './types.js'

export async function chargeCredits(
  action: string,
  credits: number,
  metadata?: Record<string, unknown>,
): Promise<BillingResult> {
  const apiKey = process.env.TALOCODE_API_KEY
  if (!apiKey) {
    return { success: false, error: 'TALOCODE_API_KEY not configured' }
  }

  const idempotencyKey = crypto.randomUUID()

  try {
    const response = await fetch(`${config.talocodeBaseUrl}/api/v1/cloud/usage/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        product: 'invoicelane',
        action,
        credits,
        metadata: {
          product: 'invoicelane',
          action,
          credits,
          route: metadata?.route,
          mode: metadata?.mode,
          inputType: metadata?.inputType,
          inputSize: metadata?.inputSize,
          ...metadata,
        },
      }),
    })

    if (response.status === 401) {
      return { success: false, error: 'Invalid or expired TALOCODE_API_KEY' }
    }

    if (response.status === 402) {
      const body = await response.json().catch(() => ({}))
      return { success: false, error: body.error || 'Insufficient credits' }
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      return { success: false, error: body.error || `Billing service error: ${response.status}` }
    }

    const body = await response.json()
    return { success: true, remainingCredits: body.remainingCredits }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown billing error'
    return { success: false, error: message }
  }
}
