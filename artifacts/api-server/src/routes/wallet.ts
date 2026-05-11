import { Router, type IRouter } from "express";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { logger } from "../lib/logger";
import { toErrorMessage } from "../utils/error";

const router: IRouter = Router();

const SOLANA_RPC = process.env.SOLANA_RPC_URL ?? clusterApiUrl("mainnet-beta");

function getDeployerKeypair(): Keypair | null {
  const raw = process.env.SOLANA_DEPLOYER_KEY;
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  } catch {
    return null;
  }
}

// GET /api/wallet/deployer — returns the deployer public key + SOL balance
router.get("/wallet/deployer", async (_req, res) => {
  const kp = getDeployerKeypair();
  if (!kp) {
    return res.status(200).json({
      configured: false,
      message:
        "Set SOLANA_DEPLOYER_KEY env var (JSON array of 64 bytes) to enable token deployment.",
    });
  }
  try {
    const connection = new Connection(SOLANA_RPC, "confirmed");
    const lamports = await connection.getBalance(kp.publicKey);
    return res.json({
      configured: true,
      publicKey: kp.publicKey.toBase58(),
      solBalance: lamports / LAMPORTS_PER_SOL,
    });
  } catch (err) {
    return res.json({
      configured: true,
      publicKey: kp.publicKey.toBase58(),
      solBalance: null,
      rpcError: toErrorMessage(err),
    });
  }
});

// POST /api/wallet/deploy-token — deploy a new SPL token mint on Solana
// Body: { name, symbol, decimals?, supply?, mintAuthority? }
router.post("/wallet/deploy-token", async (req, res) => {
  const {
    name,
    symbol,
    decimals = 9,
    supply = 1_000_000,
    mintAuthority,
  } = req.body as {
    name: string;
    symbol: string;
    decimals?: number;
    supply?: number;
    mintAuthority?: string;
  };

  if (!name || !symbol) {
    return res.status(400).json({ error: "name and symbol are required" });
  }

  const payer = getDeployerKeypair();
  if (!payer) {
    return res.status(503).json({
      error:
        "Token deployment not configured. Set SOLANA_DEPLOYER_KEY on the server and fund it with SOL.",
      setup: true,
    });
  }

  // Validate optional mint authority address
  let mintAuthorityPk: PublicKey = payer.publicKey;
  if (mintAuthority) {
    try {
      mintAuthorityPk = new PublicKey(mintAuthority);
    } catch {
      return res.status(400).json({ error: "Invalid mintAuthority address" });
    }
  }

  try {
    const connection = new Connection(SOLANA_RPC, "confirmed");

    // Check payer balance
    const balance = await connection.getBalance(payer.publicKey);
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      return res.status(402).json({
        error: `Deployer wallet needs at least 0.01 SOL. Current balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`,
        deployerAddress: payer.publicKey.toBase58(),
        setup: true,
      });
    }

    // 1. Create the mint account
    const mint = await createMint(
      connection,
      payer,
      mintAuthorityPk,
      mintAuthorityPk,
      decimals,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    );

    // 2. Create ATA for payer and mint initial supply (only if payer is mint authority)
    let mintSignature: string | null = null;
    if (!mintAuthority || mintAuthorityPk.equals(payer.publicKey)) {
      const ata = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        payer.publicKey
      );
      const rawSupply = BigInt(supply) * BigInt(10 ** decimals);
      mintSignature = await mintTo(
        connection,
        payer,
        mint,
        ata.address,
        payer,
        rawSupply
      );
    }

    const mintAddress = mint.toBase58();
    const explorerUrl = `https://solscan.io/token/${mintAddress}`;

    return res.json({
      success: true,
      mintAddress,
      symbol: symbol.toUpperCase(),
      name,
      decimals,
      supply,
      mintSignature,
      explorerUrl,
      network: "mainnet-beta",
    });
  } catch (err) {
    logger.error({ err }, "[wallet/deploy-token]");
    return res.status(500).json({ error: toErrorMessage(err) || "Token deployment failed" });
  }
});

export default router;
