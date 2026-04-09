'use server'

import OpenAI from 'openai'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

// Lazy initialization to avoid build-time errors when env vars aren't available
let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiClient
}

/**
 * Generate an avatar for an assistant using GPT Image 1 Mini
 * @param assistantName - The name of the assistant to generate an avatar for
 * @param description - Optional description to influence the avatar style
 * @returns URL of the generated avatar in Supabase Storage
 */
export async function generateAssistantAvatar(
  assistantName: string,
  description?: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    // Create a prompt for a professional AI assistant avatar
    const prompt = `Create a friendly, professional avatar icon for an AI voice assistant named "${assistantName}". ${
      description ? `The assistant's purpose: ${description}. ` : ''
    }Style: Modern, minimalist, circular avatar suitable for a business application. Use soft gradients and a friendly appearance. The avatar should feel approachable and trustworthy. Do not include any text.`

    console.log('[Avatar Generator] Generating avatar for:', assistantName)

    // Generate image using GPT Image 1 (cheapest option)
    // Note: gpt-image-1 only supports 1024x1024, 1024x1536, 1536x1024, or 'auto'
    // It returns base64 data by default
    const response = await getOpenAIClient().images.generate({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024', // Smallest square size available
    })

    const imageB64 = response.data?.[0]?.b64_json
    if (!imageB64) {
      return { url: null, error: 'No image data returned from OpenAI' }
    }

    console.log('[Avatar Generator] Image generated, uploading to storage...')

    // Convert base64 to Uint8Array
    const imageData = Uint8Array.from(atob(imageB64), c => c.charCodeAt(0))

    // Upload to Supabase Storage
    const supabase = createServiceRoleClient()
    const fileName = `avatars/${Date.now()}-${assistantName.toLowerCase().replace(/\s+/g, '-')}.png`

    console.log('[Avatar Generator] Uploading to storage:', fileName)

    const { error: uploadError } = await supabase.storage
      .from('assistants')
      .upload(fileName, imageData, {
        contentType: 'image/png',
        upsert: false,
      })

    if (uploadError) {
      console.error('[Avatar Generator] Upload error:', uploadError)
      return { url: null, error: `Storage upload failed: ${uploadError.message}` }
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('assistants')
      .getPublicUrl(fileName)

    console.log('[Avatar Generator] Avatar created:', publicUrlData.publicUrl)

    return { url: publicUrlData.publicUrl, error: null }
  } catch (error) {
    console.error('[Avatar Generator] Error:', error)
    return { url: null, error: String(error) }
  }
}

/**
 * Generate avatars for all assistants that don't have one
 */
export async function generateMissingAvatars(): Promise<{
  generated: number
  failed: number
  errors: string[]
}> {
  const supabase = createServiceRoleClient()

  // Get all assistants without avatars
  const { data: assistants, error } = await supabase
    .from('assistants')
    .select('id, name, description')
    .is('avatar_url', null)

  if (error) {
    return { generated: 0, failed: 0, errors: [error.message] }
  }

  if (!assistants || assistants.length === 0) {
    return { generated: 0, failed: 0, errors: [] }
  }

  console.log(`[Avatar Generator] Generating avatars for ${assistants.length} assistants`)

  let generated = 0
  let failed = 0
  const errors: string[] = []

  // Generate avatars sequentially to avoid rate limits
  for (const assistant of assistants) {
    const { url, error: genError } = await generateAssistantAvatar(
      assistant.name,
      assistant.description || undefined
    )

    if (url) {
      // Update assistant with avatar URL
      const { error: updateError } = await supabase
        .from('assistants')
        .update({ avatar_url: url })
        .eq('id', assistant.id)

      if (updateError) {
        failed++
        errors.push(`Failed to update ${assistant.name}: ${updateError.message}`)
      } else {
        generated++
        console.log(`[Avatar Generator] Generated avatar for: ${assistant.name}`)
      }
    } else {
      failed++
      errors.push(`Failed to generate for ${assistant.name}: ${genError}`)
    }

    // Small delay between requests to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  return { generated, failed, errors }
}
