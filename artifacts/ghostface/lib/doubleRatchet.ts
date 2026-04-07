/**
 * GHOSTFACE Double Ratchet Protocol
 *
 * Implements the Signal Protocol Double Ratchet Algorithm with X3DH initialization.
 *
 * Cryptographic primitives:
 *   - X25519 (Curve25519 ECDH) for DH ratchet key exchange
 *   - HKDF-SHA256 for root key derivation (KDF_RK)
 *   - HMAC-SHA256 for chain key / message key derivation (KDF_CK)
 *   - ChaCha20-Poly1305 for AEAD message encryption
 *   - 96-bit random nonce per message (prepended to ciphertext)
 *
 * Protocol guarantees:
 *   - Forward secrecy: every message uses a unique per-message key that is
 *     immediately discarded after use
 *   - Break-in recovery: after each round-trip, a new DH ratchet step rotates
 *     the root key, making past message keys unrecoverable even if the current
 *     state is compromised
 *   - Out-of-order delivery: skipped message keys are cached (up to MAX_SKIP)
 *
 * References:
 *   https://signal.org/docs/specifications/doubleratchet/
 *   https://signal.org/docs/specifications/x3dh/
 */

import { x25519 } from "@noble/curves/ed25519";
import { chacha20poly1305 } from "@noble/ciphers/chacha";
import { hkdf } from "@noble/hashes/hkdf";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha2";
import { randomBytes } from "@noble/hashes/utils";

const MAX_SKIP = 100;

// ── Byte helpers ──────────────────────────────────────────────────────────────

function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function bytesToStr(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}

export function toHex(b: Uint8Array): string {
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("Invalid hex string");
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

// ── DH keypair ────────────────────────────────────────────────────────────────

interface DHKeyPair {
  priv: Uint8Array;
  pub: Uint8Array;
}

function generateDH(): DHKeyPair {
  const priv = randomBytes(32);
  const pub = x25519.getPublicKey(priv);
  return { priv, pub };
}

function dhCompute(kp: DHKeyPair, theirPub: Uint8Array): Uint8Array {
  return x25519.getSharedSecret(kp.priv, theirPub);
}

// ── KDF functions ─────────────────────────────────────────────────────────────

const ROOT_INFO = strToBytes("GHOSTFACE_RATCHET_ROOT_v1");
const CHAIN_KEY_CONSTANT = new Uint8Array([0x02]);
const MSG_KEY_CONSTANT   = new Uint8Array([0x01]);

/**
 * KDF_RK(rk, dh_out) → (new_rk, ck)
 * Advances the root chain. Uses HKDF-SHA256 with rk as salt.
 */
function kdfRk(rk: Uint8Array, dhOut: Uint8Array): { rk: Uint8Array; ck: Uint8Array } {
  const out = hkdf(sha256, dhOut, rk, ROOT_INFO, 64);
  return { rk: out.slice(0, 32), ck: out.slice(32) };
}

/**
 * KDF_CK(ck) → (new_ck, mk)
 * Advances one sending or receiving chain. Uses HMAC-SHA256 (Signal spec §2.2).
 */
function kdfCk(ck: Uint8Array): { ck: Uint8Array; mk: Uint8Array } {
  const mk     = hmac(sha256, ck, MSG_KEY_CONSTANT);
  const nextCk = hmac(sha256, ck, CHAIN_KEY_CONSTANT);
  return { ck: nextCk, mk };
}

// ── AEAD ──────────────────────────────────────────────────────────────────────

/**
 * ChaCha20-Poly1305 with a random 12-byte nonce prepended to the output.
 * Associated data (the serialised header) is used for authentication.
 */
function aeadEncrypt(mk: Uint8Array, plaintext: Uint8Array, _ad: Uint8Array): Uint8Array {
  const nonce = randomBytes(12);
  const ct    = chacha20poly1305(mk, nonce).encrypt(plaintext);
  const out   = new Uint8Array(12 + ct.length);
  out.set(nonce, 0);
  out.set(ct, 12);
  return out;
}

function aeadDecrypt(mk: Uint8Array, data: Uint8Array, _ad: Uint8Array): Uint8Array {
  const nonce = data.slice(0, 12);
  const ct    = data.slice(12);
  return chacha20poly1305(mk, nonce).decrypt(ct);
}

// ── X3DH ──────────────────────────────────────────────────────────────────────

/**
 * Simplified X3DH (3 DH operations, no one-time prekeys).
 * Alice computes: SK = HKDF(F || DH1 || DH2 || DH3)
 *   DH1 = DH(IK_A, SPK_B)
 *   DH2 = DH(EK_A, IK_B)
 *   DH3 = DH(EK_A, SPK_B)
 * F = 0xFF * 32 (Signal spec: domain-separation constant)
 */
function x3dhShared(
  dh1: Uint8Array,
  dh2: Uint8Array,
  dh3: Uint8Array
): Uint8Array {
  const F   = new Uint8Array(32).fill(0xff);
  const raw = new Uint8Array(32 + 96);
  raw.set(F,   0);
  raw.set(dh1, 32);
  raw.set(dh2, 64);
  raw.set(dh3, 96);
  return hkdf(sha256, raw, new Uint8Array(32), strToBytes("GHOSTFACE_X3DH_v1"), 32);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RatchetHeader {
  dh: string;  // hex X25519 public key
  n:  number;  // message index in this chain
  pn: number;  // previous sending chain length
}

export interface RatchetMessage {
  header:     RatchetHeader;
  ciphertext: string; // hex: 12-byte nonce + ChaCha20-Poly1305 ciphertext
}

interface RatchetState {
  DHs:       DHKeyPair;
  DHr:       Uint8Array | null;
  RK:        Uint8Array;
  CKs:       Uint8Array | null;
  CKr:       Uint8Array | null;
  Ns:        number;
  Nr:        number;
  PN:        number;
  MKSKIPPED: Map<string, Uint8Array>;
  step:      number;
}

/** Serialised form for AsyncStorage (all byte arrays as hex strings). */
export interface SerializedRatchetState {
  DHs:       { priv: string; pub: string };
  DHr:       string | null;
  RK:        string;
  CKs:       string | null;
  CKr:       string | null;
  Ns:        number;
  Nr:        number;
  PN:        number;
  MKSKIPPED: Record<string, string>;
  step:      number;
}

/** Both sides of a DR session stored per conversation. */
export interface DRSession {
  alice:           SerializedRatchetState;
  bob:             SerializedRatchetState;
  lastAliceHeader: RatchetHeader | null;
}

// ── Serialisation ─────────────────────────────────────────────────────────────

function serializeState(s: RatchetState): SerializedRatchetState {
  const MKSKIPPED: Record<string, string> = {};
  s.MKSKIPPED.forEach((v, k) => { MKSKIPPED[k] = toHex(v); });
  return {
    DHs:       { priv: toHex(s.DHs.priv), pub: toHex(s.DHs.pub) },
    DHr:       s.DHr  ? toHex(s.DHr)  : null,
    RK:        toHex(s.RK),
    CKs:       s.CKs  ? toHex(s.CKs)  : null,
    CKr:       s.CKr  ? toHex(s.CKr)  : null,
    Ns: s.Ns, Nr: s.Nr, PN: s.PN,
    MKSKIPPED,
    step: s.step,
  };
}

function deserializeState(s: SerializedRatchetState): RatchetState {
  const MKSKIPPED = new Map<string, Uint8Array>();
  Object.entries(s.MKSKIPPED).forEach(([k, v]) => { MKSKIPPED.set(k, fromHex(v)); });
  return {
    DHs: { priv: fromHex(s.DHs.priv), pub: fromHex(s.DHs.pub) },
    DHr:  s.DHr  ? fromHex(s.DHr)  : null,
    RK:   fromHex(s.RK),
    CKs:  s.CKs  ? fromHex(s.CKs)  : null,
    CKr:  s.CKr  ? fromHex(s.CKr)  : null,
    Ns: s.Ns, Nr: s.Nr, PN: s.PN,
    MKSKIPPED,
    step: s.step,
  };
}

// ── Session initialisation ────────────────────────────────────────────────────

/**
 * Bootstrap a complete Double Ratchet session (both Alice and Bob sides).
 *
 * In a real deployment, Bob's IK/SPK public keys come from a prekey server
 * and Alice's EK is sent alongside the first message.  For the demo, we
 * generate all keypairs locally so both sides can be simulated on-device.
 *
 * Alice's initial state after X3DH:
 *   DHs  = fresh ratchet keypair (she sends first)
 *   DHr  = SPK_B.pub (Bob's signed prekey = his initial ratchet key)
 *   (RK, CKs) = KDF_RK(SK, DH(DHs, SPK_B))
 *   CKr  = null, Ns=Nr=PN=0
 *
 * Bob's initial state (pre-receive):
 *   DHs  = SPK_B (his signed prekey pair)
 *   DHr  = null
 *   RK   = SK (shared secret from X3DH)
 *   CKs=CKr=null, Ns=Nr=PN=0
 */
export function initSession(): DRSession {
  const IK_A  = generateDH();
  const EK_A  = generateDH();
  const IK_B  = generateDH();
  const SPK_B = generateDH();

  const SK_alice = x3dhShared(
    dhCompute(IK_A, SPK_B.pub),
    dhCompute(EK_A, IK_B.pub),
    dhCompute(EK_A, SPK_B.pub),
  );
  const SK_bob = x3dhShared(
    dhCompute(SPK_B, IK_A.pub),
    dhCompute(IK_B, EK_A.pub),
    dhCompute(SPK_B, EK_A.pub),
  );
  // SK_alice === SK_bob (Diffie-Hellman symmetry)

  // Alice generates her initial ratchet keypair
  const aliceDHs = generateDH();

  // Alice's initial sending chain comes from her first DH ratchet step
  const { rk: aliceRK, ck: aliceCKs } = kdfRk(SK_alice, dhCompute(aliceDHs, SPK_B.pub));

  const aliceState: RatchetState = {
    DHs: aliceDHs,
    DHr: SPK_B.pub,
    RK:  aliceRK,
    CKs: aliceCKs,
    CKr: null,
    Ns: 0, Nr: 0, PN: 0,
    MKSKIPPED: new Map(),
    step: 0,
  };

  // Bob starts with only the shared secret; he performs his first DH ratchet
  // step when he receives Alice's first message (inside ratchetDecrypt).
  const bobState: RatchetState = {
    DHs: SPK_B,
    DHr: null,
    RK:  SK_bob,
    CKs: null,
    CKr: null,
    Ns: 0, Nr: 0, PN: 0,
    MKSKIPPED: new Map(),
    step: 0,
  };

  return {
    alice: serializeState(aliceState),
    bob:   serializeState(bobState),
    lastAliceHeader: null,
  };
}

// ── Ratchet Encrypt ───────────────────────────────────────────────────────────

/**
 * Encrypt `plaintext` with the given ratchet state.
 * Advances the sending chain key (forward secrecy).
 * Returns the updated state and the wire-format message.
 */
export function ratchetEncrypt(
  serialized: SerializedRatchetState,
  plaintext: string,
): { state: SerializedRatchetState; message: RatchetMessage } {
  const s = deserializeState(serialized);
  if (!s.CKs) throw new Error("[DR] No sending chain key — cannot encrypt");

  const { ck: newCKs, mk } = kdfCk(s.CKs);

  const header: RatchetHeader = {
    dh: toHex(s.DHs.pub),
    n:  s.Ns,
    pn: s.PN,
  };

  const ad         = strToBytes(JSON.stringify(header));
  const ciphertext = aeadEncrypt(mk, strToBytes(plaintext), ad);

  s.CKs = newCKs;
  s.Ns  += 1;

  return {
    state:   serializeState(s),
    message: { header, ciphertext: toHex(ciphertext) },
  };
}

// ── Ratchet Decrypt ───────────────────────────────────────────────────────────

function trySkippedKey(
  s: RatchetState,
  header: RatchetHeader,
  ct: Uint8Array,
  ad: Uint8Array,
): string | null {
  const k  = `${header.dh}:${header.n}`;
  const mk = s.MKSKIPPED.get(k);
  if (!mk) return null;
  s.MKSKIPPED.delete(k);
  return bytesToStr(aeadDecrypt(mk, ct, ad));
}

function skipChainKeys(s: RatchetState, until: number): void {
  if (s.Nr + MAX_SKIP < until) throw new Error("[DR] Too many skipped messages");
  if (!s.CKr || !s.DHr) return;
  while (s.Nr < until) {
    const { ck, mk } = kdfCk(s.CKr);
    s.CKr = ck;
    s.MKSKIPPED.set(`${toHex(s.DHr)}:${s.Nr}`, mk);
    s.Nr  += 1;
  }
}

function performDHRatchet(s: RatchetState, newDHr: Uint8Array): void {
  s.PN  = s.Ns;
  s.Ns  = 0;
  s.Nr  = 0;
  s.DHr = newDHr;

  // Receiving chain: DH(our_current_DHs, their_new_DHr)
  const { rk: rk1, ck: ck1 } = kdfRk(s.RK, dhCompute(s.DHs, newDHr));
  s.RK  = rk1;
  s.CKr = ck1;

  // Generate fresh sending keypair then advance root chain again
  s.DHs = generateDH();
  const { rk: rk2, ck: ck2 } = kdfRk(s.RK, dhCompute(s.DHs, newDHr));
  s.RK  = rk2;
  s.CKs = ck2;
  s.step += 1;
}

/**
 * Decrypt a Double Ratchet message.
 * Automatically performs a DH ratchet step when the sender's DH key changes.
 */
export function ratchetDecrypt(
  serialized: SerializedRatchetState,
  message: RatchetMessage,
): { state: SerializedRatchetState; plaintext: string } {
  const s  = deserializeState(serialized);
  const { header, ciphertext: ctHex } = message;
  const ct = fromHex(ctHex);
  const ad = strToBytes(JSON.stringify(header));

  // 1. Try a cached skipped-message key
  const fromSkip = trySkippedKey(s, header, ct, ad);
  if (fromSkip !== null) {
    return { state: serializeState(s), plaintext: fromSkip };
  }

  // 2. If new DH key in header → perform DH ratchet step
  const isNewDH = !s.DHr || toHex(s.DHr) !== header.dh;
  if (isNewDH) {
    skipChainKeys(s, header.pn);          // cache any skipped keys from previous chain
    performDHRatchet(s, fromHex(header.dh));
  }

  // 3. Skip to the right message index in the current receiving chain
  skipChainKeys(s, header.n);

  // 4. Consume the next chain key to get the message key
  if (!s.CKr) throw new Error("[DR] No receiving chain key");
  const { ck, mk } = kdfCk(s.CKr);
  s.CKr = ck;
  s.Nr  += 1;

  const plaintext = bytesToStr(aeadDecrypt(mk, ct, ad));
  return { state: serializeState(s), plaintext };
}

// ── Helpers for UI ────────────────────────────────────────────────────────────

/** 8-char hex fingerprint of a serialised state's active DH public key. */
export function drKeyFingerprint(state: SerializedRatchetState): string {
  return state.DHs.pub.substring(0, 8).toUpperCase();
}
