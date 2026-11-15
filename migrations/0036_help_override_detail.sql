ALTER TABLE help_content_overrides
  ADD COLUMN IF NOT EXISTS detail JSONB;
