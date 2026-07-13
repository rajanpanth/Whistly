export type MarketOutcome = {
  label: string;
  price: string;
  probability: number;
  symbol?: string;
};

export type MarketplaceMarket = {
  id: string;
  title: string;
  competition: string;
  sport: string;
  status: "live" | "upcoming";
  countdown?: string;
  clock?: string;
  score?: string;
  question?: string;
  window?: string;
  pool?: string;
  lock?: string;
  combo?: boolean;
  featured?: boolean;
  outcomes: MarketOutcome[];
  tags: string[];
  href: string;
};

export const PRIMARY_MARKET_NAV = [
  { label: "Trending", href: "/" },
  { label: "Live", href: "/live", liveCount: 5 },
  { label: "World Cup", href: "/world-cup" },
  { label: "Sports", href: "/events" },
  { label: "Prediction Markets", href: "/polls" },
  { label: "My Positions", href: "/portfolio" },
  { label: "Verify", href: "/verify" },
] as const;

export const SPORT_TABS = ["All markets", "Goals", "Corners", "Cards", "Penalties", "Offsides", "Totals", "Goal Gap", "Match Result", "Live 5m", "Live 15m", "Live 45m"] as const;

export const FEATURED_MARKETS: MarketplaceMarket[] = [
  {
    id: "featured-arg-bra-goal5",
    title: "Argentina vs Brazil",
    competition: "World Cup",
    sport: "Goals",
    status: "live",
    clock: "63:20",
    score: "1 – 1",
    question: "Goal in next 5 minutes?",
    window: "63:00 → 68:00",
    pool: "12.4 SOL pool",
    lock: "Locks 66:30",
    combo: true,
    featured: true,
    href: "/live",
    tags: ["Live", "World Cup", "Goals"],
    outcomes: [
      { label: "Yes — goal scored", symbol: "YES", price: "$172", probability: 58 },
      { label: "No — window passes", symbol: "NO", price: "$238", probability: 42 },
    ],
  },
  {
    id: "featured-spain-france",
    title: "Spain vs France",
    competition: "World Cup",
    sport: "Match Result",
    status: "upcoming",
    countdown: "2d : 16h : 4m : 20s",
    question: "Who wins the semi-final?",
    pool: "31.8 SOL pool",
    combo: true,
    featured: true,
    href: "/world-cup",
    tags: ["Sports", "Soccer"],
    outcomes: [
      { label: "France", symbol: "FRA", price: "$238", probability: 42 },
      { label: "Spain", symbol: "ESP", price: "$333", probability: 30 },
    ],
  },
  {
    id: "featured-eng-ned-goals",
    title: "England vs Netherlands",
    competition: "World Cup",
    sport: "Totals",
    status: "upcoming",
    countdown: "1d : 8h : 31m : 12s",
    question: "Over 2.5 goals in the match?",
    pool: "18.2 SOL pool",
    combo: true,
    featured: true,
    href: "/world-cup",
    tags: ["Sports", "Totals"],
    outcomes: [
      { label: "Over 2.5 goals", symbol: "OVR", price: "$192", probability: 52 },
      { label: "Under 2.5 goals", symbol: "UND", price: "$208", probability: 48 },
    ],
  },
];

export const FEATURED_MARKET = FEATURED_MARKETS[0];

export const LIVE_MARKETS: MarketplaceMarket[] = [
  {
    id: "live-arg-bra-goal",
    title: "Argentina vs Brazil",
    competition: "World Cup",
    sport: "Goals",
    status: "live",
    clock: "63:20",
    score: "1 – 1",
    question: "Goal in next 5m?",
    pool: "12.4 SOL",
    lock: "Locks 66:30",
    combo: true,
    href: "/live",
    tags: ["Live", "Goals"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$172", probability: 58 },
      { label: "No", symbol: "NO", price: "$238", probability: 42 },
    ],
  },
  {
    id: "live-usa-mex-corner",
    title: "USA vs Mexico",
    competition: "World Cup",
    sport: "Corners",
    status: "live",
    clock: "51:42",
    score: "2 – 1",
    question: "Corner in next 10m?",
    pool: "6.1 SOL",
    lock: "Locks 58:00",
    combo: true,
    href: "/live",
    tags: ["Live", "Corners"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$147", probability: 68 },
      { label: "No", symbol: "NO", price: "$313", probability: 32 },
    ],
  },
  {
    id: "live-ger-jpn-card",
    title: "Germany vs Japan",
    competition: "World Cup",
    sport: "Cards",
    status: "live",
    clock: "68:05",
    score: "0 – 0",
    question: "Yellow card before 75:00?",
    pool: "4.7 SOL",
    lock: "Locks 73:00",
    href: "/live",
    tags: ["Live", "Cards"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$185", probability: 54 },
      { label: "No", symbol: "NO", price: "$217", probability: 46 },
    ],
  },
  {
    id: "live-por-mar-btts",
    title: "Portugal vs Morocco",
    competition: "World Cup",
    sport: "Goals",
    status: "live",
    clock: "37:12",
    score: "1 – 0",
    question: "Both teams to score?",
    pool: "9.3 SOL",
    lock: "Locks 85:00",
    combo: true,
    href: "/live",
    tags: ["Live", "Goals"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$208", probability: 48 },
      { label: "No", symbol: "NO", price: "$192", probability: 52 },
    ],
  },
  {
    id: "live-fra-cro-o25",
    title: "France vs Croatia",
    competition: "World Cup",
    sport: "Totals",
    status: "live",
    clock: "22:48",
    score: "1 – 1",
    question: "Over 2.5 goals?",
    pool: "14.9 SOL",
    lock: "Locks 90:00",
    href: "/live",
    tags: ["Live", "Totals"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$161", probability: 62 },
      { label: "No", symbol: "NO", price: "$263", probability: 38 },
    ],
  },
];

export const SOCCER_SPOTLIGHT: MarketplaceMarket = {
  id: "spotlight-arg-bra",
  title: "Argentina vs Brazil",
  competition: "World Cup",
  sport: "Goals",
  status: "live",
  clock: "2nd Half 63:20",
  score: "1 – 1",
  question: "Goal in next 5 minutes?",
  href: "/live",
  tags: ["Live", "Goals"],
  outcomes: [
    { label: "Yes", symbol: "YES", price: "$172", probability: 58 },
    { label: "No", symbol: "NO", price: "$238", probability: 42 },
  ],
};

export const SPORTS_MARKETS: MarketplaceMarket[] = [
  {
    id: "arg-goal-5m",
    title: "Goal in next 5m — Argentina vs Brazil",
    competition: "World Cup",
    sport: "Goals",
    status: "live",
    clock: "63:20",
    score: "1 – 1",
    pool: "12.4 SOL",
    combo: true,
    href: "/live",
    tags: ["Live", "Goals", "Live 5m"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$172", probability: 58 },
      { label: "No", symbol: "NO", price: "$238", probability: 42 },
    ],
  },
  {
    id: "arg-goal-15m",
    title: "Goal in next 15m — Argentina vs Brazil",
    competition: "World Cup",
    sport: "Goals",
    status: "live",
    clock: "63:20",
    score: "1 – 1",
    pool: "8.8 SOL",
    href: "/live",
    tags: ["Live", "Goals", "Live 15m"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$135", probability: 74 },
      { label: "No", symbol: "NO", price: "$385", probability: 26 },
    ],
  },
  {
    id: "ned-por-o25",
    title: "Netherlands vs Portugal",
    competition: "World Cup",
    sport: "Totals",
    status: "upcoming",
    countdown: "3d : 14h : 33m : 58s",
    question: "Over 2.5 goals?",
    pool: "7.2 SOL",
    href: "/world-cup",
    tags: ["Sports", "Totals", "Goals"],
    outcomes: [
      { label: "Over 2.5 goals", symbol: "OVR", price: "$192", probability: 52 },
      { label: "Under 2.5 goals", symbol: "UND", price: "$208", probability: 48 },
    ],
  },
  {
    id: "esp-fra-btts",
    title: "Spain vs France",
    competition: "World Cup",
    sport: "Goals",
    status: "upcoming",
    countdown: "2d : 16h : 4m : 20s",
    question: "Both teams to score?",
    pool: "11.6 SOL",
    combo: true,
    href: "/world-cup",
    tags: ["Sports", "Goals"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$164", probability: 61 },
      { label: "No", symbol: "NO", price: "$256", probability: 39 },
    ],
  },
  {
    id: "bra-no-goal-ht",
    title: "No goal until halftime — Brazil vs Uruguay",
    competition: "World Cup",
    sport: "Goals",
    status: "upcoming",
    countdown: "1d : 9h : 12m : 44s",
    pool: "3.4 SOL",
    href: "/events",
    tags: ["Sports", "Goals"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$303", probability: 33 },
      { label: "No", symbol: "NO", price: "$149", probability: 67 },
    ],
  },
  {
    id: "arg-gap-15",
    title: "Goal gap over 1.5 — Argentina vs Brazil",
    competition: "World Cup",
    sport: "Goal Gap",
    status: "upcoming",
    countdown: "0d : 2h : 44m : 3s",
    pool: "5.5 SOL",
    href: "/events",
    tags: ["Sports", "Goal Gap", "Goals"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$417", probability: 24 },
      { label: "No", symbol: "NO", price: "$131", probability: 76 },
    ],
  },
  {
    id: "ger-card-10m",
    title: "Yellow card in next 10m — Germany vs Japan",
    competition: "World Cup",
    sport: "Cards",
    status: "live",
    clock: "68:05",
    score: "0 – 0",
    pool: "4.7 SOL",
    combo: true,
    href: "/live",
    tags: ["Live", "Cards"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$185", probability: 54 },
      { label: "No", symbol: "NO", price: "$217", probability: 46 },
    ],
  },
  {
    id: "red-card-match",
    title: "Red card in the match — Italy vs Croatia",
    competition: "World Cup",
    sport: "Cards",
    status: "upcoming",
    countdown: "2d : 15h : 3m : 58s",
    pool: "2.9 SOL",
    href: "/events",
    tags: ["Sports", "Cards"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$556", probability: 18 },
      { label: "No", symbol: "NO", price: "$122", probability: 82 },
    ],
  },
  {
    id: "corner-5m",
    title: "Corner in next 5m — USA vs Mexico",
    competition: "World Cup",
    sport: "Corners",
    status: "live",
    clock: "51:42",
    score: "2 – 1",
    pool: "6.1 SOL",
    combo: true,
    href: "/live",
    tags: ["Live", "Corners", "Live 5m"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$147", probability: 68 },
      { label: "No", symbol: "NO", price: "$313", probability: 32 },
    ],
  },
  {
    id: "corners-85",
    title: "Over 8.5 corners — France vs Germany",
    competition: "World Cup",
    sport: "Corners",
    status: "upcoming",
    countdown: "1d : 8h : 12m : 40s",
    pool: "4.2 SOL",
    href: "/events",
    tags: ["Sports", "Corners"],
    outcomes: [
      { label: "Over 8.5", symbol: "OVR", price: "$192", probability: 52 },
      { label: "Under 8.5", symbol: "UND", price: "$208", probability: 48 },
    ],
  },
  {
    id: "home-next-corner",
    title: "Home team wins next corner — Spain vs France",
    competition: "World Cup",
    sport: "Corners",
    status: "upcoming",
    countdown: "2d : 16h : 4m : 20s",
    combo: true,
    pool: "3.8 SOL",
    href: "/events",
    tags: ["Sports", "Corners"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$179", probability: 56 },
      { label: "No", symbol: "NO", price: "$227", probability: 44 },
    ],
  },
  {
    id: "result-arg-win",
    title: "Argentina vs Brazil",
    competition: "World Cup",
    sport: "Match Result",
    status: "live",
    clock: "63:20",
    score: "1 – 1",
    question: "Who wins?",
    pool: "26.3 SOL",
    combo: true,
    href: "/live",
    tags: ["Live", "Match Result"],
    outcomes: [
      { label: "Argentina", symbol: "ARG", price: "$244", probability: 41 },
      { label: "Brazil", symbol: "BRA", price: "$270", probability: 37 },
    ],
  },
  {
    id: "result-draw",
    title: "Draw at full time — Argentina vs Brazil",
    competition: "World Cup",
    sport: "Match Result",
    status: "live",
    clock: "63:20",
    score: "1 – 1",
    pool: "8.1 SOL",
    href: "/live",
    tags: ["Live", "Match Result"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$455", probability: 22 },
      { label: "No", symbol: "NO", price: "$128", probability: 78 },
    ],
  },
  {
    id: "result-win-by-2",
    title: "Win by 2+ goals — Brazil vs Uruguay",
    competition: "World Cup",
    sport: "Match Result",
    status: "upcoming",
    countdown: "1d : 9h : 12m : 44s",
    pool: "5.0 SOL",
    href: "/events",
    tags: ["Sports", "Match Result", "Goal Gap"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$333", probability: 30 },
      { label: "No", symbol: "NO", price: "$143", probability: 70 },
    ],
  },
  {
    id: "result-esp-or-draw",
    title: "Spain or draw — Spain vs France",
    competition: "World Cup",
    sport: "Match Result",
    status: "upcoming",
    countdown: "2d : 16h : 4m : 20s",
    combo: true,
    pool: "9.7 SOL",
    href: "/events",
    tags: ["Sports", "Match Result"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "$156", probability: 64 },
      { label: "No", symbol: "NO", price: "$278", probability: 36 },
    ],
  },
];
