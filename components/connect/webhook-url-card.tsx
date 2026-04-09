'use client'

import { useState } from 'react'
import { Copy, Check, Link2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface WebhookUrlCardProps {
  url: string
}

export function WebhookUrlCard({ url }: WebhookUrlCardProps) {
  const t = useTranslations('connect.webhookUrl')
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success(t('copied'))
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="h-5 w-5 text-neutral-500" />
        <h2 className="text-lg font-semibold">{t('title')}</h2>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {t('description')}
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3 py-2 font-mono text-sm text-neutral-800 dark:text-neutral-200 overflow-x-auto whitespace-nowrap">
          {url}
        </div>
        <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
          {copied ? <Check className="h-4 w-4 text-lime-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
