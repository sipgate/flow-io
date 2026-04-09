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
      assistant_knowledge_bases: {
        Row: {
          assistant_id: string
          created_at: string | null
          id: string
          knowledge_base_id: string
        }
        Insert: {
          assistant_id: string
          created_at?: string | null
          id?: string
          knowledge_base_id: string
        }
        Update: {
          assistant_id?: string
          created_at?: string | null
          id?: string
          knowledge_base_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_knowledge_bases_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_knowledge_bases_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "kb_analytics_summary"
            referencedColumns: ["knowledge_base_id"]
          },
          {
            foreignKeyName: "assistant_knowledge_bases_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_mcp_servers: {
        Row: {
          assistant_id: string
          created_at: string | null
          id: string
          mcp_server_id: string
          priority: number | null
        }
        Insert: {
          assistant_id: string
          created_at?: string | null
          id?: string
          mcp_server_id: string
          priority?: number | null
        }
        Update: {
          assistant_id?: string
          created_at?: string | null
          id?: string
          mcp_server_id?: string
          priority?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_mcp_servers_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_mcp_servers_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      assistants: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          enable_kb_tool: boolean | null
          scenario_id: string | null
          id: string
          is_active: boolean | null
          kb_tool_description: string | null
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
          thinking_level: string | null
          updated_at: string | null
          voice_config: Json | null
          voice_id: string | null
          voice_language: string | null
          voice_provider: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enable_kb_tool?: boolean | null
          scenario_id?: string | null
          id?: string
          is_active?: boolean | null
          kb_tool_description?: string | null
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
          thinking_level?: string | null
          updated_at?: string | null
          voice_config?: Json | null
          voice_id?: string | null
          voice_language?: string | null
          voice_provider?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enable_kb_tool?: boolean | null
          scenario_id?: string | null
          id?: string
          is_active?: boolean | null
          kb_tool_description?: string | null
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
          thinking_level?: string | null
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
      call_criteria: {
        Row: {
          assistant_id: string | null
          created_at: string | null
          description: string
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          position: number | null
          updated_at: string | null
        }
        Insert: {
          assistant_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          position?: number | null
          updated_at?: string | null
        }
        Update: {
          assistant_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          position?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_criteria_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_criteria_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_criteria_results: {
        Row: {
          call_session_id: string
          criterion_id: string
          evaluated_at: string | null
          id: string
          passed: boolean
          reasoning: string | null
        }
        Insert: {
          call_session_id: string
          criterion_id: string
          evaluated_at?: string | null
          id?: string
          passed: boolean
          reasoning?: string | null
        }
        Update: {
          call_session_id?: string
          criterion_id?: string
          evaluated_at?: string | null
          id?: string
          passed?: boolean
          reasoning?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_criteria_results_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_criteria_results_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "call_criteria"
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
      call_notes: {
        Row: {
          assistant_id: string | null
          call_session_id: string
          category: string | null
          content: string
          conversation_context: string | null
          created_at: string | null
          id: string
          organization_id: string
          priority: string | null
        }
        Insert: {
          assistant_id?: string | null
          call_session_id: string
          category?: string | null
          content: string
          conversation_context?: string | null
          created_at?: string | null
          id?: string
          organization_id: string
          priority?: string | null
        }
        Update: {
          assistant_id?: string | null
          call_session_id?: string
          category?: string | null
          content?: string
          conversation_context?: string | null
          created_at?: string | null
          id?: string
          organization_id?: string
          priority?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_notes_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_notes_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_notes_organization_id_fkey"
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
      call_tool_configs: {
        Row: {
          assistant_id: string
          created_at: string | null
          forward_caller_id_name: string | null
          forward_caller_id_number: string | null
          forward_enabled: boolean | null
          forward_instructions: string | null
          forward_phone_number: string | null
          hangup_enabled: boolean | null
          hangup_instructions: string | null
          id: string
          note_enabled: boolean | null
          note_instructions: string | null
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          assistant_id: string
          created_at?: string | null
          forward_caller_id_name?: string | null
          forward_caller_id_number?: string | null
          forward_enabled?: boolean | null
          forward_instructions?: string | null
          forward_phone_number?: string | null
          hangup_enabled?: boolean | null
          hangup_instructions?: string | null
          id?: string
          note_enabled?: boolean | null
          note_instructions?: string | null
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          assistant_id?: string
          created_at?: string | null
          forward_caller_id_name?: string | null
          forward_caller_id_number?: string | null
          forward_enabled?: boolean | null
          forward_instructions?: string | null
          forward_phone_number?: string | null
          hangup_enabled?: boolean | null
          hangup_instructions?: string | null
          id?: string
          note_enabled?: boolean | null
          note_instructions?: string | null
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_tool_configs_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: true
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_tool_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          created_at: string | null
          extracted_at: string | null
          id: string
          label: string | null
          name: string | null
          organization_id: string | null
          type: string | null
          value: string | null
          variable_definition_id: string | null
          variable_name: string
          variable_value: string | null
        }
        Insert: {
          call_session_id: string
          confidence?: number | null
          created_at?: string | null
          extracted_at?: string | null
          id?: string
          label?: string | null
          name?: string | null
          organization_id?: string | null
          type?: string | null
          value?: string | null
          variable_definition_id?: string | null
          variable_name: string
          variable_value?: string | null
        }
        Update: {
          call_session_id?: string
          confidence?: number | null
          created_at?: string | null
          extracted_at?: string | null
          id?: string
          label?: string | null
          name?: string | null
          organization_id?: string | null
          type?: string | null
          value?: string | null
          variable_definition_id?: string | null
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
          {
            foreignKeyName: "extracted_variables_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_variables_variable_definition_id_fkey"
            columns: ["variable_definition_id"]
            isOneToOne: false
            referencedRelation: "variable_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_chunk_retrievals: {
        Row: {
          chunk_id: string
          created_at: string | null
          document_id: string
          id: string
          rank: number
          search_event_id: string
          similarity_score: number
        }
        Insert: {
          chunk_id: string
          created_at?: string | null
          document_id: string
          id?: string
          rank: number
          search_event_id: string
          similarity_score: number
        }
        Update: {
          chunk_id?: string
          created_at?: string | null
          document_id?: string
          id?: string
          rank?: number
          search_event_id?: string
          similarity_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_chunk_retrievals_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "kb_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_chunk_retrievals_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "kb_popular_chunks"
            referencedColumns: ["chunk_id"]
          },
          {
            foreignKeyName: "kb_chunk_retrievals_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "kb_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_chunk_retrievals_search_event_id_fkey"
            columns: ["search_event_id"]
            isOneToOne: false
            referencedRelation: "kb_search_events"
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
            referencedRelation: "kb_analytics_summary"
            referencedColumns: ["knowledge_base_id"]
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
            referencedRelation: "kb_analytics_summary"
            referencedColumns: ["knowledge_base_id"]
          },
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
      kb_search_events: {
        Row: {
          assistant_id: string
          call_session_id: string | null
          created_at: string | null
          id: string
          knowledge_base_id: string
          organization_id: string
          query: string
          results_count: number | null
          search_duration_ms: number | null
        }
        Insert: {
          assistant_id: string
          call_session_id?: string | null
          created_at?: string | null
          id?: string
          knowledge_base_id: string
          organization_id: string
          query: string
          results_count?: number | null
          search_duration_ms?: number | null
        }
        Update: {
          assistant_id?: string
          call_session_id?: string | null
          created_at?: string | null
          id?: string
          knowledge_base_id?: string
          organization_id?: string
          query?: string
          results_count?: number | null
          search_duration_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_search_events_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_search_events_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_search_events_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "kb_analytics_summary"
            referencedColumns: ["knowledge_base_id"]
          },
          {
            foreignKeyName: "kb_search_events_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_search_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      mcp_servers: {
        Row: {
          auth_config: Json | null
          auth_type: string | null
          cached_tools: Json | null
          created_at: string | null
          description: string | null
          headers: Json | null
          health_status: string | null
          id: string
          is_active: boolean | null
          last_health_check: string | null
          name: string
          organization_id: string
          timeout_ms: number | null
          tools_fetched_at: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          auth_config?: Json | null
          auth_type?: string | null
          cached_tools?: Json | null
          created_at?: string | null
          description?: string | null
          headers?: Json | null
          health_status?: string | null
          id?: string
          is_active?: boolean | null
          last_health_check?: string | null
          name: string
          organization_id: string
          timeout_ms?: number | null
          tools_fetched_at?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          auth_config?: Json | null
          auth_type?: string | null
          cached_tools?: Json | null
          created_at?: string | null
          description?: string | null
          headers?: Json | null
          health_status?: string | null
          id?: string
          is_active?: boolean | null
          last_health_check?: string | null
          name?: string
          organization_id?: string
          timeout_ms?: number | null
          tools_fetched_at?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_servers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_tool_call_events: {
        Row: {
          arguments: Json
          assistant_id: string
          call_session_id: string | null
          created_at: string | null
          duration_ms: number | null
          error: string | null
          id: string
          mcp_server_id: string
          organization_id: string
          result: Json | null
          test_session_id: string | null
          tool_name: string
        }
        Insert: {
          arguments: Json
          assistant_id: string
          call_session_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          mcp_server_id: string
          organization_id: string
          result?: Json | null
          test_session_id?: string | null
          tool_name: string
        }
        Update: {
          arguments?: Json
          assistant_id?: string
          call_session_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          mcp_server_id?: string
          organization_id?: string
          result?: Json | null
          test_session_id?: string | null
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_tool_call_events_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_tool_call_events_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_tool_call_events_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_tool_call_events_organization_id_fkey"
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
      prompt_versions: {
        Row: {
          assistant_id: string
          created_at: string | null
          created_by: string | null
          id: string
          note: string | null
          organization_id: string
          system_prompt: string
          version_number: number
        }
        Insert: {
          assistant_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          organization_id: string
          system_prompt: string
          version_number: number
        }
        Update: {
          assistant_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          organization_id?: string
          system_prompt?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      test_cases: {
        Row: {
          conversation_flow: Json
          created_at: string | null
          description: string | null
          evaluation_criteria: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          position: number | null
          test_suite_id: string
          updated_at: string | null
        }
        Insert: {
          conversation_flow?: Json
          created_at?: string | null
          description?: string | null
          evaluation_criteria?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          position?: number | null
          test_suite_id: string
          updated_at?: string | null
        }
        Update: {
          conversation_flow?: Json
          created_at?: string | null
          description?: string | null
          evaluation_criteria?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          position?: number | null
          test_suite_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_cases_test_suite_id_fkey"
            columns: ["test_suite_id"]
            isOneToOne: false
            referencedRelation: "test_suites"
            referencedColumns: ["id"]
          },
        ]
      }
      test_runs: {
        Row: {
          assistant_id: string
          completed_at: string | null
          conversation_log: Json | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          evaluation_result: Json | null
          id: string
          organization_id: string
          prompt_override: string | null
          started_at: string | null
          status: string | null
          test_case_id: string | null
          test_suite_id: string | null
        }
        Insert: {
          assistant_id: string
          completed_at?: string | null
          conversation_log?: Json | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          evaluation_result?: Json | null
          id?: string
          organization_id: string
          prompt_override?: string | null
          started_at?: string | null
          status?: string | null
          test_case_id?: string | null
          test_suite_id?: string | null
        }
        Update: {
          assistant_id?: string
          completed_at?: string | null
          conversation_log?: Json | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          evaluation_result?: Json | null
          id?: string
          organization_id?: string
          prompt_override?: string | null
          started_at?: string | null
          status?: string | null
          test_case_id?: string | null
          test_suite_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_runs_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_runs_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_runs_test_suite_id_fkey"
            columns: ["test_suite_id"]
            isOneToOne: false
            referencedRelation: "test_suites"
            referencedColumns: ["id"]
          },
        ]
      }
      test_sessions: {
        Row: {
          assistant_id: string
          created_at: string | null
          id: string
          last_message_at: string | null
          metadata: Json | null
          name: string | null
          organization_id: string
          started_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          assistant_id: string
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          metadata?: Json | null
          name?: string | null
          organization_id: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          assistant_id?: string
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          metadata?: Json | null
          name?: string | null
          organization_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_sessions_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      test_suites: {
        Row: {
          assistant_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          assistant_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          assistant_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_suites_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_suites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      test_transcripts: {
        Row: {
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          organization_id: string
          role: string
          sequence_number: number
          test_session_id: string
          timestamp: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          role: string
          sequence_number: number
          test_session_id: string
          timestamp?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          role?: string
          sequence_number?: number
          test_session_id?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_transcripts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_transcripts_test_session_id_fkey"
            columns: ["test_session_id"]
            isOneToOne: false
            referencedRelation: "test_sessions"
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
      variable_definitions: {
        Row: {
          assistant_id: string
          created_at: string | null
          description: string
          id: string
          label: string
          name: string
          organization_id: string
          position: number | null
          required: boolean | null
          type: string
          updated_at: string | null
        }
        Insert: {
          assistant_id: string
          created_at?: string | null
          description: string
          id?: string
          label: string
          name: string
          organization_id: string
          position?: number | null
          required?: boolean | null
          type: string
          updated_at?: string | null
        }
        Update: {
          assistant_id?: string
          created_at?: string | null
          description?: string
          id?: string
          label?: string
          name?: string
          organization_id?: string
          position?: number | null
          required?: boolean | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variable_definitions_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variable_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      variable_webhooks: {
        Row: {
          assistant_id: string
          created_at: string | null
          enabled: boolean | null
          headers: Json | null
          id: string
          name: string
          organization_id: string
          updated_at: string | null
          url: string
        }
        Insert: {
          assistant_id: string
          created_at?: string | null
          enabled?: boolean | null
          headers?: Json | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string | null
          url: string
        }
        Update: {
          assistant_id?: string
          created_at?: string | null
          enabled?: boolean | null
          headers?: Json | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "variable_webhooks_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variable_webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      kb_analytics_summary: {
        Row: {
          avg_results_per_search: number | null
          knowledge_base_id: string | null
          knowledge_base_name: string | null
          last_searched_at: string | null
          organization_id: string | null
          total_searches: number | null
          unique_assistants: number | null
          unique_calls: number | null
          unique_chunks_retrieved: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_bases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_popular_chunks: {
        Row: {
          avg_similarity: number | null
          chunk_id: string | null
          content: string | null
          document_title: string | null
          knowledge_base_id: string | null
          last_retrieved_at: string | null
          retrieval_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_chunks_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "kb_analytics_summary"
            referencedColumns: ["knowledge_base_id"]
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
