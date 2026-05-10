#!/usr/bin/env node
/**
 * check-panic-wipe-silence.js
 *
 * Static-analysis guard for the panicWipe silence contract.
 *
 * Rules:
 *  1. The `panicWipe` useCallback body in AppContext.tsx must not contain
 *     any Haptics.* or Audio.* call.
 *  2. The duress setInterval callback in lock.tsx must not contain
 *     any Haptics.* or Audio.* call.
 *
 * Exit 0 → contract intact.
 * Exit 1 → violation found (or file could not be parsed).
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ── helpers ────────────────────────────────────────────────────────────────────

/** Extract the body of the first function that starts after `startMarker`
 *  in `src`, using brace counting.  Returns null if not found.
 */
function extractFunctionBody(src, startMarker) {
  const markerIdx = src.indexOf(startMarker);
  if (markerIdx === -1) return null;

  // Find the opening '{' at or after the marker
  let braceStart = src.indexOf("{", markerIdx);
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
  return null; // unmatched braces
}

/** Return every line that matches the forbidden pattern, with 1-based line numbers
 *  relative to the full source file, given a body extracted from `fullSrc`.
 */
function findViolations(body, fullSrc, forbiddenRe) {
  const bodyStart = fullSrc.indexOf(body);
  const prefix = fullSrc.slice(0, bodyStart);
  const lineOffset = (prefix.match(/\n/g) || []).length; // 0-based line index of body start

  const violations = [];
  const lines = body.split("\n");
  lines.forEach((line, idx) => {
    if (forbiddenRe.test(line)) {
      violations.push({ lineNo: lineOffset + idx + 1, text: line.trim() });
    }
  });
  return violations;
}

// ── configuration ──────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..");

const CHECKS = [
  {
    label: "panicWipe() in AppContext.tsx",
    file: path.join(ROOT, "context", "AppContext.tsx"),
    // The useCallback that defines panicWipe
    startMarker: "const panicWipe = useCallback(async () => {",
  },
  {
    label: "duress setInterval callback in lock.tsx",
    file: path.join(ROOT, "app", "lock.tsx"),
    // The setInterval that fires panicWipe after the grace period
    startMarker: "duressIntervalRef.current = setInterval(() => {",
  },
];

// Any Haptics.xxx(...) or Audio.xxx(...) call
const FORBIDDEN = /\b(Haptics|Audio)\s*\.\s*\w+\s*\(/;

// ── main ───────────────────────────────────────────────────────────────────────

let exitCode = 0;

for (const check of CHECKS) {
  let src;
  try {
    src = fs.readFileSync(check.file, "utf8");
  } catch (err) {
    console.error(`[FAIL] Cannot read ${check.file}: ${err.message}`);
    exitCode = 1;
    continue;
  }

  const body = extractFunctionBody(src, check.startMarker);
  if (!body) {
    console.error(
      `[FAIL] Could not locate "${check.startMarker}" in ${check.file}.\n` +
        `       The marker text may have changed — update check-panic-wipe-silence.js to match.`
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

if (exitCode === 0) {
  console.log("\nAll silence-contract checks passed.");
} else {
  console.error(
    "\nSilence-contract check FAILED.\n" +
      "Remove any Haptics.* / Audio.* calls from panicWipe and the duress interval."
  );
}

process.exit(exitCode);
