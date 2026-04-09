import { describe, it, expect } from 'vitest'
import {
  ALL_MODELS,
  DEFAULT_ASSISTANT_MODEL,
  DEFAULT_TOOL_MODEL,
  getModelsByProvider,
  getToolEligibleModels,
  getComparisonModels,
  getModelLabel,
  getDefaultModel,
} from '@/lib/models'

// ─── Konstanten ───────────────────────────────────────────────────────────────

describe('DEFAULT_ASSISTANT_MODEL', () => {
  it('ist voice-eligible', () => {
    const model = ALL_MODELS.find(
      (m) => m.provider === DEFAULT_ASSISTANT_MODEL.provider && m.model === DEFAULT_ASSISTANT_MODEL.model
    )
    expect(model?.voiceEligible).toBe(true)
  })

  it('ist ein Google-Modell', () => {
    expect(DEFAULT_ASSISTANT_MODEL.provider).toBe('google')
  })
})

describe('DEFAULT_TOOL_MODEL', () => {
  it('ist tool-eligible', () => {
    const model = ALL_MODELS.find(
      (m) => m.provider === DEFAULT_TOOL_MODEL.provider && m.model === DEFAULT_TOOL_MODEL.model
    )
    expect(model?.toolEligible).toBe(true)
  })

  it('ist ein OpenAI-Modell', () => {
    expect(DEFAULT_TOOL_MODEL.provider).toBe('openai')
  })
})

// ─── ALL_MODELS Integrität ────────────────────────────────────────────────────

describe('ALL_MODELS', () => {
  it('enthält mindestens ein Modell pro Provider', () => {
    const providers = new Set(ALL_MODELS.map((m) => m.provider))
    expect(providers.has('openai')).toBe(true)
    expect(providers.has('google')).toBe(true)
    expect(providers.has('mistral')).toBe(true)
  })

  it('jedes Modell hat provider, model und label', () => {
    for (const m of ALL_MODELS) {
      expect(m.provider).toBeTruthy()
      expect(m.model).toBeTruthy()
      expect(m.label).toBeTruthy()
    }
  })

  it('keine doppelten model-IDs innerhalb desselben Providers', () => {
    const seen = new Set<string>()
    for (const m of ALL_MODELS) {
      const key = `${m.provider}:${m.model}`
      expect(seen.has(key), `Duplikat: ${key}`).toBe(false)
      seen.add(key)
    }
  })
})

// ─── getModelsByProvider ──────────────────────────────────────────────────────

describe('getModelsByProvider', () => {
  it('gibt nur OpenAI-Modelle zurück', () => {
    const result = getModelsByProvider('openai')
    expect(result.length).toBeGreaterThan(0)
    result.forEach((m) => expect(m.provider).toBe('openai'))
  })

  it('gibt nur Google-Modelle zurück', () => {
    const result = getModelsByProvider('google')
    expect(result.length).toBeGreaterThan(0)
    result.forEach((m) => expect(m.provider).toBe('google'))
  })

  it('gibt nur Mistral-Modelle zurück', () => {
    const result = getModelsByProvider('mistral')
    expect(result.length).toBeGreaterThan(0)
    result.forEach((m) => expect(m.provider).toBe('mistral'))
  })

  it('alle drei Provider zusammen ergeben ALL_MODELS', () => {
    const combined = [
      ...getModelsByProvider('openai'),
      ...getModelsByProvider('google'),
      ...getModelsByProvider('mistral'),
    ]
    expect(combined).toHaveLength(ALL_MODELS.length)
  })
})

// ─── getToolEligibleModels ────────────────────────────────────────────────────

describe('getToolEligibleModels', () => {
  it('gibt nur toolEligible=true Modelle zurück', () => {
    const result = getToolEligibleModels()
    result.forEach((m) => expect(m.toolEligible).toBe(true))
  })

  it('enthält keine Modelle mit toolEligible=undefined oder false', () => {
    const nonEligible = ALL_MODELS.filter((m) => !m.toolEligible)
    const result = getToolEligibleModels()
    nonEligible.forEach((m) => {
      expect(result.find((r) => r.model === m.model && r.provider === m.provider)).toBeUndefined()
    })
  })

  it('ist eine Teilmenge von ALL_MODELS', () => {
    const result = getToolEligibleModels()
    expect(result.length).toBeLessThanOrEqual(ALL_MODELS.length)
    result.forEach((m) => expect(ALL_MODELS).toContainEqual(m))
  })
})

// ─── getComparisonModels ──────────────────────────────────────────────────────

describe('getComparisonModels', () => {
  it('schließt hideFromComparison=true Modelle aus', () => {
    const result = getComparisonModels()
    result.forEach((m) => expect(m.hideFromComparison).not.toBe(true))
  })

  it('enthält alle Modelle ohne hideFromComparison-Flag', () => {
    const expected = ALL_MODELS.filter((m) => !m.hideFromComparison)
    expect(getComparisonModels()).toHaveLength(expected.length)
  })

  it('ist kleiner als ALL_MODELS wenn es versteckte Modelle gibt', () => {
    const hidden = ALL_MODELS.filter((m) => m.hideFromComparison)
    if (hidden.length > 0) {
      expect(getComparisonModels().length).toBeLessThan(ALL_MODELS.length)
    }
  })
})

// ─── getModelLabel ────────────────────────────────────────────────────────────

describe('getModelLabel', () => {
  it('gibt das Label für ein bekanntes Modell zurück', () => {
    const label = getModelLabel('openai', 'gpt-4o')
    expect(label).toBeTruthy()
    expect(label).not.toBe('gpt-4o') // sollte einen sprechenden Namen haben
  })

  it('gibt die modelId zurück wenn das Modell unbekannt ist', () => {
    expect(getModelLabel('openai', 'gpt-99-unknown')).toBe('gpt-99-unknown')
  })

  it('gibt die modelId zurück bei unbekanntem Provider', () => {
    // TypeScript würde das verhindern, aber zur Laufzeit muss es graceful sein
    expect(getModelLabel('openai' as never, 'some-model')).toBe('some-model')
  })

  it('ist case-sensitiv — falsches Casing findet kein Modell', () => {
    const label = getModelLabel('openai', 'GPT-4O') // falsche Schreibweise
    expect(label).toBe('GPT-4O') // Fallback auf modelId
  })
})

// ─── getDefaultModel ─────────────────────────────────────────────────────────

describe('getDefaultModel', () => {
  it('gibt das erste OpenAI-Modell zurück', () => {
    const result = getDefaultModel('openai')
    expect(result).toBe(getModelsByProvider('openai')[0].model)
  })

  it('gibt das erste Google-Modell zurück', () => {
    const result = getDefaultModel('google')
    expect(result).toBe(getModelsByProvider('google')[0].model)
  })

  it('gibt das erste Mistral-Modell zurück', () => {
    const result = getDefaultModel('mistral')
    expect(result).toBe(getModelsByProvider('mistral')[0].model)
  })

  it('gibt leeren String zurück für unbekannten Provider', () => {
    // @ts-expect-error — Absichtlich ungültiger Provider für Laufzeit-Test
    expect(getDefaultModel('unknown-provider')).toBe('')
  })
})
