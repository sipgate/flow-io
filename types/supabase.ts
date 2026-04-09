export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      assistants: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          scenario_id: string | null
          id: string
          is_active: boolean | null
          knowledge_base_id: string | null
          llm_model: string | null
          llm_provider: string | null
          llm_temperature: number | null
          max_tokens: number | null
          name: string
          opening_message: string | null
          organization_id: string
          personality: string | null
          system_prompt: string | null
          temperature: number | null
          updated_at: string | null
          voice_config: Json | null
          voice_id: string | null
          voice_language: string | null
          voice_provider: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          scenario_id?: string | null
          id?: string
          is_active?: boolean | null
          knowledge_base_id?: string | null
          llm_model?: string | null
          llm_provider?: string | null
          llm_temperature?: number | null
          max_tokens?: number | null
          name: string
          opening_message?: string | null
          organization_id: string
          personality?: string | null
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string | null
          voice_config?: Json | null
          voice_id?: string | null
          voice_language?: string | null
          voice_provider?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          scenario_id?: string | null
          id?: string
          is_active?: boolean | null
          knowledge_base_id?: string | null
          llm_model?: string | null
          llm_provider?: string | null
          llm_temperature?: number | null
          max_tokens?: number | null
          name?: string
          opening_message?: string | null
          organization_id?: string
          personality?: string | null
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string | null
          voice_config?: Json | null
          voice_id?: string | null
          voice_language?: string | null
          voice_provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistants_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "call_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_assistants_knowledge_base"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      call_analytics: {
        Row: {
          assistant_id: string | null
          avg_duration_seconds: number | null
          avg_user_satisfaction: number | null
          created_at: string | null
          date: string
          failed_calls: number | null
          id: string
          organization_id: string
          successful_calls: number | null
          total_calls: number | null
          total_duration_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          assistant_id?: string | null
          avg_duration_seconds?: number | null
          avg_user_satisfaction?: number | null
          created_at?: string | null
          date: string
          failed_calls?: number | null
          id?: string
          organization_id: string
          successful_calls?: number | null
          total_calls?: number | null
          total_duration_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          assistant_id?: string | null
          avg_duration_seconds?: number | null
          avg_user_satisfaction?: number | null
          created_at?: string | null
          date?: string
          failed_calls?: number | null
          id?: string
          organization_id?: string
          successful_calls?: number | null
          total_calls?: number | null
          total_duration_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_analytics_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_analytics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_scenario_versions: {
        Row: {
          created_at: string | null
          created_by: string | null
          edges: Json
          scenario_id: string
          id: string
          nodes: Json
          published_at: string | null
          variables: Json | null
          version: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          edges: Json
          scenario_id: string
          id?: string
          nodes: Json
          published_at?: string | null
          variables?: Json | null
          version: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          edges?: Json
          scenario_id?: string
          id?: string
          nodes?: Json
          published_at?: string | null
          variables?: Json | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "call_scenario_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_scenario_versions_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "call_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      call_scenarios: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          edges: Json
          id: string
          is_published: boolean | null
          name: string
          nodes: Json
          organization_id: string
          updated_at: string | null
          variables: Json | null
          version: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          edges?: Json
          id?: string
          is_published?: boolean | null
          name: string
          nodes?: Json
          organization_id: string
          updated_at?: string | null
          variables?: Json | null
          version?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          edges?: Json
          id?: string
          is_published?: boolean | null
          name?: string
          nodes?: Json
          organization_id?: string
          updated_at?: string | null
          variables?: Json | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "call_scenarios_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_scenarios_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_recordings: {
        Row: {
          call_session_id: string
          created_at: string | null
          duration_seconds: number | null
          file_size_bytes: number | null
          format: string | null
          id: string
          storage_path: string
        }
        Insert: {
          call_session_id: string
          created_at?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          format?: string | null
          id?: string
          storage_path: string
        }
        Update: {
          call_session_id?: string
          created_at?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          format?: string | null
          id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_recordings_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sessions: {
        Row: {
          assistant_id: string | null
          caller_number: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          metadata: Json | null
          organization_id: string
          phone_number_id: string | null
          session_id: string
          started_at: string | null
          status: string | null
        }
        Insert: {
          assistant_id?: string | null
          caller_number?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          phone_number_id?: string | null
          session_id: string
          started_at?: string | null
          status?: string | null
        }
        Update: {
          assistant_id?: string | null
          caller_number?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          phone_number_id?: string | null
          session_id?: string
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_sessions_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      call_transcripts: {
        Row: {
          call_session_id: string
          confidence: number | null
          id: string
          metadata: Json | null
          speaker: string
          text: string
          timestamp: string | null
        }
        Insert: {
          call_session_id: string
          confidence?: number | null
          id?: string
          metadata?: Json | null
          speaker: string
          text: string
          timestamp?: string | null
        }
        Update: {
          call_session_id?: string
          confidence?: number | null
          id?: string
          metadata?: Json | null
          speaker?: string
          text?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_transcripts_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      extracted_variables: {
        Row: {
          call_session_id: string
          confidence: number | null
          extracted_at: string | null
          id: string
          variable_name: string
          variable_value: string | null
        }
        Insert: {
          call_session_id: string
          confidence?: number | null
          extracted_at?: string | null
          id?: string
          variable_name: string
          variable_value?: string | null
        }
        Update: {
          call_session_id?: string
          confidence?: number | null
          extracted_at?: string | null
          id?: string
          variable_name?: string
          variable_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extracted_variables_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_chunks: {
        Row: {
          chunk_index: number | null
          content: string
          created_at: string | null
          document_id: string
          embedding: string | null
          id: string
          knowledge_base_id: string
          metadata: Json | null
        }
        Insert: {
          chunk_index?: number | null
          content: string
          created_at?: string | null
          document_id: string
          embedding?: string | null
          id?: string
          knowledge_base_id: string
          metadata?: Json | null
        }
        Update: {
          chunk_index?: number | null
          content?: string
          created_at?: string | null
          document_id?: string
          embedding?: string | null
          id?: string
          knowledge_base_id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "kb_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_chunks_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_documents: {
        Row: {
          content: string | null
          created_at: string | null
          file_path: string | null
          file_size_bytes: number | null
          file_type: string | null
          id: string
          knowledge_base_id: string
          processing_status: string | null
          title: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          knowledge_base_id: string
          processing_status?: string | null
          title: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          knowledge_base_id?: string
          processing_status?: string | null
          title?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_documents_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_bases: {
        Row: {
          chunk_overlap: number | null
          chunk_size: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          embedding_model: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          chunk_overlap?: number | null
          chunk_size?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          embedding_model?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          chunk_overlap?: number | null
          chunk_size?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          embedding_model?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_bases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_bases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_usage: {
        Row: {
          call_session_id: string | null
          completion_tokens: number | null
          cost_usd: number | null
          created_at: string | null
          id: string
          model: string
          organization_id: string
          prompt_tokens: number | null
          provider: string
          total_tokens: number | null
        }
        Insert: {
          call_session_id?: string | null
          completion_tokens?: number | null
          cost_usd?: number | null
          created_at?: string | null
          id?: string
          model: string
          organization_id: string
          prompt_tokens?: number | null
          provider: string
          total_tokens?: number | null
        }
        Update: {
          call_session_id?: string | null
          completion_tokens?: number | null
          cost_usd?: number | null
          created_at?: string | null
          id?: string
          model?: string
          organization_id?: string
          prompt_tokens?: number | null
          provider?: string
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "llm_usage_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id: string
          role: string
          user_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          auto_add_domain_members: boolean | null
          created_at: string | null
          domain: string | null
          id: string
          name: string
          settings: Json | null
          slug: string
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          auto_add_domain_members?: boolean | null
          created_at?: string | null
          domain?: string | null
          id?: string
          name: string
          settings?: Json | null
          slug: string
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_add_domain_members?: boolean | null
          created_at?: string | null
          domain?: string | null
          id?: string
          name?: string
          settings?: Json | null
          slug?: string
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      phone_numbers: {
        Row: {
          assigned_at: string | null
          assistant_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          organization_id: string
          phone_number: string
          provider: string | null
          provider_config: Json | null
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assistant_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          organization_id: string
          phone_number: string
          provider?: string | null
          provider_config?: Json | null
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assistant_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string
          phone_number?: string
          provider?: string | null
          provider_config?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phone_numbers_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_numbers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          attempted_at: string | null
          event_type: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          webhook_id: string
        }
        Insert: {
          attempted_at?: string | null
          event_type: string
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          webhook_id: string
        }
        Update: {
          attempted_at?: string | null
          event_type?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string | null
          created_by: string | null
          event_types: string[]
          headers: Json | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          event_types: string[]
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          event_types?: string[]
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_kb_chunks: {
        Args: {
          kb_id: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
