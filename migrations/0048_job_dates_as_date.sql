-- jobs.event_date and jobs.end_date: text → date.
--
-- Run on a RESTORED BRANCH first (docs/restore-runbook.md), then production.
-- Run each step on its own and read the result before going on.

-- 1. AUDIT: anything that isn't a plain YYYY-MM-DD (empty strings included).
--    Expect zero rows. If any appear, decide what each should be before step 2.
SELECT id, title, event_date, end_date
FROM jobs
WHERE (event_date IS NOT NULL AND event_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
   OR (end_date   IS NOT NULL AND end_date   !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');

-- 2. Blank strings mean "no date": make them NULL. (Fix any other rows from
--    step 1 by hand — e.g. UPDATE jobs SET event_date = '2026-11-12' WHERE id = …)
UPDATE jobs SET event_date = NULL WHERE event_date = '';
UPDATE jobs SET end_date   = NULL WHERE end_date   = '';

-- 3. Impossible dates that match the pattern (e.g. 2026-02-30) would make the
--    cast fail. This lists them; expect zero rows.
SELECT id, event_date, end_date FROM jobs
WHERE (event_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND to_char(to_date(event_date, 'YYYY-MM-DD'), 'YYYY-MM-DD') <> event_date)
   OR (end_date   ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND to_char(to_date(end_date,   'YYYY-MM-DD'), 'YYYY-MM-DD') <> end_date);

-- 4. Convert. Takes a brief lock on jobs; with today's row count, under a second.
ALTER TABLE jobs ALTER COLUMN event_date TYPE date USING event_date::date;
ALTER TABLE jobs ALTER COLUMN end_date   TYPE date USING end_date::date;
