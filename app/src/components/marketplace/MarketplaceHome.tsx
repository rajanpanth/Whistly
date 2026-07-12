"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowUpRight, CheckCircle2, ChevronRight, CircleDot, Gift, Radio, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import WalletConnectModal from "@/components/WalletConnectModal";
import { FEATURED_MARKETS, LIVE_MARKETS, SPORTS_MARKETS, SPORT_TABS } from "@/lib/marketplaceData";
import { FeaturedMarketCard, LiveMarketCard, MarketCard } from "./MarketCards";

const QUICK_PICKS = ["Goal", "Cards", "Corners", "Result"];

function StatusCard() {
  return <section className="market-status-card">
    <div className="market-status-heading"><span><ShieldCheck size={15} /> TxLINE status</span><b><i /> DEMO</b></div>
    {[["Fixtures", "Connected"], ["Scores", "Demo feed"], ["Odds", "Demo feed"], ["Network", "Devnet"]].map(([label, value]) => <div className="market-status-row" key={label}><span>{label}</span><strong>{value}<CheckCircle2 size={12} /></strong></div>)}
    <p>Real TxLINE validation is not claimed unless configured.</p>
  </section>;
}

function QuickPick() {
  const [active, setActive] = useState("Goal");
  return <section className="market-quick-card">
    <p className="market-kicker"><Sparkles size={13} /> Quick pick</p>
    <h3>Pick how the match moves</h3>
    <div className="market-quick-tabs">{QUICK_PICKS.map(item => <button type="button" className={active === item ? "active" : ""} key={item} onClick={() => setActive(item)}>{item}</button>)}</div>
    <Link href="/events" className="market-quick-link">View {active.toLowerCase()} markets <ArrowUpRight size={14} /></Link>
  </section>;
}

function MarketplaceSidebar({ onWallet }: { onWallet: () => void }) {
  return <aside className="market-sidebar" aria-label="Market status and actions">
    <section className="market-promo-card">
      <p><Gift size={14} /> World Cup Demo Mode</p>
      <h2>Trade the next moment.</h2>
      <span>Live football micro-markets on Solana devnet, built for fast reads and transparent settlement.</span>
      <Link href="/live" className="market-cta">Open live market <ArrowUpRight size={14} /></Link>
    </section>
    <StatusCard />
    <QuickPick />
    <button type="button" className="market-rail-wallet" onClick={onWallet}><WalletCards size={15} /> Connect wallet to trade</button>
  </aside>;
}

export default function MarketplaceHome() {
  const [activeSport, setActiveSport] = useState<string>("All markets");
  const [walletOpen, setWalletOpen] = useState(false);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [featuredProgress, setFeaturedProgress] = useState(0);
  const featuredMarket = FEATURED_MARKETS[featuredIndex];

  useEffect(() => {
    let elapsed = 0;
    const timer = window.setInterval(() => {
      elapsed += 100;
      if (elapsed >= 11000) {
        elapsed = 0;
        setFeaturedIndex(index => (index + 1) % FEATURED_MARKETS.length);
      }
      setFeaturedProgress((elapsed / 11000) * 100);
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  function changeFeatured(direction: number) {
    setFeaturedIndex(index => (index + direction + FEATURED_MARKETS.length) % FEATURED_MARKETS.length);
    setFeaturedProgress(0);
  }

  const markets = useMemo(() => activeSport === "All markets" ? SPORTS_MARKETS : SPORTS_MARKETS.filter(market => market.sport.toLowerCase().includes(activeSport.toLowerCase()) || market.tags.some(tag => tag.toLowerCase().includes(activeSport.toLowerCase()))), [activeSport]);
  const groups = [
    { title: "World Cup goals", filter: "Goals", items: markets.filter(m => m.sport === "Goals" || m.tags.includes("Goals")) },
    { title: "Cards & corners", filter: "Cards", items: markets.filter(m => ["Cards", "Corners"].includes(m.sport) || m.tags.some(tag => ["Cards", "Corners"].includes(tag))) },
    { title: "Match result", filter: "Match Result", items: markets.filter(m => m.sport === "Match Result" || m.tags.includes("Match Result")) },
  ];

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
          <header className="market-section-header"><div><Radio size={16} /><h2 id="live-markets-title">Live now <span>({LIVE_MARKETS.length})</span></h2></div><Link href="/live">Open live board <ChevronRight size={16} /></Link></header>
          <div className="market-live-grid">{LIVE_MARKETS.map(market => <LiveMarketCard market={market} key={market.id} />)}</div>
        </section>

        {groups.map(group => <section className="market-section" aria-labelledby={group.filter} key={group.title}>
          <header className="market-section-header"><div><Activity size={15} /><h2 id={group.filter}>{group.title}</h2></div><button type="button" onClick={() => setActiveSport(group.filter)}>Browse section <ChevronRight size={16} /></button></header>
          {group.items.length > 0 ? <div className="market-category-grid">{group.items.slice(0, 4).map(market => <MarketCard market={market} key={market.id} />)}</div> : <div className="market-empty"><p>No markets in this filter yet. Browse all markets to keep exploring.</p><button type="button" onClick={() => setActiveSport("All markets")}>Show all markets</button></div>}
        </section>)}

        <section className="market-trust-strip"><div><CircleDot size={16} /><strong>Built for transparent reads</strong><span>Market labels, settlement notes, and demo status stay visible at every step.</span></div><Link href="/verify">Read verification notes <ArrowUpRight size={14} /></Link></section>
      </div>
      <MarketplaceSidebar onWallet={() => setWalletOpen(true)} />
    </div>

    <WalletConnectModal isOpen={walletOpen} onClose={() => setWalletOpen(false)} />
  </div>;
}

