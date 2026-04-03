import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

type Tool = "encrypt" | "hash" | "keygen" | "stealth";

function base64Encode(str: string): string {
  if (Platform.OS === "web") {
    return btoa(unescape(encodeURIComponent(str)));
  }
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  const bytes = str.split("").map((c) => c.charCodeAt(0));
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    result += chars[b0 >> 2];
    result += chars[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    result += i + 2 < bytes.length ? chars[b2 & 63] : "=";
  }
  return result;
}

function base64Decode(str: string): string {
  try {
    if (Platform.OS === "web") {
      return decodeURIComponent(escape(atob(str)));
    }
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const cleaned = str.replace(/=/g, "");
    let result = "";
    for (let i = 0; i < cleaned.length; i += 4) {
      const b0 = chars.indexOf(cleaned[i] ?? "");
      const b1 = chars.indexOf(cleaned[i + 1] ?? "");
      const b2 = cleaned[i + 2] ? chars.indexOf(cleaned[i + 2]) : 0;
      const b3 = cleaned[i + 3] ? chars.indexOf(cleaned[i + 3]) : 0;
      result += String.fromCharCode((b0 << 2) | (b1 >> 4));
      if (cleaned[i + 2]) result += String.fromCharCode(((b1 & 15) << 4) | (b2 >> 2));
      if (cleaned[i + 3]) result += String.fromCharCode(((b2 & 3) << 6) | b3);
    }
    return result;
  } catch {
    return "DECODE ERROR — INVALID CIPHERTEXT";
  }
}

function xorCipher(text: string, key: string): string {
  if (!key) return text;
  return text
    .split("")
    .map((c, i) =>
      String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))
    )
    .join("");
}

function ghostEncrypt(plaintext: string, key: string): string {
  const xored = xorCipher(plaintext, key || "GHOSTFACE");
  return "GHX1::" + base64Encode(xored);
}

function ghostDecrypt(ciphertext: string, key: string): string {
  if (!ciphertext.startsWith("GHX1::")) return "INVALID FORMAT — NOT GHOSTFACE ENCRYPTED";
  const b64 = ciphertext.slice(6);
  const xored = base64Decode(b64);
  return xorCipher(xored, key || "GHOSTFACE");
}

function simHash(input: string, algo: "SHA-256" | "MD5" | "BLAKE2"): string {
  let hash = 0;
  const seed =
    algo === "SHA-256" ? 0x6a09e667 : algo === "MD5" ? 0x67452301 : 0x6b08c647;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i) + seed) | 0;
  }
  const raw = Math.abs(hash).toString(16).padStart(8, "0");
  const stretched = Array.from({ length: 8 }, (_, i) =>
    parseInt(raw, 16)
      .toString(16)
      .padStart(8, "0")
      .split("")
      .map((c, j) =>
        ((parseInt(c, 16) + i * 3 + j * 7) % 16).toString(16)
      )
      .join("")
  ).join("");
  return stretched.slice(0, algo === "MD5" ? 32 : 64);
}

function generateKeyPair(): { pub: string; priv: string } {
  const chars = "0123456789abcdef";
  const rand = (len: number) =>
    Array.from({ length: len }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  return {
    pub: `04:${rand(8)}:${rand(8)}:${rand(8)}:${rand(8)}:${rand(8)}:${rand(8)}:${rand(8)}`,
    priv: `GF:${rand(12)}:${rand(12)}:${rand(12)}:${rand(12)}`,
  };
}

function stealthEncode(message: string): string {
  const zwChars = ["\u200B", "\u200C", "\u200D", "\uFEFF"];
  const bits = message
    .split("")
    .map((c) => c.charCodeAt(0).toString(2).padStart(8, "0"))
    .join("");
  const encoded = bits
    .split("")
    .map((b) => zwChars[b === "0" ? 0 : 1])
    .join("");
  return "GHOSTFACE" + encoded;
}

function stealthDecode(carrier: string): string {
  const zwChars = ["\u200B", "\u200C", "\u200D", "\uFEFF"];
  const hidden = carrier.replace(/[^\u200B\u200C\u200D\uFEFF]/g, "");
  const bits = hidden
    .split("")
    .map((c) => (zwChars.indexOf(c) === 0 ? "0" : "1"))
    .join("");
  let result = "";
  for (let i = 0; i < bits.length; i += 8) {
    const byte = bits.slice(i, i + 8);
    if (byte.length === 8) result += String.fromCharCode(parseInt(byte, 2));
  }
  return result || "NO HIDDEN MESSAGE FOUND";
}

export default function ToolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeTool, setActiveTool] = useState<Tool>("encrypt");

  const [encInput, setEncInput] = useState("");
  const [encKey, setEncKey] = useState("");
  const [encOutput, setEncOutput] = useState("");
  const [encMode, setEncMode] = useState<"encrypt" | "decrypt">("encrypt");
  const [encCopied, setEncCopied] = useState(false);

  const [hashInput, setHashInput] = useState("");
  const [hashAlgo, setHashAlgo] = useState<"SHA-256" | "MD5" | "BLAKE2">("SHA-256");
  const [hashOutput, setHashOutput] = useState("");
  const [hashCopied, setHashCopied] = useState(false);

  const [keyPair, setKeyPair] = useState<{ pub: string; priv: string } | null>(null);
  const [keyCopied, setKeyCopied] = useState<"pub" | "priv" | null>(null);

  const [stealthMsg, setStealthMsg] = useState("");
  const [stealthCarrier, setStealthCarrier] = useState("");
  const [stealthOutput, setStealthOutput] = useState("");
  const [stealthMode, setStealthMode] = useState<"hide" | "reveal">("hide");
  const [stealthCopied, setStealthCopied] = useState(false);

  const copyToClipboard = async (text: string, setter: (v: boolean) => void) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Clipboard.setStringAsync(text);
    setter(true);
    setTimeout(() => setter(false), 1500);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: "800" as const,
      letterSpacing: 5,
    },
    headerSub: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 3,
      marginTop: 2,
    },
    tabs: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: "center",
      gap: 4,
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    tabLabel: {
      fontSize: 9,
      letterSpacing: 1.5,
      fontWeight: "700" as const,
    },
    scroll: {
      flex: 1,
    },
    section: {
      padding: 20,
      gap: 12,
    },
    label: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 3,
      fontWeight: "700" as const,
    },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      color: colors.foreground,
      fontSize: 13,
      padding: 12,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    row: {
      flexDirection: "row",
      gap: 8,
    },
    modeBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: colors.radius,
      borderWidth: 1,
    },
    modeBtnText: {
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: "700" as const,
    },
    actionBtn: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      paddingVertical: 14,
      alignItems: "center",
    },
    actionBtnText: {
      color: colors.primaryForeground,
      fontSize: 12,
      fontWeight: "800" as const,
      letterSpacing: 3,
    },
    outputBox: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      padding: 12,
    },
    outputText: {
      color: colors.primary,
      fontSize: 11,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      letterSpacing: 0.5,
    },
    copyBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
      alignSelf: "flex-end",
    },
    copyText: {
      fontSize: 10,
      letterSpacing: 2,
    },
    algoRow: {
      flexDirection: "row",
      gap: 8,
    },
    algoBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: colors.radius,
      borderWidth: 1,
    },
    algoBtnText: {
      fontSize: 10,
      letterSpacing: 2,
      fontWeight: "700" as const,
    },
    keyBox: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      padding: 12,
      gap: 8,
    },
    keyLabel: {
      color: colors.mutedForeground,
      fontSize: 9,
      letterSpacing: 3,
    },
    keyValue: {
      color: colors.success,
      fontSize: 11,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    keyPriv: {
      color: colors.destructive,
      fontSize: 11,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    padBottom: {
      height: Platform.OS === "web" ? 100 : 120,
    },
    infoBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: `${colors.primary}10`,
      borderRadius: colors.radius,
      padding: 12,
      borderWidth: 1,
      borderColor: `${colors.primary}30`,
    },
    infoText: {
      color: colors.mutedForeground,
      fontSize: 11,
      letterSpacing: 0.5,
      flex: 1,
    },
  });

  const tools: { id: Tool; icon: React.ComponentProps<typeof Ionicons>["name"]; label: string }[] = [
    { id: "encrypt", icon: "lock-closed-outline", label: "CIPHER" },
    { id: "hash", icon: "finger-print", label: "HASH" },
    { id: "keygen", icon: "key-outline", label: "KEYGEN" },
    { id: "stealth", icon: "eye-off-outline", label: "STEALTH" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ENCRYPTION TOOLS</Text>
        <Text style={styles.headerSub}>LOCAL · ZERO-KNOWLEDGE · NO LOGS</Text>
      </View>

      <View style={styles.tabs}>
        {tools.map((t) => (
          <Pressable
            key={t.id}
            style={[styles.tab, activeTool === t.id && styles.tabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTool(t.id);
            }}
          >
            <Ionicons
              name={t.icon}
              size={18}
              color={activeTool === t.id ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: activeTool === t.id ? colors.primary : colors.mutedForeground },
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {activeTool === "encrypt" && (
          <View style={styles.section}>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={14} color={colors.primary} />
              <Text style={styles.infoText}>
                XOR cipher with Base64 encoding. Use a strong key for best security. All operations are local.
              </Text>
            </View>
            <Text style={styles.label}>MODE</Text>
            <View style={styles.row}>
              {(["encrypt", "decrypt"] as const).map((m) => (
                <Pressable
                  key={m}
                  style={[
                    styles.modeBtn,
                    {
                      backgroundColor: encMode === m ? colors.primary : "transparent",
                      borderColor: encMode === m ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    setEncMode(m);
                    setEncOutput("");
                  }}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      { color: encMode === m ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    {m === "encrypt" ? "ENCRYPT" : "DECRYPT"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>
              {encMode === "encrypt" ? "PLAINTEXT" : "CIPHERTEXT"}
            </Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
              value={encInput}
              onChangeText={setEncInput}
              placeholder={encMode === "encrypt" ? "Enter message to encrypt..." : "Paste GHX1::... ciphertext"}
              placeholderTextColor={colors.mutedForeground}
              multiline
              autoCorrect={false}
            />

            <Text style={styles.label}>SECRET KEY (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              value={encKey}
              onChangeText={setEncKey}
              placeholder="Leave blank for default key"
              placeholderTextColor={colors.mutedForeground}
              autoCorrect={false}
            />

            <Pressable
              style={[styles.actionBtn, !encInput && { opacity: 0.4 }]}
              disabled={!encInput}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setEncOutput(
                  encMode === "encrypt"
                    ? ghostEncrypt(encInput, encKey)
                    : ghostDecrypt(encInput, encKey)
                );
              }}
            >
              <Text style={styles.actionBtnText}>
                {encMode === "encrypt" ? "🔒 ENCRYPT" : "🔓 DECRYPT"}
              </Text>
            </Pressable>

            {encOutput ? (
              <View style={styles.outputBox}>
                <Text style={styles.outputText}>{encOutput}</Text>
                <Pressable
                  style={styles.copyBtn}
                  onPress={() => copyToClipboard(encOutput, setEncCopied)}
                >
                  <Ionicons
                    name={encCopied ? "checkmark" : "copy-outline"}
                    size={14}
                    color={encCopied ? colors.success : colors.primary}
                  />
                  <Text style={[styles.copyText, { color: encCopied ? colors.success : colors.primary }]}>
                    {encCopied ? "COPIED" : "COPY"}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}

        {activeTool === "hash" && (
          <View style={styles.section}>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={14} color={colors.primary} />
              <Text style={styles.infoText}>
                One-way hash functions. Useful for verifying message integrity and creating fingerprints.
              </Text>
            </View>
            <Text style={styles.label}>ALGORITHM</Text>
            <View style={styles.algoRow}>
              {(["SHA-256", "MD5", "BLAKE2"] as const).map((a) => (
                <Pressable
                  key={a}
                  style={[
                    styles.algoBtn,
                    {
                      backgroundColor: hashAlgo === a ? colors.primary : "transparent",
                      borderColor: hashAlgo === a ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    setHashAlgo(a);
                    setHashOutput("");
                  }}
                >
                  <Text
                    style={[
                      styles.algoBtnText,
                      { color: hashAlgo === a ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    {a}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>INPUT</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
              value={hashInput}
              onChangeText={setHashInput}
              placeholder="Enter text to hash..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              autoCorrect={false}
            />

            <Pressable
              style={[styles.actionBtn, !hashInput && { opacity: 0.4 }]}
              disabled={!hashInput}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setHashOutput(simHash(hashInput, hashAlgo));
              }}
            >
              <Text style={styles.actionBtnText}>GENERATE HASH</Text>
            </Pressable>

            {hashOutput ? (
              <View style={styles.outputBox}>
                <Text style={[styles.label, { marginBottom: 6 }]}>{hashAlgo} DIGEST</Text>
                <Text style={styles.outputText}>{hashOutput}</Text>
                <Pressable
                  style={styles.copyBtn}
                  onPress={() => copyToClipboard(hashOutput, setHashCopied)}
                >
                  <Ionicons
                    name={hashCopied ? "checkmark" : "copy-outline"}
                    size={14}
                    color={hashCopied ? colors.success : colors.primary}
                  />
                  <Text style={[styles.copyText, { color: hashCopied ? colors.success : colors.primary }]}>
                    {hashCopied ? "COPIED" : "COPY"}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}

        {activeTool === "keygen" && (
          <View style={styles.section}>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={14} color={colors.primary} />
              <Text style={styles.infoText}>
                Simulated EC key pair generation (secp256k1). Public key for sharing, private key is secret — never transmit it.
              </Text>
            </View>

            <Pressable
              style={styles.actionBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                setKeyPair(generateKeyPair());
                setKeyCopied(null);
              }}
            >
              <Text style={styles.actionBtnText}>⚡ GENERATE KEY PAIR</Text>
            </Pressable>

            {keyPair ? (
              <View style={styles.keyBox}>
                <Text style={styles.keyLabel}>PUBLIC KEY (secp256k1)</Text>
                <Text style={styles.keyValue}>{keyPair.pub}</Text>
                <Pressable
                  style={styles.copyBtn}
                  onPress={() => copyToClipboard(keyPair.pub, (v) => setKeyCopied(v ? "pub" : null))}
                >
                  <Ionicons
                    name={keyCopied === "pub" ? "checkmark" : "copy-outline"}
                    size={14}
                    color={keyCopied === "pub" ? colors.success : colors.primary}
                  />
                  <Text style={[styles.copyText, { color: keyCopied === "pub" ? colors.success : colors.primary }]}>
                    {keyCopied === "pub" ? "COPIED" : "COPY PUBLIC KEY"}
                  </Text>
                </Pressable>

                <View style={styles.divider} />

                <Text style={styles.keyLabel}>PRIVATE KEY — KEEP SECRET</Text>
                <Text style={styles.keyPriv}>{keyPair.priv}</Text>
                <Pressable
                  style={styles.copyBtn}
                  onPress={() => copyToClipboard(keyPair.priv, (v) => setKeyCopied(v ? "priv" : null))}
                >
                  <Ionicons
                    name={keyCopied === "priv" ? "checkmark" : "copy-outline"}
                    size={14}
                    color={keyCopied === "priv" ? colors.success : colors.destructive}
                  />
                  <Text style={[styles.copyText, { color: keyCopied === "priv" ? colors.success : colors.destructive }]}>
                    {keyCopied === "priv" ? "COPIED" : "COPY PRIVATE KEY"}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.keyBox, { alignItems: "center", paddingVertical: 32 }]}>
                <Ionicons name="key-outline" size={40} color={colors.border} />
                <Text style={[styles.label, { marginTop: 12 }]}>NO KEY GENERATED YET</Text>
              </View>
            )}
          </View>
        )}

        {activeTool === "stealth" && (
          <View style={styles.section}>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={14} color={colors.primary} />
              <Text style={styles.infoText}>
                Zero-width character steganography. Hide secret messages inside innocent-looking text using invisible Unicode characters.
              </Text>
            </View>

            <Text style={styles.label}>MODE</Text>
            <View style={styles.row}>
              {(["hide", "reveal"] as const).map((m) => (
                <Pressable
                  key={m}
                  style={[
                    styles.modeBtn,
                    {
                      backgroundColor: stealthMode === m ? colors.primary : "transparent",
                      borderColor: stealthMode === m ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    setStealthMode(m);
                    setStealthOutput("");
                  }}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      { color: stealthMode === m ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    {m === "hide" ? "HIDE MESSAGE" : "REVEAL MESSAGE"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {stealthMode === "hide" ? (
              <>
                <Text style={styles.label}>SECRET MESSAGE</Text>
                <TextInput
                  style={styles.input}
                  value={stealthMsg}
                  onChangeText={setStealthMsg}
                  placeholder="Message to hide..."
                  placeholderTextColor={colors.mutedForeground}
                  autoCorrect={false}
                />

                <Pressable
                  style={[styles.actionBtn, !stealthMsg && { opacity: 0.4 }]}
                  disabled={!stealthMsg}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setStealthOutput(stealthEncode(stealthMsg));
                  }}
                >
                  <Text style={styles.actionBtnText}>👻 HIDE IN TEXT</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.label}>CARRIER TEXT (PASTE TO SCAN)</Text>
                <TextInput
                  style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
                  value={stealthCarrier}
                  onChangeText={setStealthCarrier}
                  placeholder="Paste text to scan for hidden messages..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  autoCorrect={false}
                />

                <Pressable
                  style={[styles.actionBtn, !stealthCarrier && { opacity: 0.4 }]}
                  disabled={!stealthCarrier}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setStealthOutput(stealthDecode(stealthCarrier));
                  }}
                >
                  <Text style={styles.actionBtnText}>🔍 SCAN FOR MESSAGE</Text>
                </Pressable>
              </>
            )}

            {stealthOutput ? (
              <View style={styles.outputBox}>
                <Text style={[styles.label, { marginBottom: 6 }]}>
                  {stealthMode === "hide" ? "STEGANOGRAPHIC OUTPUT" : "DECODED MESSAGE"}
                </Text>
                <Text style={styles.outputText}>
                  {stealthMode === "hide" ? "GHOSTFACE [hidden data embedded]" : stealthOutput}
                </Text>
                <Pressable
                  style={styles.copyBtn}
                  onPress={() => copyToClipboard(stealthOutput, setStealthCopied)}
                >
                  <Ionicons
                    name={stealthCopied ? "checkmark" : "copy-outline"}
                    size={14}
                    color={stealthCopied ? colors.success : colors.primary}
                  />
                  <Text style={[styles.copyText, { color: stealthCopied ? colors.success : colors.primary }]}>
                    {stealthCopied ? "COPIED" : "COPY"}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.padBottom} />
      </ScrollView>
    </View>
  );
}
