# EventLink — Claude Code conventions

## apiRequest
`apiRequest(url, options?)` in `client/src/lib/queryClient.ts` already calls
`response.json()` internally and returns parsed data as `Promise<unknown>`.
**Never call `.json()` on it.** The return type is annotated `Promise<unknown>`
so TypeScript will surface this as a compile error.

## Route wiring
Every new route file **must** be imported and mounted in
`server/routes-modular.ts`. A route file that is not mounted there will silently
do nothing.

## Database migrations
Every new table or column added to `shared/schema.ts` **must** have a
corresponding Drizzle migration. Run `drizzle-kit generate` and commit the
output. Do not rely on `drizzle-kit push` in production.

## Employer query scoping
Employer routes scope data to the company via `resolveCompanyId` middleware
(`req.companyId`), **not** `req.user.id`. Always use `req.companyId ?? req.user!.id`
in employer controllers. See `server/api/middleware/team.middleware.ts`.

## tsc baseline
`.tsc-baseline` records the current TypeScript error count. The pre-commit hook
(`/.husky/pre-commit`) blocks commits that raise the count. Run `npm run check`
before marking any task done and fix new errors before committing.