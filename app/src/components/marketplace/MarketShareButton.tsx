"use client";

import { Share2 } from "lucide-react";
import toast from "react-hot-toast";

export default function MarketShareButton({ marketId, title }: { marketId: string; title: string }) {
  async function share() {
    const url = `${window.location.origin}/events?market=${encodeURIComponent(marketId)}`;
    try {
      if (navigator.share) await navigator.share({ title: `${title} · Whistly`, url });
      else { await navigator.clipboard.writeText(url); toast.success("Market link copied"); }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Could not share this market");
    }
  }
  return <button type="button" className="market-share" onClick={share} aria-label={`Share ${title}`}><Share2 size={14} /></button>;
}

