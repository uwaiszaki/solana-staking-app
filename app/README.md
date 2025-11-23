# Solana Staking dApp

A beautiful Next.js web application for interacting with the Solana staking program.

## Features

- 🚀 **Initialize Pool** - Create a new staking pool with custom APY
- 📊 **View Pool Stats** - Check total staked amount and current APY
- 💰 **Stake Tokens** - Stake your tokens to start earning rewards
- 🏦 **Unstake Tokens** - Withdraw your staked tokens anytime
- 🎁 **Claim Rewards** - Collect your accumulated rewards
- 👤 **View Your Stake** - Monitor your deposited amount and rewards

## Prerequisites

- Node.js 18+
- Phantom Wallet (or any Solana wallet)
- SOL on Devnet for transaction fees
- Staking and reward token mints created on Devnet

## Installation

```bash
cd app
npm install
```

## Running the App

```bash
npm run dev
```

Visit `http://localhost:3000`

## Usage

### 1. Connect Wallet
Click "Select Wallet" button in the top right to connect your Phantom wallet.

### 2. Initialize a Pool (One Time Setup)
- Enter the staking token mint address
- Enter the reward token mint address
- Set the desired APY (e.g., 10 for 10%)
- Click "Initialize Pool"
- Copy the pool address that appears

### 3. Load Pool Data
- Paste the pool address in the "Load Pool" section
- Click "Load Pool Data"
- View total staked amount and APY

### 4. Stake Tokens
- Enter the amount you want to stake
- Click "Stake"
- Confirm the transaction in your wallet

### 5. View Your Stake
- After staking, you'll see your deposited amount
- Watch your accumulated rewards grow over time

### 6. Claim Rewards
- Click "Claim Rewards" to collect your earned tokens
- Rewards are transferred to your wallet

### 7. Unstake Tokens
- Enter the amount you want to unstake
- Click "Unstake"
- Your tokens are returned to your wallet

## Important Notes

- **Network**: Currently configured for Solana Devnet
- **Token Accounts**: Make sure you have created associated token accounts for both staking and reward tokens
- **Funding**: The reward vault needs to be funded with reward tokens before users can claim
- **Decimals**: All amounts are displayed with 4 decimal places (9 decimals internally)

## Creating Test Tokens

To create test tokens on Devnet:

```bash
# Create staking token
spl-token create-token --decimals 9

# Create reward token
spl-token create-token --decimals 9

# Create token accounts
spl-token create-account <TOKEN_MINT>

# Mint tokens to your account
spl-token mint <TOKEN_MINT> 1000
```

## Funding the Reward Vault

After initializing a pool, fund the reward vault:

```bash
# Get the reward vault address (shown in pool data)
spl-token transfer <REWARD_TOKEN_MINT> <AMOUNT> <REWARD_VAULT_ADDRESS>
```

## Tech Stack

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Solana Wallet Adapter** - Wallet integration
- **Anchor** - Solana program framework
- **@solana/web3.js** - Solana JavaScript API

## Project Structure

```
app/
├── app/
│   ├── layout.tsx         # Root layout
│   ├── page.tsx          # Main page
│   └── globals.css       # Global styles
├── components/
│   ├── WalletContextProvider.tsx  # Wallet setup
│   └── StakingInterface.tsx       # Main UI component
├── lib/
│   ├── program.ts              # Program utilities
│   ├── staking_program.json    # IDL
│   └── staking_program.ts      # TypeScript types
└── next.config.js          # Next.js config
```

## Troubleshooting

### "Wallet not connected"
Make sure you've clicked the wallet button and approved the connection.

### "Failed to fetch pool"
Verify the pool address is correct and the pool has been initialized.

### "Insufficient balance"
Ensure you have enough tokens and SOL for transaction fees.

### "No rewards to claim"
Wait some time after staking, or stake more tokens to accumulate rewards.

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## License

MIT
