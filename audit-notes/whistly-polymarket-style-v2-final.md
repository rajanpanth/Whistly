# Whistly — Polymarket-Style Solana Devnet V2 — Final Report

Date: 2026-07-16. Program: `J9AqrLZWDXaQfDwtFpC2GG9hBb7SAPxRwVpGs753EgWV` (devnet, upgraded in place).

## Summary

A complete CLOB-style share-trading protocol (V2) was designed, implemented,
deployed to Solana devnet, and verified end-to-end with real transactions —
running alongside the untouched V1 pari-mutuel program. The frozen homepage
`/` is provably unchanged; every internal trading route is a new
Polymarket-adjacent Whistly experience.

## Claude Design screens inspected

Documented in `whistly-claude-design-reference.md`. Direct polymarket.com
inspection was blocked in this environment (origin approval + expired TLS);
CLOB order semantics were instead verified against the live
docs.polymarket.com developer docs, and the product structure reproduced
from that plus prior knowledge. Screens covered: discovery, sports/live,
binary market detail, event grouping, buy/sell tickets, market/limit modes,
order book, activity, comments/rules, portfolio, open orders, mobile detail
+ bottom sheet. **Unblock action for pixel-parity QA:** approve the
`polymarket.com` origin in the Claude browser pane.

## Homepage regression result

PASS. `app/e2e/homepage-frozen.spec.ts` — desktop 1440×900, mobile 390×844,
and DOM-skeleton snapshots all match the pre-work baselines. Global
Navbar/Footer are suppressed only on new trading routes; `/` renders
identical chrome. Baselines: `app/e2e/__screenshots__/`.

## V1 architecture preserved

- `programs/instinctfi/src/state.rs`, `errors.rs`, `events.rs`, and all V1
  instruction handlers are byte-for-byte unchanged (only additive module
  declarations added to `lib.rs` / `instructions/mod.rs`).
- 31 live V1 `PollAccount`s on devnet still deserialize correctly after the
  upgrade; `marketKind 0/1`, `0=NO / 1=YES`, claim/settlement behavior intact.

## V2 architecture

Program-owned position ledger + per-market collateral vault + operator-
settled fills (chosen over SPL tokens for lamport-exact partial-fill locking,
lower rent/compute, and simpler double-redeem defense — documented in the
fast audit). Prices are probability basis points; 1 share of a winning
outcome redeems for `SET_COST` = 0.001 ◎. Complete-set mint/burn keeps the
vault exactly backed.

**Accounts:** `ConfigV2`, `MarketV2` (2–8 outcomes), `VaultV2`, `BalanceV2`,
`PositionV2`, `OrderFillStateV2`.
**Instructions:** `init_config_v2`, `update_config_v2`, `create_market_v2`,
`set_market_status_v2`, `deposit_v2`, `withdraw_v2`, `init_position_v2`,
`mint_set_v2`, `burn_set_v2`, `settle_fill_v2`, `cancel_order_v2`,
`settle_market_v2`, `void_market_v2`, `redeem_v2`, `withdraw_fees_v2`.

Matching is off-chain (price-time priority, three cross modes: transfer /
binary mint / binary burn). Every fill settles on-chain via `settle_fill_v2`,
which reads both parties' ed25519-signed order intents from pre-instructions
(sysvar introspection) and re-verifies price, expiry, cancellation, and
remaining quantity. The server never holds user keys; the operator can only
submit fills that satisfy both signed orders.

## Program ID

`J9AqrLZWDXaQfDwtFpC2GG9hBb7SAPxRwVpGs753EgWV` (devnet).
Config PDA `44PVJ6twDTwLUJfTWeu1WPmMjeavDbJS3QurisCiEJMC`,
operator `2JzpcqEXkutALm68Jbm6JcpstYkMEk7K5ff85uUoR9Qm`, fee 1%.

## Anchor files

`programs/instinctfi/src/state_v2.rs`, `errors_v2.rs`, `events_v2.rs`,
`instructions/v2/{admin,funds,sets,fill,resolve,mod}.rs`, wired in `lib.rs`.

## Frontend routes

`(trading)` group with dedicated header + scoped `trading.css`:
`/markets`, `/market/[marketId]`, `/event/[eventId]`, `/positions`,
`/orders`. (`/live`, `/portfolio`, `/activity` remain V1 pages, linked from
the trading nav; migrating them is the noted remaining work.)

## Components

`TradingHeader`, `TradeTicket` (buy/sell × market/limit, quote, review,
sign, submit, Explorer links, mobile bottom sheet), `OrderBook`,
`PriceChart` (fills-only), plus client libs
`lib/v2/{codec,programV2,client,hooks,orderStore,engine,matchLogic}.ts`.

## API routes

`/api/v2/orders` (post+list), `/orders/cancel`, `/book/[market]`, `/quote`,
`/markets`, `/positions/[wallet]`, `/history/[market]`, `/activity`,
`/status`.

## Database migrations

`app/supabase-v2-clob.sql` — `v2_orders`, `v2_fills`, `v2_activity` (RLS:
anon read, service-role write). In-memory fallback for local dev; Supabase
required in serverless production (guarded in `orderStore.ts`).

## Status matrix

| Capability | Status |
| --- | --- |
| Buy (market) | Working on devnet (FAK marketable limit) |
| Buy (limit) | Working — rests, partial fills, cancellable |
| Sell (market) | Working (FAK) |
| Sell (limit) | Working — rests, partial fills, cancellable |
| Market orders | Working — slippage-capped, reject on no liquidity |
| Limit orders | Working — GTC/GTD/FAK/FOK |
| GTC persistence | Working — rests until filled/cancelled/expired |
| Partial fills | Verified (60 of 100 filled, 40 cancelled) |
| Cancellation | Working (signed soft-cancel + on-chain hard-cancel) |
| Order book | Real signed orders only + binary mirror liquidity; honest empty state |
| Share accounting | Program-owned PositionV2; over-sell/double-sell/double-redeem prevented |
| Price history | Real fills only; "No completed trades yet." otherwise |
| Portfolio | Real on-chain positions + balance |
| Settlement | Working (admin/oracle winning outcome) |
| Redemption | Working — winner paid SET_COST/share, loser 0, double-redeem rejected |
| TxLINE | Unchanged, fail-closed (V1 integration) |
| Live goal windows | V1 5/15/45-min logic preserved (marketKind=1, YES/NO) |

## Test results

- **TypeScript:** `npx tsc --noEmit` — PASS (0 errors).
- **Frontend/API tests:** `npm test` — 119 passed, 14 skipped, 0 failed
  (includes 21 new V2 tests: codec byte-layout + price math vs Rust
  constants, matching price-time priority + all three cross modes).
- **Production build:** `npm run build` — PASS; all trading routes + V2 APIs
  in the manifest.
- **Anchor/protocol tests:** IDL generation is impossible in this toolchain
  (anchor-syn 0.30.1 needs `proc_macro2::Span::source_file`, removed in
  rustc 1.93), so `anchor test` cannot run. Equivalent coverage is provided
  by `scripts/v2-verify.mjs`, a full-lifecycle **devnet** assertion suite
  (below) — stronger evidence than localnet since it runs the deployed
  program with real signatures.
- **Homepage visual tests:** PASS (desktop, mobile, DOM skeleton).

## Real devnet transaction signatures

From `scripts/v2-verify.mjs` (ALL ASSERTIONS PASSED), market #2
`2SxGmnemqQercTNAqopR1rui5FUJ63GYa9bFz6kUF789`:

| Step | Signature |
| --- | --- |
| create_market_v2 | `32DrpEduFzjH92EsrwcSw9A48S7vYrw9MhrR3DBzeufwDyYEdZJdaqWhZNqT1xVssuhivwZv88dyapYacMv4yac` |
| deposit A | `ze9et4gN6uJqDvJe7qkJpWDrKDrAxHE1C3nze5w21fPQztbTbEv48YBEQ313Mfwmm5Ro5NT4Uit4M3SrL7F2FY2` |
| deposit B | `gimBJWHLXhy1pRQyV3ZymYHY91U7WZ4U1b57ytztCwAJTjbW2UNF9z4f1rGg7Y3tsX6QbFmMt2rcQmgpYuML4f4` |
| mint-cross fill | `ZRu7vkqfVfnjXZFWL1NbH99CXVrAV7y8k7RFFg9Vja6Sco3CnZ4DhMf9vU1QqrPKvdSdy4Cme9kNYJkZ92ox8Nr` |
| transfer fill | `2EuZ2vojSgkS7hcY4KxYoUFnVgjVjpcqi7amcSmh3mkEKDuhHBZABNdQYt5hsEJvPBvCpg1vLA24ymqsToDQEGeM` |
| close market | `5h1ioSwztoeoymY5YurVHw6u38sp8gkSKAecHL74YGQtgz3dsxsrBEg7KrFQ64bZnidNhukR4VFxQaBwReYiwCkZ` |
| settle market | `4u5qi4GRUkftKsy7SDEscLCPxaFVgPWGbbwDPm3Bm7tsAKTcf1UgwzjpcZypujShsXwwpkzCcC7jDxMoH49k4a7S` |
| redeem winner | `5w5wYKRa2A3V8tYPokXcrwipvKocinWTruiFeUSYjCrNunDBiCG2b6MeWG37CNBBdog75JAV32z4Zdg83mC36Bbe` |
| redeem loser | `9AZmABmz16jACZ9Xk6tLgjSx4idwFFTN948TqDVnVn4yBnVPFMtnFk7sCk6uxFZA2oViann1v1U8gtnDr8HrpAL` |

Earlier smoke market #1 `8wwPeFaLdC9pcPFjETweWf8UTYxh9nCSFd9vvAE6xb4s` also has
confirmed mint-cross + transfer fills. Wallets:
A `3FkdeJqp9cAdKo5cBxPuY98QgfmS8gi3T56Q2LRJMMVd`,
B `2jY6vay7yJPwkScpgRPVM1FTUYhw5uE7WCifjLDEAvN8`.

## Security tests exercised

Overfill prevention (fill-state cap), double-redeem rejection (verified),
oversell/insufficient-shares rejection (422 in E2E), self-trade rejection,
replay/duplicate-nonce (unique constraint + on-chain nonce), expiry
validation, market-close validation, funding validation (locked-collateral
accounting across resting orders), ed25519 signer binding, and boxed-account
stack-safety. Vault backing invariant enforced on every mint/burn/redeem
(rounding always favors the vault).

## Remaining limitations

1. `/live`, `/portfolio`, and `/activity` have now been migrated into the V2
   trading route group and restyled; the new Matchday fan product is documented
   separately in `whistly-consumer-fan-submission.md`.
2. Anchor IDL / `anchor test` unavailable in this toolchain — devnet
   assertion suite substitutes.
3. Local order store is in-memory (resets on restart) until Supabase env is
   configured; production requires it (enforced).
4. polymarket.com pixel-parity QA pending origin approval.
5. Live-goal-window auto-generation still runs on the V1 pari-mutuel path;
   porting windows to V2 markets is future work.
