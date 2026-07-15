# InvoiceLane

**Turn receipts, invoices and business documents into structured data through one API.**

InvoiceLane is a [Talocode](https://docs.talocode.site) document intelligence product. Send raw text from invoices, receipts, or business documents and receive schema-validated JSON — merchant, total, line items, dates, currency, missing fields, and totals consistency checks.

> **v0.2** — Schema-first rule engine. OCR/PDF parsing is not yet supported. Hosted on Talocode Cloud at `/v1/invoicelane/*`.

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

| Method | Path | Credits | Description |
|--------|------|---------|-------------|
| `GET` | `/health` | — | Health check |
| `GET` | `/v1/invoicelane/health` | — | Health check |
| `GET` | `/v1/invoicelane/pricing` | — | Credit pricing |
| `GET` | `/v1/invoicelane/capabilities` | — | Schema + endpoints |
| `POST` | `/v1/invoicelane/extract` | 20 | Extract (auto-detect type) |
| `POST` | `/v1/invoicelane/invoice/extract` | 30 | Extract as invoice |
| `POST` | `/v1/invoicelane/receipt/extract` | 20 | Extract as receipt |
| `POST` | `/v1/invoicelane/validate` | 10 | Validate extracted fields |
| `POST` | `/v1/invoicelane/export/csv` | 5 | Export rows to CSV |

### Schema contract

| Type | Required fields |
|------|-----------------|
| invoice | `invoiceNumber`, `total`, `currency`, `date` |
| receipt | `total`, `currency`, `date` |

Extraction responses always include:

- `missingFields` — required fields not found
- `totalsConsistent` — subtotal + tax − discount vs total
- `vendor` — alias of merchant
- `confidence`, `warnings`, `engine`, `version`

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
  "vendor": "ABC Ltd",
  "invoiceNumber": "INV-001",
  "date": "2026-07-04",
  "currency": "USD",
  "total": 1234.56,
  "items": [],
  "confidence": 0.88,
  "warnings": [],
  "missingFields": [],
  "totalsConsistent": true,
  "engine": "rules",
  "version": "0.2.0"
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

### Talocode Cloud SDK

```ts
import { Talocode } from '@talocode/sdk'

const tc = new Talocode({ apiKey: process.env.TALOCODE_API_KEY })
const result = await tc.invoicelane.invoiceExtract({
  text: 'Invoice No: INV-001\nDate: 2026-07-04\nTotal: $100',
})
```

---

## CLI Usage

```bash
# Extract from invoice text
invoicelane extract --type invoice --text "Invoice No: INV-001\nTotal: $1,234.56"

# Extract from receipt text
invoicelane extract --type receipt --text "Receipt #123\nTotal: $50.00"

# Validate fields
invoicelane validate --json '{"documentType":"invoice","fields":{"invoiceNumber":"1","total":100,"currency":"USD","date":"2026-07-04"}}'

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

## Limitations (v0.2)

- **OCR/PDF not supported** — Provide text input directly. If `fileUrl` or `base64` is supplied without text, the API returns a `400 OCR_NOT_AVAILABLE` error.
- **Deterministic engine** — Pattern-based extraction, not ML. Accuracy depends on input formatting.
- **No multi-page document support** — Single document per request.

---

## Talocode ecosystem

Part of **[Talocode](https://github.com/talocode)** — open-source workflow layers for builders. Explore sibling projects:

| Project | What it is |
|---------|------------|
| **[ScreenLane](https://github.com/talocode/screenlane)** | Screen-aware voice command layer |
| **[Tera](https://github.com/talocode/tera)** | AI chat & assistant |
| **[Codra](https://github.com/talocode/codra)** | Local coding agent |
| **[GateLane](https://github.com/talocode/gatelane)** | MCP gateway & agent tool control plane |
| **[ContextLane](https://github.com/talocode/contextlane)** | Context ingestion for persistent agents |
| **[MemoryLane](https://github.com/talocode/memorylane)** | Persistent agent memory |
| **[SignalLane](https://github.com/talocode/signallane)** | X growth intelligence |
| **[ReplyLane](https://github.com/talocode/replylane)** | X reply opportunity intelligence |
| **[CrawlerLane](https://github.com/talocode/crawlerlane)** | Crawler / SEO intelligence |
| **[WebDataLane](https://github.com/talocode/webdatalane)** | Web extraction to structured data |
| **[SearchLane](https://github.com/talocode/searchlane)** | Search layer for agents |
| **[InvoiceLane](https://github.com/talocode/invoicelane)** | Invoicing tools **(this repo)** |
| **[GeoLane](https://github.com/talocode/geolane)** | Geo intelligence |
| **[UgcLane](https://github.com/talocode/ugclane)** | UGC workflows |
| **[OpenSourceLane](https://github.com/talocode/opensourcelane)** | Open-source distribution tools |
| **[StackLane](https://github.com/talocode/stacklane)** | Builder stack platform |
| **[Tradia](https://github.com/talocode/tradia)** | Trading intelligence |
| **[Agent Browser](https://github.com/talocode/agent-browser)** | Browser automation for agents |
| **[Talocode](https://github.com/talocode/talocode)** | Org home & control plane |
| **[Skills](https://github.com/talocode/skills)** | Shared agent skills |
| **[X Agent](https://github.com/talocode/x-agent)** | X automation agent |
| **[LaunchPix](https://github.com/talocode/launchpix)** | Launch tooling |
| **[ForgeCAD](https://github.com/talocode/forgecad)** | CAD workflows |
| **[WorkLane](https://github.com/talocode/worklane)** | Work automation |
| **[ClipLoop](https://github.com/talocode/cliploop)** | Clip / video loops |

MCP-compatible agents integrate via each product's MCP server where available ([Model Context Protocol](https://modelcontextprotocol.io/)).

More: [github.com/talocode](https://github.com/talocode) · [talocode.site](https://talocode.site) · [docs.talocode.site](https://docs.talocode.site)

## License

MIT

## Support

Open-source Talocode products are built and maintained by Abdulmuiz Adeyemo.

Sponsor the work: https://github.com/sponsors/Abdulmuiz44
