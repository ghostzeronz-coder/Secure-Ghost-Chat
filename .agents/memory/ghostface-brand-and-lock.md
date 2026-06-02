---
name: GHOSTFACE brand + lock-screen interaction
description: Durable design decisions for the GHOSTFACE app — accent color and the lock-screen unlock model.
---

# GHOSTFACE brand accent

- The app accent is **gold `#d4af37`** on a near-black monochrome base (`constants/colors.ts` primary/accent/tint/warning). It was migrated from the earlier cyan `#00C8FF`; crypto/secondary purple `#9945FF` was mapped to neutral gray `#8A8A8A`.
- **Why:** user asked for a near-black monochrome look "to gold", keeping the ghost logo (recolored gold).
- **How to apply:** new UI should pull accents from `useColors()` (gold), not hardcode cyan/purple. Semantic red (`destructive`) and green (`success`) are deliberately kept for danger/secure status — monochrome-gold is about the *brand* accent, not eliminating status semantics.

# Lock screen unlock model (`app/lock.tsx`)

- The lock screen opens as an idle **"CIPHER · LOCKED"** seal; holding it (hold-to-decrypt, `decryptRevealed` state) reveals the existing secure PIN keypad. Backgrounding re-seals it and cancels any in-flight hold.
- All PIN / scramble / duress / panic-wipe / biometric logic is unchanged; the seal is only a visual gate. Biometric auto-prompt is gated behind `decryptRevealed`.
- **Silence contract:** hold-to-decrypt haptics are intentionally OUTSIDE `panicWipe` and the duress `setInterval` callback — those two must never call Haptics/Audio/Toast/Alert (enforced by `scripts/check-panic-wipe-silence.js`). Keep new lock-screen feedback out of those paths.
