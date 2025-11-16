import * as dotenv from "dotenv";

// Load environment variables if .env file exists (optional)
try {
  dotenv.config();
} catch (error) {
  // .env file is optional
}

import { PublicKey, Connection, TransactionInstruction, SystemProgram, Transaction, Keypair, sendAndConfirmTransaction, ComputeBudgetProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import * as crypto from "crypto";
import bs58 from "bs58";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createBurnInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// Default configuration - can be overridden via environment variables or function parameters
const DEFAULT_SOLANA_RPC_URL = process.env.SOLANA_RPC_ENDPOINT || "https://api.mainnet-beta.solana.com";
const DEFAULT_PUMPFUN_PROGRAM_ID = process.env.PUMPFUN_PROGRAM_ID || "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const DEFAULT_PRIORITY_FEE_MICROLAMPORTS = 50000;
const MIN_BALANCE_BUFFER = 5000;

const PUMPFUN_PROGRAM_ID = new PublicKey(DEFAULT_PUMPFUN_PROGRAM_ID);


function deriveBondingCurvePDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("bonding-curve"),
      mint.toBuffer(),
    ],
    PUMPFUN_PROGRAM_ID
  );
}

function deriveGlobalPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    PUMPFUN_PROGRAM_ID
  );
}

function deriveGlobalVolumeAccumulatorPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("global_volume_accumulator")],
    PUMPFUN_PROGRAM_ID
  );
}

function deriveCreatorVaultPDA(creator: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("creator-vault"), creator.toBuffer()],
    PUMPFUN_PROGRAM_ID
  );
}

function deriveUserVolumeAccumulatorPDA(user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_volume_accumulator"), user.toBuffer()],
    PUMPFUN_PROGRAM_ID
  );
}

function deriveFeeConfigPDA(): [PublicKey, number] {
  const PUMP_FEE_PROGRAM = new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");
  return PublicKey.findProgramAddressSync(
    [Buffer.from("fee_config"), PUMPFUN_PROGRAM_ID.toBuffer()],
    PUMP_FEE_PROGRAM
  );
}

function deriveEventAuthorityPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    PUMPFUN_PROGRAM_ID
  );
}

function getProgramPDA(): PublicKey {
  return PUMPFUN_PROGRAM_ID;
}

export interface GlobalState {
  initialized: boolean;
  authority: PublicKey;
  feeRecipient: PublicKey;
  initialVirtualTokenReserves: BN;
  initialVirtualSolReserves: BN;
  initialRealTokenReserves: BN;
  tokenTotalSupply: BN;
  feeBasisPoints: BN;
}

export interface BondingCurve {
  virtualTokenReserves: BN;
  virtualSolReserves: BN;
  realTokenReserves: BN;
  realSolReserves: BN;
  tokenTotalSupply: BN;
  complete: boolean;
  creator: PublicKey;
}

async function fetchGlobalState(
  connection: Connection
): Promise<GlobalState | null> {
  const [globalPDA] = deriveGlobalPDA();
  const accountInfo = await connection.getAccountInfo(globalPDA);

  if (!accountInfo || !accountInfo.data) {
    return null;
  }

  const data = accountInfo.data;
  let offset = 0;

  offset += 8;

  const initialized = data[offset] === 1;
  offset += 1;

  const authority = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const feeRecipient = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const initialVirtualTokenReserves = new BN(data.subarray(offset, offset + 8), "le");
  offset += 8;

  const initialVirtualSolReserves = new BN(data.subarray(offset, offset + 8), "le");
  offset += 8;

  const initialRealTokenReserves = new BN(data.subarray(offset, offset + 8), "le");
  offset += 8;

  const tokenTotalSupply = new BN(data.subarray(offset, offset + 8), "le");
  offset += 8;

  const feeBasisPoints = new BN(data.subarray(offset, offset + 8), "le");

  return {
    initialized,
    authority,
    feeRecipient,
    initialVirtualTokenReserves,
    initialVirtualSolReserves,
    initialRealTokenReserves,
    tokenTotalSupply,
    feeBasisPoints,
  };
}

async function fetchBondingCurve(
  connection: Connection,
  mint: PublicKey
): Promise<BondingCurve | null> {
  const [bondingCurvePDA] = deriveBondingCurvePDA(mint);
  let accountInfo = await connection.getAccountInfo(bondingCurvePDA, "finalized");
  if (!accountInfo) {
    accountInfo = await connection.getAccountInfo(bondingCurvePDA, "confirmed");
  }

  if (!accountInfo || !accountInfo.data) {
    return null;
  }

  const data = accountInfo.data;
  let offset = 0;

  offset += 8;

  const virtualTokenReserves = new BN(data.subarray(offset, offset + 8), "le");
  offset += 8;

  const virtualSolReserves = new BN(data.subarray(offset, offset + 8), "le");
  offset += 8;

  const realTokenReserves = new BN(data.subarray(offset, offset + 8), "le");
  offset += 8;

  const realSolReserves = new BN(data.subarray(offset, offset + 8), "le");
  offset += 8;

  const tokenTotalSupply = new BN(data.subarray(offset, offset + 8), "le");
  offset += 8;

  const complete = data[offset] === 1;
  offset += 1;

  const creator = new PublicKey(data.subarray(offset, offset + 32));

  return {
    virtualTokenReserves,
    virtualSolReserves,
    realTokenReserves,
    realSolReserves,
    tokenTotalSupply,
    complete,
    creator,
  };
}

async function getUserAssociatedTokenAddress(
  mint: PublicKey,
  user: PublicKey,
  tokenProgramId: PublicKey = TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  return getAssociatedTokenAddress(mint, user, false, tokenProgramId);
}

async function getBondingCurveAssociatedTokenAddress(
  mint: PublicKey,
  bondingCurve: PublicKey,
  tokenProgramId: PublicKey = TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  return getAssociatedTokenAddress(mint, bondingCurve, true, tokenProgramId);
}

async function userTokenAccountExists(
  connection: Connection,
  mint: PublicKey,
  user: PublicKey,
  tokenProgramId: PublicKey = TOKEN_PROGRAM_ID
): Promise<boolean> {
  const ata = await getUserAssociatedTokenAddress(mint, user, tokenProgramId);
  const accountInfo = await connection.getAccountInfo(ata);
  return accountInfo !== null;
}

async function createUserTokenAccountIfNeeded(
  connection: Connection,
  mint: PublicKey,
  user: PublicKey
): Promise<ReturnType<typeof createAssociatedTokenAccountInstruction> | null> {
  // Verify mint account exists and get its program ID
  const mintInfo = await connection.getAccountInfo(mint);
  if (!mintInfo) {
    throw new Error("Mint account does not exist");
  }
  
  // Use the mint's owner program ID (should be TOKEN_PROGRAM_ID for standard tokens)
  const tokenProgramId = mintInfo.owner;
  
  const exists = await userTokenAccountExists(connection, mint, user, tokenProgramId);
  if (exists) {
    return null;
  }
  
  const ata = await getUserAssociatedTokenAddress(mint, user, tokenProgramId);
  return createAssociatedTokenAccountInstruction(
    user,
    ata,
    user,
    mint,
    tokenProgramId
  );
}

function getInstructionDiscriminator(name: string): Buffer {
  const seed = `global:${name}`;
  const hash = crypto.createHash("sha256").update(seed).digest();
  return hash.subarray(0, 8);
}

function calculateTokensOut(bondingCurve: BondingCurve, solIn: BN, feeBasisPoints: BN): BN {
  const fee = solIn.mul(feeBasisPoints).div(new BN(10000));
  const solInAfterFee = solIn.sub(fee);
  
  const virtualSolReserves = bondingCurve.virtualSolReserves;
  const virtualTokenReserves = bondingCurve.virtualTokenReserves;
  
  const newVirtualSolReserves = virtualSolReserves.add(solInAfterFee);
  const newVirtualTokenReserves = virtualSolReserves.mul(virtualTokenReserves).div(newVirtualSolReserves);
  const tokensOut = virtualTokenReserves.sub(newVirtualTokenReserves);
  
  return tokensOut;
}

async function buildBuyInstruction(params: {
  mint: PublicKey;
  user: PublicKey;
  amount: BN;
  maxSolCost: BN;
  globalState: GlobalState;
  bondingCurve: BondingCurve;
  connection: Connection;
}): Promise<TransactionInstruction> {
  const { mint, user, amount, maxSolCost, globalState, bondingCurve, connection } = params;

  const [globalPDA] = deriveGlobalPDA();
  const [bondingCurvePDA] = deriveBondingCurvePDA(mint);
  const [eventAuthorityPDA] = deriveEventAuthorityPDA();
  const [globalVolumeAccumulatorPDA] = deriveGlobalVolumeAccumulatorPDA();
  const [userVolumeAccumulatorPDA] = deriveUserVolumeAccumulatorPDA(user);
  const [creatorVaultPDA] = deriveCreatorVaultPDA(bondingCurve.creator);
  const [feeConfigPDA] = deriveFeeConfigPDA();
  const PUMP_FEE_PROGRAM = new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");

  // Get the mint's token program ID
  const mintInfo = await connection.getAccountInfo(mint);
  if (!mintInfo) {
    throw new Error("Mint account does not exist");
  }
  const tokenProgramId = mintInfo.owner;

  const userATA = await getUserAssociatedTokenAddress(mint, user, tokenProgramId);
  const bondingCurveATA = await getBondingCurveAssociatedTokenAddress(mint, bondingCurvePDA, tokenProgramId);

  const discriminator = getInstructionDiscriminator("buy");

  const amountBuffer = Buffer.allocUnsafe(8);
  amountBuffer.writeBigUInt64LE(BigInt(amount.toString()), 0);

  const maxSolCostBuffer = Buffer.allocUnsafe(8);
  maxSolCostBuffer.writeBigUInt64LE(BigInt(maxSolCost.toString()), 0);

  const instructionData = Buffer.concat([
    discriminator,
    amountBuffer,
    maxSolCostBuffer,
  ]);

  return new TransactionInstruction({
    programId: PUMPFUN_PROGRAM_ID,
    keys: [
      { pubkey: globalPDA, isSigner: false, isWritable: false },
      { pubkey: globalState.feeRecipient, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bondingCurvePDA, isSigner: false, isWritable: true },
      { pubkey: bondingCurveATA, isSigner: false, isWritable: true },
      { pubkey: userATA, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: tokenProgramId, isSigner: false, isWritable: false },
      { pubkey: creatorVaultPDA, isSigner: false, isWritable: true },
      { pubkey: eventAuthorityPDA, isSigner: false, isWritable: false },
      { pubkey: PUMPFUN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: globalVolumeAccumulatorPDA, isSigner: false, isWritable: true },
      { pubkey: userVolumeAccumulatorPDA, isSigner: false, isWritable: true },
      { pubkey: feeConfigPDA, isSigner: false, isWritable: false },
      { pubkey: PUMP_FEE_PROGRAM, isSigner: false, isWritable: false },
    ],
    data: instructionData,
  });
}

function loadWallet(privateKeyBase58: string): Keypair {
  try {
    const privateKeyBytes = Buffer.from(bs58.decode(privateKeyBase58));
    return Keypair.fromSecretKey(privateKeyBytes);
  } catch (error) {
    throw new Error(`Invalid private key format: ${error}`);
  }
}

export async function buyToken(params: {
  mintAddress: string | PublicKey;
  solAmount: number;
  slippagePercent?: number;
  privateKey?: string;
  rpcUrl?: string;
}): Promise<{ signature: string; tokenAmount: string; solSpent: number }> {
  const {
    mintAddress,
    solAmount,
    slippagePercent = 1,
    privateKey,
    rpcUrl
  } = params;

  const log = (msg: string) => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

  const mint = typeof mintAddress === 'string' ? new PublicKey(mintAddress) : mintAddress;
  const connection = new Connection(rpcUrl ?? DEFAULT_SOLANA_RPC_URL, "confirmed");
  
  const walletPrivateKey = privateKey || process.env.SOLANA_PRIVATE_KEY;
  if (!walletPrivateKey) {
    throw new Error("Private key is required. Provide it as parameter or set SOLANA_PRIVATE_KEY env variable");
  }

  const wallet = loadWallet(walletPrivateKey);
  log(`Wallet: ${wallet.publicKey.toBase58()}`);

  log("Fetching bonding curve...");
  const globalState = await fetchGlobalState(connection);
  if (!globalState) {
    throw new Error("Global state not found");
  }

  const bondingCurveData = await fetchBondingCurve(connection, mint);
  if (!bondingCurveData) {
    throw new Error("Bonding curve not found");
  }

  if (bondingCurveData.complete) {
    throw new Error("Bonding curve is complete - token has graduated");
  }

  const solAmountLamports = Math.floor(solAmount * 1e9);
  const solAmountBN = new BN(solAmountLamports);
  const maxSolCost = new BN(Math.floor(solAmountLamports * (1 + slippagePercent / 100)));

  const tokenAmount = calculateTokensOut(bondingCurveData, solAmountBN, globalState.feeBasisPoints);
  log(`Buying ${tokenAmount.toString()} tokens for ${solAmount} SOL (${slippagePercent}% slippage)`);

  const balance = await connection.getBalance(wallet.publicKey);
  if (balance < maxSolCost.toNumber() + MIN_BALANCE_BUFFER) {
    throw new Error(`Insufficient balance. Need at least ${(maxSolCost.toNumber() + MIN_BALANCE_BUFFER) / 1e9} SOL`);
  }

  log("Building transaction...");
  const transaction = new Transaction();

  transaction.add(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: DEFAULT_PRIORITY_FEE_MICROLAMPORTS,
    })
  );

  const createATAInstruction = await createUserTokenAccountIfNeeded(connection, mint, wallet.publicKey);
  if (createATAInstruction) {
    transaction.add(createATAInstruction);
  }

  const buyInstruction = await buildBuyInstruction({
    mint,
    user: wallet.publicKey,
    amount: tokenAmount,
    maxSolCost,
    globalState,
    bondingCurve: bondingCurveData,
    connection,
  });

  transaction.add(buyInstruction);

  log("Sending transaction...");
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [wallet],
    {
      commitment: "confirmed",
      skipPreflight: false,
    }
  );

  log(`✅ Success! TX: ${signature}`);

  return {
    signature,
    tokenAmount: tokenAmount.toString(),
    solSpent: solAmount
  };
}

export async function burnTokens(params: {
  mintAddress: string | PublicKey;
  tokenAmount: number; // Raw amount (with decimals already applied, e.g., 1000000 for 1 token with 6 decimals)
  privateKey?: string;
  rpcUrl?: string;
}): Promise<{ signature: string; amountBurned: number }> {
  const {
    mintAddress,
    tokenAmount,
    privateKey,
    rpcUrl
  } = params;

  const log = (msg: string) => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

  const mint = typeof mintAddress === 'string' ? new PublicKey(mintAddress) : mintAddress;
  const connection = new Connection(rpcUrl ?? DEFAULT_SOLANA_RPC_URL, "confirmed");
  
  const walletPrivateKey = privateKey || process.env.SOLANA_PRIVATE_KEY;
  if (!walletPrivateKey) {
    throw new Error("Private key is required. Provide it as parameter or set SOLANA_PRIVATE_KEY env variable");
  }

  const wallet = loadWallet(walletPrivateKey);
  log(`Wallet: ${wallet.publicKey.toBase58()}`);

  // Get the token account address
  const tokenAccount = await getAssociatedTokenAddress(mint, wallet.publicKey);
  
  // Check if token account exists
  const tokenAccountInfo = await connection.getAccountInfo(tokenAccount);
  if (!tokenAccountInfo) {
    throw new Error("Token account does not exist. You don't have any tokens to burn.");
  }

  log(`Burning ${tokenAmount} tokens from ${tokenAccount.toBase58()}...`);

  // Build transaction
  const transaction = new Transaction();

  // Add priority fee
  transaction.add(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: DEFAULT_PRIORITY_FEE_MICROLAMPORTS,
    })
  );

  // Create burn instruction
  const burnInstruction = createBurnInstruction(
    tokenAccount,     // Token account to burn from
    mint,            // Mint
    wallet.publicKey, // Owner of the token account
    tokenAmount,     // Amount to burn
    [],              // Multi-signers (empty for single signer)
    TOKEN_PROGRAM_ID
  );

  transaction.add(burnInstruction);

  log("Sending transaction...");
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [wallet],
    {
      commitment: "confirmed",
      skipPreflight: false,
    }
  );

  log(`🔥 Success! Burned ${tokenAmount} tokens. TX: ${signature}`);

  return {
    signature,
    amountBurned: tokenAmount
  };
}

// Configuration constants (internal)
const config = {
  DEFAULT_SOLANA_RPC_URL,
  PUMPFUN_PROGRAM_ID,
  DEFAULT_PRIORITY_FEE_MICROLAMPORTS,
  MIN_BALANCE_BUFFER,
};