# Rewards Program PRD

## Document Status

- Product: Rewards Program
- Challenge Option: A
- Status: Draft
- Last Updated: 2026-03-21
- Primary Surfaces: Player web dashboard, Unity-facing REST API, admin API, rewards processing backend

## 1. Summary

The Rewards Program is a loyalty system for Hijack Poker players. It awards points for eligible cash-game hands, promotes players through monthly tiers, gives players visibility into their progress, and enables operations staff to inspect and correct rewards data when needed.

The product has three core jobs:

1. Convert gameplay activity into points through a transparent, deterministic rules engine.
2. Turn monthly points into meaningful tier progression with retention-oriented floor protection.
3. Expose rewards state through lightweight APIs and a dashboard that helps players understand status, momentum, and recognition.

## 2. Problem Statement

Hijack Poker needs a rewards system that increases retention and repeat play without introducing opaque rules or manual operational overhead. Today, there is no defined loyalty loop tying regular gameplay to visible player progression. Players need a reason to return, and the business needs a system that can be audited, adjusted, and extended later.

The challenge is not just awarding points. The system also needs to answer:

- Why did the player earn those points?
- What tier are they currently in and why?
- What changed at monthly reset?
- Where do they rank compared with other players?
- How can operations correct mistakes without mutating history?

## 3. Goals

### Primary Goals

- Reward eligible gameplay with predictable point earnings.
- Encourage higher engagement through visible monthly tier progression.
- Give players a clear dashboard for status, history, and leaderboard position.
- Preserve an immutable ledger of points activity for trust and auditability.
- Support basic back-office workflows for investigation and manual correction.

### Success Criteria

- Players can understand their current tier, monthly points, and next-tier target at a glance.
- The backend can calculate awards and tier upgrades without manual intervention.
- Support and operations staff can inspect a full rewards profile and apply adjustments safely.
- Leaderboard reads reflect current monthly standings without requiring precomputed cache infrastructure.

## 4. Non-Goals

- Real-money redemption, store/catalog rewards, or cash conversion.
- Push delivery via email, SMS, or mobile notifications.
- Full authentication or identity platform work beyond a stubbed auth contract.
- Fraud detection, anti-abuse systems, or rate-limiting beyond basic future considerations.
- Scheduled production infrastructure such as cron, EventBridge schedules, or CI/CD rollout automation.

## 5. Users and Personas

### Player

Wants to know current tier, monthly progress, point history, leaderboard standing, and recent rewards-related notifications.

### Unity Mobile Client

Needs stable, low-noise REST payloads that summarize rewards state and support notification/history retrieval.

### Operations / Admin

Needs read access to a player’s full rewards profile plus the ability to manually adjust points and temporarily override tier state.

## 6. User Value Proposition

- Players get visible recognition for consistent play.
- Higher tiers create short-term goals within each month.
- Floor protection reduces the frustration of hard monthly resets.
- Notifications make milestones and tier changes feel acknowledged rather than silent.

## 7. Scope

### In Scope

- Cash-game point awards per eligible hand.
- Monthly tier progression and monthly reset behavior.
- Player rewards summary, history, timeline, leaderboard, and notifications.
- Admin inspection, manual points adjustment, and tier override.
- Unity-facing REST endpoints for rewards and notifications.

### Out of Scope

- Tournament rewards logic outside manual adjustments or future expansion.
- Real-time push delivery.
- Redemption systems.
- Cross-product loyalty unification.

## 8. Core Experience

### Player Journey

1. A player is dealt into an eligible cash-game hand.
2. The game processor calls the rewards award endpoint.
3. The backend calculates base points from stakes and applies the player’s current tier multiplier.
4. The ledger stores the transaction immutably.
5. The player’s monthly and lifetime totals update.
6. If a tier threshold is crossed, the player upgrades immediately and receives a notification.
7. When the player opens the dashboard or mobile app, they can see current progress, history, leaderboard position, and notifications.

### Monthly Lifecycle

1. Monthly point totals are tracked on UTC calendar months.
2. At 00:00 UTC on the first of the month, the system resets the monthly race.
3. The highest tier achieved in the previous month establishes a floor such that the player cannot drop by more than one tier.
4. Downgrade notifications are generated when the reset changes the active tier downward.

## 9. Business Rules

### 9.1 Tiers

| Tier | Level | Monthly Threshold | Multiplier |
|------|-------|-------------------|------------|
| Bronze | 1 | 0 | 1.0x |
| Silver | 2 | 500 | 1.25x |
| Gold | 3 | 2,000 | 1.5x |
| Platinum | 4 | 10,000 | 2.0x |

Rules:

- All players start at Bronze.
- Tier upgrades happen immediately when the player reaches a threshold.
- Tier state resets monthly at 00:00 UTC on the first day of the month.
- Reset protection is based on the highest tier reached in the prior month.
- A player can fall by at most one tier during reset.

### 9.2 Points Awards

| Big Blind | Base Points Per Eligible Hand |
|-----------|-------------------------------|
| 0.10 to 0.25 | 1 |
| 0.50 to 1.00 | 2 |
| 2.00 to 5.00 | 5 |
| 10.00+ | 10 |

Rules:

- Points are awarded only when the player was dealt cards.
- Earned points = base points × current tier multiplier.
- Monthly points drive tier progression.
- Lifetime points exist for player display and long-term recognition.
- Transactions are append-only and never overwritten in place.

### 9.3 Notifications

Notification records are created for:

- Tier upgrades
- Tier downgrades caused by monthly reset
- Milestone achievements

Initial milestone set:

- 500 lifetime points
- 1,000 lifetime points
- 2,500 lifetime points
- 5,000 lifetime points
- 10,000 lifetime points

### 9.4 Leaderboard

- The leaderboard ranks players by current-month points.
- Top 100 must be retrievable.
- The player must also be able to see their own rank even if they are outside the top 100.
- The dashboard widget shows Top 10 plus the current player’s position.

## 10. Functional Requirements

### FR-1: Tier System

The system must maintain current tier, tier progression, and monthly reset behavior according to the tier table and reset rules above.

### FR-2: Points Engine

The system must expose an award endpoint that accepts gameplay events, calculates base points from table stakes, applies multipliers, writes an immutable transaction, updates player aggregates, and checks for tier advancement.

### FR-3: Leaderboard

The system must return monthly leaderboard standings with rank, display name, tier, and monthly points. A player-specific rank must be returned even when outside the visible top slice.

### FR-4: Player Dashboard

The web dashboard must display:

- Current tier and badge
- Monthly points
- Points to next tier
- Progress bar
- Recent points history
- Last six months of tier progression
- Leaderboard widget with Top 10 and the player’s rank
- Notification bell with unread count

### FR-5: Notifications

Notifications must be persisted, retrievable, dismissible, and filterable by unread state.

### FR-6: Admin Operations

The admin surface must allow:

- Viewing a full player rewards profile
- Crediting or debiting points with a reason
- Reading the leaderboard with admin-specific fields
- Applying a manual tier override with expiry

## 11. API Requirements

### 11.1 Player / Unity-Facing Endpoints

#### `GET /api/v1/player/rewards`

Returns:

- player ID
- current tier
- monthly points
- lifetime points
- next tier target
- points remaining to next tier
- unread notification count
- recent timeline summary

#### `GET /api/v1/player/rewards/history?limit=20&offset=0`

Returns paginated ledger entries with:

- timestamp
- transaction type
- table ID
- table stakes
- base points
- multiplier
- earned points
- reason

#### `GET /api/v1/leaderboard?limit=10`

Returns:

- top N entries
- current month key
- requesting player’s own rank block

#### `GET /api/v1/player/notifications?unread=true`

Returns notifications with dismissed state and timestamps.

#### `PATCH /api/v1/player/notifications/:id/dismiss`

Marks a notification as dismissed.

### 11.2 Internal Endpoint

#### `POST /api/v1/points/award`

Expected request:

```json
{
  "playerId": "abc-123",
  "tableId": 456,
  "tableStakes": "2/5",
  "bigBlind": 5,
  "handId": "hand-789"
}
```

Expected behavior:

- Validate the request shape.
- Determine base points from `bigBlind`.
- Apply the current multiplier.
- Create the ledger row.
- Update player totals.
- Trigger tier progression and notifications if thresholds are crossed.

### 11.3 Admin Endpoints

#### `GET /admin/players/:playerId/rewards`

Returns a full rewards profile including:

- player identity fields
- current and historical tier context
- monthly and lifetime points
- recent transactions
- notifications
- active overrides

#### `POST /admin/points/adjust`

Allows manual positive or negative adjustments with a required reason and audit timestamp.

#### `GET /admin/leaderboard`

Returns leaderboard data with additional fields such as player ID and email when available.

#### `POST /admin/tier/override`

Allows setting a temporary tier override with expiry metadata.

## 12. UX Requirements

### Dashboard Information Hierarchy

The player should see, in order:

1. Current status and progress
2. Reasons for recent changes
3. Social proof via leaderboard position
4. Historical context via transactions and tier timeline

### Key UI Components

- Summary card
- Tier badge and progress bar
- Transactions table
- Tier timeline
- Leaderboard widget
- Notification bell and flyout

### UX Principles

- Show progress, not just totals.
- Make tier movement explicit.
- Keep mobile/API payloads lean even if the web dashboard aggregates more detail.
- Avoid hiding calculations that affect trust.

## 13. Data Requirements

### 13.1 Players Table

Stores the player’s current rewards aggregate state, including current tier, monthly points, lifetime points, floor protection, and audit timestamps.

### 13.2 Transactions Table

Stores immutable ledger entries per player, ordered by timestamp.

### 13.3 Leaderboard Table

Stores month-scoped leaderboard materialization keyed by `monthKey` and `playerId`.

### 13.4 Notifications Table

Stores player notifications with dismissed state.

### Recommended Additional Fields

- `monthKey` on aggregates for reset detection
- `highestTierAchievedThisMonth`
- `lastProcessedAt`
- `overrideExpiresAt`
- `timeline` or enough data to build the last-six-month tier history

## 14. Operational Requirements

- The system must run locally with Docker Compose and DynamoDB Local.
- Core flows must be testable through simple HTTP calls and seed data.
- The local setup script must create all required rewards tables.
- The seed script must generate realistic sample players, points history, and leaderboard data for dashboard testing.

## 15. Analytics and Observability

Recommended metrics:

- Points awarded per day
- Tier upgrades per day
- Monthly active rewards participants
- Leaderboard reads
- Notification creation volume
- Manual adjustment count and net points adjusted

Recommended logs:

- award request received
- award calculated
- player aggregate updated
- tier changed
- monthly reset applied
- admin adjustment created

## 16. Risks and Edge Cases

- Monthly reset timing errors around UTC boundaries
- Duplicate award events for the same hand
- Negative adjustments causing confusing player state
- Missing player records on first activity
- Leaderboard accuracy if materialized records and player aggregates diverge
- Tier override behavior overlapping with reset logic

## 17. Open Questions

- Should `handId` be treated as an idempotency key for points awards?
- Should manual negative adjustments be allowed to reduce monthly points below zero?
- Should leaderboard rank tie-break by earliest achievement time, player ID, or display name?
- Should milestone notifications be based on lifetime points only, or on both lifetime and monthly milestones?
- What player identity fields are guaranteed to be available for admin leaderboard responses?

## 18. Acceptance Criteria

The PRD is satisfied when:

- Rewards rules are unambiguous enough for implementation without major product guesswork.
- Every required surface has a defined purpose and payload shape.
- Monthly reset and tier-floor behavior are explicitly described.
- Admin workflows are defined clearly enough for back-office support use.
- Edge cases and open questions are documented rather than left implicit.

## 19. Future Enhancements

- Idempotent award processing keyed by `handId`
- Real-time notifications via WebSocket or SSE
- Cached leaderboard reads
- Scheduled monthly reset automation
- Rewards redemption catalog
- Segmented milestone programs by game type or VIP cohort
