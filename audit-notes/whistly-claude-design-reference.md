# Whistly — Polymarket-Style Design Reference (Claude Design phase)

Date: 2026-07-16
Purpose: structural + interaction reference for rebuilding Whistly's internal
trading experience (everything except the frozen homepage `/`).

## Inspection environment log (honesty note)

Direct browser inspection of polymarket.com was attempted and blocked in this
environment:

| Route tried | Result |
| --- | --- |
| Browser pane → `polymarket.com/*` | navigation denied (origin approval declined/blocked) |
| WebFetch → `polymarket.com/markets` | TLS "certificate has expired" (likely regional block) |
| WebFetch → `web.archive.org` mirror | fetch blocked by environment |
| Browser pane → `web.archive.org` mirror | loads, but read tools require per-action approval |

**Unblock action for the user:** approve the `polymarket.com` (or
`web.archive.org`) origin in the Claude browser pane when the approval card
appears; then screens 1–15 below can be pixel-verified and this doc updated.

Until then this reference is built from:
1. **Polymarket public developer docs** (fetched live — CLOB order semantics,
   order types, statuses, tick sizes are authoritative, not from memory).
2. Product-structure knowledge of Polymarket current to early 2026.
3. Existing repo reference PNGs (`screenshoots refrences/` — Fanatics Markets,
   used only as a secondary density reference).

Functional semantics below (order lifecycle, TIF, statuses) are **verified
against the live docs**. Visual measurements marked `≈` are best-effort and
should be tolerance-checked once origin approval is granted.

---

## 0. Global design language (as adapted for Whistly)

- Dark UI. Whistly already ships a dark marketplace theme (`market-*` classes,
  zinc/near-black surfaces, white text, red/blue accents). The trading pages
  reuse Whistly tokens — NOT Polymarket's palette.
- Prices are **probabilities in percent** (`54%`), never `$`/`¢`.
  Collateral shown as `◎ devnet SOL` with the permanent disclaimer:
  **"Devnet SOL has no real-money value."**
- Density: compact rows (≈40–48px), 13–14px body, 12px meta, tabular numerals
  for all quantities.
- Buy = green (`#22c55e` family), Sell/No = red (`#ef4444` family) — matches
  both Polymarket convention and Whistly's existing red/blue scheme; final
  tokens come from `globals.css`.

## 1. Market discovery (`/markets`) — ref: polymarket.com/markets

- **Header (sticky, ≈64px):** brand → search (wide, centered, `/` shortcut) →
  nav links (Markets, Live, Portfolio) → wallet/collateral chip → Connect.
- **Category rail** under header: horizontally scrollable pill tabs
  (Trending, New, Live, World Cup, Match Result, Goals, Totals, Ending Soon,
  Recently Settled…). Active pill filled, others ghost.
- **Filter row:** status / date / competition / team / market-type / liquidity /
  volume dropdowns + sort control.
- **Card grid:** responsive 1→2→3→4 columns (≈280–320px cards, 16px gutters).
- **Card anatomy (binary):** event icon (40px rounded) + title (2-line clamp,
  ≈15px semibold) → large probability chip on the right → outcome strip with
  mini **Buy Yes / Buy No** buttons (green/red, show current best-ask prob) →
  footer meta: volume (◎), liquidity, close time, comment count.
- **Card anatomy (multi-outcome):** top 2–3 outcomes as rows
  (name · % · mini Yes/No buttons), "+N more" link.
- Clicking card → `/event/[id]` or `/market/[id]`; clicking a mini buy button →
  market page with that side preselected in the ticket.

## 2. Sports live discovery (`/live`) — ref: polymarket.com/sports/live

- League/competition tabs on top (here: World Cup only).
- **Live game strip per fixture:** team crests + names, live score (large),
  match clock + period badge (pulsing LIVE dot), then the fixture's markets as
  compact rows underneath (Match result 1/X/2 with three probability buttons).
- Pre-kickoff: countdown + "Goal windows open when the match goes live".
- Live goal windows section per fixture: 5m / 15m / 45m cards with window
  boundary clock, YES/NO probabilities, lock countdown.
- TxLINE status chip (Connected / Not configured / Error / MOCK) always
  visible on this page.

## 3. Event page (`/event/[eventId]`) — ref: a sports event page

- **Event header:** competition breadcrumb (World Cup → Final), fixture
  identity block (crest + "France vs Spain"), kickoff/score/clock, event-level
  volume, watchlist star.
- **Market list:** grouped sections — Match Result, Goals (O/U ladder rows
  0.5/1.5/2.5/3.5), Qualification, Live windows (when live). Each row: market
  name · chart sparkline (real fills only) · Yes/No (or 1/X/2) probability
  buttons · volume.
- Row click expands inline OR routes to `/market/[id]` (we route; matches
  Polymarket's game view where each line opens the market with ticket).
- Right rail (desktop ≥1200px): event trade ticket bound to selected market
  row; below it event activity feed.

## 4–5. Market detail (`/market/[marketId]`) — desktop

Two-column: **main ≈ minmax(0,1fr)** + **right rail 340px sticky**
(top offset = header height). Max width ≈1200–1280px.

MAIN COLUMN (top→bottom):
1. Breadcrumb (Markets → World Cup → Final).
2. Identity row: event icon, market title (≈22–24px bold), status chip
   (Open / Closes in 2h / Closed / Settled), volume ◎, close time.
3. **Primary probability block:** huge % (≈40px bold) + Δ chip
   ("Spain 54% ▲2.1 today").
4. **Price-history chart:** line of executed fill prices only; range tabs
   1H · 6H · 1D · 1W · ALL; empty state = "No completed trades yet."
5. Outcome rows (multi-outcome): outcome · last/best % · Yes/No buttons.
6. **Order book (tabbed with "Graph"):** two-sided table — asks (red, top,
   descending) / spread + midpoint row / bids (green). Columns:
   Price (%) · Shares · Total (cumulative ◎). Depth bars behind rows.
   Realtime; empty state honest.
7. Recent trades: time · side · price % · shares · tx link.
8. Related markets rail (cards from same event).
9. Tabs: **Comments · Activity · Top Holders** (holders only if real data).
10. Rules / resolution: full market rules, resolution source (TxLINE),
    settlement details, market addresses (program, market PDA) + Explorer
    links.

RIGHT RAIL — TRADE TICKET (sticky, 340px, card):
- Row 1: **Buy | Sell** segmented tabs (green underline buy, red sell).
- Row 2: **Market | Limit** switch (small dropdown/segment, right-aligned;
  "Market" default; advanced TIF under Limit ⚙: GTC · GTD · FOK · IOC/FAK).
- Outcome selector: Yes 54% / No 46% pill buttons (selected = filled).
- MARKET BUY: stake input (◎ SOL) + quick chips (+0.1 +0.5 +1 Max) →
  readout rows: Shares ≈, Avg prob, Worst prob (slippage cap), Price impact,
  Fee, Potential payout, Potential profit.
- MARKET SELL: shares input + chips (25/50/75/Max of available unlocked) →
  readout: Proceeds ≈, Avg/Worst prob, Impact, Fee, Realized P&L.
- LIMIT: probability input (1–99, 1% tick for Whistly V2) + shares input +
  total ◎ readout + expiry (GTD date picker) — collateral/share lock note.
- Balance line: available ◎ (buy) / available shares (sell).
- CTA: **Review order** → confirm state ("Sign in Phantom…" spinner →
  "Submitting…" → "Confirmed ✓" + Explorer link). Errors inline (insufficient
  balance, no liquidity at slippage cap, market closed, wrong network).
- Fine print: fee bps + "Devnet SOL has no real-money value."

States to implement: disconnected (CTA = Connect wallet), wrong network
(CTA = Switch to Devnet), market closed (ticket disabled with reason),
settled (ticket replaced by Redeem panel).

## 6–9. Buy/Sell/Market/Limit interaction notes (verified vs docs)

- All executable orders are **signed limit orders**; a "market" order is a
  marketable limit (buy at worst-acceptable prob = slippage cap) sent
  FAK/FOK. Buyers specify collateral amount; sellers specify shares. ✔docs
- TIF: GTC rests; GTD rests until expiry (UTC secs); FOK all-or-nothing;
  FAK fills what's available, cancels rest. ✔docs
- Statuses: pending_signature → open → partially_filled → filled /
  cancelled / expired / rejected (superset of docs' live/matched/delayed).
- Tick: Whistly V2 uses 1% ticks (probability integers 1–99) for simplicity;
  documented per-market `tickSize` field for future finer ticks.
- Maker rests, taker crosses; matching engine is off-chain, settlement
  on-chain (hybrid, mirrors Polymarket's operator model: "operators cannot
  set prices or execute unauthorized trades"). ✔docs

## 10. Open orders (`/orders`)

Table: Market · Outcome · Side · Type · Prob % · Filled/Total shares ·
Locked (◎ or shares) · TIF/Expiry · Status · Created · **Cancel**.
Partial fills update in place; cancelled/expired rows move to history filter.

## 11. Activity (`/activity`)

Global + per-user feed rows: icon (buy/sell/post/cancel/fill/settle/redeem),
wallet (truncated, linked), action sentence ("bought 12 Yes @ 54%"),
market link, ◎ amount, relative time, **Explorer tx link** for on-chain rows.

## 12. Portfolio (`/portfolio`) — ref: polymarket.com/portfolio

- Header cards: Portfolio value ◎ · Available ◎ · Locked in orders ◎ ·
  Unrealized P&L (green/red) · Realized P&L · Claimable ◎.
- Tabs: **Positions · Open orders · History (trades/settlements/redemptions)**.
- Positions table: Market (icon+title+outcome chip) · Shares (available/locked)
  · Avg entry % · Best bid % · Value ◎ (shares × best bid) · P&L ◎ and % ·
  actions: **Sell** (opens ticket pre-filled) / **Claim** (if settled winner).
- Empty states honest; never fabricated values; all numbers from chain/fills.

## 13. Comments & rules

Comment list with wallet avatars, relative time, report/moderate (admin);
positions badge ("holds 40 Yes") only when real. Rules section verbatim from
market creation + resolution source + "Resolves from score data, not
majority vote" for TxLINE markets.

## 14–15. Mobile (≤768px)

- Market page: compact header (back arrow, title 1-line, % chip), full-width
  chart/book/tabs, **sticky footer bar** with two buttons: `Buy Yes 54%` /
  `Buy No 46%` (green/red).
- Tapping either opens the **bottom sheet ticket**: drag handle, rounded top,
  same ticket contents, scroll-locked background, close on swipe-down/backdrop.
  Sheet states: input → review → signing progress → success (Explorer link).
- No horizontal overflow anywhere; tables become stacked cards on ≤480px.

## Whistly-specific deltas (branding rule)

- Whistly wordmark/whistle logo, Whistly dark tokens from `globals.css`.
- No Polymarket name/logo/legal text anywhere in production UI.
- All money units: ◎ devnet SOL + permanent devnet disclaimer.
- Probability-first display (%), cents notation never used.
