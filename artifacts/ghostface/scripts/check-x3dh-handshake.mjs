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
