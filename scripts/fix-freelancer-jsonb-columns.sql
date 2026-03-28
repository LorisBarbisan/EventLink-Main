-- One-time fix: cast text/varchar JSON columns to jsonb before `drizzle-kit push`.
-- Error: column "work_history" cannot be cast automatically to type jsonb
-- Run: psql "$DATABASE_URL" -f scripts/fix-freelancer-jsonb-columns.sql

-- work_history: nullable JSON text → jsonb
ALTER TABLE freelancer_profiles
  ALTER COLUMN work_history TYPE jsonb
  USING (
    CASE
      WHEN work_history IS NULL THEN NULL
      WHEN trim(work_history::text) = '' THEN NULL
      ELSE work_history::text::jsonb
    END
  );

ALTER TABLE freelancer_profiles
  ALTER COLUMN education_history TYPE jsonb
  USING (
    CASE
      WHEN education_history IS NULL THEN NULL
      WHEN trim(education_history::text) = '' THEN NULL
      ELSE education_history::text::jsonb
    END
  );
