use anchor_lang::prelude::*;

#[event]
pub struct MarketCreatedV2 {
    pub market: Pubkey,
    pub market_id: u64,
    pub num_outcomes: u8,
    pub market_type: u8,
    pub fixture_id: u64,
    pub close_ts: i64,
}

#[event]
pub struct DepositV2 {
    pub owner: Pubkey,
    pub amount: u64,
    pub available: u64,
}

#[event]
pub struct WithdrawV2 {
    pub owner: Pubkey,
    pub amount: u64,
    pub available: u64,
}

#[event]
pub struct SetMintedV2 {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub sets: u64,
}

#[event]
pub struct SetBurnedV2 {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub sets: u64,
}

/// Canonical fill record. The transaction signature carrying this event is
/// the verifiable devnet settlement of the matched trade.
#[event]
pub struct FillV2 {
    pub market: Pubkey,
    pub fill_seq: u64,
    /// 0 transfer, 1 mint-cross, 2 burn-cross.
    pub mode: u8,
    pub maker: Pubkey,
    pub taker: Pubkey,
    pub maker_order_hash: [u8; 32],
    pub taker_order_hash: [u8; 32],
    pub outcome_index: u8,
    /// Execution price of the *maker's* outcome side, bps.
    pub price_bps: u16,
    pub quantity: u64,
    pub notional_lamports: u64,
    pub fee_lamports: u64,
    pub timestamp: i64,
}

#[event]
pub struct OrderCancelledV2 {
    pub order_hash: [u8; 32],
    pub maker: Pubkey,
    pub market: Pubkey,
    pub filled_at_cancel: u64,
}

#[event]
pub struct MarketResolvedV2 {
    pub market: Pubkey,
    /// 255 = void.
    pub winning_outcome: u8,
}

#[event]
pub struct SettlementProposedV2 {
    pub market: Pubkey,
    pub winning_outcome: u8,
    pub proposed_at: i64,
}

#[event]
pub struct RedeemedV2 {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub outcome_index: u8,
    pub shares: u64,
    pub payout_lamports: u64,
    /// true when redeeming from a voided market.
    pub voided: bool,
}
