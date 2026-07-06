# InvoiceLane

**Turn receipts, invoices and business documents into structured data through one API.**

InvoiceLane is a [Talocode](https://docs.talocode.site) invoice/receipt extraction product. Send raw text from invoices, receipts, or business documents and receive structured JSON — merchant, total, line items, dates, currency, and more.

> **v0.1** — Text extraction via a deterministic engine. OCR/PDF parsing is not yet supported.

---

## Quick Start

```bash
pnpm install @talocode/invoicelane
```

### API Key

Set your Talocode API key:

```bash
export TALOCODE_API_KEY=tc_...
```

### Start the Server

```bash
pnpm dev
```

Server listens on `http://0.0.0.0:3010`.

---

## Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/v1/invoicelane/health` | Health check |
| `POST` | `/v1/invoicelane/extract` | Extract from text (auto-detect type) |
| `POST` | `/v1/invoicelane/invoice/extract` | Extract as invoice |
| `POST` | `/v1/invoicelane/receipt/extract` | Extract as receipt |
| `POST` | `/v1/invoicelane/validate` | Validate extracted fields |
| `POST` | `/v1/invoicelane/export/csv` | Export rows to CSV |

### POST /v1/invoicelane/extract

```json
{
  "type": "invoice",
  "text": "Invoice No: INV-001\nMerchant: ABC Ltd\nDate: 2026-07-04\nTotal: $1,234.56",
  "currency": "USD",
  "locale": "en-US"
}
```

Response:

```json
{
  "documentType": "invoice",
  "merchant": "ABC Ltd",
  "invoiceNumber": "INV-001",
  "date": "2026-07-04",
  "currency": "USD",
  "total": 1234.56,
  "items": [],
  "confidence": 0.88,
  "warnings": []
}
```

---

## SDK Usage

```ts
import { InvoiceLaneClient } from '@talocode/invoicelane'

const client = new InvoiceLaneClient({ apiKey: 'tc_...' })

const result = await client.invoiceExtract({
  text: 'Invoice No: INV-001\nTotal: $1,234.56'
})

console.log(result.total) // 1234.56
```

### Methods

- `client.health()` — Health check
- `client.extract(input)` — Auto-detect extraction
- `client.invoiceExtract(input)` — Invoice extraction
- `client.receiptExtract(input)` — Receipt extraction
- `client.validate(input)` — Validate fields
- `client.exportCsv(input)` — Export to CSV

---

## CLI Usage

```bash
# Extract from invoice text
invoicelane extract --type invoice --text "Invoice No: INV-001\nTotal: $1,234.56"

# Extract from receipt text
invoicelane extract --type receipt --text "Receipt #123\nTotal: $50.00"

# Validate fields
invoicelane validate --json '{"documentType":"invoice","fields":{"total":100}}'

# Export CSV
invoicelane csv --json '[{"merchant":"ABC","total":100}]'
```

---

## Local Usage (No API Key)

Set `INVOICELANE_ALLOW_LOCAL_UNAUTH=true` and no API key is required for extraction. Billing is skipped in this mode.

```bash
INVOICELANE_ALLOW_LOCAL_UNAUTH=true pnpm dev
```

---

## Limitations (v0.1)

- **OCR/PDF not supported** — Provide text input directly. If `fileUrl` or `base64` is supplied without text, the API returns a `400 OCR_NOT_AVAILABLE` error.
- **Deterministic engine** — Pattern-based extraction, not ML. Accuracy depends on input formatting.
- **No multi-page document support** — Single document per request.

---

## License

MIT

## Support

Open-source Talocode products are built and maintained by Abdulmuiz Adeyemo.

Sponsor the work: https://github.com/sponsors/Abdulmuiz44
