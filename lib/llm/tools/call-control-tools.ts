/**
 * LLM Tools for Call Control
 *
 * These tools allow the AI assistant to control the call flow:
 * - Hangup: End the call
 * - Forward: Transfer the call to another number
 * - Take Note: Save a note for the user
 */

import type { LLMTool } from '@/lib/llm/types'
import type { CallToolConfig } from '@/types/call-tools'

// Special tool names that trigger call control actions
export const CALL_CONTROL_TOOL_NAMES = {
  HANGUP: 'hangup_call',
  FORWARD: 'forward_call',
  TAKE_NOTE: 'take_note',
} as const

/**
 * Check if a tool name is a call control tool
 */
export function isCallControlTool(toolName: string): boolean {
  return (Object.values(CALL_CONTROL_TOOL_NAMES) as string[]).includes(toolName)
}

/**
 * Build the hangup tool definition
 */
export function buildHangupTool(config: CallToolConfig): LLMTool {
  const instructions = config.hangup_instructions
    ? `\n\nWhen to use: ${config.hangup_instructions}`
    : ''

  return {
    type: 'function',
    function: {
      name: CALL_CONTROL_TOOL_NAMES.HANGUP,
      description: `End the current phone call. Use this when the conversation is complete, the caller says goodbye, or there's nothing more you can help with.${instructions}`,
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Brief reason for ending the call (e.g., "conversation complete", "caller requested", "unable to assist")',
          },
          farewell_message: {
            type: 'string',
            description: 'Optional farewell message to say before hanging up',
          },
        },
        required: ['reason'],
      },
    },
  }
}

/**
 * Build the forward/transfer tool definition
 */
export function buildForwardTool(config: CallToolConfig): LLMTool {
  const targetInfo = config.forward_phone_number
    ? ` The call will be transferred to ${config.forward_caller_id_name || 'the configured recipient'}.`
    : ''

  const instructions = config.forward_instructions
    ? `\n\nWhen to use: ${config.forward_instructions}`
    : ''

  return {
    type: 'function',
    function: {
      name: CALL_CONTROL_TOOL_NAMES.FORWARD,
      description: `Transfer the current call to a human agent or another department.${targetInfo}${instructions}`,
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Reason for transferring the call (e.g., "caller requested human agent", "complex issue requiring specialist")',
          },
          handoff_message: {
            type: 'string',
            description: 'Message to tell the caller before transferring (e.g., "I\'ll transfer you to our support team now")',
          },
        },
        required: ['reason'],
      },
    },
  }
}

/**
 * Build the take note tool definition
 */
export function buildNoteTool(config: CallToolConfig): LLMTool {
  const instructions = config.note_instructions
    ? `\n\nWhen to use: ${config.note_instructions}`
    : ''

  return {
    type: 'function',
    function: {
      name: CALL_CONTROL_TOOL_NAMES.TAKE_NOTE,
      description: `Save an important note about this call for the user to review later. Use this to record action items, important information, or follow-up tasks mentioned during the conversation.${instructions}`,
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The content of the note - what needs to be remembered or acted upon',
          },
          category: {
            type: 'string',
            enum: ['action_required', 'follow_up', 'info', 'complaint', 'feedback'],
            description: 'Category of the note',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Priority level of the note',
          },
        },
        required: ['content'],
      },
    },
  }
}

/**
 * Build all enabled call control tools for an assistant
 */
export function buildCallControlTools(config: CallToolConfig | null): LLMTool[] {
  if (!config) return []

  const tools: LLMTool[] = []

  if (config.hangup_enabled) {
    tools.push(buildHangupTool(config))
  }

  if (config.forward_enabled && config.forward_phone_number) {
    tools.push(buildForwardTool(config))
  }

  if (config.note_enabled) {
    tools.push(buildNoteTool(config))
  }

  return tools
}

/**
 * Parse tool call arguments for hangup
 */
export interface HangupToolArgs {
  reason: string
  farewell_message?: string
}

/**
 * Parse tool call arguments for forward
 */
export interface ForwardToolArgs {
  reason: string
  handoff_message?: string
}

/**
 * Parse tool call arguments for take note
 */
export interface NoteToolArgs {
  content: string
  category?: 'action_required' | 'follow_up' | 'info' | 'complaint' | 'feedback'
  priority?: 'low' | 'medium' | 'high'
}
