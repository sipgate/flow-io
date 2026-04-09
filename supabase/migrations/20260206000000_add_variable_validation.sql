-- Add validation and real-time collection columns to variable_definitions
ALTER TABLE variable_definitions
  ADD COLUMN validation_regex text,
  ADD COLUMN validation_endpoint text,
  ADD COLUMN validation_error_hint text,
  ADD COLUMN mandatory_collection boolean NOT NULL DEFAULT false,
  ADD COLUMN confirm_with_caller boolean NOT NULL DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN variable_definitions.validation_regex IS 'Regex pattern for immediate validation (e.g. ^\d{5}$ for PLZ)';
COMMENT ON COLUMN variable_definitions.validation_endpoint IS 'URL for background webhook validation (POST, expects {valid: boolean, message?: string})';
COMMENT ON COLUMN variable_definitions.validation_error_hint IS 'Human-readable hint injected into agent context when validation fails';
COMMENT ON COLUMN variable_definitions.mandatory_collection IS 'Agent MUST actively ask for this field during the call';
COMMENT ON COLUMN variable_definitions.confirm_with_caller IS 'Agent reads back the value and asks the caller to confirm (catches STT errors)';
