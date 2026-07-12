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
  combo?: boolean;
  featured?: boolean;
  outcomes: MarketOutcome[];
  tags: string[];
  href: string;
};

export const PRIMARY_MARKET_NAV = [
  { label: "Trending", href: "/" },
  { label: "Live", href: "/live", liveCount: 3 },
  { label: "World Cup", href: "/world-cup" },
  { label: "Sports", href: "/events" },
  { label: "Crypto", href: "/events?category=crypto" },
  { label: "Politics", href: "/events?category=politics" },
  { label: "Culture", href: "/events?category=culture" },
  { label: "Economy", href: "/events?category=economy" },
  { label: "Companies", href: "/events?category=companies" },
] as const;

export const SPORT_TABS = ["All", "Soccer", "Live", "World Cup", "Goals", "Corners", "Cards", "Totals", "Match Result"] as const;

export const FEATURED_MARKET: MarketplaceMarket = {
  id: "featured-arg-bra",
  title: "Argentina vs Brazil",
  competition: "World Cup 2026 demo",
  sport: "World Cup",
  status: "upcoming",
  countdown: "2d : 11h : 48m",
  combo: true,
  featured: true,
  href: "/world-cup",
  tags: ["Sports", "Soccer"],
  outcomes: [
    { label: "Argentina", symbol: "ARG", price: "2.38", probability: 42 },
    { label: "Draw", symbol: "DRAW", price: "3.70", probability: 27 },
    { label: "Brazil", symbol: "BRA", price: "3.23", probability: 31 },
  ],
};

export const LIVE_MARKETS: MarketplaceMarket[] = [
  {
    id: "live-arg-bra-goal",
    title: "Argentina vs Brazil",
    competition: "World Cup",
    sport: "Goals",
    status: "live",
    clock: "63:20",
    score: "1 – 1",
    combo: true,
    href: "/live",
    tags: ["Live", "Goals"],
    outcomes: [
      { label: "Goal in 5m · Yes", symbol: "YES", price: "1.72", probability: 58 },
      { label: "No", symbol: "NO", price: "2.38", probability: 42 },
    ],
  },
  {
    id: "live-usa-mex",
    title: "USA vs Mexico",
    competition: "World Cup",
    sport: "Match Result",
    status: "live",
    clock: "51:42",
    score: "2 – 1",
    combo: true,
    href: "/live",
    tags: ["Live", "Soccer"],
    outcomes: [
      { label: "USA", symbol: "USA", price: "1.27", probability: 79 },
      { label: "Mexico", symbol: "MEX", price: "4.55", probability: 22 },
    ],
  },
  {
    id: "live-jpn-ita",
    title: "Japan vs Italy",
    competition: "International",
    sport: "Totals",
    status: "live",
    clock: "74:05",
    score: "1 – 2",
    href: "/live",
    tags: ["Live", "Totals"],
    outcomes: [
      { label: "Over 3.5", symbol: "O 3.5", price: "1.82", probability: 55 },
      { label: "Under 3.5", symbol: "U 3.5", price: "2.17", probability: 46 },
    ],
  },
];

export const SPORTS_MARKETS: MarketplaceMarket[] = [
  {
    id: "spain-france",
    title: "Spain vs France",
    competition: "World Cup",
    sport: "World Cup",
    status: "upcoming",
    countdown: "2d : 15h : 58m",
    combo: true,
    href: "/world-cup",
    tags: ["Sports", "Soccer"],
    outcomes: [
      { label: "France", symbol: "FRA", price: "2.38", probability: 42 },
      { label: "Spain", symbol: "ESP", price: "3.33", probability: 30 },
    ],
  },
  {
    id: "france-germany",
    title: "France vs Germany",
    competition: "World Cup",
    sport: "Corners",
    status: "upcoming",
    countdown: "1d : 08h : 12m",
    combo: true,
    href: "/events",
    tags: ["Sports", "Corners"],
    outcomes: [
      { label: "Over 8.5 corners", symbol: "OVER", price: "1.92", probability: 52 },
      { label: "Under 8.5 corners", symbol: "UNDER", price: "2.08", probability: 48 },
    ],
  },
  {
    id: "netherlands-portugal",
    title: "Netherlands vs Portugal",
    competition: "World Cup",
    sport: "Totals",
    status: "upcoming",
    countdown: "3d : 14h : 27m",
    href: "/events",
    tags: ["Sports", "Totals"],
    outcomes: [
      { label: "Over 2.5 goals", symbol: "OVER", price: "1.92", probability: 52 },
      { label: "Under 2.5 goals", symbol: "UNDER", price: "2.08", probability: 48 },
    ],
  },
  {
    id: "england-spain",
    title: "England vs Spain",
    competition: "World Cup",
    sport: "Match Result",
    status: "upcoming",
    countdown: "2d : 13h : 58m",
    combo: true,
    href: "/events",
    tags: ["Sports", "Match Result"],
    outcomes: [
      { label: "Spain", symbol: "ESP", price: "2.44", probability: 41 },
      { label: "Draw", symbol: "DRAW", price: "3.85", probability: 26 },
    ],
  },
  {
    id: "argentina-goals",
    title: "Argentina score in next 10m?",
    competition: "World Cup",
    sport: "Goals",
    status: "upcoming",
    countdown: "2d : 14h : 28m",
    href: "/events",
    tags: ["Sports", "Goals"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "2.27", probability: 44 },
      { label: "No", symbol: "NO", price: "1.79", probability: 56 },
    ],
  },
  {
    id: "italy-cards",
    title: "Italy receive 2+ cards?",
    competition: "International",
    sport: "Cards",
    status: "upcoming",
    countdown: "2d : 14h : 57m",
    combo: true,
    href: "/events",
    tags: ["Sports", "Cards"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "1.64", probability: 61 },
      { label: "No", symbol: "NO", price: "2.44", probability: 41 },
    ],
  },
  {
    id: "brazil-goal-gap",
    title: "Brazil win by 2+ goals?",
    competition: "World Cup",
    sport: "Match Result",
    status: "upcoming",
    countdown: "2d : 14h : 57m",
    href: "/events",
    tags: ["Sports", "Match Result"],
    outcomes: [
      { label: "Yes", symbol: "YES", price: "3.03", probability: 33 },
      { label: "No", symbol: "NO", price: "1.49", probability: 67 },
    ],
  },
  {
    id: "morocco-belgium",
    title: "Morocco vs Belgium",
    competition: "International",
    sport: "Match Result",
    status: "upcoming",
    countdown: "3d : 15h : 12m",
    combo: true,
    href: "/events",
    tags: ["Sports", "Soccer"],
    outcomes: [
      { label: "Morocco", symbol: "MAR", price: "2.44", probability: 41 },
      { label: "Belgium", symbol: "BEL", price: "2.70", probability: 37 },
    ],
  },
  {
    id: "senegal-croatia",
    title: "Senegal vs Croatia",
    competition: "International",
    sport: "Totals",
    status: "upcoming",
    countdown: "3d : 18h : 05m",
    href: "/events",
    tags: ["Sports", "Totals"],
    outcomes: [
      { label: "Over 1.5", symbol: "OVER", price: "1.25", probability: 80 },
      { label: "Under 1.5", symbol: "UNDER", price: "5.00", probability: 20 },
    ],
  },
];

