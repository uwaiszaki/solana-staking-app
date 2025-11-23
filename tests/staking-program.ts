import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { StakingProgram } from "../target/types/staking_program";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";

describe("staking-program", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.StakingProgram as Program<StakingProgram>;
  const provider = anchor.AnchorProvider.env();

  const payer = provider.wallet.payer;
  const authority = provider.wallet.publicKey;

  let stakingPool: anchor.web3.PublicKey;
  let stakingMint: anchor.web3.PublicKey;
  let stakingVault: anchor.web3.PublicKey;
  let rewardMint: anchor.web3.PublicKey;
  let rewardVault: anchor.web3.PublicKey;

  // Helper function to convert APY to rate
  function apyToRate(apyPercent: number): BN {
    const SECONDS_PER_YEAR = 31_557_600; // 365.25 days
    const SCALE_FACTOR = 1_000_000_000;
    const apyDecimal = apyPercent / 100;
    const perSecondRate = apyDecimal / SECONDS_PER_YEAR;
    const scaledRate = Math.floor(perSecondRate * SCALE_FACTOR);
    return new BN(scaledRate);
  }

  // Helper to wait for some time (for reward accumulation)
  async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  before(async () => {
    // Create staking and reward mints (9 decimals like SOL)
    stakingMint = await createMint(
      provider.connection,
      payer,
      authority,
      authority,
      9
    );

    rewardMint = await createMint(
      provider.connection,
      payer,
      authority,
      authority,
      9
    );

    // Derive PDAs
    [stakingPool] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("staking_pool"),
        authority.toBuffer(),
        stakingMint.toBuffer(),
        rewardMint.toBuffer(),
      ],
      program.programId
    );

    [stakingVault] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("staking_vault"), stakingPool.toBuffer()],
      program.programId
    );

    [rewardVault] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("reward_vault"), stakingPool.toBuffer()],
      program.programId
    );
  });

  it("Initializes the staking pool with 10% APY", async () => {
    const rewardRate = apyToRate(10); // 10% APY

    const tx = await program.methods
      .initializePool(rewardRate)
      .accounts({
        authority: authority,
        stakingMint: stakingMint,
        rewardMint: rewardMint,
      })
      .rpc();

    console.log("Initialize pool transaction:", tx);

    // Fetch and verify pool account
    const poolAccount = await program.account.stakingPool.fetch(stakingPool);

    assert.ok(
      poolAccount.authority.equals(authority),
      "Authority should match"
    );
    assert.ok(
      poolAccount.stakingMint.equals(stakingMint),
      "Staking mint should match"
    );
    assert.ok(
      poolAccount.rewardMint.equals(rewardMint),
      "Reward mint should match"
    );
    assert.ok(
      poolAccount.rewardRate.eq(rewardRate),
      "Reward rate should be set correctly"
    );
    assert.equal(
      poolAccount.totalStaked.toNumber(),
      0,
      "Total staked should be 0 initially"
    );

    // Verify vaults exist
    const stakingVaultAccount = await provider.connection.getAccountInfo(
      stakingVault
    );
    const rewardVaultAccount = await provider.connection.getAccountInfo(
      rewardVault
    );

    assert.ok(stakingVaultAccount, "Staking vault should exist");
    assert.ok(rewardVaultAccount, "Reward vault should exist");

    console.log("✓ Pool initialized successfully");
  });

  describe("Staking and Rewards", () => {
    let user: anchor.web3.Keypair;
    let userTokenAccount: anchor.web3.PublicKey;
    let userRewardAccount: anchor.web3.PublicKey;
    let userStakeAccount: anchor.web3.PublicKey;

    const INITIAL_MINT_AMOUNT = 1000 * 1e9; // 1000 tokens
    const STAKE_AMOUNT = 500 * 1e9; // 500 tokens

    before(async () => {
      // Create test user
      user = anchor.web3.Keypair.generate();

      // Airdrop SOL for transaction fees
      const airdropSig = await provider.connection.requestAirdrop(
        user.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      // Create user's staking token account and mint tokens
      userTokenAccount = await createAssociatedTokenAccount(
        provider.connection,
        payer,
        stakingMint,
        user.publicKey
      );

      await mintTo(
        provider.connection,
        payer,
        stakingMint,
        userTokenAccount,
        authority,
        INITIAL_MINT_AMOUNT
      );

      // Create user's reward token account
      userRewardAccount = await createAssociatedTokenAccount(
        provider.connection,
        payer,
        rewardMint,
        user.publicKey
      );

      // Mint some rewards to the reward vault for distribution
      await mintTo(
        provider.connection,
        payer,
        rewardMint,
        rewardVault,
        authority,
        10000 * 1e9 // 10,000 reward tokens
      );

      // Derive user stake account PDA
      [userStakeAccount] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_stake_account"),
          stakingPool.toBuffer(),
          user.publicKey.toBuffer(),
        ],
        program.programId
      );

      console.log("\n=== Test Setup ===");
      console.log("User:", user.publicKey.toString());
      console.log("User Token Account:", userTokenAccount.toString());
      console.log("User Reward Account:", userRewardAccount.toString());
      console.log("User Stake Account:", userStakeAccount.toString());
    });

    it("Stakes tokens successfully", async () => {
      const stakeAmount = new BN(STAKE_AMOUNT);

      const tx = await program.methods
        .stakeToken(stakeAmount)
        .accounts({
          user: user.publicKey,
          stakingPool: stakingPool,
          stakingVault: stakingVault,
          userTokenAccount: userTokenAccount,
          userStakeAccount: userStakeAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      console.log("\n✓ Stake transaction:", tx);

      // Verify user token account balance decreased
      const userTokenInfo = await getAccount(
        provider.connection,
        userTokenAccount
      );
      assert.equal(
        userTokenInfo.amount.toString(),
        (INITIAL_MINT_AMOUNT - STAKE_AMOUNT).toString(),
        "User token balance should decrease"
      );

      // Verify staking vault balance increased
      const vaultInfo = await getAccount(provider.connection, stakingVault);
      assert.equal(
        vaultInfo.amount.toString(),
        STAKE_AMOUNT.toString(),
        "Vault should have staked tokens"
      );

      // Verify user stake account
      const userStake = await program.account.userStake.fetch(userStakeAccount);
      assert.ok(
        userStake.owner.equals(user.publicKey),
        "Owner should be user"
      );
      assert.equal(
        userStake.depositedAmount.toNumber(),
        STAKE_AMOUNT,
        "Deposited amount should match"
      );
      assert.equal(
        userStake.accumulatedRewards.toNumber(),
        0,
        "Initial rewards should be 0"
      );

      // Verify pool total staked
      const pool = await program.account.stakingPool.fetch(stakingPool);
      assert.equal(
        pool.totalStaked.toNumber(),
        STAKE_AMOUNT,
        "Pool total staked should increase"
      );

      console.log("✓ Staked 500 tokens successfully");
      console.log(
        "  - Deposited amount:",
        userStake.depositedAmount.toNumber() / 1e9,
        "tokens"
      );
      console.log(
        "  - Accumulated rewards:",
        userStake.accumulatedRewards.toNumber(),
        "tokens"
      );
    });

    it("Fetches current deposited amount correctly", async () => {
      const userStake = await program.account.userStake.fetch(userStakeAccount);

      console.log("\n=== Fetched Stake Info ===");
      console.log(
        "Deposited Amount:",
        userStake.depositedAmount.toNumber() / 1e9,
        "tokens"
      );
      console.log(
        "Accumulated Rewards:",
        userStake.accumulatedRewards.toNumber() / 1e9,
        "tokens"
      );
      console.log(
        "Reward Checkpoint:",
        new Date(userStake.rewardCheckpoint.toNumber() * 1000).toISOString()
      );

      assert.equal(
        userStake.depositedAmount.toNumber(),
        STAKE_AMOUNT,
        "Deposited amount should be 500 tokens"
      );
    });

    it("Accumulates rewards over time", async () => {
      console.log("\n⏳ Waiting 5 seconds for rewards to accumulate...");
      await sleep(5000); // Wait 5 seconds

      // Stake more to trigger reward calculation
      const additionalStake = new BN(100 * 1e9); // 100 tokens

      await program.methods
        .stakeToken(additionalStake)
        .accounts({
          user: user.publicKey,
          stakingPool: stakingPool,
          stakingVault: stakingVault,
          userTokenAccount: userTokenAccount,
          userStakeAccount: userStakeAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      const userStake = await program.account.userStake.fetch(userStakeAccount);

      console.log("\n=== After Additional Stake ===");
      console.log(
        "Deposited Amount:",
        userStake.depositedAmount.toNumber() / 1e9,
        "tokens"
      );
      console.log(
        "Accumulated Rewards:",
        userStake.accumulatedRewards.toNumber() / 1e9,
        "tokens"
      );

      // Should have some rewards now
      assert.ok(
        userStake.accumulatedRewards.toNumber() > 0,
        "Should have accumulated some rewards"
      );
      assert.equal(
        userStake.depositedAmount.toNumber(),
        STAKE_AMOUNT + 100 * 1e9,
        "Deposited amount should be 600 tokens now"
      );

      console.log("✓ Rewards accumulated successfully");
    });

    it("Claims rewards successfully", async () => {
      // Wait a bit more for additional rewards
      console.log("\n⏳ Waiting 3 more seconds...");
      await sleep(3000);

      const userStakeBefore = await program.account.userStake.fetch(
        userStakeAccount
      );
      const rewardAccountBefore = await getAccount(
        provider.connection,
        userRewardAccount
      );

      console.log("\n=== Before Claim ===");
      console.log(
        "Accumulated Rewards:",
        userStakeBefore.accumulatedRewards.toNumber() / 1e9,
        "tokens"
      );
      console.log(
        "Reward Account Balance:",
        Number(rewardAccountBefore.amount) / 1e9,
        "tokens"
      );

      // Claim rewards
      const tx = await program.methods
        .claimRewards()
        .accounts({
          user: user.publicKey,
          stakingPool: stakingPool,
          rewardVault: rewardVault,
          userRewardAccount: userRewardAccount,
          userStakeAccount: userStakeAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      console.log("\n✓ Claim rewards transaction:", tx);

      const userStakeAfter = await program.account.userStake.fetch(
        userStakeAccount
      );
      const rewardAccountAfter = await getAccount(
        provider.connection,
        userRewardAccount
      );

      console.log("\n=== After Claim ===");
      console.log(
        "Accumulated Rewards:",
        userStakeAfter.accumulatedRewards.toNumber() / 1e9,
        "tokens"
      );
      console.log(
        "Reward Account Balance:",
        Number(rewardAccountAfter.amount) / 1e9,
        "tokens"
      );

      // Verify rewards were claimed
      assert.equal(
        userStakeAfter.accumulatedRewards.toNumber(),
        0,
        "Accumulated rewards should be reset to 0"
      );
      assert.ok(
        Number(rewardAccountAfter.amount) > Number(rewardAccountBefore.amount),
        "User should receive reward tokens"
      );

      console.log("✓ Claimed rewards successfully");
    });

    it("Unstakes tokens successfully", async () => {
      const unstakeAmount = new BN(300 * 1e9); // Unstake 300 tokens

      const userStakeBefore = await program.account.userStake.fetch(
        userStakeAccount
      );
      const userTokenBefore = await getAccount(
        provider.connection,
        userTokenAccount
      );
      const poolBefore = await program.account.stakingPool.fetch(stakingPool);

      console.log("\n=== Before Unstake ===");
      console.log(
        "Deposited Amount:",
        userStakeBefore.depositedAmount.toNumber() / 1e9,
        "tokens"
      );
      console.log(
        "User Token Balance:",
        Number(userTokenBefore.amount) / 1e9,
        "tokens"
      );
      console.log(
        "Pool Total Staked:",
        poolBefore.totalStaked.toNumber() / 1e9,
        "tokens"
      );

      const tx = await program.methods
        .unstake(unstakeAmount)
        .accounts({
          user: user.publicKey,
          stakingPool: stakingPool,
          stakingVault: stakingVault,
          userTokenAccount: userTokenAccount,
          userStakeAccount: userStakeAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      console.log("\n✓ Unstake transaction:", tx);

      const userStakeAfter = await program.account.userStake.fetch(
        userStakeAccount
      );
      const userTokenAfter = await getAccount(
        provider.connection,
        userTokenAccount
      );
      const poolAfter = await program.account.stakingPool.fetch(stakingPool);

      console.log("\n=== After Unstake ===");
      console.log(
        "Deposited Amount:",
        userStakeAfter.depositedAmount.toNumber() / 1e9,
        "tokens"
      );
      console.log(
        "User Token Balance:",
        Number(userTokenAfter.amount) / 1e9,
        "tokens"
      );
      console.log(
        "Pool Total Staked:",
        poolAfter.totalStaked.toNumber() / 1e9,
        "tokens"
      );

      // Verify unstake
      assert.equal(
        userStakeAfter.depositedAmount.toNumber(),
        userStakeBefore.depositedAmount.toNumber() - unstakeAmount.toNumber(),
        "Deposited amount should decrease"
      );
      assert.equal(
        Number(userTokenAfter.amount),
        Number(userTokenBefore.amount) + unstakeAmount.toNumber(),
        "User token balance should increase"
      );
      assert.equal(
        poolAfter.totalStaked.toNumber(),
        poolBefore.totalStaked.toNumber() - unstakeAmount.toNumber(),
        "Pool total staked should decrease"
      );

      console.log("✓ Unstaked 300 tokens successfully");
    });

    it("Shows accumulated rewards after unstake", async () => {
      const userStake = await program.account.userStake.fetch(userStakeAccount);

      console.log("\n=== Final Stake State ===");
      console.log(
        "Deposited Amount:",
        userStake.depositedAmount.toNumber() / 1e9,
        "tokens"
      );
      console.log(
        "Accumulated Rewards:",
        userStake.accumulatedRewards.toNumber() / 1e9,
        "tokens"
      );

      // Should have some rewards accumulated during unstake
      assert.ok(
        userStake.accumulatedRewards.toNumber() >= 0,
        "Should have valid rewards"
      );

      console.log("✓ Final state verified");
    });

    it("Fails to unstake more than deposited", async () => {
      const userStake = await program.account.userStake.fetch(userStakeAccount);
      const tooMuch = userStake.depositedAmount.add(new BN(1)); // 1 more than available

      try {
        await program.methods
          .unstake(tooMuch)
          .accounts({
            user: user.publicKey,
            stakingPool: stakingPool,
            stakingVault: stakingVault,
            userTokenAccount: userTokenAccount,
            userStakeAccount: userStakeAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();

        assert.fail("Should have thrown an error");
      } catch (err) {
        console.log("\n✓ Correctly rejected unstaking more than deposited");
        assert.ok(err.toString().includes("InsufficientStake"));
      }
    });
  });

  describe("Edge Cases", () => {
    let user2: anchor.web3.Keypair;
    let user2TokenAccount: anchor.web3.PublicKey;
    let user2RewardAccount: anchor.web3.PublicKey;
    let user2StakeAccount: anchor.web3.PublicKey;

    before(async () => {
      user2 = anchor.web3.Keypair.generate();

      const airdropSig = await provider.connection.requestAirdrop(
        user2.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      user2TokenAccount = await createAssociatedTokenAccount(
        provider.connection,
        payer,
        stakingMint,
        user2.publicKey
      );

      await mintTo(
        provider.connection,
        payer,
        stakingMint,
        user2TokenAccount,
        authority,
        1000 * 1e9
      );

      user2RewardAccount = await createAssociatedTokenAccount(
        provider.connection,
        payer,
        rewardMint,
        user2.publicKey
      );

      [user2StakeAccount] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_stake_account"),
          stakingPool.toBuffer(),
          user2.publicKey.toBuffer(),
        ],
        program.programId
      );
    });

    it("Fails to claim rewards when none available", async () => {
      // First stake for user2
      await program.methods
        .stakeToken(new BN(100 * 1e9))
        .accounts({
          user: user2.publicKey,
          stakingPool: stakingPool,
          stakingVault: stakingVault,
          userTokenAccount: user2TokenAccount,
          userStakeAccount: user2StakeAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user2])
        .rpc();

      // Try to claim immediately (no time elapsed)
      try {
        await program.methods
          .claimRewards()
          .accounts({
            user: user2.publicKey,
            stakingPool: stakingPool,
            rewardVault: rewardVault,
            userRewardAccount: user2RewardAccount,
            userStakeAccount: user2StakeAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user2])
          .rpc();

        assert.fail("Should have thrown an error");
      } catch (err) {
        console.log("\n✓ Correctly rejected claiming with no rewards");
        assert.ok(err.toString().includes("NoRewardsToClaim"));
      }
    });

    it("Fails to stake zero tokens", async () => {
      try {
        await program.methods
          .stakeToken(new BN(0))
          .accounts({
            user: user2.publicKey,
            stakingPool: stakingPool,
            stakingVault: stakingVault,
            userTokenAccount: user2TokenAccount,
            userStakeAccount: user2StakeAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([user2])
          .rpc();

        assert.fail("Should have thrown an error");
      } catch (err) {
        console.log("\n✓ Correctly rejected staking zero tokens");
        assert.ok(err.toString().includes("InvalidAmount"));
      }
    });
  });
});
