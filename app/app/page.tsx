'use client';

import dynamic from 'next/dynamic';

const StakingInterface = dynamic(
  () => import('./components/StakingInterface'),
  { ssr: false }
);

const PoolsList = dynamic(
  () => import('./components/PoolsList'),
  { ssr: false }
);

const WalletContextProvider = dynamic(
  () => import('./components/WalletContextProvider').then(mod => ({ default: mod.WalletContextProvider })),
  { ssr: false }
);

export default function Home() {
  return (
    <WalletContextProvider>
      <div className="space-y-8">
        {/* Pools List Section */}
        <PoolsList />
        
        {/* Staking Interface */}
        <StakingInterface />
      </div>
    </WalletContextProvider>
  );
}
