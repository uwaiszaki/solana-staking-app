import { AnchorProvider, Program, BN, Idl } from '@coral-xyz/anchor';
import { PublicKey, Connection, Keypair } from '@solana/web3.js';
import { AnchorWallet } from '@solana/wallet-adapter-react';
import IDL from './staking_program.json';

export const PROGRAM_ID = new PublicKey('3se3ZwCRzi9NS6b7uxaQry9fkqC7vhFf2VKfuw6oJ77T');

export function getProgram(connection: Connection, wallet: AnchorWallet) {
  const provider = new AnchorProvider(connection, wallet, {});
  return new Program(IDL as Idl, provider);
}

export function apyToRate(apyPercent: number): BN {
  const SECONDS_PER_YEAR = 31_557_600; // 365.25 days
  const SCALE_FACTOR = 1_000_000_000;
  const apyDecimal = apyPercent / 100;
  const perSecondRate = apyDecimal / SECONDS_PER_YEAR;
  const scaledRate = Math.floor(perSecondRate * SCALE_FACTOR);
  return new BN(scaledRate);
}

export function rateToAPY(rate: BN): number {
  const SECONDS_PER_YEAR = 31_557_600;
  const rateNumber = rate.toNumber();
  const perSecond = rateNumber / 1e9;
  const apyDecimal = perSecond * SECONDS_PER_YEAR;
  return apyDecimal * 100;
}

export function getStakingPoolPDA(
  authority: PublicKey,
  stakingMint: PublicKey,
  rewardMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('staking_pool'),
      authority.toBuffer(),
      stakingMint.toBuffer(),
      rewardMint.toBuffer(),
    ],
    PROGRAM_ID
  );
}

export function getStakingVaultPDA(stakingPool: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('staking_vault'), stakingPool.toBuffer()],
    PROGRAM_ID
  );
}

export function getRewardVaultPDA(stakingPool: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('reward_vault'), stakingPool.toBuffer()],
    PROGRAM_ID
  );
}

export function getUserStakeAccountPDA(
  stakingPool: PublicKey,
  user: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('user_stake_account'), stakingPool.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  );
}

export function formatTokenAmount(amount: number, decimals: number = 9): string {
  return (amount / Math.pow(10, decimals)).toFixed(4);
}

export function parseTokenAmount(amount: string, decimals: number = 9): number {
  return Math.floor(parseFloat(amount) * Math.pow(10, decimals));
}

