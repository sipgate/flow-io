'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Bot,
  Phone,
  FileText,
  MessageSquare,
  Plus,
  Upload,
  Zap,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface QuickActionsProps {
  orgSlug: string
}

export function QuickActions({ orgSlug }: QuickActionsProps) {
  const t = useTranslations('dashboard.quickActions')
  const actions = [
    {
      label: t('newAssistant'),
      description: t('newAssistantDescription'),
      icon: Bot,
      href: `/${orgSlug}/assistants/new`,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10 hover:bg-indigo-500/20',
    },
    {
      label: t('addPhoneNumber'),
      description: t('addPhoneNumberDescription'),
      icon: Phone,
      href: `/${orgSlug}/phone-numbers`,
      color: 'text-teal-500',
      bgColor: 'bg-teal-500/10 hover:bg-teal-500/20',
    },
    {
      label: t('uploadKnowledge'),
      description: t('uploadKnowledgeDescription'),
      icon: Upload,
      href: `/${orgSlug}/knowledge`,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10 hover:bg-amber-500/20',
    },
    {
      label: t('testChat'),
      description: t('testChatDescription'),
      icon: MessageSquare,
      href: `/${orgSlug}/chat`,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10 hover:bg-green-500/20',
    },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => (
            <Link key={action.label} href={action.href} className="block">
              <div
                className={`h-full min-h-[100px] p-4 rounded-lg ${action.bgColor} transition-colors cursor-pointer flex flex-col`}
              >
                <action.icon className={`h-6 w-6 ${action.color} mb-2 flex-shrink-0`} />
                <p className="font-medium text-sm">{action.label}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                  {action.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
