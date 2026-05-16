/**
 * SMS satellite fallback for panic / duress (Task #113).
 *
 * Pure helpers + a single side-effecting handoff to the OS SMS composer.
 *
 *  ── SILENCE CONTRACT ─────────────────────────────────────────────────────
 *  The handoff path MUST NOT invoke any of:
 *    - expo-haptics
 *    - expo-av (Audio)
 *    - any toast library
 *    - React Native's `Alert.alert(...)`
 *  The static check in `scripts/check-panic-wipe-silence.js` enforces this
 *  by scanning the body of `handoffSmsFallback` for those tokens. Don't
 *  add perceptible feedback here — a bystander watching the panic-wipe
 *  must not be able to tell SMS was sent.
 *
 *  The only side effect we allow is `Linking.openURL("sms:...")`, which on
 *  iOS and Android opens the OS SMS composer pre-filled with the recipient
 *  and body. The composer itself is platform UI that the spec explicitly
 *  permits ("with no UI dialog if the platform permits, otherwise the one
 *  platform-required composer").
 */

import { Linking, Platform } from "react-native";

/** Maximum number of fallback recipients the user may save. */
export const MAX_SMS_FALLBACK_NUMBERS = 3;

/**
 * Default fallback body. Deliberately information-poor:
 *   - no contact list
 *   - no location
 *   - no message body from the chat history
 *   - no per-recipient personalization
 * A bystander reading the trusted recipient's phone learns only that the
 * sender pressed panic. This is the "one-line distress ping" the task spec
 * mandates.
 */
export const DEFAULT_SMS_FALLBACK_MESSAGE =
  "GHOSTFACE: distress signal — this is an automated message.";

/**
 * Maximum length of the user-editable fallback message body. Kept short so
 * the whole thing fits in a single SMS segment (160 chars in GSM-7) and so
 * a malicious / careless user cannot stuff personal data into it.
 */
export const MAX_SMS_FALLBACK_MESSAGE_LEN = 140;

/**
 * E.164: leading `+`, country-code digit 1-9, then 6-14 more digits.
 * Total 7-15 digits per ITU-T E.164. We reject any local-format input
 * (no `+`) to avoid silently sending to the wrong country.
 */
const E164_RE = /^\+[1-9]\d{6,14}$/;

/**
 * Strip incidental whitespace, dashes, parens, dots, then validate against
 * E.164. Returns the normalized string on success, null on failure.
 */
export function normalizeE164(input: string): string | null {
  if (typeof input !== "string") return null;
  const stripped = input.replace(/[\s\-().]/g, "");
  if (!E164_RE.test(stripped)) return null;
  return stripped;
}

export function isValidE164(input: string): boolean {
  return normalizeE164(input) !== null;
}

/**
 * Sanitize a candidate fallback-message body. Trims, collapses internal
 * runs of whitespace, and truncates to `MAX_SMS_FALLBACK_MESSAGE_LEN`.
 * Newlines are kept as single spaces so a leaked SMS body cannot smuggle
 * structured payloads.
 */
export function sanitizeFallbackMessage(input: string): string {
  if (typeof input !== "string") return DEFAULT_SMS_FALLBACK_MESSAGE;
  const collapsed = input.replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) return DEFAULT_SMS_FALLBACK_MESSAGE;
  if (collapsed.length > MAX_SMS_FALLBACK_MESSAGE_LEN) {
    return collapsed.slice(0, MAX_SMS_FALLBACK_MESSAGE_LEN);
  }
  return collapsed;
}

/**
 * Parse and validate a JSON-encoded array of E.164 numbers loaded from
 * SecureStore. Drops invalid entries, dedupes, and caps at
 * `MAX_SMS_FALLBACK_NUMBERS`. Never throws.
 */
export function parseStoredNumbers(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const entry of parsed) {
      if (typeof entry !== "string") continue;
      const n = normalizeE164(entry);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      out.push(n);
      if (out.length >= MAX_SMS_FALLBACK_NUMBERS) break;
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Build the platform-specific `sms:` URL. Accepts one or more recipients;
 * multiple recipients are joined with comma which both iOS and Android
 * SMS composers parse as a multi-recipient list. iOS uses
 * `sms:N1,N2&body=...`; Android uses `sms:N1,N2?body=...`.
 *
 * We deliberately produce ONE URL for all recipients (not one URL per
 * recipient) so the OS composer pops up at most once during panic. Multiple
 * back-to-back `openURL` calls would create visible composer churn that a
 * bystander could read as panic activity — and per the silence contract the
 * wipe must look like nothing happened.
 */
export function buildSmsUrl(
  numberOrNumbers: string | readonly string[],
  body: string,
  platform: string = Platform.OS,
): string {
  const sep = platform === "ios" ? "&" : "?";
  const joined = Array.isArray(numberOrNumbers)
    ? numberOrNumbers.join(",")
    : (numberOrNumbers as string);
  return `sms:${joined}${sep}body=${encodeURIComponent(body)}`;
}

/**
 * Hand the prebuilt distress ping to the OS SMS composer in a SINGLE
 * `Linking.openURL` call addressed to every saved recipient at once. We do
 * NOT loop one-open-per-number on purpose: sequential composer transitions
 * are visible UI churn that betrays the panic-wipe path to a bystander.
 * One handoff, one composer, one user-visible artifact (which the spec
 * explicitly permits as the "one platform-required composer").
 *
 * SILENCE CONTRACT: this function MUST NOT invoke Haptics, Audio, Toast,
 * or Alert. The only allowed side effect is `Linking.openURL(...)`.
 * See `scripts/check-panic-wipe-silence.js` for the static guard.
 *
 * Returns the number of recipients in the composed handoff (0 if none of
 * the inputs were valid E.164 or if the openURL call threw).
 */
export async function handoffSmsFallback(
  numbers: readonly string[],
  message: string,
): Promise<number> {
  const valid: string[] = [];
  const seen = new Set<string>();
  for (const raw of numbers) {
    const n = normalizeE164(raw);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    valid.push(n);
  }
  if (valid.length === 0) return 0;
  try {
    const url = buildSmsUrl(valid, message);
    await Linking.openURL(url);
    return valid.length;
  } catch (err) {
    // Silent failure — the silence contract forbids surfacing this.
    // Log to dev console only; never to a Toast/Alert/Haptic.
    if (__DEV__) console.warn("[smsFallback] handoff failed", err);
    return 0;
  }
}
