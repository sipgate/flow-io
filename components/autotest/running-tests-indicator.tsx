'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, XCircle, Sparkles } from 'lucide-react'
import { getOverallTestStatus } from '@/lib/actions/autotest'

interface RunningTestsIndicatorProps {
  organizationId: string
}

type TestStatus = 'running' | 'passed' | 'partial' | 'failed' | 'none'

export function RunningTestsIndicator({ organizationId }: RunningTestsIndicatorProps) {
  const [status, setStatus] = useState<TestStatus>('none')
  const [runningCount, setRunningCount] = useState(0)
  const [hasCustomPrompt, setHasCustomPrompt] = useState(false)

  useEffect(() => {
    let mounted = true

    const checkStatus = async () => {
      const result = await getOverallTestStatus(organizationId)
      if (mounted) {
        setStatus(result.status)
        setRunningCount(result.runningCount)
        setHasCustomPrompt(result.hasCustomPrompt)
      }
    }

    // Check immediately
    checkStatus()

    // Poll every 10 seconds
    const interval = setInterval(checkStatus, 10_000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [organizationId])

  if (status === 'none') {
    return null
  }

  if (status === 'running') {
    return (
      <span className="ml-auto flex items-center gap-1">
        {hasCustomPrompt && (
          <Sparkles className="h-3.5 w-3.5 text-blue-400" />
        )}
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-medium text-white animate-pulse">
          {runningCount}
        </span>
      </span>
    )
  }

  if (status === 'passed') {
    return (
      <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-lime-500 text-white">
        <CheckCircle2 className="h-3 w-3" />
      </span>
    )
  }

  if (status === 'partial') {
    return (
      <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white">
        <AlertTriangle className="h-3 w-3" />
      </span>
    )
  }

  if (status === 'failed') {
    return (
      <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
        <XCircle className="h-3 w-3" />
      </span>
    )
  }

  return null
}
