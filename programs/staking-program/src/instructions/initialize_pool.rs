use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::state::StakingPool;
use crate::constants::{STAKING_POOL_SEED, STAKING_VAULT_SEED, REWARD_VAULT_SEED};


pub fn initialize_pool(ctx: Context<InitializePool>, reward_rate: u64) -> Result<()> {
    let pool = &mut ctx.accounts.staking_pool;
    pool.authority = ctx.accounts.authority.key();
    pool.staking_mint = ctx.accounts.staking_mint.key();
    pool.reward_mint = ctx.accounts.reward_mint.key();
    pool.reward_rate = reward_rate;
    pool.total_staked = 0;
    pool.bump = ctx.bumps.staking_pool;
    pool.staking_vault_bump = ctx.bumps.staking_vault;
    pool.reward_vault_bump = ctx.bumps.reward_vault;

    Ok(())
}


#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        seeds=[
            STAKING_POOL_SEED,
            authority.key().as_ref(),
            staking_mint.key().as_ref(),
            reward_mint.key().as_ref()
        ],
        bump,
        space=8+StakingPool::INIT_SPACE
    )]
    pub staking_pool: Account<'info, StakingPool>,

    pub staking_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        seeds = [STAKING_VAULT_SEED, staking_pool.key().as_ref()],
        bump,
        token::mint = staking_mint,
        token::authority = staking_pool,
    )]
    pub staking_vault: Account<'info, TokenAccount>,

    pub reward_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        seeds = [REWARD_VAULT_SEED, staking_pool.key().as_ref()],
        bump,
        token::mint = reward_mint,
        token::authority = staking_pool,
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>
}