"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Activity, ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight, CircleDot, Gift, ShieldCheck, Sparkles, TrendingUp, WalletCards } from "lucide-react";

// Loaded on demand so the wallet-adapter UI stack stays out of the homepage bundle.
const WalletConnectModal = dynamic(() => import("@/components/WalletConnectModal"), { ssr: false });
import { useApp } from "@/components/Providers";
import UpcomingFixtures from "@/components/UpcomingFixtures";
import { FEATURED_MARKETS, LIVE_MARKETS, NEXT_KICKOFF, SOCCER_SPOTLIGHT, SPORTS_MARKETS, SPORT_TABS } from "@/lib/marketplaceData";
import { FeaturedMarketCard, LiveMarketCard, MarketCard, SoccerSpotlightCard } from "./MarketCards";
import CountdownTimer from "./CountdownTimer";

const QUICK_PICKS = ["Goal", "Cards", "Corners", "Result"];

const PROMO_SLIDES = [
  { kicker: "World Cup Demo Mode", heading: "The final is set.", copy: "Spain vs Argentina — Jul 20, 12:45 am NPT. France and England play for third on Jul 19. Live micro-markets open at kickoff, built on Solana devnet.", cta: "See final markets", href: "/world-cup" },
  { kicker: "Builder demo offer", heading: "Practice with devnet SOL.", copy: "Every position, lock, and payout is verifiable on-chain. No real money is involved in demo mode.", cta: "Get devnet SOL", href: "/docs" },
] as const;

function PromoCard() {
  const [slide, setSlide] = useState(0);
  const active = PROMO_SLIDES[slide];
  return <section className="market-promo-card">
    <p><span className="market-promo-chip"><Gift size={12} /> {active.kicker}</span></p>
    <h2>{active.heading}</h2>
    <span>{active.copy}</span>
    <Link href={active.href} className="market-cta light">{active.cta} <ArrowUpRight size={13} /></Link>
    <div className="market-carousel-controls">
      <button type="button" aria-label="Previous offer" onClick={() => setSlide(s => (s + PROMO_SLIDES.length - 1) % PROMO_SLIDES.length)}><ChevronLeft size={15} /></button>
      <div aria-hidden="true">{PROMO_SLIDES.map((item, index) => <i key={item.kicker} className={index === slide ? "active" : ""} />)}</div>
      <button type="button" aria-label="Next offer" onClick={() => setSlide(s => (s + 1) % PROMO_SLIDES.length)}><ChevronRight size={15} /></button>
    </div>
  </section>;
}

function StatusCard() {
  return <section className="market-status-card">
    <div className="market-status-heading"><span><ShieldCheck size={15} /> TxLINE status</span><b><i /> DEMO</b></div>
    {[["Fixtures", "Demo feed"], ["Scores", "Demo feed"], ["Odds", "Demo feed"], ["Network", "Devnet"], ["Validation", "Mock · v1.5.6-ready"]].map(([label, value]) => <div className="market-status-row" key={label}><span>{label}</span><strong>{value}<CheckCircle2 size={12} /></strong></div>)}
    <p>Real TxLINE validation is not claimed unless configured.</p>
  </section>;
}

function InfoCard() {
  return <section className="market-info-card">
    <span className="market-info-icon"><TrendingUp size={16} /></span>
    <div>
      <h3>Trade transparently on devnet</h3>
      <p>Win or lose, every settlement resolves from score data and stays readable on-chain.</p>
    </div>
  </section>;
}

function QuickPick() {
  const [active, setActive] = useState("Goal");
  return <section className="market-odds-card">
    <h3><Sparkles size={13} /> Pick how the match moves</h3>
    <div role="tablist" aria-label="Quick pick market family">{QUICK_PICKS.map(item => <button type="button" role="tab" aria-selected={active === item} className={active === item ? "active" : ""} key={item} onClick={() => setActive(item)}>{item}</button>)}</div>
    <p>Micro-markets resolve in minutes. 70% means a 70-in-100 chance of happening.</p>
    <Link href="/events" className="market-cta light">View {active.toLowerCase()} markets</Link>
  </section>;
}

function MarketplaceSidebar({ onWallet, walletConnected, walletAddress }: { onWallet: () => void; walletConnected: boolean; walletAddress: string | null }) {
  return <aside className="market-sidebar" aria-label="Market status and actions">
    <PromoCard />
    <UpcomingFixtures limit={5} />
    <InfoCard />
    <StatusCard />
    <QuickPick />
    {walletConnected && walletAddress
      ? <Link href="/portfolio" className="market-rail-wallet"><WalletCards size={15} /> {walletAddress.slice(0, 4)}…{walletAddress.slice(-4)} · My Positions</Link>
      : <button type="button" className="market-rail-wallet" onClick={onWallet}><WalletCards size={15} /> Connect wallet to trade</button>}
  </aside>;
}

export default function MarketplaceHome() {
  const { walletConnected, walletAddress } = useApp();
  const [activeSport, setActiveSport] = useState<string>("All markets");
  const [walletOpen, setWalletOpen] = useState(false);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [featuredProgress, setFeaturedProgress] = useState(0);
  const featuredMarket = FEATURED_MARKETS[featuredIndex];

  useEffect(() => {
    let elapsed = 0;
    const timer = window.setInterval(() => {
      elapsed += 250;
      if (elapsed >= 11000) {
        elapsed = 0;
        setFeaturedIndex(index => (index + 1) % FEATURED_MARKETS.length);
      }
      setFeaturedProgress((elapsed / 11000) * 100);
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  function changeFeatured(direction: number) {
    setFeaturedIndex(index => (index + direction + FEATURED_MARKETS.length) % FEATURED_MARKETS.length);
    setFeaturedProgress(0);
  }

  const markets = useMemo(() => activeSport === "All markets" ? SPORTS_MARKETS : SPORTS_MARKETS.filter(market => market.sport.toLowerCase().includes(activeSport.toLowerCase()) || market.tags.some(tag => tag.toLowerCase().includes(activeSport.toLowerCase()))), [activeSport]);
  // Markets already shown in the Soccer spotlight are excluded from the
  // themed sections below so no card appears twice on the page.
  const spotlightIdSet = new Set(["final-o25", "final-btts", "final-extra-time", "third-place-result"]);
  const groups = [
    { title: "World Cup goals", filter: "Goals", items: markets.filter(m => (m.sport === "Goals" || m.sport === "Totals" || m.tags.includes("Goals")) && m.status !== "ended" && !spotlightIdSet.has(m.id)) },
    { title: "Match result", filter: "Match Result", items: markets.filter(m => (m.sport === "Match Result" || m.tags.includes("Match Result")) && m.status !== "ended" && !spotlightIdSet.has(m.id)) },
    { title: "Settled knockout matches", filter: "Settled", items: markets.filter(m => m.status === "ended") },
  ];
  const spotlightGrid = SPORTS_MARKETS.filter(m => spotlightIdSet.has(m.id));

  return <div className="market-home">
    <div className="market-marketbar"><div><span className="market-marketbar-dot" /> Live market discovery</div><span>Solana devnet · simulated data</span></div>
    <nav className="market-sport-tabs" aria-label="Market categories">{SPORT_TABS.map(tab => <button type="button" key={tab} className={activeSport === tab ? "active" : ""} onClick={() => setActiveSport(tab)}>{tab}</button>)}</nav>

    <div className="market-page-layout">
      <div className="market-main-column">
        <section className="market-hero-layout" aria-label="Featured market">
          <div className="market-featured-carousel">
            <FeaturedMarketCard market={featuredMarket} />
            <div className="market-featured-controls">
              <div className="market-featured-control-row">
                <div className="market-featured-dots" aria-label={"Featured market timer: " + Math.round(featuredProgress) + " percent"}>
                  {FEATURED_MARKETS.map((market, index) => <button type="button" key={market.id} className={index === featuredIndex ? "active" : ""} style={index === featuredIndex ? { background: "linear-gradient(90deg, #f4f4f5 " + featuredProgress + "%, #55555d " + featuredProgress + "%)" } : undefined} aria-label={"Show " + market.title} onClick={() => { setFeaturedIndex(index); setFeaturedProgress(0); }} />)}
                </div>
                <div className="market-featured-switchers">
                  <button type="button" aria-label="Previous featured market" onClick={() => changeFeatured(-1)}><ChevronRight size={15} className="rotate-180" /></button>
                  <button type="button" className="market-featured-switcher-label" onClick={() => changeFeatured(-1)}>{FEATURED_MARKETS[(featuredIndex + FEATURED_MARKETS.length - 1) % FEATURED_MARKETS.length].title}</button>
                  <button type="button" className="market-featured-switcher-label" onClick={() => changeFeatured(1)}>{FEATURED_MARKETS[(featuredIndex + 1) % FEATURED_MARKETS.length].title}</button>
                  <button type="button" aria-label="Next featured market" onClick={() => changeFeatured(1)}><ChevronRight size={15} /></button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="market-section market-live-section" aria-labelledby="live-markets-title">
          <header className="market-section-header"><div><span className="market-live-dot" aria-hidden="true" /><h2 id="live-markets-title">Live now <span>({LIVE_MARKETS.length})</span></h2></div><Link href="/live">Open live board <ChevronRight size={16} /></Link></header>
          {LIVE_MARKETS.length > 0
            ? <div className="market-live-grid">{LIVE_MARKETS.slice(0, 3).map(market => <LiveMarketCard market={market} key={market.id} />)}</div>
            : <div className="market-live-empty"><span>No matches are live right now.</span><span>Next kickoff — <strong>{NEXT_KICKOFF.title}</strong> ({NEXT_KICKOFF.label}) in</span><CountdownTimer value={NEXT_KICKOFF.countdown} target={NEXT_KICKOFF.kickoff} /><Link href="/world-cup">See schedule <ChevronRight size={14} /></Link></div>}
        </section>

        <section className="market-section" aria-labelledby="soccer-spotlight-title">
          <header className="market-section-header"><div><Activity size={15} /><h2 id="soccer-spotlight-title">Soccer</h2></div><Link href="/world-cup">Browse World Cup <ChevronRight size={16} /></Link></header>
          <div className="market-main-layout">
            <SoccerSpotlightCard market={SOCCER_SPOTLIGHT} />
            <div className="market-grid">{spotlightGrid.map(market => <MarketCard market={market} key={"spotlight-" + market.id} />)}</div>
          </div>
        </section>

        {groups.map(group => <section className="market-section" aria-labelledby={group.filter} key={group.title}>
          <header className="market-section-header"><div><Activity size={15} /><h2 id={group.filter}>{group.title}</h2></div><button type="button" onClick={() => setActiveSport(group.filter)}>Browse section <ChevronRight size={16} /></button></header>
          {group.items.length > 0 ? <div className="market-category-grid">{group.items.slice(0, 4).map(market => <MarketCard market={market} key={market.id} />)}</div> : <div className="market-empty"><p>No markets in this filter yet. Browse all markets to keep exploring.</p><button type="button" onClick={() => setActiveSport("All markets")}>Show all markets</button></div>}
        </section>)}

        <section className="market-trust-strip"><div><CircleDot size={16} /><strong>Built for transparent reads</strong><span>Market labels, settlement notes, and demo status stay visible at every step.</span></div><Link href="/verify">Read verification notes <ArrowUpRight size={14} /></Link></section>
      </div>
      <MarketplaceSidebar onWallet={() => setWalletOpen(true)} walletConnected={walletConnected} walletAddress={walletAddress} />
    </div>

    {walletOpen && <WalletConnectModal isOpen={walletOpen} onClose={() => setWalletOpen(false)} />}
  </div>;
}
