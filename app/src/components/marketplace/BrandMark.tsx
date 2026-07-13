import Link from "next/link";

/* Whistly mark: whistle with a football chamber (brand asset).
   /brand-logo.png = white ink for dark surfaces (site default)
   /brand-logo-dark.png = navy ink for light surfaces (social, print) */
export default function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" aria-label="Whistly home" className="market-brand">
      <img src="/brand-logo.png" alt="" width={46} height={27} className="market-brand-logo" />
      {!compact && <span>Whistly <b>Markets</b></span>}
    </Link>
  );
}
