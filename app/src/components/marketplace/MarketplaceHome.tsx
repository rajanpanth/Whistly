"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Gift, Radio, SlidersHorizontal, Sparkles, WalletCards } from "lucide-react";
import WalletConnectModal from "@/components/WalletConnectModal";
import { FEATURED_MARKET, LIVE_MARKETS, SPORTS_MARKETS, SPORT_TABS } from "@/lib/marketplaceData";
import { FeaturedMarketCard, LiveMarketCard, MarketCard } from "./MarketCards";

const OFFERS = [
  { eyebrow: "New predictor offer", title: "Earn 250 demo credits", copy: "Make your first World Cup prediction and unlock a practice balance." },
  { eyebrow: "Weekly challenge", title: "Build a 3-pick combo", copy: "Test your read across three markets and climb the Whistly leaderboard." },
  { eyebrow: "Live rewards", title: "Predict the next moment", copy: "Explore time-boxed goal, corner, card, and score markets during live play." },
];

function MarketplaceSidebar() {
  const [slide, setSlide] = useState(0);
  const [odds, setOdds] = useState("Probability");
  const [walletOpen, setWalletOpen] = useState(false);
  const offer = OFFERS[slide];
  return <aside className="market-sidebar" aria-label="Offers and settings">
    <section className="market-promo-card"><p><Gift size={14} />{offer.eyebrow}</p><h2>{offer.title}</h2><span>{offer.copy}</span><button type="button" className="market-cta" onClick={() => setWalletOpen(true)}>Connect to claim</button><div className="market-carousel-controls"><button type="button" aria-label="Previous offer" onClick={() => setSlide((slide + OFFERS.length - 1) % OFFERS.length)}><ChevronLeft size={16} /></button><div>{OFFERS.map((_, index) => <i key={index} className={index === slide ? "active" : ""} />)}</div><button type="button" aria-label="Next offer" onClick={() => setSlide((slide + 1) % OFFERS.length)}><ChevronRight size={16} /></button></div></section>
    <section className="market-info-card"><div className="market-info-icon"><WalletCards size={18} /></div><div><h3>Predict as you play</h3><p>Use demo markets to learn the interface before connecting to existing Solana flows.</p></div></section>
    <section className="market-odds-card"><h3><SlidersHorizontal size={15} />Odds display</h3><div role="group" aria-label="Odds display format">{["Probability", "Decimal", "Payout"].map(item => <button type="button" key={item} className={odds === item ? "active" : ""} onClick={() => setOdds(item)}>{item}</button>)}</div><p><Sparkles size={13} />Shown as {odds.toLowerCase()}. Example values are illustrative.</p><button type="button" className="market-cta light" onClick={() => setWalletOpen(true)}>Connect wallet</button></section>
    <WalletConnectModal isOpen={walletOpen} onClose={() => setWalletOpen(false)} />
  </aside>;
}

export default function MarketplaceHome() {
  const [activeSport, setActiveSport] = useState<(typeof SPORT_TABS)[number]>("All");
  const markets = useMemo(() => activeSport === "All" || activeSport === "Soccer" ? SPORTS_MARKETS : SPORTS_MARKETS.filter(market => market.sport === activeSport || market.tags.includes(activeSport)), [activeSport]);
  return <div className="market-home">
    <nav className="market-sport-tabs" aria-label="Sport categories">{SPORT_TABS.map(tab => <button type="button" key={tab} className={activeSport === tab ? "active" : ""} onClick={() => setActiveSport(tab)}>{tab}</button>)}</nav>
    <section className="market-hero-layout" aria-label="Featured market"><FeaturedMarketCard market={FEATURED_MARKET} /><MarketplaceSidebar /></section>
    <section className="market-section" aria-labelledby="live-markets-title"><header className="market-section-header"><div><Radio size={16} /><h2 id="live-markets-title">Live now <span>({LIVE_MARKETS.length})</span></h2></div><Link href="/live" aria-label="View all live markets"><ChevronRight size={18} /></Link></header><div className="market-live-grid">{LIVE_MARKETS.map(market => <LiveMarketCard market={market} key={market.id} />)}</div></section>
    <section className="market-section" aria-labelledby="sports-markets-title"><header className="market-section-header"><div><h2 id="sports-markets-title">Sports markets</h2></div><Link href="/events">View all <ChevronRight size={16} /></Link></header>{markets.length ? <div className="market-main-layout"><Link href="/live" className="market-visual-card"><div className="market-pitch" aria-hidden="true"><span /><i /><b /></div><div><span className="market-live-badge"><span />Live</span><small>World Cup · 63:20 · 1–1</small><h3>Argentina<br />vs Brazil</h3><p>Open live market <ChevronRight size={16} /></p></div></Link><div className="market-grid">{markets.map(market => <MarketCard market={market} key={market.id} />)}</div></div> : <div className="market-empty"><h3>No open markets</h3><p>There are no markets in this category right now. Choose another sport to keep exploring.</p><button type="button" onClick={() => setActiveSport("All")}>Show all markets</button></div>}</section>
  </div>;
}

