# Whistly Marketplace UI Verification Summary

Date: 2026-07-12

## Scope

This pass resumed from the current repository state and verified the latest marketplace UI without changing the Anchor program, IDL, wallet operations, settlement, claim, or devnet code.

The active Git repository is `C:\Users\panth\Videos\Whistly\Whistly`. It was clean on `main` before this note was created. It currently has one baseline commit, so there is no earlier in-repository commit available for a focused before/after redesign comparison.

## Files Changed

- `audit-notes/whistly-marketplace-ui-summary.md` — created by this verification pass.

No application, Anchor, IDL, wallet, settlement, claim, or devnet implementation files were changed.

## Automated Checks

Run from `app/`:

### TypeScript

```text
npx tsc --noEmit
```

Status: **PASS** (exit code 0, no TypeScript errors).

### Jest

```text
npm test -- --runInBand
```

Status: **FAIL**.

- 6 suites passed, 1 failed, and 1 skipped.
- 88 tests passed, 9 failed, and 14 skipped (111 total).

All 9 failures are in `src/__tests__/integration/rpc-critical-path.test.ts`. The create-poll route returns HTTP 403 because its current admin gate runs before the test's expected validation/create behavior, while the test uses a non-admin wallet by default. The live goal market tests and the other suites passed. This existing RPC test/authorization-contract mismatch was not changed because it is outside the marketplace UI redesign scope.

### Production build

```text
npm run build
```

Status: **PASS**.

- Next.js 15.5.12 compiled successfully.
- 49 static/dynamic routes were generated, including `/` and `/live`.
- Existing lint warning: `src/lib/hooks/usePollOperations.ts` has an unnecessary `usersRef` dependency in a `useCallback`.
- Expected local warning: Supabase environment variables are not configured, so the app runs in offline/demo mode.

### Development server

```text
npm run dev
```

Status: **PASS**.

- `/` returned HTTP 200.
- `/live` returned HTTP 200.

## Marketplace UI Status

### Desktop — PASS

Verified at 1280 x 720.

- Homepage, featured market, offer/settings rail, live cards, sports cards, footer, and navigation rendered.
- No document-level horizontal overflow or broken images were detected.
- Market links, live links, search, wallet entry points, category controls, outcome selection states, and share controls were present.
- Demo and illustrative-data wording is visible; the homepage does not claim its static cards are real TxLINE-validated markets.
- Browser console contained only the expected missing-Supabase/offline-demo warning.

### Mobile — PASS

Verified at 390 x 844.

- Responsive header and search layout rendered correctly.
- The mobile navigation toggle opened and exposed the primary navigation.
- Featured and offer cards stacked correctly.
- No document-level horizontal overflow or broken images were detected.
- The sport-category row intentionally scrolls horizontally; offscreen chips do not widen the page.

No marketplace redesign regression requiring an application code change was found.

## `/live` Status

Status: **WORKS for route/render verification; wallet-connected devnet lifecycle not re-executed in this pass.**

- `/live` returned HTTP 200 in development.
- Desktop and mobile layouts rendered with no document-level horizontal overflow or broken images.
- The page clearly shows `DEVNET`, `MOCK TxLINE`, and simulated-data labels in the current unconfigured environment.
- The UI states that markets resolve from TxLINE-compatible score data, not majority vote.
- The 5m, 15m, and 45m goal-window controls are present.
- Source inspection confirms live market creation still passes `marketKind: 1`.
- Source inspection confirms outcomes remain `["NO", "YES"]`, with `NO = 0` and `YES = 1`.
- Settlement and claim transaction surfaces remain present.

This pass did not connect a real wallet or submit create, buy, settle, or claim transactions, so it does not newly certify the full devnet lifecycle.

## Known Issues and Limitations

- Jest is not fully green because the RPC critical-path tests expect non-admin create-poll behavior while the current route enforces an admin check first.
- Supabase credentials are absent locally; offline/demo mode is expected.
- Real TxLINE/TxODDS credentials were not configured or validated. The UI correctly remains labeled as mock/simulated.
- `/live` contains two visible pre-existing copy defects: `iickTick Live Markets` and `hill either team score...`.
- On mobile `/live`, the buy/data-health rail appears before the central match detail, pushing primary match content farther down the page. It remains usable and does not overflow.
- The production build retains the existing `usersRef` hook dependency warning.
- The full wallet-connected create/buy/settle/claim devnet flow was not executed during this UI-only verification.

The `/live` copy and mobile ordering issues were not changed because they are outside the marketplace redesign files and the task limited fixes to regressions caused by the latest marketplace UI redesign.

