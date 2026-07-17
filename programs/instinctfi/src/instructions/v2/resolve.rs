use anchor_lang::prelude::*;

use crate::errors_v2::ErrorV2;
use crate::events_v2::*;
use crate::state_v2::*;

// ─── settle_market_v2 / void_market_v2 ──────────────────────────────────────

#[derive(Accounts)]
pub struct ResolveMarketV2<'info> {
    pub admin: Signer<'info>,
    #[account(
        seeds = [b"config_v2"],
        bump = config.bump,
        constraint = config.admin == admin.key() @ ErrorV2::UnauthorizedAdmin
    )]
    pub config: Account<'info, ConfigV2>,
    #[account(
        mut,
        seeds = [b"market_v2", market.market_id.to_le_bytes().as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, MarketV2>,
}

pub fn settle_market_v2(ctx: Context<ResolveMarketV2>, winning_outcome: u8) -> Result<()> {
    let clock = Clock::get()?;
    let market = &mut ctx.accounts.market;
    // Data-resolved markets must go through the propose → dispute-window →
    // finalize flow; instant unilateral settlement is only for markets that
    // were explicitly created as admin-resolved.
    require!(
        market.resolution_source != MarketV2::RESOLUTION_SOURCE_TXLINE,
        ErrorV2::UseProposedSettlement
    );
    require!(
        market.status == MarketV2::STATUS_OPEN
            || market.status == MarketV2::STATUS_PAUSED
            || market.status == MarketV2::STATUS_CLOSED,
        ErrorV2::MarketAlreadyResolved
    );
    // Settling before close is only allowed once the close time passed
    // (e.g. goal-window boundary) OR the market was explicitly closed.
    require!(
        market.status == MarketV2::STATUS_CLOSED || clock.unix_timestamp >= market.close_ts,
        ErrorV2::MarketNotClosed
    );
    require!(winning_outcome < market.num_outcomes, ErrorV2::InvalidOutcome);

    market.status = MarketV2::STATUS_SETTLED;
    market.winning_outcome = winning_outcome;

    emit!(MarketResolvedV2 {
        market: market.key(),
        winning_outcome,
    });
    Ok(())
}

// ─── propose / finalize settlement (data-resolved markets) ─────────────────
// Admin proposes the outcome; anyone can finalize after the dispute window.
// Re-proposing overwrites the proposal and restarts the window, letting the
// admin correct a wrong feed reading before anything becomes redeemable.

pub const DISPUTE_WINDOW_SECONDS: i64 = 60 * 60; // 1 hour

#[derive(Accounts)]
pub struct ProposeSettleMarketV2<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [b"config_v2"],
        bump = config.bump,
        constraint = config.admin == admin.key() @ ErrorV2::UnauthorizedAdmin
    )]
    pub config: Account<'info, ConfigV2>,
    #[account(
        seeds = [b"market_v2", market.market_id.to_le_bytes().as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, MarketV2>,
    #[account(
        init_if_needed,
        payer = admin,
        space = ResolutionProposalV2::SIZE,
        seeds = [b"resolution_v2", market.key().as_ref()],
        bump
    )]
    pub proposal: Account<'info, ResolutionProposalV2>,
    pub system_program: Program<'info, System>,
}

pub fn propose_settle_market_v2(
    ctx: Context<ProposeSettleMarketV2>,
    winning_outcome: u8,
) -> Result<()> {
    let clock = Clock::get()?;
    let market = &ctx.accounts.market;
    require!(
        market.status == MarketV2::STATUS_OPEN
            || market.status == MarketV2::STATUS_PAUSED
            || market.status == MarketV2::STATUS_CLOSED,
        ErrorV2::MarketAlreadyResolved
    );
    require!(
        market.status == MarketV2::STATUS_CLOSED || clock.unix_timestamp >= market.close_ts,
        ErrorV2::MarketNotClosed
    );
    require!(winning_outcome < market.num_outcomes, ErrorV2::InvalidOutcome);

    let proposal = &mut ctx.accounts.proposal;
    proposal.market = market.key();
    proposal.winning_outcome = winning_outcome;
    proposal.proposed_at = clock.unix_timestamp;
    proposal.bump = ctx.bumps.proposal;

    emit!(SettlementProposedV2 {
        market: market.key(),
        winning_outcome,
        proposed_at: clock.unix_timestamp,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct FinalizeSettleMarketV2<'info> {
    /// Any signer may finalize once the dispute window passed.
    pub caller: Signer<'info>,
    #[account(
        mut,
        seeds = [b"market_v2", market.market_id.to_le_bytes().as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, MarketV2>,
    #[account(
        seeds = [b"resolution_v2", market.key().as_ref()],
        bump = proposal.bump,
        constraint = proposal.market == market.key() @ ErrorV2::NoProposal
    )]
    pub proposal: Account<'info, ResolutionProposalV2>,
}

pub fn finalize_settle_market_v2(ctx: Context<FinalizeSettleMarketV2>) -> Result<()> {
    let clock = Clock::get()?;
    let market = &mut ctx.accounts.market;
    let proposal = &ctx.accounts.proposal;
    require!(
        market.status == MarketV2::STATUS_OPEN
            || market.status == MarketV2::STATUS_PAUSED
            || market.status == MarketV2::STATUS_CLOSED,
        ErrorV2::MarketAlreadyResolved
    );
    require!(
        clock.unix_timestamp
            >= proposal
                .proposed_at
                .checked_add(DISPUTE_WINDOW_SECONDS)
                .ok_or(ErrorV2::MathOverflow)?,
        ErrorV2::DisputeWindowActive
    );
    require!(
        proposal.winning_outcome < market.num_outcomes,
        ErrorV2::InvalidOutcome
    );

    market.status = MarketV2::STATUS_SETTLED;
    market.winning_outcome = proposal.winning_outcome;

    emit!(MarketResolvedV2 {
        market: market.key(),
        winning_outcome: proposal.winning_outcome,
    });
    Ok(())
}

pub fn void_market_v2(ctx: Context<ResolveMarketV2>) -> Result<()> {
    let clock = Clock::get()?;
    let market = &mut ctx.accounts.market;
    require!(
        market.status == MarketV2::STATUS_OPEN
            || market.status == MarketV2::STATUS_PAUSED
            || market.status == MarketV2::STATUS_CLOSED,
        ErrorV2::MarketAlreadyResolved
    );
    // A live market that already has fills cannot be voided mid-flight —
    // voiding forces every share to redeem at SET_COST / num_outcomes, which
    // would reverse traders' P&L at the admin's discretion. Void is only a
    // genuine abort: before any fill, or after the market stops trading.
    require!(
        market.fill_count == 0
            || market.status == MarketV2::STATUS_CLOSED
            || clock.unix_timestamp >= market.close_ts,
        ErrorV2::VoidNotAllowed
    );
    market.status = MarketV2::STATUS_VOID;
    market.winning_outcome = MarketV2::WINNING_UNSET;

    emit!(MarketResolvedV2 {
        market: market.key(),
        winning_outcome: MarketV2::WINNING_UNSET,
    });
    Ok(())
}

// ─── force_void_market_v2 ───────────────────────────────────────────────────
// Permissionless liveness fallback (mirrors V1's post-grace void): if the
// admin never resolves a market, ANYONE can void it once the grace period
// after close has elapsed, so holders can always exit via redeem_v2 instead
// of depending on admin liveness. 7 days matches V1's ADMIN_SETTLE_GRACE.

pub const FORCE_VOID_GRACE_SECONDS: i64 = 7 * 24 * 60 * 60;

#[derive(Accounts)]
pub struct ForceVoidMarketV2<'info> {
    /// Any signer may crank the fallback — no authority constraint.
    pub caller: Signer<'info>,
    #[account(
        mut,
        seeds = [b"market_v2", market.market_id.to_le_bytes().as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, MarketV2>,
}

pub fn force_void_market_v2(ctx: Context<ForceVoidMarketV2>) -> Result<()> {
    let clock = Clock::get()?;
    let market = &mut ctx.accounts.market;
    require!(
        market.status == MarketV2::STATUS_OPEN
            || market.status == MarketV2::STATUS_PAUSED
            || market.status == MarketV2::STATUS_CLOSED,
        ErrorV2::MarketAlreadyResolved
    );
    require!(
        clock.unix_timestamp
            >= market
                .close_ts
                .checked_add(FORCE_VOID_GRACE_SECONDS)
                .ok_or(ErrorV2::MathOverflow)?,
        ErrorV2::GraceNotElapsed
    );

    market.status = MarketV2::STATUS_VOID;
    market.winning_outcome = MarketV2::WINNING_UNSET;

    emit!(MarketResolvedV2 {
        market: market.key(),
        winning_outcome: MarketV2::WINNING_UNSET,
    });
    Ok(())
}

// ─── redeem_v2 ──────────────────────────────────────────────────────────────
// Winning shares pay SET_COST each; losing shares pay 0 (still marked
// redeemed so the position is terminal). On VOID every outcome's shares
// pay SET_COST / num_outcomes (floor — dust favors the vault).

#[derive(Accounts)]
pub struct RedeemV2<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"market_v2", market.market_id.to_le_bytes().as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, MarketV2>,
    #[account(
        mut,
        seeds = [b"vault_v2", market.key().as_ref()],
        bump = market.vault_bump
    )]
    pub vault: Account<'info, VaultV2>,
    #[account(
        mut,
        seeds = [
            b"position_v2",
            market.key().as_ref(),
            owner.key().as_ref(),
            &[position.outcome_index]
        ],
        bump = position.bump,
        constraint = position.owner == owner.key() @ ErrorV2::FillStateMismatch,
        constraint = position.market == market.key() @ ErrorV2::FillStateMismatch
    )]
    pub position: Account<'info, PositionV2>,
}

pub fn redeem_v2(ctx: Context<RedeemV2>) -> Result<()> {
    let market = &ctx.accounts.market;
    let voided = market.status == MarketV2::STATUS_VOID;
    require!(
        market.status == MarketV2::STATUS_SETTLED || voided,
        ErrorV2::MarketNotSettled
    );

    let position = &mut ctx.accounts.position;
    let shares = position.shares;
    require!(shares > 0, ErrorV2::NothingToRedeem);

    let payout_per_share = if voided {
        SET_COST / market.num_outcomes as u64
    } else if position.outcome_index == market.winning_outcome {
        SET_COST
    } else {
        0
    };
    let payout = payout_per_share
        .checked_mul(shares)
        .ok_or(ErrorV2::MathOverflow)?;

    // Double-redemption defense: shares zero out atomically here; a second
    // call hits NothingToRedeem.
    position.shares = 0;
    position.redeemed_shares = position
        .redeemed_shares
        .checked_add(shares)
        .ok_or(ErrorV2::MathOverflow)?;
    position.redeemed_lamports = position
        .redeemed_lamports
        .checked_add(payout)
        .ok_or(ErrorV2::MathOverflow)?;

    if payout > 0 {
        let vault = &mut ctx.accounts.vault;
        require!(vault.backing >= payout, ErrorV2::VaultInvariant);
        vault.backing -= payout;
        **vault.to_account_info().try_borrow_mut_lamports()? -= payout;
        **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += payout;
    }

    emit!(RedeemedV2 {
        market: market.key(),
        owner: position.owner,
        outcome_index: position.outcome_index,
        shares,
        payout_lamports: payout,
        voided,
    });
    Ok(())
}

// ─── withdraw_fees_v2 ───────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct WithdrawFeesV2<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [b"config_v2"],
        bump = config.bump,
        constraint = config.admin == admin.key() @ ErrorV2::UnauthorizedAdmin
    )]
    pub config: Account<'info, ConfigV2>,
    #[account(
        mut,
        seeds = [b"market_v2", market.market_id.to_le_bytes().as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, MarketV2>,
    #[account(
        mut,
        seeds = [b"vault_v2", market.key().as_ref()],
        bump = market.vault_bump
    )]
    pub vault: Account<'info, VaultV2>,
}

pub fn withdraw_fees_v2(ctx: Context<WithdrawFeesV2>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let amount = market.accrued_fees;
    require!(amount > 0, ErrorV2::NothingToRedeem);
    market.accrued_fees = 0;

    // Fees live in the vault on top of `backing`; withdrawing them can
    // never touch share backing.
    let vault_info = ctx.accounts.vault.to_account_info();
    let rent_min = Rent::get()?.minimum_balance(vault_info.data_len());
    let after = vault_info
        .lamports()
        .checked_sub(amount)
        .ok_or(ErrorV2::VaultInvariant)?;
    require!(
        after >= rent_min + ctx.accounts.vault.backing,
        ErrorV2::VaultInvariant
    );

    **vault_info.try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.admin.to_account_info().try_borrow_mut_lamports()? += amount;
    Ok(())
}
