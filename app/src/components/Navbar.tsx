"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import BrandMark from "./marketplace/BrandMark";
import { PRIMARY_MARKET_NAV } from "@/lib/marketplaceData";
import WalletConnectModal from "./WalletConnectModal";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [query, setQuery] = useState("");

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (query.trim()) router.push(`/events?q=${encodeURIComponent(query.trim())}`);
  }

  return <header className="market-header">
    <div className="market-header-top"><BrandMark /><form role="search" onSubmit={submitSearch}><Search size={15} /><label className="sr-only" htmlFor="market-search">Search markets</label><input id="market-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search for anything" /><kbd>/</kbd></form><div className="market-header-actions"><button type="button" className="market-connect" onClick={() => setWalletOpen(true)}>Sign in to trade</button><button type="button" className="market-menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Toggle navigation">{open ? <X size={19} /> : <Menu size={19} />}</button></div></div>
    <nav className={`market-primary-nav ${open ? "is-open" : ""}`} aria-label="Primary navigation">{PRIMARY_MARKET_NAV.map(item => { const selected = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href.split("?")[0]); return <Link key={item.label} href={item.href} onClick={() => setOpen(false)} className={selected ? "active" : ""}>{item.label === "Live" && <span className="market-nav-live" />}{item.label}{"liveCount" in item && <em>({item.liveCount})</em>}</Link>; })}</nav>
    <WalletConnectModal isOpen={walletOpen} onClose={() => setWalletOpen(false)} />
  </header>;
}

export default Navbar;
