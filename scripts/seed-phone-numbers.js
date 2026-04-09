// Script to seed phone numbers into Supabase
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

async function seedPhoneNumbers() {
  console.log('🌱 Seeding phone numbers...')

  // Get the first organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id')
    .order('created_at')
    .limit(1)
    .single()

  if (orgError || !org) {
    console.error('❌ No organization found:', orgError)
    process.exit(1)
  }

  console.log(`✓ Found organization: ${org.id}`)

  // Generate phone numbers
  const phoneNumbers = [
    { phone_number: '+492041348770' }, // 02041-34877-0
  ]

  // Add numbers 10-99
  for (let i = 10; i <= 99; i++) {
    phoneNumbers.push({
      phone_number: `+49204134877${i}`,
    })
  }

  console.log(`📞 Inserting ${phoneNumbers.length} phone numbers...`)

  // Insert phone numbers
  const { data, error } = await supabase.from('phone_numbers').insert(
    phoneNumbers.map((pn) => ({
      organization_id: org.id,
      phone_number: pn.phone_number,
      is_active: true,
    }))
  )

  if (error) {
    console.error('❌ Error inserting phone numbers:', error)
    process.exit(1)
  }

  console.log(`✅ Successfully seeded ${phoneNumbers.length} phone numbers!`)
  console.log('   Range: +492041348770, +4920413487710 to +4920413487799')
}

seedPhoneNumbers()
