---
name: RecruiterDashboard tab grid
description: Tab count is dynamic based on subscription tier; Teams adds an 11th tab
---

Current tabs (10): jobs, applications, messages, bookings, calendar, availability, crew, ir35, billing, profile

Teams tier adds tab 11: team (between ir35 and billing)

**Why:** Tailwind grid-cols requires static class names for purging. Both `md:grid-cols-10` and `md:grid-cols-11` appear as string literals in the ternary so Tailwind picks them up.

**How to apply:** 
- `const isTeamsTier = subData?.tier === "teams"`
- `className={\`grid w-full grid-cols-4 ${isTeamsTier ? "md:grid-cols-11" : "md:grid-cols-10"}\`}`
- Wrap trigger and content in `{isTeamsTier && (...)}`
- Team tab trigger and content wrapped in isTeamsTier conditional, so non-Teams accounts stay at 10 tabs.
