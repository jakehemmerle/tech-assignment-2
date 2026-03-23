# Implementation Plan — Rewards System (Challenge A)

## Approach

Build this as a greenfield NestJS + TypeScript rewards service inside the existing repo, while treating the current Express/JS rewards API as a disposable reference implementation.

Two principles drive the plan:

1. **Backend-first, integration-tested early.**
   The risky work is rewards state, monthly reconciliation, leaderboard correctness, and admin/read contracts. We should validate those flows against real DynamoDB Local and MySQL as early as possible.

2. **Keep the write model narrow and deterministic.**
   The rewards system should be built around an immutable ledger plus a small set of read-side projections:
   - player aggregate
   - leaderboard row
   - notification record

---

## Resolved Decisions

| Question | Decision |
|----------|----------|
| Backend stack | Full NestJS + strict TypeScript migration. The current Express service is not the target architecture. |
| `/api/v1/points/award` caller | Admin-facing/internal tool only. Guard with `X-Admin-Id`, not `X-Player-Id`. |
| Canonical award input | `bigBlind` drives stake-band selection. `tableStakes` is display-only context stored in the ledger. |
| Player eligibility on award | Do not enforce dealt-cards/sitting-out eligibility in v1. Assume the caller only sends valid awards. |
| Points rounding | `Math.round(basePoints * multiplier)` to whole integers. |
| Milestones | `[500, 1_000, 2_000, 10_000]`. |
| Leaderboard ranking | Competition ranking (`1, 2, 2, 4`). Secondary ordering for ties is stable `playerId ASC`; tie-break affects ordering, not rank number. |
| Zero-point rank | `playerRank = null` when the player has no current-month leaderboard entry / zero monthly points. |
| Pagination | Use the simplest correct implementation for v1: query a player's ledger, sort/slice in memory, return exact `total`. Optimize later if needed. |
| Monthly reset trigger | Shared month-reconciliation service runs on all reads and writes. Admin can also trigger a full reset endpoint. No scheduler in v1. |
| Manual negative adjustments | Keep behavior simple: adjustments are allowed, monthly points floor at `0`, no extra correction policy work in v1. |
| Tier override semantics | Endpoint stores override metadata and sets current tier immediately. No additional expiry worker or advanced precedence rules in v1. |
| Conditional writes | Use conditional writes for notification dismissal / record existence checks. Notification creation remains simple in v1. |
| Seed data | Seed-data correctness is core work, not cleanup. |

---

## Source Of Truth

### Rewards State

Canonical rewards state lives in DynamoDB:

- `rewards-players`
- `rewards-transactions`
- `rewards-leaderboard`
- `rewards-notifications`

### Identity Data

Canonical identity data lives in MySQL `players`:

- `guid`
- `username`
- `email`

### Display Name Strategy

To avoid unnecessary duplication inside DynamoDB:

- Keep **one** rewards-side display-name projection on `rewards-players.displayName`
- Do **not** store `displayName` on `rewards-leaderboard`
- Leaderboard reads join:
  - `rewards-leaderboard` -> `rewards-players` for player-facing names
  - `rewards-leaderboard` -> MySQL `players` for admin email enrichment

This keeps the write model lean while avoiding a MySQL dependency for every player-facing read.

If a rewards player is auto-created before a MySQL row is found, fall back to `playerId` as `displayName`.

---

## Shared Services To Add First

These should exist before feature work branches out:

### `IdentityService`

Responsibilities:

- look up MySQL `players` rows by `guid`
- hydrate `displayName` from `username`
- hydrate admin responses with `email`

### `MonthReconciliationService`

Responsibilities:

- compare stored `monthKey` with current UTC month
- apply per-player reset rules when needed
- run on every read and write entry point
- expose `resetPlayer()` and `resetAllPlayers()` for the admin endpoint

This removes the current gap where a passive player can read stale last-month state until some write happens.

### `LeaderboardService`

Responsibilities:

- compute competition ranking
- batch-join leaderboard rows to player aggregates
- return `playerRank = null` for zero-point / missing entries

---

## Core Data Model

### `rewards-players`

```ts
interface PlayerEntity {
  playerId: string;
  displayName: string;              // single rewards-side name projection
  currentTier: number;              // 1-4
  monthlyPoints: number;
  lifetimePoints: number;
  tierFloor: number;
  highestTierThisMonth: number;
  monthKey: string;                 // YYYY-MM
  lastTierChangeAt?: string;
  overrideTier?: number;
  overrideExpiresAt?: string;
  overrideReason?: string;
  createdAt: string;
  updatedAt: string;
}
```

### `rewards-transactions`

```ts
interface TransactionEntity {
  playerId: string;
  timestamp: number;                // sort key
  type: 'gameplay' | 'adjustment' | 'bonus';
  basePoints: number;
  multiplier: number;
  earnedPoints: number;
  tableId?: number;
  tableStakes?: string;
  bigBlind?: number;
  handId?: string;
  monthKey: string;
  reason: string;
  adminId?: string;
  createdAt: string;
}
```

### `rewards-leaderboard`

```ts
interface LeaderboardEntryEntity {
  monthKey: string;                 // PK
  playerId: string;                 // SK
  tier: number;
  monthlyPoints: number;
}
```

### `rewards-notifications`

```ts
interface NotificationEntity {
  playerId: string;                 // PK
  notificationId: string;           // SK
  type: 'tier_upgrade' | 'tier_downgrade' | 'milestone';
  title: string;
  description: string;
  dismissed: boolean;
  createdAt: string;
  dismissedAt?: string;
}
```

---

## API Contract Decisions

### Player / Unity-facing

- `GET /api/v1/player/rewards`
- `GET /api/v1/player/rewards/history?limit=20&offset=0`
- `GET /api/v1/leaderboard?limit=10`
- `GET /api/v1/player/notifications?unread=true`
- `PATCH /api/v1/player/notifications/:id/dismiss`

### Admin-facing

- `POST /api/v1/points/award`
- `GET /admin/players/:playerId/rewards`
- `POST /admin/points/adjust`
- `GET /admin/leaderboard`
- `POST /admin/tier/override`
- `POST /admin/monthly-reset`

### Read-path rules

- `currentTier` is read from reconciled player state, not recomputed from raw monthly points in the controller
- reads always pass through month reconciliation first
- player-facing leaderboard joins display names from `rewards-players`
- admin leaderboard joins emails from MySQL

---

## Testing Strategy

We should stop treating integration coverage as late polish.

### Unit Tests

Pure functions only:

- stake-band mapping
- multiplier rounding
- tier progression
- monthly floor calculation
- leaderboard ranking

### Integration Tests

Real NestJS app + DynamoDB Local from the start.

Add MySQL-backed integration coverage as soon as identity joins exist.

Every backend epic should ship with at least one real integration test, not just mocks.

### Frontend Tests

Keep these later than backend integration, but not as optional cleanup.

Focus on:

- summary card
- leaderboard widget
- notification bell
- timeline rendering

---

## Local Validation

Before the first meaningful feature epic, local validation should support:

1. `docker compose --profile rewards up`
2. `npm test` for unit tests
3. `npm run test:e2e` for backend integration tests
4. `npm run build` for frontend

`test:e2e` should assume:

- DynamoDB Local is running
- MySQL is running
- test setup creates/cleans DynamoDB tables used by rewards

---

## Delivery Plan

## Epic 0: Bootstrap, Infra Wiring, And Shared Services

**Goal**: NestJS boots locally, test harness works, MySQL and Dynamo providers exist, and month reconciliation is available as shared infrastructure.

### Create

- `rewards-api/tsconfig.json`
- `rewards-api/tsconfig.build.json`
- `rewards-api/nest-cli.json`
- `rewards-api/handler.ts`
- `rewards-api/src/main.ts`
- `rewards-api/src/app.module.ts`
- `rewards-api/src/config/tiers.config.ts`
- `rewards-api/src/config/dynamo.config.ts`
- `rewards-api/src/config/mysql.config.ts`
- `rewards-api/src/dynamo/*`
- `rewards-api/src/mysql/*`
- `rewards-api/src/identity/*`
- `rewards-api/src/reconciliation/*`
- `rewards-api/src/health/*`
- `rewards-api/src/middleware/player-auth.middleware.ts`
- `rewards-api/src/middleware/admin-auth.middleware.ts`
- `rewards-api/test/jest-e2e.json`
- `rewards-api/test/setup-e2e.ts`
- `rewards-api/test/health.e2e-spec.ts`

### Modify

- `serverless-v2/services/rewards-api/package.json`
- `serverless-v2/services/rewards-api/serverless.offline.yml`
- `serverless-v2/services/rewards-api/serverless.yml`
- `docker-compose.yml`

### Validation

- health endpoint returns `200`
- NestJS app boots under `serverless-offline`
- MySQL provider connects using Docker env
- Dynamo test setup can create/clean rewards tables

---

## Epic 1: Core Write Flows With Early Integration Tests

**Goal**: Ship the first end-to-end business flow early:

- `POST /api/v1/points/award`
- `POST /admin/points/adjust`

Both should use real integration tests against DynamoDB Local. `award` should already be admin-authenticated.

### Create

- `src/points/points.module.ts`
- `src/points/points.service.ts`
- `src/points/points.controller.ts`
- `src/points/points-calculation.ts`
- `src/tiers/tiers.module.ts`
- `src/tiers/tiers.service.ts`
- `src/notifications/notifications.module.ts`
- `src/notifications/notifications.service.ts`
- `test/unit/points-calculation.spec.ts`
- `test/unit/tiers.spec.ts`
- `test/points-award.e2e-spec.ts`
- `test/points-adjust.e2e-spec.ts`

### Business Rules To Lock Down Here

- new player auto-creation
- display-name hydration from MySQL when possible
- admin auth on `/award`
- base-points mapping from `bigBlind`
- multiplier rounding
- immutable ledger write
- player aggregate update
- leaderboard row update
- tier-upgrade notification
- milestone notification
- month reconciliation on writes

### Integration Tests

- award to a new player creates player + transaction + leaderboard row
- missing `X-Admin-Id` on `/award` -> `401`
- missing `playerId` or `bigBlind` -> `400`
- Silver/Gold/Platinum multipliers round correctly
- adjustment updates monthly/lifetime totals
- negative adjustment floors monthly points at `0`
- award after stale `monthKey` reconciles month before writing

---

## Epic 2: Player Read Endpoints And Notifications CRUD

**Goal**: Player-facing reads are correct, reconciled, and integration-tested early.

### Create

- `src/player/player.module.ts`
- `src/player/player.controller.ts`
- `src/notifications/notifications.controller.ts`
- `test/player.e2e-spec.ts`
- `test/notifications.e2e-spec.ts`

### Read-path Requirements

- `GET /player/rewards` uses reconciled stored `currentTier`
- `GET /player/rewards/history` uses simple correct pagination
- `GET /player/notifications` supports `unread=true`
- `PATCH /player/notifications/:id/dismiss` is safe and idempotent

### Integration Tests

- player with no rewards data auto-creates as Bronze
- stale `monthKey` is reconciled on read
- history pagination returns exact `total`
- unread count changes after dismiss
- dismissing a missing notification returns the correct failure shape, not a phantom write

---

## Epic 3: Leaderboard, Identity Join, And Admin Email Enrichment

**Goal**: Leaderboard logic is correct and names/emails are joined from the right places.

### Create

- `src/leaderboard/leaderboard.module.ts`
- `src/leaderboard/leaderboard.service.ts`
- `src/leaderboard/leaderboard.controller.ts`
- `test/unit/leaderboard-ranking.spec.ts`
- `test/leaderboard.e2e-spec.ts`

### Rules To Lock Down

- competition ranking
- `playerRank = null` for zero-point players
- player-facing leaderboard names joined from `rewards-players`
- admin leaderboard emails joined from MySQL

### Integration Tests

- `[100, 80, 80, 50]` -> `[1, 2, 2, 4]`
- requesting player outside top limit still gets `playerRank`
- zero-point player gets `null`
- admin leaderboard returns `email`

---

## Epic 4: Admin Read Surfaces, Tier Override, And Monthly Reset Endpoint

**Goal**: Complete the required admin surface after the core write/read flows are already validated.

### Create

- `src/admin/admin.module.ts`
- `src/admin/admin.controller.ts`
- `src/admin/admin.service.ts`
- `test/admin.e2e-spec.ts`
- `test/unit/monthly-reset.spec.ts`
- `test/monthly-reset.e2e-spec.ts`

### Endpoints

- `GET /admin/players/:playerId/rewards`
- `POST /admin/tier/override`
- `POST /admin/monthly-reset`

### Scope Notes

- override expiry is stored, but no automatic expiry workflow is added in v1
- monthly reset endpoint is the explicit operational reset path

### Integration Tests

- admin auth required everywhere
- full admin profile returns transactions + notifications + email
- override stores metadata and changes visible tier immediately
- monthly reset applies floor protection and creates downgrade notification when needed

---

## Epic 5: Seed Data, Timeline Data, And Frontend Contract Sync

**Goal**: Seed data becomes trustworthy and the frontend stops rendering fake rewards history.

### Backend Additions

- `GET /api/v1/player/rewards/timeline`

### Seed Script Work

Rewrite `scripts/seed-rewards.js` so it produces internally consistent:

- rewards players
- ledger rows
- leaderboard rows
- notifications
- six months of timeline-friendly data

The seed script should use the same reward rules as the application code, not random disconnected totals.

### Frontend Work

- replace fake `TierTimeline` data generation with API-backed data
- ensure dashboard widgets consume the real contract

### Validation

- seeded player aggregate matches sum of seeded ledger rows by month/lifetime
- leaderboard rows match seeded player monthly points
- timeline endpoint reflects seeded history

---

## Epic 6: Documentation And Test Coverage Completion

**Goal**: Finish the submission-quality surface after the behavior is already proven.

### Deliverables

- API reference for all player/admin endpoints
- README update with setup + tradeoffs + implemented/deferred scope
- frontend component tests
- test command cleanup so local expectations are explicit

---

## Out-Of-Scope / Deferred

- `handId` idempotency
- scheduled monthly reset infrastructure
- leaderboard caching
- RTK Query migration
- advanced tier-override expiry handling
- realtime notifications

---

## What Changes From The Previous Plan

- `/award` is now explicitly admin-only
- MySQL integration moves to the front of the plan, not late admin cleanup
- month reconciliation is a shared service used on reads and writes
- leaderboard no longer duplicates `displayName` in DynamoDB
- integration tests move into the first real backend epic
- seed-data correctness moves out of cleanup and into core delivery
