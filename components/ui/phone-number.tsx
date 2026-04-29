import * as React from 'react'

import { cn } from '@/lib/utils'
import { formatPhoneNumber } from '@/lib/utils/format-phone'

interface PhoneNumberProps extends Omit<React.ComponentProps<'span'>, 'children'> {
  value: string | null | undefined
  fallback?: React.ReactNode
  asLink?: boolean
}

export function PhoneNumber({
  value,
  fallback = '—',
  asLink = false,
  className,
  ...props
}: PhoneNumberProps) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return (
      <span data-slot="phone-number" className={className} {...props}>
        {fallback}
      </span>
    )
  }

  const formatted = formatPhoneNumber(trimmed)

  if (asLink) {
    const tel = trimmed.startsWith('+') ? trimmed : `+${trimmed}`
    return (
      <a
        data-slot="phone-number"
        href={`tel:${tel}`}
        className={cn('font-mono hover:underline', className)}
      >
        {formatted}
      </a>
    )
  }

  return (
    <span
      data-slot="phone-number"
      className={cn('font-mono', className)}
      {...props}
    >
      {formatted}
    </span>
  )
}
