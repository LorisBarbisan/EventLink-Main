-- Indexes for the two hottest unindexed tables.
--
-- CONCURRENTLY so inserts and updates keep flowing while each index builds.
-- CONCURRENTLY cannot run inside a transaction block: run each statement on
-- its own (in the Neon SQL editor, run them one at a time, not as a batch).
-- If one fails part-way it can leave an INVALID index: DROP INDEX CONCURRENTLY
-- it and run the statement again.

-- Applicants lists and the hire count (which runs while the job row is locked).
-- Also serves lookups by job_id alone (leftmost prefix).
CREATE INDEX CONCURRENTLY IF NOT EXISTS job_applications_job_status_idx
  ON job_applications (job_id, status);

-- My Applications
CREATE INDEX CONCURRENTLY IF NOT EXISTS job_applications_freelancer_idx
  ON job_applications (freelancer_id);

-- Opening a thread: lookup and ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_conversation_idx
  ON messages (conversation_id, created_at);
