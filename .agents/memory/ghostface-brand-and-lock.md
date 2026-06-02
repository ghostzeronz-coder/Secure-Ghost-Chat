---
name: GHOSTFACE brand, lock + home design
description: Durable design decisions for GHOSTFACE — accent color, lock-screen unlock model, and the home radial-dial layout.
---

# Brand accent
- Accent is **antique gold `#bf9b30`** (deeper than the earlier `#d4af37`) on a near-black monochrome base. Secondary purple → neutral gray. **Green is removed app-wide.** `success` token is still **light blue `#7dd3fc`** (sky-300), but the **trial-badge / offer accent is now red `#ef4444`** (changed from light blue).
- **Why:** user wanted a near-black gold monochrome look, then deepened the gold to `#bf9b30`, and moved the trial/offer treatment to red.
- **How to apply:** pull accents from `useColors()`; don't reintroduce cyan/purple/green or the old `#d4af37`. Use red `#ef4444` for trial/offer; keep `#7dd3fc` only for non-trial success states. The `primary`/`accent`/`tint`/`warning` tokens in `constants/colors.ts` all carry `#bf9b30`.

# Metallic gold buttons
- Prominent solid-gold **CTA buttons** use a shared metallic gradient component `components/GoldGradient.tsx` (single source of truth for the `GOLD_METALLIC` palette + locations; includes a `#bf9b30` solid fallback). Non-CTA gold surfaces (active toggles/chips, badges/dots, the lock keypad, QR-scanner UI, destructive/muted buttons) deliberately stay **flat** gold.
- **Why:** user asked for a polished metallic finish on the gold buttons app-wide; flat surfaces would look busy/odd with a gradient and toggles need the simple fill.
- **How to apply:** wrap a CTA's children in `<GoldGradient>`; outer touchable keeps `borderRadius`/border/shadow/margins/opacity-logic but **must NOT use `overflow:"hidden"` together with shadow props** (it clips the iOS shadow) — instead give the inner `GoldGradient` a matching `borderRadius` to round its own corners.

# Lock screen unlock model
- Lock screen opens as an idle "CIPHER · LOCKED" seal; a hold-to-decrypt gesture reveals the secure PIN keypad. Backgrounding re-seals and cancels any in-flight hold. Biometric auto-prompt only fires after the seal is decrypted.
- **Reveal is animated, re-seal is instant (deliberate asymmetry):** opening runs a short "decrypt" transition — keypad fades+scales in while the glyph rows rapidly re-shuffle (descramble) before settling. Re-sealing on background must stay immediate (no animation) and must cancel any pending descramble timers + reset the reveal value, so an interrupted reveal can't finish after the app returns.
- **Silence contract (critical):** `panicWipe` and the duress `setInterval` callback must NEVER trigger Haptics/Audio/Toast/Alert — visual only. A repo guard script enforces this; run it after touching the lock screen or the app context. Hold-to-decrypt / navigation haptics are fine because they live outside those two paths.

# Home screen = radial dial
- Home is a radial menu: a spinning, breathing-fade ghost-logo centerpiece with the nav destinations (messages, call, vpn, wallet, number, settings) arranged in a ring around it. The bottom tab bar is hidden on the home tab only (still present on the other tabs).
- **Why:** user explicitly asked to drop the bottom menu on home and orbit the items around a rotating GF-logo circle.
- **How to apply:** keep continuous animation loops gated by screen focus (start on focus, stop on blur) so they don't churn battery off-screen. Note the tradeoff: nav is always visible after unlock (the old hold-to-reveal gate was removed) — revisit if the threat model wants shoulder-surfing resistance.
