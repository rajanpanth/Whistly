use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorV2 {
    #[msg("V2: unauthorized admin")]
    UnauthorizedAdmin,
    #[msg("V2: unauthorized operator")]
    UnauthorizedOperator,
    #[msg("V2: trading is paused")]
    Paused,
    #[msg("V2: market is not open for trading")]
    MarketNotTradable,
    #[msg("V2: market is not closed")]
    MarketNotClosed,
    #[msg("V2: market is not settled")]
    MarketNotSettled,
    #[msg("V2: market already resolved")]
    MarketAlreadyResolved,
    #[msg("V2: invalid outcome count (2-8)")]
    InvalidOutcomeCount,
    #[msg("V2: invalid outcome index")]
    InvalidOutcome,
    #[msg("V2: invalid close time")]
    InvalidCloseTime,
    #[msg("V2: invalid fee")]
    InvalidFee,
    #[msg("V2: invalid price (100-9900 bps)")]
    InvalidPrice,
    #[msg("V2: invalid quantity")]
    InvalidQuantity,
    #[msg("V2: amount must be greater than zero")]
    ZeroAmount,
    #[msg("V2: insufficient balance")]
    InsufficientBalance,
    #[msg("V2: insufficient shares")]
    InsufficientShares,
    #[msg("V2: order signature verification missing or malformed")]
    BadSignatureIntrospection,
    #[msg("V2: order payload malformed")]
    BadOrderPayload,
    #[msg("V2: order maker mismatch")]
    OrderMakerMismatch,
    #[msg("V2: order market mismatch")]
    OrderMarketMismatch,
    #[msg("V2: order expired")]
    OrderExpired,
    #[msg("V2: order cancelled")]
    OrderCancelled,
    #[msg("V2: order overfill rejected")]
    Overfill,
    #[msg("V2: orders do not cross")]
    OrdersDoNotCross,
    #[msg("V2: incompatible order pair")]
    IncompatibleOrders,
    #[msg("V2: self-trade rejected")]
    SelfTrade,
    #[msg("V2: fill state account mismatch")]
    FillStateMismatch,
    #[msg("V2: already redeemed")]
    AlreadyRedeemed,
    #[msg("V2: nothing to redeem")]
    NothingToRedeem,
    #[msg("V2: vault under-backed invariant violated")]
    VaultInvariant,
    #[msg("V2: arithmetic overflow")]
    MathOverflow,
    #[msg("V2: cross-mode only valid for binary markets")]
    NotBinary,
}
