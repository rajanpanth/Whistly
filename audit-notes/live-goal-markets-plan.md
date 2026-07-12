# InstinctFi Live Goal Markets Implementation Plan

## Current Project Scan

- Frontend framework: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Framer Motion.
- Wallet integration: `@solana/wallet-adapter` with app-level providers in `app/src/components/Providers.tsx` and transaction operations in `app/src/lib/hooks/usePollOperations.ts`.
- Smart contract/program structure: Anchor program at `programs/instinctfi`, with instruction modules under `programs/instinctfi/src/instructions`.
- Current market/poll model: on-chain `PollAccount` in `programs/instinctfi/src/state.rs`, with options, vote counts, unit price, end time, total pool, status, and winning option.
- Existing create flow: `create_poll.rs` creates a poll PDA and treasury PDA, charges a flat 0.5 SOL creation fee, and stores options/vote counts.
- Existing buy/vote flow: `cast_vote.rs` buys option-coins for an option; frontend calls this through `castVote` in `usePollOperations.ts`.
- Existing settlement flow: `admin_settle_poll.rs` lets the platform admin declare a real-world `winning_option`; `settle_poll.rs` is now a post-grace void path, not majority settlement.
- Existing reward claiming flow: `claim_reward.rs` lets winning voters claim proportional payouts after settlement; frontend exposes this as `claimReward`.
- Existing database/storage layer: Supabase schema in `app/supabase-schema.sql`, client helpers in `app/src/lib/supabase.ts`, RPC sync routes under `app/src/app/api/rpc`.
- Existing frontend routes: App Router pages under `app/src/app`, including `/polls`, `/polls/[id]`, `/create`, `/portfolio`, `/admin`, `/activity`, `/leaderboard`.

## Files Expected To Change

- `programs/instinctfi/src/state.rs`
- `programs/instinctfi/src/instructions/create_poll.rs`
- `app/src/lib/txline/*`
- `app/src/app/api/txline/fixtures/route.ts`
- `app/src/app/api/txline/scores/[fixtureId]/route.ts`
- `app/src/app/api/markets/create-live-goal/route.ts`
- `app/src/app/api/markets/resolve-live-goal/route.ts`
- `app/src/app/live/page.tsx`
- `app/src/lib/liveGoalMarkets.ts`
- `app/src/lib/__tests__/liveGoalMarkets.test.ts`
- `app/supabase-schema.sql`
- `README.md`
- `audit-notes/live-goal-markets-test-plan.md`
- `audit-notes/live-goal-markets-final-summary.md`

## Implementation Approach

1. Keep the existing on-chain pari-mutuel model: outcomes are `["NO", "YES"]`, and winners split the settled pool.
2. Use the existing `admin_settle_poll` instruction for real-world outcome settlement: `winning_option = 0` for NO, `winning_option = 1` for YES.
3. Add a minimal contract duration change so 5/15/45 minute markets can be created. Because `create_poll` currently has no market-kind argument, the low-risk MVP path is to reduce the global minimum duration to 60 seconds and document that standard UI should keep longer defaults.
4. Add a TxLINE/TxODDS integration layer with mock mode by default. Real credentials can be added later through environment variables.
5. Add local/demo live goal metadata storage so the hackathon demo works without real API keys or Supabase writes.
6. Add `/live` as the hackathon-facing experience. It will show one mock live match, 5/15/45 minute goal-window markets, YES/NO pools, implied probability, lock state, resolver output, and claim-payout wording.
7. Add resolver tests for score-difference based YES/NO resolution.

## Risks And Blockers

- The current on-chain `PollAccount` does not store match/window metadata. For the MVP, that metadata should live off-chain in the new live goal market storage layer and Supabase schema.
- The current contract create instruction has no `market_kind` parameter. Adding one would require changing the instruction ABI and all builders/tests. To avoid breaking existing functionality, the MVP contract change should be minimal.
- Automated server-side admin settlement requires securely signing with `ADMIN_PRIVATE_KEY`; this is risky in a quick MVP. The safer demo path is to resolve metadata server-side and use the existing admin wallet UI/action for on-chain settlement.
- Existing Supabase `settle_poll_atomic` still calculates winner by highest votes. For live markets, frontend/on-chain settlement should be treated as source of truth; Supabase sync needs a dedicated live goal metadata path or future RPC update.
- Real TxLINE/TxODDS API shape and credentials are unavailable, so mock mode must remain complete and clearly labeled.
