import { describe, it, expect } from 'vitest'
import { PromptBuilder } from '@/lib/llm/prompt-builder'

describe('PromptBuilder', () => {
  it('returns base prompt unchanged when no options are added', () => {
    const result = new PromptBuilder('You are a helpful assistant.').build()
    expect(result).toBe('You are a helpful assistant.')
  })

  it('appends variable collection prompt', () => {
    const result = new PromptBuilder('Base.')
      .withVariableCollection('Collect name.')
      .build()
    expect(result).toBe('Base.\n\nCollect name.')
  })

  it('appends validation context', () => {
    const result = new PromptBuilder('Base.')
      .withValidationContext('Name is valid.')
      .build()
    expect(result).toBe('Base.\n\nName is valid.')
  })

  it('appends flow transfer rules when nodes are provided', () => {
    const nodes = [{ nodeId: 'n1', assistantId: 'a1', label: 'Support', transferInstruction: '', inheritVoice: false }]
    const result = new PromptBuilder('Base.')
      .withFlowTransferRules(nodes)
      .build()
    expect(result).toContain('transfer_to_agent')
    expect(result).toContain('WICHTIG — Weiterleitung')
  })

  it('does NOT append flow transfer rules when nodes array is empty', () => {
    const result = new PromptBuilder('Base.')
      .withFlowTransferRules([])
      .build()
    expect(result).toBe('Base.')
  })

  it('does NOT append flow transfer rules when nodes is undefined', () => {
    const result = new PromptBuilder('Base.')
      .withFlowTransferRules(undefined)
      .build()
    expect(result).toBe('Base.')
  })

  it('prepends seamless transfer rule BEFORE the base prompt', () => {
    const result = new PromptBuilder('Base system prompt.')
      .withSeamlessTransfer(true)
      .build()
    const seamlessIndex = result.indexOf('ABSOLUT VERBINDLICH')
    const baseIndex = result.indexOf('Base system prompt.')
    expect(seamlessIndex).toBeLessThan(baseIndex)
    expect(seamlessIndex).toBe(0)
  })

  it('does NOT prepend seamless rule when disabled', () => {
    const result = new PromptBuilder('Base.')
      .withSeamlessTransfer(false)
      .build()
    expect(result).toBe('Base.')
    expect(result).not.toContain('ABSOLUT VERBINDLICH')
  })

  it('does NOT prepend seamless rule when undefined', () => {
    const result = new PromptBuilder('Base.')
      .withSeamlessTransfer(undefined)
      .build()
    expect(result).toBe('Base.')
  })

  it('appends spelling instruction', () => {
    const result = new PromptBuilder('Base.')
      .withSpellingInstruction()
      .build()
    expect(result).toContain('[spell]')
    expect(result).toContain('WICHTIG — Buchstabieren')
  })

  it('builds full prompt with all options in correct order', () => {
    const nodes = [{ nodeId: 'n1', assistantId: 'a1', label: 'Support', transferInstruction: '', inheritVoice: false }]
    const result = new PromptBuilder('System prompt.')
      .withVariableCollection('Collect email.')
      .withValidationContext('Email: valid.')
      .withFlowTransferRules(nodes)
      .withSeamlessTransfer(true)
      .withSpellingInstruction()
      .build()

    // Seamless rule must come first
    expect(result.indexOf('ABSOLUT VERBINDLICH')).toBe(0)
    // Base prompt follows seamless rule
    expect(result.indexOf('System prompt.')).toBeGreaterThan(0)
    // Variable collection follows base
    expect(result.indexOf('Collect email.')).toBeGreaterThan(result.indexOf('System prompt.'))
    // Spelling instruction is last
    expect(result.indexOf('WICHTIG — Buchstabieren')).toBeGreaterThan(result.indexOf('transfer_to_agent'))
  })

  it('ignores undefined/empty variableCollection and validationContext', () => {
    const result = new PromptBuilder('Base.')
      .withVariableCollection(undefined)
      .withValidationContext(undefined)
      .build()
    expect(result).toBe('Base.')
  })

  it('supports method chaining', () => {
    const builder = new PromptBuilder('Base.')
    const result = builder
      .withSpellingInstruction()
      .withVariableCollection('Collect.')
    expect(result).toBeInstanceOf(PromptBuilder)
  })
})
