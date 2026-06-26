import { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Screen, DuoButton, TopBar, SpeechBubble } from "@/lib/ui";
import { C, RADIUS, SPACING, FONT } from "@/lib/theme";

export default function Verify() {
  const router = useRouter();
  const { lang } = useApp();
  const { signIn } = useApp();
  const params = useLocalSearchParams<{ email: string; exists: string; devCode: string }>();
  const email = String(params.email ?? "");
  const exists = params.exists === "1";
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState(String(params.devCode ?? ""));

  const submit = async () => {
    if (code.trim().length !== 6) { Alert.alert("🐺", t(lang, "err_code")); return; }
    setBusy(true);
    try {
      const res = await api.authVerify(email, code.trim());
      if (res.registered && res.token) {
        await signIn(res.token);            // existing account → log in
        router.replace("/");                // index routes by profile
      } else {
        router.replace({ pathname: "/register", params: { email } }); // new → finish sign-up
      }
    } catch (e: any) {
      Alert.alert("⚠️", t(lang, "err_code"));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try { const r = await api.authStart(email); setDevCode(r.devCode ?? ""); Alert.alert("✅", t(lang, "send_code")); }
    catch { Alert.alert("⚠️", "Network error"); }
  };

  return (
    <Screen edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <TopBar progress={0.66} onBack={() => router.back()} />
        <View style={s.body}>
          <SpeechBubble pose="flex">{`${exists ? t(lang, "welcome_back_msg") : t(lang, "new_acc_msg")}\n\n${t(lang, "verify_sub")} ${email}`}</SpeechBubble>
          <Text style={s.title}>{exists ? t(lang, "welcome_back_title") : t(lang, "verify_title")}</Text>

          <TextInput
            style={s.input}
            placeholder="••••••"
            placeholderTextColor={C.faint}
            value={code}
            onChangeText={(v) => setCode(v.replace(/[^0-9]/g, "").slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            onSubmitEditing={submit}
          />

          {devCode ? (
            <Pressable onPress={() => setCode(devCode)}>
              <Text style={s.devHint}>{t(lang, "dev_code")}: <Text style={{ color: C.primary, fontWeight: "900" }}>{devCode}</Text>  (tap to fill)</Text>
            </Pressable>
          ) : null}

          <Pressable onPress={resend} style={{ marginTop: SPACING.md }}>
            <Text style={s.resend}>↻ {t(lang, "resend")}</Text>
          </Pressable>

          <View style={{ flex: 1 }} />
          <DuoButton label={t(lang, "verify_btn")} icon="✓" loading={busy} disabled={code.length !== 6} onPress={submit} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.lg },
  title: { color: C.text, fontSize: FONT.h1, fontWeight: "900", letterSpacing: -0.5, marginBottom: SPACING.lg },
  input: {
    backgroundColor: C.bgSoft, color: C.text, borderRadius: RADIUS.md, padding: 18,
    fontSize: 34, fontWeight: "900", borderWidth: 2, borderColor: C.border, textAlign: "center", letterSpacing: 10,
  },
  devHint: { color: C.sub, fontSize: FONT.small, marginTop: SPACING.md, textAlign: "center" },
  resend: { color: C.sub, fontSize: FONT.body, fontWeight: "700", textAlign: "center" },
});
