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

/* 2026 FIFA World Cup — the final is set (kick-offs converted from NPT to UTC).
   Semi-final 1: France 0–2 Spain (FT Jul 13)
   Semi-final 2: England 1–2 Argentina (FT Jul 16)
   Third place:  France 4–6 England (FT Jul 19)
   Final:        Spain vs Argentina — Jul 20 00:45 NPT → Jul 19 19:00 UTC */
export const KICKOFFS = {
  thirdPlace: "2026-07-18T21:00:00Z",
  final: "2026-07-19T19:00:00Z",
} as const;

export const NEXT_KICKOFF = {
  title: "Spain vs Argentina",
  label: "Final",
  countdown: "0d : 13h : 59m : 0s",
  kickoff: KICKOFFS.final,
} as const;

export const FEATURED_MARKETS: MarketplaceMarket[] = [
  {
    id: "featured-esp-arg-final",
    title: "Spain vs Argentina",
    competition: "World Cup 2026 · Final",
    sport: "Match Result",
    status: "upcoming",
    countdown: "3d : 13h : 59m : 0s",
    kickoff: KICKOFFS.final,
    question: "Who lifts the trophy? · Jul 20, 12:45 am NPT",
    pool: "38.4 SOL pool",
    combo: true,
    featured: true,
    href: "/world-cup",
    tags: ["Upcoming", "World Cup", "Match Result"],
    outcomes: [
      { label: "Spain", symbol: "ESP", price: "$185", probability: 54 },
      { label: "Argentina", symbol: "ARG", price: "$217", probability: 46 },
    ],
  },
  {
    id: "featured-wc-winner",
    title: "Who wins the World Cup?",
    competition: "FIFA World Cup 2026 · Outright",
    sport: "Match Result",
    status: "upcoming",
    countdown: "3d : 13h : 59m : 0s",
    kickoff: KICKOFFS.final,
    question: "The final is set — Spain vs Argentina · Jul 20",
    pool: "41.2 SOL pool",
    combo: true,
    featured: true,
    href: "/world-cup",
    tags: ["Upcoming", "World Cup", "Outright"],
    outcomes: [
      { label: "Spain", symbol: "ESP", price: "$185", probability: 54 },
      { label: "Argentina", symbol: "ARG", price: "$217", probability: 46 },
    ],
  },
  {
    id: "featured-final-90",
    title: "Final goes beyond 90 minutes?",
    competition: "World Cup 2026 · Final · Jul 20",
    sport: "Match Result",
    status: "upcoming",
    countdown: "3d : 13h : 59m : 0s",
    kickoff: KICKOFFS.final,
    question: "Extra time or penalties in Spain vs Argentina? · Jul 20, 12:45 am NPT",
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

/* No matches are being played right now — the next fixture is the final. */
export const LIVE_MARKETS: MarketplaceMarket[] = [];

export const SOCCER_SPOTLIGHT: MarketplaceMarket = {
  id: "spotlight-esp-arg",
  title: "Spain vs Argentina",
  competition: "World Cup 2026 · Final",
  sport: "Match Result",
  status: "upcoming",
  countdown: "3d : 13h : 59m : 0s",
  kickoff: KICKOFFS.final,
  question: "Who lifts the trophy?",
  image: "/spotlight-esp-arg.webp",
  href: "/world-cup",
  tags: ["Upcoming", "Match Result"],
  outcomes: [
    { label: "Spain", symbol: "ESP", price: "$185", probability: 54 },
    { label: "Argentina", symbol: "ARG", price: "$217", probability: 46 },
  ],
};

export const SPORTS_MARKETS: MarketplaceMarket[] = [
  /* ── Upcoming: the final ── */
  {
    id: "final-result",
    title: "Spain vs Argentina",
    competition: "World Cup 2026 · Final",
    sport: "Match Result",
    status: "upcoming",
    countdown: "3d : 13h : 59m : 0s",
    kickoff: KICKOFFS.final,
    question: "Who wins the World Cup final?",
    pool: "16.8 SOL",
    combo: true,
    href: "/world-cup",
    tags: ["Upcoming", "Match Result"],
    outcomes: [
      { label: "Spain", symbol: "ESP", price: "$185", probability: 54 },
      { label: "Argentina", symbol: "ARG", price: "$217", probability: 46 },
    ],
  },
  {
    id: "final-o25",
    title: "Over 2.5 goals — Spain vs Argentina",
    competition: "World Cup 2026 · Final",
    sport: "Totals",
    status: "upcoming",
    countdown: "3d : 13h : 59m : 0s",
    kickoff: KICKOFFS.final,
    pool: "5.2 SOL",
    href: "/world-cup",
    tags: ["Upcoming", "Totals", "Goals"],
    outcomes: [
      { label: "Over 2.5 goals", symbol: "OVR", price: "$213", probability: 47 },
      { label: "Under 2.5 goals", symbol: "UND", price: "$189", probability: 53 },
    ],
  },
  {
    id: "final-btts",
    title: "Both teams to score — Spain vs Argentina",
    competition: "World Cup 2026 · Final",
    sport: "Goals",
    status: "upcoming",
    countdown: "3d : 13h : 59m : 0s",
    kickoff: KICKOFFS.final,
    pool: "4.6 SOL",
    combo: true,
    href: "/world-cup",
    tags: ["Upcoming", "Goals"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$179", probability: 56 },
      { label: "No", symbol: "NO", price: "$227", probability: 44 },
    ],
  },
  {
    id: "final-extra-time",
    title: "Final goes beyond 90 minutes?",
    competition: "World Cup 2026 · Final · Jul 20",
    sport: "Match Result",
    status: "upcoming",
    countdown: "3d : 13h : 59m : 0s",
    kickoff: KICKOFFS.final,
    question: "Spain vs Argentina · Jul 20, 12:45 am NPT",
    pool: "4.1 SOL",
    href: "/world-cup",
    tags: ["Upcoming", "Match Result"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$294", probability: 34 },
      { label: "No", symbol: "NO", price: "$152", probability: 66 },
    ],
  },
  /* ── Settled: third place (France 4–6 England, Jul 19) ── */
  {
    id: "third-place-result",
    title: "France vs England",
    competition: "World Cup 2026 · Third place",
    sport: "Match Result",
    status: "ended",
    score: "4 – 6",
    endedAt: "Jul 19",
    question: "Who takes third place?",
    pool: "6.4 SOL",
    href: "/world-cup",
    tags: ["Settled", "Match Result"],
    outcomes: [
      { label: "France", symbol: "FRA", price: "$0", probability: 0 },
      { label: "England", symbol: "ENG", price: "$100", probability: 100, won: true },
    ],
  },
  {
    id: "third-place-o25",
    title: "Over 2.5 goals — France vs England",
    competition: "World Cup 2026 · Third place",
    sport: "Totals",
    status: "ended",
    score: "4 – 6",
    endedAt: "Jul 19",
    pool: "2.8 SOL",
    href: "/world-cup",
    tags: ["Settled", "Totals", "Goals"],
    outcomes: [
      { label: "Over 2.5 goals", symbol: "OVR", price: "$100", probability: 100, won: true },
      { label: "Under 2.5 goals", symbol: "UND", price: "$0", probability: 0 },
    ],
  },
  /* ── Settled: semi-final 2 (England 1–2 Argentina, Jul 16) ── */
  {
    id: "sf2-result",
    title: "England vs Argentina",
    competition: "World Cup 2026 · Semi-final",
    sport: "Match Result",
    status: "ended",
    score: "1 – 2",
    endedAt: "Jul 16",
    question: "Who wins the semi-final?",
    pool: "12.6 SOL",
    href: "/world-cup",
    tags: ["Settled", "Match Result"],
    outcomes: [
      { label: "England", symbol: "ENG", price: "$0", probability: 0 },
      { label: "Argentina", symbol: "ARG", price: "$100", probability: 100, won: true },
    ],
  },
  {
    id: "sf2-o25",
    title: "Over 2.5 goals — England vs Argentina",
    competition: "World Cup 2026 · Semi-final",
    sport: "Totals",
    status: "ended",
    score: "1 – 2",
    endedAt: "Jul 16",
    pool: "5.9 SOL",
    href: "/world-cup",
    tags: ["Settled", "Totals", "Goals"],
    outcomes: [
      { label: "Over 2.5 goals", symbol: "OVR", price: "$100", probability: 100, won: true },
      { label: "Under 2.5 goals", symbol: "UND", price: "$0", probability: 0 },
    ],
  },
  {
    id: "sf2-btts",
    title: "Both teams to score — England vs Argentina",
    competition: "World Cup 2026 · Semi-final",
    sport: "Goals",
    status: "ended",
    score: "1 – 2",
    endedAt: "Jul 16",
    pool: "4.8 SOL",
    href: "/world-cup",
    tags: ["Settled", "Goals"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$100", probability: 100, won: true },
      { label: "No", symbol: "NO", price: "$0", probability: 0 },
    ],
  },
  {
    id: "sf2-gap",
    title: "Goal gap over 1.5 — England vs Argentina",
    competition: "World Cup 2026 · Semi-final",
    sport: "Goal Gap",
    status: "ended",
    score: "1 – 2",
    endedAt: "Jul 16",
    pool: "3.7 SOL",
    href: "/world-cup",
    tags: ["Settled", "Goal Gap", "Goals"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$0", probability: 0 },
      { label: "No", symbol: "NO", price: "$100", probability: 100, won: true },
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
];
