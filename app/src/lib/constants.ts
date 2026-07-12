// ─── Shared Constants ───────────────────────────────────────────────────────
// Single source of truth for categories and other shared config

// Admin wallets — used client-side for UI gating (showing edit/delete buttons).
// ⚠ The AUTHORITATIVE admin check is in the `admin_wallets` Supabase table,
//   which is queried by `createAdminRpcHandler` on every admin API call.
//   This client-side list is ONLY for UI gating — never for security decisions.
const ADMIN_WALLETS_ENV = process.env.NEXT_PUBLIC_ADMIN_WALLETS;
export const ADMIN_WALLETS: string[] = ADMIN_WALLETS_ENV
  ? ADMIN_WALLETS_ENV.split(",").map(w => w.trim()).filter(Boolean)
  : process.env.NODE_ENV === "development"
    ? [
        // BUG-15 FIX: Fallback only in development — in production
        // NEXT_PUBLIC_ADMIN_WALLETS env var MUST be set.
        "62PFLSvnG4Zp8jYS9AFymETvV5e8xBA2JBW2UhjqyNmS",
      ]
    : [];

export function isAdminWallet(wallet: string | null): boolean {
  return wallet ? ADMIN_WALLETS.includes(wallet) : false;
}
export const CATEGORIES = [
  "World Cup",
] as const;

export type Category = (typeof CATEGORIES)[number];

type CategoryLabel = Category;

/**
 * Category metadata for poll card badges and World Cup market filters.
 */
export const CATEGORY_META: {
  label: CategoryLabel;
  icon: string;
  color: string;
  bgGradient?: string;  // gradient for poll card category banner
  borderColor?: string; // accent border for cards
  isFilter?: boolean;   // true = UI filter only, not a valid poll category
}[] = [
    { label: "World Cup", icon: "⚽", color: "text-green-400", bgGradient: "from-green-600/20 to-emerald-600/20", borderColor: "border-green-500/30" },
  ];

/** Helper to look up category meta by label */
export function getCategoryMeta(label: string) {
  return CATEGORY_META.find((c) => c.label === label) ?? CATEGORY_META[CATEGORY_META.length - 1];
}

// #61: Dev-mode assertion — detect drift between CATEGORIES and CATEGORY_META
if (process.env.NODE_ENV === "development") {
  const metaLabels = new Set(CATEGORY_META.map(c => c.label));
  for (const cat of CATEGORIES) {
    if (!metaLabels.has(cat)) {
      console.warn(`[constants] Category "${cat}" missing from CATEGORY_META`);
    }
  }
}
