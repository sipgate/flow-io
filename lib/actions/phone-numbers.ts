'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { fetchSipgateNumbers } from '@/lib/telephony/providers/sipgate/numbers-api'

/**
 * Fetch available phone numbers from the connected sipgate account for selection in the UI.
 * Does NOT save anything to the database.
 */
export async function getSipgateNumbersForSelection(orgId: string) {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership) return { numbers: [], error: 'Unauthorized' }

  return fetchSipgateNumbers(orgId)
}

interface PhoneNumber {
  id: string
  organization_id: string
  phone_number: string
  scenario_id: string | null
  block_id: string | null
  is_active: boolean | null
  assigned_at?: string | null
  provider?: string | null
  provider_config?: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
}

interface PhoneNumberWithScenario {
  id: string
  organization_id: string
  phone_number: string
  scenario_id: string | null
  block_id: string | null
  is_active: boolean | null
  assigned_at?: string | null
  provider?: string | null
  provider_config?: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
  call_scenarios: {
    id: string
    name: string
  } | null
}

/**
 * Manually add a phone number to an organization
 */
export async function addPhoneNumber(orgId: string, phoneNumber: string) {
  const supabase = await createClient()
  const serviceRoleClient = createServiceRoleClient()

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return { error: 'Unauthorized' }
  }

  const normalized = phoneNumber.trim()
  if (!normalized) {
    return { error: 'Rufnummer darf nicht leer sein' }
  }

  const { error } = await serviceRoleClient
    .from('phone_numbers')
    .insert({
      organization_id: orgId,
      phone_number: normalized,
      provider: 'sipgate',
      is_active: true,
    })

  if (error) {
    if (error.code === '23505') {
      return { error: 'Diese Rufnummer existiert bereits' }
    }
    console.error('Error adding phone number:', error)
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Add a block of phone numbers to an organization
 * 10er block: suffix 0-9 (10 numbers)
 * 100er block: suffix 0, 10-99 (91 numbers, 1-9 do not exist)
 */
export async function addPhoneNumberBlock(
  orgId: string,
  prefix: string,
  blockType: '10er' | '100er'
) {
  const supabase = await createClient()
  const serviceRoleClient = createServiceRoleClient()

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return { error: 'Unauthorized', added: 0, skipped: 0 }
  }

  const normalizedPrefix = prefix.trim()
  if (!normalizedPrefix) {
    return { error: 'Präfix darf nicht leer sein', added: 0, skipped: 0 }
  }

  const numbers: string[] = []
  if (blockType === '10er') {
    for (let i = 0; i <= 9; i++) {
      numbers.push(`${normalizedPrefix}${i}`)
    }
  } else {
    // 100er: 0, 10-99 (1-9 do not exist)
    numbers.push(`${normalizedPrefix}0`)
    for (let i = 10; i <= 99; i++) {
      numbers.push(`${normalizedPrefix}${i}`)
    }
  }

  const blockId = crypto.randomUUID()

  const inserts = numbers.map((n) => ({
    organization_id: orgId,
    phone_number: n,
    provider: 'sipgate',
    is_active: true,
    block_id: blockId,
  }))

  const { data: inserted, error } = await serviceRoleClient
    .from('phone_numbers')
    .upsert(inserts, { onConflict: 'phone_number', ignoreDuplicates: true })
    .select('id')

  if (error) {
    console.error('Error adding phone number block:', error)
    return { error: error.message, added: 0, skipped: 0 }
  }

  const added = inserted?.length ?? 0
  const skipped = numbers.length - added
  return { error: null, added, skipped }
}

/**
 * Delete a phone number from an organization
 */
export async function deletePhoneNumber(phoneNumberId: string) {
  const supabase = await createClient()
  const serviceRoleClient = createServiceRoleClient()

  const { data: phoneNumber } = await supabase
    .from('phone_numbers')
    .select('organization_id')
    .eq('id', phoneNumberId)
    .single()

  if (!phoneNumber) {
    return { error: 'Rufnummer nicht gefunden' }
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', phoneNumber.organization_id)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return { error: 'Unauthorized' }
  }

  const { error } = await serviceRoleClient
    .from('phone_numbers')
    .delete()
    .eq('id', phoneNumberId)

  if (error) {
    console.error('Error deleting phone number:', error)
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Delete all phone numbers belonging to a block
 */
export async function deletePhoneNumberBlock(blockId: string, ids?: string[]) {
  const supabase = await createClient()
  const serviceRoleClient = createServiceRoleClient()

  const isPatternBlock = blockId.startsWith('pattern-')

  // Find org via IDs for pattern-blocks (no real block_id in DB), else via block_id
  let organizationId: string
  if (isPatternBlock && ids && ids.length > 0) {
    const { data: sample } = await supabase
      .from('phone_numbers')
      .select('organization_id')
      .eq('id', ids[0])
      .single()
    if (!sample) return { error: 'Block nicht gefunden' }
    organizationId = sample.organization_id
  } else {
    const { data: sample } = await supabase
      .from('phone_numbers')
      .select('organization_id')
      .eq('block_id', blockId)
      .limit(1)
      .single()
    if (!sample) return { error: 'Block nicht gefunden' }
    organizationId = sample.organization_id
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return { error: 'Unauthorized' }
  }

  let deleteError
  if (isPatternBlock && ids && ids.length > 0) {
    const { error } = await serviceRoleClient
      .from('phone_numbers')
      .delete()
      .in('id', ids)
    deleteError = error
  } else {
    const { error } = await serviceRoleClient
      .from('phone_numbers')
      .delete()
      .eq('block_id', blockId)
    deleteError = error
  }

  if (deleteError) {
    console.error('Error deleting phone number block:', deleteError)
    return { error: deleteError.message }
  }

  return { error: null }
}

/**
 * Get all available (unassigned) phone numbers for an organization
 */
export async function getAvailablePhoneNumbers(orgId: string) {
  const supabase = await createClient()

  // Verify user has access to this organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership) {
    return { error: 'Unauthorized', data: null }
  }

  const { data, error } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('organization_id', orgId)
    .is('scenario_id', null)
    .eq('is_active', true)
    .order('phone_number')

  if (error) {
    console.error('Error fetching available phone numbers:', error)
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

/**
 * Get all unassigned phone numbers for an organization
 */
export async function getOrganizationPhoneNumbers(orgId: string) {
  const supabase = await createClient()

  // Verify user has access to this organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership) {
    return { error: 'Unauthorized', phoneNumbers: [] }
  }

  // Get all active phone numbers for this organization with their scenario assignments
  const { data, error } = await supabase
    .from('phone_numbers')
    .select(`
      *,
      call_scenarios:scenario_id (
        id,
        name,
        organization_id
      )
    `)
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('phone_number')

  if (error) {
    console.error('Error fetching phone numbers:', error)
    return { error: error.message, phoneNumbers: [] }
  }

  return { phoneNumbers: data as unknown as PhoneNumberWithScenario[], error: null }
}

/**
 * Unassign a phone number from its assistant
 */
export async function unassignPhoneNumber(phoneNumberId: string) {
  const supabase = await createClient()
  const serviceRoleClient = createServiceRoleClient()

  // Get phone number to verify organization
  const { data: phoneNumber } = await supabase
    .from('phone_numbers')
    .select('organization_id')
    .eq('id', phoneNumberId)
    .single()

  if (!phoneNumber) {
    return { error: 'Phone number not found' }
  }

  // Verify user is admin/owner of the organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', phoneNumber.organization_id)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return { error: 'Unauthorized' }
  }

  // Use service role client for the update to bypass RLS
  const { error } = await serviceRoleClient
    .from('phone_numbers')
    .update({
      scenario_id: null,
      assigned_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', phoneNumberId)

  if (error) {
    console.error('Error unassigning phone number:', error)
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Assign a phone number to a call scenario
 */
export async function assignPhoneNumberToFlow(
  phoneNumberId: string,
  scenarioId: string
) {
  const supabase = await createClient()
  const serviceRoleClient = createServiceRoleClient()

  const { data: phoneNumber } = await supabase
    .from('phone_numbers')
    .select('organization_id')
    .eq('id', phoneNumberId)
    .single()

  if (!phoneNumber) {
    return { error: 'Phone number not found' }
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', phoneNumber.organization_id)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return { error: 'Unauthorized' }
  }

  const { error } = await serviceRoleClient
    .from('phone_numbers')
    .update({
      scenario_id: scenarioId,
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', phoneNumberId)

  if (error) {
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Automatically assign an available phone number to a call scenario
 * Called when creating a new scenario
 */
export async function autoAssignPhoneNumberToFlow(
  scenarioId: string,
  orgId: string
) {
  const serviceRoleClient = createServiceRoleClient()

  const { data: availableNumbers } = await serviceRoleClient
    .from('phone_numbers')
    .select('id')
    .eq('organization_id', orgId)
    .is('scenario_id', null)
    .eq('is_active', true)
    .order('phone_number')
    .limit(1)

  if (!availableNumbers || availableNumbers.length === 0) {
    return { phoneNumber: null, error: 'No available phone numbers in this organization' }
  }

  const { data, error } = await serviceRoleClient
    .from('phone_numbers')
    .update({
      scenario_id: scenarioId,
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', availableNumbers[0].id)
    .select()
    .single()

  if (error) {
    return { phoneNumber: null, error: error.message }
  }

  return { phoneNumber: data as unknown as PhoneNumber, error: null }
}

