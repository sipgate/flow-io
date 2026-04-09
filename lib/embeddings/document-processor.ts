import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { chunkText } from './text-processing'
import { generateEmbeddings } from './openai-embeddings'

interface KBDocumentForProcessing {
  id: string
  knowledge_base_id: string
  title: string
  file_type: string
  file_path: string
  content: string | null
}

/**
 * Process a document: extract text, chunk it, generate embeddings, and store
 */
export async function processDocument(documentId: string) {
  const supabase = createServiceRoleClient()

  try {
    // Get document from database
    const { data: documentData, error: docError } = await supabase
      .from('kb_documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError || !documentData) {
      throw new Error('Document not found')
    }

    const document = documentData as unknown as KBDocumentForProcessing

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_path)

    if (downloadError || !fileData) {
      throw new Error('Failed to download file')
    }

    // Extract text from file
    const text = await extractTextFromBlob(fileData, document.file_type)

    // Update document with extracted content
    await supabase
      .from('kb_documents')
      .update({ content: text })
      .eq('id', documentId)

    // Chunk the text
    const chunks = chunkText(text, 1000, 200)

    if (chunks.length === 0) {
      throw new Error('No text extracted from document')
    }

    // Generate embeddings for all chunks
    const embeddings = await generateEmbeddings(chunks)

    // Store chunks with embeddings
    const chunkRecords = chunks.map((content, index) => ({
      document_id: documentId,
      knowledge_base_id: document.knowledge_base_id,
      content,
      embedding: embeddings[index],
      chunk_index: index,
      metadata: {
        document_title: document.title,
        chunk_length: content.length,
      },
    }))

    const { error: insertError } = await supabase
      .from('kb_chunks')
      .insert(chunkRecords)

    if (insertError) {
      throw insertError
    }

    // Mark document as completed
    await supabase
      .from('kb_documents')
      .update({ processing_status: 'completed' })
      .eq('id', documentId)

    return { success: true, chunksCreated: chunks.length }
  } catch (error) {
    console.error('Error processing document:', error)

    // Mark document as failed
    await supabase
      .from('kb_documents')
      .update({
        processing_status: 'failed',
      })
      .eq('id', documentId)

    throw error
  }
}

/**
 * Extract text from a file blob based on file type
 */
async function extractTextFromBlob(blob: Blob, fileType: string): Promise<string> {
  if (fileType === 'txt' || fileType === 'md') {
    return await blob.text()
  }

  if (fileType === 'pdf') {
    try {
      const { extractText, getDocumentProxy } = await import('unpdf')
      const arrayBuffer = await blob.arrayBuffer()
      const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer))
      const { text } = await extractText(pdf, { mergePages: true })
      return text
    } catch (error) {
      throw new Error(`Failed to extract text from PDF: ${error}`)
    }
  }

  if (fileType === 'docx') {
    try {
      const mammoth = await import('mammoth')
      const buffer = Buffer.from(await blob.arrayBuffer())
      const result = await mammoth.extractRawText({ buffer })
      return result.value
    } catch (error) {
      throw new Error(`Failed to extract text from DOCX: ${error}`)
    }
  }

  throw new Error(`Unsupported file type: ${fileType}`)
}
