# Whistly — Prediction-Market Product Pass Report

Date: 2026-07-15 · Production: https://www.whistly.tech · Program: `J9Aqr…EgWV` (devnet)

## Architecture audit result

Full audit: `whistly-polymarket-style-architecture-audit.md`.
**Economic model: pari-mutuel pooled staking** (SOL escrowed in a treasury PDA, pro-rata
payout to winning-side stakers). Decision path taken: **PATH B** — honest buy-side UX;
sell/orders documented as a protocol upgrade (`whistly-share-trading-protocol-upgrade.md`),
**no contract changes made**.

| Capability | Real? |
|---|---|
| Outcome shares (transferable) | No — ledger positions per wallet |
| Buying (wallet-signed, on-chain escrow) | **Yes** |
| Selling before resolution | No — and not shown as functional (Sell tab disabled with explanation) |
| Market orders / limit orders / order book | No — not rendered anywhere |
| Dynamic implied probability | Yes (pool ratio) |
| Settlement + claim (wallet-signed) | **Yes** |

## What changed in this pass

- **Market detail page** rebuilt as a prediction-market trading surface: header with
  volume/close date/% chance, probability chart, outcome rows with per-outcome
  probability and Buy buttons, About/rules/fees/resolution-source section, comments,
  and a **sticky trade ticket** (Buy tab active, Sell visibly unsupported; amount in
  devnet SOL with quick-add/Max; shares, entry probability, cost, estimated payout
  from the same pro-rata formula as `claim_reward`; balance; wallet-gated action).
- **Discovery cards** (`/world-cup`, `/events`): Buy Yes / Buy No buttons with live
  probabilities; search + discovery tabs already present.
- **Unit honesty** (this spec's Phase 6): all ¢/price labels replaced with **probability %**
  — collateral is devnet SOL, not USD. Ticket carries
  "Devnet SOL has no real-money value."
- **Portfolio**: active positions now state
  "Exit value unavailable under the current pooled market model"; P&L only on settled
  positions (computed from real pool math), claim buttons on claimable ones.
- Six real on-chain markets created by the house for all remaining World Cup fixtures
  (SF2 winner / O2.5 / BTTS, third-place, outright, final-in-90).

## Homepage preservation

`/` untouched in this pass (hero, sections, sidebar, cards, footer). Homepage market
links route to `/world-cup`, `/live`, and market detail pages.

## Live-window rules (unchanged, verified in code)

`marketKind = 1`; outcomes `0 = NO`, `1 = YES`; house/admin-created only (user creation
removed from UI and admin-gated at the API); tied to a real `fixtureId`; start score +
window timestamps recorded; buys lock before window end (`getLiveGoalMarketStatus`);
resolution = score delta (`endTotal > startTotal → YES`), never majority vote; `/live`
shows only kickoff countdowns before matches go live.

## TxLINE behavior

Fail-closed states `connected / not_configured / error / mock`; settlement disabled
without data; mock only behind `NEXT_PUBLIC_ENABLE_MOCK_MODE=true` and labeled.
Production verified `connected` with real World Cup fixtures.

## Verification results (2026-07-15)

- `npx tsc --noEmit` — **pass** (exit 0)
- `npm test -- --ci --runInBand` — **98 passed, 14 skipped, 0 failed**
- `npm run build` — **pass** (all routes compile)
- CI (GitHub Actions): Anchor build, cargo audit, jest, lint/typecheck — **green** as of `dd1c420`
- Manual devnet: six house markets created via Phantom (wallet-signed); settled-market
  pages verified rendering; TxLINE `connected` on production.

## Remaining limitations / intentionally not implemented

- **No sell / cash-out, no order book, no limit orders** — impossible to implement honestly
  on the pari-mutuel program; specified in the upgrade proposal instead.
- **Price-history chart is presentational** (deterministic simulation anchored to the live
  pool ratio) — the program does not store per-trade history; an indexer over treasury
  transactions is the honest fix and is noted as future work.
- Unrealized P&L is not shown (no exit price exists in a pooled market).
- Buy flow on a live active market awaits first real end-to-end exercise by a non-creator
  wallet (all render paths verified; gating logic unchanged from the audited original).
- `/markets` route not added; discovery lives at `/world-cup` + `/events` (aliased).

## Completion statement

Per the final completion rule: foundational protocol work (real shares, sell, orders)
**remains**, so this pass does **not** claim "product pass complete". What works, what
doesn't, why, and the safest next step (Design A AMM behind `marketKind = 2`) are
documented above and in the upgrade proposal.
