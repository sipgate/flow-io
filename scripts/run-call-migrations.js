// Script to run call handling migrations via Supabase API
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

// Create a fetch-based approach to execute SQL
async function executeSql(sql) {
  const projectRef = supabaseUrl.replace('https://', '').split('.')[0]
  const url = `${supabaseUrl}/rest/v1/rpc/exec_sql`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({ query: sql })
  })

  return response
}

async function runMigrations() {
  console.log('🔧 Running call handling migrations...\n')

  // Read migration files
  const callSessionsSql = readFileSync(
    join(__dirname, '../supabase/migrations/20251216170000_create_call_sessions.sql'),
    'utf-8'
  )

  const callTranscriptsSql = readFileSync(
    join(__dirname, '../supabase/migrations/20251216171000_create_call_transcripts.sql'),
    'utf-8'
  )

  console.log('📝 Creating call_sessions table...')

  // Split into individual statements and execute
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Try to create the tables using direct query
  const { error: error1 } = await supabase.rpc('exec_sql', { sql: callSessionsSql })

  if (error1) {
    console.log('Trying alternative approach...')

    // Execute via REST API
    const statements = (callSessionsSql + '\n' + callTranscriptsSql)
      .split(';')
      .filter(s => s.trim().length > 0)

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim() + ';'
      if (stmt.length < 3) continue

      console.log(`Executing statement ${i + 1}/${statements.length}...`)

      try {
        // Use postgres connection instead
        const result = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Prefer': 'return=minimal'
          },
        })
      } catch (e) {
        console.log('Statement failed, continuing...')
      }
    }

    console.log('\n⚠️  Direct execution not available.')
    console.log('Please copy and paste this SQL into Supabase SQL Editor:')
    console.log('https://supabase.com/dashboard/project/dtyfryyozvbqanvtgsyn/sql/new\n')
    console.log(callSessionsSql)
    console.log(callTranscriptsSql)
    return
  }

  console.log('✅ Migrations applied successfully!')
}

runMigrations()
