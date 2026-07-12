import Link from "next/link";
import { ArrowRight, BarChart3, ShieldCheck, TimerReset, Trophy } from "lucide-react";

const features = [
  { icon: TimerReset, title: "Fast-moving markets", text: "Trade football moments before the window closes." },
  { icon: BarChart3, title: "Transparent outcomes", text: "Markets resolve from clearly identified score and event data." },
  { icon: ShieldCheck, title: "Built on Solana", text: "On-chain activity makes positions and settlements verifiable." },
];

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <section className="rounded-[32px] border border-white/[0.08] bg-[#07112b] p-8 text-center sm:p-12">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-600 text-xl font-black text-white">W</div>
        <h1 className="mt-6 font-heading text-5xl font-bold text-white">Whistly</h1>
        <p className="mt-2 text-sm text-slate-500">Prediction markets for every moment</p>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-300">Trade every football moment before the clock runs out. Whistly combines fast, easy-to-understand markets with transparent, data-driven settlement.</p>
        <Link href="/events" className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-cyan-300 px-6 text-sm font-bold text-[#010820]">Explore markets <ArrowRight size={16} /></Link>
      </section>

      <section className="py-16">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300"><Trophy size={16} /> How Whistly works</div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-2xl border border-white/[0.08] bg-[#0d142b] p-6">
              <Icon className="text-cyan-300" size={22} />
              <h2 className="mt-4 font-heading text-lg font-bold text-white">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-6 text-sm leading-6 text-amber-100/80">
        <strong className="text-amber-200">Demo notice.</strong> Whistly is an independent hackathon demo. Demo tokens have no monetary value, and simulated TxLINE-compatible data may be used where live credentials are unavailable.
      </section>
    </main>
  );
}