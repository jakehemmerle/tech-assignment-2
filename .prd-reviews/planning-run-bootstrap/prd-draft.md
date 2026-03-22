# PRD: Poker Rewards Program v1

## Problem Statement
Hijack Poker needs a loyalty rewards system that turns gameplay into a visible progression loop for players and a controllable operational surface for staff. The system must award points from cash-game participation, promote or protect players across monthly tiers, surface a monthly leaderboard, and expose rewards data consistently to both a web dashboard and Unity-facing REST clients. The current repository only provides stubbed backend routes, placeholder frontend screens, and coarse DynamoDB seed data, so the work must define a coherent product and implementation direction before feature delivery begins.

## Goals
- Award points per eligible hand based on `tableStakes` stake bands and the player's active tier multiplier.
- Track both monthly points for tier progression and lifetime points for long-term player display.
- Upgrade tiers immediately when thresholds are crossed and protect players from dropping more than one tier at month reset.
- Store point activity as an immutable ledger that supports history, auditability, and downstream projections.
- Expose lean, documented REST responses for player rewards, history, leaderboard, notifications, and admin operations.
- Deliver a web dashboard that shows current tier status, transaction history, a tier timeline, and leaderboard context.
- Create and manage tier-change and milestone notification records, including dismissal and unread-count behavior.
- Keep the feature runnable in the local Docker profile with DynamoDB Local and test coverage for core business rules.

## Non-Goals
- Real JWT verification or production auth infrastructure beyond the existing local header-based stub.
- Email, push, or mobile notification delivery.
- Real-time subscriptions, websockets, SSE, or live leaderboard streaming.
- Full back-office UI; admin functionality is API-only.
- Automated scheduling/infrastructure for monthly resets in the first pass; a manual/admin-triggered reset path is sufficient.
- Broader gameplay integrations outside the rewards award endpoint and sample seeding needed for local development.
- `handId` idempotency in the first pass.

## User Stories / Scenarios
- As a player, I can open the rewards dashboard and see my current tier, monthly progress, lifetime total, and how many points remain until the next tier.
- As a player, I can review my recent point transactions with enough detail to understand why points were awarded.
- As a player, I can see the top leaderboard entries for the current month and my own rank even when I am outside the top 100.
- As a player, I receive an in-app notification when I reach a new tier, get adjusted downward during monthly reset, or hit a defined milestone.
- As a player, I can dismiss notifications and see an unread count that stays accurate as notifications are created and dismissed.
- As a player using a Unity client, I can fetch the same rewards state, history, leaderboard, and notifications through stable REST payloads.
- As the game processor, I can call a single point-award endpoint with hand context and rely on the rewards service to calculate base points, multiplier, tier advancement, and ledger writes.
- As an admin, I can inspect a player's rewards profile, manually adjust points with a reason, review the leaderboard with operational identifiers, and apply temporary tier overrides.
- As an operator, I can seed local data and run tests without external AWS services.

## Constraints
- The core product requirements come from `README.md`, `docs/README.md`, `docs/local-development.md`, and `docs/challenge-rewards.md`.
- The current repo does not actually contain a NestJS/TypeScript backend; it contains a JavaScript Express app mounted through `serverless-http` with stub routes under `serverless-v2/services/rewards-api/`.
- The current frontend is a React + Vite + MUI placeholder with a simple login stub and no rewards-specific data layer.
- Local infrastructure already provisions four DynamoDB tables for rewards: `rewards-players`, `rewards-transactions`, `rewards-leaderboard`, and `rewards-notifications`.
- Existing rewards seed data uses a simplified schema (`points`, `tier`, `totalEarned`, `balanceAfter`) that does not yet match the challenge's monthly/lifetime/timeline/notification needs.
- Local auth currently relies on `X-Player-Id`, and CORS/middleware are already wired for that path.
- The challenge explicitly requires tests on points logic and tier progression, plus local execution through Docker Compose.
- The acceptance criteria require monthly tier resets, immutable transactions, notifications, player endpoints, and admin endpoints even though most of those surfaces do not exist yet in code.

## Rough Approach
Build the rewards feature around a small set of domain services rather than route-level logic: points awarding, tier evaluation/reset, leaderboard reads, notification creation, and player/admin queries. Treat the immutable ledger as the source of truth for awards, then maintain player summary documents and notification records as projections that can be recomputed deterministically when needed so dashboard and Unity reads stay simple without hiding state drift.

For the backend, treat NestJS + strict TypeScript as a hard requirement and migrate the rewards API implementation out of the current JavaScript Express stub into a typed NestJS structure that still works within the local Docker/serverless workflow. Use `tableStakes` as the canonical award input for FR-2 stake-band calculation; if `bigBlind` is accepted on the request for compatibility, it should not be the source of truth for band selection. Evolve the DynamoDB model to include monthly points, lifetime points, previous-month highest tier, current reset floor, last tier change, month keys, and notification dismissed state. Store earned points as rounded integers after multiplier application using standard whole-number rounding. Use fixed monthly milestone thresholds of `500`, `1000`, `2000`, and `10000`, and allow those milestones to overlap literally with tier-threshold notifications rather than deduplicating them. Compute leaderboard rank on read from current monthly state rather than maintaining a pre-ranked leaderboard projection, while still returning both the visible top slice and the player's own out-of-slice competition rank. Implement the player-facing endpoints (`/player/rewards`, `/player/rewards/history`, `/leaderboard`, `/player/notifications`) and admin endpoints (`/admin/players/:playerId/rewards`, `/admin/points/adjust`, `/admin/leaderboard`, `/admin/tier/override`) with documented response shapes. Keep auth boundaries simple in the first pass: self-service player endpoints and back-office admin endpoints with stubbed guard behavior. Admin-facing display name and email should come from `players.username` and `players.email`, while rewards aggregates remain in DynamoDB and no `players` schema changes are expected.

For the frontend, replace the placeholder dashboard with concrete summary, transaction, leaderboard, and notification surfaces, including milestone and tier-change notifications, a bell unread count, and dismiss behavior backed by the API. Keep the login stub for local development, but introduce a thin API layer and normalized client state so web and Unity payloads share the same mental model. Derive the tier timeline on read rather than materializing a dedicated history projection in the first pass.

Testing should focus first on pure business rules: `tableStakes`-to-base-point mapping, rounded multiplier application, tier progression, reset floor logic, leaderboard ranking with competition-style ties, and tier-change/milestone notification side effects, including literal overlap at shared thresholds. Integration coverage should at minimum exercise the award flow from request through ledger write, summary recomputation, player-table enrichment, notification creation, dismissal, and unread-count reads. Manual adjustments should be tested as immediate inputs to all derived totals and ranks, favoring deterministic recompute behavior over incremental relative updates. `handId` idempotency and real-time delivery stay out of scope for the first pass.

## Clarifications from Human Review

**Q: Should the backend remain in the existing Express/JavaScript skeleton, or is NestJS + strict TypeScript a hard requirement?**
A: NestJS + strict TypeScript are hard requirements.

**Q: How should multiplier-derived points be represented?**
A: Earned points should be rounded to the nearest whole integer using standard rounding.

**Q: How should manual adjustments behave in the first pass?**
A: Keep manual adjustments simple, but make them immediate inputs to all derived rewards state. Prefer deterministic recompute behavior over incremental relative updates so monthly totals, lifetime totals, tier state, and leaderboard position stay in sync.

**Q: How should monthly reset run in the first pass?**
A: Monthly reset should be manual/admin-triggered in the first pass rather than scheduled infrastructure.

**Q: What is the canonical award input for stake-band calculation?**
A: Use `tableStakes` as the source of truth, consistent with FR-2. `bigBlind` should not drive band selection.

**Q: Where should admin-facing display name and email come from?**
A: They should always come from the `players` table, specifically `username` and `email`. No `players` schema changes are expected.

**Q: How should the 6-month timeline be produced?**
A: Derive it on read for now because that is mechanically simpler.

**Q: Is `handId` idempotency in scope?**
A: No. Leave `handId` idempotency out of scope.

**Q: What is the minimum notification scope for the first pass?**
A: Persist both tier-change and milestone notifications, support dismissal, and keep unread counts correct. Use fixed monthly milestone thresholds of `500`, `1000`, `2000`, and `10000`, and allow literal overlap with tier-threshold notifications. Do not implement websocket/SSE delivery or email/push delivery.

**Q: How should leaderboard ties and player rank work?**
A: Use competition ranking (`1, 2, 2, 4`). The player's own rank should still be computed and shown even if they are outside the top leaderboard slice, for example rank 294 when the visible board is top 100.

**Q: How should leaderboard rank be stored and served?**
A: Compute it on read from current monthly state rather than maintaining a pre-ranked projection.

**Q: How should auth boundaries be handled in the first pass?**
A: Keep auth simple with separate player and admin boundaries only.
