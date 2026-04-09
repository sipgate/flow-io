import { NextRequest, NextResponse } from 'next/server'
import { processDocument } from '@/lib/embeddings/document-processor'

/**
 * API endpoint to process a document: extract text, chunk, generate embeddings
 * This can be called after a document is uploaded
 */
export async function POST(request: NextRequest) {
  try {
    const { documentId } = await request.json()

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // Process the document in the background
    // In production, you'd use a job queue like BullMQ
    const result = await processDocument(documentId)

    return NextResponse.json({
      success: true,
      chunksCreated: result.chunksCreated,
    })
  } catch (error) {
    console.error('Error in process-document endpoint:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process document',
      },
      { status: 500 }
    )
  }
}
