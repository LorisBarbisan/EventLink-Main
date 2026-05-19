#!/bin/bash
set -e
npm install
# Backfill data and add constraints once so drizzle-kit push does not prompt to truncate
npx tsx scripts/apply-idempotent-constraints.ts
npm run db:push
