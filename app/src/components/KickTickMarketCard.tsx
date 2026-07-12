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

const codeFor = (team: string) => team.slice(0, 3).toUpperCase();

export default function KickTickMarketCard({ market }: Props) {
  const live = market.status === "LIVE";
  const resolved = market.status === "RESOLVED";
  const homeFlag = flagFor(market.homeTeam);
  const awayFlag = flagFor(market.awayTeam);

  return (
    <Link href={market.tradeHref} className="group block">
      <article className="flex min-h-[226px] flex-col rounded-[20px] border border-[#2a3238] bg-[#1c2428] p-4 shadow-[0_12px_35px_rgba(0,0,0,.14)] transition duration-200 hover:-translate-y-1 hover:border-[#3a464d] hover:bg-[#20292e]">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#08d4c4] to-[#384cff] text-2xl shadow-inner">{homeFlag}</span>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-[15px] font-bold leading-5 text-[#f3f5f7]">{market.question}</h3>
            <div className="mt-1 truncate text-xs text-[#82909a]">{market.matchName}</div>
          </div>
          <Bookmark size={17} className="shrink-0 text-[#778791] transition group-hover:text-white" />
        </div>

        <div className="mt-4 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{homeFlag}</span>
            <span className="flex-1 text-sm font-semibold text-[#dce2e5]">{market.homeTeam}</span>
            <span className="text-lg font-bold text-[#dce2e5]">{market.yesProbability}%</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{awayFlag}</span>
            <span className="flex-1 text-sm font-semibold text-[#dce2e5]">{market.awayTeam}</span>
            <span className="text-lg font-bold text-[#dce2e5]">{market.noProbability}%</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="flex h-11 items-center justify-between rounded-xl bg-[#163d33] px-4 text-sm font-bold text-[#28d889]"><span>YES</span><span>{market.yesProbability}¢</span></div>
          <div className="flex h-11 items-center justify-between rounded-xl bg-[#40262b] px-4 text-sm font-bold text-[#ff3f49]"><span>NO</span><span>{market.noProbability}¢</span></div>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-4 text-xs font-medium text-[#7f8d96]">
          {live ? <span className="flex items-center gap-1.5 font-bold text-[#ff3f49]"><span className="h-2 w-2 animate-pulse rounded-full bg-current" />LIVE</span> : <span>{resolved ? "RESOLVED" : market.timeLeft}</span>}
          <span>·</span><span className="truncate">{market.volumeSol} Vol.</span><span>·</span><span className="truncate">{market.family}</span>
          <div className="ml-auto flex items-center gap-3"><MessageCircle size={15}/><Gift size={15}/>{live && <Radio size={14} className="text-[#ff3f49]"/>}</div>
        </div>
      </article>
    </Link>
  );
}