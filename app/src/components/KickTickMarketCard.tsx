import Link from "next/link";
import { Bookmark, Gift, MessageCircle, Radio } from "lucide-react";
import type { KickTickMarket } from "@/lib/kicktickMarkets";

type Props = { market: KickTickMarket; compact?: boolean };

const flagFor = (team: string) => {
  const value = team.toLowerCase();
  if (value.includes("argentina")) return "🇦🇷";
  if (value.includes("brazil")) return "🇧🇷";
  if (value.includes("norway")) return "🇳🇴";
  if (value.includes("england")) return "🏴";
  if (value.includes("france")) return "🇫🇷";
  if (value.includes("spain")) return "🇪🇸";
  if (value.includes("germany")) return "🇩🇪";
  if (value.includes("japan")) return "🇯🇵";
  return "⚽";
};

export default function KickTickMarketCard({ market }: Props) {
  const live = market.status === "LIVE";
  const resolved = market.status === "RESOLVED";
  const homeFlag = flagFor(market.homeTeam);
  const awayFlag = flagFor(market.awayTeam);

  return (
    <Link href={market.tradeHref} className="group block">
      <article className="flex min-h-[226px] flex-col rounded-[0.9rem] border border-[#29292f] bg-[#19191d] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[#3b3b43] hover:bg-[#1e1e23]">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#303037] bg-[#232328] text-2xl">{homeFlag}</span>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-[15px] font-bold leading-5 text-[#f4f4f5]">{market.question}</h3>
            <div className="mt-1 truncate text-xs text-[#8b8b94]">{market.matchName}</div>
          </div>
          <Bookmark size={17} className="shrink-0 text-[#6f6f78] transition group-hover:text-white" />
        </div>

        <div className="mt-4 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{homeFlag}</span>
            <span className="flex-1 text-sm font-semibold text-[#e6e6e9]">{market.homeTeam}</span>
            <span className="font-mono text-lg font-bold text-[#e6e6e9]">{market.yesProbability}%</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{awayFlag}</span>
            <span className="flex-1 text-sm font-semibold text-[#e6e6e9]">{market.awayTeam}</span>
            <span className="font-mono text-lg font-bold text-[#e6e6e9]">{market.noProbability}%</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="flex h-10 items-center justify-between rounded-[0.65rem] border border-[#20d38a]/25 bg-[#20d38a]/[0.08] px-4 text-sm font-bold text-[#7ce8bb]"><span>YES</span><span className="font-mono">{market.yesProbability}¢</span></div>
          <div className="flex h-10 items-center justify-between rounded-[0.65rem] border border-[#fa4669]/25 bg-[#fa4669]/[0.08] px-4 text-sm font-bold text-[#f78ba0]"><span>NO</span><span className="font-mono">{market.noProbability}¢</span></div>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-4 text-xs font-medium text-[#85858e]">
          {live ? <span className="flex items-center gap-1.5 font-bold text-[#fa4669]"><span className="h-2 w-2 animate-pulse rounded-full bg-current" />LIVE</span> : <span className="font-mono">{resolved ? "RESOLVED" : market.timeLeft}</span>}
          <span>·</span><span className="truncate">{market.volumeSol} Vol.</span><span>·</span><span className="truncate">{market.family}</span>
          <div className="ml-auto flex items-center gap-3"><MessageCircle size={15}/><Gift size={15}/>{live && <Radio size={14} className="text-[#fa4669]"/>}</div>
        </div>
      </article>
    </Link>
  );
}
