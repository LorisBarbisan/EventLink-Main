-- Migration: Add country field to freelancer_profiles and recruiter_profiles
-- Run on both staging (ep-round-mouse) and production (ep-little-feather) databases

ALTER TABLE freelancer_profiles ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE recruiter_profiles ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE cv_parsing_results ADD COLUMN IF NOT EXISTS extracted_country text;
