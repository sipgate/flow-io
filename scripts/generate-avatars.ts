/**
 * Script to generate avatars for all assistants missing one
 * Run with: npx tsx scripts/generate-avatars.ts
 */

import { readFileSync } from 'fs'
import { join } from 'path'

// Load .env.local manually BEFORE any other imports
const envPath = join(process.cwd(), '.env.local')
try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key && valueParts.length > 0) {
        process.env[key] = valueParts.join('=').replace(/^["']|["']$/g, '')
      }
    }
  }
  console.log('Loaded environment variables from .env.local')
} catch {
  console.error('Could not load .env.local')
  process.exit(1)
}

async function main() {
  console.log('Starting avatar generation for assistants without avatars...\n')

  // Dynamic import AFTER env vars are loaded
  const { generateMissingAvatars } = await import('../lib/services/avatar-generator')

  const result = await generateMissingAvatars()

  console.log('\n=== Results ===')
  console.log(`Generated: ${result.generated}`)
  console.log(`Failed: ${result.failed}`)

  if (result.errors.length > 0) {
    console.log('\nErrors:')
    result.errors.forEach(err => console.log(`  - ${err}`))
  }

  console.log('\nDone!')
}

main().catch(console.error)
