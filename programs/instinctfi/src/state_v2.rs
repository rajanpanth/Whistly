use anchor_lang::prelude::*;

// ═══════════════════════════════════════════════════════════════════════════
// V2 — CLOB-style share-trading protocol.
//
// Additive module: nothing in state.rs (V1 pari-mutuel) is modified. V1
// markets (market_kind 0/1, side 0 = NO / 1 = YES) keep working untouched.
//
// Economic model
// --------------
// A market has 2..=8 outcomes. One *complete set* = 1 share of every
// outcome and always costs SET_COST lamports to mint / redeems for
// SET_COST at burn. After settlement each winning share pays SET_COST,
// losing shares pay 0. On void, every share of every outcome redeems at
// SET_COST / num_outcomes (floor — dust stays in the vault, so the vault
// can never be under-backed by rounding).
//
// Prices are probabilities in basis points (100 = 1%). Because
// SET_COST = 1_000_000 and PRICE_SCALE = 10_000, one share at price p
// costs exactly p * 100 lamports — integer-exact, no rounding drift.
//
// Matching is off-chain (price-time priority); every matched fill is
// settled on-chain by `settle_fill_v2`, which verifies BOTH parties'
// ed25519-signed order intents via instruction-sysvar introspection.
// Funds move between program-owned BalanceV2 PDAs and the market vault,
// so no wallet transaction signature is needed at fill time and the
// server never holds user keys.
// ═══════════════════════════════════════════════════════════════════════════

/// Initial V2 admin — the program upgrade authority wallet.
/// Rotatable afterwards via `update_config_v2`.
pub const INITIAL_V2_ADMIN: &str = "5cR5PY9VVtAij6qAaifqRqKcDK2xbzYUiibzDZvgsVQo";

/// Lamports one complete set (1 share of every outcome) costs / pays out.
pub const SET_COST: u64 = 1_000_000; // 0.001 SOL

/// Price scale: probabilities in basis points, 10_000 = 100%.
pub const PRICE_SCALE: u64 = 10_000;

/// Lamports per basis point per share (SET_COST / PRICE_SCALE).
pub const LAMPORTS_PER_BP: u64 = SET_COST / PRICE_SCALE; // 100

/// Minimum / maximum limit price (1% .. 99%).
pub const MIN_PRICE_BPS: u16 = 100;
pub const MAX_PRICE_BPS: u16 = 9_900;

/// Hard cap on taker fee.
pub const MAX_FEE_BPS: u16 = 500; // 5%

/// Max outcomes per V2 market.
pub const MAX_OUTCOMES_V2: usize = 8;

/// Domain-separation prefix every signed order message must start with.
pub const ORDER_MAGIC: [u8; 4] = *b"WV2O";
pub const ORDER_VERSION: u8 = 2;
/// V3 payload appends a signed creation timestamp (u32 unix seconds) used to
/// enforce maker priority on-chain. V2 payloads remain accepted (grandfathered
/// resting orders); enforcement applies when both sides carry a timestamp.
pub const ORDER_VERSION_V3: u8 = 3;

/// Byte length of the canonical order payload (see OrderPayloadV2).
pub const ORDER_PAYLOAD_LEN: usize = 4 + 1 + 32 + 32 + 1 + 1 + 2 + 8 + 8 + 8 + 1 + 8;
/// V3 payload length: V2 + u32 created_ts.
pub const ORDER_PAYLOAD_LEN_V3: usize = ORDER_PAYLOAD_LEN + 4;

pub const ORDER_SIDE_BUY: u8 = 0;
pub const ORDER_SIDE_SELL: u8 = 1;

pub const TIF_GTC: u8 = 0;
pub const TIF_GTD: u8 = 1;
pub const TIF_FOK: u8 = 2;
pub const TIF_FAK: u8 = 3;

// ─── ConfigV2 ───────────────────────────────────────────────────────────────
// PDA seeds: ["config_v2"]
#[account]
#[derive(InitSpace)]
pub struct ConfigV2 {
    /// V2 admin (market creation, settlement, fee withdrawal, rotation).
    pub admin: Pubkey,
    /// Matching-engine operator allowed to submit `settle_fill_v2`.
    pub operator: Pubkey,
    /// Taker fee in basis points of fill notional.
    pub fee_bps: u16,
    /// Global kill-switch for all V2 trading.
    pub paused: bool,
    /// Monotonic market counter (next market_id).
    pub next_market_id: u64,
    pub bump: u8,
}

// ─── MarketV2 ───────────────────────────────────────────────────────────────
// PDA seeds: ["market_v2", market_id.to_le_bytes()]
#[account]
#[derive(InitSpace)]
pub struct MarketV2 {
    pub market_id: u64,
    /// 2 = binary (0 = NO / 1 = YES, matching V1 convention),
    /// 3 = three-way football (0 = HOME / 1 = DRAW / 2 = AWAY),
    /// up to MAX_OUTCOMES_V2 for tournaments.
    pub num_outcomes: u8,
    /// Market question (UI copy lives in DB; this is the canonical text).
    #[max_len(96)]
    pub title: String,
    /// Outcome labels.
    #[max_len(8, 24)]
    pub outcomes: Vec<String>,
    /// 0 standard, 1 live goal window, 2 three-way, 3 tournament … (UI hint).
    pub market_type: u8,
    /// External fixture binding (0 when not fixture-bound).
    pub fixture_id: u64,
    /// Resolution source tag: 0 = admin, 1 = TxLINE score feed.
    pub resolution_source: u8,
    /// Trading closes at this unix time.
    pub close_ts: i64,
    pub status: u8, // MarketStatusV2
    /// Winning outcome index (255 = unset).
    pub winning_outcome: u8,
    /// Taker fee snapshot at creation (bps).
    pub fee_bps: u16,
    /// Complete sets currently outstanding (minted - burned - redeemed).
    pub open_sets: u64,
    /// Lifetime matched volume in lamports (notional).
    pub volume_lamports: u64,
    /// Lifetime fill count (also the fill sequence).
    pub fill_count: u64,
    /// Fees accrued into the vault, withdrawable by admin.
    pub accrued_fees: u64,
    pub created_at: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

impl MarketV2 {
    pub const STATUS_OPEN: u8 = 0;
    pub const STATUS_PAUSED: u8 = 1;
    pub const STATUS_CLOSED: u8 = 2;
    pub const STATUS_SETTLED: u8 = 3;
    pub const STATUS_VOID: u8 = 4;
    pub const WINNING_UNSET: u8 = 255;

    pub const RESOLUTION_SOURCE_ADMIN: u8 = 0;
    pub const RESOLUTION_SOURCE_TXLINE: u8 = 1;

    pub fn is_tradable(&self, now: i64) -> bool {
        self.status == Self::STATUS_OPEN && now < self.close_ts
    }
}

/// Two-step settlement for data-resolved markets: the admin PROPOSES an
/// outcome, and only after a public dispute window can anyone FINALIZE it.
/// Removes instant unilateral settlement — holders get time to challenge a
/// wrong outcome (admin can re-propose, which restarts the window).
/// PDA seeds: ["resolution_v2", market].
#[account]
pub struct ResolutionProposalV2 {
    pub market: Pubkey,
    pub winning_outcome: u8,
    pub proposed_at: i64,
    pub bump: u8,
}

impl ResolutionProposalV2 {
    pub const SIZE: usize = 8 + 32 + 1 + 8 + 1;
}

// ─── VaultV2 ────────────────────────────────────────────────────────────────
// PDA seeds: ["vault_v2", market_v2.key()]
// Typed (not a bare SystemAccount) so lamports can only move through
// program logic; `backing` mirrors what the lamport balance must cover.
#[account]
#[derive(InitSpace)]
pub struct VaultV2 {
    pub market: Pubkey,
    /// Lamports that back outstanding sets (open_sets * SET_COST).
    pub backing: u64,
    pub bump: u8,
}

// ─── BalanceV2 ──────────────────────────────────────────────────────────────
// PDA seeds: ["balance_v2", owner]
// A user's deposited trading balance. Deposit/withdraw are wallet-signed;
// fills debit/credit it under order-intent authority. Rent-exempt minimum
// is excluded from spendable balance by the instruction logic.
#[account]
#[derive(InitSpace)]
pub struct BalanceV2 {
    pub owner: Pubkey,
    /// Spendable lamports (excludes rent-exempt reserve).
    pub available: u64,
    /// Lifetime deposited / withdrawn (stats).
    pub total_deposited: u64,
    pub total_withdrawn: u64,
    pub bump: u8,
}

// ─── PositionV2 ─────────────────────────────────────────────────────────────
// PDA seeds: ["position_v2", market_v2.key(), owner, [outcome_index]]
#[account]
#[derive(InitSpace)]
pub struct PositionV2 {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub outcome_index: u8,
    /// Shares currently owned (available to sell or redeem).
    pub shares: u64,
    /// Lamports spent acquiring shares, net (cost basis).
    pub cost_lamports: u64,
    /// Lamports received from sells (proceeds).
    pub proceeds_lamports: u64,
    /// Shares redeemed after settlement/void (paid out, gone).
    pub redeemed_shares: u64,
    /// Lamports received at redemption.
    pub redeemed_lamports: u64,
    pub bump: u8,
}

// ─── OrderFillStateV2 ───────────────────────────────────────────────────────
// PDA seeds: ["ofill_v2", order_hash]
// Canonical on-chain fill/cancel state for one signed order (order_hash =
// sha256 of the canonical payload). Prevents overfill and replay across
// settlement transactions; lets the maker hard-cancel trustlessly.
#[account]
#[derive(InitSpace)]
pub struct OrderFillStateV2 {
    pub order_hash: [u8; 32],
    pub maker: Pubkey,
    pub market: Pubkey,
    /// Shares filled so far (must never exceed the signed quantity).
    pub filled: u64,
    /// Maker revoked this order on-chain; no further fills accepted.
    pub cancelled: bool,
    pub bump: u8,
}

/// Canonical signed-order payload (fixed little-endian layout, byte-parsed
/// out of the ed25519-verified message in `settle_fill_v2`):
///
/// | offset | len | field        |
/// |--------|-----|--------------|
/// | 0      | 4   | magic "WV2O" |
/// | 4      | 1   | version (2)  |
/// | 5      | 32  | market pda   |
/// | 37     | 32  | maker pubkey |
/// | 69     | 1   | outcome idx  |
/// | 70     | 1   | side 0/1     |
/// | 71     | 2   | price bps    |
/// | 73     | 8   | quantity     |
/// | 81     | 8   | nonce        |
/// | 89     | 8   | expiry (i64) |
/// | 97     | 1   | tif          |
/// | 98     | 8   | salt         |
/// | 106    | 4   | created_ts (u32, V3 only) |
///
/// Total = ORDER_PAYLOAD_LEN (106) for V2, ORDER_PAYLOAD_LEN_V3 (110) for V3.
#[derive(Clone, Copy, Debug)]
pub struct OrderPayloadV2 {
    pub market: Pubkey,
    pub maker: Pubkey,
    pub outcome_index: u8,
    pub side: u8,
    pub price_bps: u16,
    pub quantity: u64,
    pub nonce: u64,
    pub expiry: i64,
    pub tif: u8,
    pub salt: u64,
    /// Signed creation time (unix seconds). None for legacy V2 payloads.
    /// When both orders in a fill carry a timestamp, the program enforces
    /// maker.created_ts <= taker.created_ts (price-time maker priority).
    pub created_ts: Option<u32>,
}

impl OrderPayloadV2 {
    pub fn parse(data: &[u8]) -> Option<Self> {
        let created_ts = match (data.len(), data.get(4)) {
            (ORDER_PAYLOAD_LEN, Some(&ORDER_VERSION)) => None,
            (ORDER_PAYLOAD_LEN_V3, Some(&ORDER_VERSION_V3)) => {
                Some(u32::from_le_bytes(data[106..110].try_into().ok()?))
            }
            _ => return None,
        };
        if data[0..4] != ORDER_MAGIC {
            return None;
        }
        let market = Pubkey::try_from(&data[5..37]).ok()?;
        let maker = Pubkey::try_from(&data[37..69]).ok()?;
        Some(Self {
            market,
            maker,
            outcome_index: data[69],
            side: data[70],
            price_bps: u16::from_le_bytes(data[71..73].try_into().ok()?),
            quantity: u64::from_le_bytes(data[73..81].try_into().ok()?),
            nonce: u64::from_le_bytes(data[81..89].try_into().ok()?),
            expiry: i64::from_le_bytes(data[89..97].try_into().ok()?),
            tif: data[97],
            salt: u64::from_le_bytes(data[98..106].try_into().ok()?),
            created_ts,
        })
    }

    /// Order hash = sha256 of the exact signed bytes.
    pub fn hash(data: &[u8]) -> [u8; 32] {
        anchor_lang::solana_program::hash::hash(data).to_bytes()
    }
}
