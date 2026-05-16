#!/usr/bin/env node
/**
 * check-panic-wipe-silence.js
 *
 * Static-analysis guards for two privacy-critical contracts:
 *
 *  ── SILENCE CONTRACT ─────────────────────────────────────────────────────
 *  1. The `panicWipe` useCallback body in AppContext.tsx must not contain
 *     any Haptics.* or Audio.* call.
 *  2. The duress setInterval callback in lock.tsx must not contain
 *     any Haptics.* or Audio.* call.
 *
 *  ── DEPARTURE CONTRACT ───────────────────────────────────────────────────
 *  3. `panicWipe` must broadcast `{ type: "departed", toAliases }` BEFORE it
 *     clears local state (otherwise the WS is already gone by the time we
 *     try to notify peers).
 *  4. The incoming-message handler in AppContext.tsx must contain a branch
 *     that flips `destroyedAt` when it receives `type === "departed"`.
 *  5. The messages list (`app/(tabs)/messages.tsx`) must render a
 *     SELF-DESTRUCTED badge gated on `destroyedAt`.
 *  6. The chat screen (`app/chat/[id].tsx`) must render a sealed banner
 *     gated on `conv.destroyedAt`.
 *
 * Exit 0 → all contracts intact.
 * Exit 1 → at least one violation found.
 *
 * This script is the regression guard for Task #104 (end-to-end coverage of
 * the self-destruct flow). It is intentionally static analysis because the
 * `ghostface` artifact has no JS test runner; the server side is covered by
 * `src/__tests__/departures.test.ts`.
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ── helpers ────────────────────────────────────────────────────────────────────

/** Extract the body of the first function/object expression that starts at or
 *  after `startMarker` in `src`, using brace counting. Returns null if not found.
 */
function extractBracedBody(src, startMarker) {
  const markerIdx = src.indexOf(startMarker);
  if (markerIdx === -1) return null;

  const braceStart = src.indexOf("{", markerIdx);
  if (braceStart === -1) return null;

  let depth = 0;
  let i = braceStart;
  while (i < src.length) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        return src.slice(braceStart, i + 1);
      }
    }
    i++;
  }
  return null;
}

function findViolations(body, fullSrc, forbiddenRe) {
  const bodyStart = fullSrc.indexOf(body);
  const prefix = fullSrc.slice(0, bodyStart);
  const lineOffset = (prefix.match(/\n/g) || []).length;

  const violations = [];
  const lines = body.split("\n");
  lines.forEach((line, idx) => {
    if (forbiddenRe.test(line)) {
      violations.push({ lineNo: lineOffset + idx + 1, text: line.trim() });
    }
  });
  return violations;
}

const ROOT = path.resolve(__dirname, "..");
const APP_CONTEXT = path.join(ROOT, "context", "AppContext.tsx");
const LOCK_SCREEN = path.join(ROOT, "app", "lock.tsx");
const MESSAGES_LIST = path.join(ROOT, "app", "(tabs)", "messages.tsx");
const CHAT_SCREEN = path.join(ROOT, "app", "chat", "[id].tsx");

function readOrBail(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (err) {
    console.error(`[FAIL] Cannot read ${file}: ${err.message}`);
    return null;
  }
}

// ── silence-contract checks (legacy) ──────────────────────────────────────────

const SILENCE_CHECKS = [
  {
    label: "panicWipe() in AppContext.tsx",
    file: APP_CONTEXT,
    startMarker: "const panicWipe = useCallback(async () => {",
  },
  {
    label: "duress setInterval callback in lock.tsx",
    file: LOCK_SCREEN,
    startMarker: "duressIntervalRef.current = setInterval(() => {",
  },
];

const FORBIDDEN = /\b(Haptics|Audio)\s*\.\s*\w+\s*\(/;

let exitCode = 0;

for (const check of SILENCE_CHECKS) {
  const src = readOrBail(check.file);
  if (src == null) {
    exitCode = 1;
    continue;
  }
  const body = extractBracedBody(src, check.startMarker);
  if (!body) {
    console.error(
      `[FAIL] Could not locate "${check.startMarker}" in ${check.file}.\n` +
        `       The marker text may have changed — update this script to match.`,
    );
    exitCode = 1;
    continue;
  }
  const violations = findViolations(body, src, FORBIDDEN);
  if (violations.length === 0) {
    console.log(`[PASS] ${check.label} — no Haptics/Audio calls found.`);
  } else {
    console.error(`[FAIL] ${check.label} — silence contract violated!`);
    for (const v of violations) {
      console.error(`       line ${v.lineNo}: ${v.text}`);
    }
    exitCode = 1;
  }
}

// ── departure-contract checks ─────────────────────────────────────────────────

function pass(label) {
  console.log(`[PASS] ${label}`);
}

function fail(label, detail) {
  console.error(`[FAIL] ${label}${detail ? "\n       " + detail : ""}`);
  exitCode = 1;
}

const appCtxSrc = readOrBail(APP_CONTEXT);
if (appCtxSrc) {
  const panicBody = extractBracedBody(
    appCtxSrc,
    "const panicWipe = useCallback(async () => {",
  );

  // 3a. panicWipe must broadcast {type:"departed", toAliases:[...]} ...
  if (panicBody && /type:\s*["']departed["']/.test(panicBody) && /toAliases/.test(panicBody)) {
    // 3b. ... and the broadcast must appear BEFORE local state is cleared.
    const departedIdx = panicBody.search(/type:\s*["']departed["']/);
    const clearIdx = panicBody.indexOf("setState({");
    if (clearIdx !== -1 && departedIdx > clearIdx) {
      fail(
        "panicWipe broadcasts departed AFTER clearing state",
        "Move the departure broadcast above setState({ alias: null, ... }) so the WS is still open when we notify peers.",
      );
    } else {
      pass(
        "panicWipe broadcasts {type:\"departed\", toAliases} before clearing local state",
      );
    }
  } else {
    fail(
      "panicWipe does not broadcast a departed notice",
      "Expected a ws.send(JSON.stringify({ type: \"departed\", toAliases: [...] })) before the wipe.",
    );
  }

  // 4. Incoming-message handler must flip destroyedAt on type === "departed".
  const departedBranchRe =
    /wsMsg\.type\s*===\s*["']departed["'][\s\S]{0,800}?destroyedAt:\s*\w+/m;
  if (departedBranchRe.test(appCtxSrc)) {
    pass("incoming \"departed\" handler sets destroyedAt on the matching conversation");
  } else {
    fail(
      "incoming \"departed\" handler is missing or does not set destroyedAt",
      "Expected a branch like: if (wsMsg.type === \"departed\" && wsMsg.from) { ... destroyedAt: stamp ... }",
    );
  }
}

// 5. messages.tsx renders SELF-DESTRUCTED badge gated on destroyedAt.
const messagesSrc = readOrBail(MESSAGES_LIST);
if (messagesSrc) {
  const hasBadge = /SELF-DESTRUCTED/.test(messagesSrc);
  const hasGate = /item\.destroyedAt/.test(messagesSrc);
  if (hasBadge && hasGate) {
    pass("messages list renders SELF-DESTRUCTED badge gated on item.destroyedAt");
  } else {
    fail(
      "messages list missing destroyedAt-gated SELF-DESTRUCTED badge",
      `expected both the badge text and an item.destroyedAt branch in ${MESSAGES_LIST}`,
    );
  }
}

// 6. chat/[id].tsx renders sealed banner gated on conv.destroyedAt.
const chatSrc = readOrBail(CHAT_SCREEN);
if (chatSrc) {
  const hasBanner = /CONTACT SELF-DESTRUCTED/.test(chatSrc);
  const hasGate = /conv\.destroyedAt/.test(chatSrc);
  if (hasBanner && hasGate) {
    pass("chat screen renders sealed banner gated on conv.destroyedAt");
  } else {
    fail(
      "chat screen missing destroyedAt-gated sealed banner",
      `expected both the banner text and a conv.destroyedAt branch in ${CHAT_SCREEN}`,
    );
  }
}

// 7. image-ref attachment validation must REJECT any incoming `uri` field.
//    Wire payloads carrying a uri on image-ref would let a malicious peer
//    inject an arbitrary URL into the receiver's <Image>, causing the
//    client to fetch attacker-controlled URLs (IP/metadata leak). Task
//    #101 regression guard.
if (appCtxSrc) {
  // Match the image-ref branch in isValidAttachment and check that it
  // rejects any `uri` field. Brace-counted extraction so reordering
  // sibling checks doesn't break the test.
  const branchStart = appCtxSrc.indexOf('att.kind === "image-ref"');
  let imageRefBlock = "";
  if (branchStart !== -1) {
    const blockOpen = appCtxSrc.indexOf("{", branchStart);
    if (blockOpen !== -1) {
      let depth = 0;
      for (let i = blockOpen; i < appCtxSrc.length; i++) {
        const c = appCtxSrc[i];
        if (c === "{") depth++;
        else if (c === "}") {
          depth--;
          if (depth === 0) {
            imageRefBlock = appCtxSrc.slice(blockOpen, i + 1);
            break;
          }
        }
      }
    }
  }
  const rejectsUri = /att\.uri\s*!==\s*undefined[\s\S]{0,80}?return\s+false/.test(
    imageRefBlock,
  );
  if (rejectsUri) {
    pass("isValidAttachment rejects incoming image-ref payloads that carry a uri field");
  } else {
    fail(
      "isValidAttachment does not reject image-ref payloads with a `uri` field",
      "image-ref's `uri` is local-only. Accepting it from the wire would let a peer\n" +
        "force the receiver's <Image> to fetch an attacker-controlled URL.\n" +
        "Expected something like: if (att.uri !== undefined) return false;",
    );
  }
}

// 8. evaluateExpiredHandshake() must enforce ALL four guard conditions in
//    AppContext.tsx so a healthy conversation is never sealed by accident.
//    Task #102 regression guard.
if (appCtxSrc) {
  // Anchor past the return-type object literal so extractBracedBody picks
  // up the function body, not the return-type braces.
  const helperAnchor = appCtxSrc.indexOf("export function evaluateExpiredHandshake(");
  const helperBody =
    helperAnchor === -1
      ? null
      : extractBracedBody(appCtxSrc.slice(helperAnchor), "} | null {");
  if (!helperBody) {
    fail(
      "evaluateExpiredHandshake() helper is missing in AppContext.tsx",
      "Expected an exported function that returns null unless ALL four expiry conditions hold.",
    );
  } else {
    const checks = [
      { re: /c\.destroyedAt/, name: "destroyedAt guard" },
      { re: /c\.isRealContact/, name: "isRealContact guard" },
      { re: /c\.pendingX3DHHeader/, name: "pendingX3DHHeader guard" },
      { re: /!m\.fromMe\s*&&\s*!m\.system/, name: "peer-reply guard" },
      { re: /24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/, name: "24-hour age guard" },
    ];
    const missing = checks.filter((c) => !c.re.test(helperBody)).map((c) => c.name);
    if (missing.length === 0) {
      pass("evaluateExpiredHandshake enforces all four handshake-expiry guards");
    } else {
      fail(
        "evaluateExpiredHandshake is missing required guard(s)",
        `Missing: ${missing.join(", ")}. Without these the helper can seal a healthy conversation.`,
      );
    }
  }

  // 9. A background sweep must invoke evaluateExpiredHandshake on a timer
  //    so stalled handshakes are detected without user action.
  // The sweep is implemented as a named closure that calls the helper and
  // is then handed to setInterval; the two references can be 400+ chars
  // apart, so widen the window. We require BOTH references to appear
  // within the same useEffect-style block.
  const sweepRe =
    /setInterval\([\s\S]{0,1500}?evaluateExpiredHandshake|evaluateExpiredHandshake[\s\S]{0,1500}?setInterval/;
  if (sweepRe.test(appCtxSrc)) {
    pass("background sweep wires evaluateExpiredHandshake to setInterval");
  } else {
    fail(
      "no background sweep calls evaluateExpiredHandshake",
      "Expected a setInterval that runs evaluateExpiredHandshake over conversations so stalled\n" +
        "handshakes seal without requiring the user to open the chat or send a message.",
    );
  }
}

// ── summary ────────────────────────────────────────────────────────────────────

if (exitCode === 0) {
  console.log("\nAll silence + departure contract checks passed.");
} else {
  console.error(
    "\nContract check FAILED.\n" +
      "Restore the silence guarantees (no Haptics/Audio in panicWipe or duress interval) " +
      "and the departure flow (broadcast before wipe, destroyedAt on receive, sealed UI in list + chat).",
  );
}

process.exit(exitCode);
