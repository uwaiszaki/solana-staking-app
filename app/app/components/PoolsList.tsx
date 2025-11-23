'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getProgram, rateToAPY, formatTokenAmount } from '../lib/program';

interface PoolInfo {
  address: string;
  authority: string;
  stakingMint: string;
  rewardMint: string;
  totalStaked: string;
  apy: number;
  // Optional metadata
  name?: string;
  imageUrl?: string;
  description?: string;
}

export default function PoolsList() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [allPools, setAllPools] = useState<PoolInfo[]>([]);
  const [myPools, setMyPools] = useState<PoolInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');

  // Fetch all pools
  const fetchPools = async () => {
    if (!wallet.publicKey) return;

    setLoading(true);
    try {
      const program = getProgram(connection, wallet as any);
      
      // Get all pools
      const pools = await program.account.stakingPool.all();
      
      const poolsData: PoolInfo[] = pools.map((pool) => ({
        address: pool.publicKey.toString(),
        authority: pool.account.authority.toString(),
        stakingMint: pool.account.stakingMint.toString(),
        rewardMint: pool.account.rewardMint.toString(),
        totalStaked: formatTokenAmount(pool.account.totalStaked.toNumber()),
        apy: rateToAPY(pool.account.rewardRate),
      }));

      setAllPools(poolsData);

      // Filter user's pools
      const userPools = poolsData.filter(
        (pool) => pool.authority === wallet.publicKey!.toString()
      );
      setMyPools(userPools);
    } catch (err) {
      console.error('Error fetching pools:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (wallet.publicKey) {
      fetchPools();
    }
  }, [wallet.publicKey]);

  const displayPools = filter === 'all' ? allPools : myPools;

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">🏊 Staking Pools</h2>
        
        {/* Filter Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            All Pools ({allPools.length})
          </button>
          <button
            onClick={() => setFilter('mine')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filter === 'mine'
                ? 'bg-purple-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            My Pools ({myPools.length})
          </button>
        </div>
      </div>

      {/* Refresh Button */}
      <button
        onClick={fetchPools}
        disabled={loading || !wallet.publicKey}
        className="mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
      >
        {loading ? 'Loading...' : '🔄 Refresh'}
      </button>

      {/* Pools Grid */}
      {displayPools.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          {loading ? 'Loading pools...' : 'No pools found'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayPools.map((pool) => (
            <div
              key={pool.address}
              className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg p-4 border border-purple-500/30 hover:border-purple-500/50 transition-all cursor-pointer"
              onClick={() => {
                // Copy pool address to clipboard
                navigator.clipboard.writeText(pool.address);
                alert('Pool address copied!');
              }}
            >
              {/* Pool Name/Address */}
              <div className="mb-3">
                <h3 className="text-lg font-bold text-white truncate">
                  {pool.name || `Pool ${pool.address.slice(0, 8)}...`}
                </h3>
                <p className="text-xs text-gray-400 truncate">
                  {pool.address}
                </p>
              </div>

              {/* Stats */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-300">APY:</span>
                  <span className="text-sm font-bold text-green-400">
                    {pool.apy.toFixed(2)}%
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-300">Total Staked:</span>
                  <span className="text-sm font-bold text-white">
                    {pool.totalStaked}
                  </span>
                </div>

                {pool.authority === wallet.publicKey?.toString() && (
                  <div className="mt-2 px-2 py-1 bg-purple-600/30 rounded text-xs text-purple-200 text-center">
                    👑 Your Pool
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Load this pool in the staking interface
                  window.location.href = `/?pool=${pool.address}`;
                }}
                className="mt-4 w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
              >
                View Pool
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

