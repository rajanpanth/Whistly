# Whistly real TxLINE credential verification pass — 2026-07-12

## Verdict
**NOT VERIFIED.** Real TxLINE credentials do not exist in this environment, so a
real-data verification could not honestly be completed. No success was faked.
What WAS verified: the app's fail-closed behavior against the real TxLINE API,
live TxLINE reachability via the public guest-session endpoint, and every
settlement/creation gate.

## Env status (no secret values shown)
Read from `app/.env.local`:

| Variable | Status |
|---|---|
| `NEXT_PUBLIC_ENABLE_MOCK_MODE` | was `true`; set to `false` for this pass and left `false` |
| `TXLINE_BASE_URL` | **not set** (commented out; client defaults to the devnet origin) |
| `TXLINE_GUEST_JWT` | **not set** (optional — auto-fetched from `/auth/guest/start`) |
| `TXLINE_API_TOKEN` | **not set** — this is the blocker |

Also checked the running server's runtime store via `/api/txline/status`:
`configured: false` — the in-app free-tier wallet activation has never been
completed, so no runtime API token exists either.

## Endpoint results (mock OFF, no credentials — fresh server)
- `GET /api/txline/status` → HTTP 200
  `status: "not_configured"`, `connected: false`, `mockModeEnabled: false`,
  `settlementEnabled: false`, missing: `TXLINE_API_TOKEN (or run the in-app
  free-tier activation)`, note: "TxLINE Not Configured — settlement disabled
  until TxLINE is configured."
- `GET /api/txline/fixtures` → HTTP 503 `txline_not_configured` (honest error, no data leak, no mock fallback)
- `GET /api/txline/scores/17588320` (real fixture id from TxODDS examples) → HTTP 503 `txline_not_configured`
- `POST /api/txline/guest-jwt` → HTTP 200 — a real guest JWT was issued by
  `txline-dev.txodds.com/auth/guest/start`, proving live TxLINE reachability
  and correct auth plumbing up to the API-token boundary.
- Direct upstream check (prior session, reconfirmed behavior): guest JWT alone
  against `GET /api/fixtures/snapshot` → HTTP 403 "Missing API token" — TxLINE
  itself requires the activated API token even for the free World Cup tier.

## Gate verification (all pass)
- Market creation without `fixtureId` → HTTP 400 `missing_fixture_id`.
- Market creation with a fixtureId but no TxLINE → HTTP 503 `txline_not_configured`.
- Mock scenario route with mock off → HTTP 403 `mock_mode_disabled`.
- `/live` UI: "TXLINE NOT CONFIGURED" badge, red banner ("market creation and
  settlement are disabled…"), resolution card reads "Settlement disabled until
  TxLINE is configured", Data Health widget shows NOT CONFIGURED with
  Settlement: Disabled, no MOCK badge, no demo controls, no horizontal overflow.
- Admin settlement remains wallet-signed only (`settlePoll` → record tx after
  confirmation); nothing in this pass touched Anchor/IDL/wallet/staking/
  settlement/claim/RPC logic. Settlement preparation (dry-run) calls the score
  route, which correctly refuses without TxLINE.

## Parser changes
None. The adapters could not be exercised against real fixture/score payloads
because no API token exists; changing the parser without real data would be
guesswork. The adapters follow the published OpenAPI schema
(`Fixture`, `Scores`/`SoccerTotalScore`) and fail closed if a payload doesn't parse.

## TypeScript / build
- `npx tsc --noEmit` — **passed**.
- `npm run build` — **passed** (compiled successfully, 48/48 static pages).

## What needs fixing to complete real verification
TxLINE's free World Cup tier requires a one-time on-chain devnet `subscribe`
transaction signed by a user wallet, then a wallet-signed activation message
exchanged at `/api/token/activate`. An agent cannot and should not sign with
the user's wallet. One of:
1. Open **/txline-setup** with a devnet-funded wallet and click
   "Activate with wallet" (two approvals; no TxL payment, devnet fees only), or
2. Run the official `txodds/tx-on-chain` devnet script
   (`subscription_free_tier.ts`) with a keypair and paste the resulting token
   into `TXLINE_API_TOKEN` in `app/.env.local`, then restart.

After either step, re-run this pass: `/api/txline/status` should return
`connected`, `/api/txline/fixtures` should list real World Cup fixtures, and
the scores adapter should be sanity-checked against one real fixture.

## Known issues / notes
- Mock mode is now OFF; until activation, the site intentionally shows
  "Not Configured" states instead of demo data (this is the honest behavior the
  spec requires). Re-enable the flag only if a labeled demo is preferred.
- The scores parser remains best-effort against the documented schema and is
  the first thing to validate once a token exists.
- The in-memory live-goal market store resets on server restart (metadata only;
  on-chain state is the source of truth for funds).
