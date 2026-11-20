# Deployment notes

Things that live outside the repo but that the app depends on. Re-check them
when email starts behaving oddly or after any DNS change.

## Email DNS (checked 20 Nov 2026)

Transactional email is sent by SendGrid from `noreply@eventlink.one`
(override with `SENDGRID_FROM_EMAIL`).

| Record                             | Value found                                                                | Status                          |
| ---------------------------------- | -------------------------------------------------------------------------- | ------------------------------- |
| DKIM `s1._domainkey.eventlink.one` | CNAME → `s1.domainkey.u55325938.wl189.sendgrid.net` (RSA key resolves)     | OK                              |
| DKIM `s2._domainkey.eventlink.one` | CNAME → `s2.domainkey.u55325938.wl189.sendgrid.net` (RSA key resolves)     | OK                              |
| DMARC `_dmarc.eventlink.one`       | `v=DMARC1; p=quarantine; rua=mailto:<a mailbox at eventlink.one>; pct=100` | OK — reports go to that mailbox |
| SPF `eventlink.one`                | `v=spf1 include:secureserver.net -all`                                     | See note                        |

**SPF note.** The root SPF record authorises GoDaddy's servers only, not
SendGrid. That is normally fine: with SendGrid _domain authentication_ the
envelope sender is a SendGrid-managed subdomain (`em####.eventlink.one`) that
has its own SPF, and DMARC passes on the DKIM signature above. Confirm in
SendGrid → Settings → Sender Authentication that the domain shows
**Verified**. If it ever doesn't, DMARC is `p=quarantine`, so mail would go
to spam rather than be delivered.

To re-check from a terminal:

```bash
nslookup -type=TXT eventlink.one
nslookup -type=TXT _dmarc.eventlink.one
nslookup -type=TXT s1._domainkey.eventlink.one
```

## Railway

- Health check path: `/health` (runs `SELECT 1`; 503 if the database can't answer).
- Error reporting: `SENTRY_DSN`, and `VITE_SENTRY_DSN` available **at build time**.
- Database: Neon. Restores: `docs/restore-runbook.md`.
