# Whistly TxODDS/TxLINE integration pass — 2026-07-12

## Update 2 — Real API wiring + in-app free-tier activation

- `lib/txline/client.ts` now targets the REAL TxLINE API (spec: txline.txodds.com/docs/docs.yaml):
  `POST {origin}/auth/guest/start`, `GET {origin}/api/fixtures/snapshot`,
  `GET {origin}/api/scores/snapshot/{fixtureId}`. Default origin is the devnet
  server `https://txline-dev.txodds.com` (override via `TXLINE_BASE_URL`).
- Guest JWT is now AUTO-FETCHED server-side (public endpoint, verified live —
  HTTP 200) and renewed on 401. `TXLINE_GUEST_JWT` is optional; only the API
  token gates real data.
- Adapters map real payloads to app types: fixtures (Participant1IsHome →
  home/away, GameState → status, StartTime → kickoff) and scores (best-effort
  goal totals summed from SoccerTotalScore periods; throws — fails closed — if
  unparseable rather than guessing).
- `lib/txline/runtimeAuth.ts` — server-side runtime store for guest JWT + API
  token (never sent to the browser).
- NEW `POST /api/txline/guest-jwt` — server proxy issuing guest sessions (live-verified).
- NEW `POST /api/txline/activate` — forwards {txSig, walletSignature, leagues, jwt}
  to TxLINE `/api/token/activate`, stores the returned API token server-side.
- NEW `components/TxLineActivation.tsx` on /txline-setup — one-click free World
  Cup tier activation: builds the on-chain `subscribe(1, 4 weeks)` instruction
  for the txoracle program (`6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`,
  discriminator from the official IDL; devnet TxL mint
  `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG`; Token-2022 ATA created
  idempotently if missing), signed and sent by the USER's wallet, then the
  wallet signs `${txSig}::${jwt}` and the server exchanges it for the API token.
  Free tier costs no TxL — only devnet fees/rent.
- NEW `components/UpcomingFixtures.tsx` — upcoming-matches list (teams, kickoff
  countdown + local time, fixtureId, LIVE badge) with an explicit source badge:
  "TxLINE live feed" vs "Mock data", and honest not-configured/error states.
  Rendered on the homepage sidebar, /world-cup sidebar, and /txline-setup.
- Verified: tsc clean; production build 48/48 with all six txline routes;
  guest-jwt proxy returns a real TxLINE JWT; status route reports the new
  configured semantics; /txline-setup renders activation + fixtures.
- Honest limitation: real fixtures/scores appear only AFTER the one-time
  wallet activation (or a TXLINE_API_TOKEN env var) — TxLINE requires an
  on-chain subscription even for the free tier, so there is no credential-free
  path to real data. Until then the UI shows labeled mock data (mock mode is
  explicitly on in `.env.local`) or honest "Not Configured" states. The
  score-payload parser is best-effort against the documented schema and has not
  yet been exercised with live score data.


## Summary
Reworked the TxLINE data layer to be honest and fail-closed, added a real status
endpoint, an admin settlement panel, per-market comments, and a live
market-behaviour graph. Existing devnet SOL staking/payout through the Anchor
program is unchanged and remains the money path.

## Files changed
- `app/src/lib/txline/client.ts` — fail-closed client (rewritten).
- `app/src/lib/txline/auth.ts` — configured-check now uses the three required vars.
- `app/src/app/api/txline/status/route.ts` — NEW status endpoint.
- `app/src/app/api/txline/fixtures/route.ts` — fail-closed, returns `source`.
- `app/src/app/api/txline/scores/[fixtureId]/route.ts` — fail-closed, returns `source`.
- `app/src/app/api/txline/demo/route.ts` — 403 unless mock mode is explicitly enabled.
- `app/src/app/api/markets/create-live-goal/route.ts` — requires a valid `fixtureId` (no silent fixture fallback); blocked when TxLINE unavailable.
- `app/src/app/api/markets/resolve-live-goal/route.ts` — settlement blocked without score data; `dryRun` support for admin proposals; `already_resolved` guard; honest `resolutionSource` (`TXLINE_SCORE` vs `MOCK`).
- `app/src/components/kicktick/DataHealthWidget.tsx` — now fetches `/api/txline/status` (30s poll) instead of static props.
- `app/src/app/live/page.tsx` — TxLINE UI state (connected/mock/not_configured/error), honest hero badges/banners, create/resolve gated on data availability, demo controls hidden unless mock mode, real per-market comments, live graph.
- `app/src/components/LiveMarketGraph.tsx` — NEW: live implied-probability graph from the real on-chain pool counts.
- `app/src/app/admin/TxLineSettlementPanel.tsx` — NEW admin settlement panel.
- `app/src/app/admin/page.tsx` — renders the panel (behind the existing admin-wallet gate).
- `app/src/app/txline-setup/page.tsx` — corrected env-var copy.
- `app/.env.example` — documents TxLINE vars + mock flag.
- `app/.env.local` — NEW (local only): `NEXT_PUBLIC_ENABLE_MOCK_MODE=true` so the demo runs with labeled mock data until real credentials are pasted.

## Env vars required for real data
- `TXLINE_BASE_URL`
- `TXLINE_GUEST_JWT` — sent as `Authorization: Bearer <jwt>`
- `TXLINE_API_TOKEN` — sent as `X-Api-Token: <token>`
- `NEXT_PUBLIC_ENABLE_MOCK_MODE` — explicit opt-in for labeled mock data; never implied.

## Status route behavior (`GET /api/txline/status`)
Returns `status` (connected | not_configured | error | mock), `connected`,
`configured`, `mockModeEnabled`, `missingEnvVars`, `settlementEnabled`,
`network: devnet`, `lastCheckedAt`, per-service states (fixtures/scores/odds),
and an honest `note`. When configured it live-probes TxLINE (cached 15s) to
distinguish `connected` from `error`. Verified locally: with mock mode on it
returns `status: "mock"`, lists all three missing env vars, and labels the note
"Mock Mode Enabled — not real TxLINE data."

## Fail-closed rules now enforced
- No TxLINE credentials + mock off → fixtures/scores return 503
  `txline_not_configured`; /live shows "TXLINE NOT CONFIGURED" and disables
  market creation and settlement; demo scenario routes return 403.
- TxLINE request failure → 502 `txline_error`; settlement blocked.
- Market creation requires a `fixtureId` that exists in the fixture feed — the
  previous silent `?? fixtures[0]` fallback was removed.
- Settlement (resolve route) refuses to run without score data; resolution
  source is recorded as `MOCK` or `TXLINE_SCORE` from the actual source used,
  never assumed.
- `forceDemo` early-resolution only works when mock mode is explicitly enabled.

## Admin settlement behavior (/admin)
Behind the existing admin-wallet gate: TxLINE status pill, settlement
enabled/disabled banner, list of live goal-window markets with fixtureId, start
score, window end, and on-chain poll address. Flow: "Fetch end score & propose"
(dry-run resolve — nothing written) → shows end score, proposed winner, and the
data source (TxLINE vs Mock) → "Sign & settle on-chain" calls the existing
wallet-signed `settlePoll`; the resolve route records the outcome ONLY after a
confirmed settlement transaction signature exists. Settlement tx links to the
Solana devnet explorer.

## Comments
The /live "Comments" tab now renders the real `PollComments` component keyed by
the market's on-chain poll address (Supabase-backed; localStorage fallback in
offline dev). Comments are per-market and wallet-gated for posting.

## Live graphs
`LiveMarketGraph` renders on /live for the selected market: implied YES/NO
probability computed from the REAL on-chain pool (vote counts), sampled every
3s with per-market history retained. It moves when trades land — no simulated
values. (The homepage hero chart is a separate, labeled demo visualization.)

## Proof/validation status (honest)
- TxLINE proof/`validate_stat_v3` on-chain validation is NOT implemented and is
  NOT claimed anywhere. Resolution source `TXLINE_PROOF` exists in the type
  union but is never set.
- UI copy says "Resolved by TxLINE score data" only when connected; otherwise
  "Mock Mode" or "Settlement disabled until TxLINE is configured."

## SOL staking (unchanged)
Users stake real devnet SOL from their wallet via the existing Anchor program:
`createPoll` (marketKind 1), `castVote` (stake × unit price in lamports),
wallet-signed `settlePoll`, `claimReward`. None of this logic was modified.

## Validation
- `npx tsc --noEmit` — passed.
- `npm run build` — compiled successfully, 48/48 pages, `/api/txline/status` in route table.
- `/` , `/live`, `/admin` render without console errors.
- `/live` verified showing: MOCK TxLINE badge, "Mock Mode Enabled — not real
  TxLINE data" banner, "Devnet SOL only" copy, TxLINE Data Health widget with
  Settlement row, 5/15/45 min controls, Comments tab.
- `/api/txline/status` and `/api/txline/fixtures` verified via curl.

## Known limitations
- Real TxLINE request paths (`/fixtures`, `/scores/:id`) follow the docs'
  quickstart shape but have not been exercised against live credentials — the
  response mapping may need a small adapter once real credentials are available.
- Odds endpoints are not implemented (`odds: not_implemented` in status); odds
  are display-context only per design.
- Live goal market metadata store is in-memory (resets on server restart);
  on-chain poll state is the source of truth for funds.
- The fail-closed (`not_configured`) path was verified by code review and type
  checks; the running dev server has mock mode explicitly enabled via
  `.env.local`.
