# Whistly — Share-Trading Protocol Upgrade Proposal (PATH C)

Status: **proposal only — no contract changes made.** The deployed pari-mutuel program
(`J9AqrLZWDXaQfDwtFpC2GG9hBb7SAPxRwVpGs753EgWV`, devnet) remains untouched; existing
polls and instructions are preserved. This document specifies what real sell/order
functionality would require, behind a **new versioned market type** (`marketKind = 2`).

## 1. Outcome representation

Two viable designs; recommendation first:

- **A (recommended): ledger positions + AMM.** Keep positions as PDA ledger entries
  (like today's `VoteAccount`) but denominate them in *shares* of a constant-product or
  LMSR pool. No SPL mints → cheaper, no token-account rent, no transferability (fine for devnet).
- **B: SPL outcome tokens + CLOB.** Mint one SPL token per outcome from a collateral vault
  ("complete set" mint/redeem: 1 SOL ⇄ 1 YES + 1 NO). Required if orders must be matched
  peer-to-peer (Polymarket's actual model). Substantially more accounts, rent, and surface.

## 2. Collateral / escrow

- Per-market vault PDA (`seeds = ["vault", market_id]`) holding devnet SOL.
- Invariant: `vault_lamports ≥ Σ max(payout per outcome side)`. With complete sets this is
  exact; with an AMM it holds by construction of the pool.

## 3–5. Buy / sell / pricing (design A)

- `buy(outcome, sol_in, min_shares_out)` — swap SOL into outcome shares along the curve;
  slippage-guarded by `min_shares_out` (rejects stale quotes / front-running).
- `sell(outcome, shares_in, min_sol_out)` — inverse swap; realized P&L = proceeds − cost basis
  (basis tracked per position as `total_cost_lamports`).
- Price = marginal cost of the next share; probability = normalized price across outcomes.
  LMSR (`b` liquidity parameter) preferred for n-outcome match markets (Team A / Draw / Team B).

## 6. Liquidity model

- House seeds each market's pool at creation (replaces today's 0.5 SOL creation fee seed).
- LMSR bounded loss = `b · ln(n)` — set `b` per market from the seed budget.
- "Liquidity" shown in UI = current vault balance; no external LPs in v1.

## 7. Market orders / limit orders / cancellation / partial fills (design B only)

- On-chain `OrderAccount` PDA: side, outcome, limit price (millionths), qty, filled_qty, expiry.
- `place_order`, `cancel_order` (owner-only, returns escrow), `match_orders` (crank or
  taker-driven fill loop). Partial fills update `filled_qty`; escrow released pro-rata.
- Not recommended for the hackathon timeframe: matching cranks, DoS surface
  (order spam → account bloat), and priority/ordering fairness all need careful work.

## 8–9. Settlement / redemption

- Reuse the existing oracle flow: admin-signed settlement records `winning_option`.
- `redeem(shares)` pays `shares × 1` unit from the vault for winning shares; losing shares
  burn to zero. Tie/void → `redeem_refund` at cost basis (mirrors `refund_tied_poll`).

## 10. Fees

- Basis-point fee on swap notional (e.g. 100 bps), accrued in-vault to a platform fee ledger;
  swept by the existing platform-config authority. Keep out of the payout invariant.

## 11–15. Security requirements

- **PDA security:** all vaults/positions derived from `[market_id, wallet]`; reject
  non-canonical bumps; ownership checks on every account (same discipline as current program).
- **Rounding:** integer math in lamports; round *against* the trader; property-test that
  `Σ payouts ≤ vault` for randomized trade sequences (fuzz with proptest).
- **Overflow:** `checked_*` everywhere; u128 intermediates for curve math.
- **Account sizing:** fixed-size positions; orders (design B) capped per wallet per market.
- **DoS:** creation fee + order caps; no unbounded loops over other users' accounts in any
  instruction a user signs.
- **Admin powers:** settlement authority unchanged (admin wallet list); add a `pause` flag
  per market honored by `buy`/`sell`. Upgrade authority: keep current multisig/wallet;
  document that it can replace program logic (devnet acceptable; note for mainnet).

## 16. Migration

- None required. Old polls keep `marketKind ∈ {0, 1}` and their instructions.
- New AMM markets launch as `marketKind = 2` with new accounts; frontend selects the trade
  ticket by kind. `/live` goal windows stay on the pari-mutuel path (they are short-lived
  and pool-based by design).

## Effort estimate

Design A (AMM, buy/sell/redeem, no orders): ~2–3 weeks including Anchor tests and audit pass.
Design B (CLOB): 6+ weeks and an economic-security review. Neither is hackathon-scoped;
the shipped PATH B experience is the honest maximum until then.
