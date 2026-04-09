-- Add thinking_level column to assistants table for Gemini 3/2.5 models
ALTER TABLE assistants
ADD COLUMN IF NOT EXISTS thinking_level TEXT DEFAULT NULL
CHECK (thinking_level IS NULL OR thinking_level IN ('minimal', 'low', 'medium', 'high'));

COMMENT ON COLUMN assistants.thinking_level IS 'Thinking level for Gemini 3/2.5 models: minimal, low, medium, high. NULL means use default (auto).';
