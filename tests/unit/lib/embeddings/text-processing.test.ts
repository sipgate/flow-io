import { describe, it, expect } from 'vitest'
import { chunkText, estimateTokenCount } from '@/lib/embeddings/text-processing'

// ─── chunkText ────────────────────────────────────────────────────────────────

describe('chunkText', () => {
  it('returns empty array for empty string', () => {
    expect(chunkText('')).toEqual([])
  })

  it('returns empty array for whitespace-only string', () => {
    expect(chunkText('   \n\t  ')).toEqual([])
  })

  it('returns single chunk when text fits within chunkSize', () => {
    const text = 'Hello world.'
    const result = chunkText(text, 1000)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('Hello world.')
  })

  it('normalises excessive whitespace', () => {
    const result = chunkText('foo   \n\n  bar', 1000)
    expect(result[0]).toBe('foo bar')
  })

  it('returns single chunk for text exactly at chunkSize', () => {
    const text = 'a'.repeat(1000)
    const result = chunkText(text, 1000)
    expect(result).toHaveLength(1)
  })

  it('splits long text into multiple chunks', () => {
    const text = 'a'.repeat(3000)
    const result = chunkText(text, 1000, 200)
    expect(result.length).toBeGreaterThan(1)
  })

  it('all chunks are non-empty', () => {
    const text = 'word '.repeat(500) // 2500 chars
    const result = chunkText(text, 1000, 200)
    result.forEach(chunk => expect(chunk.length).toBeGreaterThan(0))
  })

  it('breaks at sentence boundary (period) when within range', () => {
    // Build text so the sentence boundary falls within the last 200 chars of the first chunk
    const sentence1 = 'First sentence ends here. '
    const padding = 'x'.repeat(900 - sentence1.length)
    const sentence2 = 'Second sentence is much longer and goes on and on. '
    const text = sentence1 + padding + sentence2.repeat(10)

    const result = chunkText(text, 1000, 200)
    // The first chunk should end cleanly at a sentence boundary, not mid-word
    expect(result[0]).toMatch(/[.!?]$/)
  })

  it('breaks at question mark boundary when within last 200 chars', () => {
    // The '?' must fall within (chunkSize - 200, chunkSize] to trigger the boundary logic.
    // Place it at position ~850 (within the 800–1000 range for chunkSize=1000).
    const padding = 'x'.repeat(840)
    const sentence = 'Is this a question? ' // '?' at index 859
    const rest = 'yes and more text follows here now for many more characters'.repeat(10)
    const text = padding + sentence + rest

    const result = chunkText(text, 1000, 0)
    expect(result[0]).toMatch(/\?$/)
  })

  it('chunks overlap by roughly the overlap amount', () => {
    const text = 'word '.repeat(600) // 3000 chars
    const chunkSize = 1000
    const overlap = 200
    const result = chunkText(text, chunkSize, overlap)

    // Verify consecutive chunks share content at the boundary
    if (result.length >= 2) {
      const endOfFirst = result[0].slice(-overlap)
      const startOfSecond = result[1].slice(0, overlap)
      // Both should start with the same word prefix (overlap region)
      expect(result[1].startsWith(endOfFirst.split(' ')[0])).toBe(true)
    }
  })

  it('covers the full text — last chunk ends with the original end', () => {
    const text = 'The quick brown fox. ' + 'z'.repeat(2000) + ' Jumps over.'
    const chunks = chunkText(text, 1000, 200)
    const last = chunks[chunks.length - 1]
    // Normalised original ends with "Jumps over."
    expect(last).toMatch(/Jumps over\.$/)
  })

  it('handles overlap larger than advance gracefully (no infinite loop)', () => {
    // overlap >= chunkSize would normally cause an infinite loop; the guard should kick in
    const text = 'a'.repeat(5000)
    const result = chunkText(text, 100, 100) // overlap === chunkSize
    expect(result.length).toBeGreaterThan(0)
    // Should eventually terminate
    const totalCovered = result.reduce((sum, c) => sum + c.length, 0)
    expect(totalCovered).toBeGreaterThan(0)
  })

  it('uses custom chunkSize and overlap', () => {
    const text = 'a'.repeat(500)
    const result = chunkText(text, 100, 20)
    // Each chunk should be at most 100 chars
    result.forEach(chunk => expect(chunk.length).toBeLessThanOrEqual(100))
  })
})

// ─── estimateTokenCount ───────────────────────────────────────────────────────

describe('estimateTokenCount', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokenCount('')).toBe(0)
  })

  it('estimates 1 token for 4 characters', () => {
    expect(estimateTokenCount('abcd')).toBe(1)
  })

  it('rounds up partial tokens', () => {
    expect(estimateTokenCount('abc')).toBe(1) // 3/4 = 0.75 → ceil = 1
    expect(estimateTokenCount('abcde')).toBe(2) // 5/4 = 1.25 → ceil = 2
  })

  it('scales linearly with text length', () => {
    const text = 'a'.repeat(400)
    expect(estimateTokenCount(text)).toBe(100)
  })

  it('handles very long text', () => {
    const text = 'a'.repeat(40000)
    expect(estimateTokenCount(text)).toBe(10000)
  })
})
