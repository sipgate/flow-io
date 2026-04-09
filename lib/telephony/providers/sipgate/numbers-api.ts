import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { SipgateProvider } from './oauth'
import { parsePhoneNumber } from 'libphonenumber-js'

interface SipgateV3Routing {
  targetType: string | null
  targetId: string | null
  displayAlias: string | null
  targetOwner: string | null
}

interface SipgateV3NumberRaw {
  e164Number: string
  type: string
  routing: SipgateV3Routing | null
  numbers?: SipgateV3NumberRaw[]
}

type SipgateV3Response = SipgateV3NumberRaw[] | { numbers: SipgateV3NumberRaw[] }

export interface SipgateNumber {
  number: string
  localized: string
  type: string
  routing: SipgateV3Routing | null
  /** For block entries: the individual numbers with their routing */
  blockNumbers?: SipgateNumber[]
}

interface TelephonyAccountRow {
  id: string
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
}

function localizeNumber(e164: string): string {
  try {
    return parsePhoneNumber(e164).formatInternational()
  } catch {
    return e164
  }
}

/** For block prefixes (not valid E.164): format prefix+"0" then strip the trailing digit+space. */
function localizeBlockPrefix(prefix: string): string {
  try {
    const formatted = parsePhoneNumber(prefix + '0').formatInternational()
    return formatted.slice(0, -1).trimEnd()
  } catch {
    return prefix
  }
}

function convertRaw(n: SipgateV3NumberRaw): SipgateNumber {
  const isBlock = n.type.includes('_BLOCK') || n.type.includes('_PROLONGATION')
  return {
    number: n.e164Number,
    localized: isBlock ? localizeBlockPrefix(n.e164Number) : localizeNumber(n.e164Number),
    type: n.type,
    routing: n.routing ?? null,
    blockNumbers: n.numbers?.map(convertRaw),
  }
}

/**
 * Fetches all phone numbers from the sipgate v3 API.
 * Refreshes the access token if expired.
 */
export async function fetchSipgateNumbers(
  organizationId: string
): Promise<{ numbers: SipgateNumber[]; error: string | null }> {
  const serviceSupabase = createServiceRoleClient()

  const { data: account, error: accountError } = await serviceSupabase
    .from('telephony_accounts')
    .select('id, access_token, refresh_token, token_expires_at')
    .eq('organization_id', organizationId)
    .eq('provider', 'sipgate')
    .eq('is_active', true)
    .maybeSingle()

  if (accountError || !account) {
    return { numbers: [], error: 'Kein verbundener sipgate-Account gefunden' }
  }

  const row = account as TelephonyAccountRow
  let accessToken = row.access_token

  if (!accessToken) {
    return { numbers: [], error: 'Kein Access Token vorhanden' }
  }

  // Refresh token if expired (with 60s buffer)
  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at) : null
  const isExpired = !expiresAt || expiresAt.getTime() - Date.now() < 60_000

  if (isExpired && row.refresh_token) {
    try {
      const sipgate = new SipgateProvider()
      const tokens = await sipgate.refreshTokens(row.refresh_token)
      accessToken = tokens.accessToken

      await serviceSupabase
        .from('telephony_accounts')
        .update({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_expires_at: tokens.expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
    } catch {
      return { numbers: [], error: 'Token-Aktualisierung fehlgeschlagen. Bitte erneut mit sipgate verbinden.' }
    }
  }

  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  }

  const allNumbers: SipgateNumber[] = []
  let offset = 0
  const limit = 100
  const maxPages = 50

  for (let page = 0; page < maxPages; page++) {
    const response = await fetch(
      `https://api.sipgate.com/v3/phone-numbers?offset=${offset}&limit=${limit}`,
      { headers: authHeaders }
    )

    if (!response.ok) {
      const text = await response.text()
      console.error('sipgate /v3/phone-numbers error:', response.status, text)
      return { numbers: [], error: `sipgate API-Fehler: ${response.status}` }
    }

    const data = (await response.json()) as SipgateV3Response
    const items: SipgateV3NumberRaw[] = Array.isArray(data) ? data : (data.numbers ?? [])

    for (const n of items) {
      allNumbers.push(convertRaw(n))
    }

    if (items.length < limit) break
    offset += limit
  }

  return { numbers: allNumbers, error: null }
}
