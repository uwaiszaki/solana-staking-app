use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer, Token, TokenAccount};

use crate::state::{StakingPool, UserStake};
use crate::constants::{STAKING_POOL_SEED, STAKING_VAULT_SEED};
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

pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);
    
    let clock = Clock::get()?;
    let user_stake = &mut ctx.accounts.user_stake_account;
    let pool = &mut ctx.accounts.staking_pool;

    // Verify user has enough staked
    require!(
        user_stake.deposited_amount >= amount,
        ErrorCode::InsufficientStake
    );

    // Calculate and accumulate pending rewards before unstaking
    let pending_rewards = check_reward(
        user_stake.deposited_amount,
        clock.unix_timestamp,
        user_stake.reward_checkpoint,
        pool.reward_rate
    )?;
    
    user_stake.accumulated_rewards = user_stake.accumulated_rewards
        .checked_add(pending_rewards)
        .ok_or(ErrorCode::MathOverflow)?;

    // Transfer staked tokens back to user
    let seeds = &[
        STAKING_POOL_SEED,
        pool.authority.as_ref(),
        pool.staking_mint.as_ref(),
        pool.reward_mint.as_ref(),
        &[pool.bump]
    ];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.staking_vault.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: pool.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds
    );
    token::transfer(cpi_ctx, amount)?;

    // Update user stake
    user_stake.deposited_amount = user_stake.deposited_amount
        .checked_sub(amount)
        .ok_or(ErrorCode::MathOverflow)?;
    user_stake.reward_checkpoint = clock.unix_timestamp;

    // Update pool total staked
    pool.total_staked = pool.total_staked
        .checked_sub(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    Ok(())
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub staking_pool: Account<'info, StakingPool>,

    #[account(
        mut,
        seeds = [STAKING_VAULT_SEED, staking_pool.key().as_ref()],
        bump = staking_pool.staking_vault_bump,
        token::mint = staking_pool.staking_mint,
        token::authority = staking_pool,
    )]
    pub staking_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == staking_pool.staking_mint
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"user_stake_account", staking_pool.key().as_ref(), user.key().as_ref()],
        bump = user_stake_account.bump,
        constraint = user_stake_account.owner == user.key() @ ErrorCode::Unauthorized,
    )]
    pub user_stake_account: Account<'info, UserStake>,

    pub token_program: Program<'info, Token>,
}

