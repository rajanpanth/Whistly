import Link from "next/link";
import BrandMark from "./marketplace/BrandMark";

const LINKS = [["Home", "/"], ["Live", "/live"], ["Markets", "/events"], ["Verify", "/verify"], ["Docs", "/docs"], ["GitHub", "https://github.com"]] as const;
const LEGAL = [["Risk notes", "/docs"], ["Privacy", "/legal/privacy"], ["Market rules", "/about"], ["TxLINE setup", "/txline-setup"]] as const;

export default function Footer() {
  return <footer className="market-footer"><div className="market-footer-inner"><div className="market-footer-top"><BrandMark compact /><nav aria-label="Footer navigation">{LINKS.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}</nav></div><div className="market-legal-copy"><p><strong>Whistly is an independent hackathon demo.</strong> It is not affiliated with FIFA, Fanatics Markets, ADI PredictStreet, Polymarket, Kalshi, TxODDS, or Superteam unless explicitly stated.</p><p>Market data may be simulated in demo mode. Real-money use is not enabled unless legally and commercially configured. Devnet transactions have no real financial value.</p><p>TxLINE-compatible labels do not mean real TxLINE validation unless credentials, proofs, and a production integration are configured. Review market rules and settlement notes before using the interface.</p></div><div className="market-footer-bottom"><span>© {new Date().getFullYear()} Whistly. Solana + TxLINE-compatible football demo.</span><nav aria-label="Policy links">{LEGAL.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}</nav></div></div></footer>;
}
