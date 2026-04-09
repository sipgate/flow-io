import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js'

/**
 * Format phone numbers for display using libphonenumber-js
 * Converts E.164 format (+492041348770) to human-readable international format
 * Handles numbers with or without + prefix
 */
export function formatPhoneNumber(phoneNumber: string | null | undefined): string {
  if (!phoneNumber) return 'Unknown'

  try {
    // Normalize the phone number - add + if missing
    let normalized = phoneNumber.trim()
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized
    }

    // Check if it's a valid phone number
    if (!isValidPhoneNumber(normalized)) {
      return phoneNumber
    }

    // Parse and format the phone number
    const parsed = parsePhoneNumber(normalized)

    // Return international format (e.g., +49 2041 348770)
    return parsed.formatInternational()
  } catch (error) {
    // If parsing fails, return the original number
    return phoneNumber
  }
}
