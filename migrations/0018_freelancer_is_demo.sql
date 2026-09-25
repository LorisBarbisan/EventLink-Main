-- Internal seed/demo/test records are excluded from public search results and
-- the sitemap via this flag, rather than relying on name-based exclusion.
ALTER TABLE freelancer_profiles ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- Flag the known demo/test records as a one-off backfill. New demo records should
-- set is_demo = true explicitly; this list is a stopgap for existing rows.
--   • "Sample User" / "Freelance Tech" (999 years experience, Lorem ipsum CV)
--   • "Test Freelancer"
UPDATE freelancer_profiles
SET is_demo = true
WHERE lower(trim(concat(first_name, ' ', last_name))) IN (
  'sample user',
  'freelance tech',
  'test freelancer'
)
   OR experience_years = 999;
