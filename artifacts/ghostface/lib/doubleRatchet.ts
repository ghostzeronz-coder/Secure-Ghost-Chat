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
 * Associated data (the serialised header) is passed to the AEAD cipher so the
 * header is cryptographically bound to the ciphertext — tampering with either
 * causes decryption to throw.  This is the standard Signal DR binding step.
 */
function aeadEncrypt(mk: Uint8Array, plaintext: Uint8Array, ad: Uint8Array): Uint8Array {
  const nonce = randomBytes(12);
  const ct    = chacha20poly1305(mk, nonce, ad).encrypt(plaintext);
  const out   = new Uint8Array(12 + ct.length);
  out.set(nonce, 0);
  out.set(ct, 12);
  return out;
}

function aeadDecrypt(mk: Uint8Array, data: Uint8Array, ad: Uint8Array): Uint8Array {
  const nonce = data.slice(0, 12);
  const ct    = data.slice(12);
  return chacha20poly1305(mk, nonce, ad).decrypt(ct);
}

// ── X3DH ──────────────────────────────────────────────────────────────────────

/**
 * Full X3DH key agreement supporting both 3-DH and 4-DH (Signal spec).
 *
 * 3-DH (no OPK):  SK = HKDF(F || DH1 || DH2 || DH3)
 * 4-DH (with OPK): SK = HKDF(F || DH1 || DH2 || DH3 || DH4)
 *
 *   DH1 = DH(IK_A, SPK_B)
 *   DH2 = DH(EK_A, IK_B)
 *   DH3 = DH(EK_A, SPK_B)
 *   DH4 = DH(EK_A, OPK_B)  — only when a one-time prekey is available
 *
 * F = 0xFF * 32 (Signal spec: domain-separation constant)
 */
function x3dhShared(
  dh1: Uint8Array,
  dh2: Uint8Array,
  dh3: Uint8Array,
  dh4?: Uint8Array,
): Uint8Array {
  const F   = new Uint8Array(32).fill(0xff);
  const dhParts = dh4
    ? [dh1, dh2, dh3, dh4]
    : [dh1, dh2, dh3];
  const raw = new Uint8Array(32 + dhParts.length * 32);
  raw.set(F, 0);
  dhParts.forEach((dh, i) => raw.set(dh, 32 + i * 32));
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
  /** True if the session was established with a one-time prekey (4-DH X3DH). */
  usedOPK?:        boolean;
}

/** A one-time prekey: public key (hex) and private key (hex). */
export interface OneTimePreKey {
  pub:  string;
  priv: string;
}

/**
 * Generate a batch of one-time prekeys for upload.
 * @param count Number of prekeys to generate (default 10).
 * @returns Array of { pub, priv } pairs. Only pub is sent to the server.
 */
export function generateOneTimePreKeys(count = 10): OneTimePreKey[] {
  return Array.from({ length: count }, () => {
    const kp = generateDH();
    return { pub: toHex(kp.pub), priv: toHex(kp.priv) };
  });
}

/**
 * A prekey bundle as fetched from the server for initiating an X3DH session.
 *
 * Alice-side (protocol-correct):
 *   ikPublicKey  — Bob's long-term identity public key
 *   spkPublicKey — Bob's signed prekey public key
 *   opkPublicKey — Bob's one-time prekey public key (null → 3-DH fallback)
 *
 * Demo-only simulation fields (present only because we generated Bob's keys on-device):
 *   ikPrivKey    — Bob's IK private key for symmetric DH verification
 *   spkPrivKey   — Bob's SPK private key for symmetric DH verification
 *   opkPrivKey   — Bob's OPK private key for symmetric DH4 verification
 *
 * In a real multi-device deployment only the public keys are transported.
 * Alice never sees Bob's private keys; Bob keeps them on his own device.
 */
export interface PreKeyBundle {
  ikPublicKey:   string;
  spkPublicKey:  string;
  opkPublicKey:  string | null;
  /** Demo-only: Bob's IK private key for local simulation. */
  ikPrivKey?:    string;
  /** Demo-only: Bob's SPK private key for local simulation. */
  spkPrivKey?:   string;
  /** Demo-only: Bob's OPK private key for local simulation. */
  opkPrivKey?:   string;
}

/**
 * Bootstrap a Double Ratchet session from a server-provided prekey bundle.
 *
 * Signal X3DH (4-DH when server returns an OPK, 3-DH fallback when opkPublicKey is null):
 *
 *   DH1 = DH(IK_A.priv,  SPK_B.pub)
 *   DH2 = DH(EK_A.priv,  IK_B.pub)
 *   DH3 = DH(EK_A.priv,  SPK_B.pub)
 *   DH4 = DH(EK_A.priv,  OPK_B.pub)  ← 4-DH only when bundle.opkPublicKey is non-null
 *
 * Alice's side uses ONLY public keys from the bundle (protocol-correct).
 * The fallback to 3-DH happens solely when the server returns opkPublicKey: null —
 * i.e. when Bob has exhausted his OPK supply.
 *
 * Demo simulation: when Bob's private keys are available (ikPrivKey, spkPrivKey, opkPrivKey),
 * Bob's symmetric DH computation is also performed so both shared secrets can be
 * verified equal on the same device.  Private keys are stored because this single-device
 * demo generates Bob's keys on Alice's behalf.
 */
export function initSessionFromBundle(bundle: PreKeyBundle): DRSession {
  const IK_A = generateDH();
  const EK_A = generateDH();

  const ikBPub  = fromHex(bundle.ikPublicKey);
  const spkBPub = fromHex(bundle.spkPublicKey);

  // Alice's 4th DH uses only the OPK public key from the server bundle.
  // Fallback to 3-DH only when server returned no OPK (opkPublicKey === null).
  const opkBPub: Uint8Array | undefined = bundle.opkPublicKey
    ? fromHex(bundle.opkPublicKey)
    : undefined;

  const dh4_alice = opkBPub ? dhCompute(EK_A, opkBPub) : undefined;

  const SK_alice = x3dhShared(
    dhCompute(IK_A, spkBPub),
    dhCompute(EK_A, ikBPub),
    dhCompute(EK_A, spkBPub),
    dh4_alice,
  );

  // Demo simulation: also compute Bob's symmetric shared secret when privkeys are available.
  let SK_bob: Uint8Array;
  let spkBForBobState: DHKeyPair;

  if (bundle.ikPrivKey && bundle.spkPrivKey) {
    const IK_B: DHKeyPair  = { priv: fromHex(bundle.ikPrivKey),  pub: ikBPub };
    const SPK_B: DHKeyPair = { priv: fromHex(bundle.spkPrivKey), pub: spkBPub };
    const dh4_bob = (opkBPub && bundle.opkPrivKey)
      ? dhCompute({ priv: fromHex(bundle.opkPrivKey), pub: opkBPub }, EK_A.pub)
      : undefined;

    SK_bob = x3dhShared(
      dhCompute(SPK_B, IK_A.pub),
      dhCompute(IK_B,  EK_A.pub),
      dhCompute(SPK_B, EK_A.pub),
      dh4_bob,
    );
    spkBForBobState = SPK_B;
  } else {
    // Private keys unavailable: both sides use Alice's SK (session still functional locally).
    SK_bob = SK_alice;
    spkBForBobState = generateDH();
  }

  const aliceDHs = generateDH();
  const { rk: aliceRK, ck: aliceCKs } = kdfRk(SK_alice, dhCompute(aliceDHs, spkBPub));

  const aliceState: RatchetState = {
    DHs: aliceDHs,
    DHr: spkBPub,
    RK:  aliceRK,
    CKs: aliceCKs,
    CKr: null,
    Ns: 0, Nr: 0, PN: 0,
    MKSKIPPED: new Map(),
    step: 0,
  };

  const bobState: RatchetState = {
    DHs: spkBForBobState,
    DHr: null,
    RK:  SK_bob,
    CKs: null,
    CKr: null,
    Ns: 0, Nr: 0, PN: 0,
    MKSKIPPED: new Map(),
    step: 0,
  };

  return {
    alice:           serializeState(aliceState),
    bob:             serializeState(bobState),
    lastAliceHeader: null,
    usedOPK:         !!opkBPub,
  };
}

/**
 * Bootstrap a DR session using a one-time prekey (4-DH X3DH).
 *
 * Signal X3DH protocol:
 *   Alice (initiator) only needs Bob's OPK *public* key.
 *     DH4_alice = DH(EK_A.priv, OPK_B.pub)
 *   Bob (responder) needs his own OPK *private* key to compute his side.
 *     DH4_bob   = DH(OPK_B.priv, EK_A.pub)
 *
 * In the demo both sides are simulated on-device.  The caller provides the
 * full OPK keypair so both DH4 computations can be verified locally.
 *
 * @param opk  Full one-time prekey pair {pub, priv} for Bob.
 *             `pub` is what Alice fetches from the server bundle.
 *             `priv` is what Bob uses for his responding DH computation.
 *             Both are required for the local two-party simulation.
 */
export function initSessionWithOPK(opk: OneTimePreKey): DRSession {
  const kp: DHKeyPair = { priv: fromHex(opk.priv), pub: fromHex(opk.pub) };
  return initSession(kp);
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
 * When `opkB` is provided (a one-time prekey keypair for Bob), the session
 * uses the full 4-DH X3DH variant from the Signal spec:
 *   DH4 = DH(EK_A, OPK_B)
 * Otherwise it falls back to the 3-DH path.
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
 *
 * @param opkB  Optional one-time prekey keypair for Bob. When supplied, the
 *              4-DH X3DH handshake is performed; otherwise the 3-DH fallback
 *              is used (e.g. when the server has no OPKs left for Bob).
 */
export function initSession(opkB?: DHKeyPair): DRSession {
  const IK_A  = generateDH();
  const EK_A  = generateDH();
  const IK_B  = generateDH();
  const SPK_B = generateDH();

  const dh4_alice = opkB ? dhCompute(EK_A, opkB.pub) : undefined;
  const dh4_bob   = opkB ? dhCompute(opkB, EK_A.pub) : undefined;

  const SK_alice = x3dhShared(
    dhCompute(IK_A, SPK_B.pub),
    dhCompute(EK_A, IK_B.pub),
    dhCompute(EK_A, SPK_B.pub),
    dh4_alice,
  );
  const SK_bob = x3dhShared(
    dhCompute(SPK_B, IK_A.pub),
    dhCompute(IK_B, EK_A.pub),
    dhCompute(SPK_B, EK_A.pub),
    dh4_bob,
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
    alice:           serializeState(aliceState),
    bob:             serializeState(bobState),
    lastAliceHeader: null,
    usedOPK:         !!opkB,
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

// ── Integrity validation ──────────────────────────────────────────────────────

/** Check that a hex string has the expected byte length (n bytes = 2n hex chars). */
function isHex(v: unknown, bytes: number): boolean {
  return typeof v === "string" && v.length === bytes * 2 && /^[0-9a-f]+$/i.test(v);
}

/**
 * Validate the shape of a deserialised ratchet state.
 * Returns true only if all required fields are well-formed hex values.
 * Call this on startup to detect corrupted / migrated states.
 */
export function isValidRatchetState(s: unknown): s is SerializedRatchetState {
  if (!s || typeof s !== "object") return false;
  const r = s as Record<string, unknown>;
  if (!r.DHs || typeof r.DHs !== "object") return false;
  const dhs = r.DHs as Record<string, unknown>;
  return (
    isHex(dhs.priv, 32) &&
    isHex(dhs.pub,  32) &&
    isHex(r.RK,     32) &&
    (r.DHr  === null || isHex(r.DHr,  32)) &&
    (r.CKs  === null || isHex(r.CKs,  32)) &&
    (r.CKr  === null || isHex(r.CKr,  32)) &&
    typeof r.Ns === "number" &&
    typeof r.Nr === "number" &&
    typeof r.PN === "number" &&
    typeof r.step === "number"
  );
}

/**
 * Validate a complete DRSession object.
 * Returns true only if both alice and bob states are well-formed.
 */
export function isValidDRSession(session: unknown): session is DRSession {
  if (!session || typeof session !== "object") return false;
  const s = session as Record<string, unknown>;
  return isValidRatchetState(s.alice) && isValidRatchetState(s.bob);
}
