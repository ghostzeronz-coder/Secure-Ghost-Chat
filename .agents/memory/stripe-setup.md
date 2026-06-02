---
name: GHOSTFACE Stripe credential setup
description: How Stripe credentials are sourced for dev vs production, and the constraints that bit us.
---

# GHOSTFACE Stripe credentials

Production Stripe runs on **direct global secrets** `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` (set via Replit Secrets), NOT the Replit Stripe connector.

**Why:** The Replit Stripe connector was only bound for the `development` environment, so a published build hit "Stripe production connection not found" (the api-server requests the `production` connector environment when `REPLIT_DEPLOYMENT === "1"`). The user also dismissed the connector OAuth flow and preferred their own live keys. Direct env-var secrets are global (cover both dev and prod) and take precedence over the connector in the credential resolver.

**How to apply:**
- The api-server is the single source of Stripe keys; the mobile app fetches the publishable key from `GET /api/stripe/config`. No `EXPO_PUBLIC_STRIPE_*` needed.
- Both keys MUST be the same mode (both `*_live_*` or both `*_test_*`) AND the same account. A test secret + live publishable (or two different accounts) authenticates individually but breaks checkout. Compare the `_51XXXX` account prefix of sk vs pk to confirm.
- After changing these secrets, restart the api-server workflow so it re-reads them.
- Live webhooks may still need `STRIPE_WEBHOOK_SECRET`; there is a `stripe-replit-sync` fallback if unset.
