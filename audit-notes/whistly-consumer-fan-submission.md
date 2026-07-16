# Whistly Matchday — Consumer & Fan Experiences Submission Pack

Updated: 2026-07-16

## Submission identity

**Product:** Whistly Matchday  
**Track:** Consumer and Fan Experiences  
**Tagline:** The live World Cup companion that turns every few minutes into a friendly prediction battle.

Whistly Matchday is the hackathon submission. It is a new fan product built specifically for the TxODDS World Cup initiative inside the Whistly repository. The older Whistly prediction-market application is not the submitted product and is not presented as the track deliverable.

This distinction matters because the hackathon FAQ says legacy projects are not eligible merely for adding TxODDS. Matchday therefore has its own route group, UI shell, database schema, scoring engine, APIs, replay experience, test suite, product identity, and user journey. The shared repository supplies existing Solana wallet infrastructure, but the submitted fan experience is new work.

## Track fit

The official track asks for fan-facing World Cup apps, games, bots, or social experiences that use TxODDS live match data to update during games and keep fans engaged. Whistly Matchday does exactly that:

- Fans make free YES/NO calls on whether a goal will occur in the next 5, 15, or 45 minutes.
- TxLINE fixture, clock, score, match-state, and goal packets drive the interface and determine results.
- Correct calls earn 100 points. Consecutive correct calls increase the multiplier to 1.5×.
- Private friend rooms turn the match into a group-chat competition with live standings.
- Stadium reactions add low-friction social participation.
- Post-match recaps show points, accuracy, best streak, and room rank.
- Historical replay uses TxLINE's real historical endpoint and never silently substitutes mock events.

There is no entry fee, wagering, deposit, prize pool, or financial payout in Matchday. A wallet signature is used only as a portable Solana identity for scores and rooms.

## The fan problem

Most companion products stop at a scoreboard or odds table. They report the match but do not give a group of friends a lightweight reason to return every few minutes. Existing fantasy products are often season-long, setup-heavy, and disconnected from what is happening right now.

Whistly Matchday creates a repeating match loop:

1. See the real fixture and match state.
2. Make a one-tap prediction about the next moment.
3. Watch the live clock and goal timeline.
4. Get an automatic result from TxLINE.
5. Build a streak and move through a friend leaderboard.
6. Share a recap and return for the next match.

## Judge walkthrough

### Public routes

- `/matchday` — real fixture discovery and TxLINE connection state.
- `/matchday/[fixtureId]` — live score, goal windows, timeline, picks, reactions, room leaderboard.
- `/rooms/[roomId-or-code]` — private invite room and live standings.
- `/fan-leaderboard` — join a room by code.
- `/fan-profile` — portable fan identity.
- `/recap/[fixtureId]` — authenticated post-match report.
- `/matchday/replay` — provider-backed historical replay browser.

### Main user flow

1. Open Matchday without connecting a wallet and browse real fixtures.
2. Open a live fixture. The page refreshes match state every three seconds.
3. Choose YES or NO for an open goal window.
4. Connect a Solana wallet and sign the human-readable Whistly login message.
5. The prediction is stored once and locks at the window boundary.
6. Create a friend room, share the eight-character invite code, and invite another fan.
7. When TxLINE reports the boundary score, the resolver awards points atomically and updates the room table.
8. At full time, open the recap.

## Judging-criteria mapping

### Fan Accessibility & UX

- One-tap binary choices with plain football language.
- Browsing is wallet-free; the wallet is requested only when identity is needed.
- No trading terms, token prices, deposits, or crypto balance concepts appear in Matchday.
- Dedicated desktop and mobile layouts, sticky mobile bottom navigation, honest empty/error states, reduced-motion support, and no horizontal overflow.
- Visual regression baselines exist for discovery and the full live companion at 1440×900 and 390×844.

### Real-Time Responsiveness

- Match state refreshes every three seconds while the page is open.
- TxLINE clock seconds, cumulative score, goal actions, finished/postponed/abandoned/cancelled state, and data timestamps are normalized at the adapter boundary.
- Open challenges are resolved only from a fresh real feed.
- A stale feed pauses new challenges and resolution.
- Interrupted fixtures void open challenges without points or streak damage.
- Production never silently falls back to mock data.

### Originality & Value Creation

- The primary interaction is not another feed viewer: it is a repeating, score-driven micro-prediction game for private groups.
- Multiple window lengths let casual and highly engaged fans play at the same time.
- Streak multipliers create narrative and retention without requiring money.
- Real historical replay gives judges, creators, and future users an inspectable story between live matches.

### Commercial & Monetization Path

1. **Sponsored rooms:** brands or broadcasters sponsor a room, match, or challenge set.
2. **Club and creator communities:** paid customization, moderation, branded avatars, and season-level group history.
3. **Broadcast companion SDK:** license embeddable prediction cards and room leaderboards to publishers.
4. **Premium fan analytics:** optional personal form, rivalry history, and group insights after the free core loop proves retention.
5. **Campaign tooling:** non-cash sponsor rewards can be layered later subject to local promotional-game rules.

The core game remains free, which reduces regulatory risk and maximizes mainstream adoption.

### Completeness & Execution

- End-to-end fixture discovery, live challenges, prediction locking, deterministic scoring, friend rooms, reactions, profiles, leaderboards, recaps, and replay.
- JWT wallet authentication with domain and timestamp binding.
- Supabase schema with constraints, RLS, unique picks, and atomic resolver RPC.
- Rate-limited reactions and protected internal sync endpoint.
- Production fail-closed storage and TxLINE behavior.
- Automated unit, integration, production-build, responsive, and homepage-freeze tests.

## TxLINE integration

### Provider endpoints used

- `POST /auth/guest/start` — obtain the renewable guest JWT.
- `GET /api/fixtures/snapshot` — current fixture catalog.
- `GET /api/fixtures/snapshot?startEpochDay=…` — real completed-fixture catalog for replay.
- `GET /api/scores/snapshot/{fixtureId}` — current clock, score, match state, and recent goal actions.
- `GET /api/scores/historical/{fixtureId}` — full provider-backed historical replay sequence.
- `POST /api/token/activate` — existing in-app activation flow after the Solana subscription transaction.

### Data safety rules

- `TXLINE_API_TOKEN` wins over all other sources.
- Mock mode is opt-in through `NEXT_PUBLIC_ENABLE_MOCK_MODE=true` and is visibly labelled.
- Missing production credentials return an explicit not-configured state.
- Live challenge creation, automated resolution, and verification claims stop when the feed is absent or stale.
- Total goals prefer TxLINE's cumulative `Total` bucket so period and cumulative values are never double-counted.
- Goal windows use `0 = NO`, `1 = YES`; YES wins only when end total goals exceed start total goals.

## Architecture

```text
TxLINE guest JWT + API token
        │
        ├── fixture snapshot ──> /api/fan/fixtures ──> Matchday discovery
        │
        ├── score snapshot ────> challenge synchronizer
        │                           ├── create unique 5/15/45m windows
        │                           ├── fail closed on stale data
        │                           ├── void interrupted fixtures
        │                           └── atomic result + room score RPC
        │
        └── historical scores ─> /api/fan/replay/* ─> real replay UI

Solana wallet signature ──> domain-bound JWT ──> picks / rooms / reactions / profile
                                                   │
                                                   └── Supabase fan_* tables
```

## Five-minute demo video script

The video is an absolute screening requirement. Record at 1440×900, then briefly show the 390×844 mobile view.

**0:00–0:25 — Problem and product**  
“Football is social, but most second-screen products only report scores. Whistly Matchday turns the next few minutes of a real World Cup match into a free prediction battle with friends.”

**0:25–0:55 — Real TxLINE discovery**  
Open `/matchday`. Point to `TxLINE Connected`, the real fixtures, statuses, kickoff times, and search/filter controls. State that no fallback is mixed into this view.

**0:55–1:35 — Live match loop**  
Open a live match during the third-place match or final. Show the clock, score, update time, goal timeline, and 5/15/45-minute challenges. Make a YES or NO pick and show the immediate locked state.

**1:35–2:20 — Solana identity and friend room**  
Explain the readable signature and that no transaction or deposit is authorized. Create a room, copy the invite code, join from a second browser/wallet if available, and show both names on the leaderboard.

**2:20–3:00 — Automatic scoring**  
Show a TxLINE-driven resolved window. Explain the 100-point base, streak multiplier, unique-pick constraint, stale-feed pause, and interrupted-fixture void rule.

**3:00–3:30 — Social engagement**  
Tap reactions, show live totals, and open the post-match recap.

**3:30–4:05 — Historical replay**  
Open `/matchday/replay`, choose a real completed fixture from the TxLINE catalog, load it, and scrub through provider packets and goal moments. Explicitly say replay is real historical data and cannot settle live picks.

**4:05–4:30 — Mobile**  
Switch to 390×844. Show one-tap stacked choices, score card, reactions, and bottom navigation with no horizontal overflow.

**4:30–5:00 — Technical proof and business**  
Show the public repo, `supabase-fan-matchday.sql`, automated test result, and TxLINE endpoint list. Close with sponsored rooms, creator communities, and a broadcast companion SDK.

Do not record the full live section using unlabeled fake data. If a live match is unavailable, use visibly labelled mock mode for interaction mechanics and immediately show the real TxLINE historical replay plus the real connected fixture catalog.

## Ready-to-paste Superteam submission copy

### Title

Whistly Matchday — Live World Cup Prediction Rooms

### One-line summary

A free, mobile-first World Cup companion where fans predict the next goal window, build streaks, react live, and compete in private friend rooms powered by TxLINE.

### Description

Whistly Matchday turns real World Cup data into a repeating social game. During a match, TxLINE opens 5, 15, and 45-minute “will there be a goal?” challenges. Fans make one-tap free predictions, build streak multipliers, and climb private room leaderboards with friends. TxLINE clock, score, goal, and match-state updates lock and resolve each challenge. The product also includes reactions, portable Solana fan profiles, post-match recaps, and a real historical replay mode for between-match discovery.

Matchday was built specifically for this hackathon as a separate product surface and technical stack within the repository. It does not require deposits or wagering; a Solana signature provides portable identity only.

### Business and product highlights

- Mainstream football UX with wallet-free browsing.
- Sponsor-branded rooms and challenges.
- Paid community tools for clubs, creators, and supporter groups.
- Embeddable broadcast/publisher companion SDK.
- Free core game designed to build repeat matchday engagement.

### Technical highlights

- Real TxLINE fixture, score snapshot, clock, goal-event, match-state, and historical replay inputs.
- Three-second live refresh and explicit source/freshness UI.
- Fail-closed live lifecycle with unique windows and picks.
- Atomic resolution and room scoring in Supabase.
- Domain-bound Solana wallet authentication.
- Responsive visual regression coverage and deterministic scoring tests.

### TxLINE feedback

**What worked well:** the guest-JWT plus long-lived API-token model was straightforward to isolate server-side; fixture snapshots, score snapshots, historical sequences, and the documented soccer phase/stat encodings cover the entire product lifecycle; the normalized fixture IDs make live and replay views easy to connect.

**Friction encountered:** fixture fields use PascalCase while score packets use a mix of lower camel case and nested sport-specific objects; soccer score packets can contain both period and cumulative totals, so integrators must avoid double-counting; clock and goal-action extraction would benefit from a small canonical soccer example for each phase; a direct “recent completed fixtures with replay available” endpoint would simplify consumer replay discovery.

### Links to fill before submitting

- Live app: `https://whistly.tech/matchday` after deployment
- Demo video: upload the recorded five-minute walkthrough to Loom or YouTube
- Public repo: `https://github.com/rajanpanth/Whistly` after the Matchday branch is pushed/merged

## Production deployment checklist

1. Apply `app/supabase-fan-matchday.sql` to the production Supabase project.
2. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
3. Configure `AUTH_JWT_SECRET`, `TXLINE_API_TOKEN`, `NEXT_PUBLIC_SITE_URL`, and `FAN_CRON_SECRET`.
4. Keep `NEXT_PUBLIC_ENABLE_MOCK_MODE=false` and `FAN_ALLOW_MEMORY_STORE=false`.
5. Deploy the new build and verify `/api/fan/fixtures` returns `source: txline`.
6. Schedule `POST /api/fan/internal/sync-fixture` for active fixture IDs with the `x-fan-cron-secret` header. The page also synchronizes on read; the cron keeps scoring moving when no fan has a tab open.
7. Test one real wallet signature, room creation, second-wallet join, prediction, reaction, and recap.
8. Record and upload the demo video before July 19, 2026 at 23:59 UTC.

## Verification evidence

- TypeScript: pass.
- Jest: 132 passing, 14 skipped, 0 failing.
- Production build: pass.
- Homepage freeze: desktop, mobile, and DOM skeleton pass.
- Matchday visual tests: discovery and live companion pass on desktop and mobile.
- Real local TxLINE probe: connected; fixture API returned current World Cup fixtures with `source: txline`.
- Real replay probe: 88 completed fixtures discovered; fixture `18241006` returned 887 historical packets and three authoritative goal-score transitions.
- Demo B-roll: generated locally at `demo-video/whistly-matchday-real-data-broll.webm` from the real fixture catalog and replay API.

## Remaining external actions

- Production Supabase credentials are not present locally, so the migration cannot be applied from this workspace.
- Deployment authority/session for `whistly.tech` is not available here.
- The required Loom/YouTube upload is an external publication action and needs the owner's account.
- The repository changes must be pushed or merged before the public-repo link contains Matchday.
