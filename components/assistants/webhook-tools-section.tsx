'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Plus,
  Pencil,
  Trash2,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
} from 'lucide-react'
import {
  getAssistantWebhookTools,
  createWebhookTool,
  updateWebhookTool,
  deleteWebhookTool,
  testWebhookTool,
} from '@/lib/actions/webhook-tools'
import type {
  WebhookTool,
  WebhookToolParameter,
  WebhookToolMethod,
  WebhookToolAuthType,
} from '@/types/webhook-tools'

interface WebhookToolsSectionProps {
  assistantId: string
  organizationId: string
  onSummaryChange?: (summary: string) => void
}

const EMPTY_TOOL = {
  name: '',
  description: '',
  url: '',
  method: 'POST' as WebhookToolMethod,
  auth_type: 'none' as WebhookToolAuthType,
  auth_config: { token: '', apiKey: '', headerName: '' },
  headers: [] as Array<{ key: string; value: string }>,
  timeout_ms: 10000,
  parameters: [] as WebhookToolParameter[],
  enabled: true,
}

export function WebhookToolsSection({
  assistantId,
  organizationId,
  onSummaryChange,
}: WebhookToolsSectionProps) {
  const t = useTranslations('webhookTools')
  const [tools, setTools] = useState<WebhookTool[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; status: number; statusText: string } | null>(null)
  const [form, setForm] = useState({ ...EMPTY_TOOL })

  useEffect(() => {
    if (!onSummaryChange) return
    const enabled = tools.filter(t => t.enabled)
    onSummaryChange(enabled.length === 0 ? '—' : t('summary', { count: enabled.length }))
  }, [tools, onSummaryChange, t])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { tools: loaded } = await getAssistantWebhookTools(assistantId)
      setTools(loaded)
      setLoading(false)
    }
    load()
  }, [assistantId])

  function openCreate() {
    setEditingId(null)
    setForm({ ...EMPTY_TOOL, headers: [], parameters: [] })
    setTestResult(null)
    setDialogOpen(true)
  }

  function openEdit(tool: WebhookTool) {
    setEditingId(tool.id)
    setForm({
      name: tool.name,
      description: tool.description,
      url: tool.url,
      method: tool.method,
      auth_type: tool.auth_type,
      auth_config: {
        token: tool.auth_config?.token ?? '',
        apiKey: tool.auth_config?.apiKey ?? '',
        headerName: tool.auth_config?.headerName ?? '',
      },
      headers: Object.entries(tool.headers ?? {}).map(([key, value]) => ({ key, value: value as string })),
      timeout_ms: tool.timeout_ms ?? 10000,
      parameters: tool.parameters ?? [],
      enabled: tool.enabled,
    })
    setTestResult(null)
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    const headersObj: Record<string, string> = {}
    form.headers.forEach(h => { if (h.key.trim()) headersObj[h.key.trim()] = h.value })

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      url: form.url.trim(),
      method: form.method,
      headers: headersObj,
      auth_type: form.auth_type,
      auth_config: form.auth_config,
      timeout_ms: form.timeout_ms,
      parameters: form.parameters,
      enabled: form.enabled,
    }

    if (editingId) {
      const { tool } = await updateWebhookTool(editingId, payload)
      if (tool) setTools(prev => prev.map(t => t.id === editingId ? tool : t))
    } else {
      const { tool } = await createWebhookTool({ ...payload, assistant_id: assistantId, organization_id: organizationId })
      if (tool) setTools(prev => [...prev, tool])
    }
    setSaving(false)
    setDialogOpen(false)
  }

  async function handleDelete(id: string) {
    await deleteWebhookTool(id)
    setTools(prev => prev.filter(t => t.id !== id))
  }

  async function handleTest() {
    if (!form.url) return
    setTesting(true)
    setTestResult(null)
    const headersObj: Record<string, string> = {}
    form.headers.forEach(h => { if (h.key.trim()) headersObj[h.key.trim()] = h.value })
    const result = await testWebhookTool(form.url, form.method, headersObj, form.auth_type, form.auth_config)
    setTestResult(result)
    setTesting(false)
  }

  function addParameter() {
    setForm(f => ({ ...f, parameters: [...f.parameters, { name: '', type: 'string', description: '', required: false }] }))
  }

  function updateParameter(i: number, field: keyof WebhookToolParameter, value: unknown) {
    setForm(f => {
      const params = [...f.parameters]
      params[i] = { ...params[i], [field]: value }
      return { ...f, parameters: params }
    })
  }

  function removeParameter(i: number) {
    setForm(f => ({ ...f, parameters: f.parameters.filter((_, idx) => idx !== i) }))
  }

  const canSave = form.name.trim() && form.description.trim() && form.url.trim()

  if (loading) {
    return <div className="text-sm text-neutral-500 py-4 text-center">{t('loading')}</div>
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">{t('title')}</h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{t('description')}</p>
      </div>

      {tools.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('colName')}</TableHead>
              <TableHead>{t('colMethod')}</TableHead>
              <TableHead>{t('colUrl')}</TableHead>
              <TableHead>{t('colStatus')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tools.map(tool => (
              <TableRow key={tool.id}>
                <TableCell className="font-mono text-sm">{tool.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{tool.method}</Badge>
                </TableCell>
                <TableCell className="text-xs text-neutral-500 max-w-[180px] truncate">{tool.url}</TableCell>
                <TableCell>
                  <Badge variant={tool.enabled ? 'default' : 'secondary'}>
                    {tool.enabled ? t('enabled') : t('disabled')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(tool)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(tool.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-neutral-500 py-2">{t('empty')}</p>
      )}

      <Button type="button" variant="outline" size="sm" onClick={openCreate}>
        <Plus className="h-4 w-4 mr-2" />
        {t('newTool')}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t('editTitle') : t('createTitle')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name + Description */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{t('fieldName')}</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_') }))}
                  placeholder="get_customer_info"
                  className="font-mono"
                />
                <p className="text-xs text-neutral-500">{t('fieldNameHint')}</p>
              </div>
              <div className="space-y-1">
                <Label>{t('fieldMethod')}</Label>
                <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v as WebhookToolMethod }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['POST', 'GET', 'PUT', 'PATCH'] as WebhookToolMethod[]).map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>{t('fieldDescription')}</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={t('fieldDescriptionPlaceholder')}
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label>{t('fieldUrl')}</Label>
              <Input
                type="url"
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://api.example.com/tool"
              />
            </div>

            {/* Auth */}
            <div className="space-y-2">
              <Label>{t('fieldAuth')}</Label>
              <Select value={form.auth_type} onValueChange={v => setForm(f => ({ ...f, auth_type: v as WebhookToolAuthType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('authNone')}</SelectItem>
                  <SelectItem value="bearer">{t('authBearer')}</SelectItem>
                  <SelectItem value="api_key">{t('authApiKey')}</SelectItem>
                </SelectContent>
              </Select>
              {form.auth_type === 'bearer' && (
                <Input
                  type="password"
                  placeholder={t('authTokenPlaceholder')}
                  value={form.auth_config.token ?? ''}
                  onChange={e => setForm(f => ({ ...f, auth_config: { ...f.auth_config, token: e.target.value } }))}
                />
              )}
              {form.auth_type === 'api_key' && (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder={t('authHeaderNamePlaceholder')}
                    value={form.auth_config.headerName ?? ''}
                    onChange={e => setForm(f => ({ ...f, auth_config: { ...f.auth_config, headerName: e.target.value } }))}
                  />
                  <Input
                    type="password"
                    placeholder={t('authApiKeyPlaceholder')}
                    value={form.auth_config.apiKey ?? ''}
                    onChange={e => setForm(f => ({ ...f, auth_config: { ...f.auth_config, apiKey: e.target.value } }))}
                  />
                </div>
              )}
            </div>

            {/* Parameters */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('fieldParameters')}</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addParameter}>
                  <Plus className="h-4 w-4 mr-1" />{t('addParameter')}
                </Button>
              </div>
              {form.parameters.length === 0 && (
                <p className="text-xs text-neutral-500">{t('noParameters')}</p>
              )}
              {form.parameters.map((param, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_1fr_auto_auto] gap-2 items-center">
                  <Input
                    placeholder={t('paramName')}
                    value={param.name}
                    onChange={e => updateParameter(i, 'name', e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'))}
                    className="font-mono text-sm"
                  />
                  <Select value={param.type} onValueChange={v => updateParameter(i, 'type', v)}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">string</SelectItem>
                      <SelectItem value="number">number</SelectItem>
                      <SelectItem value="boolean">boolean</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder={t('paramDescription')}
                    value={param.description}
                    onChange={e => updateParameter(i, 'description', e.target.value)}
                    className="text-sm"
                  />
                  <div className="flex items-center gap-1">
                    <Checkbox
                      checked={param.required}
                      onCheckedChange={v => updateParameter(i, 'required', v as boolean)}
                    />
                    <span className="text-xs text-neutral-500">{t('paramRequired')}</span>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeParameter(i)}>
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Enabled + Timeout */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="wt-enabled"
                  checked={form.enabled}
                  onCheckedChange={v => setForm(f => ({ ...f, enabled: v as boolean }))}
                />
                <Label htmlFor="wt-enabled" className="font-normal cursor-pointer">{t('fieldEnabled')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">{t('fieldTimeout')}</Label>
                <Input
                  type="number"
                  value={form.timeout_ms}
                  onChange={e => setForm(f => ({ ...f, timeout_ms: Number(e.target.value) }))}
                  className="w-24"
                  min={1000}
                  max={30000}
                  step={1000}
                />
                <span className="text-xs text-neutral-500">ms</span>
              </div>
            </div>

            {/* Test result */}
            {testResult && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                testResult.success
                  ? 'bg-lime-50 dark:bg-lime-950/20 text-lime-700 dark:text-lime-400'
                  : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300'
              }`}>
                {testResult.success
                  ? <CheckCircle className="h-4 w-4" />
                  : <AlertCircle className="h-4 w-4" />}
                {testResult.success
                  ? t('testSuccess', { status: testResult.status })
                  : t('testFailed', { statusText: testResult.statusText })}
              </div>
            )}
          </div>

          <DialogFooter className="flex-row justify-between">
            <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={testing || !form.url}>
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {t('testButton')}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
              <Button type="button" onClick={handleSave} disabled={saving || !canSave}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingId ? t('update') : t('save')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
