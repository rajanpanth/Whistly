# Whistly V2 Progress Tracker

Updated: 2026-07-16 (session 1)

## Completed

- [x] Environment: solana 1.18.23 / anchor 0.30.1 / rustc 1.93 verified.
  Solana CLI config repaired (id.json + devnet). Deploy wallet
  `5cR5PY9VVtAij6qAaifqRqKcDK2xbzYUiibzDZvgsVQo`, ~6 devnet SOL.
- [x] Homepage freeze guard (Checkpoint 0): `@playwright/test` added to
  `app/`, config `app/playwright.config.ts`, spec
  `app/e2e/homepage-frozen.spec.ts`. Baselines (desktop 1440×900, mobile
  390×844 chromium, DOM skeleton) in
  `app/e2e/__screenshots__/homepage-frozen.spec.ts/`. Deterministic: API
  calls aborted in-test; countdown/chart/featured-carousel masked.
  Run: `cd app && npx playwright test`.
- [x] Claude Design reference (blocked→documented):
  `audit-notes/whistly-claude-design-reference.md`. polymarket.com direct
  inspection denied in environment (origin approval + TLS block); CLOB
  semantics verified against live docs.polymarket.com instead. Unblock:
  user approves polymarket.com origin in browser pane.
- [x] Checkpoint 1 fast audit: `audit-notes/whistly-v2-fast-audit.md`
  (V1 capabilities/limits, frozen files, V2 design decision:
  position-ledger + vault + operator-settled fills, ed25519 order intents).

## In progress

- [ ] Checkpoint 2–3: V2 Anchor program `programs/instinctfi/src/…` — being
  added as new module set (state_v2.rs, instructions/v2/*). NOT started
  writing code yet.

## Next exact steps

1. Write `programs/instinctfi/src/state_v2.rs` (MarketV2, CollateralVaultV2,
   PositionV2, OrderNonceV2, FillReceiptV2, constants, statuses).
2. Write `programs/instinctfi/src/instructions/v2/` handlers
   (init_market, pause/close, lock/unlock collateral+shares, settle_fill,
   settle_market, void, redeem, redeem_void, withdraw_fees).
3. Wire into `lib.rs` (new #[program] fns, additive only) + errors.rs.
4. `anchor build` — confirm V1 structs untouched (`git diff state.rs` empty).
5. Anchor tests `tests/v2-*.ts`.
6. Supabase migration `app/supabase-v2-clob.sql`.
7. API routes `app/src/app/api/v2/*`, matching engine
   `app/src/lib/v2/{orders,matching,signing}.ts`.
8. `(trading)` route group + trading header + pages.
9. Deploy V2 (decision: SAME program upgraded in place vs NEW program id —
   current lean: extend existing program with v2 instructions, deployed by
   upgrade authority; verify upgrade authority = deploy wallet first via
   `solana program show J9Aq…`. If authority mismatch → deploy as NEW
   program id from same source, updating declare_id via feature flag).
10. Two-wallet devnet E2E; record signatures in final report.

## Blockers

- polymarket.com inspection blocked (see above) — cosmetic verification only,
  not blocking implementation.
- V1 program upgrade authority unknown → check before deploy (step 9);
  fallback path defined.

## Session-continuation prompt

"Continue the Whistly V2 build. Read audit-notes/whistly-v2-progress.md and
resume from the first unchecked item in 'Next exact steps'. Do not redo the
audit or homepage baselines."
