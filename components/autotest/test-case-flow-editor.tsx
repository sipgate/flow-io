'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, User, Bot, GripVertical } from 'lucide-react'
import type { ConversationTurn } from '@/types/autotest'

interface TestCaseFlowEditorProps {
  turns: ConversationTurn[]
  onChange: (turns: ConversationTurn[]) => void
  disabled?: boolean
}

export function TestCaseFlowEditor({
  turns,
  onChange,
  disabled,
}: TestCaseFlowEditorProps) {
  const t = useTranslations('autotest')

  const addTurn = (role: 'user' | 'assistant') => {
    const newTurn: ConversationTurn =
      role === 'user' ? { role: 'user', content: '' } : { role: 'assistant', expected: '' }
    onChange([...turns, newTurn])
  }

  const updateTurn = (index: number, value: string) => {
    const newTurns = [...turns]
    if (newTurns[index].role === 'user') {
      newTurns[index] = { ...newTurns[index], content: value }
    } else {
      newTurns[index] = { ...newTurns[index], expected: value }
    }
    onChange(newTurns)
  }

  const removeTurn = (index: number) => {
    const newTurns = turns.filter((_, i) => i !== index)
    onChange(newTurns)
  }

  const moveTurn = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= turns.length) return
    const newTurns = [...turns]
    const [removed] = newTurns.splice(fromIndex, 1)
    newTurns.splice(toIndex, 0, removed)
    onChange(newTurns)
  }

  return (
    <div className="space-y-4">
      {turns.map((turn, index) => (
        <div
          key={index}
          className={`relative flex gap-3 p-4 rounded-lg border ${
            turn.role === 'user'
              ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
              : 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800'
          }`}
        >
          {/* Drag Handle */}
          <div className="flex flex-col items-center gap-1 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 cursor-move"
              disabled={disabled}
              onClick={() => moveTurn(index, index - 1)}
            >
              <GripVertical className="h-4 w-4 text-neutral-400" />
            </Button>
          </div>

          {/* Icon */}
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              turn.role === 'user'
                ? 'bg-blue-100 dark:bg-blue-900'
                : 'bg-purple-100 dark:bg-purple-900'
            }`}
          >
            {turn.role === 'user' ? (
              <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            ) : (
              <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                {t('turn')} {index + 1}:{' '}
                {turn.role === 'user' ? t('userMessage') : t('assistantExpected')}
              </Label>
              {turns.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-neutral-400 hover:text-red-500"
                  onClick={() => removeTurn(index)}
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Textarea
              value={turn.role === 'user' ? turn.content || '' : turn.expected || ''}
              onChange={(e) => updateTurn(index, e.target.value)}
              placeholder={
                turn.role === 'user'
                  ? t('userMessagePlaceholder')
                  : t('assistantExpectedPlaceholder')
              }
              rows={2}
              disabled={disabled}
              className="resize-none"
            />
            {turn.role === 'assistant' && (
              <p className="text-xs text-neutral-500">
                {t('assistantExpectedHint')}
              </p>
            )}
          </div>
        </div>
      ))}

      {/* Add Turn Buttons */}
      <div className="flex gap-3 justify-center pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => addTurn('user')}
          disabled={disabled}
          className="gap-2"
        >
          <User className="h-4 w-4" />
          {t('addUserTurn')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => addTurn('assistant')}
          disabled={disabled}
          className="gap-2"
        >
          <Bot className="h-4 w-4" />
          {t('addAssistantTurn')}
        </Button>
      </div>

      {/* Helper Text */}
      <p className="text-xs text-center text-neutral-500">
        {t('flowEditorHelp')}
      </p>
    </div>
  )
}
