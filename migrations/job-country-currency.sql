-- Add country and currency columns to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GBP';
