# Whistly V2 Fast Audit (Checkpoint 1)

Date: 2026-07-16. Time-boxed audit; details defer to
`whistly-polymarket-style-architecture-audit.md`,
`whistly-share-trading-protocol-upgrade.md`,
`whistly-real-devnet-flow-audit.md`.

## What V1 supports (keep as-is)

- Pari-mutuel pooled staking. Program `instinctfi`
  (`J9AqrLZWDXaQfDwtFpC2GG9hBb7SAPxRwVpGs753EgWV`, devnet).
- Accounts: `UserAccount ["user",auth]`, `PollAccount ["poll",creator,id]`,
  treasury `["treasury",poll]`, `VoteAccount ["vote",poll,voter]`,
  `PlatformConfig ["platform_config"]`.
- Instructions: initialize_platform/user, create_poll (admin-gated, 0.5 SOL
  fee), edit/admin_edit/delete_poll, cast_vote (real lamports → treasury),
  settle_poll (permissionless void after 7d), admin_settle_poll (2% creator,
  3% platform), claim_reward (pro-rata, PDA-signed), refund_tied_poll,
  sweep_dust, update_platform_config (pause/admin-rotate).
- `market_kind`: 0 = standard, 1 = live-goal window; side 0 = NO, 1 = YES.
- Real buy, implied probability, portfolio from `VoteAccount`s, wallet-signed
  settlement, claims. Frontend builds raw instructions by hand
  (`program.base.ts` discriminators, `program.onchain.ts` borsh) — no Anchor
  TS client. Supabase mirrors non-blockingly via SECURITY DEFINER RPCs.

## What V1 cannot support (why V2 exists)

- No shares/instruments → no sell, no transfer, no cash-out before
  settlement (only tie/void refund).
- No order book, no limit orders, no partial fills, no cancellations.
- Fixed `unit_price` per coin — price does not move with demand.
- No per-trade price history (no fills exist).
- Unrealized P&L unmeasurable (no exit price).

## V1 files that must remain unchanged (layouts frozen)

- `programs/instinctfi/src/state.rs` account structs (`PollAccount`,
  `VoteAccount`, `UserAccount`, `PlatformConfig`) — V2 adds NEW account
  types only; no field edits, no reordering.
- All existing V1 instruction handlers and their account structs.
- Frontend V1 builders/parsers (`program.base.ts`, `program.onchain.ts`)
  aside from purely additive exports.
- Homepage tree: `src/app/page.tsx`, `src/components/marketplace/*`,
  homepage-relevant sections of `globals.css` (guarded by Playwright
  baselines in `app/e2e/`).

## V2 on-chain design (Checkpoints 2–3) — decision

**Program-owned position ledger + per-market collateral vault + operator-
settled fills** (proposal "Design B-lite"): full CLOB UX with off-chain
matching; every fill settles on-chain.

Chosen share representation: **program-owned PositionV2 PDAs**, not SPL
tokens. Rationale: (a) partial fills need lamport-precise lock/unlock that
token accounts complicate; (b) no transferability requirement on devnet;
(c) half the rent/compute per trade; (d) simpler double-redeem defense.
Documented trade-off: no external composability — acceptable for devnet.

New accounts (all PDAs, seeds versioned with "v2"):
- `MarketV2 ["market_v2", authority, market_id]` — versioned market:
  market_type (binary / three-way / multi), outcomes (2–8), fee_bps,
  close_ts, resolution_source, status (Open/Paused/Closed/Settled/Void),
  winning_outcome, fixture binding, totals.
- `CollateralVaultV2 ["vault_v2", market]` — native SOL vault; invariant:
  lamports ≥ Σ(winning-side max payout) + locked buy collateral.
- `PositionV2 ["position_v2", market, owner, outcome_index]` — total /
  available / locked shares, cost basis, proceeds, realized P&L, redeemed.
- `OrderNonceV2 ["order_nonce_v2", owner]` — monotonic nonce + recent order
  hash ring for replay defense.
- `FillReceiptV2 ["fill_v2", market, fill_seq]` — canonical on-chain record
  of a matched fill (maker, taker, outcome, side, price_bps, qty, fee).

New instructions:
- `init_market_v2`, `pause_market_v2`, `close_market_v2`
- `deposit_and_lock_v2` / `unlock_collateral_v2` (limit-buy escrow)
- `lock_shares_v2` / `unlock_shares_v2` (limit-sell escrow)
- `settle_fill_v2` — verifies both parties' ed25519 order signatures
  (ed25519 program pre-instruction), price within both limits, remaining
  quantities, market open, nonce fresh; moves lamports vault↔parties,
  updates both positions, mints FillReceipt, accrues fee.
- `settle_market_v2` (admin/oracle, winning outcome), `void_market_v2`
- `redeem_v2` (winning shares → lamports; losers 0; once), `redeem_void_v2`
  (cost-basis refund)
- `withdraw_fees_v2` (admin)

Price model: probability in basis points (1–9999), 1% UI tick. Buyer pays
`qty × price_bps / 10_000` lamports-per-share-unit; share unit = 1e6
(micro-shares) so rounding always favors the vault.

## V2 backend services required (Checkpoint 4)

- Supabase tables: `v2_markets`, `v2_orders` (signed intents + status +
  filled qty), `v2_fills`, `v2_positions_cache`, `v2_price_history`,
  `v2_activity`. RLS: reads anon, writes via service-role API routes only.
- API routes (`/api/v2/…`): `orders` (post/validate/list), `orders/cancel`,
  `book/[marketId]`, `quote` (executable preview), `match` (engine tick —
  price-time priority), `settle-fill` (builds + submits settle_fill_v2 with
  operator key as fee payer; parties pre-sign order intents, not txs),
  `markets`, `positions/[wallet]`, `activity`, `history/[marketId]`.
- Signature scheme: ed25519 `signMessage` over canonical order payload
  (domain-separated, versioned, includes nonce+expiry+market+outcome+side+
  price+qty); server verifies with tweetnacl before accepting; program
  re-verifies via ed25519 sysvar introspection at settlement.
- Realtime: Supabase realtime channel per market for book/trades; polling
  fallback.

## Environment facts

- solana-cli 1.18.23, anchor-cli 0.30.1, rustc 1.93.0 — build possible here.
- Deploy wallet `5cR5PY9VVtAij6qAaifqRqKcDK2xbzYUiibzDZvgsVQo`, ~6 devnet
  SOL (CLI config repaired: was `attacker.json`/localhost, now id.json +
  devnet). V1 admin (`62PFLS…`) not required — V2 is a separate program
  with its own authority.
- Playwright installed this session; homepage baselines live in
  `app/e2e/__screenshots__/`.
- Blocked externally: direct polymarket.com inspection (origin denied) —
  see design reference doc for unblock action. Not blocking implementation.

## Verdict

Proceed to Checkpoint 2 (V2 program) immediately.
