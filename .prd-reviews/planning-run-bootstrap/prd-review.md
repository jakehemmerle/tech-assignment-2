# PRD Review: Create a reviewed, beads-ready implementation plan for the poker_rewards system described by this repository.

## Executive Summary
The draft PRD is directionally strong: it is grounded in the actual repository, covers the major product surfaces, and frames the rewards system around an immutable ledger plus read-side projections. The main risk is not that it misses the core feature. The risk is that too many implementation-shaping decisions remain open at exactly the points where acceptance, testability, scope control, and delivery confidence depend on a single explicit interpretation.

Across the six review legs, the same themes repeated:
- the implementation stack decision must be made explicitly
- points math and stake parsing need deterministic rules
- monthly reset and tier-floor behavior need precise state semantics
- admin adjustments, overrides, notifications, and leaderboard rank need clearer acceptance conditions
- operational and support stories need stronger coverage
- scope has to be narrowed to a challenge-safe MVP instead of blending must-have and stretch expectations

The PRD is close to being a strong implementation starting point, but it still needs one tightening pass to convert open-ended intent into build-ready rules.

## Before You Build: Critical Questions
- Will the implementation stay inside the existing Express/JavaScript serverless skeleton, or is full NestJS + strict TypeScript migration a hard requirement for this submission?
- What is the canonical award input contract: which fields determine stake bands, how are invalid values handled, and what is the exact mapping from input to base points?
- How are earned points represented when multipliers produce fractional values: decimal, rounded integer, or fixed-point?
- What is the exact monthly-reset algorithm in UTC, including when the protected tier floor is written, what “cannot drop more than one tier” means operationally, and how reset verification works locally?
- Do manual adjustments affect monthly points, lifetime points, tier progression, leaderboard rank, milestone checks, and notifications, or only a subset of those?
- What is the source of truth for display name and email in admin and leaderboard responses when rewards state lives in DynamoDB and player identity lives in MySQL?
- How is the 6-month tier timeline produced: explicit monthly snapshots or derivation from the ledger?
- How are leaderboard ties ordered, and what does “player’s own rank” return when the player is already in the top 100 or has zero monthly points?
- Is `handId` idempotency in scope now, or is duplicate-award handling explicitly deferred with accepted operational risk?
- What are the minimum notification rules: required fields, unread semantics, dismissal semantics, milestone thresholds, and duplicate-prevention behavior?

## Important But Non-Blocking
- Treat the current seed script as disposable. It does not yet create challenge-aligned sample data for monthly rewards, notifications, or leaderboard behavior.
- Reuse the same player-facing REST contracts for dashboard and Unity unless there is a strong reason to diverge; separate consumer-specific payloads will expand scope quickly.
- Prefer a manual or admin-triggered monthly reset path for the assignment; scheduled automation should remain explicitly deferred.
- Keep the write model narrow: immutable ledger entries, current player summary, monthly leaderboard projection, and notification records are enough for MVP.
- Explicitly separate pass-fail scope from strong-submission expectations. Timeline history polish, notification UX polish, caching, scheduled resets, and framework modernization are the easiest places for scope creep.
- Add explicit support and audit stories for missing points, duplicate awards, reset disputes, and manual adjustments so support/ops needs shape the API early instead of late.

## Observations and Suggestions
- The PRD already aligns better with the real repo than the current code stubs do. It correctly recognizes the Express-in-Lambda backend, placeholder React frontend, local DynamoDB tables, and the challenge’s business requirements.
- Most remaining ambiguity is not about product intent; it is about exact contract and data-model decisions. Resolving a small number of these choices will stabilize both implementation and testing.
- The draft should convert several current “open questions” into explicit decisions or intentional deferrals. The current document is strongest when it states constraints and weakest when it leaves required behavior open-ended.
- The implementation plan should be backend-first. The hardest and most schedule-sensitive work is the points engine, reset logic, projection model, and admin/read contract, not the UI shell.
- The PRD should explicitly say that the current stub request/response shapes in the rewards API are placeholders and will be replaced by the rewards-domain contract.
- Timeline history should only survive into MVP if its storage/reconstruction method stays cheap and bounded. Otherwise it should be treated as a should-have extension behind the must-have acceptance criteria.
- Idempotency, reset replay safety, audit attribution, and projection rebuild rules should be addressed even if their implementations are intentionally minimal. Silence here will turn into mid-build requirement churn.

## Confidence Assessment
Moderate confidence in the overall feature direction, and medium-high confidence that the assignment can be delivered successfully if the PRD is narrowed and clarified before design work continues. Confidence drops materially if the plan keeps the backend framework decision open, leaves points math and month semantics unresolved, or treats operational/admin behaviors as details to work out during implementation.

## Next Steps
1. Tighten the PRD by converting the highest-impact open questions into explicit decisions or explicit deferrals.
2. Ask the human for a single consolidated round of clarification on the remaining decision points that materially affect scope and implementation.
3. Append those clarifications to the PRD draft and checkpoint them in `.plan-reviews/planning-run-bootstrap/human-clarifications.md`.
4. Use the clarified PRD as the input to the next formula stage: design exploration and synthesis of the initial design doc.
