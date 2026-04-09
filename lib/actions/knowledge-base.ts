'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Get all knowledge bases in an organization
 */
export async function getOrganizationKnowledgeBases(organizationId: string) {
  const supabase = await createClient()

  const { data, error} = await supabase
    .from('knowledge_bases')
    .select(`
      *,
      kb_documents(*),
      assistant_knowledge_bases(
        assistant_id,
        assistants(id, name)
      )
    `)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching knowledge bases:', error)
    return { knowledgeBases: [], error: error.message }
  }

  return { knowledgeBases: data, error: null }
}

/**
 * Get all knowledge bases assigned to an assistant
 */
export async function getAssistantKnowledgeBases(assistantId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('assistant_knowledge_bases')
    .select(`
      knowledge_base_id,
      knowledge_bases(*, kb_documents(*))
    `)
    .eq('assistant_id', assistantId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching assistant knowledge bases:', error)
    return { knowledgeBases: [], error: error.message }
  }

  // Flatten the structure
  const knowledgeBases = data?.map((item: { knowledge_bases: unknown }) => item.knowledge_bases) || []

  return { knowledgeBases, error: null }
}

/**
 * Create a new knowledge base (organization-level resource)
 */
export async function createKnowledgeBase(data: {
  organizationId: string
  name: string
  description?: string
}) {
  const supabase = await createClient()

  const { data: kb, error } = await supabase
    .from('knowledge_bases')
    .insert({
      organization_id: data.organizationId,
      name: data.name,
      description: data.description || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating knowledge base:', error)
    return { knowledgeBase: null, error: error.message }
  }

  return { knowledgeBase: kb, error: null }
}

/**
 * Assign a knowledge base to an assistant
 */
export async function assignKnowledgeBaseToAssistant(
  assistantId: string,
  knowledgeBaseId: string
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('assistant_knowledge_bases')
    .insert({
      assistant_id: assistantId,
      knowledge_base_id: knowledgeBaseId,
    })

  if (error) {
    console.error('Error assigning knowledge base:', error)
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Unassign a knowledge base from an assistant
 */
export async function unassignKnowledgeBaseFromAssistant(
  assistantId: string,
  knowledgeBaseId: string
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('assistant_knowledge_bases')
    .delete()
    .eq('assistant_id', assistantId)
    .eq('knowledge_base_id', knowledgeBaseId)

  if (error) {
    console.error('Error unassigning knowledge base:', error)
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Delete a knowledge base
 */
export async function deleteKnowledgeBase(kbId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('knowledge_bases')
    .delete()
    .eq('id', kbId)

  if (error) {
    console.error('Error deleting knowledge base:', error)
    return { error: error.message }
  }

  return { error: null }
}

interface KBDocument {
  id: string
  knowledge_base_id: string
  title: string
  file_type: string
  file_size_bytes: number
  file_path: string
  processing_status: string
  created_at: string
}

/**
 * Upload a document to a knowledge base
 */
export async function uploadDocument(data: {
  knowledgeBaseId: string
  name: string
  fileType: string
  fileSize: number
  filePath: string
}): Promise<{ document: KBDocument | null; error: string | null }> {
  const supabase = await createClient()

  const { data: doc, error } = await supabase
    .from('kb_documents')
    .insert({
      knowledge_base_id: data.knowledgeBaseId,
      title: data.name,
      file_type: data.fileType,
      file_size_bytes: data.fileSize,
      file_path: data.filePath,
      processing_status: 'processing',
    })
    .select()
    .single()

  if (error) {
    console.error('Error uploading document:', error)
    return { document: null, error: error.message }
  }

  return { document: doc as unknown as KBDocument, error: null }
}

/**
 * Delete a document
 */
export async function deleteDocument(documentId: string) {
  const supabase = await createClient()

  // Get document info first for file path
  const { data: doc } = await supabase
    .from('kb_documents')
    .select('file_path')
    .eq('id', documentId)
    .single()

  if (doc) {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([doc.file_path])

    if (storageError) {
      console.error('Error deleting file from storage:', storageError)
    }
  }

  // Delete from database
  const { error } = await supabase
    .from('kb_documents')
    .delete()
    .eq('id', documentId)

  if (error) {
    console.error('Error deleting document:', error)
    return { error: error.message }
  }

  return { error: null }
}

/**
 * Get documents for a knowledge base
 */
export async function getKnowledgeBaseDocuments(kbId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('kb_documents')
    .select('*')
    .eq('knowledge_base_id', kbId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching documents:', error)
    return { documents: [], error: error.message }
  }

  return { documents: data, error: null }
}

/**
 * Search for relevant chunks in a knowledge base (semantic search)
 */
export async function searchKnowledgeBase(
  kbId: string,
  queryEmbedding: number[],
  matchThreshold: number = 0.7,
  matchCount: number = 5
) {
  const serviceClient = createServiceRoleClient()

  const { data, error } = await serviceClient.rpc('search_kb_chunks', {
    query_embedding: queryEmbedding,
    kb_id: kbId,
    match_threshold: matchThreshold,
    match_count: matchCount,
  })

  if (error) {
    console.error('Error searching knowledge base:', error)
    return { chunks: [], error: error.message }
  }

  return { chunks: data || [], error: null }
}

/**
 * Search across multiple knowledge bases for an assistant
 */
export async function searchAssistantKnowledgeBases(
  assistantId: string,
  queryEmbedding: number[],
  matchThreshold: number = 0.7,
  matchCount: number = 5
) {
  const supabase = await createClient()

  // Get all KB IDs for this assistant
  const { data: kbAssignments } = await supabase
    .from('assistant_knowledge_bases')
    .select('knowledge_base_id')
    .eq('assistant_id', assistantId)

  if (!kbAssignments || kbAssignments.length === 0) {
    return { chunks: [], error: null }
  }

  const kbIds = kbAssignments.map((a: { knowledge_base_id: string }) => a.knowledge_base_id)

  // Search across all assigned KBs
  const serviceClient = createServiceRoleClient()

  const { data, error } = await serviceClient.rpc('search_kb_chunks', {
    query_embedding: queryEmbedding,
    kb_ids: kbIds, // Pass array of KB IDs
    match_threshold: matchThreshold,
    match_count: matchCount,
  })

  if (error) {
    console.error('Error searching assistant knowledge bases:', error)
    return { chunks: [], error: error.message }
  }

  return { chunks: data || [], error: null }
}

/**
 * Get KB analytics summary for an organization
 */
export async function getKBAnalyticsSummary(organizationId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('kb_analytics_summary')
    .select('*')
    .eq('organization_id', organizationId)
    .order('total_searches', { ascending: false })

  if (error) {
    console.error('Error fetching KB analytics:', error)
    return { analytics: [], error: error.message }
  }

  return { analytics: data, error: null }
}

/**
 * Get search events for a knowledge base
 */
export async function getKBSearchEvents(
  kbId: string,
  limit: number = 50
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('kb_search_events')
    .select(`
      *,
      assistants(id, name),
      call_sessions(id, from_number, status)
    `)
    .eq('knowledge_base_id', kbId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching search events:', error)
    return { events: [], error: error.message }
  }

  return { events: data, error: null }
}

/**
 * Get popular chunks for a knowledge base
 */
export async function getKBPopularChunks(kbId: string, limit: number = 10) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('kb_popular_chunks')
    .select('*')
    .eq('knowledge_base_id', kbId)
    .order('retrieval_count', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching popular chunks:', error)
    return { chunks: [], error: error.message }
  }

  return { chunks: data, error: null }
}
