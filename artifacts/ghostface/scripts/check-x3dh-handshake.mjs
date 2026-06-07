#!/usr/bin/env node
/**
 * check-x3dh-handshake.mjs
 *
 * Two-party real X3DH + Double Ratchet handshake test.
 *
 * This proves the encryption is genuinely end-to-end with NO simulated or
 * deterministic key path:
 *
 *   1. Bob registers a PUBLIC-ONLY prekey bundle (no private keys present).
 *   2. Alice runs initSessionAliceWithHeader using ONLY Bob's public bundle
 *      plus her own private identity key, and emits an X3DH header that
 *      contains public material only (ikA / ekA / opkId).
 *   3. Bob runs initSessionBobFromHeader using ONLY his own private keys plus
 *      the public X3DH header — the two parties independently derive the same
 *      shared secret without either private key ever crossing to the other.
 *   4. Messages ratchet correctly in both directions across several rounds.
 *
 * It also asserts that no private-key material leaks into the wire artefacts
 * (the bundle and the X3DH header) that travel between the two devices.
 *
 * Runs the REAL lib/doubleRatchet.ts by transpiling it at runtime (the repo
 * has no JS test runner). Exit 0 → handshake intact, Exit 1 → violation.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ghostDir = path.resolve(__dirname, "..");
const drPath = path.join(ghostDir, "lib", "doubleRatchet.ts");

let failures = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    console.error(`  ✗ ${msg}`);
    failures += 1;
  }
}

async function loadDoubleRatchet() {
  const source = fs.readFileSync(drPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  // Emit next to the real module so its @noble bare imports resolve from
  // artifacts/ghostface/node_modules.
  const tmp = path.join(ghostDir, "lib", `.dr_handshake_${process.pid}.mjs`);
  fs.writeFileSync(tmp, transpiled);
  try {
    return { mod: await import(`${tmp}?t=${Date.now()}`), tmp };
  } catch (e) {
    fs.unlinkSync(tmp);
    throw e;
  }
}

/** Collect every string value in an object graph (for leak scanning). */
function collectStrings(value, acc = []) {
  if (typeof value === "string") {
    acc.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, acc);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectStrings(v, acc);
  }
  return acc;
}

async function main() {
  console.log("X3DH / Double Ratchet two-party handshake");

  const { mod: DR, tmp } = await loadDoubleRatchet();
  try {
    // ── 1. Bob registers — PUBLIC-ONLY bundle ────────────────────────────────
    const bobIkSign = DR.generateSigningKeyPair();
    const bobIK = DR.generateOneTimePreKeys(1)[0];
    const bobSPK = DR.generateOneTimePreKeys(1)[0];
    const bobOPK = DR.generateOneTimePreKeys(1)[0];
    const spkSignature = DR.signSPK(bobSPK.pub, bobIkSign.priv);

    const bundle = {
      ikPublicKey: bobIK.pub,
      spkPublicKey: bobSPK.pub,
      opkPublicKey: bobOPK.pub,
      spkSignature,
      ikSignPublicKey: bobIkSign.pub,
    };

    // Bob's private keys — these MUST never appear in anything Alice sees.
    const bobPrivateKeys = [bobIK.priv, bobSPK.priv, bobOPK.priv, bobIkSign.priv];

    const bundleStrings = collectStrings(bundle);
    assert(
      bobPrivateKeys.every((priv) => !bundleStrings.includes(priv)),
      "prekey bundle contains NO private key material",
    );

    // ── 2. Alice initiates from public bundle + her own private IK ────────────
    const aliceIK = DR.generateOneTimePreKeys(1)[0];
    const { session: aliceSession, x3dhHeader } =
      DR.initSessionAliceWithHeader(bundle, aliceIK.priv, aliceIK.pub);

    assert(x3dhHeader.ikA === aliceIK.pub, "X3DH header carries Alice's PUBLIC IK");
    assert(x3dhHeader.opkId === bobOPK.pub, "X3DH header references Bob's PUBLIC OPK (4-DH)");

    const headerStrings = collectStrings(x3dhHeader);
    assert(
      !headerStrings.includes(aliceIK.priv),
      "X3DH header does NOT contain Alice's private IK",
    );
    assert(
      bobPrivateKeys.every((priv) => !headerStrings.includes(priv)),
      "X3DH header does NOT contain any of Bob's private keys",
    );

    // ── 3. Bob completes X3DH from header using HIS OWN private keys ──────────
    const bobSession = DR.initSessionBobFromHeader(
      x3dhHeader,
      bobIK.priv,
      bobIK.pub,
      bobSPK.priv,
      bobSPK.pub,
      bobOPK.priv,
    );

    // ── 4. Bidirectional ratchet over several rounds ─────────────────────────
    let aliceState = aliceSession.alice;
    let bobState = bobSession.alice;

    const rounds = [
      ["alice", "ping 1 from alice"],
      ["bob", "pong 1 from bob"],
      ["alice", "ping 2 from alice"],
      ["alice", "ping 3 from alice (consecutive)"],
      ["bob", "pong 2 from bob"],
    ];

    let allRoundsOk = true;
    for (const [sender, text] of rounds) {
      if (sender === "alice") {
        const { state: ns, message } = DR.ratchetEncrypt(aliceState, text);
        aliceState = ns;
        const { state: nr, plaintext } = DR.ratchetDecrypt(bobState, message);
        bobState = nr;
        if (plaintext !== text) allRoundsOk = false;
      } else {
        const { state: ns, message } = DR.ratchetEncrypt(bobState, text);
        bobState = ns;
        const { state: nr, plaintext } = DR.ratchetDecrypt(aliceState, message);
        aliceState = nr;
        if (plaintext !== text) allRoundsOk = false;
      }
    }
    assert(allRoundsOk, "all bidirectional messages decrypt to original plaintext");

    // ── 5. Wrong key cannot decrypt (sanity: ciphertext is real) ─────────────
    const eve = DR.generateOneTimePreKeys(1)[0];
    const { session: eveSession } = DR.initSessionAliceWithHeader(bundle, eve.priv, eve.pub);
    const { message: aliceMsg } = DR.ratchetEncrypt(aliceSession.alice, "secret");
    let eveBlocked = false;
    try {
      DR.ratchetDecrypt(eveSession.alice, aliceMsg);
    } catch {
      eveBlocked = true;
    }
    assert(eveBlocked, "a third party with a different session cannot decrypt Alice's message");

    // ── 6. Classical fallback: bundle with NO pqkem → sessions are classical ──
    assert(aliceSession.alice.pq === false, "classical bundle → Alice session pq=false (fallback)");
    assert(bobSession.alice.pq === false, "classical bundle → Bob session pq=false (fallback)");

    // ── 7. Hybrid PQXDH handshake (bundle carries signed ML-KEM prekey) ───────
    const pqBobIkSign = DR.generateSigningKeyPair();
    const pqBobIK = DR.generateOneTimePreKeys(1)[0];
    const pqBobSPK = DR.generateOneTimePreKeys(1)[0];
    const pqBobOPK = DR.generateOneTimePreKeys(1)[0];
    const pqBobKem = DR.generateKemKeyPair();
    const pqSpkSig = DR.signSPK(pqBobSPK.pub, pqBobIkSign.priv);
    const pqKemSig = DR.signKemPreKey(pqBobKem.pub, pqBobIkSign.priv);

    const pqBundle = {
      ikPublicKey: pqBobIK.pub,
      spkPublicKey: pqBobSPK.pub,
      opkPublicKey: pqBobOPK.pub,
      spkSignature: pqSpkSig,
      ikSignPublicKey: pqBobIkSign.pub,
      pqkemPublicKey: pqBobKem.pub,
      pqkemSignature: pqKemSig,
    };

    // Bob's KEM private key must never leak into the bundle.
    assert(
      !collectStrings(pqBundle).includes(pqBobKem.priv),
      "PQ bundle contains NO ML-KEM private key",
    );

    const pqAliceIK = DR.generateOneTimePreKeys(1)[0];
    const { session: pqAliceSession, x3dhHeader: pqHeader } =
      DR.initSessionAliceWithHeader(pqBundle, pqAliceIK.priv, pqAliceIK.pub);

    assert(pqAliceSession.alice.pq === true, "PQ bundle → Alice session pq=true (hybrid)");
    assert(typeof pqHeader.pqkemCt === "string" && pqHeader.pqkemCt.length > 0,
      "X3DH header carries ML-KEM encapsulation ciphertext (pqkemCt)");
    assert(!collectStrings(pqHeader).includes(pqBobKem.priv),
      "X3DH header does NOT contain Bob's ML-KEM private key");

    const pqBobSession = DR.initSessionBobFromHeader(
      pqHeader,
      pqBobIK.priv,
      pqBobIK.pub,
      pqBobSPK.priv,
      pqBobSPK.pub,
      pqBobOPK.priv,
      pqBobKem.priv,
    );
    assert(pqBobSession.alice.pq === true, "PQ header + KEM priv → Bob session pq=true (hybrid)");

    // Hybrid agreement: Alice's first message decrypts under Bob. Because Alice
    // ratchets immediately on init her RK diverges from Bob's by design, so the
    // meaningful invariant is that the SHARED hybrid SK (X25519 ‖ ML-KEM) yields
    // a matching chain — i.e. the message actually decrypts.
    const { state: pqAlice1, message: pqMsg1 } =
      DR.ratchetEncrypt(pqAliceSession.alice, "hybrid hello");
    const { state: pqBob1, plaintext: pqPlain1 } =
      DR.ratchetDecrypt(pqBobSession.alice, pqMsg1);
    assert(
      pqPlain1 === "hybrid hello",
      "hybrid PQXDH: Alice's first message decrypts under Bob (shared X25519 ‖ ML-KEM SK)",
    );

    // ── 8. PQ-ct tamper rejection: corrupt pqkemCt → Bob can't decrypt ───────
    const tamperedHeader = { ...pqHeader };
    // Flip a hex nibble in the middle of the KEM ciphertext.
    const ctMid = Math.floor(tamperedHeader.pqkemCt.length / 2);
    const flip = tamperedHeader.pqkemCt[ctMid] === "a" ? "b" : "a";
    tamperedHeader.pqkemCt =
      tamperedHeader.pqkemCt.slice(0, ctMid) + flip + tamperedHeader.pqkemCt.slice(ctMid + 1);
    const tamperedBob = DR.initSessionBobFromHeader(
      tamperedHeader,
      pqBobIK.priv,
      pqBobIK.pub,
      pqBobSPK.priv,
      pqBobSPK.pub,
      pqBobOPK.priv,
      pqBobKem.priv,
    );
    let pqTamperBlocked = false;
    try {
      DR.ratchetDecrypt(tamperedBob.alice, pqMsg1);
    } catch {
      pqTamperBlocked = true;
    }
    assert(
      pqTamperBlocked,
      "tampered pqkemCt → Bob CANNOT decrypt Alice's message (KEM secret bound into hybrid SK)",
    );

    // ── 9. Continuous PQ rekey: multi-turn, reorder, and bursts ──────────────
    let pqAlice = pqAlice1;
    let pqBob = pqBob1;

    // (a) In-order ping/pong forces DH+KEM ratchet steps in both directions.
    const pqRounds = [
      ["alice", "pq ping 1"],
      ["bob", "pq pong 1"],
      ["alice", "pq ping 2"],
      ["bob", "pq pong 2"],
      ["alice", "pq ping 3"],
    ];
    let pqInOrderOk = true;
    for (const [sender, text] of pqRounds) {
      if (sender === "alice") {
        const { state: ns, message } = DR.ratchetEncrypt(pqAlice, text);
        pqAlice = ns;
        const { state: nr, plaintext } = DR.ratchetDecrypt(pqBob, message);
        pqBob = nr;
        if (plaintext !== text) pqInOrderOk = false;
      } else {
        const { state: ns, message } = DR.ratchetEncrypt(pqBob, text);
        pqBob = ns;
        const { state: nr, plaintext } = DR.ratchetDecrypt(pqAlice, message);
        pqAlice = nr;
        if (plaintext !== text) pqInOrderOk = false;
      }
    }
    assert(pqInOrderOk, "continuous PQ rekey: in-order bidirectional messages all decrypt");
    assert(pqAlice.pq === true && pqBob.pq === true, "PQ flag persists across continuous rekey");

    // (b) Burst: Alice sends several consecutive messages (same sending chain).
    const burst = ["burst a", "burst b", "burst c", "burst d"];
    const burstMsgs = [];
    let burstOk = true;
    for (const text of burst) {
      const { state: ns, message } = DR.ratchetEncrypt(pqAlice, text);
      pqAlice = ns;
      burstMsgs.push({ text, message });
    }
    for (const { text, message } of burstMsgs) {
      const { state: nr, plaintext } = DR.ratchetDecrypt(pqBob, message);
      pqBob = nr;
      if (plaintext !== text) burstOk = false;
    }
    assert(burstOk, "continuous PQ rekey: a 4-message burst decrypts in order");

    // (c) Reorder: encrypt three, deliver out of order (2,0,1) — skipped keys.
    const reorderTexts = ["reorder 0", "reorder 1", "reorder 2"];
    const reorderMsgs = [];
    for (const text of reorderTexts) {
      const { state: ns, message } = DR.ratchetEncrypt(pqAlice, text);
      pqAlice = ns;
      reorderMsgs.push({ text, message });
    }
    let reorderOk = true;
    for (const idx of [2, 0, 1]) {
      const { state: nr, plaintext } = DR.ratchetDecrypt(pqBob, reorderMsgs[idx].message);
      pqBob = nr;
      if (plaintext !== reorderTexts[idx]) reorderOk = false;
    }
    assert(reorderOk, "continuous PQ rekey: out-of-order delivery decrypts via skipped keys");

    // ── 10. State validation: pq=true MUST carry a valid PQs keypair ─────────
    assert(
      DR.isValidRatchetState(pqBob),
      "valid hybrid ratchet state passes isValidRatchetState",
    );
    // Corrupt a hybrid state by stripping PQs while keeping pq=true → reject.
    const brokenPq = { ...pqBob, PQs: undefined };
    assert(
      DR.isValidRatchetState(brokenPq) === false,
      "pq=true with missing PQs is REJECTED (prevents silent de-sync)",
    );
    // Legacy classical state (no PQ fields, pq=false) still validates.
    assert(
      DR.isValidRatchetState(aliceState),
      "legacy classical ratchet state (no PQ fields) still validates",
    );
  } finally {
    fs.unlinkSync(tmp);
  }

  if (failures > 0) {
    console.error(`\nFAILED: ${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log("\nPASSED: real two-party X3DH handshake, no private-key sharing.");
}

main().catch((err) => {
  console.error("Handshake test crashed:", err);
  process.exit(1);
});
