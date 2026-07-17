import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Market Detail",
    description: "Order book, price history, and trade ticket for this World Cup prediction market.",
};

export default function Layout({ children }: { children: ReactNode }) {
    return children;
}
