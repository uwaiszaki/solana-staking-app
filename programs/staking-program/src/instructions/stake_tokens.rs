use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer, Token, TokenAccount};

use crate::state::{StakingPool, UserStake};
use crate::constants::STAKING_VAULT_SEED;
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

pub fn stake_token(ctx: Context<StakeToken>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);
    
    let clock = Clock::get()?;
    let user_stake = &mut ctx.accounts.user_stake_account;
    let pool = &mut ctx.accounts.staking_pool;

    // If already staked, calculate and accumulate pending rewards
    if user_stake.deposited_amount > 0 {
        let pending_rewards = check_reward(
            user_stake.deposited_amount,
            clock.unix_timestamp,
            user_stake.reward_checkpoint,
            pool.reward_rate
        )?;
        
        user_stake.accumulated_rewards = user_stake.accumulated_rewards
            .checked_add(pending_rewards)
            .ok_or(ErrorCode::MathOverflow)?;
    }

    // Transfer tokens from user to staking vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.staking_vault.to_account_info(),
        authority: ctx.accounts.user.to_account_info()
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    // Update user stake
    user_stake.owner = ctx.accounts.user.key();
    user_stake.deposited_amount = user_stake.deposited_amount
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;
    user_stake.reward_checkpoint = clock.unix_timestamp;
    user_stake.bump = ctx.bumps.user_stake_account;

    // Update pool total staked
    pool.total_staked = pool.total_staked
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    Ok(())
}

// What does staking token do
// Takes a user signer
// Takes the user token_account
// Calls transfer from user to stake_vault
// update user_stake_account with stake data
// Needs user, staking_pool, user_token_account, user_stake_account
// stake_vault, token_program, system_program


#[derive(Accounts)]
pub struct StakeToken<'info> {
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
        init_if_needed,
        payer = user,
        seeds=[b"user_stake_account", staking_pool.key().as_ref(), user.key().as_ref()],
        bump,
        space=8+UserStake::INIT_SPACE,
    )]
    pub user_stake_account: Account<'info, UserStake>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,

}