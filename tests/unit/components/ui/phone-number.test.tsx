import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

import { PhoneNumber } from '@/components/ui/phone-number'

describe('PhoneNumber', () => {
  it('formats a valid E.164 number', () => {
    const { container } = render(<PhoneNumber value="+492041348770" />)
    expect(container.textContent).toBe('+49 2041 348770')
  })

  it('adds a + prefix to bare international numbers', () => {
    const { container } = render(<PhoneNumber value="492041348770" />)
    expect(container.textContent).toBe('+49 2041 348770')
  })

  it('renders the fallback when value is null', () => {
    const { container } = render(<PhoneNumber value={null} />)
    expect(container.textContent).toBe('—')
  })

  it('renders the fallback when value is undefined', () => {
    const { container } = render(<PhoneNumber value={undefined} />)
    expect(container.textContent).toBe('—')
  })

  it('renders the fallback for an empty string', () => {
    const { container } = render(<PhoneNumber value="" />)
    expect(container.textContent).toBe('—')
  })

  it('renders the fallback for a whitespace-only string', () => {
    const { container } = render(<PhoneNumber value="   " />)
    expect(container.textContent).toBe('—')
  })

  it('renders a custom fallback', () => {
    const { container } = render(<PhoneNumber value={undefined} fallback="Unknown caller" />)
    expect(container.textContent).toBe('Unknown caller')
  })

  it('renders the original string when not parseable', () => {
    const { container } = render(<PhoneNumber value="not-a-number" />)
    expect(container.textContent).toBe('not-a-number')
  })

  it('renders as a tel: link when asLink is set', () => {
    const { container } = render(<PhoneNumber value="+492041348770" asLink />)
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('tel:+492041348770')
    expect(link?.textContent).toBe('+49 2041 348770')
  })

  it('prepends + to bare numbers in tel: links', () => {
    const { container } = render(<PhoneNumber value="492041348770" asLink />)
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('tel:+492041348770')
  })

  it('renders the fallback (not a link) when asLink is set but value is empty', () => {
    const { container } = render(<PhoneNumber value={null} asLink fallback="Unknown" />)
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toBe('Unknown')
  })

  it.each([
    ['+12025551234',   '+1 202 555 1234'],   // US
    ['+442079460958',  '+44 20 7946 0958'],  // UK
    ['+43512123456',   '+43 512 123456'],    // AT
    ['+33145678901',   '+33 1 45 67 89 01'], // FR
    ['+4915155512345', '+49 1515 5512345'],  // DE mobile
  ])('formats international numbers (%s)', (input, expected) => {
    const { container } = render(<PhoneNumber value={input} />)
    expect(container.textContent).toBe(expected)
  })

  it('preserves font-mono and merges custom className', () => {
    const { container } = render(
      <PhoneNumber value="+492041348770" className="text-sm font-medium" />
    )
    const span = container.querySelector('[data-slot="phone-number"]')
    expect(span?.className).toContain('font-mono')
    expect(span?.className).toContain('text-sm')
    expect(span?.className).toContain('font-medium')
  })

  it('does not apply font-mono to the fallback (so non-numeric labels look normal)', () => {
    const { container } = render(<PhoneNumber value={null} fallback="Unknown caller" />)
    const span = container.querySelector('[data-slot="phone-number"]')
    expect(span?.className ?? '').not.toContain('font-mono')
  })
})
