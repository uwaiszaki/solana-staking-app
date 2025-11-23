use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserStake {
    pub owner: Pubkey,
    pub deposited_amount: u64,
    pub accumulated_rewards: u64,
    pub reward_checkpoint: i64,
    pub bump: u8,
}