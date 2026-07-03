# Railway Deployment Setup

## Environment Variables (set in Railway dashboard for each environment)

### Required — App

| Variable         | Production value                  | Staging value                      |
| ---------------- | --------------------------------- | ---------------------------------- |
| `NODE_ENV`       | `production`                      | `production`                       |
| `PORT`           | (Railway sets this automatically) | (Railway sets this automatically)  |
| `FRONTEND_URL`   | `https://app.eventlink.one`       | `https://<staging>.up.railway.app` |
| `SESSION_SECRET` | (long random string)              | (different random string)          |

### Required — Database

| Variable       | Notes                                                             |
| -------------- | ----------------------------------------------------------------- |
| `DATABASE_URL` | Railway injects this automatically when you add a Postgres plugin |

### Required — Email

| Variable           | Notes                   |
| ------------------ | ----------------------- |
| `SENDGRID_API_KEY` | From SendGrid dashboard |

### Required — Google OAuth

| Variable               | Notes                     |
| ---------------------- | ------------------------- |
| `GOOGLE_CLIENT_ID`     | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |

### Required — File Storage

| Variable           | Notes                       |
| ------------------ | --------------------------- |
| `GCS_BUCKET_NAME`  | Google Cloud Storage bucket |
| `GCS_PROJECT_ID`   | Google Cloud project ID     |
| `GCS_CLIENT_EMAIL` | Service account email       |
| `GCS_PRIVATE_KEY`  | Service account private key |

### Required — External Job Aggregation

| Variable         | Notes                                                |
| ---------------- | ---------------------------------------------------- |
| `REED_API_KEY`   | From reed.co.uk/developers. Used as HTTP Basic Auth. |
| `ADZUNA_API_KEY` | Adzuna "App Key" from developer.adzuna.com           |
| `ADZUNA_APP_ID`  | Adzuna "App ID" from developer.adzuna.com            |

Missing any of these disables that source only — `POST /api/jobs/sync-external` still runs with whichever sources are configured (see `server/api/utils/jobAggregator.ts`).

### Optional

| Variable         | Notes                   |
| ---------------- | ----------------------- |
| `OPENAI_API_KEY` | If AI features are used |

---

## Database Migration (one-time, from Replit to Railway)

```bash
# 1. Export from Replit Postgres
pg_dump "$REPLIT_DATABASE_URL" --no-owner --no-acl -F c -f eventlink_backup.dump

# 2. Import into Railway Postgres
pg_restore --no-owner --no-acl -d "$RAILWAY_DATABASE_URL" eventlink_backup.dump

# 3. Run schema migration
npm run db:push
```

---

## Branch → Environment mapping

| Railway environment | GitHub branch | Auto-deploys on push? |
| ------------------- | ------------- | --------------------- |
| Production          | `main`        | Yes                   |
| Staging             | `Card`        | Yes                   |
