-- Discriminator flag for jobs posted by freelancers (vs. recruiters/external sources).
-- Allows the UI and queries to distinguish poster type without joining users.
ALTER TABLE jobs ADD COLUMN is_freelancer_posted boolean NOT NULL DEFAULT false;
