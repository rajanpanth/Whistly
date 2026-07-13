"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, Search, WalletCards, X } from "lucide-react";
import BrandMark from "./marketplace/BrandMark";
import { PRIMARY_MARKET_NAV } from "@/lib/marketplaceData";
import { useApp } from "./Providers";
import { shortAddr } from "@/lib/utils";
import WalletConnectModal from "./WalletConnectModal";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { walletConnected, walletAddress, disconnectWallet } = useApp();
  const [open, setOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [query, setQuery] = useState("");

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (query.trim()) router.push(`/events?q=${encodeURIComponent(query.trim())}`);
  }

  return <header className="market-header">
    <div className="market-header-top"><BrandMark /><form role="search" onSubmit={submitSearch}><Search size={15} /><label className="sr-only" htmlFor="market-search">Search markets</label><input id="market-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search for anything" /><kbd>/</kbd></form><div className="market-header-actions">
      {walletConnected && walletAddress ? (
        <div className="market-wallet-wrap">
          <button type="button" className="market-connect is-connected" onClick={() => setWalletMenuOpen(v => !v)} aria-expanded={walletMenuOpen} aria-haspopup="menu">
            <span className="market-wallet-dot" aria-hidden="true" />{shortAddr(walletAddress)}
          </button>
          {walletMenuOpen && (
            <>
              <button type="button" className="market-wallet-backdrop" aria-label="Close wallet menu" onClick={() => setWalletMenuOpen(false)} />
              <div className="market-wallet-menu" role="menu">
                <Link href="/portfolio" role="menuitem" onClick={() => setWalletMenuOpen(false)}><WalletCards size={14} /> My Positions</Link>
                <button type="button" role="menuitem" onClick={() => { disconnectWallet(); setWalletMenuOpen(false); }}><LogOut size={14} /> Disconnect</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <button type="button" className="market-connect" onClick={() => setWalletOpen(true)}>Sign in to trade</button>
      )}
      <button type="button" className="market-menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Toggle navigation">{open ? <X size={19} /> : <Menu size={19} />}</button></div></div>
    <nav className={`market-primary-nav ${open ? "is-open" : ""}`} aria-label="Primary navigation">{PRIMARY_MARKET_NAV.map(item => { const selected = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href.split("?")[0]); return <Link key={item.label} href={item.href} onClick={() => setOpen(false)} className={selected ? "active" : ""}>{item.label === "Live" && <span className="market-nav-live" />}{item.label}</Link>; })}</nav>
    <WalletConnectModal isOpen={walletOpen} onClose={() => setWalletOpen(false)} />
  </header>;
}

export default Navbar;
