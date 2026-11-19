# Restoring the database

For the bad day. Read it top to bottom before touching anything.

The database is **Neon** (Postgres). The app runs on **Railway** and reads its
database from the `DATABASE_URL` variable. Neon restores by creating a **new
branch** at a point in time; nothing is overwritten until you switch
Railway's `DATABASE_URL` to it.

> **Status:** not yet rehearsed. Fill in the "Rehearsal log" at the bottom
> the first time you do it, including how long each step took.

---

## 0. Before anything: stop the damage

- If a job or deploy is actively destroying data, **stop it first**: in Railway,
  roll the service back to the last good deployment (Deployments → ⋯ →
  Rollback), or pause the service.
- Write down the **time the damage started** as precisely as you can, in UTC.
  The restore point must be _before_ it. Sentry and the Railway logs help:
  destructive jobs log what they are about to delete (`undo-sweep`,
  `books-usage prune`, `reports prune`) with counts and date ranges.

## 1. Check how far back you can go

Neon console → your project → **Settings → Storage / History retention**.
The restore point must be inside that window.

- Retention on this project: **\_\_\_\_ days** (fill in).
- If the damage is older than the window, PITR cannot help — go to section 6.

## 2. Create a branch at the restore point

Neon console → **Branches → Create branch**:

- Parent: `main` (production)
- **Include data up to:** a specific time → the restore point from step 0
  (a few minutes before the damage)
- Name: `restore-YYYY-MM-DD-HHMM`

Copy the new branch's **connection string** (pooled).

## 3. Check it before using it

From a local checkout:

```bash
DATABASE_URL="<restore branch connection string>" npm run dev
```

- The app boots and the startup log shows
  `ensureAdditiveSchema: N/N additive statements ensured`.
- Sign in, open Books, check the records you were worried about are there.
- Spot-check a few counts against the deletion log (Sentry / Railway logs).

## 4. Cut over

In Railway → the service → **Variables**:

1. Note the current `DATABASE_URL` somewhere safe (you may need it to recover
   anything written _after_ the restore point).
2. Set `DATABASE_URL` to the restore branch's connection string.
3. Railway redeploys. Check `/health` returns `{"status":"ok"}`.

**Anything written between the restore point and now is not on the restored
branch.** Use the old database (still intact on its own branch) to copy across
any rows that matter.

## 5. Afterwards

- Keep the old branch until you are sure nothing else is needed from it, then
  delete it.
- Optionally promote the restore branch to be the primary branch in Neon.
- Write down what happened and why.

## 6. If PITR can't help

- Exports: freelancers can download their own workbook; Stripe holds billing
  records; object storage holds uploaded files.
- Talk to Neon support — they may have backups beyond the visible window on
  some plans.

---

## Rehearsal log

Do this once, on a quiet day, against yesterday's data. Delete the branch
afterwards.

| Date | Restore point | Branch created in | App booted in | Data checked | Total | Notes |
| ---- | ------------- | ----------------- | ------------- | ------------ | ----- | ----- |
|      |               |                   |               |              |       |       |
