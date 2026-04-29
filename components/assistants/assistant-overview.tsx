'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { formatDistanceToNow, type Locale } from 'date-fns'
import { de, enUS, es } from 'date-fns/locale'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  Edit,
  History,
  Loader2,
  MessageSquare,
  Phone,
  Plug,
  ScrollText,
  Sparkles,
  TestTube,
  Trash2,
  Variable as VariableIcon,
  Webhook,
  Workflow,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PhoneNumber } from '@/components/ui/phone-number'
import { AssistantHistorySheet } from '@/components/assistants/assistant-history-sheet'
import {
  deleteAssistant,
  deployAssistant,
  type AssistantOverview,
  type AssistantOverviewLink,
  type AssistantOverviewRecentCall,
  type AssistantScenarioLink,
} from '@/lib/actions/assistants'
import { VoiceLabel } from '@/components/ui/voice-label'
import { ALL_MODELS } from '@/lib/models'

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  google: 'Google',
  mistral: 'Mistral',
  azure: 'Azure',
  deepgram: 'Deepgram',
  elevenlabs: 'ElevenLabs',
  eleven_labs: 'ElevenLabs',
}

function prettyProvider(provider: string | null | undefined): string | null {
  if (!provider) return null
  return PROVIDER_LABELS[provider] ?? provider
}

function findModelLabel(model: string | null): string | null {
  if (!model) return null
  return ALL_MODELS.find((m) => m.model === model)?.label ?? model
}

interface AssistantData {
  id: string
  name: string
  description: string | null
  voice_provider: string | null
  voice_id: string | null
  voice_language: string | null
  llm_provider: string | null
  llm_model: string | null
  llm_temperature: number | null
  thinking_level: string | null
  system_prompt: string | null
  opening_message: string | null
  is_active: boolean | null
  avatar_url: string | null
  enable_hesitation: boolean | null
  enable_semantic_eot: boolean | null
  stt_provider: string | null
  stt_languages: string[] | null
  deployed_at: string | null
  has_undeployed_changes: boolean | null
}

interface AssistantOverviewProps {
  assistant: AssistantData
  overview: AssistantOverview
  organizationId: string
  orgSlug: string
  canManage: boolean
}

const PROMPT_SNIPPET_LINES = 6

function getDateLocale(locale: string) {
  if (locale.startsWith('de')) return de
  if (locale.startsWith('es')) return es
  return enUS
}

function formatDuration(seconds: number) {
  if (!seconds) return '0s'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  if (s === 0) return `${m}m`
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

export function AssistantOverviewView({
  assistant,
  overview,
  organizationId: _organizationId,
  orgSlug,
  canManage,
}: AssistantOverviewProps) {
  const router = useRouter()
  const t = useTranslations('assistants.overview')
  const tDeploy = useTranslations('assistants.form.deploy')
  const tDelete = useTranslations('assistants.delete')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const dateLocale = getDateLocale(locale)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, startDelete] = useTransition()
  const [deploying, startDeploy] = useTransition()

  const editHref = `/${orgSlug}/agents/${assistant.id}/edit`

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteAssistant(assistant.id)
      if (result?.error) {
        toast.error(result.error)
      } else {
        router.push(`/${orgSlug}/agents`)
      }
    })
  }

  function handleDeploy() {
    startDeploy(async () => {
      const { error } = await deployAssistant(assistant.id)
      if (error) {
        toast.error(tDeploy('deployError'))
      } else {
        toast.success(tDeploy('deploySuccess'))
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/${orgSlug}/agents`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {tCommon('back')}
          </Button>
        </Link>
      </div>

      <Hero
        assistant={assistant}
        scenarioLinks={overview.scenarioLinks}
        orgSlug={orgSlug}
        canManage={canManage}
        editHref={editHref}
        onDelete={() => setConfirmDelete(true)}
      />

      {assistant.has_undeployed_changes && canManage && (
        <UndeployedBanner deploying={deploying} onDeploy={handleDeploy} />
      )}

      <KpiGrid stats={overview.stats} />

      <div className="grid gap-6 lg:grid-cols-3">
        <SetupCard assistant={assistant} editHref={editHref} className="lg:col-span-2" />
        <ActivityCard
          assistant={assistant}
          latestVersion={overview.latestVersion}
          dateLocale={dateLocale}
          onOpenHistory={() => setHistoryOpen(true)}
        />
      </div>

      <ConnectionsGrid overview={overview} orgSlug={orgSlug} editHref={editHref} />

      {overview.recentCalls.length > 0 && (
        <RecentCallsCard
          calls={overview.recentCalls}
          orgSlug={orgSlug}
          dateLocale={dateLocale}
        />
      )}

      <AssistantHistorySheet
        assistantId={assistant.id}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onRestore={() => router.refresh()}
      />

      <Dialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) setConfirmDelete(false)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('delete')}</DialogTitle>
            <DialogDescription>{tDelete('description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {tCommon('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  // ── inline subcomponents (kept here so they share context) ──
}

function Hero({
  assistant,
  scenarioLinks,
  orgSlug,
  canManage,
  editHref,
  onDelete,
}: {
  assistant: AssistantData
  scenarioLinks: AssistantScenarioLink[]
  orgSlug: string
  canManage: boolean
  editHref: string
  onDelete: () => void
}) {
  const t = useTranslations('assistants.overview')
  const tStatus = useTranslations('assistants.status')

  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
      <div className="flex items-start gap-5">
        {assistant.avatar_url ? (
          <img
            src={assistant.avatar_url}
            alt={assistant.name}
            className="h-16 w-16 rounded-full object-cover ring-1 ring-neutral-200 dark:ring-neutral-800"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700">
            <Bot className="h-7 w-7 text-neutral-400" />
          </div>
        )}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-3xl font-semibold tracking-tight">{assistant.name}</h2>
            <Badge variant={assistant.is_active ? 'default' : 'secondary'}>
              {assistant.is_active ? tStatus('active') : tStatus('inactive')}
            </Badge>
          </div>
          {assistant.description && (
            <p className="max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
              {assistant.description}
            </p>
          )}
          {scenarioLinks.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {scenarioLinks.map((link) => (
                <Link
                  key={link.scenarioId}
                  href={`/${orgSlug}/scenarios/${link.scenarioId}`}
                >
                  <Badge
                    variant="secondary"
                    className="gap-1.5 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {link.phoneNumbers.length > 0 ? (
                      <span className="inline-flex flex-wrap items-center gap-1">
                        {link.phoneNumbers.map((number, idx) => (
                          <span key={number}>
                            <PhoneNumber value={number} />
                            {idx < link.phoneNumbers.length - 1 && ', '}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="font-mono">—</span>
                    )}
                    <span className="text-muted-foreground font-normal">
                      · {link.scenarioName}
                    </span>
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/${orgSlug}/chat`}>
          <Button variant="outline" size="sm">
            <TestTube className="mr-2 h-4 w-4" />
            {t('testInChat')}
          </Button>
        </Link>
        <Link href={`/${orgSlug}/calls`}>
          <Button variant="outline" size="sm">
            <Phone className="mr-2 h-4 w-4" />
            {t('viewCalls')}
          </Button>
        </Link>
        {canManage && (
          <>
            <Link href={editHref}>
              <Button size="sm">
                <Edit className="mr-2 h-4 w-4" />
                {t('edit')}
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              aria-label={t('delete')}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function UndeployedBanner({
  deploying,
  onDeploy,
}: {
  deploying: boolean
  onDeploy: () => void
}) {
  const t = useTranslations('assistants.overview')
  const tDeploy = useTranslations('assistants.form.deploy')

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-900 dark:bg-orange-950/40">
      <div className="flex items-center gap-2 text-sm text-orange-900 dark:text-orange-100">
        <Sparkles className="h-4 w-4" />
        {t('undeployedHint')}
      </div>
      <Button
        size="sm"
        onClick={onDeploy}
        disabled={deploying}
        className="border-0 bg-orange-500/90 text-white hover:bg-orange-500/80"
      >
        {deploying ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Zap className="mr-1 h-4 w-4" />
        )}
        {tDeploy('deployButton')}
      </Button>
    </div>
  )
}

function KpiGrid({ stats }: { stats: AssistantOverview['stats'] }) {
  const t = useTranslations('assistants.overview.kpis')

  const successRateValue =
    stats.successRate === null ? t('noData') : `${stats.successRate}%`
  const csatValue =
    stats.avgCsat === null ? t('noData') : stats.avgCsat.toFixed(1)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label={t('calls')}
        value={String(stats.totalCalls30d)}
        sub={
          stats.totalCalls30d > 0
            ? t('callsBreakdown', {
                completed: stats.completedCalls30d,
                failed: stats.failedCalls30d,
              })
            : undefined
        }
      />
      <KpiCard label={t('successRate')} value={successRateValue} />
      <KpiCard
        label={t('avgDuration')}
        value={
          stats.totalCalls30d > 0
            ? formatDuration(stats.avgDurationSeconds)
            : t('noData')
        }
      />
      <KpiCard
        label={t('avgCsat')}
        value={csatValue}
        sub={stats.csatCount > 0 ? t('ratingsCount', { count: stats.csatCount }) : undefined}
      />
    </div>
  )
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <Card>
      <CardContent className="px-5 py-4">
        <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {label}
        </p>
        <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
        <p className="mt-0.5 h-4 text-xs text-neutral-500 dark:text-neutral-400">
          {sub ?? ' '}
        </p>
      </CardContent>
    </Card>
  )
}

function SetupCard({
  assistant,
  editHref,
  className,
}: {
  assistant: AssistantData
  editHref: string
  className?: string
}) {
  const t = useTranslations('assistants.overview.setup')
  const promptLines = (assistant.system_prompt ?? '').split('\n')
  const promptSnippet = promptLines.slice(0, PROMPT_SNIPPET_LINES).join('\n').trim()
  const totalLines = promptLines.filter((line) => line.length > 0).length

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              {t('voice')}
            </p>
            {assistant.voice_id ? (
              <VoiceLabel
                provider={assistant.voice_provider}
                voiceId={assistant.voice_id}
                language={assistant.voice_language}
                variant="stacked"
                showFlag
                className="mt-1 block"
              />
            ) : (
              <p className="mt-1 text-sm text-neutral-500">{t('notSet')}</p>
            )}
          </div>
          <SetupRow
            label={t('llm')}
            value={findModelLabel(assistant.llm_model) ?? t('notSet')}
            sub={
              [
                prettyProvider(assistant.llm_provider),
                typeof assistant.llm_temperature === 'number'
                  ? t('temperature', { value: assistant.llm_temperature })
                  : null,
                assistant.thinking_level && assistant.thinking_level !== 'auto'
                  ? t('thinkingLevel', { level: assistant.thinking_level })
                  : null,
              ]
                .filter(Boolean)
                .join(' · ') || undefined
            }
          />
          {assistant.stt_provider && (
            <SetupRow
              label={t('stt')}
              value={prettyProvider(assistant.stt_provider) ?? assistant.stt_provider}
              sub={
                assistant.stt_languages && assistant.stt_languages.length > 0
                  ? assistant.stt_languages.join(' · ')
                  : undefined
              }
            />
          )}
          {(assistant.enable_hesitation || assistant.enable_semantic_eot) && (
            <SetupRow
              label={t('behavior')}
              value=""
              meta={[
                assistant.enable_hesitation ? t('hesitation') : null,
                assistant.enable_semantic_eot ? t('semanticEot') : null,
              ].filter(Boolean) as string[]}
            />
          )}
        </div>

        {assistant.opening_message && (
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              {t('openingMessage')}
            </p>
            <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">
              &ldquo;{assistant.opening_message}&rdquo;
            </p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              {t('systemPrompt')}
            </p>
            {totalLines > 0 && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('promptLines', { count: totalLines })}
              </span>
            )}
          </div>
          {promptSnippet ? (
            <pre className="mt-1.5 overflow-hidden whitespace-pre-wrap break-words rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
              {promptSnippet}
              {promptLines.length > PROMPT_SNIPPET_LINES && '\n…'}
            </pre>
          ) : (
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {t('promptEmpty')}
            </p>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Link href={editHref}>
            <Button variant="outline" size="sm">
              {t('openEditor')}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function SetupRow({
  label,
  value,
  sub,
  meta,
}: {
  label: string
  value: string
  sub?: string
  meta?: string[]
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      {value && (
        <p className="mt-1 text-sm font-medium text-neutral-800 dark:text-neutral-100">
          {value}
        </p>
      )}
      {sub && (
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{sub}</p>
      )}
      {meta && meta.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {meta.map((m) => (
            <Badge key={m} variant="secondary" className="text-xs font-normal">
              {m}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function ActivityCard({
  assistant,
  latestVersion,
  dateLocale,
  onOpenHistory,
}: {
  assistant: AssistantData
  latestVersion: AssistantOverview['latestVersion']
  dateLocale: Locale
  onOpenHistory: () => void
}) {
  const t = useTranslations('assistants.overview.activity')
  const deployedAt = assistant.deployed_at ? new Date(assistant.deployed_at) : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div>
          <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {deployedAt ? t('lastDeployedAt') : t('lastDeployedNever')}
          </p>
          {deployedAt ? (
            <p className="mt-1 text-sm font-medium">
              {formatDistanceToNow(deployedAt, {
                addSuffix: true,
                locale: dateLocale,
              })}
            </p>
          ) : (
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              —
            </p>
          )}
          {latestVersion && (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {t('currentVersion', { version: latestVersion.version })}
            </p>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={onOpenHistory} className="w-full">
          <History className="mr-2 h-4 w-4" />
          {t('openHistory')}
        </Button>
      </CardContent>
    </Card>
  )
}

interface ConnectionTile {
  key: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  countLabel: string
  preview?: string
}

function ConnectionsGrid({
  overview,
  orgSlug,
  editHref,
}: {
  overview: AssistantOverview
  orgSlug: string
  editHref: string
}) {
  const t = useTranslations('assistants.overview.connections')

  const previewNames = (links: AssistantOverviewLink[]) =>
    links
      .slice(0, 2)
      .map((l) => l.name)
      .join(', ') + (links.length > 2 ? ` +${links.length - 2}` : '')

  const tiles: ConnectionTile[] = []

  if (overview.scenarioLinks.length > 0) {
    tiles.push({
      key: 'scenarios',
      icon: Workflow,
      href: `/${orgSlug}/scenarios`,
      countLabel: t('count', { count: overview.scenarioLinks.length }),
      preview: previewNames(
        overview.scenarioLinks.map((s) => ({ id: s.scenarioId, name: s.scenarioName }))
      ),
    })
  }
  if (overview.knowledgeBases.length > 0) {
    tiles.push({
      key: 'knowledgeBases',
      icon: BookOpen,
      href: `/${orgSlug}/knowledge`,
      countLabel: t('count', { count: overview.knowledgeBases.length }),
      preview: previewNames(overview.knowledgeBases),
    })
  }
  if (overview.mcpServers.length > 0) {
    tiles.push({
      key: 'mcpServers',
      icon: Plug,
      href: `/${orgSlug}/mcp-servers`,
      countLabel: t('count', { count: overview.mcpServers.length }),
      preview: previewNames(overview.mcpServers),
    })
  }
  if (overview.webhookTools.length > 0) {
    tiles.push({
      key: 'webhookTools',
      icon: Webhook,
      href: `/${orgSlug}/knowledge`,
      countLabel: t('count', { count: overview.webhookTools.length }),
      preview: previewNames(overview.webhookTools),
    })
  }
  if (overview.variableCount > 0) {
    tiles.push({
      key: 'variables',
      icon: VariableIcon,
      href: editHref,
      countLabel: t('count', { count: overview.variableCount }),
    })
  }
  if (overview.callToolsEnabled > 0) {
    tiles.push({
      key: 'callTools',
      icon: MessageSquare,
      href: editHref,
      countLabel: t('enabledCount', { count: overview.callToolsEnabled }),
    })
  }
  if (overview.contextWebhook) {
    tiles.push({
      key: 'contextWebhook',
      icon: Webhook,
      href: editHref,
      countLabel: overview.contextWebhook.active ? t('active') : t('inactive'),
    })
  }
  if (overview.variableWebhook) {
    tiles.push({
      key: 'variableWebhook',
      icon: Webhook,
      href: editHref,
      countLabel: overview.variableWebhook.active ? t('active') : t('inactive'),
    })
  }
  if (overview.phonemeSetsCount > 0) {
    tiles.push({
      key: 'phonemeSets',
      icon: ScrollText,
      href: editHref,
      countLabel: t('count', { count: overview.phonemeSetsCount }),
    })
  }

  if (tiles.length === 0) return null

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">{t('title')}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <Link key={tile.key} href={tile.href} className="group">
              <Card className="h-full transition-colors duration-[120ms] hover:border-neutral-300 dark:hover:border-neutral-700">
                <CardContent className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                      <p className="text-sm font-medium">{t(tile.key)}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                    {tile.countLabel}
                  </p>
                  {tile.preview && (
                    <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {tile.preview}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function RecentCallsCard({
  calls,
  orgSlug,
  dateLocale,
}: {
  calls: AssistantOverviewRecentCall[]
  orgSlug: string
  dateLocale: Locale
}) {
  const t = useTranslations('assistants.overview.recentCalls')

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {calls.length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
            {t('empty')}
          </p>
        ) : (
          <>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {calls.map((call) => (
                <RecentCallRow
                  key={call.id}
                  call={call}
                  dateLocale={dateLocale}
                />
              ))}
            </div>
            <div className="flex justify-end pt-3">
              <Link href={`/${orgSlug}/calls`}>
                <Button variant="ghost" size="sm">
                  {t('viewAll')}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function RecentCallRow({
  call,
  dateLocale,
}: {
  call: AssistantOverviewRecentCall
  dateLocale: Locale
}) {
  const t = useTranslations('assistants.overview.recentCalls')

  const statusLabel =
    call.status === 'completed'
      ? t('statusCompleted')
      : call.status === 'failed'
        ? t('statusFailed')
        : call.status === 'active'
          ? t('statusActive')
          : t('statusUnknown')
  const statusVariant: 'default' | 'destructive' | 'secondary' =
    call.status === 'completed'
      ? 'default'
      : call.status === 'failed'
        ? 'destructive'
        : 'secondary'

  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
          <Phone className="h-3.5 w-3.5 text-neutral-500" />
        </div>
        <div className="min-w-0">
          {call.caller_number ? (
            <PhoneNumber value={call.caller_number} className="font-medium" />
          ) : (
            <span className="text-neutral-500 dark:text-neutral-400">
              {t('noCaller')}
            </span>
          )}
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {call.started_at
              ? formatDistanceToNow(new Date(call.started_at), {
                  addSuffix: true,
                  locale: dateLocale,
                })
              : '—'}
            {typeof call.duration_seconds === 'number' && call.duration_seconds > 0 && (
              <> · {formatDuration(call.duration_seconds)}</>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {typeof call.csat_score === 'number' && (
          <span className="text-xs tabular-nums text-neutral-500">
            {t('csatScore', { score: call.csat_score })}
          </span>
        )}
        <Badge variant={statusVariant} className="text-xs">
          {statusLabel}
        </Badge>
      </div>
    </div>
  )
}
