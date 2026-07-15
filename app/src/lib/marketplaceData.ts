export type MarketOutcome = {
  label: string;
  price: string;
  probability: number;
  symbol?: string;
  won?: boolean;
};

export type MarketplaceMarket = {
  id: string;
  title: string;
  competition: string;
  sport: string;
  status: "live" | "upcoming" | "ended";
  countdown?: string;
  /** Kick-off time (ISO, UTC) — countdown timers tick toward this. */
  kickoff?: string;
  clock?: string;
  score?: string;
  /** Display date for settled markets, e.g. "Jul 13". */
  endedAt?: string;
  question?: string;
  window?: string;
  pool?: string;
  lock?: string;
  combo?: boolean;
  featured?: boolean;
  /** Optional artwork rendered in the card's visual area (public/ path). */
  image?: string;
  outcomes: MarketOutcome[];
  tags: string[];
  href: string;
};

export const PRIMARY_MARKET_NAV = [
  { label: "Trending", href: "/" },
  { label: "Live", href: "/live" },
  { label: "World Cup", href: "/world-cup" },
  { label: "Sports", href: "/events" },
  { label: "My Positions", href: "/portfolio" },
  { label: "Verify", href: "/verify" },
] as const;

export const SPORT_TABS = ["All markets", "Goals", "Totals", "Goal Gap", "Match Result", "Upcoming", "Settled"] as const;

/* 2026 FIFA World Cup knockout schedule (kick-offs converted from NPT to UTC).
   Semi-final 1: France 0–2 Spain (FT Jul 13) — Spain reach the final
   Semi-final 2: England vs Argentina — Jul 16 00:45 NPT → Jul 15 19:00 UTC
   Third place:  France vs SF2 loser — Jul 19 02:45 NPT → Jul 18 21:00 UTC
   Final:        Spain vs SF2 winner — Jul 20 00:45 NPT → Jul 19 19:00 UTC */
export const KICKOFFS = {
  semiFinal2: "2026-07-15T19:00:00Z",
  thirdPlace: "2026-07-18T21:00:00Z",
  final: "2026-07-19T19:00:00Z",
} as const;

export const NEXT_KICKOFF = {
  title: "England vs Argentina",
  label: "Semi-final",
  countdown: "0d : 12h : 12m : 0s",
  kickoff: KICKOFFS.semiFinal2,
} as const;

export const FEATURED_MARKETS: MarketplaceMarket[] = [
  {
    id: "featured-eng-arg-sf",
    title: "England vs Argentina",
    competition: "World Cup 2026 · Semi-final",
    sport: "Match Result",
    status: "upcoming",
    countdown: "0d : 12h : 12m : 0s",
    kickoff: KICKOFFS.semiFinal2,
    question: "Who joins Spain in the final? · Jul 16, 12:45 am NPT",
    pool: "21.4 SOL pool",
    combo: true,
    featured: true,
    href: "/world-cup",
    tags: ["Upcoming", "World Cup", "Match Result"],
    outcomes: [
      { label: "Argentina", symbol: "ARG", price: "$189", probability: 53 },
      { label: "England", symbol: "ENG", price: "$213", probability: 47 },
    ],
  },
  {
    id: "featured-wc-winner",
    title: "Who wins the World Cup?",
    competition: "FIFA World Cup 2026 · Outright",
    sport: "Match Result",
    status: "upcoming",
    countdown: "4d : 12h : 12m : 0s",
    kickoff: KICKOFFS.final,
    question: "Spain await the winner of England–Argentina · Final Jul 20",
    pool: "34.8 SOL pool",
    combo: true,
    featured: true,
    href: "/world-cup",
    tags: ["Upcoming", "World Cup", "Outright"],
    outcomes: [
      { label: "Spain", symbol: "ESP", price: "$217", probability: 46 },
      { label: "Argentina", symbol: "ARG", price: "$345", probability: 29 },
      { label: "England", symbol: "ENG", price: "$400", probability: 25 },
    ],
  },
  {
    id: "featured-final-90",
    title: "Final goes beyond 90 minutes?",
    competition: "World Cup 2026 · Final · Jul 20",
    sport: "Match Result",
    status: "upcoming",
    countdown: "4d : 12h : 12m : 0s",
    kickoff: KICKOFFS.final,
    question: "Extra time or penalties in the final? · Jul 20, 12:45 am NPT",
    pool: "4.1 SOL pool",
    featured: true,
    href: "/world-cup",
    tags: ["Upcoming", "World Cup", "Match Result"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$294", probability: 34 },
      { label: "No", symbol: "NO", price: "$152", probability: 66 },
    ],
  },
];

export const FEATURED_MARKET = FEATURED_MARKETS[0];

/* No matches are being played right now — the next fixture is semi-final 2. */
export const LIVE_MARKETS: MarketplaceMarket[] = [];

export const SOCCER_SPOTLIGHT: MarketplaceMarket = {
  id: "spotlight-eng-arg",
  title: "England vs Argentina",
  competition: "World Cup 2026 · Semi-final",
  sport: "Match Result",
  status: "upcoming",
  countdown: "0d : 12h : 12m : 0s",
  kickoff: KICKOFFS.semiFinal2,
  question: "Who joins Spain in the final?",
  image: "/spotlight-eng-arg.avif",
  href: "/world-cup",
  tags: ["Upcoming", "Match Result"],
  outcomes: [
    { label: "Argentina", symbol: "ARG", price: "$189", probability: 53 },
    { label: "England", symbol: "ENG", price: "$213", probability: 47 },
  ],
};

export const SPORTS_MARKETS: MarketplaceMarket[] = [
  /* ── Upcoming: semi-final 2 ── */
  {
    id: "sf2-result",
    title: "England vs Argentina",
    competition: "World Cup 2026 · Semi-final",
    sport: "Match Result",
    status: "upcoming",
    countdown: "0d : 12h : 12m : 0s",
    kickoff: KICKOFFS.semiFinal2,
    question: "Who wins the semi-final?",
    pool: "12.6 SOL",
    combo: true,
    href: "/world-cup",
    tags: ["Upcoming", "Match Result"],
    outcomes: [
      { label: "Argentina", symbol: "ARG", price: "$189", probability: 53 },
      { label: "England", symbol: "ENG", price: "$213", probability: 47 },
    ],
  },
  {
    id: "sf2-o25",
    title: "Over 2.5 goals — England vs Argentina",
    competition: "World Cup 2026 · Semi-final",
    sport: "Totals",
    status: "upcoming",
    countdown: "0d : 12h : 12m : 0s",
    kickoff: KICKOFFS.semiFinal2,
    pool: "5.9 SOL",
    href: "/world-cup",
    tags: ["Upcoming", "Totals", "Goals"],
    outcomes: [
      { label: "Over 2.5 goals", symbol: "OVR", price: "$196", probability: 51 },
      { label: "Under 2.5 goals", symbol: "UND", price: "$204", probability: 49 },
    ],
  },
  {
    id: "sf2-btts",
    title: "Both teams to score — England vs Argentina",
    competition: "World Cup 2026 · Semi-final",
    sport: "Goals",
    status: "upcoming",
    countdown: "0d : 12h : 12m : 0s",
    kickoff: KICKOFFS.semiFinal2,
    pool: "4.8 SOL",
    combo: true,
    href: "/world-cup",
    tags: ["Upcoming", "Goals"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$185", probability: 54 },
      { label: "No", symbol: "NO", price: "$217", probability: 46 },
    ],
  },
  {
    id: "sf2-gap",
    title: "Goal gap over 1.5 — England vs Argentina",
    competition: "World Cup 2026 · Semi-final",
    sport: "Goal Gap",
    status: "upcoming",
    countdown: "0d : 12h : 12m : 0s",
    kickoff: KICKOFFS.semiFinal2,
    pool: "3.7 SOL",
    href: "/world-cup",
    tags: ["Upcoming", "Goal Gap", "Goals"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$357", probability: 28 },
      { label: "No", symbol: "NO", price: "$139", probability: 72 },
    ],
  },
  /* ── Upcoming: third place & final ── */
  {
    id: "third-place-o25",
    title: "Over 2.5 goals — Third-place play-off",
    competition: "World Cup 2026 · Jul 19",
    sport: "Totals",
    status: "upcoming",
    countdown: "3d : 14h : 12m : 0s",
    kickoff: KICKOFFS.thirdPlace,
    question: "France meet the England–Argentina losers · Jul 19, 2:45 am NPT",
    pool: "2.8 SOL",
    href: "/world-cup",
    tags: ["Upcoming", "Totals", "Goals"],
    outcomes: [
      { label: "Over 2.5 goals", symbol: "OVR", price: "$161", probability: 62 },
      { label: "Under 2.5 goals", symbol: "UND", price: "$263", probability: 38 },
    ],
  },
  {
    id: "final-extra-time",
    title: "Final goes beyond 90 minutes?",
    competition: "World Cup 2026 · Final · Jul 20",
    sport: "Match Result",
    status: "upcoming",
    countdown: "4d : 12h : 12m : 0s",
    kickoff: KICKOFFS.final,
    question: "Spain await the England–Argentina winner · Jul 20, 12:45 am NPT",
    pool: "4.1 SOL",
    href: "/world-cup",
    tags: ["Upcoming", "Match Result"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$294", probability: 34 },
      { label: "No", symbol: "NO", price: "$152", probability: 66 },
    ],
  },
  /* ── Settled: semi-final 1 (France 0–2 Spain, Jul 13) ── */
  {
    id: "sf1-result",
    title: "France vs Spain",
    competition: "World Cup 2026 · Semi-final",
    sport: "Match Result",
    status: "ended",
    score: "0 – 2",
    endedAt: "Jul 13",
    question: "Who wins the semi-final?",
    pool: "14.2 SOL",
    href: "/world-cup",
    tags: ["Settled", "Match Result"],
    outcomes: [
      { label: "France", symbol: "FRA", price: "$0", probability: 0 },
      { label: "Spain", symbol: "ESP", price: "$100", probability: 100, won: true },
    ],
  },
  {
    id: "sf1-o25",
    title: "Over 2.5 goals — France vs Spain",
    competition: "World Cup 2026 · Semi-final",
    sport: "Totals",
    status: "ended",
    score: "0 – 2",
    endedAt: "Jul 13",
    pool: "6.8 SOL",
    href: "/world-cup",
    tags: ["Settled", "Totals", "Goals"],
    outcomes: [
      { label: "Over 2.5 goals", symbol: "OVR", price: "$0", probability: 0 },
      { label: "Under 2.5 goals", symbol: "UND", price: "$100", probability: 100, won: true },
    ],
  },
  {
    id: "sf1-btts",
    title: "Both teams to score — France vs Spain",
    competition: "World Cup 2026 · Semi-final",
    sport: "Goals",
    status: "ended",
    score: "0 – 2",
    endedAt: "Jul 13",
    pool: "5.4 SOL",
    href: "/world-cup",
    tags: ["Settled", "Goals"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$0", probability: 0 },
      { label: "No", symbol: "NO", price: "$100", probability: 100, won: true },
    ],
  },
  /* ── Settled: quarter-finals ── */
  {
    id: "qf-fra-mar-result",
    title: "France vs Morocco",
    competition: "World Cup 2026 · Quarter-final",
    sport: "Match Result",
    status: "ended",
    score: "2 – 0",
    endedAt: "Jul 10",
    question: "Who wins the quarter-final?",
    pool: "18.9 SOL",
    href: "/world-cup",
    tags: ["Settled", "Match Result"],
    outcomes: [
      { label: "France", symbol: "FRA", price: "$100", probability: 100, won: true },
      { label: "Morocco", symbol: "MAR", price: "$0", probability: 0 },
    ],
  },
  {
    id: "qf-esp-bel-result",
    title: "Spain vs Belgium",
    competition: "World Cup 2026 · Quarter-final",
    sport: "Match Result",
    status: "ended",
    score: "2 – 1",
    endedAt: "Jul 11",
    question: "Who wins the quarter-final?",
    pool: "15.3 SOL",
    href: "/world-cup",
    tags: ["Settled", "Match Result"],
    outcomes: [
      { label: "Spain", symbol: "ESP", price: "$100", probability: 100, won: true },
      { label: "Belgium", symbol: "BEL", price: "$0", probability: 0 },
    ],
  },
  {
    id: "qf-nor-eng-result",
    title: "Norway vs England",
    competition: "World Cup 2026 · Quarter-final",
    sport: "Match Result",
    status: "ended",
    score: "1 – 2",
    endedAt: "Jul 12",
    question: "Who wins the quarter-final?",
    pool: "11.8 SOL",
    href: "/world-cup",
    tags: ["Settled", "Match Result"],
    outcomes: [
      { label: "Norway", symbol: "NOR", price: "$0", probability: 0 },
      { label: "England", symbol: "ENG", price: "$100", probability: 100, won: true },
    ],
  },
  {
    id: "qf-arg-sui-result",
    title: "Argentina vs Switzerland",
    competition: "World Cup 2026 · Quarter-final",
    sport: "Match Result",
    status: "ended",
    score: "3 – 1",
    endedAt: "Jul 12",
    question: "Who wins the quarter-final?",
    pool: "16.4 SOL",
    href: "/world-cup",
    tags: ["Settled", "Match Result"],
    outcomes: [
      { label: "Argentina", symbol: "ARG", price: "$100", probability: 100, won: true },
      { label: "Switzerland", symbol: "SUI", price: "$0", probability: 0 },
    ],
  },
  {
    id: "qf-fra-mar-o25",
    title: "Over 2.5 goals — France vs Morocco",
    competition: "World Cup 2026 · Quarter-final",
    sport: "Totals",
    status: "ended",
    score: "2 – 0",
    endedAt: "Jul 10",
    pool: "4.9 SOL",
    href: "/world-cup",
    tags: ["Settled", "Totals", "Goals"],
    outcomes: [
      { label: "Over 2.5 goals", symbol: "OVR", price: "$0", probability: 0 },
      { label: "Under 2.5 goals", symbol: "UND", price: "$100", probability: 100, won: true },
    ],
  },
  {
    id: "qf-arg-sui-o25",
    title: "Over 2.5 goals — Argentina vs Switzerland",
    competition: "World Cup 2026 · Quarter-final",
    sport: "Totals",
    status: "ended",
    score: "3 – 1",
    endedAt: "Jul 12",
    pool: "5.6 SOL",
    href: "/world-cup",
    tags: ["Settled", "Totals", "Goals"],
    outcomes: [
      { label: "Over 2.5 goals", symbol: "OVR", price: "$100", probability: 100, won: true },
      { label: "Under 2.5 goals", symbol: "UND", price: "$0", probability: 0 },
    ],
  },
];
