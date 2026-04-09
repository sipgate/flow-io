-- Add support for "cannot be evaluated" state in call criteria results
-- When passed = NULL, it means the criterion could not be evaluated
-- (e.g., caller hung up before agent could complete the action)

-- Allow NULL for passed column
ALTER TABLE call_criteria_results
ALTER COLUMN passed DROP NOT NULL;

-- Add comment explaining the three states
COMMENT ON COLUMN call_criteria_results.passed IS 'true = passed, false = failed, NULL = could not be evaluated (inconclusive)';
