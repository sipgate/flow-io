-- Enable realtime for call_criteria_results table
-- This allows the UI to receive live updates when criteria are evaluated

ALTER PUBLICATION supabase_realtime ADD TABLE call_criteria_results;
