'use client'

import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface LLMButtonTooltipProps {
  children: ReactNode
  model: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export function LLMButtonTooltip({ children, model, side = 'top' }: LLMButtonTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side}>
          <span className="font-mono text-xs">{model}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
