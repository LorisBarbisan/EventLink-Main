-- One-off data fix, not a schema migration. Run once by hand.
--
-- Earnings lines hidden by a cancelled booking before archived_at existed are
-- archived with no archived_at: invisible in Recently removed, and never swept.
-- This gives them a fresh 30 days in Recently removed, where they show as
-- "Booking cancelled".
--
-- NOW(), deliberately not updated_at: a past date would make any row older
-- than 30 days eligible for permanent deletion on the next nightly sweep.
-- Limited to booking lines; earlier manual deletions are left as they are.
UPDATE earnings_entries
SET archived_at = NOW()
WHERE archived = true
  AND archived_at IS NULL
  AND (source = 'booking' OR booking_id IS NOT NULL);
