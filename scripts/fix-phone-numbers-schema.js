// Script to fix phone_numbers table schema
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
  auth: {
    persistSession: false
  }
})

async function fixSchema() {
  console.log('🔧 Fixing phone_numbers table schema...')

  // First, let's check what columns exist
  const { data: testData, error: testError } = await supabase
    .from('phone_numbers')
    .select('*')
    .limit(1)

  console.log('Current table structure:', testData)

  // Use Supabase's connection string to execute raw SQL
  const dbUrl = supabaseUrl.replace('https://', '')
  const projectRef = dbUrl.split('.')[0]

  console.log('\n⚠️  Please run this SQL in your Supabase SQL Editor:')
  console.log('   https://supabase.com/dashboard/project/' + projectRef + '/sql/new')
  console.log('\nSQL to execute:')
  console.log('----------------------------------------')
  console.log('ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS assigned_at timestamp with time zone;')
  console.log('----------------------------------------\n')
}

fixSchema()
