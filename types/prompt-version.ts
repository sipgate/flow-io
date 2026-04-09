// Prompt Version Types - For tracking system prompt history

export interface PromptVersion {
  id: string
  assistant_id: string
  organization_id: string
  system_prompt: string
  version_number: number
  created_at: string
  created_by: string | null
  note: string | null
}

export interface PromptVersionInsert {
  assistant_id: string
  organization_id: string
  system_prompt: string
  version_number: number
  created_by?: string | null
  note?: string | null
}

export interface PromptVersionWithUser extends PromptVersion {
  user?: {
    email: string
    full_name: string | null
  } | null
}
