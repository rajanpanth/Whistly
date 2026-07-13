import Link from "next/link";

export default function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" aria-label="Whistly home" className="market-brand">
      <span className="market-brand-symbol" aria-hidden="true"><i /><i /><i /></span>
      {!compact && <span>Whistly <b>Markets</b></span>}
    </Link>
  );
}
