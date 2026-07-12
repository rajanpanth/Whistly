# KickTick World Cup UI Plan

## Reference UX patterns observed

- ADI PredictStreet public pages emphasize World Cup event browsing, binary YES/NO framing, status buckets such as trending/live/starting soon, and responsible-disclosure/legal footer content. Source checked: https://adipredictstreet.com/ and https://adipredictstreet.com/events.
- Polymarket-style short-window markets informed the fast binary market framing, price/probability hierarchy, and compact trade CTA pattern.
- Sofascore surfaces live football by prioritizing sport/date filters, live/finished/upcoming states, match clock, score, and fixture context. Source checked: https://www.sofascore.com/.
- FotMob surfaces compact match lists, status-first football navigation, and prediction-adjacent entry points without burying the match context. Source checked: https://www.fotmob.com/.
- TxLINE World Cup docs confirm free World Cup/International Friendlies tiers, 60-second delay or real-time tiers, historical replay, and on-chain verification language to adapt honestly. Source checked: https://txline-docs.txodds.com/documentation/worldcup.

## What will be adapted

- Sports-market browsing patterns: status badges, event cards, binary YES/NO probability rows, pool/volume metadata, and fast trade links.
- Live football patterns: scoreboard-first layout, match clock, scoreline, live/today/upcoming filters, and compact fixture lists.
- Data/proof patterns: settlement proof, data-health widgets, fixture IDs, source labels, and explicit demo/verified states.

## What will NOT be copied

- No ADI, FIFA, Fanatics, Polymarket, FotMob, Sofascore, or TxODDS logos, imagery, exact colors, CSS, proprietary text, or pixel-for-pixel layouts.
- No implication of affiliation with any reference brand.
- No fake TxLINE credentials, real proof, or real event support where only mock/demo data exists.

## Pages to change

- `app/src/app/page.tsx`: convert homepage to KickTick World Cup hub.
- `app/src/app/live/page.tsx`: preserve handlers and devnet flow, refine product wording, family selector, data health/proof copy.
- `app/src/app/world-cup/page.tsx`: add World Cup-only market hub.
- `app/src/app/world-cup/fixtures/page.tsx`: add fixture snapshot/demo create-markets view.
- `app/src/app/replay/page.tsx`: add historical replay demo page.
- `app/src/app/txline-setup/page.tsx`: add TxLINE setup/admin status page.
- `app/src/app/verify/[marketId]/page.tsx`: add verification/proof detail page.
- `app/src/app/create/page.tsx`: World Cup templates and language cleanup.
- `app/src/app/polls/page.tsx`: align as Markets page with World Cup market filters/search copy.
- `app/src/app/polls/[id]/PollDetailClient.tsx`: inspect and only adjust if needed for language consistency.
- `app/src/app/portfolio/page.tsx`: rename to My Positions and KickTick wording.
- `app/src/components/Navbar.tsx`: KickTick IA and brand.
- `app/src/components/Footer.tsx`: required footer sections/disclaimer.
- `app/src/components/PollCard.tsx`: market-card wording and Trade CTA.

## Categories to remove/hide

- Politics, Crypto, General, Entertainment, Random Polls, Tech, non-World-Cup sports, and unrelated demo categories are not rendered in main UI.
- Current `CATEGORIES` is already limited to `World Cup`; keep any older internal schema compatibility untouched.

## New KickTick navigation

- Main: Home, Live, World Cup, Markets, My Positions, Leaderboard, About.
- Admin/demo links may appear for admin/demo contexts: Admin Demo, Resolve Markets, TxLINE Setup, Verify Market.

## New market families

- Goal Windows, Goals/Totals, Corners, Penalties, Offsides, Cards, Goal Gap, Match Result, Resolved.
- Only current 5m/15m/45m live goal-window markets are represented as working on-chain flow.
- Other event/stat families are labeled as demo event markets unless real TxLINE support is configured later.

## Files to edit

- Existing UI: `page.tsx`, `live/page.tsx`, `polls/page.tsx`, `create/page.tsx`, `portfolio/page.tsx`, `Navbar.tsx`, `Footer.tsx`, `PollCard.tsx`.
- New shared UI/data: likely `app/src/lib/kicktickMarkets.ts`, `app/src/components/KickTickMarketCard.tsx`.
- New pages: `world-cup`, `world-cup/fixtures`, `replay`, `txline-setup`, `verify/[marketId]`, and optionally `about`.
- Optional resolver scaffolding under `app/src/lib/markets/resolvers/` if needed for demo proof structure.

## Risks

- Existing devnet live-market handlers must not be renamed or reordered in a way that breaks create/buy/resolve/claim.
- The contract and IDL should not be touched in this pass.
- Several legacy components still use poll/vote vocabulary internally; visible copy should change where it affects the demo.
- Full devnet wallet flow may not be practically reverified without wallet/admin setup in this environment.

## Devnet flow preservation checklist

- Preserve `marketKind: 0 = Standard` and `marketKind: 1 = LiveGoalWindow`.
- Preserve YES/NO mapping: `0 = NO`, `1 = YES`.
- Preserve `/live` functions: `createPoll`, `castVote`, `settlePoll`, `claimReward`.
- Preserve settlement tx display and claim tx display.
- Preserve mock TxLINE-compatible demo data and routes.
- Do not modify Anchor contract or IDL.
- Run focused live-goal tests, full frontend tests if feasible, and build.

