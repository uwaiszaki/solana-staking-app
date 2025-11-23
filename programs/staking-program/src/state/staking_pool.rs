use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct StakingPool {
    pub authority: Pubkey,
    pub staking_mint: Pubkey,
    pub reward_mint: Pubkey,
    pub reward_rate: u64,
    pub total_staked: u64,
    pub bump: u8,
    pub staking_vault_bump: u8,
    pub reward_vault_bump: u8,
}
