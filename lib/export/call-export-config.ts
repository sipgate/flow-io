/**
 * Export field configuration for calls
 */
export interface ExportField {
  key: string
  label: string
  enabled: boolean
}

export const EXPORT_FIELDS: ExportField[] = [
  { key: 'caller_number', label: 'Caller Number', enabled: true },
  { key: 'assistant_name', label: 'Assistant', enabled: true },
  { key: 'phone_number', label: 'Phone Number', enabled: true },
  { key: 'status', label: 'Status', enabled: true },
  { key: 'started_at', label: 'Started At', enabled: true },
  { key: 'ended_at', label: 'Ended At', enabled: true },
  { key: 'duration_seconds', label: 'Duration (seconds)', enabled: true },
  { key: 'duration_formatted', label: 'Duration (formatted)', enabled: true },
  { key: 'csat_score', label: 'CSAT Score', enabled: true },
  { key: 'csat_reasoning', label: 'CSAT Reasoning', enabled: false },
  { key: 'extracted_variables', label: 'Extracted Variables', enabled: true },
  { key: 'notes', label: 'Notes', enabled: false },
  { key: 'transcript', label: 'Transcript', enabled: false },
  { key: 'criteria_results', label: 'Criteria Results', enabled: false },
]

export type ExportFormat = 'csv' | 'json' | 'xlsx'
