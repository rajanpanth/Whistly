# Whistly fanatics-inspired UI pass

## Pass 3 — 2026-07-12 sitewide restyle

### What changed
Extended the homepage's marketplace design language (near-black `#141418`/`#19191d` cards, `#29292f` borders, green `#20d38a` / live-red `#fa4669` / demo-yellow `#d8ec52` accents, white pill CTAs, uppercase condensed headings, mono numerals) to every remaining page:

- **Shared widgets** — `KickTickMarketCard`, `ActivityFeed`, `DataHealthWidget`, `DemoNotice`, `MarketFamilyTabs`, `SettlementProof` swapped from the old navy/cyan/violet theme to the marketplace palette; YES/NO rows now use the same green/red tinted-border style as the homepage.
- **/world-cup (and /events, /schedule re-exports)** — hero header card, search input, discovery pills, family chips, empty state, sidebar cards all restyled.
- **/verify and /verify/[marketId]** — hero, proof rows, demo banners, tx-link colors mapped to the palette.
- **/portfolio** — hero header with kicker, summary stat cards, segmented filter tabs (white active pill), position rows in `#19191d` cards; wallet-connect empty state restyled. Claim logic untouched.
- **/polls** — kicker + uppercase heading, market-style search input, category/status/sort pills mapped to the segmented-control style; pagination on-palette. Data-fetch/pagination logic untouched.
- **/live** — palette-only swap (slate/blue/amber → marketplace tokens; YES green / NO red mapped to `#20d38a`/`#fa4669`). No logic, labels, or 5m/15m/45m controls changed.
- **/leaderboard, /replay, /activity, /docs, /about, /match/...** — heroes, tables, controls, trade panel, and chart colors mapped to the palette.

### Verification
- `npx tsc --noEmit` — passed.
- `npm run build` — compiled successfully, 49/49 static pages generated.
- Browser checks per page (computed styles + DOM): `/world-cup`, `/events`, `/verify`, `/portfolio`, `/polls`, `/live`, `/leaderboard`, `/replay`, `/docs`, `/match/fifwc-nor-eng-2026-07-11` all render with `#19191d`/`#141418` surfaces and no horizontal overflow (desktop 1280 and mobile 390 spot-checked).
- `/live` re-verified intact: DEVNET + MOCK TxLINE labels, 5/15/45-min window controls, "resolves from score data, not majority vote" settlement text all present.

### Preservation confirmation
Presentation-only changes (classNames and static copy styling). No Anchor/IDL/wallet/settlement/claim/RPC logic modified.

---

## Pass 2 — 2026-07-12 refinement

### What changed
- Replaced the hero's hardcoded decorative SVG with a real data-driven chart (`MarketProbabilityChart.tsx`): per-market probability history generated from a deterministic seeded PRNG (SSR/hydration-safe), correct 0–80% axis mapping, Catmull-Rom smoothed paths through every data point, endpoint dots and labels positioned from the data, time ticks derived from the match clock, and a 2.5s live tick that mean-reverts around the market's actual probability while the market is live. Ticking is skipped under `prefers-reduced-motion`.
- Made the marketplace football-first: featured hero carousel now leads with a live "Argentina vs Brazil — Goal in next 5 minutes?" market (score, clock, window, YES/NO rows, settlement labels, "Trade on /live" CTA), followed by two upcoming World Cup markets.
- Outcome rows restyled to the reference's price pattern: base stake, chevron, green payout (`$100 › $172`) plus a fixed probability chip. YES/NO avatars get subtle green/red border tints (text label still distinguishes them, not color alone).
- Countdown badges now render as segmented mono pills (`2d : 16h : 4m : 20s`).
- Added a "Soccer" spotlight section: large pitch-art visual card (live meta, big uppercase title, market question) beside a 2×2 market-card grid, mirroring the reference's soccer section structure.
- "Live now (5)" section header now uses a pulsing red dot with a red count.
- Live/market cards show pool size, lock countdown, and a "Devnet · Mock" tag.
- Sidebar rail rebuilt: promo carousel (2 original Whistly slides with prev/next arrows and dots), purple-icon info card, TxLINE status card (Fixtures/Scores/Odds/Network/Validation rows + disclaimer), segmented "Pick how the match moves" quick-pick card, and the wallet connect button.
- Primary nav updated per brief: Trending, Live (count), World Cup, Sports, Prediction Markets, My Positions, Verify. Secondary category chips unchanged (Goals, Corners, Cards, Penalties, Offsides, Totals, Goal Gap, Match Result, Live 5m/15m/45m).
- Marketplace data expanded to typed football-only content: 3 featured markets, 5 live micro-markets (goal 5m, corner 10m, yellow card, BTTS, over 2.5), soccer spotlight, and 15 category markets across Goals, Cards & Corners, and Match Result.

### Reference handling
- The provided full-page PDF was used for overall structure/section order; the PNG screenshots in `screenshoots refrences/` were the primary visual guide for spacing, card proportions, and typography rhythm.
- No Fanatics logo, name, protected assets, or legal wording was copied. All copy, brand marks, chart drawings, and disclaimer text are original Whistly content.

### Files changed (this pass)
- app/src/lib/marketplaceData.ts — football-first typed data, new nav, new fields (question, window, pool, lock).
- app/src/components/marketplace/MarketCards.tsx — price rows, segmented countdowns, hero live meta/question/notes/CTA, meta footer, SoccerSpotlightCard, live-card fixture line.
- app/src/components/marketplace/MarketplaceHome.tsx — soccer spotlight section, red live dot, promo carousel, info card, segmented quick pick, status card validation row.
- app/src/app/globals.css — countdown segments, price row styling, hero notes/CTA, meta rows, live dot animation, YES/NO avatar tints, quick-pick tablist grid, visual-card tweaks, mobile fixes.
- .claude/launch.json (repo root, tooling only) — dev-server launch config for verification.

### Commands run
- `cd app && npx tsc --noEmit` — **passed** (no output).
- `cd app && npm run build` — **passed**; `/` and `/live` both present in route output (`/live` 11.9 kB, static).
- `cd app && npm test -- --runInBand` — 6 suites passed, 1 skipped, 1 failed: the pre-existing `rpc-critical-path.test.ts` admin/test 403 mismatch (9 failures, known issue, explicitly out of scope for this UI pass). 88 tests passed, 14 skipped.

### Desktop/mobile status
- Verified in-browser at 1440, 1280, 768, 390, and 360 px: `document.documentElement.scrollWidth <= innerWidth` at every width (no page-level horizontal overflow).
- Category chips scroll horizontally inside their own container at 360 px without widening the page.
- Sidebar stacks below the main column at tablet/mobile; hero, live cards, and footer stack cleanly (mobile screenshots captured at 655 and 390 px).
- Desktop screenshot at 1440 px confirmed the ~70/30 main/rail split, hero chart, and section rhythm.

### /live preservation check
- `/live` renders with DEVNET and MOCK TxLINE badges, 5 min / 15 min / 45 min window controls, goal-window timeline, settlement rules ("resolves from score data, not majority vote"), settlement proof, and positions/claim surfaces — all unchanged.
- Wallet connect modal still opens from both the header "Sign in to trade" button and the sidebar rail button.

### Known issues
- Pre-existing `rpc-critical-path` jest suite fails with 403 admin rejection (unrelated to UI; not fixed per instructions).
- Browser-pane screenshot capture was intermittently flaky in this environment; overflow checks were additionally verified via DOM measurements.
- A hidden 0×0 duplicate of the page subtree exists outside `<main>` (pre-existing portal artifact, invisible, present before this pass).

### Preservation confirmation
No Anchor contract, IDL, wallet adapter logic, settlement logic, claim logic, RPC/admin logic, or TxLINE resolver implementation was modified. marketKind mapping (0 = Standard, 1 = LiveGoalWindow) and YES/NO mapping (0 = NO, 1 = YES) are untouched. Existing routes were not removed.

---

## Pass 1 (earlier)

### What changed
- Reworked the homepage into a dark, compact football prediction-market discovery layout.
- Added a football-first featured live market, dense live-now cards, category sections, status rail, quick picks, trust strip, responsive chips, and original demo copy.
- Updated header search/nav labels and the shared footer with Whistly-specific demo/disclaimer language.
- Kept the existing reusable market cards, share controls, wallet modal, and /live route intact.

### Reference handling
The provided PDF and screenshots were used only for structural and density inspiration. No Fanatics logo, name, protected assets, proprietary text, or copied legal wording was added.

### Files changed
- app/src/components/marketplace/MarketplaceHome.tsx
- app/src/components/marketplace/MarketCards.tsx
- app/src/components/Navbar.tsx
- app/src/components/Footer.tsx
- app/src/lib/marketplaceData.ts
- app/src/app/globals.css

### Verification
- cd app && npx tsc --noEmit — passed.
- cd app && npm run build — passed.
- Build warning: existing usePollOperations.ts exhaustive-deps warning.
- Build notice: missing Supabase env vars correctly kept the app in offline/demo mode.
- Desktop/tablet/mobile responsive rules were added for 1440, 1280, 768, 390, and 360px behavior; horizontal overflow remains clipped and chips scroll.
- / and /live are present in the production route output.

### Known issues
- npm test -- --runInBand — 6 suites passed, 1 skipped, 1 failed. The existing rpc-critical-path suite has 9 failures returning 403 admin rejection; 88 tests passed and 14 were skipped.

### Preservation confirmation
No Anchor contract, IDL, wallet adapter logic, settlement logic, claim logic, RPC logic, or TxLINE resolver implementation was modified. Existing DEVNET / Mock TxLINE labels and /live controls remain in place.
