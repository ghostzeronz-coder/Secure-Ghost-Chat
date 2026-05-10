/**
 * Ambient module declarations for @noble/* subpath imports.
 *
 * Why these exist
 * ───────────────
 * pnpm deduplicates @noble/* packages to the workspace root. The root
 * copies are newer semver versions whose `exports` maps do not expose
 * the subpaths used here (e.g. `@noble/curves/ed25519`, `@noble/hashes/utils`).
 * TypeScript therefore cannot resolve these imports via the package `exports`
 * map and errors with TS2307 "Cannot find module".
 *
 * At runtime the Expo/Metro bundler falls back to file-based resolution and
 * finds the correct files inside the ghostface-local node_modules copy, so
 * the app works correctly. These declarations bridge the gap so tsc --noEmit
 * agrees with the bundler without requiring changes to the actual imports or
 * the bundler configuration.
 *
 * Long-term fix (tracked as a follow-up task): update imports to use each
 * package's canonical top-level export so pnpm deduplication is not an issue.
 */

declare module "@noble/curves/ed25519" {
  export const x25519: {
    getPublicKey(privateKey: Uint8Array): Uint8Array;
    getSharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array;
  };
  export const ed25519: {
    getPublicKey(privateKey: Uint8Array): Uint8Array;
    sign(message: Uint8Array, privateKey: Uint8Array): Uint8Array;
    verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean;
  };
}

declare module "@noble/hashes/utils" {
  export function randomBytes(length: number): Uint8Array;
  export function bytesToHex(bytes: Uint8Array): string;
  export function hexToBytes(hex: string): Uint8Array;
  export function utf8ToBytes(str: string): Uint8Array;
  export function concatBytes(...arrays: Uint8Array[]): Uint8Array;
}

declare module "@noble/hashes/hkdf" {
  import type { CHash } from "@noble/hashes/utils";
  export function hkdf(
    hash: CHash,
    inputKeyMaterial: Uint8Array,
    salt?: Uint8Array,
    info?: Uint8Array,
    length?: number
  ): Uint8Array;
}

declare module "@noble/hashes/hmac" {
  import type { CHash } from "@noble/hashes/utils";
  export function hmac(hash: CHash, key: Uint8Array, message: Uint8Array): Uint8Array;
  export const hmac: {
    (hash: CHash, key: Uint8Array, message: Uint8Array): Uint8Array;
    create(hash: CHash, key: Uint8Array): { update(data: Uint8Array): { digest(): Uint8Array } };
  };
}

declare module "@noble/hashes/pbkdf2" {
  import type { CHash } from "@noble/hashes/utils";
  export function pbkdf2(
    hash: CHash,
    password: Uint8Array | string,
    salt: Uint8Array | string,
    opts: { c: number; dkLen?: number }
  ): Uint8Array;
}

declare module "@noble/hashes/sha2" {
  export const sha256: import("@noble/hashes/utils").CHash;
  export const sha384: import("@noble/hashes/utils").CHash;
  export const sha512: import("@noble/hashes/utils").CHash;
}

declare module "@noble/ciphers/chacha" {
  export function chacha20poly1305(key: Uint8Array, nonce: Uint8Array, aad?: Uint8Array): {
    encrypt(plaintext: Uint8Array): Uint8Array;
    decrypt(ciphertext: Uint8Array): Uint8Array;
  };
}

declare module "@noble/ciphers/webcrypto" {
  export function managedNonce<T>(cipher: (...args: any[]) => T): (...args: any[]) => T;
}
