'use client';

import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

export const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // 🔧 Change this to switch networks:
  // 'localhost' - Local Solana validator (http://localhost:8899)
  // 'devnet' - Solana Devnet
  // 'testnet' - Solana Testnet
  // 'mainnet-beta' - Solana Mainnet
  const network = 'localhost'; // 👈 Change this!

  const endpoint = useMemo(() => {
    if (network === 'localhost') {
      return 'http://localhost:8899';
    }
    return clusterApiUrl(network as any);
  }, [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

