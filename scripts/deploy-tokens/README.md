# GHOSTFACE Token Deployment Script

Deploys two SPL tokens on Solana:
- **FD** — Face Dollar (6 decimals, stablecoin-style)
- **CASPER** — Casper Token (9 decimals)

## Prerequisites

- Node.js 18+
- A funded Solana wallet (needs SOL for transaction fees — ~0.05 SOL is enough)
- The wallet's **private key** as a base-58 string or a JSON byte array

## Setup

```bash
cd scripts/deploy-tokens
npm install
```

## Configure

Edit `config.js` before running:

| Field | Description |
|---|---|
| `NETWORK` | `"mainnet-beta"` or `"devnet"` (start with devnet!) |
| `WALLET_PRIVATE_KEY` | Your wallet private key (base-58 or JSON array) |
| `RECIPIENT_WALLET` | Public address that receives the initial token supply |
| `FD_SUPPLY` | Total FD supply to mint (in whole tokens) |
| `CASPER_SUPPLY` | Total CASPER supply to mint (in whole tokens) |

## Run (devnet first — always test before mainnet)

```bash
NETWORK=devnet node deploy.js
```

Then when ready for mainnet:

```bash
node deploy.js
```

## Output

After a successful run the script prints:

```
✅ FD mint address:     <base-58 address>
✅ CASPER mint address: <base-58 address>
```

Copy those two addresses and share them — they'll be wired into the GHOSTFACE app
so the wallet tab shows real on-chain balances.

## Security

- **Never share your private key** with anyone, including this project.
- Run this script locally on your own machine, not inside this Replit workspace.
- After deployment you only need the mint addresses — the private key is never stored anywhere.
