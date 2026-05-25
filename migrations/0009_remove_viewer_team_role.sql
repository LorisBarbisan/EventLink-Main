-- Migrate existing viewer team members to manager
UPDATE "team_members" SET "role" = 'manager', "updated_at" = now() WHERE "role" = 'viewer';
