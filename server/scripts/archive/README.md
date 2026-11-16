# Archived one-off scripts

Run-once scripts kept as a record of what was done to the production database.
None is imported by the application. Run dates were not recorded at the time;
"Added" is the date the script entered the repo, and is an upper bound on when
it could first have run.

| Script                            | Purpose                                                                                    | Added      | Run          |
| --------------------------------- | ------------------------------------------------------------------------------------------ | ---------- | ------------ |
| `migrate-ratings.ts`              | Ratings table migration                                                                    | 2026-01-21 | not recorded |
| `backfill-bookings.ts`            | Populate the employer Bookings pipeline from existing applications                         | 2026-09-23 | not recorded |
| `migrate-help-tables.ts`          | Help system tables and `users.help_mode`; later the `help_content_overrides.detail` column | 2026-09-30 | not recorded |
| `migrate-credential-columns.ts`   | Credential register columns on `freelancer_documents`                                      | 2026-10-23 | not recorded |
| `migrate-credential-reminders.ts` | `credential_reminders` table and opt-out column                                            | 2026-10-23 | not recorded |
| `credential-backfill-campaign.ts` | Email asking freelancers to add certificate expiry dates (rounds 1–2)                      | 2026-10-23 | not recorded |
| `backfill-cv-profiles.ts`         | Apply parsed CV data to sparse profiles                                                    | 2026-10-29 | not recorded |

Newer schema changes live as SQL in `migrations/`.
