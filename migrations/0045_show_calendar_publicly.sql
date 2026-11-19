-- Showing availability publicly is opt-in: profiles are public by default, so
-- inheriting that would publish every freelancer's working pattern unasked.
ALTER TABLE freelancer_profiles ADD COLUMN IF NOT EXISTS show_calendar_publicly boolean NOT NULL DEFAULT false;
