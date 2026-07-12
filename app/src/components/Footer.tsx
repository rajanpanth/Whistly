import Link from "next/link";
import BrandMark from "./marketplace/BrandMark";

const LINKS = [["Home", "/"], ["Markets", "/events"], ["Support", "/about"], ["Risk guide", "/docs"]] as const;
const LEGAL = [["Terms", "/legal/terms"], ["Privacy", "/legal/privacy"], ["Market rules", "/about"], ["Verification", "/verify"], ["Data setup", "/txline-setup"]] as const;

export default function Footer() {
  return <footer className="market-footer"><div className="market-footer-inner"><div className="market-footer-top"><BrandMark compact /><nav aria-label="Footer navigation">{LINKS.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}</nav></div><div className="market-legal-copy"><p><strong>Important demo notice.</strong> Whistly is an independent prediction-market interface running with play balances and labeled simulated data where live sources are unavailable. Nothing on this page is financial, investment, or wagering advice.</p><p>Event outcomes and score data may be delayed or incorrect. Review a market’s rules and settlement source before participating. Connected-wallet actions continue through the existing Solana devnet flow; the homepage does not execute a trade.</p><p>Sports names are used only to identify generic events. No league, federation, team, athlete, data provider, or referenced company endorses this independent project. Legal language requires review before any production launch involving real value.</p></div><div className="market-footer-bottom"><span>© {new Date().getFullYear()} Whistly. Independent demo interface.</span><nav aria-label="Policy links">{LEGAL.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}</nav></div></div></footer>;
}
