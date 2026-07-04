import { extractFromText, extractInvoiceFromText, extractReceiptFromText, validateFields, toCsv } from './engine.js'

function usage() {
  console.error('Usage:')
  console.error('  invoicelane extract --type <invoice|receipt|auto> --text "..."')
  console.error('  invoicelane validate --json \'{"documentType":"invoice","fields":{"total":100}}\'')
  console.error('  invoicelane csv --json \'[{"merchant":"ABC","total":100}]\'')
  console.error('  invoicelane --help')
  process.exit(1)
}

function parseArgs(): { command: string; type?: string; text?: string; json?: string } {
  const args = process.argv.slice(2)
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') usage()

  const command = args[0]
  const parsed: Record<string, string> = {}
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      const val = args[i + 1]
      if (val && val.startsWith('--')) {
        parsed[key] = 'true'
      } else if (val !== undefined) {
        parsed[key] = val
        i++
      } else {
        parsed[key] = 'true'
      }
    }
  }
  return { command, type: parsed.type, text: parsed.text, json: parsed.json }
}

function main() {
  try {
    const { command, type, text, json } = parseArgs()

    switch (command) {
      case 'extract': {
        if (!text) {
          console.error('Error: --text is required for extract')
          process.exit(1)
        }
        const docType = (type as 'invoice' | 'receipt' | 'auto') || 'auto'
        const result = extractFromText(text, { type: docType })
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
        break
      }

      case 'validate': {
        if (!json) {
          console.error('Error: --json is required for validate')
          process.exit(1)
        }
        const input = JSON.parse(json)
        const result = validateFields(input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
        break
      }

      case 'csv': {
        if (!json) {
          console.error('Error: --json is required for csv')
          process.exit(1)
        }
        const rows = JSON.parse(json) as Record<string, unknown>[]
        const csv = toCsv(rows)
        process.stdout.write(csv + '\n')
        break
      }

      default:
        usage()
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Error: ${message}`)
    process.exit(1)
  }
}

main()
