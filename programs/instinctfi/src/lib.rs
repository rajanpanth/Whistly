use anchor_lang::prelude::*;

pub mod state;
pub mod errors;
pub mod instructions;
pub mod events;

// V2 CLOB-style share-trading protocol (additive — V1 untouched).
pub mod state_v2;
pub mod errors_v2;
pub mod events_v2;

use instructions::v2;
use instructions::v2::*;
use instructions::*;

// Deployed to Solana devnet on 2026-03-01
declare_id!("J9AqrLZWDXaQfDwtFpC2GG9hBb7SAPxRwVpGs753EgWV");

#[program]
pub mod instinctfi {
    use super::*;

    /// Create a user profile (PDA). Required before creating polls or voting.
    pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
        instructions::initialize_user::handler(ctx)
    }

    /// Create a prediction poll with a flat 0.5 SOL creation fee.
    pub fn create_poll(
        ctx: Context<CreatePoll>,
        poll_id: u64,
        title: String,
        description: String,
        category: String,
        image_url: String,
        options: Vec<String>,
        unit_price: u64,
        end_time: i64,
        market_kind: u8,
    ) -> Result<()> {
        instructions::create_poll::handler(
            ctx, poll_id, title, description, category, image_url,
            options, unit_price, end_time, market_kind,
        )
    }

    /// Edit a poll (creator only, zero votes, active, not ended).
    pub fn edit_poll(
        ctx: Context<EditPoll>,
        poll_id: u64,
        title: String,
        description: String,
        category: String,
        image_url: String,
        options: Vec<String>,
        end_time: i64,
    ) -> Result<()> {
        instructions::edit_poll::handler(
            ctx, poll_id, title, description, category, image_url, options, end_time,
        )
    }

    /// Delete a poll and refund SOL to creator (zero votes, active, not ended).
    pub fn delete_poll(ctx: Context<DeletePoll>, poll_id: u64) -> Result<()> {
        instructions::delete_poll::handler(ctx, poll_id)
    }

    /// Buy option-coins by sending real SOL to the treasury.
    pub fn cast_vote(
        ctx: Context<CastVote>,
        poll_id: u64,
        option_index: u8,
        num_coins: u64,
    ) -> Result<()> {
        instructions::cast_vote::handler(ctx, poll_id, option_index, num_coins)
    }

    /// Settle a poll after end time. Anyone can call (permissionless).
    pub fn settle_poll(ctx: Context<SettlePoll>, poll_id: u64) -> Result<()> {
        instructions::settle_poll::handler(ctx, poll_id)
    }

    /// Claim winnings — real SOL transferred from treasury to winner.
    pub fn claim_reward(ctx: Context<ClaimReward>, poll_id: u64) -> Result<()> {
        instructions::claim_reward::handler(ctx, poll_id)
    }

    /// Sweep residual dust/platform fees from a settled poll's treasury (#48/#49).
    pub fn sweep_dust(ctx: Context<SweepDust>, poll_id: u64) -> Result<()> {
        instructions::sweep_dust::handler(ctx, poll_id)
    }

    /// CRIT-03 FIX: Refund a voter their stake when a poll ended in a tie.
    pub fn refund_tied_poll(ctx: Context<RefundTiedPoll>, poll_id: u64) -> Result<()> {
        instructions::refund_tied_poll::handler(ctx, poll_id)
    }

    /// Admin-settle a prediction market poll by declaring the real-world outcome.
    /// Only PLATFORM_ADMIN can call this. Sets winning_option to the actual result.
    pub fn admin_settle_poll(
        ctx: Context<AdminSettlePoll>,
        poll_id: u64,
        winning_option: u8,
    ) -> Result<()> {
        instructions::admin_settle_poll::handler(ctx, poll_id, winning_option)
    }

    /// Admin-edit a poll (including ended polls). Only PLATFORM_ADMIN can call.
    /// Allows extending deadlines, fixing text, etc. Cannot edit settled polls.
    pub fn admin_edit_poll(
        ctx: Context<AdminEditPoll>,
        poll_id: u64,
        title: String,
        description: String,
        category: String,
        image_url: String,
        options: Vec<String>,
        end_time: i64,
    ) -> Result<()> {
        instructions::admin_edit_poll::handler(
            ctx, poll_id, title, description, category, image_url, options, end_time,
        )
    }

    /// Initialize the platform config PDA. Must be called once after deployment.
    pub fn initialize_platform(ctx: Context<InitializePlatform>) -> Result<()> {
        instructions::initialize_platform::handler(ctx)
    }

    /// Update platform config (pause toggle, admin transfer). Admin only.
    pub fn update_platform_config(
        ctx: Context<UpdatePlatformConfig>,
        paused: bool,
        new_admin: Pubkey,
    ) -> Result<()> {
        instructions::update_platform_config::handler(ctx, paused, new_admin)
    }

    // ═══════════════════════ V2 — CLOB share trading ═══════════════════════
    // Additive protocol: real outcome shares, off-chain matching, on-chain
    // fill settlement, redemption. V1 instructions above are untouched.

    /// One-time V2 config init (admin gated to the published initial admin).
    pub fn init_config_v2(
        ctx: Context<InitConfigV2>,
        operator: Pubkey,
        fee_bps: u16,
    ) -> Result<()> {
        v2::admin::init_config_v2(ctx, operator, fee_bps)
    }

    /// Rotate admin/operator, change fee, pause/unpause V2 trading.
    pub fn update_config_v2(
        ctx: Context<UpdateConfigV2>,
        new_admin: Option<Pubkey>,
        new_operator: Option<Pubkey>,
        new_fee_bps: Option<u16>,
        paused: Option<bool>,
    ) -> Result<()> {
        v2::admin::update_config_v2(ctx, new_admin, new_operator, new_fee_bps, paused)
    }

    /// Create a V2 share market (binary / three-way / multi-outcome).
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
        v2::admin::create_market_v2(
            ctx, title, outcomes, market_type, fixture_id, resolution_source, close_ts,
        )
    }

    /// Pause / unpause / close a V2 market (admin).
    pub fn set_market_status_v2(ctx: Context<SetMarketStatusV2>, status: u8) -> Result<()> {
        v2::admin::set_market_status_v2(ctx, status)
    }

    /// Deposit lamports into the caller's V2 trading balance.
    pub fn deposit_v2(ctx: Context<DepositV2>, amount: u64) -> Result<()> {
        v2::funds::deposit_v2(ctx, amount)
    }

    /// Withdraw available lamports from the caller's V2 trading balance.
    pub fn withdraw_v2(ctx: Context<WithdrawV2>, amount: u64) -> Result<()> {
        v2::funds::withdraw_v2(ctx, amount)
    }

    /// Create a position account for (market, owner, outcome).
    pub fn init_position_v2(ctx: Context<InitPositionV2>, outcome_index: u8) -> Result<()> {
        v2::sets::init_position_v2(ctx, outcome_index)
    }

    /// Mint complete sets: pay N × SET_COST, receive N shares of every outcome.
    pub fn mint_set_v2<'info>(
        ctx: Context<'_, '_, 'info, 'info, MintBurnSetV2<'info>>,
        sets: u64,
    ) -> Result<()> {
        v2::sets::mint_set_v2(ctx, sets)
    }

    /// Burn complete sets back into collateral.
    pub fn burn_set_v2<'info>(
        ctx: Context<'_, '_, 'info, 'info, MintBurnSetV2<'info>>,
        sets: u64,
    ) -> Result<()> {
        v2::sets::burn_set_v2(ctx, sets)
    }

    /// Settle one matched fill on-chain (operator). The two order payloads
    /// are read from their ed25519 verification pre-instructions via
    /// sysvar introspection and bound to the hash args.
    pub fn settle_fill_v2(
        ctx: Context<SettleFillV2>,
        maker_hash: [u8; 32],
        taker_hash: [u8; 32],
        fill_qty: u64,
        maker_sig_ix_index: u8,
        taker_sig_ix_index: u8,
    ) -> Result<()> {
        v2::fill::settle_fill_v2(
            ctx,
            maker_hash,
            taker_hash,
            fill_qty,
            maker_sig_ix_index,
            taker_sig_ix_index,
        )
    }

    /// Trustless on-chain hard-cancel of a signed order by its maker.
    pub fn cancel_order_v2(
        ctx: Context<CancelOrderV2>,
        order: Vec<u8>,
        order_hash: [u8; 32],
    ) -> Result<()> {
        v2::fill::cancel_order_v2(ctx, order, order_hash)
    }

    /// Declare the winning outcome of a V2 market (admin).
    pub fn settle_market_v2(ctx: Context<ResolveMarketV2>, winning_outcome: u8) -> Result<()> {
        v2::resolve::settle_market_v2(ctx, winning_outcome)
    }

    /// Void a V2 market — all shares refund at SET_COST / num_outcomes.
    pub fn void_market_v2(ctx: Context<ResolveMarketV2>) -> Result<()> {
        v2::resolve::void_market_v2(ctx)
    }

    /// Permissionless liveness fallback: anyone can void a market that the
    /// admin has left unresolved for FORCE_VOID_GRACE_SECONDS after close.
    pub fn force_void_market_v2(ctx: Context<ForceVoidMarketV2>) -> Result<()> {
        v2::resolve::force_void_market_v2(ctx)
    }

    /// Propose the winning outcome of a data-resolved market (admin).
    /// Finalizable by anyone after the dispute window; re-proposing
    /// overwrites and restarts the window.
    pub fn propose_settle_market_v2(
        ctx: Context<ProposeSettleMarketV2>,
        winning_outcome: u8,
    ) -> Result<()> {
        v2::resolve::propose_settle_market_v2(ctx, winning_outcome)
    }

    /// Finalize a proposed settlement after the dispute window (permissionless).
    pub fn finalize_settle_market_v2(ctx: Context<FinalizeSettleMarketV2>) -> Result<()> {
        v2::resolve::finalize_settle_market_v2(ctx)
    }

    /// Redeem a position after settlement or void.
    pub fn redeem_v2(ctx: Context<RedeemV2>) -> Result<()> {
        v2::resolve::redeem_v2(ctx)
    }

    /// Withdraw accrued trading fees from a market vault (admin).
    pub fn withdraw_fees_v2(ctx: Context<WithdrawFeesV2>) -> Result<()> {
        v2::resolve::withdraw_fees_v2(ctx)
    }
}
