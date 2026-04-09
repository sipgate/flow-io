'use client'

import { useTranslations } from 'next-intl'
import { Variable, TrendingUp } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import type { TopVariable } from '@/lib/actions/dashboard'

interface TopVariablesProps {
  variables: TopVariable[]
}

export function TopVariables({ variables }: TopVariablesProps) {
  const t = useTranslations('dashboard.topVariables')
  const maxCount = Math.max(...variables.map((v) => v.count), 1)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Variable className="h-5 w-5 text-pink-500" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {variables.length === 0 ? (
          <div className="text-center py-6 text-neutral-500">
            <Variable className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{t('noVariables')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {variables.map((variable, index) => (
              <div key={variable.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium truncate">{variable.label}</span>
                  <span className="text-neutral-500">{variable.count}</span>
                </div>
                <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${(variable.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
