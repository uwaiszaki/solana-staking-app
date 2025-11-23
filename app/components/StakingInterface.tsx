'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useEffect, useState } from 'react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import {
  getProgram,
  apyToRate,
  rateToAPY,
  getStakingPoolPDA,
  getStakingVaultPDA,
  getRewardVaultPDA,
  getUserStakeAccountPDA,
  formatTokenAmount,
  parseTokenAmount,
} from '../lib/program';

export default function StakingInterface() {
  const { connection } = useConnection();
  const wallet = useWallet();

  // Pool state
  const [stakingMint, setStakingMint] = useState('');
  const [rewardMint, setRewardMint] = useState('');
  const [apy, setApy] = useState('10');
  const [poolAddress, setPoolAddress] = useState('');
  const [poolData, setPoolData] = useState<any>(null);

  // User stake state
  const [userStakeData, setUserStakeData] = useState<any>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');

  // Loading states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load pool data
  const loadPoolData = async () => {
    if (!wallet.publicKey || !poolAddress) return;

    try {
      const program = getProgram(connection, wallet as any);
      const poolPubkey = new PublicKey(poolAddress);
      const pool = await program.account.stakingPool.fetch(poolPubkey);

      setPoolData({
        authority: pool.authority.toString(),
        stakingMint: pool.stakingMint.toString(),
        rewardMint: pool.rewardMint.toString(),
        rewardRate: pool.rewardRate,
        totalStaked: pool.totalStaked,
        apy: rateToAPY(pool.rewardRate as BN),
      });

      // Also load user stake data
      const [userStakePDA] = getUserStakeAccountPDA(poolPubkey, wallet.publicKey);
      
      try {
        const userStake = await program.account.userStake.fetch(userStakePDA);
        setUserStakeData({
          depositedAmount: userStake.depositedAmount,
          accumulatedRewards: userStake.accumulatedRewards,
          rewardCheckpoint: userStake.rewardCheckpoint,
        });
      } catch (err) {
        // User hasn't staked yet
        setUserStakeData(null);
      }
    } catch (err: any) {
      console.error('Error loading pool:', err);
      setError('Failed to load pool data');
    }
  };

  // Initialize pool
  const handleInitializePool = async () => {
    if (!wallet.publicKey) {
      setError('Please connect your wallet');
      return;
    }

    if (!stakingMint || !rewardMint) {
      setError('Please enter both mint addresses');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const program = getProgram(connection, wallet as any);
      const rewardRate = apyToRate(parseFloat(apy));

      const stakingMintPubkey = new PublicKey(stakingMint);
      const rewardMintPubkey = new PublicKey(rewardMint);

      const [stakingPoolPDA] = getStakingPoolPDA(
        wallet.publicKey,
        stakingMintPubkey,
        rewardMintPubkey
      );

      const tx = await program.methods
        .initializePool(rewardRate)
        .accounts({
          authority: wallet.publicKey,
          stakingMint: stakingMintPubkey,
          rewardMint: rewardMintPubkey,
        })
        .rpc();

      setSuccess(`Pool initialized! TX: ${tx.slice(0, 8)}...`);
      setPoolAddress(stakingPoolPDA.toString());
      
      // Wait a bit for confirmation
      setTimeout(() => loadPoolData(), 2000);
    } catch (err: any) {
      console.error('Error initializing pool:', err);
      setError(err.message || 'Failed to initialize pool');
    } finally {
      setLoading(false);
    }
  };

  // Stake tokens
  const handleStake = async () => {
    if (!wallet.publicKey || !poolAddress) {
      setError('Please connect wallet and load pool');
      return;
    }

    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const program = getProgram(connection, wallet as any);
      const poolPubkey = new PublicKey(poolAddress);
      const pool = await program.account.stakingPool.fetch(poolPubkey);

      const [stakingVaultPDA] = getStakingVaultPDA(poolPubkey);
      const [userStakePDA] = getUserStakeAccountPDA(poolPubkey, wallet.publicKey);

      const userTokenAccount = await getAssociatedTokenAddress(
        pool.stakingMint as PublicKey,
        wallet.publicKey
      );

      const amount = new BN(parseTokenAmount(stakeAmount));

      const tx = await program.methods
        .stakeToken(amount)
        .accounts({
          user: wallet.publicKey,
          stakingPool: poolPubkey,
          stakingVault: stakingVaultPDA,
          userTokenAccount: userTokenAccount,
          userStakeAccount: userStakePDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setSuccess(`Staked ${stakeAmount} tokens! TX: ${tx.slice(0, 8)}...`);
      setStakeAmount('');
      
      // Reload data
      setTimeout(() => loadPoolData(), 2000);
    } catch (err: any) {
      console.error('Error staking:', err);
      setError(err.message || 'Failed to stake tokens');
    } finally {
      setLoading(false);
    }
  };

  // Unstake tokens
  const handleUnstake = async () => {
    if (!wallet.publicKey || !poolAddress) {
      setError('Please connect wallet and load pool');
      return;
    }

    if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const program = getProgram(connection, wallet as any);
      const poolPubkey = new PublicKey(poolAddress);
      const pool = await program.account.stakingPool.fetch(poolPubkey);

      const [stakingVaultPDA] = getStakingVaultPDA(poolPubkey);
      const [userStakePDA] = getUserStakeAccountPDA(poolPubkey, wallet.publicKey);

      const userTokenAccount = await getAssociatedTokenAddress(
        pool.stakingMint as PublicKey,
        wallet.publicKey
      );

      const amount = new BN(parseTokenAmount(unstakeAmount));

      const tx = await program.methods
        .unstake(amount)
        .accounts({
          user: wallet.publicKey,
          stakingPool: poolPubkey,
          stakingVault: stakingVaultPDA,
          userTokenAccount: userTokenAccount,
          userStakeAccount: userStakePDA,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      setSuccess(`Unstaked ${unstakeAmount} tokens! TX: ${tx.slice(0, 8)}...`);
      setUnstakeAmount('');
      
      // Reload data
      setTimeout(() => loadPoolData(), 2000);
    } catch (err: any) {
      console.error('Error unstaking:', err);
      setError(err.message || 'Failed to unstake tokens');
    } finally {
      setLoading(false);
    }
  };

  // Claim rewards
  const handleClaimRewards = async () => {
    if (!wallet.publicKey || !poolAddress) {
      setError('Please connect wallet and load pool');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const program = getProgram(connection, wallet as any);
      const poolPubkey = new PublicKey(poolAddress);
      const pool = await program.account.stakingPool.fetch(poolPubkey);

      const [rewardVaultPDA] = getRewardVaultPDA(poolPubkey);
      const [userStakePDA] = getUserStakeAccountPDA(poolPubkey, wallet.publicKey);

      const userRewardAccount = await getAssociatedTokenAddress(
        pool.rewardMint as PublicKey,
        wallet.publicKey
      );

      const tx = await program.methods
        .claimRewards()
        .accounts({
          user: wallet.publicKey,
          stakingPool: poolPubkey,
          rewardVault: rewardVaultPDA,
          userRewardAccount: userRewardAccount,
          userStakeAccount: userStakePDA,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      setSuccess(`Rewards claimed! TX: ${tx.slice(0, 8)}...`);
      
      // Reload data
      setTimeout(() => loadPoolData(), 2000);
    } catch (err: any) {
      console.error('Error claiming rewards:', err);
      setError(err.message || 'Failed to claim rewards');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">🏦 Solana Staking</h1>
          <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-200">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Initialize Pool */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">🚀 Initialize Pool</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Staking Mint Address
                </label>
                <input
                  type="text"
                  value={stakingMint}
                  onChange={(e) => setStakingMint(e.target.value)}
                  placeholder="Enter staking token mint address"
                  className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Reward Mint Address
                </label>
                <input
                  type="text"
                  value={rewardMint}
                  onChange={(e) => setRewardMint(e.target.value)}
                  placeholder="Enter reward token mint address"
                  className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  APY (%)
                </label>
                <input
                  type="number"
                  value={apy}
                  onChange={(e) => setApy(e.target.value)}
                  placeholder="10"
                  className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                onClick={handleInitializePool}
                disabled={loading || !wallet.publicKey}
                className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
              >
                {loading ? 'Initializing...' : 'Initialize Pool'}
              </button>
            </div>
          </div>

          {/* Load Pool */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">📊 Load Pool</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Pool Address
                </label>
                <input
                  type="text"
                  value={poolAddress}
                  onChange={(e) => setPoolAddress(e.target.value)}
                  placeholder="Enter pool address"
                  className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                onClick={loadPoolData}
                disabled={loading || !wallet.publicKey || !poolAddress}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
              >
                {loading ? 'Loading...' : 'Load Pool Data'}
              </button>

              {poolData && (
                <div className="mt-4 space-y-2 text-sm">
                  <div className="p-3 bg-white/5 rounded-lg">
                    <div className="text-gray-300">Total Staked</div>
                    <div className="text-2xl font-bold text-white">
                      {formatTokenAmount(poolData.totalStaked.toNumber())}
                    </div>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg">
                    <div className="text-gray-300">APY</div>
                    <div className="text-2xl font-bold text-green-400">
                      {poolData.apy.toFixed(2)}%
                    </div>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg text-gray-300 text-xs overflow-hidden">
                    <div>Authority: {poolData.authority.slice(0, 8)}...</div>
                    <div>Staking Mint: {poolData.stakingMint.slice(0, 8)}...</div>
                    <div>Reward Mint: {poolData.rewardMint.slice(0, 8)}...</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* User Stake Info */}
          {poolData && (
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-4">👤 Your Stake</h2>
              {userStakeData ? (
                <div className="space-y-3">
                  <div className="p-4 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg border border-purple-500/30">
                    <div className="text-sm text-gray-300">Deposited Amount</div>
                    <div className="text-3xl font-bold text-white">
                      {formatTokenAmount(userStakeData.depositedAmount.toNumber())}
                    </div>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg border border-green-500/30">
                    <div className="text-sm text-gray-300">Accumulated Rewards</div>
                    <div className="text-3xl font-bold text-green-400">
                      {formatTokenAmount(userStakeData.accumulatedRewards.toNumber())}
                    </div>
                  </div>
                  <button
                    onClick={handleClaimRewards}
                    disabled={loading || userStakeData.accumulatedRewards.toNumber() === 0}
                    className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    {loading ? 'Claiming...' : 'Claim Rewards'}
                  </button>
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  No stake found. Start by staking some tokens!
                </div>
              )}
            </div>
          )}

          {/* Stake & Unstake */}
          {poolData && (
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-4">💰 Stake / Unstake</h2>
              <div className="space-y-6">
                {/* Stake */}
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Stake Amount
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      placeholder="0.0"
                      className="flex-1 px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={handleStake}
                      disabled={loading || !stakeAmount}
                      className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                    >
                      Stake
                    </button>
                  </div>
                </div>

                {/* Unstake */}
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Unstake Amount
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={unstakeAmount}
                      onChange={(e) => setUnstakeAmount(e.target.value)}
                      placeholder="0.0"
                      className="flex-1 px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleUnstake}
                      disabled={loading || !unstakeAmount}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                    >
                      Unstake
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>Network: Devnet</p>
        </div>
      </div>
    </div>
  );
}

