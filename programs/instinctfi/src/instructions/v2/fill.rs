use anchor_lang::prelude::*;
use anchor_lang::solana_program::ed25519_program;
use anchor_lang::solana_program::sysvar::instructions::{
    load_instruction_at_checked, ID as INSTRUCTIONS_SYSVAR_ID,
};

use crate::errors_v2::ErrorV2;
use crate::events_v2::*;
use crate::state_v2::*;

pub const FILL_MODE_TRANSFER: u8 = 0;
pub const FILL_MODE_MINT: u8 = 1;
pub const FILL_MODE_BURN: u8 = 2;

// ─── ed25519 introspection ──────────────────────────────────────────────────
// The settlement transaction carries one ed25519-program instruction per
// order signature. The ed25519 program itself verifies the signature (the
// whole transaction fails if it is invalid); here we only BIND that
// verification to our expected signer + message bytes.
//
// ed25519 instruction data layout:
//   [0] num_signatures  [1] padding
//   then per signature a 14-byte offsets block:
//     sig_offset u16, sig_ix_index u16,
//     pk_offset u16, pk_ix_index u16,
//     msg_offset u16, msg_size u16, msg_ix_index u16
// An ix_index of u16::MAX means "this instruction".

/// Extract the (signer, message) pair from the ed25519 instruction at
/// `ix_index`. The ed25519 program has already verified the signature by
/// the time our instruction runs — the transaction would have failed
/// otherwise — so the returned pair is authenticated.
fn extract_ed25519_signed(
    instructions_sysvar: &AccountInfo,
    ix_index: u8,
) -> Result<(Pubkey, Vec<u8>)> {
    let ix = load_instruction_at_checked(ix_index as usize, instructions_sysvar)
        .map_err(|_| error!(ErrorV2::BadSignatureIntrospection))?;
    require_keys_eq!(
        ix.program_id,
        ed25519_program::ID,
        ErrorV2::BadSignatureIntrospection
    );
    let data = &ix.data;
    require!(data.len() >= 2 + 14, ErrorV2::BadSignatureIntrospection);
    let num_signatures = data[0];
    require!(num_signatures == 1, ErrorV2::BadSignatureIntrospection);

    let read_u16 = |offset: usize| -> Result<u16> {
        data.get(offset..offset + 2)
            .and_then(|b| b.try_into().ok())
            .map(u16::from_le_bytes)
            .ok_or_else(|| error!(ErrorV2::BadSignatureIntrospection))
    };

    let sig_ix_index = read_u16(4)?;
    let pk_offset = read_u16(6)? as usize;
    let pk_ix_index = read_u16(8)?;
    let msg_offset = read_u16(10)? as usize;
    let msg_size = read_u16(12)? as usize;
    let msg_ix_index = read_u16(14)?;

    // All parts must live inside this same ed25519 instruction.
    let this = ix_index as u16;
    let is_self = |idx: u16| idx == u16::MAX || idx == this;
    require!(
        is_self(sig_ix_index) && is_self(pk_ix_index) && is_self(msg_ix_index),
        ErrorV2::BadSignatureIntrospection
    );

    let pk = data
        .get(pk_offset..pk_offset + 32)
        .ok_or_else(|| error!(ErrorV2::BadSignatureIntrospection))?;
    let signer = Pubkey::try_from(pk).map_err(|_| error!(ErrorV2::BadSignatureIntrospection))?;

    let msg = data
        .get(msg_offset..msg_offset + msg_size)
        .ok_or_else(|| error!(ErrorV2::BadSignatureIntrospection))?;
    Ok((signer, msg.to_vec()))
}

// ─── helpers ────────────────────────────────────────────────────────────────

fn check_position(
    position: &Account<PositionV2>,
    market: &Pubkey,
    owner: &Pubkey,
    outcome_index: u8,
) -> Result<()> {
    require_keys_eq!(position.market, *market, ErrorV2::FillStateMismatch);
    require_keys_eq!(position.owner, *owner, ErrorV2::FillStateMismatch);
    require!(position.outcome_index == outcome_index, ErrorV2::InvalidOutcome);
    Ok(())
}

/// Move lamports between two program-owned accounts.
fn move_lamports(from: &AccountInfo, to: &AccountInfo, amount: u64) -> Result<()> {
    **from.try_borrow_mut_lamports()? = from
        .lamports()
        .checked_sub(amount)
        .ok_or(ErrorV2::VaultInvariant)?;
    **to.try_borrow_mut_lamports()? = to
        .lamports()
        .checked_add(amount)
        .ok_or(ErrorV2::MathOverflow)?;
    Ok(())
}

fn validate_order(order: &OrderPayloadV2, market_key: &Pubkey, now: i64) -> Result<()> {
    require_keys_eq!(order.market, *market_key, ErrorV2::OrderMarketMismatch);
    require!(
        order.side == ORDER_SIDE_BUY || order.side == ORDER_SIDE_SELL,
        ErrorV2::BadOrderPayload
    );
    require!(
        order.price_bps >= MIN_PRICE_BPS && order.price_bps <= MAX_PRICE_BPS,
        ErrorV2::InvalidPrice
    );
    require!(order.quantity > 0, ErrorV2::InvalidQuantity);
    require!(order.expiry > now, ErrorV2::OrderExpired);
    Ok(())
}

fn init_or_check_fill_state(
    fill_state: &mut Account<OrderFillStateV2>,
    order_hash: [u8; 32],
    maker: Pubkey,
    market: Pubkey,
    bump: u8,
    qty: u64,
    order_quantity: u64,
) -> Result<()> {
    if fill_state.maker == Pubkey::default() {
        fill_state.order_hash = order_hash;
        fill_state.maker = maker;
        fill_state.market = market;
        fill_state.filled = 0;
        fill_state.cancelled = false;
        fill_state.bump = bump;
    } else {
        require!(fill_state.order_hash == order_hash, ErrorV2::FillStateMismatch);
        require_keys_eq!(fill_state.maker, maker, ErrorV2::FillStateMismatch);
    }
    require!(!fill_state.cancelled, ErrorV2::OrderCancelled);
    let new_filled = fill_state
        .filled
        .checked_add(qty)
        .ok_or(ErrorV2::MathOverflow)?;
    require!(new_filled <= order_quantity, ErrorV2::Overfill);
    fill_state.filled = new_filled;
    Ok(())
}

// ─── settle_fill_v2 ─────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(maker_hash: [u8; 32], taker_hash: [u8; 32])]
pub struct SettleFillV2<'info> {
    /// Matching-engine operator: pays rent for fill states, cannot move
    /// user funds outside the signed order constraints.
    #[account(mut)]
    pub operator: Signer<'info>,
    // All accounts boxed: this struct has 11 entries and lives in a 4KB
    // SBF stack frame — unboxed it overflows and hard-faults at runtime.
    #[account(
        seeds = [b"config_v2"],
        bump = config.bump,
        constraint = config.operator == operator.key() @ ErrorV2::UnauthorizedOperator
    )]
    pub config: Box<Account<'info, ConfigV2>>,
    #[account(
        mut,
        seeds = [b"market_v2", market.market_id.to_le_bytes().as_ref()],
        bump = market.bump
    )]
    pub market: Box<Account<'info, MarketV2>>,
    #[account(
        mut,
        seeds = [b"vault_v2", market.key().as_ref()],
        bump = market.vault_bump
    )]
    pub vault: Box<Account<'info, VaultV2>>,
    #[account(
        init_if_needed,
        payer = operator,
        space = 8 + OrderFillStateV2::INIT_SPACE,
        seeds = [b"ofill_v2", maker_hash.as_ref()],
        bump
    )]
    pub maker_fill: Box<Account<'info, OrderFillStateV2>>,
    #[account(
        init_if_needed,
        payer = operator,
        space = 8 + OrderFillStateV2::INIT_SPACE,
        seeds = [b"ofill_v2", taker_hash.as_ref()],
        bump
    )]
    pub taker_fill: Box<Account<'info, OrderFillStateV2>>,
    // Owner/discriminator checked by Anchor; identity (owner field ==
    // signed order maker, market, outcome) is enforced in the handler
    // because those values come from the signed payloads. Positions and
    // balances only ever exist at canonical PDA seeds, so field equality
    // uniquely identifies the account.
    #[account(mut)]
    pub maker_balance: Box<Account<'info, BalanceV2>>,
    #[account(mut)]
    pub taker_balance: Box<Account<'info, BalanceV2>>,
    #[account(mut)]
    pub maker_position: Box<Account<'info, PositionV2>>,
    #[account(mut)]
    pub taker_position: Box<Account<'info, PositionV2>>,
    /// CHECK: instructions sysvar for ed25519 introspection.
    #[account(address = INSTRUCTIONS_SYSVAR_ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn settle_fill_v2(
    ctx: Context<SettleFillV2>,
    maker_hash: [u8; 32],
    taker_hash: [u8; 32],
    fill_qty: u64,
    maker_sig_ix_index: u8,
    taker_sig_ix_index: u8,
) -> Result<()> {
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    let market_key = ctx.accounts.market.key();

    require!(!ctx.accounts.config.paused, ErrorV2::Paused);
    require!(ctx.accounts.market.is_tradable(now), ErrorV2::MarketNotTradable);
    require!(fill_qty > 0, ErrorV2::InvalidQuantity);

    // 1. Pull both signed order payloads out of their (already executed)
    //    ed25519 verification instructions and bind them to the hash args
    //    that seed the fill-state PDAs.
    let (maker_signer, maker_order) =
        extract_ed25519_signed(&ctx.accounts.instructions_sysvar, maker_sig_ix_index)?;
    let (taker_signer, taker_order) =
        extract_ed25519_signed(&ctx.accounts.instructions_sysvar, taker_sig_ix_index)?;
    require!(
        OrderPayloadV2::hash(&maker_order) == maker_hash,
        ErrorV2::BadOrderPayload
    );
    require!(
        OrderPayloadV2::hash(&taker_order) == taker_hash,
        ErrorV2::BadOrderPayload
    );
    require!(maker_hash != taker_hash, ErrorV2::IncompatibleOrders);

    // 2. Parse + validate. The payload's maker MUST be the ed25519 signer.
    let maker = OrderPayloadV2::parse(&maker_order).ok_or(ErrorV2::BadOrderPayload)?;
    let taker = OrderPayloadV2::parse(&taker_order).ok_or(ErrorV2::BadOrderPayload)?;
    require_keys_eq!(maker.maker, maker_signer, ErrorV2::OrderMakerMismatch);
    require_keys_eq!(taker.maker, taker_signer, ErrorV2::OrderMakerMismatch);
    require!(maker.maker != taker.maker, ErrorV2::SelfTrade);

    validate_order(&maker, &market_key, now)?;
    validate_order(&taker, &market_key, now)?;
    require!(
        maker.outcome_index < ctx.accounts.market.num_outcomes
            && taker.outcome_index < ctx.accounts.market.num_outcomes,
        ErrorV2::InvalidOutcome
    );

    // 3. Overfill/replay/cancel guards (canonical per-order fill state).
    init_or_check_fill_state(
        &mut ctx.accounts.maker_fill,
        maker_hash,
        maker.maker,
        market_key,
        ctx.bumps.maker_fill,
        fill_qty,
        maker.quantity,
    )?;
    init_or_check_fill_state(
        &mut ctx.accounts.taker_fill,
        taker_hash,
        taker.maker,
        market_key,
        ctx.bumps.taker_fill,
        fill_qty,
        taker.quantity,
    )?;

    // 4. Bind party accounts to the signed payloads (field equality).
    require_keys_eq!(
        ctx.accounts.maker_balance.owner,
        maker.maker,
        ErrorV2::FillStateMismatch
    );
    require_keys_eq!(
        ctx.accounts.taker_balance.owner,
        taker.maker,
        ErrorV2::FillStateMismatch
    );
    check_position(
        &ctx.accounts.maker_position,
        &market_key,
        &maker.maker,
        maker.outcome_index,
    )?;
    check_position(
        &ctx.accounts.taker_position,
        &market_key,
        &taker.maker,
        taker.outcome_index,
    )?;

    // 5. Determine fill mode + execution prices (maker price priority).
    let fee_bps = ctx.accounts.market.fee_bps as u64;
    let maker_px = maker.price_bps as u64;
    let taker_px = taker.price_bps as u64;
    let mode: u8;
    // Lamports paid/received per share for each party.
    let maker_per_share: u64;
    let taker_per_share: u64;

    if maker.side != taker.side {
        // TRANSFER: same outcome, buyer pays seller directly.
        mode = FILL_MODE_TRANSFER;
        require!(maker.outcome_index == taker.outcome_index, ErrorV2::IncompatibleOrders);
        let (buy_px, sell_px) = if maker.side == ORDER_SIDE_BUY {
            (maker_px, taker_px)
        } else {
            (taker_px, sell_to_buy_guard(maker_px)?)
        };
        // cross check uses raw prices:
        let (buyer_limit, seller_limit) = if maker.side == ORDER_SIDE_BUY {
            (maker_px, taker_px)
        } else {
            (taker_px, maker_px)
        };
        require!(buyer_limit >= seller_limit, ErrorV2::OrdersDoNotCross);
        let _ = (buy_px, sell_px);
        // Execution at the maker's limit (resting order priority).
        maker_per_share = maker_px * LAMPORTS_PER_BP;
        taker_per_share = maker_px * LAMPORTS_PER_BP;
    } else if maker.side == ORDER_SIDE_BUY {
        // MINT cross: two buys of complementary outcomes (binary only).
        mode = FILL_MODE_MINT;
        require!(ctx.accounts.market.num_outcomes == 2, ErrorV2::NotBinary);
        require!(maker.outcome_index != taker.outcome_index, ErrorV2::IncompatibleOrders);
        require!(
            maker_px + taker_px >= PRICE_SCALE,
            ErrorV2::OrdersDoNotCross
        );
        // Maker pays their limit; taker gets the price improvement.
        maker_per_share = maker_px * LAMPORTS_PER_BP;
        taker_per_share = (PRICE_SCALE - maker_px) * LAMPORTS_PER_BP;
    } else {
        // BURN cross: two sells of complementary outcomes (binary only).
        mode = FILL_MODE_BURN;
        require!(ctx.accounts.market.num_outcomes == 2, ErrorV2::NotBinary);
        require!(maker.outcome_index != taker.outcome_index, ErrorV2::IncompatibleOrders);
        require!(
            maker_px + taker_px <= PRICE_SCALE,
            ErrorV2::OrdersDoNotCross
        );
        maker_per_share = maker_px * LAMPORTS_PER_BP;
        taker_per_share = (PRICE_SCALE - maker_px) * LAMPORTS_PER_BP;
    }

    let maker_amount = maker_per_share
        .checked_mul(fill_qty)
        .ok_or(ErrorV2::MathOverflow)?;
    let taker_amount = taker_per_share
        .checked_mul(fill_qty)
        .ok_or(ErrorV2::MathOverflow)?;
    // Taker fee on taker notional, rounded UP (protects the vault).
    let fee = taker_amount
        .checked_mul(fee_bps)
        .ok_or(ErrorV2::MathOverflow)?
        .div_ceil(PRICE_SCALE);

    let vault_info = ctx.accounts.vault.to_account_info();
    let maker_balance_info = ctx.accounts.maker_balance.to_account_info();
    let taker_balance_info = ctx.accounts.taker_balance.to_account_info();

    // 6. Execute economics.
    match mode {
        FILL_MODE_TRANSFER => {
            let (buyer_is_maker, cost, proceeds) = if maker.side == ORDER_SIDE_BUY {
                (true, maker_amount, taker_amount)
            } else {
                (false, taker_amount, maker_amount)
            };
            let (buyer_balance, seller_balance, buyer_balance_info, seller_balance_info) =
                if buyer_is_maker {
                    (
                        &mut ctx.accounts.maker_balance,
                        &mut ctx.accounts.taker_balance,
                        &maker_balance_info,
                        &taker_balance_info,
                    )
                } else {
                    (
                        &mut ctx.accounts.taker_balance,
                        &mut ctx.accounts.maker_balance,
                        &taker_balance_info,
                        &maker_balance_info,
                    )
                };
            // Buyer pays cost (+fee if buyer is taker). Seller receives
            // proceeds (-fee if seller is taker).
            let buyer_total = if buyer_is_maker { cost } else { cost + fee };
            require!(
                buyer_balance.available >= buyer_total,
                ErrorV2::InsufficientBalance
            );
            let seller_net = if buyer_is_maker {
                proceeds.checked_sub(fee).ok_or(ErrorV2::InsufficientBalance)?
            } else {
                proceeds
            };

            buyer_balance.available -= buyer_total;
            seller_balance.available = seller_balance
                .available
                .checked_add(seller_net)
                .ok_or(ErrorV2::MathOverflow)?;
            // Lamports: buyer → seller (cost) and buyer/seller → vault (fee).
            move_lamports(buyer_balance_info, seller_balance_info, cost)?;
            if buyer_is_maker {
                move_lamports(seller_balance_info, &vault_info, fee)?;
            } else {
                move_lamports(buyer_balance_info, &vault_info, fee)?;
            }

            // Shares seller → buyer, with proportional basis transfer.
            let (buyer_position, seller_position) = if buyer_is_maker {
                (
                    &mut ctx.accounts.maker_position,
                    &mut ctx.accounts.taker_position,
                )
            } else {
                (
                    &mut ctx.accounts.taker_position,
                    &mut ctx.accounts.maker_position,
                )
            };
            require!(
                seller_position.shares >= fill_qty,
                ErrorV2::InsufficientShares
            );
            let basis_out = (seller_position.cost_lamports as u128)
                .checked_mul(fill_qty as u128)
                .ok_or(ErrorV2::MathOverflow)?
                / (seller_position.shares as u128).max(1);
            seller_position.shares -= fill_qty;
            seller_position.cost_lamports =
                seller_position.cost_lamports.saturating_sub(basis_out as u64);
            seller_position.proceeds_lamports = seller_position
                .proceeds_lamports
                .checked_add(seller_net)
                .ok_or(ErrorV2::MathOverflow)?;
            buyer_position.shares = buyer_position
                .shares
                .checked_add(fill_qty)
                .ok_or(ErrorV2::MathOverflow)?;
            buyer_position.cost_lamports = buyer_position
                .cost_lamports
                .checked_add(buyer_total)
                .ok_or(ErrorV2::MathOverflow)?;
        }
        FILL_MODE_MINT => {
            let taker_total = taker_amount + fee;
            require!(
                ctx.accounts.maker_balance.available >= maker_amount,
                ErrorV2::InsufficientBalance
            );
            require!(
                ctx.accounts.taker_balance.available >= taker_total,
                ErrorV2::InsufficientBalance
            );
            ctx.accounts.maker_balance.available -= maker_amount;
            ctx.accounts.taker_balance.available -= taker_total;
            move_lamports(&maker_balance_info, &vault_info, maker_amount)?;
            move_lamports(&taker_balance_info, &vault_info, taker_total)?;

            ctx.accounts.maker_position.shares = ctx.accounts.maker_position
                .shares
                .checked_add(fill_qty)
                .ok_or(ErrorV2::MathOverflow)?;
            ctx.accounts.maker_position.cost_lamports = ctx.accounts.maker_position
                .cost_lamports
                .checked_add(maker_amount)
                .ok_or(ErrorV2::MathOverflow)?;
            ctx.accounts.taker_position.shares = ctx.accounts.taker_position
                .shares
                .checked_add(fill_qty)
                .ok_or(ErrorV2::MathOverflow)?;
            ctx.accounts.taker_position.cost_lamports = ctx.accounts.taker_position
                .cost_lamports
                .checked_add(taker_total)
                .ok_or(ErrorV2::MathOverflow)?;

            let market = &mut ctx.accounts.market;
            market.open_sets = market
                .open_sets
                .checked_add(fill_qty)
                .ok_or(ErrorV2::MathOverflow)?;
            let vault = &mut ctx.accounts.vault;
            vault.backing = vault
                .backing
                .checked_add(SET_COST.checked_mul(fill_qty).ok_or(ErrorV2::MathOverflow)?)
                .ok_or(ErrorV2::MathOverflow)?;
        }
        _ => {
            // FILL_MODE_BURN
            require!(
                ctx.accounts.maker_position.shares >= fill_qty,
                ErrorV2::InsufficientShares
            );
            require!(
                ctx.accounts.taker_position.shares >= fill_qty,
                ErrorV2::InsufficientShares
            );
            let taker_net = taker_amount
                .checked_sub(fee)
                .ok_or(ErrorV2::InsufficientBalance)?;
            let set_total = SET_COST.checked_mul(fill_qty).ok_or(ErrorV2::MathOverflow)?;

            ctx.accounts.maker_position.shares -= fill_qty;
            ctx.accounts.taker_position.shares -= fill_qty;
            let maker_basis_out = (ctx.accounts.maker_position.cost_lamports as u128)
                .checked_mul(fill_qty as u128)
                .ok_or(ErrorV2::MathOverflow)?
                / ((ctx.accounts.maker_position.shares + fill_qty) as u128).max(1);
            let taker_basis_out = (ctx.accounts.taker_position.cost_lamports as u128)
                .checked_mul(fill_qty as u128)
                .ok_or(ErrorV2::MathOverflow)?
                / ((ctx.accounts.taker_position.shares + fill_qty) as u128).max(1);
            ctx.accounts.maker_position.cost_lamports =
                ctx.accounts.maker_position.cost_lamports.saturating_sub(maker_basis_out as u64);
            ctx.accounts.taker_position.cost_lamports =
                ctx.accounts.taker_position.cost_lamports.saturating_sub(taker_basis_out as u64);
            ctx.accounts.maker_position.proceeds_lamports = ctx.accounts.maker_position
                .proceeds_lamports
                .checked_add(maker_amount)
                .ok_or(ErrorV2::MathOverflow)?;
            ctx.accounts.taker_position.proceeds_lamports = ctx.accounts.taker_position
                .proceeds_lamports
                .checked_add(taker_net)
                .ok_or(ErrorV2::MathOverflow)?;

            ctx.accounts.maker_balance.available = ctx.accounts.maker_balance
                .available
                .checked_add(maker_amount)
                .ok_or(ErrorV2::MathOverflow)?;
            ctx.accounts.taker_balance.available = ctx.accounts.taker_balance
                .available
                .checked_add(taker_net)
                .ok_or(ErrorV2::MathOverflow)?;

            let vault = &mut ctx.accounts.vault;
            require!(vault.backing >= set_total, ErrorV2::VaultInvariant);
            vault.backing -= set_total;
            // Vault pays out set_total minus the fee it keeps.
            move_lamports(&vault_info, &maker_balance_info, maker_amount)?;
            move_lamports(&vault_info, &taker_balance_info, taker_net)?;
            // maker_amount + taker_net = set_total - fee → fee lamports stay
            // in the vault and are accounted below.

            let market = &mut ctx.accounts.market;
            require!(market.open_sets >= fill_qty, ErrorV2::VaultInvariant);
            market.open_sets -= fill_qty;
        }
    }

    // 7. Bookkeeping + canonical event.
    let market = &mut ctx.accounts.market;
    market.accrued_fees = market
        .accrued_fees
        .checked_add(fee)
        .ok_or(ErrorV2::MathOverflow)?;
    market.volume_lamports = market
        .volume_lamports
        .checked_add(maker_amount)
        .ok_or(ErrorV2::MathOverflow)?;
    market.fill_count = market
        .fill_count
        .checked_add(1)
        .ok_or(ErrorV2::MathOverflow)?;

    emit!(FillV2 {
        market: market_key,
        fill_seq: market.fill_count,
        mode,
        maker: maker.maker,
        taker: taker.maker,
        maker_order_hash: maker_hash,
        taker_order_hash: taker_hash,
        outcome_index: maker.outcome_index,
        price_bps: maker.price_bps,
        quantity: fill_qty,
        notional_lamports: maker_amount,
        fee_lamports: fee,
        timestamp: now,
    });
    Ok(())
}

/// Sell orders quote the probability they are willing to RECEIVE per share;
/// no conversion needed, but keep a guard hook for future tick logic.
fn sell_to_buy_guard(px: u64) -> Result<u64> {
    Ok(px)
}

// ─── cancel_order_v2 ────────────────────────────────────────────────────────
// Trustless hard-cancel: the order's maker marks its fill state cancelled
// on-chain, after which settle_fill_v2 permanently rejects it — even a
// compromised operator cannot fill it.

#[derive(Accounts)]
#[instruction(order: Vec<u8>, order_hash: [u8; 32])]
pub struct CancelOrderV2<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,
    #[account(
        init_if_needed,
        payer = maker,
        space = 8 + OrderFillStateV2::INIT_SPACE,
        seeds = [b"ofill_v2", order_hash.as_ref()],
        bump
    )]
    pub fill_state: Account<'info, OrderFillStateV2>,
    pub system_program: Program<'info, System>,
}

pub fn cancel_order_v2(
    ctx: Context<CancelOrderV2>,
    order: Vec<u8>,
    order_hash: [u8; 32],
) -> Result<()> {
    let payload = OrderPayloadV2::parse(&order).ok_or(ErrorV2::BadOrderPayload)?;
    require!(
        OrderPayloadV2::hash(&order) == order_hash,
        ErrorV2::BadOrderPayload
    );
    // Only the maker may cancel their own order.
    require_keys_eq!(payload.maker, ctx.accounts.maker.key(), ErrorV2::OrderMakerMismatch);

    let fill_state = &mut ctx.accounts.fill_state;
    if fill_state.maker == Pubkey::default() {
        fill_state.order_hash = order_hash;
        fill_state.maker = payload.maker;
        fill_state.market = payload.market;
        fill_state.filled = 0;
        fill_state.bump = ctx.bumps.fill_state;
    } else {
        require!(
            fill_state.order_hash == order_hash,
            ErrorV2::FillStateMismatch
        );
        require_keys_eq!(fill_state.maker, payload.maker, ErrorV2::OrderMakerMismatch);
        require!(!fill_state.cancelled, ErrorV2::OrderCancelled);
    }
    fill_state.cancelled = true;

    emit!(OrderCancelledV2 {
        order_hash,
        maker: payload.maker,
        market: payload.market,
        filled_at_cancel: fill_state.filled,
    });
    Ok(())
}
