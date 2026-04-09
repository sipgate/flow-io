-- Add 'partial' status to test_runs table
-- This status is used for tests that pass but with a score below 80%

-- Drop the existing constraint
ALTER TABLE test_runs DROP CONSTRAINT IF EXISTS test_runs_status_check;

-- Add the new constraint with 'partial' included
ALTER TABLE test_runs ADD CONSTRAINT test_runs_status_check
  CHECK (status IN ('pending', 'running', 'passed', 'partial', 'failed', 'error'));
