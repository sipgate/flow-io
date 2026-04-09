// Script to apply call handling migrations
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMigrations() {
  console.log('🔧 Applying call handling migrations...\n')

  // Read migration files
  const callSessionsMigration = readFileSync(
    join(__dirname, '../supabase/migrations/20251216170000_create_call_sessions.sql'),
    'utf-8'
  )

  const callTranscriptsMigration = readFileSync(
    join(__dirname, '../supabase/migrations/20251216171000_create_call_transcripts.sql'),
    'utf-8'
  )

  // Check if tables already exist
  const { data: existingTables } = await supabase
    .from('call_sessions')
    .select('id')
    .limit(1)

  if (existingTables !== null) {
    console.log('✅ Tables already exist, skipping migrations')
    return
  }

  console.log('📝 Applying call_sessions migration...')
  console.log('⚠️  Please run this SQL in your Supabase SQL Editor:')
  console.log('   https://supabase.com/dashboard/project/dtyfryyozvbqanvtgsyn/sql/new\n')
  console.log('--- CALL SESSIONS MIGRATION ---')
  console.log(callSessionsMigration)
  console.log('\n--- CALL TRANSCRIPTS MIGRATION ---')
  console.log(callTranscriptsMigration)
}

applyMigrations()
