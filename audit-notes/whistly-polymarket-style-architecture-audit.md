# Whistly — Polymarket-Style Architecture Audit

Date: 2026-07-15 · Auditor: automated pass (Claude) · Scope: Anchor program, frontend transaction builders, TxLINE integration, API routes, market persistence.

## Verdict up front

The deployed protocol is a **pari-mutuel pooled-staking market**, not a share market.
Per the implementation decision tree this is **PATH B**: real buying, positions, settlement,
and claims exist; selling, orders, and an order book **do not** and cannot be presented
honestly without a protocol upgrade (see `whistly-share-trading-protocol-upgrade.md`).

## Controlling-files map

| Concern | File(s) |
|---|---|
| Program entrypoints | `programs/instinctfi/src/lib.rs` |
| Program state | `programs/instinctfi/src/state.rs` (`PollAccount`, `VoteAccount`, `UserAccount`, platform config) |
| Buy (stake) instruction | `programs/instinctfi/src/instructions/cast_vote.rs` — SOL transferred to treasury PDA |
| Settlement | `settle_poll`, `admin_settle_poll` instructions |
| Claims / refunds | `claim_reward`, `refund_tied_poll`, `sweep_dust` |
| Frontend tx builders | `app/src/lib/program.ts`, `app/src/lib/program.onchain.ts`, `app/src/lib/program.base.ts` |
| Buy/position hooks | `app/src/lib/useVote.ts`, `app/src/lib/hooks/usePollOperations.ts`, `useDataFetcher.ts` |
| Market detail UI | `app/src/app/polls/[id]/PollDetailClient.tsx` (trade ticket, outcome rows) |
| Live goal windows | `app/src/app/live/page.tsx`, `app/src/lib/liveGoalMarkets.ts`, `app/src/app/api/markets/create-live-goal`, `resolve-live-goal` |
| TxLINE client (fail-closed) | `app/src/lib/txline/client.ts`, `runtimeAuth.ts`, `mock.ts` (labeled) |
| Admin-gated RPC | `app/src/app/api/rpc/_handler.ts` (`createAdminRpcHandler`), `create-poll`, `settle-poll` |
| Portfolio/positions | `app/src/app/portfolio/page.tsx` (derived from on-chain `VoteAccount`s) |
| Comments | `app/src/components/PollComments.tsx` + Supabase |

## The fourteen questions

1. **Actual outcome shares?** No. Positions are `votes_per_option: Vec<u64>` counters inside a
   per-wallet `VoteAccount` PDA. No SPL mints, no transferable instruments.
2. **Sell before resolution?** No. There is no instruction that returns escrowed lamports
   for a position before settlement (only `refund_tied_poll` after a tie settlement).
3. **Order book?** No. There are no order accounts, no matching, no maker/taker concept.
4. **Limit orders?** No.
5. **Partial fills?** Not applicable — every buy executes fully at the fixed unit price.
6. **Cancel unfilled orders?** Not applicable.
7. **Dynamic pricing?** Partially. The *entry cost* per unit is fixed (`unit_price` lamports).
   The *implied probability* (`vote_counts[i] / total`) and the *expected payout* move with the
   pool, but buyers do not pay a probability-scaled price as on a CLOB/AMM.
8. **Economic model?** Pari-mutuel: all stakes escrow in a treasury PDA; on settlement the
   pool (minus platform/creator percentages) is split pro-rata among winning-side stakers.
9. **Shares transferable?** No. Positions live in a PDA keyed by (poll, wallet).
10. **Multiple positions in one market per wallet?** Yes — `votes_per_option` tracks a stake per
    outcome, so one wallet can hold both YES and NO units simultaneously.
11. **Payout calculation?** `reward = floor(user_winning_units / total_winning_units × voter_pool)`;
    claim sets `claimed = true` (double-claim guard). Ties refund via `refund_tied_poll`.
12. **Contract changes required for Polymarket-style trading?** Outcome-token representation
    (mints or ledger), collateral vault with mint/redeem of complete sets, a pricing venue
    (AMM or CLOB + matching), sell/cancel instructions, fee plumbing. Detailed in the upgrade doc.
13. **Honestly implementable today?** Buy (stake), implied probability, entry probability,
    estimated payout from live pool math, positions, portfolio, wallet-signed settlement,
    claims, activity from real events, comments.
14. **Fake unless the protocol changes?** Sell / cash-out, order book (bids/asks/depth/spread),
    limit orders, partial fills, per-trade price history, unrealized P&L marked to an exit price.

## What the current UI does about it (verified)

- Trade ticket shows **Buy** with **Sell rendered disabled**, tooltip: "Pool market — positions
  settle at resolution, no secondary selling". No order book is rendered anywhere.
- Probabilities are displayed as **percentages** (not ¢/$ — the collateral is devnet SOL).
- Ticket displays shares (1 share = 1 pool unit at `unit_price`), entry probability, cost in
  devnet SOL, and "To win" computed with the same pro-rata formula as `claim_reward`.
- Portfolio shows staked/P&L only for settled positions; active positions show
  "Exit value unavailable under the current pooled market model."
- TxLINE fails closed (`connected` / `not_configured` / `error` / labeled `mock`), and
  settlement is blocked without data. Live 5/15/45m windows are `marketKind = 1`,
  house-created only, resolve from score delta (`endTotal > startTotal → YES`).
