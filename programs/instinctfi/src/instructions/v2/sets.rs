use anchor_lang::prelude::*;

use crate::errors_v2::ErrorV2;
use crate::state_v2::*;

// Complete-set primitives. Minting N sets deposits N × SET_COST from the
// user's BalanceV2 into the market vault and credits N shares of EVERY
// outcome; burning does the reverse. These keep the vault exactly backed:
// vault.backing == open_sets × SET_COST at all times.
//
// Used directly by market makers on 3+ outcome markets and internally by
// the mint-cross / burn-cross fill modes on binary markets.

pub const MAX_SETS_PER_CALL: u64 = 1_000_000; // 1000 SOL worth — sanity cap

/// Accounts for mint/burn. `remaining_accounts` must carry the user's
/// PositionV2 PDA for every outcome index 0..num_outcomes, in order.
#[derive(Accounts)]
pub struct MintBurnSetV2<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [b"config_v2"], bump = config.bump)]
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
    #[account(
        mut,
        seeds = [b"balance_v2", owner.key().as_ref()],
        bump = balance.bump,
        constraint = balance.owner == owner.key() @ ErrorV2::InsufficientBalance
    )]
    pub balance: Account<'info, BalanceV2>,
    pub system_program: Program<'info, System>,
}

/// Validate + load the caller's PositionV2 for `outcome_index` from
/// remaining_accounts[i]. Positions must have been created beforehand via
/// `init_position_v2` (kept explicit so compute stays predictable).
fn load_position<'info>(
    account: &'info AccountInfo<'info>,
    market: &Pubkey,
    owner: &Pubkey,
    outcome_index: u8,
) -> Result<Account<'info, PositionV2>> {
    // Positions are only ever created at canonical PDA seeds, so field
    // equality uniquely identifies the account — no re-derivation needed.
    let position: Account<PositionV2> = Account::try_from(account)?;
    require_keys_eq!(position.market, *market, ErrorV2::FillStateMismatch);
    require_keys_eq!(position.owner, *owner, ErrorV2::FillStateMismatch);
    require!(position.outcome_index == outcome_index, ErrorV2::InvalidOutcome);
    Ok(position)
}

pub fn mint_set_v2<'info>(
    ctx: Context<'_, '_, 'info, 'info, MintBurnSetV2<'info>>,
    sets: u64,
) -> Result<()> {
    let clock = Clock::get()?;
    require!(!ctx.accounts.config.paused, ErrorV2::Paused);
    require!(sets > 0 && sets <= MAX_SETS_PER_CALL, ErrorV2::InvalidQuantity);
    require!(
        ctx.accounts.market.is_tradable(clock.unix_timestamp),
        ErrorV2::MarketNotTradable
    );

    let cost = sets.checked_mul(SET_COST).ok_or(ErrorV2::MathOverflow)?;
    let balance = &mut ctx.accounts.balance;
    require!(balance.available >= cost, ErrorV2::InsufficientBalance);

    let market_key = ctx.accounts.market.key();
    let owner_key = ctx.accounts.owner.key();
    let n = ctx.accounts.market.num_outcomes as usize;
    require!(
        ctx.remaining_accounts.len() == n,
        ErrorV2::InvalidOutcomeCount
    );

    // Debit balance, credit vault (both program-owned PDAs).
    balance.available -= cost;
    **balance.to_account_info().try_borrow_mut_lamports()? -= cost;
    **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? += cost;

    for (i, account) in ctx.remaining_accounts.iter().enumerate() {
        let mut position =
            load_position(account, &market_key, &owner_key, i as u8)?;
        position.shares = position
            .shares
            .checked_add(sets)
            .ok_or(ErrorV2::MathOverflow)?;
        // Cost basis: a set costs SET_COST split across outcomes evenly
        // (floor; dust attributed to outcome 0 so Σ basis == cost).
        let share = if i == 0 {
            SET_COST / n as u64 + SET_COST % n as u64
        } else {
            SET_COST / n as u64
        };
        position.cost_lamports = position
            .cost_lamports
            .checked_add(share.checked_mul(sets).ok_or(ErrorV2::MathOverflow)?)
            .ok_or(ErrorV2::MathOverflow)?;
        position.exit(ctx.program_id)?; // persist
    }

    let market = &mut ctx.accounts.market;
    market.open_sets = market
        .open_sets
        .checked_add(sets)
        .ok_or(ErrorV2::MathOverflow)?;
    let vault = &mut ctx.accounts.vault;
    vault.backing = vault
        .backing
        .checked_add(cost)
        .ok_or(ErrorV2::MathOverflow)?;

    emit!(crate::events_v2::SetMintedV2 {
        market: market_key,
        owner: owner_key,
        sets,
    });
    Ok(())
}

pub fn burn_set_v2<'info>(
    ctx: Context<'_, '_, 'info, 'info, MintBurnSetV2<'info>>,
    sets: u64,
) -> Result<()> {
    require!(!ctx.accounts.config.paused, ErrorV2::Paused);
    require!(sets > 0 && sets <= MAX_SETS_PER_CALL, ErrorV2::InvalidQuantity);
    // Burning is allowed while open OR closed (pre-settlement exit),
    // but not once resolved (redeem instead).
    let status = ctx.accounts.market.status;
    require!(
        status == MarketV2::STATUS_OPEN || status == MarketV2::STATUS_CLOSED,
        ErrorV2::MarketAlreadyResolved
    );

    let refund = sets.checked_mul(SET_COST).ok_or(ErrorV2::MathOverflow)?;
    let market_key = ctx.accounts.market.key();
    let owner_key = ctx.accounts.owner.key();
    let n = ctx.accounts.market.num_outcomes as usize;
    require!(
        ctx.remaining_accounts.len() == n,
        ErrorV2::InvalidOutcomeCount
    );

    for (i, account) in ctx.remaining_accounts.iter().enumerate() {
        let mut position =
            load_position(account, &market_key, &owner_key, i as u8)?;
        require!(position.shares >= sets, ErrorV2::InsufficientShares);
        position.shares -= sets;
        // Reduce basis proportionally (floor — conservative).
        let share = if i == 0 {
            SET_COST / n as u64 + SET_COST % n as u64
        } else {
            SET_COST / n as u64
        };
        position.cost_lamports = position
            .cost_lamports
            .saturating_sub(share.saturating_mul(sets));
        position.exit(ctx.program_id)?;
    }

    let vault = &mut ctx.accounts.vault;
    require!(vault.backing >= refund, ErrorV2::VaultInvariant);
    vault.backing -= refund;
    **vault.to_account_info().try_borrow_mut_lamports()? -= refund;
    let balance = &mut ctx.accounts.balance;
    balance.available = balance
        .available
        .checked_add(refund)
        .ok_or(ErrorV2::MathOverflow)?;
    **balance.to_account_info().try_borrow_mut_lamports()? += refund;

    let market = &mut ctx.accounts.market;
    require!(market.open_sets >= sets, ErrorV2::VaultInvariant);
    market.open_sets -= sets;

    emit!(crate::events_v2::SetBurnedV2 {
        market: market_key,
        owner: owner_key,
        sets,
    });
    Ok(())
}

// ─── init_position_v2 ───────────────────────────────────────────────────────
// Explicit position creation (rent paid by the position owner or, for the
// settlement path, by the operator as payer).

#[derive(Accounts)]
#[instruction(outcome_index: u8)]
pub struct InitPositionV2<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: position owner — any wallet; only used as a PDA seed.
    pub owner: UncheckedAccount<'info>,
    #[account(seeds = [b"market_v2", market.market_id.to_le_bytes().as_ref()], bump = market.bump)]
    pub market: Account<'info, MarketV2>,
    #[account(
        init,
        payer = payer,
        space = 8 + PositionV2::INIT_SPACE,
        seeds = [
            b"position_v2",
            market.key().as_ref(),
            owner.key().as_ref(),
            &[outcome_index]
        ],
        bump
    )]
    pub position: Account<'info, PositionV2>,
    pub system_program: Program<'info, System>,
}

pub fn init_position_v2(ctx: Context<InitPositionV2>, outcome_index: u8) -> Result<()> {
    require!(
        outcome_index < ctx.accounts.market.num_outcomes,
        ErrorV2::InvalidOutcome
    );
    let position = &mut ctx.accounts.position;
    position.market = ctx.accounts.market.key();
    position.owner = ctx.accounts.owner.key();
    position.outcome_index = outcome_index;
    position.shares = 0;
    position.cost_lamports = 0;
    position.proceeds_lamports = 0;
    position.redeemed_shares = 0;
    position.redeemed_lamports = 0;
    position.bump = ctx.bumps.position;
    Ok(())
}
