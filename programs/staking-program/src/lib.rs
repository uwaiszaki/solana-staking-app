use anchor_lang::prelude::*;

mod state;
mod instructions;
mod constants;

use instructions::*;

declare_id!("3se3ZwCRzi9NS6b7uxaQry9fkqC7vhFf2VKfuw6oJ77T");

#[program]
pub mod staking_program {
    use super::*;

    pub fn initialize_pool(ctx: Context<InitializePool>, reward_rate: u64) -> Result<()> {
        instructions::initialize_pool::initialize_pool(ctx, reward_rate)
    }

    pub fn stake_token(ctx: Context<StakeToken>, amount: u64) -> Result<()> {
        instructions::stake_tokens::stake_token(ctx, amount)
    }

    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        instructions::unstake::unstake(ctx, amount)
    }

    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        instructions::claim_rewards::claim_rewards(ctx)
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient balance in token account")]
    InsufficientBalance,
    
    #[msg("Math overflow occurred during calculation")]
    MathOverflow,
    
    #[msg("Insufficient staked amount")]
    InsufficientStake,
    
    #[msg("Invalid amount (must be greater than 0)")]
    InvalidAmount,
    
    #[msg("No rewards available to claim")]
    NoRewardsToClaim,
    
    #[msg("Unauthorized access")]
    Unauthorized,
}
