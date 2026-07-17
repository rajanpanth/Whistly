import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Live Markets",
    description: "Live in-play micro-markets that open at kickoff and resolve from TxLINE score data.",
};

export default function Layout({ children }: { children: ReactNode }) {
    return children;
}
