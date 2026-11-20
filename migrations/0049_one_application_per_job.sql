-- One application per freelancer per job.
-- The hire count runs under a lock and decides whether a job is full; two
-- rows for one person would count them twice.
--
-- Run each step on its own (CONCURRENTLY can't run in a transaction).

-- 1. AUDIT: any freelancer with more than one application to the same job.
--    Expect zero rows. If any appear, decide which to keep before step 2
--    (usually the one with the most advanced status), and delete the others.
SELECT job_id, freelancer_id, count(*) AS n,
       array_agg(id ORDER BY id) AS ids,
       array_agg(status ORDER BY id) AS statuses
FROM job_applications
GROUP BY job_id, freelancer_id
HAVING count(*) > 1;

-- 2. Add the constraint without blocking writes.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS job_applications_job_freelancer_unique
  ON job_applications (job_id, freelancer_id);

-- If step 2 fails part-way it leaves an INVALID index: drop it and retry.
--   DROP INDEX CONCURRENTLY IF EXISTS job_applications_job_freelancer_unique;
