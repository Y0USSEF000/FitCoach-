import { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Screen, DuoButton, TopBar, SpeechBubble } from "@/lib/ui";
import { C, RADIUS, SPACING, FONT } from "@/lib/theme";

export default function Auth() {
  const router = useRouter();
  const { lang } = useApp();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!e.includes("@") || !e.includes(".")) { Alert.alert("🐺", t(lang, "err_email")); return; }
    setBusy(true);
    try {
      const res = await api.authStart(e);
      const go = () => router.push({ pathname: "/verify", params: { email: e, exists: res.exists ? "1" : "0", devCode: res.devCode ?? "" } });
      if (res.exists) {
        // Email already has an account → tell the user, then continue to log in.
        Alert.alert(t(lang, "welcome_back_title"), t(lang, "welcome_back_msg"), [{ text: t(lang, "log_in"), onPress: go }]);
      } else {
        go();
      }
    } catch {
      Alert.alert("⚠️", "Could not reach the server. Is the backend running?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <TopBar progress={0.33} onBack={() => router.back()} />
        <View style={s.body}>
          <SpeechBubble pose="flex">{t(lang, "auth_email_sub")}</SpeechBubble>
          <Text style={s.title}>{t(lang, "auth_email_title")}</Text>
          <TextInput
            style={s.input}
            placeholder={t(lang, "email_ph")}
            placeholderTextColor={C.faint}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            onSubmitEditing={submit}
          />
          <View style={{ flex: 1 }} />
          <DuoButton label={t(lang, "send_code")} icon="✉️" loading={busy} disabled={!email} onPress={submit} />
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
    fontSize: FONT.h3, fontWeight: "700", borderWidth: 2, borderColor: C.border,
  },
});
