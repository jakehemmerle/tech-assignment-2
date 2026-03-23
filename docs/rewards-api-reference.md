# Rewards API Reference

This document describes the implemented rewards endpoints for Challenge A. Player-facing routes live under `/api/v1`, and admin routes live under `/admin`.

## Auth Headers

| Surface | Header | Notes |
|---------|--------|-------|
| Player endpoints | `X-Player-Id` | Required on `/api/v1/player/*` and `/api/v1/leaderboard` |
| Admin endpoints | `X-Admin-Id` | Required on `/api/v1/points/award` and all `/admin/*` routes |

If the required header is missing, the API returns `401 Unauthorized`.

## Player Endpoints

### `GET /api/v1/player/rewards`

Returns the reconciled current-month rewards snapshot for the requesting player. A missing player record is auto-created as Bronze.

Response:

```json
{
  "playerId": "p1-uuid-0001",
  "displayName": "Alice",
  "currentTier": "Silver",
  "tierLevel": 2,
  "multiplier": 1.25,
  "monthlyPoints": 525,
  "lifetimePoints": 1480,
  "nextTierTarget": 2000,
  "pointsToNextTier": 1475,
  "unreadNotifications": 2,
  "recentTimeline": [
    {
      "timestamp": 1742601000000000,
      "type": "gameplay",
      "earnedPoints": 5,
      "reason": "Hand played"
    }
  ]
}
```

### `GET /api/v1/player/rewards/history?limit=20&offset=0`

Returns exact-count paginated ledger history for the requesting player.

Query params:

| Name | Type | Default |
|------|------|---------|
| `limit` | number | `20` |
| `offset` | number | `0` |

Response:

```json
{
  "transactions": [
    {
      "timestamp": 1742601000000000,
      "type": "gameplay",
      "tableId": 1,
      "tableStakes": "1/2",
      "basePoints": 5,
      "multiplier": 1.25,
      "earnedPoints": 6,
      "reason": "Hand played",
      "createdAt": "2026-03-22T12:00:00.000Z"
    }
  ],
  "total": 37,
  "limit": 20,
  "offset": 0
}
```

### `GET /api/v1/player/rewards/timeline`

Returns the last six months of tier progression derived from current state plus historical transactions.

Response:

```json
{
  "months": [
    {
      "monthKey": "2025-10",
      "tier": "Bronze",
      "tierLevel": 1,
      "monthlyPoints": 120,
      "isCurrentMonth": false
    },
    {
      "monthKey": "2026-03",
      "tier": "Gold",
      "tierLevel": 3,
      "monthlyPoints": 2750,
      "isCurrentMonth": true
    }
  ]
}
```

### `GET /api/v1/leaderboard?limit=10`

Returns the current-month leaderboard plus the requesting player's own competition rank when they have a positive monthly score.

Response:

```json
{
  "monthKey": "2026-03",
  "leaderboard": [
    {
      "rank": 1,
      "playerId": "p5-uuid-0005",
      "displayName": "Eve",
      "tier": "Platinum",
      "monthlyPoints": 10850
    }
  ],
  "playerRank": {
    "rank": 14,
    "playerId": "p1-uuid-0001",
    "displayName": "Alice",
    "tier": "Silver",
    "monthlyPoints": 525
  }
}
```

`playerRank` is `null` when the requesting player has no current-month leaderboard row.

### `GET /api/v1/player/notifications?unread=true`

Returns notifications for the requesting player. Set `unread=true` to filter out dismissed notifications.

Response:

```json
{
  "notifications": [
    {
      "notificationId": "1742601000000-ab12cd",
      "type": "milestone",
      "title": "Milestone: 500 Points",
      "description": "You've earned 500 lifetime points!",
      "dismissed": false,
      "createdAt": "2026-03-22T12:00:00.000Z",
      "dismissedAt": null
    }
  ],
  "total": 1
}
```

### `PATCH /api/v1/player/notifications/:id/dismiss`

Dismisses a notification for the requesting player. The operation is safe to repeat for a valid notification id.

Success response:

```json
{
  "success": true
}
```

Error responses:

| Status | When |
|--------|------|
| `401` | Missing `X-Player-Id` |
| `404` | Notification id does not exist for that player |

## Admin Endpoints

### `POST /api/v1/points/award`

Awards gameplay points using the player's current tier multiplier. `bigBlind` is the canonical stake-band input; `tableStakes` is stored for display only.

Request body:

```json
{
  "playerId": "p1-uuid-0001",
  "bigBlind": 2,
  "tableId": 1,
  "tableStakes": "1/2",
  "handId": "local-hand-1"
}
```

Response:

```json
{
  "playerId": "p1-uuid-0001",
  "earnedPoints": 5,
  "basePoints": 5,
  "multiplier": 1,
  "monthlyPoints": 5,
  "lifetimePoints": 5,
  "currentTier": "Bronze",
  "nextTierTarget": 500,
  "pointsToNextTier": 495,
  "transaction": {
    "playerId": "p1-uuid-0001",
    "timestamp": 1742601000000000,
    "type": "gameplay",
    "basePoints": 5,
    "multiplier": 1,
    "earnedPoints": 5,
    "tableId": 1,
    "tableStakes": "1/2",
    "bigBlind": 2,
    "handId": "local-hand-1",
    "monthKey": "2026-03",
    "reason": "Hand played",
    "adminId": "admin-1",
    "createdAt": "2026-03-22T12:00:00.000Z"
  }
}
```

Validation errors:

| Status | When |
|--------|------|
| `400` | Missing or invalid `playerId` / `bigBlind` |
| `401` | Missing `X-Admin-Id` |

### `POST /admin/points/adjust`

Creates an immutable manual adjustment and immediately recomputes monthly/lifetime totals and tier state.

Request body:

```json
{
  "playerId": "p1-uuid-0001",
  "points": -50,
  "reason": "Support correction"
}
```

Response:

```json
{
  "playerId": "p1-uuid-0001",
  "adjustedPoints": -50,
  "monthlyPoints": 475,
  "lifetimePoints": 1430,
  "currentTier": "Bronze"
}
```

### `GET /admin/players/:playerId/rewards`

Returns the full operational rewards profile for a player, including MySQL email enrichment, all transactions, recent transactions, notifications, and override metadata.

Key response fields:

```json
{
  "playerId": "p1-uuid-0001",
  "displayName": "Alice",
  "currentTier": "Silver",
  "tierLevel": 2,
  "multiplier": 1.25,
  "monthlyPoints": 525,
  "lifetimePoints": 1480,
  "tierFloor": 1,
  "highestTierThisMonth": 2,
  "monthKey": "2026-03",
  "email": "alice@example.com",
  "nextTierTarget": 2000,
  "pointsToNextTier": 1475,
  "transactions": [],
  "recentTransactions": [],
  "notifications": [],
  "overrideTier": null,
  "overrideExpiresAt": null,
  "overrideReason": null
}
```

### `GET /admin/leaderboard`

Returns the full current-month leaderboard with MySQL email enrichment.

Response:

```json
{
  "monthKey": "2026-03",
  "leaderboard": [
    {
      "rank": 1,
      "playerId": "p5-uuid-0005",
      "displayName": "Eve",
      "tier": "Platinum",
      "tierLevel": 4,
      "monthlyPoints": 10850,
      "email": "eve@example.com"
    }
  ]
}
```

### `POST /admin/tier/override`

Stores override metadata and changes the visible tier immediately.

Request body:

```json
{
  "playerId": "p4-uuid-0004",
  "tierLevel": 4,
  "expiresAt": "2026-04-01T00:00:00.000Z",
  "reason": "VIP comp"
}
```

Response:

```json
{
  "playerId": "p4-uuid-0004",
  "overrideTier": "Platinum",
  "overrideTierLevel": 4,
  "expiresAt": "2026-04-01T00:00:00.000Z"
}
```

### `POST /admin/monthly-reset`

Runs the explicit month rollover path for all rewards players.

Request body:

```json
{
  "monthKey": "2026-04"
}
```

Response:

```json
{
  "monthKey": "2026-04",
  "resetCount": 6
}
```

If `monthKey` is omitted, the API resets to the current UTC month.

