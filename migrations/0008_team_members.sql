CREATE TABLE IF NOT EXISTS "team_members" (
  "id" serial PRIMARY KEY NOT NULL,
  "company_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "role" text NOT NULL DEFAULT 'manager',
  "invited_email" text NOT NULL,
  "invite_token" text UNIQUE,
  "invite_accepted" boolean NOT NULL DEFAULT false,
  "invite_sent_at" timestamp with time zone DEFAULT now(),
  "invite_accepted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "team_members_user_unique" UNIQUE ("user_id")
);

CREATE INDEX IF NOT EXISTS "team_members_company_id_idx" ON "team_members"("company_id");
CREATE INDEX IF NOT EXISTS "team_members_user_id_idx" ON "team_members"("user_id");
CREATE INDEX IF NOT EXISTS "team_members_invite_token_idx" ON "team_members"("invite_token");
