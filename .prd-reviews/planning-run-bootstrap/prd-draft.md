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
- Create notification records for tier changes and milestone achievements, with unread and dismiss flows.
- Keep the feature runnable in the local Docker profile with DynamoDB Local and test coverage for core business rules.

## Non-Goals
- Real JWT verification or production auth infrastructure beyond the existing local header-based stub.
- Email, push, or mobile notification delivery; only notification persistence and retrieval are required.
- Real-time subscriptions, websockets, or live leaderboard streaming.
- Full back-office UI; admin functionality is API-only.
- Full production scheduling/infrastructure for monthly resets if a manual or locally triggered path is sufficient for the assignment.
- Broader gameplay integrations outside the rewards award endpoint and sample seeding needed for local development.

## User Stories / Scenarios
- As a player, I can open the rewards dashboard and see my current tier, monthly progress, lifetime total, and how many points remain until the next tier.
- As a player, I can review my recent point transactions with enough detail to understand why points were awarded.
- As a player, I can see the top leaderboard entries for the current month and my own rank even when I am outside the top 100.
- As a player, I receive an in-app notification when I reach a new tier, cross a milestone, or get adjusted downward during monthly reset.
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
- Should the implementation honor the challenge's requested NestJS + strict TypeScript stack by replacing the current Express/JavaScript service, or should it deliver equivalent behavior within the existing skeleton to stay scope-safe?
- Should monthly reset be modeled as a manual/admin-triggered flow for the assignment, or should a scheduled path also be implemented locally?
- What exact milestone thresholds should count as milestone notifications beyond the examples of 500 and 1000 points?
- Should `handId` be treated as an idempotency key for the award endpoint now, given it is listed as a bonus requirement but materially reduces duplicate awards?
- Where should admin-only player metadata such as email/display name come from in local development, given player records also exist in MySQL seed data while rewards data lives in DynamoDB?
- How much historical tier data should be materialized versus derived on read for the 6-month timeline?
- Should leaderboard ranking be served from a maintained projection table, a GSI-backed query, or a read-time calculation that also returns out-of-top-100 rank?

## Rough Approach
Build the rewards feature around a small set of domain services rather than route-level logic: points awarding, tier evaluation/reset, leaderboard projection, notification creation, and player/admin queries. Treat the immutable ledger as the source of truth for awards, then maintain player summary documents and monthly leaderboard records as write-side projections so dashboard and Unity reads stay simple.

For the backend, add validated request contracts and explicit service modules around the existing rewards API entrypoint, whether that remains Express or is upgraded to Nest-compatible structure. Evolve the DynamoDB model to include monthly points, lifetime points, tier floor, last tier change, month keys, leaderboard sort support, and notification dismissal state. Implement the player-facing endpoints (`/player/rewards`, `/player/rewards/history`, `/leaderboard`, `/player/notifications`, dismiss) and admin endpoints (`/admin/players/:playerId/rewards`, `/admin/points/adjust`, `/admin/leaderboard`, `/admin/tier/override`) with documented response shapes.

For the frontend, replace the placeholder dashboard with four concrete panels: summary/progress, recent transactions, tier timeline, and leaderboard/notifications. Keep the login stub for local development, but introduce a thin API layer and normalized client state so web and Unity payloads share the same mental model.

Testing should focus first on pure business rules: stake-to-base-point mapping, multiplier application, tier progression, reset floor logic, milestone detection, idempotency behavior if adopted, and leaderboard ranking. Integration coverage should at minimum exercise the award flow from request through ledger write, summary update, and notification side effects.
