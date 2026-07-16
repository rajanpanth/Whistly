import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import InstallPrompt from "@/components/InstallPrompt";
import WebVitals from "@/components/WebVitals";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import PageTransition from "@/components/PageTransition";
import AuroraBackground from "@/components/AuroraBackground";
import AppProviders from "@/components/AppProviders";
import { Toaster } from "react-hot-toast";
import ConditionalFooter from "@/components/ConditionalFooter";
import ConditionalPageShell from "@/components/ConditionalPageShell";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Whistly — Decentralized Prediction Polls",
    template: "%s | Whistly",
  },
  description:
    "Vote on prediction polls with play money. Winners take the losing pool. Powered by Solana.",
  keywords: ["prediction market", "Solana", "voting", "DeFi", "polls", "crypto", "Whistly"],
  authors: [{ name: "Whistly" }],
  creator: "Whistly",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://whistly.app"),
  openGraph: {
    type: "website",
    siteName: "Whistly",
    title: "Whistly — Decentralized Prediction Polls",
    description: "Vote on prediction polls with play money. Winners take the losing pool. Powered by Solana.",
    images: ["/api/og"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Whistly — Decentralized Prediction Polls",
    description: "Vote on prediction polls with play money. Winners take the losing pool.",
    images: ["/api/og"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/icon-512.png",
    apple: "/icon-512.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('instinctfi_theme');document.documentElement.classList.add(t==='light'?'light':'dark')}catch(e){document.documentElement.classList.add('dark')}})()` }} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Whistly",
              description: "Decentralized prediction polls on Solana. Predict, vote, and win.",
              applicationCategory: "FinanceApplication",
              operatingSystem: "Web",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            }),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <AppProviders>
          <AuroraBackground />
          <Suspense fallback={null}>
            <Navbar />
          </Suspense>
          <ErrorBoundary>
            <ConditionalPageShell>
              <PageTransition>
                {children}
              </PageTransition>
            </ConditionalPageShell>
          </ErrorBoundary>
          <ConditionalFooter />
          <InstallPrompt />
          <WebVitals />
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "#161616",
                color: "#e5e5e5",
                border: "1px solid #222",
                fontSize: "14px",
              },
            }}
          />
        </AppProviders>
      </body>
    </html>
  );
}
