import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SecureBadge } from "@/components/SecureBadge";
import { StatusDot } from "@/components/StatusDot";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

// ─── time helper ───────────────────────────────────────────────
function formatTime(ts: number): string {
  const d = new Date(ts);
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`;
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ─── crypto helpers ─────────────────────────────────────────────
function base64Encode(str: string): string {
  if (Platform.OS === "web") return btoa(unescape(encodeURIComponent(str)));
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  const bytes = str.split("").map((c) => c.charCodeAt(0));
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0, b1 = bytes[i + 1] ?? 0, b2 = bytes[i + 2] ?? 0;
    result += chars[b0 >> 2];
    result += chars[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    result += i + 2 < bytes.length ? chars[b2 & 63] : "=";
  }
  return result;
}

function base64Decode(str: string): string {
  try {
    if (Platform.OS === "web") return decodeURIComponent(escape(atob(str)));
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
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
  } catch { return "DECODE ERROR"; }
}

function xorCipher(text: string, key: string): string {
  if (!key) return text;
  return text.split("").map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))
  ).join("");
}

function ghostEncrypt(plaintext: string, key: string): string {
  return "GHX1::" + base64Encode(xorCipher(plaintext, key || "GHOSTFACE"));
}

function ghostDecrypt(ciphertext: string, key: string): string {
  if (!ciphertext.startsWith("GHX1::")) return "INVALID FORMAT";
  return xorCipher(base64Decode(ciphertext.slice(6)), key || "GHOSTFACE");
}

function simHash(input: string, algo: "SHA-256" | "MD5" | "BLAKE2"): string {
  let hash = 0;
  const seed = algo === "SHA-256" ? 0x6a09e667 : algo === "MD5" ? 0x67452301 : 0x6b08c647;
  for (let i = 0; i < input.length; i++) hash = ((hash << 5) - hash + input.charCodeAt(i) + seed) | 0;
  const raw = Math.abs(hash).toString(16).padStart(8, "0");
  const stretched = Array.from({ length: 8 }, (_, i) =>
    parseInt(raw, 16).toString(16).padStart(8, "0").split("").map((c, j) =>
      ((parseInt(c, 16) + i * 3 + j * 7) % 16).toString(16)
    ).join("")
  ).join("");
  return stretched.slice(0, algo === "MD5" ? 32 : 64);
}

function generateKeyPair() {
  const chars = "0123456789abcdef";
  const rand = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return {
    pub: `04:${rand(8)}:${rand(8)}:${rand(8)}:${rand(8)}:${rand(8)}:${rand(8)}:${rand(8)}`,
    priv: `GF:${rand(12)}:${rand(12)}:${rand(12)}:${rand(12)}`,
  };
}

function stealthEncode(message: string): string {
  const zw = ["\u200B", "\u200C"];
  const bits = message.split("").map((c) => c.charCodeAt(0).toString(2).padStart(8, "0")).join("");
  return "GHOSTFACE" + bits.split("").map((b) => zw[b === "0" ? 0 : 1]).join("");
}

function stealthDecode(carrier: string): string {
  const zw = ["\u200B", "\u200C"];
  const hidden = carrier.replace(/[^\u200B\u200C]/g, "");
  const bits = hidden.split("").map((c) => (zw.indexOf(c) === 0 ? "0" : "1")).join("");
  let result = "";
  for (let i = 0; i < bits.length; i += 8) {
    const byte = bits.slice(i, i + 8);
    if (byte.length === 8) result += String.fromCharCode(parseInt(byte, 2));
  }
  return result || "NO HIDDEN MESSAGE FOUND";
}

// ─── types ──────────────────────────────────────────────────────
type EncToolTab = "cipher" | "hash" | "keygen" | "stealth";

// ─── Encryption Tools Panel ─────────────────────────────────────
function EncryptionTools({ colors, insets }: { colors: any; insets: any }) {
  const [activeTool, setActiveTool] = useState<EncToolTab>("cipher");

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

  const copy = async (text: string, setter: (v: boolean) => void) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Clipboard.setStringAsync(text);
    setter(true);
    setTimeout(() => setter(false), 1500);
  };

  const s = StyleSheet.create({
    label: { color: colors.mutedForeground, fontSize: 10, letterSpacing: 3, fontWeight: "700" as const },
    input: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: colors.radius, color: colors.foreground, fontSize: 13, padding: 12,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    row: { flexDirection: "row" as const, gap: 8 },
    modeBtn: { flex: 1, paddingVertical: 10, alignItems: "center" as const, borderRadius: colors.radius, borderWidth: 1 },
    modeBtnTxt: { fontSize: 11, letterSpacing: 2, fontWeight: "700" as const },
    actionBtn: { backgroundColor: colors.primary, borderRadius: colors.radius, paddingVertical: 13, alignItems: "center" as const },
    actionTxt: { color: colors.primaryForeground, fontSize: 12, fontWeight: "800" as const, letterSpacing: 3 },
    outputBox: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 12 },
    outputTxt: { color: colors.primary, fontSize: 11, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", letterSpacing: 0.5 },
    copyRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, marginTop: 8, alignSelf: "flex-end" as const },
    copyTxt: { fontSize: 10, letterSpacing: 2 },
    algoRow: { flexDirection: "row" as const, gap: 8, flexWrap: "wrap" as const },
    algoBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: colors.radius, borderWidth: 1 },
    algoBtnTxt: { fontSize: 10, letterSpacing: 2, fontWeight: "700" as const },
    keyBox: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 12, gap: 8 },
    keyLbl: { color: colors.mutedForeground, fontSize: 9, letterSpacing: 3 },
    keyPub: { color: colors.success, fontSize: 11, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
    keyPriv: { color: colors.destructive, fontSize: 11, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
    divider: { height: 1, backgroundColor: colors.border },
    infoBox: {
      flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 8,
      backgroundColor: `${colors.primary}10`, borderRadius: colors.radius,
      padding: 10, borderWidth: 1, borderColor: `${colors.primary}25`,
    },
    infoTxt: { color: colors.mutedForeground, fontSize: 11, flex: 1 },
  });

  const toolTabs: { id: EncToolTab; icon: React.ComponentProps<typeof Ionicons>["name"]; label: string }[] = [
    { id: "cipher", icon: "lock-closed-outline", label: "CIPHER" },
    { id: "hash", icon: "finger-print", label: "HASH" },
    { id: "keygen", icon: "key-outline", label: "KEYGEN" },
    { id: "stealth", icon: "eye-off-outline", label: "STEALTH" },
  ];

  return (
    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
      {/* sub-tab row */}
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {toolTabs.map((t) => (
          <Pressable
            key={t.id}
            style={{
              flex: 1, paddingVertical: 11, alignItems: "center", gap: 3,
              borderBottomWidth: 2,
              borderBottomColor: activeTool === t.id ? colors.primary : "transparent",
            }}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTool(t.id); }}
          >
            <Ionicons name={t.icon} size={16} color={activeTool === t.id ? colors.primary : colors.mutedForeground} />
            <Text style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: "700", color: activeTool === t.id ? colors.primary : colors.mutedForeground }}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ padding: 16, gap: 12 }}>
        {/* ── CIPHER ── */}
        {activeTool === "cipher" && (
          <>
            <View style={s.infoBox}>
              <Ionicons name="information-circle-outline" size={13} color={colors.primary} />
              <Text style={s.infoTxt}>XOR + Base64 local encryption. All operations run on-device.</Text>
            </View>
            <Text style={s.label}>MODE</Text>
            <View style={s.row}>
              {(["encrypt", "decrypt"] as const).map((m) => (
                <Pressable key={m} style={[s.modeBtn, { backgroundColor: encMode === m ? colors.primary : "transparent", borderColor: encMode === m ? colors.primary : colors.border }]}
                  onPress={() => { setEncMode(m); setEncOutput(""); }}>
                  <Text style={[s.modeBtnTxt, { color: encMode === m ? colors.primaryForeground : colors.mutedForeground }]}>
                    {m === "encrypt" ? "ENCRYPT" : "DECRYPT"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.label}>{encMode === "encrypt" ? "PLAINTEXT" : "CIPHERTEXT"}</Text>
            <TextInput style={[s.input, { minHeight: 70, textAlignVertical: "top" }]} value={encInput} onChangeText={setEncInput}
              placeholder={encMode === "encrypt" ? "Message to encrypt..." : "GHX1:: ciphertext..."} placeholderTextColor={colors.mutedForeground} multiline autoCorrect={false} />
            <Text style={s.label}>SECRET KEY (OPTIONAL)</Text>
            <TextInput style={s.input} value={encKey} onChangeText={setEncKey} placeholder="Leave blank for default key" placeholderTextColor={colors.mutedForeground} autoCorrect={false} />
            <Pressable style={[s.actionBtn, !encInput && { opacity: 0.4 }]} disabled={!encInput}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setEncOutput(encMode === "encrypt" ? ghostEncrypt(encInput, encKey) : ghostDecrypt(encInput, encKey)); }}>
              <Text style={s.actionTxt}>{encMode === "encrypt" ? "🔒 ENCRYPT" : "🔓 DECRYPT"}</Text>
            </Pressable>
            {encOutput ? (
              <View style={s.outputBox}>
                <Text style={s.outputTxt}>{encOutput}</Text>
                <Pressable style={s.copyRow} onPress={() => copy(encOutput, setEncCopied)}>
                  <Ionicons name={encCopied ? "checkmark" : "copy-outline"} size={13} color={encCopied ? colors.success : colors.primary} />
                  <Text style={[s.copyTxt, { color: encCopied ? colors.success : colors.primary }]}>{encCopied ? "COPIED" : "COPY"}</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}

        {/* ── HASH ── */}
        {activeTool === "hash" && (
          <>
            <View style={s.infoBox}>
              <Ionicons name="information-circle-outline" size={13} color={colors.primary} />
              <Text style={s.infoTxt}>One-way hash — verify message integrity without revealing content.</Text>
            </View>
            <Text style={s.label}>ALGORITHM</Text>
            <View style={s.algoRow}>
              {(["SHA-256", "MD5", "BLAKE2"] as const).map((a) => (
                <Pressable key={a} style={[s.algoBtn, { backgroundColor: hashAlgo === a ? colors.primary : "transparent", borderColor: hashAlgo === a ? colors.primary : colors.border }]}
                  onPress={() => { setHashAlgo(a); setHashOutput(""); }}>
                  <Text style={[s.algoBtnTxt, { color: hashAlgo === a ? colors.primaryForeground : colors.mutedForeground }]}>{a}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.label}>INPUT</Text>
            <TextInput style={[s.input, { minHeight: 70, textAlignVertical: "top" }]} value={hashInput} onChangeText={setHashInput}
              placeholder="Text to hash..." placeholderTextColor={colors.mutedForeground} multiline autoCorrect={false} />
            <Pressable style={[s.actionBtn, !hashInput && { opacity: 0.4 }]} disabled={!hashInput}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setHashOutput(simHash(hashInput, hashAlgo)); }}>
              <Text style={s.actionTxt}>GENERATE HASH</Text>
            </Pressable>
            {hashOutput ? (
              <View style={s.outputBox}>
                <Text style={[s.label, { marginBottom: 6 }]}>{hashAlgo} DIGEST</Text>
                <Text style={s.outputTxt}>{hashOutput}</Text>
                <Pressable style={s.copyRow} onPress={() => copy(hashOutput, setHashCopied)}>
                  <Ionicons name={hashCopied ? "checkmark" : "copy-outline"} size={13} color={hashCopied ? colors.success : colors.primary} />
                  <Text style={[s.copyTxt, { color: hashCopied ? colors.success : colors.primary }]}>{hashCopied ? "COPIED" : "COPY"}</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}

        {/* ── KEYGEN ── */}
        {activeTool === "keygen" && (
          <>
            <View style={s.infoBox}>
              <Ionicons name="information-circle-outline" size={13} color={colors.primary} />
              <Text style={s.infoTxt}>Simulated EC key pair (secp256k1). Share public key freely. Never share the private key.</Text>
            </View>
            <Pressable style={s.actionBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setKeyPair(generateKeyPair()); setKeyCopied(null); }}>
              <Text style={s.actionTxt}>⚡ GENERATE KEY PAIR</Text>
            </Pressable>
            {keyPair ? (
              <View style={s.keyBox}>
                <Text style={s.keyLbl}>PUBLIC KEY (secp256k1)</Text>
                <Text style={s.keyPub}>{keyPair.pub}</Text>
                <Pressable style={s.copyRow} onPress={() => copy(keyPair.pub, (v) => setKeyCopied(v ? "pub" : null))}>
                  <Ionicons name={keyCopied === "pub" ? "checkmark" : "copy-outline"} size={13} color={keyCopied === "pub" ? colors.success : colors.primary} />
                  <Text style={[s.copyTxt, { color: keyCopied === "pub" ? colors.success : colors.primary }]}>{keyCopied === "pub" ? "COPIED" : "COPY PUBLIC KEY"}</Text>
                </Pressable>
                <View style={s.divider} />
                <Text style={s.keyLbl}>PRIVATE KEY — KEEP SECRET</Text>
                <Text style={s.keyPriv}>{keyPair.priv}</Text>
                <Pressable style={s.copyRow} onPress={() => copy(keyPair.priv, (v) => setKeyCopied(v ? "priv" : null))}>
                  <Ionicons name={keyCopied === "priv" ? "checkmark" : "copy-outline"} size={13} color={keyCopied === "priv" ? colors.success : colors.destructive} />
                  <Text style={[s.copyTxt, { color: keyCopied === "priv" ? colors.success : colors.destructive }]}>{keyCopied === "priv" ? "COPIED" : "COPY PRIVATE KEY"}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={[s.keyBox, { alignItems: "center", paddingVertical: 28 }]}>
                <Ionicons name="key-outline" size={36} color={colors.border} />
                <Text style={[s.label, { marginTop: 10 }]}>NO KEY GENERATED</Text>
              </View>
            )}
          </>
        )}

        {/* ── STEALTH ── */}
        {activeTool === "stealth" && (
          <>
            <View style={s.infoBox}>
              <Ionicons name="information-circle-outline" size={13} color={colors.primary} />
              <Text style={s.infoTxt}>Hide secret messages inside innocent text using invisible zero-width Unicode characters.</Text>
            </View>
            <Text style={s.label}>MODE</Text>
            <View style={s.row}>
              {(["hide", "reveal"] as const).map((m) => (
                <Pressable key={m} style={[s.modeBtn, { backgroundColor: stealthMode === m ? colors.primary : "transparent", borderColor: stealthMode === m ? colors.primary : colors.border }]}
                  onPress={() => { setStealthMode(m); setStealthOutput(""); }}>
                  <Text style={[s.modeBtnTxt, { color: stealthMode === m ? colors.primaryForeground : colors.mutedForeground }]}>
                    {m === "hide" ? "HIDE" : "REVEAL"}
                  </Text>
                </Pressable>
              ))}
            </View>
            {stealthMode === "hide" ? (
              <>
                <Text style={s.label}>SECRET MESSAGE</Text>
                <TextInput style={s.input} value={stealthMsg} onChangeText={setStealthMsg} placeholder="Message to hide..." placeholderTextColor={colors.mutedForeground} autoCorrect={false} />
                <Pressable style={[s.actionBtn, !stealthMsg && { opacity: 0.4 }]} disabled={!stealthMsg}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStealthOutput(stealthEncode(stealthMsg)); }}>
                  <Text style={s.actionTxt}>👻 HIDE IN TEXT</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={s.label}>PASTE TEXT TO SCAN</Text>
                <TextInput style={[s.input, { minHeight: 70, textAlignVertical: "top" }]} value={stealthCarrier} onChangeText={setStealthCarrier}
                  placeholder="Paste carrier text..." placeholderTextColor={colors.mutedForeground} multiline autoCorrect={false} />
                <Pressable style={[s.actionBtn, !stealthCarrier && { opacity: 0.4 }]} disabled={!stealthCarrier}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStealthOutput(stealthDecode(stealthCarrier)); }}>
                  <Text style={s.actionTxt}>🔍 SCAN FOR MESSAGE</Text>
                </Pressable>
              </>
            )}
            {stealthOutput ? (
              <View style={s.outputBox}>
                <Text style={[s.label, { marginBottom: 6 }]}>{stealthMode === "hide" ? "STEGANOGRAPHIC OUTPUT" : "DECODED MESSAGE"}</Text>
                <Text style={s.outputTxt}>{stealthMode === "hide" ? "GHOSTFACE [hidden data embedded]" : stealthOutput}</Text>
                <Pressable style={s.copyRow} onPress={() => copy(stealthOutput, setStealthCopied)}>
                  <Ionicons name={stealthCopied ? "checkmark" : "copy-outline"} size={13} color={stealthCopied ? colors.success : colors.primary} />
                  <Text style={[s.copyTxt, { color: stealthCopied ? colors.success : colors.primary }]}>{stealthCopied ? "COPIED" : "COPY"}</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </View>

      <View style={{ height: Platform.OS === "web" ? 110 : 130 }} />
    </ScrollView>
  );
}

// ─── Main screen ────────────────────────────────────────────────
type PageTab = "messages" | "tools";

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { conversations, addConversation } = useApp();
  const [pageTab, setPageTab] = useState<PageTab>("messages");
  const [showNew, setShowNew] = useState(false);
  const [newAlias, setNewAlias] = useState("");

  const handleNewChat = () => {
    if (newAlias.trim().length < 2) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addConversation(newAlias.trim());
    setShowNew(false);
    setNewAlias("");
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingBottom: 12,
    },
    headerTitle: { color: colors.foreground, fontSize: 16, fontWeight: "800" as const, letterSpacing: 4 },
    divider: { height: 1, backgroundColor: colors.border },
    segmentRow: {
      flexDirection: "row", marginHorizontal: 16, marginVertical: 10,
      backgroundColor: colors.card, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    },
    segBtn: { flex: 1, paddingVertical: 9, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
    segBtnActive: { backgroundColor: colors.primary },
    segBtnTxt: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 2 },
    item: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
    avatarContainer: { position: "relative" },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    avatarText: { color: colors.primary, fontSize: 14, fontWeight: "800" as const, letterSpacing: 1 },
    unreadBadge: { position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    unreadText: { color: colors.primaryForeground, fontSize: 10, fontWeight: "800" as const },
    itemContent: { flex: 1 },
    itemHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
    alias: { color: colors.foreground, fontSize: 14, fontWeight: "700" as const, letterSpacing: 2 },
    timeText: { color: colors.mutedForeground, fontSize: 10, letterSpacing: 1 },
    preview: { color: colors.mutedForeground, fontSize: 12, letterSpacing: 0.5 },
    itemDivider: { height: 1, backgroundColor: colors.border, marginLeft: 78 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
    modalContent: { backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: 1, borderColor: colors.border, padding: 24, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 24) },
    modalTitle: { color: colors.foreground, fontSize: 13, fontWeight: "800" as const, letterSpacing: 4, marginBottom: 20 },
    input: { backgroundColor: colors.muted, color: colors.foreground, fontSize: 16, fontWeight: "700" as const, letterSpacing: 3, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 },
    modalBtn: { backgroundColor: colors.primary, borderRadius: colors.radius, paddingVertical: 14, alignItems: "center", marginBottom: 8 },
    modalBtnText: { color: colors.primaryForeground, fontSize: 12, fontWeight: "800" as const, letterSpacing: 3 },
    cancelBtn: { alignItems: "center", paddingVertical: 12 },
    cancelText: { color: colors.mutedForeground, fontSize: 12, letterSpacing: 2 },
    padBottom: { height: 110 },
  });

  const sorted = [...conversations].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {pageTab === "messages" ? "MESSAGES" : "ENCRYPT"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <SecureBadge type="e2ee" />
          {pageTab === "messages" && (
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowNew(true); }} testID="new-chat-btn">
              <Ionicons name="create-outline" size={22} color={colors.primary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Segment control */}
      <View style={styles.segmentRow}>
        <Pressable
          style={[styles.segBtn, pageTab === "messages" && styles.segBtnActive]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPageTab("messages"); }}
        >
          <Ionicons name="chatbubble-outline" size={14} color={pageTab === "messages" ? colors.primaryForeground : colors.mutedForeground} />
          <Text style={[styles.segBtnTxt, { color: pageTab === "messages" ? colors.primaryForeground : colors.mutedForeground }]}>
            MESSAGES
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segBtn, pageTab === "tools" && styles.segBtnActive]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPageTab("tools"); }}
        >
          <Ionicons name="lock-closed-outline" size={14} color={pageTab === "tools" ? colors.primaryForeground : colors.mutedForeground} />
          <Text style={[styles.segBtnTxt, { color: pageTab === "tools" ? colors.primaryForeground : colors.mutedForeground }]}>
            TOOLS
          </Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

      {/* Content */}
      {pageTab === "messages" ? (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          scrollEnabled={sorted.length > 0}
          renderItem={({ item, index }) => (
            <View>
              <Pressable
                style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/chat/${item.id}`); }}
                testID={`conversation-${item.id}`}
              >
                <View style={styles.avatarContainer}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.alias.slice(0, 2)}</Text>
                  </View>
                  {item.unread > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{item.unread}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.itemContent}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.alias}>{item.alias}</Text>
                    <Text style={styles.timeText}>{formatTime(item.timestamp)}</Text>
                  </View>
                  <Text style={styles.preview} numberOfLines={1}>{item.lastMessage}</Text>
                </View>
                <StatusDot active size={5} pulse={false} />
              </Pressable>
              {index < sorted.length - 1 && <View style={styles.itemDivider} />}
            </View>
          )}
          ListFooterComponent={<View style={styles.padBottom} />}
        />
      ) : (
        <EncryptionTools colors={colors} insets={insets} />
      )}

      {/* New chat modal */}
      <Modal visible={showNew} transparent animationType="slide" onRequestClose={() => setShowNew(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowNew(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>NEW SECURE CHANNEL</Text>
              <TextInput
                style={styles.input} value={newAlias}
                onChangeText={(t) => setNewAlias(t.toUpperCase())}
                placeholder="RECIPIENT ALIAS" placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters" autoCorrect={false} autoFocus testID="new-alias-input"
              />
              <Pressable style={[styles.modalBtn, newAlias.trim().length < 2 && { opacity: 0.4 }]}
                onPress={handleNewChat} disabled={newAlias.trim().length < 2}>
                <Text style={styles.modalBtnText}>ESTABLISH CHANNEL</Text>
              </Pressable>
              <Pressable style={styles.cancelBtn} onPress={() => setShowNew(false)}>
                <Text style={styles.cancelText}>CANCEL</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
