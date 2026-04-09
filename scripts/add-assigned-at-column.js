// Script to add assigned_at column to phone_numbers table
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addColumn() {
  console.log('🔧 Adding assigned_at column to phone_numbers table...')

  const { data, error } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS assigned_at timestamp with time zone;'
  })

  if (error) {
    console.error('❌ Error:', error)
    // Try alternative method using raw SQL
    console.log('Trying alternative method...')

    const { error: error2 } = await supabase
      .from('phone_numbers')
      .select('assigned_at')
      .limit(1)

    if (error2 && error2.message.includes('assigned_at')) {
      console.error('❌ Column does not exist and cannot be added via RPC')
      console.log('\n⚠️  Please run this SQL directly in Supabase SQL Editor:')
      console.log('   ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS assigned_at timestamp with time zone;')
      process.exit(1)
    } else {
      console.log('✅ Column already exists or was added successfully')
    }
  } else {
    console.log('✅ Successfully added assigned_at column!')
  }
}

addColumn()
