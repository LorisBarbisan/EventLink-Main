-- Every employer job should record who receives application alerts (legacy jobs: company owner).
UPDATE jobs
SET posted_by_user_id = recruiter_id
WHERE posted_by_user_id IS NULL
  AND recruiter_id IS NOT NULL;
