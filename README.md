<p align="center">
  <h1 align="center">InstinctFi — On-Chain Prediction Markets on Solana</h1>
  <p align="center">
    Buy option-coins on prediction polls. Winners take the entire losing pool.<br/>
    <strong>Real SOL · Real stakes · Fully on-chain</strong>
  </p>
  <p align="center">
    <a href="#quick-start">Quick Start</a> ·
    <a href="#features">Features</a> ·
    <a href="#architecture">Architecture</a> ·
    <a href="#tech-stack">Tech Stack</a> ·
    <a href="#contributing">Contributing</a>
  </p>
</p>

---

## InstinctFi Live Goal Markets

**InstinctFi Live Goal Markets** brings BTC-style short-window prediction markets to live football.

Users open a live/demo football match, choose **Goal in next 5 minutes?**, **Goal in next 15 minutes?**, or **Goal in next 45 minutes?**, buy **YES** or **NO**, and claim payouts on Solana after the market resolves.

Markets resolve from match score data, not majority vote.

### Why It Fits The World Cup Hackathon

- Turns live World Cup moments into short, high-energy Solana markets.
- Uses TxODDS/TxLINE-style fixture and score data to resolve real-world outcomes.
- Keeps the existing InstinctFi on-chain payout flow: buy position, resolve market, claim payout.
- Includes mock TxLINE mode so the full demo works even without live matches or API keys.

### Live Goal Settlement Logic

```txt
If total goals at end of window > total goals at start of window:
    YES wins
Else:
    NO wins
```

Example: `1-1` to `2-1` resolves to **YES**. `1-1` to `1-1` resolves to **NO**.

### Market Lifecycle

```txt
OPEN -> LOCKED -> RESOLVING -> RESOLVED -> CLAIMABLE
```

Markets lock before resolution. Results are resolved from TxLINE score data and then written on-chain through the existing admin settlement flow.

### Demo Mode

The `/live` page includes a mock match:

```txt
Nepal vs Brazil
Clock: 63:00
Score: 1 - 1
```

Demo controls support:

- Start demo match
- Simulate goal: YES wins
- Simulate no goal: NO wins
- Resolve market
- Claim payout

### Environment Variables

```env
TXLINE_BASE_URL=
TXLINE_SESSION_TOKEN=
TXLINE_API_TOKEN=
TXLINE_USE_MOCK=true
ADMIN_PRIVATE_KEY=
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
```

When TxLINE credentials are missing, the app uses mock mode by default.

<!-- 🔗 Replace with your actual deployed URL when available -->
> **Live Demo:** [https://instinct-fi.vercel.app](https://instinct-fi.vercel.app/) *(Solana Devnet)*

---

## Table of Contents

- [About the Project](#about-the-project)
- [Civic Engagement & Janamat (जनमत)](#civic-engagement--janamat-जनमत)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Run the Frontend](#2-run-the-frontend)
  - [3. Build & Deploy Smart Contracts (Optional)](#3-build--deploy-smart-contracts-optional)
  - [4. Get Devnet SOL](#4-get-devnet-sol)
- [Project Structure](#project-structure)
- [On-Chain Programs](#on-chain-programs)
- [Tokenomics](#tokenomics)
- [Security](#security)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## About the Project

**InstinctFi** is a decentralized prediction-market platform built on **Solana** using the **Anchor framework**. Users connect their Phantom wallet, create or participate in prediction polls by purchasing "option-coins" with real SOL, and earn proportional rewards when their predicted option wins.

All poll creation, voting, settlement, and reward distribution logic runs **entirely on-chain** via Program Derived Addresses (PDAs) — no centralized servers control funds.

### Why InstinctFi?

| Problem | Solution |
|---------|----------|
| Centralized platforms can manipulate outcomes | Fully on-chain, transparent, immutable |
| No audit trail for votes or fund distribution | Every vote and transfer recorded on Solana |
| Free polls → low-quality predictions | Real SOL stakes → skin in the game |
| No financial incentive | Winners take the entire losing pool |

---

## Civic Engagement & Janamat (जनमत)

InstinctFi isn't just a prediction market — it's a **decentralized civic engagement platform**. Traditional opinion polls are cheap: anyone can click a button without consequence. Prediction markets flip this by requiring participants to **stake real value**, ensuring opinions are informed and genuine.

This makes InstinctFi a powerful tool for **Janamat (जनमत — public opinion)** collection:

| Use Case | How InstinctFi Helps |
|----------|---------------------|
| **Policy Forecasting** | Will a proposed policy succeed? Citizens stake their conviction with real SOL. |
| **Community Governance** | DAOs and local bodies can gauge informed public sentiment through prediction polls. |
| **Accountability Tracking** | Track whether elected officials deliver on promises via community-driven markets. |
| **Decentralized Janamat Sangrah (जनमत संग्रह)** | On-chain, transparent, tamper-proof public opinion collection — no central authority can censor or manipulate results. |

> **Why prediction markets > traditional polls?**
> Research consistently shows that prediction markets produce more accurate forecasts than surveys or expert panels, because participants have *skin in the game*. InstinctFi brings this proven mechanism on-chain with Solana's speed and transparency.

**Example civic polls:**
- 🇳🇵 "Should Kathmandu implement an odd-even vehicle rule?"
- 🏗️ "Will Nepal's digital ID rollout complete by 2027?"
- 🗳️ "Should ward-level budgets be decided by community polls?"
- ✈️ "Will Pokhara International Airport reach 1M passengers by 2028?"

---

## Features

- **Phantom Wallet Auth** — One-click login, no passwords or email
- **Create Prediction Polls** — Custom options, duration, unit price, and initial SOL investment
- **Option-Coin Voting** — Buy coins for your predicted option; more coins = higher conviction & reward
- **Trustless Settlement** — Anyone can trigger settlement after the poll ends; highest-vote option wins
- **Proportional Rewards** — Winners split the entire prize pool proportional to their coin count
- **Multi-Period Leaderboard** — Weekly, monthly, and all-time rankings with multiple sort criteria
- **Rich Profile Dashboard** — Personal stats, created polls, vote history, net profit tracking
- **Dark Mode UI** — Polished dark theme with smooth Framer Motion animations
- **PWA Support** — Installable as a Progressive Web App
- **Image Uploads** — Poll images via Supabase storage with compression
- **Multi-Language Support** — Internationalization-ready with language toggle
- **Real-Time Notifications** — In-app notification bell for poll activity
- **Poll Comments** — Community discussion on each poll
- **Share & Embed** — Share polls via link or embed in external sites
- **Activity Feed** — Platform-wide activity stream
- **Admin Panel** — Admin wallet management for poll moderation

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Blockchain** | Solana (Devnet) |
| **Smart Contracts** | Anchor 0.30.1 (Rust) |
| **Frontend** | Next.js 15, React 19, TypeScript |
| **Styling** | Tailwind CSS 3.4, Framer Motion |
| **Wallet** | Phantom (via `@solana/wallet-adapter`) |
| **Off-Chain Storage** | Supabase (images, caching) |
| **Testing** | ts-mocha, Chai |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 15)                  │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌────────┐│
│  │ Landing  │  │  Polls   │  │ Leaderboard│  │Profile ││
│  │  Page    │  │  CRUD    │  │  (3 tabs)  │  │  Stats ││
│  └────┬─────┘  └────┬─────┘  └─────┬──────┘  └───┬────┘│
│       └──────────────┴──────────────┴──────────────┘     │
│                          │                               │
│              Providers.tsx (App Context)                  │
│       Wallet auth · State management · TX layer          │
└──────────────────────────┬───────────────────────────────┘
                           │  @solana/web3.js
                           ▼
┌──────────────────────────────────────────────────────────┐
│                SOLANA BLOCKCHAIN (Devnet)                 │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │            instinctfi (Unified Program)            │  │
│  │                                                    │  │
│  │  initialize_user · create_poll · edit_poll         │  │
│  │  delete_poll · cast_vote · settle_poll             │  │
│  │  claim_reward · sweep_dust                         │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  PDAs:  UserAccount · PollAccount · Treasury · Vote      │
└──────────────────────────────────────────────────────────┘
```

---

## How It Works

### On-Chain Flow

```
Creator (SOL) ──→ create_poll ──→ Treasury PDA (holds SOL)
                                      │
Voter (SOL)   ──→ cast_vote   ──→ Treasury PDA (more SOL)
                                      │
Anyone        ──→ settle_poll ──→ Winner determined (highest votes)
                                      │
Winner        ──→ claim_reward ←── Treasury PDA sends proportional SOL
```

### User Journey

1. **Connect** — User connects Phantom wallet; on-chain UserAccount PDA is created
2. **Create or Browse** — Create a poll with SOL investment, or browse existing polls
3. **Vote** — Buy option-coins for a predicted outcome (SOL → Treasury PDA)
4. **Settle** — After expiry, anyone triggers settlement; highest-voted option wins
5. **Claim** — Winners call `claim_reward` to receive proportional SOL from the pool

---

## Quick Start

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| **Node.js** | ≥ 18 | Frontend development |
| **npm** or **yarn** | Latest | Package management |
| **Phantom Wallet** | Browser extension | Wallet connection (set to Devnet) |
| **Rust & Cargo** | Latest stable | *(Optional)* Smart contract development |
| **Solana CLI** | ≥ 1.18 | *(Optional)* Blockchain interaction |
| **Anchor CLI** | 0.30.1 | *(Optional)* Smart contract framework |

### 1. Clone the Repository

```bash
git clone https://github.com/rajanpanth/instinctfi.git
cd instinctfi
```

### 2. Run the Frontend

```bash
# Navigate to the frontend app
cd app

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Note:** Make sure your Phantom wallet is set to **Devnet** (`Settings → Developer Settings → Change Network → Devnet`).

### 3. Build & Deploy Smart Contracts (Optional)

Only needed if you want to modify the on-chain programs.

```bash
# Return to root directory
cd ..

# Install root dependencies
yarn install

# Build all Anchor programs
anchor build

# List generated program keys
anchor keys list

# Configure Solana CLI for devnet
solana config set --url devnet

# Airdrop SOL for deployment fees
solana airdrop 2

# Deploy to devnet
anchor deploy
```

After deployment, update the program IDs in:
- `Anchor.toml`
- `app/src/lib/program.ts`

### 4. Get Devnet SOL

- Use the **in-app "Claim SOL"** button (devnet airdrop)
- Or run: `solana airdrop 2 <YOUR_WALLET_ADDRESS> --url devnet`

---

## Project Structure

```
instinctfi/
├── Anchor.toml                 # Anchor workspace configuration
├── Cargo.toml                  # Rust workspace manifest
├── package.json                # Root dependencies (Anchor testing)
├── tsconfig.json               # TypeScript config for tests
│
├── programs/
│   └── instinctfi/             # ★ Unified Anchor program
│       └── src/
│           ├── lib.rs          # Program entry (8 instructions)
│           ├── state.rs        # Account structs (PDAs)
│           ├── errors.rs       # Custom error enum
│           └── instructions/   # One file per instruction
│               ├── cast_vote.rs
│               ├── claim_reward.rs
│               ├── create_poll.rs
│               ├── delete_poll.rs
│               ├── edit_poll.rs
│               ├── initialize_user.rs
│               ├── sweep_dust.rs
│               └── settle_poll.rs
│
├── tests/
│   └── voting.ts               # End-to-end Anchor tests
│
└── app/                        # Next.js 15 Frontend
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.js
    └── src/
        ├── app/                # App Router pages
        │   ├── page.tsx        # Landing page
        │   ├── create/         # Poll creation
        │   ├── polls/          # Poll listing & detail
        │   ├── leaderboard/    # Leaderboard
        │   ├── profile/        # User profile
        │   ├── admin/          # Admin panel
        │   └── activity/       # Activity feed
        ├── components/         # Reusable UI components
        └── lib/                # Utilities, types, program interaction
```

---

## On-Chain Programs

### Instruction Reference

| Instruction | Description | SOL Movement |
|-------------|-------------|--------------|
| `initialize_user` | Create user PDA account | Rent only |
| `create_poll` | Create poll + treasury PDA with SOL investment | Creator → Treasury |
| `edit_poll` | Edit poll metadata (creator-only, 0 votes, active) | None |
| `delete_poll` | Delete poll and refund SOL from treasury | Treasury → Creator |
| `cast_vote` | Buy option-coins with SOL | Voter → Treasury |
| `settle_poll` | Determine winner + send creator reward | Treasury → Creator |
| `claim_reward` | Winners claim proportional SOL from pool | Treasury → Winner |
| `sweep_dust` | Sweep remaining platform fees + rounding dust | Treasury → Creator |

### PDA Accounts

| Account | Seeds | Description |
|---------|-------|-------------|
| `UserAccount` | `["user", authority]` | User profile & cumulative stats |
| `PollAccount` | `["poll", creator, poll_id]` | Poll data, options, vote counts |
| `Treasury` | `["treasury", poll_account]` | SOL vault for each poll |
| `VoteAccount` | `["vote", poll_account, voter]` | Per-user vote record on a poll |

### Program ID

```
J9AqrLZWDXaQfDwtFpC2GG9hBb7SAPxRwVpGs753EgWV
```

> Deployed to Solana devnet on 2026-03-01.

---

## Tokenomics

```
┌─────────────────────────────────────────────────┐
│              POLL ECONOMICS EXAMPLE              │
│                                                  │
│  Creator Investment:        1.0 SOL              │
│  ├── Platform Fee (1%):    -0.01 SOL             │
│  ├── Creator Reward (1%):  -0.01 SOL             │
│  └── Initial Pool (98%):   0.98 SOL              │
│                                                  │
│  + Voter A buys 50 "Yes" coins:  +0.50 SOL       │
│  + Voter B buys 30 "No"  coins:  +0.30 SOL       │
│  + Voter C buys 20 "Yes" coins:  +0.20 SOL       │
│                                                  │
│  Total Pool:                1.98 SOL              │
│                                                  │
│  Result: "Yes" wins (70 vs 30 votes)             │
│                                                  │
│  Voter A reward: (50/70) × 1.98 = 1.414 SOL     │
│  Voter C reward: (20/70) × 1.98 = 0.566 SOL     │
│  Voter B reward:                   0     SOL     │
│  Creator reward (on settle):       0.01  SOL     │
└─────────────────────────────────────────────────┘
```

**Reward formula:**

```
user_reward = (user_winning_votes / total_winning_votes) × total_pool
```

---

## Security

| Concern | Mitigation |
|---------|------------|
| Fund safety | Real SOL transfers via `system_program::transfer` CPI — not internal accounting |
| Treasury control | PDAs hold all funds; only the program can sign withdrawals |
| Self-voting | Creator cannot vote on their own poll (enforced on-chain) |
| Double settlement | Status flag prevents settling a poll more than once |
| Double claiming | `claimed: bool` on VoteAccount prevents re-claims |
| Overflow | Proportional rewards computed with `u128` math |
| Refunds | Full SOL returned on poll deletion if no votes cast |
| Account validation | Anchor constraints (`has_one`, `seeds`, `bump`) enforce PDA ownership |
| Permissionless settlement | Anyone can trigger after end time — no single point of failure |

---

## Roadmap

| Phase | Feature | Description |
|-------|---------|-------------|
| ~~**v1.1**~~ | ~~Real SOL Mode~~ | ✅ Implemented — all transactions use real SOL |
| **v1.2** | Token Extensions | Token-2022 vote receipt NFTs for proof of participation |
| **v1.3** | Oracle Integration | Pyth/Switchboard for auto-settlement of price predictions |
| **v2.0** | DAO Governance | Token holders vote on platform parameters |
| **v2.1** | Tournament Mode | Multi-round prediction tournaments |
| **v2.2** | Mobile App | React Native with Phantom mobile deep-linking |
| **v3.0** | Cross-Chain | Bridge to Ethereum/Polygon |

---

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for details.

---
