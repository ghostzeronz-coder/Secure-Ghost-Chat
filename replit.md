# GHOSTFACE — Privacy Mobile Communications App

## Overview
GHOSTFACE is a privacy-first mobile communications platform built with Expo + React Native. Tagline: "No Face. No Trace."

## Architecture
- **Framework**: Expo (SDK 54), React Native, Expo Router (file-based routing)
- **State**: React Context (AppContext) + AsyncStorage for persistence
- **Styling**: React Native StyleSheet, dark-only, monospace aesthetic
- **Package manager**: pnpm (workspace monorepo)
- **Artifact path**: `artifacts/ghostface/`
- **Bundle ID**: `com.ghostface.app` (do not change)

## Key Files
- `artifacts/ghostface/app/_layout.tsx` — Root layout, AppProvider, routing logic
- `artifacts/ghostface/app/(tabs)/_layout.tsx` — 5-tab layout (Home/Messages/Wallet/VPN/Settings)
- `artifacts/ghostface/app/onboarding.tsx` — Alias + PIN setup (first launch)
- `artifacts/ghostface/app/lock.tsx` — PIN keypad + biometric lock screen
- `artifacts/ghostface/app/(tabs)/index.tsx` — Home dashboard (security status, wallet, quick actions)
- `artifacts/ghostface/app/(tabs)/messages.tsx` — Conversation list
- `artifacts/ghostface/app/chat/[id].tsx` — Chat detail with E2EE messaging UI
- `artifacts/ghostface/app/(tabs)/wallet.tsx` — Crypto wallet (FD + CASPER tokens, Solana)
- `artifacts/ghostface/app/(tabs)/vpn.tsx` — VPN dashboard with server selection
- `artifacts/ghostface/app/(tabs)/settings.tsx` — Settings, biometric toggle, panic wipe
- `artifacts/ghostface/context/AppContext.tsx` — Global state
- `artifacts/ghostface/constants/colors.ts` — Dark theme (#000000 bg, #F0F0F0 fg, #00C8FF accent)
- `artifacts/ghostface/components/GhostLogo.tsx` — Ghost logo (renders ghostlogo.png asset)
- `artifacts/ghostface/components/SecureBadge.tsx` — E2EE/VPN/encrypted badges
- `artifacts/ghostface/components/StatusDot.tsx` — Animated status indicator
- `artifacts/ghostface/app/paywall.tsx` — Subscription plan selection (GHOST/SPECTER/PHANTOM)

## API Server (`artifacts/api-server/`)
- Express + TypeScript, port via `$PORT`, path prefix `/api`
- **Stripe integration**: Uses Replit Stripe connector (no hardcoded keys)
  - `src/stripeClient.ts` — Replit connector-based Stripe client + StripeSync singleton
  - `src/stripeService.ts` — Products listing, checkout session creation
  - `src/routes/stripe.ts` — `/api/stripe/plans`, `/api/stripe/checkout`, `/api/stripe/seed`, success/cancel pages
  - `src/routes/index.ts` — Route aggregator
  - `build.mjs` — `stripe-replit-sync` externalized so migration path resolution works
- **Stripe DB**: `stripe` schema in PostgreSQL, migrated via `runMigrations` on startup
- **Webhook**: `/api/stripe/webhook` registered before `express.json()`, managed via `findOrCreateManagedWebhook`

## Stripe Products (Sandbox)
- SPECTER: `prod_UGrG7BejTEHhfT`, monthly `price_1TIJXg88Vhf4WcZqOGvGNLk5` ($9.99), yearly `price_1TIJXg88Vhf4WcZqUiAHyinH` ($99)
- PHANTOM: `prod_UGrGy18baF4LjU`, monthly `price_1TIJXh88Vhf4WcZqgs3zxbxP` ($19.99), yearly `price_1TIJXh88Vhf4WcZqZ9P4jvyr` ($199)

## Design System
- Background: #000000
- Foreground: #F0F0F0
- Primary accent: #00C8FF (electric blue)
- Success: #00FF88
- Destructive: #FF3B30
- Cards: #0D0D0D with #1E1E1E borders
- Fonts: Inter (monospace-style letter spacing)

## Features
- Anonymous onboarding (alias only, no phone/email)
- Encrypted messaging UI (simulated X3DH/Double Ratchet E2EE)
- Voice/video call buttons in chat
- VPN status dashboard with 6 server locations
- Solana-based crypto wallet (FD and CASPER tokens)
- Panic button (hold 3s to wipe all data)
- PIN lock screen with keypad
- Biometric authentication (platform-guarded)

## Packages Added
- `@react-native-async-storage/async-storage` — Local storage
- `expo-clipboard` — Copy wallet address
- `expo-local-authentication` — Biometrics
- `react-native-svg` — Ghost logo SVG

## Notes
- All data is local only (AsyncStorage, no backend)
- Web-safe: Platform.OS checks for biometrics, web insets applied
- Dark mode enforced via userInterfaceStyle: "dark" in app.json
