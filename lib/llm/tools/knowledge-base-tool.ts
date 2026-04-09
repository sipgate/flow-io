import type { LLMTool } from '../types'
import { generateEmbedding } from '@/lib/embeddings/openai-embeddings'
import { searchAssistantKnowledgeBases } from '@/lib/actions/knowledge-base'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Knowledge Base Search Tool Definition
 * Allows LLM to search assistant's knowledge bases for relevant information
 */
export const knowledgeBaseSearchTool: LLMTool = {
  type: 'function',
  function: {
    name: 'search_knowledge_base',
    description:
      'Search the knowledge base for relevant information to answer user questions. Use this when you need specific information that might be in the uploaded documents.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'The search query. Be specific and use keywords from the user\'s question.',
        },
      },
      required: ['query'],
    },
  },
}

/**
 * Execute knowledge base search tool with analytics tracking
 */
export async function executeKnowledgeBaseSearch(
  assistantId: string,
  organizationId: string,
  query: string,
  callSessionId?: string
): Promise<string> {
  const startTime = Date.now()

  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query)

    // Search across all KBs assigned to this assistant
    const { chunks, error } = await searchAssistantKnowledgeBases(
      assistantId,
      queryEmbedding,
      0.7, // similarity threshold
      3 // top 3 chunks
    )

    const duration = Date.now() - startTime

    if (error || !chunks || chunks.length === 0) {
      // Track search with no results
      await trackSearchAnalytics({
        organizationId,
        assistantId,
        knowledgeBaseId: null,
        callSessionId,
        query,
        resultsCount: 0,
        duration,
        chunks: [],
      })

      return 'No relevant information found in the knowledge base.'
    }

    // Track successful search
    await trackSearchAnalytics({
      organizationId,
      assistantId,
      knowledgeBaseId: chunks[0]?.knowledge_base_id,
      callSessionId,
      query,
      resultsCount: chunks.length,
      duration,
      chunks,
    })

    // Format results
    const results = chunks
      .map(
        (chunk: { content: string }, index: number) =>
          `[Result ${index + 1}]\n${chunk.content}\n`
      )
      .join('\n')

    return `Found ${chunks.length} relevant documents:\n\n${results}`
  } catch (error) {
    console.error('Error executing knowledge base search:', error)
    return 'Error searching knowledge base. Please try again.'
  }
}

/**
 * Track KB search analytics
 */
async function trackSearchAnalytics(data: {
  organizationId: string
  assistantId: string
  knowledgeBaseId: string | null
  callSessionId?: string
  query: string
  resultsCount: number
  duration: number
  chunks: { id: string; document_id: string; content: string; similarity?: number }[]
}) {
  try {
    if (!data.knowledgeBaseId) return

    const supabase = createServiceRoleClient()

    // Insert search event
    const { data: searchEvent, error: eventError } = await supabase
      .from('kb_search_events')
      .insert({
        organization_id: data.organizationId,
        assistant_id: data.assistantId,
        knowledge_base_id: data.knowledgeBaseId,
        call_session_id: data.callSessionId,
        query: data.query,
        results_count: data.resultsCount,
        search_duration_ms: data.duration,
      })
      .select()
      .single()

    if (eventError || !searchEvent) {
      console.error('Error tracking search event:', eventError)
      return
    }

    const typedSearchEvent = searchEvent as unknown as { id: string }

    // Track chunk retrievals
    if (data.chunks.length > 0) {
      const chunkRetrievals = data.chunks.map((chunk, index: number) => ({
        search_event_id: typedSearchEvent.id,
        chunk_id: chunk.id,
        document_id: chunk.document_id,
        similarity_score: chunk.similarity || 0,
        rank: index + 1,
      }))

      const { error: retrievalsError } = await supabase
        .from('kb_chunk_retrievals')
        .insert(chunkRetrievals)

      if (retrievalsError) {
        console.error('Error tracking chunk retrievals:', retrievalsError)
      }
    }
  } catch (error) {
    // Silently fail - analytics shouldn't break functionality
    console.error('Error in trackSearchAnalytics:', error)
  }
}
