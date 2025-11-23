use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer, Token, TokenAccount};

use crate::state::{StakingPool, UserStake};
use crate::constants::{STAKING_POOL_SEED, REWARD_VAULT_SEED};
use crate::ErrorCode;

/// Calculate rewards earned based on staked amount, time elapsed, and reward rate
fn check_reward(
    staked_amount: u64,
    current_unix_timestamp: i64,
    checkpoint_timestamp: i64,
    reward_rate: u64
) -> Result<u64> {
    if staked_amount == 0 {
        return Ok(0);
    }

    let time_elapsed = current_unix_timestamp - checkpoint_timestamp;
    
    if time_elapsed <= 0 {
        return Ok(0);
    }

    let reward = (staked_amount as u128)
        .checked_mul(time_elapsed as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_mul(reward_rate as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(1_000_000_000)
        .ok_or(ErrorCode::MathOverflow)?;

    Ok(reward as u64)
}

pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
    let clock = Clock::get()?;
    let user_stake = &mut ctx.accounts.user_stake_account;
    let pool = &ctx.accounts.staking_pool;

    // Calculate new rewards since last checkpoint
    let new_rewards = check_reward(
        user_stake.deposited_amount,
        clock.unix_timestamp,
        user_stake.reward_checkpoint,
        pool.reward_rate
    )?;

    // Total claimable = accumulated + newly earned
    let total_claimable = user_stake.accumulated_rewards
        .checked_add(new_rewards)
        .ok_or(ErrorCode::MathOverflow)?;

    require!(total_claimable > 0, ErrorCode::NoRewardsToClaim);

    // Transfer rewards from reward vault to user
    let seeds = &[
        STAKING_POOL_SEED,
        pool.authority.as_ref(),
        pool.staking_mint.as_ref(),
        pool.reward_mint.as_ref(),
        &[pool.bump]
    ];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.reward_vault.to_account_info(),
        to: ctx.accounts.user_reward_account.to_account_info(),
        authority: pool.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds
    );
    token::transfer(cpi_ctx, total_claimable)?;

    // Reset accumulated rewards and update checkpoint
    user_stake.accumulated_rewards = 0;
    user_stake.reward_checkpoint = clock.unix_timestamp;

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub staking_pool: Account<'info, StakingPool>,

    #[account(
        mut,
        seeds = [REWARD_VAULT_SEED, staking_pool.key().as_ref()],
        bump = staking_pool.reward_vault_bump,
        token::mint = staking_pool.reward_mint,
        token::authority = staking_pool,
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_reward_account.owner == user.key(),
        constraint = user_reward_account.mint == staking_pool.reward_mint
    )]
    pub user_reward_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"user_stake_account", staking_pool.key().as_ref(), user.key().as_ref()],
        bump = user_stake_account.bump,
        constraint = user_stake_account.owner == user.key() @ ErrorCode::Unauthorized,
    )]
    pub user_stake_account: Account<'info, UserStake>,

    pub token_program: Program<'info, Token>,
}

