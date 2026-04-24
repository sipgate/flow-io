import { substitutePromptVariables } from '@/lib/utils/prompt-variables'

export function renderOpeningMessage(params: {
  template?: string | null
  fallback?: string
  assistantName: string
  callerNumber?: string | null
  callDirection?: 'inbound' | 'outbound'
  contextData?: Record<string, unknown> | null
}): string | null {
  const template = params.template || params.fallback
  if (!template) return null

  const custom = Object.fromEntries(
    Object.entries(params.contextData ?? {}).map(([key, value]) => [key, String(value)])
  )

  return substitutePromptVariables(template, {
    assistantName: params.assistantName,
    callerNumber: params.callerNumber,
    callDirection: params.callDirection,
    custom,
  })
}
