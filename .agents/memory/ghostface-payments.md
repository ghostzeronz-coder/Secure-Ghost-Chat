---
name: GHOSTFACE payments
description: Why GHOSTFACE has no Stripe/card path and how the paywall is structured.
---

# GHOSTFACE payments

The paywall is **crypto-only** — USDC on Solana is the single payment path. There is no card/fiat option.

**Why:** Stripe was fully removed at the user's request because Stripe's deployment checklist was blocking publishing. The crypto path already covered the paywall, so card/fiat was dropped rather than maintained.

**How to apply:**
- Do not reintroduce a Stripe SDK, `/api/stripe/*` routes, a `payMethod` toggle, NZD/fiat pricing, or trial-banner UI in `paywall.tsx`.
- Backend payment surface is `/api/crypto/*` only.
- A `stripe:1.0.0` connector entry may still linger in `.replit [agent] integrations` — it is unused by any code and can only be detached by the user via the integrations pane (no agent tool removes it). It does not need code support.
