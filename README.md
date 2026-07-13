<p align="center">
  <h1 align="center">Whistly — Live Football Micro-Markets on Solana</h1>
  <p align="center">
    Trade <strong>YES/NO</strong> on the next football moment — "Goal in the next 5 minutes?" — with real devnet SOL.<br/>
    Markets resolve from <strong>TxLINE score data, not majority vote.</strong>
  </p>
  <p align="center">
    <em>Built for the TxODDS World Cup Hackathon · Track: Prediction Markets &amp; Settlement</em>
  </p>
  <p align="center">
    <a href="#what-it-is">What it is</a> ·
    <a href="#txline-integration">TxLINE Integration</a> ·
    <a href="#how-settlement-works">Settlement</a> ·
    <a href="#quick-start">Quick Start</a> ·
    <a href="#tech-stack">Tech Stack</a>
  </p>
</p>

---

> **Live demo:** [https://www.whistly.tech](https://www.whistly.tech) · **Network:** Solana **Devnet** · **Data:** TxLINE (TxODDS)
>
> Devnet SOL only — no real money. When TxLINE credentials are not configured, the app **fails closed** (settlement disabled) rather than faking data.

---

## What it is

**Whistly** turns live World Cup moments into short-window prediction markets on Solana. Instead of betting on a whole match, you trade the *next moment*:

- **Goal in next 5m / 15m / 45m?**
- Corners, cards, both-teams-to-score, over/under totals, match result

Each market is a real on-chain poll. You stake **devnet SOL** on **YES** or **NO**, the market locks, and it resolves from **real TxLINE score data** — then winners claim their share of the pool on-chain.

The core loop is deliberately honest: every market is labeled with its data source and settlement rule, and nothing is claimed as "verified" or "real-time" unless it actually is.

### Why it fits the hackathon

- **Uses TxLINE as the primary data source** for fixtures, live scores, and settlement evidence.
- **Deterministic, on-chain resolution** — goal-window outcome is a pure function of start/end score, settled by a wallet-signed transaction.
- **Fails closed** — no silent mock fallback; settlement is blocked unless TxLINE is configured or mock mode is *explicitly* enabled and labeled.

---

## TxLINE Integration

Whistly talks to the real TxLINE API (`txline-dev.txodds.com`) using the documented auth model.

### Endpoints used

| TxLINE endpoint | Purpose |
|---|---|
| `POST /auth/guest/start` | Auto-fetch a guest session JWT (public, no signup) |
| `GET /api/fixtures/snapshot` | Upcoming & live World Cup fixtures |
| `GET /api/scores/snapshot/{fixtureId}` | Score data used for settlement |
| `POST /api/token/activate` | Free-tier activation (wallet-signed) → data API token |

Every data request sends `Authorization: Bearer <guestJwt>` + `X-Api-Token: <apiToken>`.

### Fail-closed status system

`GET /api/txline/status` reports the honest state, and the whole UI keys off it:

| State | Meaning | Effect |
|---|---|---|
| `connected` | Real TxLINE data flowing | Settlement enabled |
| `not_configured` | No API token | **Settlement disabled**, "TxLINE Not Configured" shown |
| `error` | TxLINE request failed | **Settlement disabled**, "TxLINE Error" shown |
| `mock` | `NEXT_PUBLIC_ENABLE_MOCK_MODE=true` | Labeled "Mock Mode Enabled — not real TxLINE data" |

### One-click free-tier activation

TxLINE's free World Cup tier requires a one-time on-chain subscription. Whistly builds and sends this **from the user's wallet** at `/txline-setup`:

1. Fetch a guest JWT.
2. Wallet signs an on-chain `subscribe(level 1, 4 weeks)` to the txoracle program (`6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`) — no TxL payment, only devnet fees.
3. Wallet signs the activation message `${txSig}::${jwt}`.
4. Server exchanges it at `/api/token/activate` for the data API token (held server-side, never exposed to the browser).

After activation, upcoming fixtures load from the live feed and scores drive settlement.

---

## How settlement works

Goal-window markets resolve deterministically from score data:

```txt
startTotal = startHomeScore + startAwayScore   (recorded when the market opens)
endTotal   = endHomeScore   + endAwayScore     (fetched from TxLINE at window end)

YES wins  if  endTotal > startTotal
NO  wins  otherwise
```

Example: `1-1 → 2-1` resolves **YES**; `1-1 → 1-1` resolves **NO**.

### Market lifecycle

```txt
OPEN → LOCKED → RESOLVING → RESOLVED → CLAIMABLE
```

Settlement will **not** run if: TxLINE is unconfigured, the fixture or score is missing, the window hasn't ended, the market is already resolved, or the admin wallet isn't connected.

### Admin flow (wallet-signed)

The `/admin` panel lets an admin: view TxLINE status, list live markets with their `fixtureId` and start score, **fetch the end score (dry run)**, review the proposed winner and its data source, then **sign the settlement transaction with their wallet**. Nothing is recorded as settled until the on-chain transaction confirms.

### Mapping invariants

- `marketKind`: `0 = Standard`, `1 = LiveGoalWindow`
- Outcome index: `0 = NO`, `1 = YES`

---

## Features

- **Real devnet SOL staking & payout** — create market, buy YES/NO, settle, claim — fully on-chain via an Anchor program.
- **Live football micro-markets** — 5m / 15m / 45m goal windows plus corners, cards, totals, and match result.
- **Upcoming fixtures widget** — real TxLINE fixture feed with an explicit "TxLINE live feed" vs "Mock data" badge.
- **Live probability graph** — YES/NO implied probability drawn from the *actual on-chain pool*, updating as trades land.
- **Per-market comments** — wallet-gated discussion keyed to each market.
- **TxLINE Data Health widget** — live connected / not-configured / error / mock state on `/live` and `/admin`.
- **Honest UI copy** — "Devnet SOL only", "Settlement disabled until TxLINE is configured", "Markets resolve from score data, not majority vote".
- **Dark premium marketplace UI** — dense card grid, featured hero market, category filters, responsive down to 360px.

---

## Routes

| Route | Purpose |
|---|---|
| `/` | Marketplace homepage — featured market, live now, category grids, upcoming fixtures |
| `/live` | Live goal-market terminal — window controls, trade panel, graph, comments |
| `/world-cup` | World Cup market discovery + upcoming fixtures |
| `/verify` | Settlement verification & proof |
| `/portfolio` | Your positions, P&L, claims |
| `/polls` | Full prediction-market listing |
| `/admin` | Wallet-gated admin + TxLINE settlement panel |
| `/txline-setup` | TxLINE status + one-click free-tier activation |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Solana (Devnet) |
| Smart contract | Anchor (Rust) |
| Data layer | TxLINE / TxODDS |
| Frontend | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS |
| Wallet | `@solana/wallet-adapter` (Phantom, etc.) |
| Off-chain | Supabase (comments, images) — optional |

---

## Quick Start

### Prerequisites

- Node.js ≥ 18
- A Solana wallet (Phantom) set to **Devnet**
- Some devnet SOL (in-app faucet or `solana airdrop 2`)

### Run

```bash
git clone https://github.com/rajanpanth/Whistly.git
cd Whistly/app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Create `app/.env.local`:

```env
# --- TxLINE (real data) ---
# All required for real data; without them the app FAILS CLOSED.
TXLINE_BASE_URL=https://txline-dev.txodds.com
TXLINE_GUEST_JWT=            # optional — auto-fetched from /auth/guest/start
TXLINE_API_TOKEN=            # required — from /api/token/activate (or the in-app activation)

# --- Mock mode (demo only) ---
# Explicit opt-in for clearly-labeled mock football data. Never enabled implicitly.
NEXT_PUBLIC_ENABLE_MOCK_MODE=false
```

**To get real data:** open `/txline-setup` with a devnet-funded wallet and click **Activate with wallet**, or run the official TxODDS `subscription_free_tier.ts` script and paste the resulting token into `TXLINE_API_TOKEN`.

**For a labeled demo without credentials:** set `NEXT_PUBLIC_ENABLE_MOCK_MODE=true` — all mock data is clearly labeled in the UI.

---

## Project Structure

```
Whistly/
├── programs/                     # Anchor program (Rust)
├── tests/                        # Anchor tests
├── audit-notes/                  # Technical docs & verification notes
└── app/                          # Next.js 15 frontend
    └── src/
        ├── app/
        │   ├── live/             # Live goal-market terminal
        │   ├── admin/            # Admin + TxLINE settlement panel
        │   ├── txline-setup/     # Free-tier activation flow
        │   └── api/
        │       ├── txline/       # status, fixtures, scores, guest-jwt, activate
        │       └── markets/      # create-live-goal, resolve-live-goal
        ├── components/           # Marketplace UI, graphs, widgets
        └── lib/
            └── txline/           # Fail-closed client, adapters, auth
```

---

## Honest limitations

- Real fixtures/scores appear **only after** the one-time wallet activation (or a `TXLINE_API_TOKEN` env var) — TxLINE requires an on-chain subscription even for the free tier, so there is no credential-free path to real data.
- The score-payload parser follows the documented TxLINE schema and fails closed if a payload can't be parsed; it should be sanity-checked against one live fixture after activation.
- On-chain TxLINE proof validation (`validate_stat_v3`) is **not** implemented, and the UI never claims it.
- Live-market metadata is held in-memory server-side (resets on restart); on-chain poll state is the source of truth for funds.

---

## License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for details.
