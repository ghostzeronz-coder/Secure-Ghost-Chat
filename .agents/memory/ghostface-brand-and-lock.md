---
name: GHOSTFACE brand, lock + home design
description: Durable design decisions for GHOSTFACE — accent color, lock-screen unlock model, and the home radial-dial layout.
---

# Brand accent
- Accent is **gold `#d4af37`** on a near-black monochrome base (migrated from an earlier cyan; secondary purple → neutral gray). Semantic red (danger) and green (success) are intentionally kept.
- **Why:** user wanted a near-black monochrome look in gold, keeping the gold ghost logo.
- **How to apply:** pull accents from `useColors()`; don't reintroduce cyan/purple. Monochrome-gold is about the brand accent, not removing status semantics.

# Lock screen unlock model
- Lock screen opens as an idle "CIPHER · LOCKED" seal; a hold-to-decrypt gesture reveals the secure PIN keypad. Backgrounding re-seals and cancels any in-flight hold. Biometric auto-prompt only fires after the seal is decrypted.
- **Silence contract (critical):** `panicWipe` and the duress `setInterval` callback must NEVER trigger Haptics/Audio/Toast/Alert — visual only. A repo guard script enforces this; run it after touching the lock screen or the app context. Hold-to-decrypt / navigation haptics are fine because they live outside those two paths.

# Home screen = radial dial
- Home is a radial menu: a spinning, breathing-fade ghost-logo centerpiece with the nav destinations (messages, call, vpn, wallet, number, settings) arranged in a ring around it. The bottom tab bar is hidden on the home tab only (still present on the other tabs).
- **Why:** user explicitly asked to drop the bottom menu on home and orbit the items around a rotating GF-logo circle.
- **How to apply:** keep continuous animation loops gated by screen focus (start on focus, stop on blur) so they don't churn battery off-screen. Note the tradeoff: nav is always visible after unlock (the old hold-to-reveal gate was removed) — revisit if the threat model wants shoulder-surfing resistance.
