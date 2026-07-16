import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./fan.css";
import FanHeader from "./FanHeader";

export const metadata: Metadata = {
    title: "Matchday — Live World Cup Fan Companion",
    description: "Make free live football predictions, build streaks, react to match moments, and compete in private friend rooms with TxLINE data.",
    openGraph: {
        title: "Whistly Matchday",
        description: "The free live World Cup companion powered by TxLINE.",
        type: "website",
    },
};

export default function FanLayout({ children }: { children: ReactNode }) {
    return (
        <div className="fan-root">
            <FanHeader />
            {children}
        </div>
    );
}
