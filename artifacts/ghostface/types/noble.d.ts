/**
 * @noble/* subpath import resolution for TypeScript.
 *
 * Previously this file contained hand-written ambient module declarations
 * (declare module "@noble/curves/ed25519" { ... }) to silence TS2307 errors
 * that appeared because pnpm deduplication can hoist @noble/* packages to the
 * workspace root, where older or newer semver versions may not expose the
 * required subpath exports in their `package.json#exports` map.
 *
 * Why paths are safer than ambient declarations
 * ─────────────────────────────────────────────
 * Ambient `declare module` blocks take precedence over real module resolution
 * and suppress TypeScript's ability to use the actual `.d.ts` types from the
 * package.  Any mismatch between the stubs and the real API becomes a silent
 * lie that only surfaces at runtime.
 *
 * The fix (in tsconfig.json)
 * ──────────────────────────
 * `compilerOptions.paths` entries explicitly map every used `@noble/*` subpath
 * directly to the corresponding `.d.ts` file inside the ghostface-local
 * `node_modules/@noble/` directory:
 *
 *   "@noble/curves/ed25519"  →  ./node_modules/@noble/curves/ed25519.d.ts
 *   "@noble/hashes/utils"    →  ./node_modules/@noble/hashes/utils.d.ts
 *   "@noble/hashes/hkdf"     →  ./node_modules/@noble/hashes/hkdf.d.ts
 *   "@noble/hashes/hmac"     →  ./node_modules/@noble/hashes/hmac.d.ts
 *   "@noble/hashes/pbkdf2"   →  ./node_modules/@noble/hashes/pbkdf2.d.ts
 *   "@noble/hashes/sha2"     →  ./node_modules/@noble/hashes/sha2.d.ts
 *   "@noble/ciphers/chacha"  →  ./node_modules/@noble/ciphers/chacha.d.ts
 *   "@noble/ciphers/utils"   →  ./node_modules/@noble/ciphers/utils.d.ts
 *
 * This is deterministic (bypasses the exports-map lookup entirely) and immune
 * to pnpm deduplication changes.  TypeScript now uses the real types rather
 * than stubs, so API drift is caught at compile time.
 *
 * If you ever add a new @noble/* subpath import to the project, add a matching
 * `paths` entry in tsconfig.json pointing to the local .d.ts file.
 *
 * Note on managedNonce
 * ────────────────────
 * In @noble/ciphers v2.1.1, `managedNonce` moved from the `webcrypto` subpath
 * to the `utils` subpath.  lib/crypto.ts was updated to reflect this change:
 *   import { managedNonce } from "@noble/ciphers/utils"  ← correct for v2.x
 */
