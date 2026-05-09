/**
 * GHOSTFACE — Solana SPL Token Deployment Script
 *
 * Deploys FD (Face Dollar) and CASPER tokens with on-chain metadata.
 * Run on devnet first, then mainnet-beta.
 *
 * Usage:
 *   WALLET_PRIVATE_KEY=<key> RECIPIENT_WALLET=<address> node deploy.js
 *   NETWORK=devnet WALLET_PRIVATE_KEY=<key> RECIPIENT_WALLET=<address> node deploy.js
 */

import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getMint,
  setAuthority,
  AuthorityType,
} from "@solana/spl-token";
import {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
import bs58 from "bs58";
import { config } from "./config.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadKeypair(raw) {
  if (!raw) {
    throw new Error(
      "WALLET_PRIVATE_KEY is not set.\n" +
        "Set it via the environment variable or edit config.js."
    );
  }
  try {
    // Try JSON byte array first [12,34,...]
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return Keypair.fromSecretKey(Uint8Array.from(parsed));
    }
  } catch {
    // fall through to base-58
  }
  // Base-58 string
  return Keypair.fromSecretKey(bs58.decode(raw));
}

function rawSupply(supply, decimals) {
  // BigInt to avoid precision issues with large supplies
  return BigInt(supply) * BigInt(10 ** decimals);
}

async function createTokenWithMetadata(
  connection,
  payer,
  recipientPubkey,
  tokenConfig,
  label
) {
  console.log(`\n──────────────────────────────────────────`);
  console.log(`  Deploying ${label} (${tokenConfig.symbol})`);
  console.log(`──────────────────────────────────────────`);

  // 1. Create mint account
  console.log("  [1/5] Creating mint...");
  const mintKeypair = Keypair.generate();
  const freezeAuthority = tokenConfig.freezeAuthority ? payer.publicKey : null;

  const mint = await createMint(
    connection,
    payer,
    payer.publicKey,   // mint authority
    freezeAuthority,
    tokenConfig.decimals,
    mintKeypair
  );
  console.log(`        Mint address: ${mint.toBase58()}`);

  // 2. Create associated token account for recipient
  console.log("  [2/5] Creating token account for recipient...");
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    recipientPubkey
  );
  console.log(`        Token account: ${tokenAccount.address.toBase58()}`);

  // 3. Mint initial supply
  const supply = rawSupply(tokenConfig.supply, tokenConfig.decimals);
  console.log(
    `  [3/5] Minting ${tokenConfig.supply.toLocaleString()} ${tokenConfig.symbol}...`
  );
  await mintTo(
    connection,
    payer,
    mint,
    tokenAccount.address,
    payer,
    supply
  );
  console.log("        Mint successful.");

  // 4. Attach on-chain metadata (Metaplex Token Metadata program)
  console.log("  [4/5] Attaching on-chain metadata...");
  const [metadataPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  const metadataInstruction = createCreateMetadataAccountV3Instruction(
    {
      metadata: metadataPDA,
      mint: mint,
      mintAuthority: payer.publicKey,
      payer: payer.publicKey,
      updateAuthority: payer.publicKey,
    },
    {
      createMetadataAccountArgsV3: {
        data: {
          name: tokenConfig.name,
          symbol: tokenConfig.symbol,
          uri: tokenConfig.uri,
          sellerFeeBasisPoints: 0,
          creators: null,
          collection: null,
          uses: null,
        },
        isMutable: true,
        collectionDetails: null,
      },
    }
  );

  const { Transaction, sendAndConfirmTransaction } = await import(
    "@solana/web3.js"
  );
  const metadataTx = new Transaction().add(metadataInstruction);
  await sendAndConfirmTransaction(connection, metadataTx, [payer]);
  console.log("        Metadata attached.");

  // 5. Optionally revoke mint authority so supply is fixed
  const revokeMint = false; // set true to make supply immutable after deploy
  if (revokeMint) {
    console.log("  [5/5] Revoking mint authority (supply now fixed)...");
    await setAuthority(
      connection,
      payer,
      mint,
      payer,
      AuthorityType.MintTokens,
      null
    );
    console.log("        Mint authority revoked.");
  } else {
    console.log("  [5/5] Keeping mint authority (you can mint more later).");
  }

  // Verify
  const mintInfo = await getMint(connection, mint);
  console.log(`\n  ✅ ${label} deployed successfully`);
  console.log(`     Mint:     ${mint.toBase58()}`);
  console.log(`     Supply:   ${mintInfo.supply} raw units`);
  console.log(`     Decimals: ${mintInfo.decimals}`);

  return mint.toBase58();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  GHOSTFACE Token Deployment              ║`);
  console.log(`║  Network: ${config.NETWORK.padEnd(31)}║`);
  console.log(`╚══════════════════════════════════════════╝`);

  // Load wallet
  const payer = loadKeypair(config.WALLET_PRIVATE_KEY);
  console.log(`\nWallet:    ${payer.publicKey.toBase58()}`);

  // Recipient
  if (!config.RECIPIENT_WALLET) {
    throw new Error(
      "RECIPIENT_WALLET is not set.\n" +
        "Set it via the environment variable or edit config.js."
    );
  }
  const recipientPubkey = new PublicKey(config.RECIPIENT_WALLET);
  console.log(`Recipient: ${recipientPubkey.toBase58()}`);

  // Connection
  const rpcUrl =
    config.NETWORK === "mainnet-beta"
      ? clusterApiUrl("mainnet-beta")
      : clusterApiUrl("devnet");
  const connection = new Connection(rpcUrl, "confirmed");

  // Balance check
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`Balance:   ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  const minSol = 0.05;
  if (balance < minSol * LAMPORTS_PER_SOL) {
    if (config.NETWORK === "devnet") {
      console.log(
        `\n⚠  Low balance. Get free devnet SOL at https://faucet.solana.com`
      );
      console.log(`   Then re-run this script.`);
      process.exit(1);
    } else {
      throw new Error(
        `Insufficient SOL balance (${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL).\n` +
          `You need at least ${minSol} SOL to cover transaction fees.`
      );
    }
  }

  // Deploy tokens
  const fdMint = await createTokenWithMetadata(
    connection,
    payer,
    recipientPubkey,
    config.FD,
    "Face Dollar"
  );

  const casperMint = await createTokenWithMetadata(
    connection,
    payer,
    recipientPubkey,
    config.CASPER,
    "Casper"
  );

  // Final summary
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  DEPLOYMENT COMPLETE                     ║`);
  console.log(`╚══════════════════════════════════════════╝`);
  console.log(`\n  FD (Face Dollar) mint address:`);
  console.log(`    ${fdMint}`);
  console.log(`\n  CASPER mint address:`);
  console.log(`    ${casperMint}`);
  console.log(
    `\n  ➜ Share these two addresses to wire them into the GHOSTFACE app.\n`
  );
}

main().catch((err) => {
  console.error("\n❌ Deployment failed:", err.message || err);
  process.exit(1);
});
