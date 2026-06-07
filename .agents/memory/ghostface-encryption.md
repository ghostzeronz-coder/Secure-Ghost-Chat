---
name: GHOSTFACE real E2E encryption
description: Invariants for the real (non-simulated) X3DH + Double Ratchet messaging path; what must never regress.
---

# Real end-to-end encryption invariants

GHOSTFACE messaging is real E2E only — there is NO demo/deterministic/simulated key path. If you ever find yourself fabricating a session or deriving a key from a conversation id/alias, stop: that was deliberately removed.

**Rules:**
- A `PreKeyBundle` is PUBLIC-KEYS-ONLY. Private keys (IK/SPK/OPK) never leave the device and never travel over the wire. The X3DH header (`ikA`/`ekA`/`opkId`) is public material only.
- Only real X3DH bootstrap exists: `initSessionAliceWithHeader` (initiator) and `initSessionBobFromHeader` (responder). Convention: `drSession.alice` always holds the CURRENT device's ratchet state, whether initiator or responder.
- `drSession` and `isRealContact: true` are set together whenever a real handshake completes. A conversation with one but not the other is stale local-only state.
- Send path must HARD-FAIL (graceful, user-visible) when not a real secure channel — gate on `!isRealContact || !conv.drSession`. Never append a "sent"/encrypted local message that is not actually transmitted. No sim else-branch, no session retry/fabrication.
- `addConversation` returns `{ ok, error? }` (errors: server_unreachable / not_found / no_bundle / no_own_keys / x3dh_failed). Callers (messages.tsx, GhostInvite.tsx) branch on `.ok`.

**Why:** the whole product promise is that private keys never leave the device and there is no backdoor/simulated path; any reintroduced fallback silently breaks that guarantee.

**How to apply:** when touching `lib/doubleRatchet.ts`, `lib/crypto.ts`, or `context/AppContext.tsx` send/add-conversation flows, preserve these invariants.

# Test infra note (no JS test runner)
The repo has NO vitest/jest/tsx/esbuild, and `artifacts/ghostface/tsconfig.json` EXCLUDES `**/*.test.ts` (so a `.test.ts` is neither typechecked nor run). The convention for runnable checks is `scripts/check-*.{js,mjs}` exposed as a `check:*` package script. The two-party handshake test lives at `artifacts/ghostface/scripts/check-x3dh-handshake.mjs` (`pnpm --filter @workspace/ghostface run check:handshake`); it transpiles `lib/doubleRatchet.ts` at runtime via the `typescript` API and asserts no private-key sharing.
