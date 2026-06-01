---
name: Team invite userId nullable
description: team_members.userId must be nullable to support pending invites for non-existing users
---

The spec defines `userId` as `.notNull()` but this breaks FK constraints when inviting someone who doesn't have an EventLink account yet. The fix: remove `.notNull()` from the column so `user_id` can be NULL.

**Why:** `inviteTeamMember` stores `userId: existingUser[0]?.id ?? null` for non-existing users. `acceptTeamInvite` later updates it to the real `userId` when the invite is accepted.

**How to apply:** Any query that joins team_members → users must handle nullable userId. In team-aware storage methods, filter with `.filter((id): id is number => id !== null)` when building memberIds arrays.
