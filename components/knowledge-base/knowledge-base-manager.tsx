'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  Plus,
  Book,
  Users,
  BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import {
  createKnowledgeBase,
  uploadDocument,
  deleteDocument,
  deleteKnowledgeBase,
} from '@/lib/actions/knowledge-base'

interface KBDocument {
  id: string
  title: string
  file_size_bytes: number
  file_type: string
  processing_status: string
}

interface KnowledgeBaseItem {
  id: string
  name: string
  description?: string | null
  kb_documents?: KBDocument[]
  assistant_knowledge_bases?: { assistant_id: string; assistants?: { name?: string } | null }[]
}

interface KBAnalytics {
  knowledge_base_id: string
  total_searches: number
  unique_calls: number
  last_searched_at: string | null
}

interface KnowledgeBaseManagerProps {
  organizationId: string
  canManage: boolean
  knowledgeBases: KnowledgeBaseItem[]
  analytics: KBAnalytics[]
}

export function KnowledgeBaseManager({
  organizationId,
  canManage,
  knowledgeBases,
  analytics,
}: KnowledgeBaseManagerProps) {
  const router = useRouter()
  const t = useTranslations('knowledge')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create KB dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newKBName, setNewKBName] = useState('')
  const [newKBDescription, setNewKBDescription] = useState('')

  // Delete KB confirmation
  const [deleteKBDialogOpen, setDeleteKBDialogOpen] = useState(false)
  const [kbToDelete, setKbToDelete] = useState<string | null>(null)

  // Delete document confirmation
  const [deleteDocDialogOpen, setDeleteDocDialogOpen] = useState(false)
  const [docToDelete, setDocToDelete] = useState<string | null>(null)

  // File input refs per KB
  const fileInputRefs = useState<Map<string, HTMLInputElement>>(
    () => new Map()
  )[0]

  const supabase = createClient()

  const getKBAnalytics = (kbId: string) => {
    return analytics.find((a) => a.knowledge_base_id === kbId)
  }

  const handleCreateKB = async () => {
    if (!newKBName.trim()) return

    setLoading(true)
    await createKnowledgeBase({
      organizationId,
      name: newKBName,
      description: newKBDescription || undefined,
    })
    setLoading(false)
    setCreateDialogOpen(false)
    setNewKBName('')
    setNewKBDescription('')
    router.refresh()
  }

  const handleDeleteKB = async () => {
    if (!kbToDelete) return

    setLoading(true)
    await deleteKnowledgeBase(kbToDelete)
    setLoading(false)
    setDeleteKBDialogOpen(false)
    setKbToDelete(null)
    router.refresh()
  }

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    kbId: string
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = [
      'text/plain',
      'text/markdown',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ]
    const validExtensions = ['.txt', '.md', '.pdf', '.docx', '.doc']
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()

    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      setError(t('documents.invalidFileType'))
      return
    }

    setUploading(true)
    setError(null)

    try {
      // Upload to Supabase Storage
      const filePath = `${organizationId}/${kbId}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Create document record
      let fileType = 'txt'
      if (file.name.endsWith('.md')) fileType = 'md'
      else if (file.name.endsWith('.pdf')) fileType = 'pdf'
      else if (file.name.endsWith('.docx') || file.name.endsWith('.doc'))
        fileType = 'docx'

      const { document, error } = await uploadDocument({
        knowledgeBaseId: kbId,
        name: file.name,
        fileType,
        fileSize: file.size,
        filePath,
      })

      if (error) throw new Error(error)

      // Process the document
      await fetch('/api/knowledge-base/process-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document?.id }),
      })

      router.refresh()
    } catch (error) {
      console.error('Error uploading file:', error)
      setError(t('documents.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteDocument = async () => {
    if (!docToDelete) return

    setLoading(true)
    await deleteDocument(docToDelete)
    setLoading(false)
    setDeleteDocDialogOpen(false)
    setDocToDelete(null)
    router.refresh()
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400 dark:border-lime-800">{t('documents.ready')}</Badge>
      case 'processing':
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 dark:bg-blue-400/10 dark:text-blue-400 dark:border-blue-800">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            {t('documents.processing')}
          </Badge>
        )
      case 'failed':
        return <Badge variant="destructive">{t('documents.failed')}</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header with Create Button */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold">{t('tabKnowledge')}</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {t('description')}
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setCreateDialogOpen(true)} disabled={loading}>
              <Plus className="h-4 w-4 mr-2" />
              {t('createNew')}
            </Button>
          )}
        </div>

        {/* Error message */}
        {error && (
          <Card className="p-4 border-red-500 bg-red-50 dark:bg-red-950">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </Card>
        )}

        {/* Knowledge Bases */}
        <div className="space-y-4">
          {knowledgeBases.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Book className="h-14 w-14 mx-auto text-neutral-400 mb-3" />
                <h3 className="font-medium mb-1">{t('empty.title')}</h3>
                <p className="text-sm text-neutral-500 mb-4">
                  {t('empty.description')}
                </p>
                {canManage && (
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('createNew')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            knowledgeBases.map((kb) => (
              <Card key={kb.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Book className="h-5 w-5 mt-1 text-neutral-400" />
                      <div>
                        <CardTitle className="text-lg">{kb.name}</CardTitle>
                        {kb.description && (
                          <CardDescription className="mt-1">
                            {kb.description}
                          </CardDescription>
                        )}
                        {kb.assistant_knowledge_bases &&
                          kb.assistant_knowledge_bases.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {kb.assistant_knowledge_bases.map((akb) => (
                                <Badge key={akb.assistant_id} variant="secondary">
                                  {akb.assistants?.name || 'Unknown'}
                                </Badge>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>

                    <Badge variant="secondary">
                      {t('stats.documentsCount', { count: kb.kb_documents?.length || 0 })}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  {/* Analytics */}
                  {(() => {
                    const kbStats = getKBAnalytics(kb.id)
                    return kbStats && kbStats.total_searches > 0 ? (
                      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-neutral-200 dark:border-neutral-700">
                        <div className="flex items-center gap-1">
                          <BarChart3 className="h-3 w-3 text-neutral-400" />
                          <p className="text-xs text-neutral-500">
                            {t('stats.searches', { count: kbStats.total_searches })}
                          </p>
                        </div>
                        {kbStats.unique_calls > 0 && (
                          <p className="text-xs text-neutral-500">
                            {t('stats.calls', { count: kbStats.unique_calls })}
                          </p>
                        )}
                        {kbStats.last_searched_at && (
                          <p className="text-xs text-neutral-400">
                            {t('stats.lastUsed', { date: new Date(kbStats.last_searched_at).toLocaleDateString(locale) })}
                          </p>
                        )}
                      </div>
                    ) : null
                  })()}

                  {/* Documents */}
                  <div className="space-y-2">
                    {kb.kb_documents && kb.kb_documents.length > 0 ? (
                      kb.kb_documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-700"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-neutral-400" />
                            <div>
                              <p className="font-medium">{doc.title}</p>
                              <p className="text-xs text-neutral-500">
                                {formatFileSize(doc.file_size_bytes)} •{' '}
                                {doc.file_type.toUpperCase()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(doc.processing_status)}
                            {canManage && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setDocToDelete(doc.id)
                                  setDeleteDocDialogOpen(true)
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                                {tCommon('delete')}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-neutral-500 py-4 text-center">
                        {t('documents.noDocuments')}
                      </p>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-2 mt-4">
                      <input
                        type="file"
                        accept=".txt,.md,.pdf,.docx,.doc"
                        className="hidden"
                        ref={(el) => {
                          if (el) fileInputRefs.set(kb.id, el)
                        }}
                        onChange={(e) => handleFileUpload(e, kb.id)}
                        disabled={uploading}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={() => fileInputRefs.get(kb.id)?.click()}
                      >
                        {uploading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {uploading ? tCommon('uploading') : t('documents.upload')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setKbToDelete(kb.id)
                          setDeleteKBDialogOpen(true)
                        }}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                        {tCommon('delete')}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Create KB Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('createDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('form.name')}</Label>
              <Input
                id="name"
                placeholder={t('form.namePlaceholder')}
                value={newKBName}
                onChange={(e) => setNewKBName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateKB()
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t('form.descriptionOptional')}</Label>
              <Textarea
                id="description"
                placeholder={t('form.descriptionPlaceholder')}
                value={newKBDescription}
                onChange={(e) => setNewKBDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleCreateKB} disabled={!newKBName.trim()}>
              {tCommon('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete KB Confirmation */}
      <AlertDialog
        open={deleteKBDialogOpen}
        onOpenChange={setDeleteKBDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteKB.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteKB.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteKB}
              className="bg-red-600 hover:bg-red-700"
            >
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Document Confirmation */}
      <AlertDialog
        open={deleteDocDialogOpen}
        onOpenChange={setDeleteDocDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDoc.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDoc.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDocument}
              className="bg-red-600 hover:bg-red-700"
            >
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
