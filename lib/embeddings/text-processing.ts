/**
 * Split text into chunks for embedding
 * Uses overlapping chunks to maintain context across boundaries
 */
export function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  const chunks: string[] = []

  // Remove excessive whitespace and normalize
  const normalizedText = text.replace(/\s+/g, ' ').trim()

  if (normalizedText.length === 0) {
    return []
  }

  if (normalizedText.length <= chunkSize) {
    return [normalizedText]
  }

  let start = 0
  while (start < normalizedText.length) {
    const end = Math.min(start + chunkSize, normalizedText.length)

    // Try to break at sentence boundaries
    let chunkEnd = end
    if (end < normalizedText.length) {
      // Look for sentence ending punctuation
      const lastPeriod = normalizedText.lastIndexOf('. ', end)
      const lastQuestion = normalizedText.lastIndexOf('? ', end)
      const lastExclamation = normalizedText.lastIndexOf('! ', end)

      const sentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation)

      // If we found a sentence boundary within reasonable range
      if (sentenceEnd > start && sentenceEnd > end - 200) {
        chunkEnd = sentenceEnd + 2 // Include the punctuation and space
      }
    }

    chunks.push(normalizedText.substring(start, chunkEnd).trim())

    // Move start position - ensure we make progress
    const nextStart = chunkEnd - overlap

    // If overlap would cause us to not make progress, skip overlap
    if (nextStart <= start) {
      start = chunkEnd
    } else {
      start = nextStart
    }
  }

  return chunks.filter(chunk => chunk.length > 0)
}

/**
 * Extract text from different file types
 */
export async function extractTextFromFile(
  filePath: string,
  fileType: string
): Promise<string> {
  // For MVP, we'll support plain text files
  // In production, you'd use libraries like:
  // - pdf-parse for PDFs
  // - mammoth for DOCX
  // - marked for Markdown

  if (fileType === 'txt' || fileType === 'md') {
    // Text files can be read directly
    // This would be handled by the file upload process
    return '' // Placeholder - actual implementation depends on how files are stored
  }

  throw new Error(`Unsupported file type: ${fileType}`)
}

/**
 * Calculate approximate token count for text
 * Rough estimate: 1 token ~= 4 characters for English
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}
