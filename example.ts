/**
 * Example usage of the Burn Buyer SDK
 * 
 * This file demonstrates basic usage patterns.
 * Make sure to set up your .env file before running.
 */

import { buyToken, burnTokens, fetchBondingCurve, fetchGlobalState, calculateTokensOut } from './index';
import { Connection, PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

// Example 1: Buy tokens
async function exampleBuyToken() {
  console.log('\n=== Example 1: Buy Token ===\n');
  
  try {
    const result = await buyToken({
      mintAddress: 'YOUR_TOKEN_MINT_ADDRESS_HERE',
      solAmount: 0.01, // Buy with 0.01 SOL
      slippagePercent: 2, // 2% slippage tolerance
      // privateKey and rpcUrl are optional if set in .env
    });

    console.log('✅ Purchase successful!');
    console.log(`Transaction: https://solscan.io/tx/${result.signature}`);
    console.log(`Tokens received: ${result.tokenAmount}`);
    console.log(`SOL spent: ${result.solSpent}`);
  } catch (error) {
    console.error('❌ Error buying token:', error.message);
  }
}

// Example 2: Burn tokens
async function exampleBurnTokens() {
  console.log('\n=== Example 2: Burn Tokens ===\n');
  
  try {
    const result = await burnTokens({
      mintAddress: 'YOUR_TOKEN_MINT_ADDRESS_HERE',
      tokenAmount: 1000000, // Amount to burn (with decimals)
      // privateKey and rpcUrl are optional if set in .env
    });

    console.log('✅ Burn successful!');
    console.log(`Transaction: https://solscan.io/tx/${result.signature}`);
    console.log(`Tokens burned: ${result.amountBurned}`);
  } catch (error) {
    console.error('❌ Error burning tokens:', error.message);
  }
}

// Example 3: Fetch bonding curve data
async function exampleFetchBondingCurve() {
  console.log('\n=== Example 3: Fetch Bonding Curve Data ===\n');
  
  try {
    const connection = new Connection(
      process.env.SOLANA_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com'
    );
    const mint = new PublicKey('YOUR_TOKEN_MINT_ADDRESS_HERE');
    
    const bondingCurve = await fetchBondingCurve(connection, mint);
    
    if (bondingCurve) {
      console.log('✅ Bonding curve found!');
      console.log(`Virtual Token Reserves: ${bondingCurve.virtualTokenReserves.toString()}`);
      console.log(`Virtual SOL Reserves: ${bondingCurve.virtualSolReserves.toString()}`);
      console.log(`Real Token Reserves: ${bondingCurve.realTokenReserves.toString()}`);
      console.log(`Real SOL Reserves: ${bondingCurve.realSolReserves.toString()}`);
      console.log(`Is Complete: ${bondingCurve.complete}`);
      console.log(`Creator: ${bondingCurve.creator.toBase58()}`);
    } else {
      console.log('❌ Bonding curve not found');
    }
  } catch (error) {
    console.error('❌ Error fetching bonding curve:', error.message);
  }
}

// Example 4: Calculate expected tokens
async function exampleCalculateTokens() {
  console.log('\n=== Example 4: Calculate Expected Tokens ===\n');
  
  try {
    const connection = new Connection(
      process.env.SOLANA_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com'
    );
    const mint = new PublicKey('YOUR_TOKEN_MINT_ADDRESS_HERE');
    
    const bondingCurve = await fetchBondingCurve(connection, mint);
    const globalState = await fetchGlobalState(connection);
    
    if (bondingCurve && globalState) {
      const solAmount = new BN(50_000_000); // 0.05 SOL in lamports
      const tokensOut = calculateTokensOut(
        bondingCurve,
        solAmount,
        globalState.feeBasisPoints
      );
      
      console.log('✅ Calculation complete!');
      console.log(`For ${solAmount.toNumber() / 1e9} SOL, you'll receive:`);
      console.log(`Tokens: ${tokensOut.toString()}`);
      console.log(`Fee (basis points): ${globalState.feeBasisPoints.toString()}`);
    } else {
      console.log('❌ Could not fetch required data');
    }
  } catch (error) {
    console.error('❌ Error calculating tokens:', error.message);
  }
}

// Example 5: Check global state
async function exampleFetchGlobalState() {
  console.log('\n=== Example 5: Fetch Global State ===\n');
  
  try {
    const connection = new Connection(
      process.env.SOLANA_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com'
    );
    
    const globalState = await fetchGlobalState(connection);
    
    if (globalState) {
      console.log('✅ Global state found!');
      console.log(`Initialized: ${globalState.initialized}`);
      console.log(`Authority: ${globalState.authority.toBase58()}`);
      console.log(`Fee Recipient: ${globalState.feeRecipient.toBase58()}`);
      console.log(`Fee Basis Points: ${globalState.feeBasisPoints.toString()}`);
      console.log(`Token Total Supply: ${globalState.tokenTotalSupply.toString()}`);
    } else {
      console.log('❌ Global state not found');
    }
  } catch (error) {
    console.error('❌ Error fetching global state:', error.message);
  }
}

// Run examples
async function main() {
  console.log('🚀 Burn Buyer SDK Examples\n');
  console.log('⚠️  Make sure to:');
  console.log('1. Copy .env.example to .env');
  console.log('2. Fill in your SOLANA_PRIVATE_KEY and SOLANA_RPC_ENDPOINT');
  console.log('3. Replace YOUR_TOKEN_MINT_ADDRESS_HERE with actual token addresses\n');
  
  // Uncomment the examples you want to run:
  
  // await exampleBuyToken();
  // await exampleBurnTokens();
  // await exampleFetchBondingCurve();
  // await exampleCalculateTokens();
  await exampleFetchGlobalState();
  
  console.log('\n✨ Done!\n');
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

