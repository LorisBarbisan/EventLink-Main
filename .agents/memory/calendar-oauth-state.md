---
name: Calendar OAuth state pattern
description: How employerId is threaded through Google/Outlook OAuth redirects without relying on passport session.
---

The app uses JWT auth stored in localStorage, so `req.session.passport.user` is NOT reliably set for email/password users. To thread `employerId` through the OAuth redirect/callback flow for calendar connections:

- On the `/connect` endpoint (authenticated via JWT, so `req.user.id` is available): encode `{uid: employerId, ts: Date.now()}` as a base64url JSON string and pass it as the OAuth `state` parameter.
- On the `/callback` endpoint (public, no auth header): decode the `state` param and verify `ts` is within 10 minutes to prevent replay.

**Why:** The employer is authenticated via `Authorization: Bearer <jwt>` header, but the OAuth callback is a browser redirect with no custom headers — so the JWT is unavailable. Encoding employer ID in the `state` param is the standard OAuth 2.0 pattern for this.

**How to apply:** Any new OAuth provider (e.g. a future Teams calendar) should follow the same `makeStateToken` / `parseStateToken` helpers in `server/api/controllers/calendar.controller.ts`.
