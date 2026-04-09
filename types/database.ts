export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
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
        Relationships: []
      }
      /* eslint-disable @typescript-eslint/no-explicit-any */
      [key: string]: {
        Row: any
        Insert: any
        Update: any
        Relationships: any[]
      }
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }
    Views: {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      [key: string]: {
        Row: any
        Relationships: any[]
      }
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }
    Functions: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any
    }
    Enums: {
      [key: string]: never
    }
    CompositeTypes: {
      [key: string]: never
    }
  }
}
