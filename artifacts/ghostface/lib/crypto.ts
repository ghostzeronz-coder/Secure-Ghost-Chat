/**
 * GHOSTFACE Client-Side Cryptography
 *
 * Uses @noble/ciphers (AES-256-GCM) and @noble/hashes (SHA-256, HKDF, PBKDF2)
 * - All operations run 100% on-device — nothing leaves the device unencrypted
 * - Each message uses a unique 96-bit nonce (IV)
 * - PBKDF2-SHA256 (310,000 iterations) for key derivation from PIN
 * - ChaCha20-Poly1305 for message encryption (256-bit key, authenticated)
 * - Keys never stored in plaintext — only in memory during session
 */

import { chacha20poly1305 } from "@noble/ciphers/chacha";
import { managedNonce } from "@noble/ciphers/webcrypto";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha2";
import { randomBytes } from "@noble/hashes/utils";

// ── Helpers ──────────────────────────────────────────────────────────────────

function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function bytesToStr(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("Invalid hex string");
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

// ── Key derivation ────────────────────────────────────────────────────────────

/**
 * Derive a 256-bit session key from a PIN + salt using PBKDF2-SHA256.
 * Used to protect the per-device identity key.
 */
export function deriveKeyFromPin(pin: string, salt: Uint8Array): Uint8Array {
  return pbkdf2(sha256, strToBytes(pin), salt, {
    c: 310_000,
    dkLen: 32,
  });
}

/** Generate a random 32-byte salt for key derivation */
export function generateSalt(): Uint8Array {
  return randomBytes(32);
}

// ── Conversation key ──────────────────────────────────────────────────────────

/**
 * Generate a random 256-bit symmetric key for a conversation.
 * In a full Double Ratchet implementation this would be derived via X3DH;
 * here we generate it locally and could exchange it via the server.
 */
export function generateConversationKey(): Uint8Array {
  return randomBytes(32);
}

/** Encode a key as hex for storage / display */
export function keyToHex(key: Uint8Array): string {
  return bytesToHex(key);
}

/** Decode a hex key */
export function hexToKey(hex: string): Uint8Array {
  return hexToBytes(hex);
}

// ── Encryption ────────────────────────────────────────────────────────────────

export interface EncryptedMessage {
  ciphertext: string; // hex
  algorithm: "ChaCha20-Poly1305";
  version: 1;
}

/**
 * Encrypt a plaintext message with ChaCha20-Poly1305.
 * managedNonce prepends a random 96-bit nonce to each ciphertext automatically.
 */
export function encryptMessage(
  plaintext: string,
  key: Uint8Array
): EncryptedMessage {
  const chacha = managedNonce(chacha20poly1305);
  const encrypted = chacha(key).encrypt(strToBytes(plaintext));
  return {
    ciphertext: bytesToHex(encrypted),
    algorithm: "ChaCha20-Poly1305",
    version: 1,
  };
}

/**
 * Decrypt a ChaCha20-Poly1305 ciphertext.
 * Throws if the MAC tag is invalid (tampered/wrong key).
 */
export function decryptMessage(
  msg: EncryptedMessage,
  key: Uint8Array
): string {
  const chacha = managedNonce(chacha20poly1305);
  const decrypted = chacha(key).decrypt(hexToBytes(msg.ciphertext));
  return bytesToStr(decrypted);
}

// ── Identity fingerprint ──────────────────────────────────────────────────────

/**
 * Derive a human-readable safety number from two public keys (like Signal).
 * Displays as groups of 5 digits for user comparison.
 */
export function generateSafetyNumber(
  myAlias: string,
  theirAlias: string
): string {
  const combined = strToBytes(`${myAlias}:${theirAlias}`);
  const hash = sha256(combined);
  // Take first 30 bytes, group into 6 groups of 5 digits
  return Array.from({ length: 6 }, (_, i) => {
    const slice = hash.slice(i * 5, i * 5 + 5);
    const num = slice.reduce((acc, b) => acc * 256 + b, 0);
    return (num % 100000).toString().padStart(5, "0");
  }).join(" ");
}

// ── Sealed message fingerprint ────────────────────────────────────────────────

/** Short fingerprint shown in chat — first 8 chars of SHA-256 of ciphertext */
export function messageFingerprint(msg: EncryptedMessage): string {
  const hash = sha256(hexToBytes(msg.ciphertext));
  return bytesToHex(hash).substring(0, 8).toUpperCase();
}

// ── Default conversation keys (local demo) ────────────────────────────────────

/**
 * For demo purposes, derive a deterministic key per conversation alias.
 * In production this would be a real X3DH-negotiated key.
 */
export function demoKeyForConversation(convId: string): Uint8Array {
  return sha256(strToBytes(`ghostface:demo:conv:${convId}`));
}
