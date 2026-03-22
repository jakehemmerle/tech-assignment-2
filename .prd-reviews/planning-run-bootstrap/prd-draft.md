# PRD: Poker Rewards Program v1

## Problem Statement
Hijack Poker needs a loyalty rewards system that turns gameplay into a visible progression loop for players and a controllable operational surface for staff. The system must award points from cash-game participation, promote or protect players across monthly tiers, surface a monthly leaderboard, and expose rewards data consistently to both a web dashboard and Unity-facing REST clients. The current repository only provides stubbed backend routes, placeholder frontend screens, and coarse DynamoDB seed data, so the work must define a coherent product and implementation direction before feature delivery begins.

## Goals
- Award points per eligible hand based on table stakes and the player's active tier multiplier.
- Track both monthly points for tier progression and lifetime points for long-term player display.
- Upgrade tiers immediately when thresholds are crossed and protect players from dropping more than one tier at month reset.
- Store point activity as an immutable ledger that supports history, auditability, and downstream projections.
- Expose lean, documented REST responses for player rewards, history, leaderboard, notifications, and admin operations.
- Deliver a web dashboard that shows current tier status, transaction history, a tier timeline, and leaderboard context.
- Create and manage tier-change notification records, including dismissal and unread-count behavior.
- Keep the feature runnable in the local Docker profile with DynamoDB Local and test coverage for core business rules.

## Non-Goals
- Real JWT verification or production auth infrastructure beyond the existing local header-based stub.
- Email, push, or mobile notification delivery.
- Real-time subscriptions, websockets, SSE, or live leaderboard streaming.
- Full back-office UI; admin functionality is API-only.
- Full production scheduling/infrastructure for monthly resets if a manual or locally triggered path is sufficient for the assignment.
- Broader gameplay integrations outside the rewards award endpoint and sample seeding needed for local development.
- `handId` idempotency in the first pass.

## User Stories / Scenarios
- As a player, I can open the rewards dashboard and see my current tier, monthly progress, lifetime total, and how many points remain until the next tier.
- As a player, I can review my recent point transactions with enough detail to understand why points were awarded.
- As a player, I can see the top leaderboard entries for the current month and my own rank even when I am outside the top 100.
- As a player, I receive an in-app notification when I reach a new tier or get adjusted downward during monthly reset.
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

## Open Questions
- Should monthly reset be modeled as a manual/admin-triggered flow for the assignment, or should a scheduled path also be implemented locally?
- What is the canonical award input contract for stake-band calculation: `bigBlind`, `tableStakes`, or both?
- How exactly should monthly reset compute and persist the previous-month tier floor?
- How minimal should manual adjustment semantics be in the first pass beyond credit/debit plus reason?
- Should milestone notifications remain deferred entirely in the first pass, or should a very small fixed list be added after tier-change notifications are stable?
- Should leaderboard ranking be served from a maintained projection table, a GSI-backed query, or a read-time calculation that also returns out-of-top-100 competition rank?

## Rough Approach
Build the rewards feature around a small set of domain services rather than route-level logic: points awarding, tier evaluation/reset, leaderboard projection, notification creation, and player/admin queries. Treat the immutable ledger as the source of truth for awards, then maintain player summary documents, notification records, and monthly leaderboard records as write-side projections so dashboard and Unity reads stay simple.

For the backend, treat NestJS + strict TypeScript as a hard requirement and migrate the rewards API implementation out of the current JavaScript Express stub into a typed NestJS structure that still works within the local Docker/serverless workflow. Evolve the DynamoDB model to include monthly points, lifetime points, tier floor, last tier change, month keys, notification dismissed state, and leaderboard support. Store earned points as rounded integers after multiplier application using standard whole-number rounding. Implement the player-facing endpoints (`/player/rewards`, `/player/rewards/history`, `/leaderboard`, `/player/notifications`) and admin endpoints (`/admin/players/:playerId/rewards`, `/admin/points/adjust`, `/admin/leaderboard`, `/admin/tier/override`) with documented response shapes. Keep auth boundaries simple in the first pass: self-service player endpoints and back-office admin endpoints with stubbed guard behavior. Admin-facing display name and email should come from `players.username` and `players.email`, while rewards aggregates remain in DynamoDB and no `players` schema changes are expected.

For the frontend, replace the placeholder dashboard with concrete summary, transaction, leaderboard, and notification surfaces, including a bell unread count and dismiss behavior backed by the API. Keep the login stub for local development, but introduce a thin API layer and normalized client state so web and Unity payloads share the same mental model. Derive the tier timeline on read rather than materializing a dedicated history projection in the first pass.

Testing should focus first on pure business rules: stake-to-base-point mapping, rounded multiplier application, tier progression, reset floor logic, leaderboard ranking with competition-style ties, and tier-change notification side effects. Integration coverage should at minimum exercise the award flow from request through ledger write, summary update, player-table enrichment, notification creation, dismissal, and unread-count reads. `handId` idempotency and real-time delivery stay out of scope for the first pass.

## Clarifications from Human Review

**Q: Should the backend remain in the existing Express/JavaScript skeleton, or is NestJS + strict TypeScript a hard requirement?**
A: NestJS + strict TypeScript are hard requirements.

**Q: How should multiplier-derived points be represented?**
A: Earned points should be rounded to the nearest whole integer using standard rounding.

**Q: How should manual adjustments behave in the first pass?**
A: Keep manual adjustments simple for now and accept follow-up issues as they come rather than designing a broad operational policy up front.

**Q: Where should admin-facing display name and email come from?**
A: They should always come from the `players` table, specifically `username` and `email`. No `players` schema changes are expected.

**Q: How should the 6-month timeline be produced?**
A: Derive it on read for now because that is mechanically simpler.

**Q: Is `handId` idempotency in scope?**
A: No. Leave `handId` idempotency out of scope.

**Q: What is the minimum notification scope for the first pass?**
A: Persist tier-change notifications, support dismissal, and keep unread counts correct. Do not implement websocket/SSE delivery or email/push delivery.

**Q: How should leaderboard ties and player rank work?**
A: Use competition ranking (`1, 2, 2, 4`). The player's own rank should still be computed and shown even if they are outside the top leaderboard slice, for example rank 294 when the visible board is top 100.

**Q: How should auth boundaries be handled in the first pass?**
A: Keep auth simple with separate player and admin boundaries only.
