# Human Clarifications

## 2026-03-22
- Backend requirement: NestJS + strict TypeScript are hard requirements.
- Points math: round earned points to the nearest whole integer using standard rounding after multiplier application.
- Manual adjustments: keep first-pass behavior simple and accept follow-up issues if edge cases appear.
- Admin identity fields: display name and email must always come from the MySQL `players` table, using `username` and `email` without changing the player schema.
- Tier timeline: derive on read instead of materializing a dedicated history projection in the first pass.
- `handId` idempotency: explicitly out of scope.
- Notifications: support tier-change notifications, dismissal, and correct unread counts in the first pass; no websocket/SSE or email/push delivery.
- Leaderboard rank: use competition ranking (`1, 2, 2, 4`), and the player's own rank must be computable and shown even when outside the visible top slice.
- Auth boundaries: keep the first pass limited to simple player and admin separation.
