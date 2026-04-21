'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  Webhook,
  Pencil,
  Trash2,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
} from 'lucide-react'
import {
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

interface WebhookToolListProps {
  organizationId: string
  tools: WebhookTool[]
}

const EMPTY_FORM = {
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

export function WebhookToolList({ organizationId, tools: initialTools }: WebhookToolListProps) {
  const t = useTranslations('webhookTools')
  const tCommon = useTranslations('common')
  const router = useRouter()

  const [tools, setTools] = useState(initialTools)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; status: number; statusText: string } | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  function openCreate() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, headers: [], parameters: [] })
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
      const { tool } = await createWebhookTool({ ...payload, organization_id: organizationId })
      if (tool) setTools(prev => [...prev, tool])
    }
    setSaving(false)
    setDialogOpen(false)
    router.refresh()
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    await deleteWebhookTool(deleteId)
    setTools(prev => prev.filter(t => t.id !== deleteId))
    setDeleting(false)
    setDeleteId(null)
    router.refresh()
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
    setForm(f => ({ ...f, parameters: [...f.parameters, { name: '', type: 'string' as const, description: '', required: false }] }))
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">{t('title')}</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{t('description')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('newTool')}
        </Button>
      </div>

      <div className="grid gap-4">
        {tools.map(tool => (
          <Card key={tool.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Webhook className="h-5 w-5 mt-1 text-neutral-400" />
                  <div>
                    <CardTitle className="text-lg font-mono">{tool.name}</CardTitle>
                    <CardDescription className="mt-1">{tool.description}</CardDescription>
                    <p className="text-xs text-neutral-400 mt-2 font-mono">{tool.method} {tool.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{tool.method}</Badge>
                  <Badge variant={tool.enabled ? 'default' : 'secondary'}>
                    {tool.enabled ? t('enabled') : t('disabled')}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {tool.parameters?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {tool.parameters.map(p => (
                    <Badge key={p.name} variant="secondary" className="text-xs font-mono">
                      {p.name}: {p.type}{p.required ? '*' : ''}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(tool)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  {tCommon('edit')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDeleteId(tool.id)}>
                  <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                  {tCommon('delete')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {tools.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Webhook className="h-14 w-14 mx-auto text-neutral-400 mb-3" />
              <h3 className="font-medium mb-1">{t('empty')}</h3>
              <p className="text-sm text-neutral-500 mb-4">{t('description')}</p>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                {t('newTool')}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t('editTitle') : t('createTitle')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
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

            {testResult && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                testResult.success
                  ? 'bg-lime-50 dark:bg-lime-950/20 text-lime-700 dark:text-lime-400'
                  : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300'
              }`}>
                {testResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
