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

- [x] Checkpoint 2–3: V2 Anchor program (state_v2/errors_v2/events_v2 +
  instructions/v2/*), builds clean (--no-idl), V1 structs untouched.
- [x] Checkpoint 4: hybrid CLOB backend (codec, programV2, orderStore,
  engine/matchLogic, ed25519 order intents, 9 API routes).
- [x] Checkpoints 5–14: (trading) route group, header, market detail,
  trade ticket, order book, chart, portfolio/positions, orders, event.
- [x] Deployed V2 upgrade to devnet (in place; upgrade authority = deploy
  wallet). Config + 2 markets created on devnet.
- [x] Checkpoint 16–17: security defenses + tests (21 V2 jest tests),
  tsc/jest/build all green, homepage regression green.
- [x] Checkpoint 18: full-lifecycle devnet verification
  (`scripts/v2-verify.mjs`) — ALL ASSERTIONS PASSED; signatures recorded in
  `whistly-polymarket-style-v2-final.md`. V1's 31 polls still deserialize.

## Remaining (see final report §Remaining limitations)

- Restyle `/live`, `/portfolio`, `/activity` from V1 pages to V2 trading UI.
- Port live goal windows to V2 markets.
- polymarket.com pixel-parity QA (needs origin approval).
- Configure Supabase env for production order store.

## Session-continuation prompt

"Continue Whistly V2. Read audit-notes/whistly-v2-progress.md +
whistly-polymarket-style-v2-final.md. Core protocol + trading UI are done and
devnet-verified. Next: migrate /live, /portfolio, /activity to the (trading)
V2 UI, and port live goal windows onto V2 markets. Don't redo the audit,
baselines, or protocol."
