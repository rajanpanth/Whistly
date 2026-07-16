use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::errors_v2::ErrorV2;
use crate::state_v2::*;

// ─── deposit_v2 ─────────────────────────────────────────────────────────────
// Wallet-signed: move lamports wallet → BalanceV2 PDA. This is the one-time
// "funding" step (like an exchange deposit); fills afterwards settle without
// wallet signatures.

#[derive(Accounts)]
pub struct DepositV2<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + BalanceV2::INIT_SPACE,
        seeds = [b"balance_v2", owner.key().as_ref()],
        bump
    )]
    pub balance: Account<'info, BalanceV2>,
    pub system_program: Program<'info, System>,
}

pub fn deposit_v2(ctx: Context<DepositV2>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorV2::ZeroAmount);
    let balance = &mut ctx.accounts.balance;
    if balance.owner == Pubkey::default() {
        balance.owner = ctx.accounts.owner.key();
        balance.bump = ctx.bumps.balance;
    }
    require_keys_eq!(balance.owner, ctx.accounts.owner.key(), ErrorV2::InsufficientBalance);

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: balance.to_account_info(),
            },
        ),
        amount,
    )?;

    balance.available = balance
        .available
        .checked_add(amount)
        .ok_or(ErrorV2::MathOverflow)?;
    balance.total_deposited = balance
        .total_deposited
        .checked_add(amount)
        .ok_or(ErrorV2::MathOverflow)?;

    // Fully qualified: `DepositV2` here is the Accounts struct, the event
    // with the same name lives in events_v2.
    emit!(crate::events_v2::DepositV2 {
        owner: balance.owner,
        amount,
        available: balance.available,
    });
    Ok(())
}

// ─── withdraw_v2 ────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct WithdrawV2<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"balance_v2", owner.key().as_ref()],
        bump = balance.bump,
        constraint = balance.owner == owner.key() @ ErrorV2::InsufficientBalance
    )]
    pub balance: Account<'info, BalanceV2>,
}

pub fn withdraw_v2(ctx: Context<WithdrawV2>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorV2::ZeroAmount);
    let balance = &mut ctx.accounts.balance;
    require!(balance.available >= amount, ErrorV2::InsufficientBalance);

    balance.available -= amount;
    balance.total_withdrawn = balance
        .total_withdrawn
        .checked_add(amount)
        .ok_or(ErrorV2::MathOverflow)?;

    // PDA-owned lamports: mutate directly (stay above rent-exempt minimum
    // because `available` never includes the rent reserve).
    **balance.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += amount;

    emit!(crate::events_v2::WithdrawV2 {
        owner: balance.owner,
        amount,
        available: balance.available,
    });
    Ok(())
}
