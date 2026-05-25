-- Recruiter application alerts (new apply, invitation response) belong on job_update + related_entity_type application.
UPDATE notifications
SET type = 'job_update'
WHERE type = 'application_update'
  AND related_entity_type = 'application'
  AND (
    title = 'New Job Application'
    OR title IN ('Invitation Accepted', 'Invitation Declined')
    OR action_url = '/dashboard?tab=applications'
  );
