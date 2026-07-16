use anchor_lang::prelude::*;
use std::str::FromStr;

use crate::errors_v2::ErrorV2;
use crate::events_v2::*;
use crate::state_v2::*;

// ─── init_config_v2 ─────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitConfigV2<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + ConfigV2::INIT_SPACE,
        seeds = [b"config_v2"],
        bump
    )]
    pub config: Account<'info, ConfigV2>,
    pub system_program: Program<'info, System>,
}

pub fn init_config_v2(ctx: Context<InitConfigV2>, operator: Pubkey, fee_bps: u16) -> Result<()> {
    // Front-run protection: only the published initial admin may initialize.
    let initial = Pubkey::from_str(INITIAL_V2_ADMIN).unwrap();
    require_keys_eq!(ctx.accounts.admin.key(), initial, ErrorV2::UnauthorizedAdmin);
    require!(fee_bps <= MAX_FEE_BPS, ErrorV2::InvalidFee);

    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.operator = operator;
    config.fee_bps = fee_bps;
    config.paused = false;
    config.next_market_id = 1;
    config.bump = ctx.bumps.config;
    Ok(())
}

// ─── update_config_v2 ───────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct UpdateConfigV2<'info> {
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [b"config_v2"],
        bump = config.bump,
        constraint = config.admin == admin.key() @ ErrorV2::UnauthorizedAdmin
    )]
    pub config: Account<'info, ConfigV2>,
}

pub fn update_config_v2(
    ctx: Context<UpdateConfigV2>,
    new_admin: Option<Pubkey>,
    new_operator: Option<Pubkey>,
    new_fee_bps: Option<u16>,
    paused: Option<bool>,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    if let Some(a) = new_admin {
        config.admin = a;
    }
    if let Some(o) = new_operator {
        config.operator = o;
    }
    if let Some(f) = new_fee_bps {
        require!(f <= MAX_FEE_BPS, ErrorV2::InvalidFee);
        config.fee_bps = f;
    }
    if let Some(p) = paused {
        config.paused = p;
    }
    Ok(())
}

// ─── create_market_v2 ───────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct CreateMarketV2<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [b"config_v2"],
        bump = config.bump,
        constraint = config.admin == admin.key() @ ErrorV2::UnauthorizedAdmin
    )]
    pub config: Account<'info, ConfigV2>,
    #[account(
        init,
        payer = admin,
        space = 8 + MarketV2::INIT_SPACE,
        seeds = [b"market_v2", config.next_market_id.to_le_bytes().as_ref()],
        bump
    )]
    pub market: Account<'info, MarketV2>,
    #[account(
        init,
        payer = admin,
        space = 8 + VaultV2::INIT_SPACE,
        seeds = [b"vault_v2", market.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, VaultV2>,
    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn create_market_v2(
    ctx: Context<CreateMarketV2>,
    title: String,
    outcomes: Vec<String>,
    market_type: u8,
    fixture_id: u64,
    resolution_source: u8,
    close_ts: i64,
) -> Result<()> {
    let clock = Clock::get()?;
    require!(!ctx.accounts.config.paused, ErrorV2::Paused);
    require!(
        outcomes.len() >= 2 && outcomes.len() <= MAX_OUTCOMES_V2,
        ErrorV2::InvalidOutcomeCount
    );
    require!(close_ts > clock.unix_timestamp, ErrorV2::InvalidCloseTime);
    require!(title.len() <= 96, ErrorV2::BadOrderPayload);
    for o in &outcomes {
        require!(!o.is_empty() && o.len() <= 24, ErrorV2::InvalidOutcomeCount);
    }

    let config = &mut ctx.accounts.config;
    let market = &mut ctx.accounts.market;
    market.market_id = config.next_market_id;
    market.num_outcomes = outcomes.len() as u8;
    market.title = title;
    market.outcomes = outcomes;
    market.market_type = market_type;
    market.fixture_id = fixture_id;
    market.resolution_source = resolution_source;
    market.close_ts = close_ts;
    market.status = MarketV2::STATUS_OPEN;
    market.winning_outcome = MarketV2::WINNING_UNSET;
    market.fee_bps = config.fee_bps;
    market.open_sets = 0;
    market.volume_lamports = 0;
    market.fill_count = 0;
    market.accrued_fees = 0;
    market.created_at = clock.unix_timestamp;
    market.bump = ctx.bumps.market;
    market.vault_bump = ctx.bumps.vault;

    let vault = &mut ctx.accounts.vault;
    vault.market = market.key();
    vault.backing = 0;
    vault.bump = ctx.bumps.vault;

    config.next_market_id = config
        .next_market_id
        .checked_add(1)
        .ok_or(ErrorV2::MathOverflow)?;

    emit!(MarketCreatedV2 {
        market: market.key(),
        market_id: market.market_id,
        num_outcomes: market.num_outcomes,
        market_type,
        fixture_id,
        close_ts,
    });
    Ok(())
}

// ─── set_market_status_v2 (pause / unpause / close) ─────────────────────────

#[derive(Accounts)]
pub struct SetMarketStatusV2<'info> {
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

pub fn set_market_status_v2(ctx: Context<SetMarketStatusV2>, status: u8) -> Result<()> {
    let market = &mut ctx.accounts.market;
    require!(
        market.status == MarketV2::STATUS_OPEN
            || market.status == MarketV2::STATUS_PAUSED
            || market.status == MarketV2::STATUS_CLOSED,
        ErrorV2::MarketAlreadyResolved
    );
    require!(
        status == MarketV2::STATUS_OPEN
            || status == MarketV2::STATUS_PAUSED
            || status == MarketV2::STATUS_CLOSED,
        ErrorV2::MarketNotTradable
    );
    market.status = status;
    Ok(())
}
