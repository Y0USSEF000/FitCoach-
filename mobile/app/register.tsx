import { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Screen, DuoButton, TopBar, SpeechBubble } from "@/lib/ui";
import { C, RADIUS, SPACING, FONT } from "@/lib/theme";

export default function Register() {
  const router = useRouter();
  const { lang, signIn } = useApp();
  const params = useLocalSearchParams<{ email: string }>();
  const email = String(params.email ?? "");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) { Alert.alert("🐺", t(lang, "name_ph")); return; }
    if (password.length < 6) { Alert.alert("🐺", t(lang, "err_password")); return; }
    setBusy(true);
    try {
      const res = await api.authRegister(email, name.trim(), password);
      await signIn(res.token);
      router.replace("/onboarding");   // new account → physical onboarding
    } catch (e: any) {
      const msg = e?.message === "weak_password" ? t(lang, "err_password")
        : e?.message === "already_registered" ? t(lang, "welcome_back_msg")
        : "Could not create account.";
      Alert.alert("⚠️", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <TopBar progress={0.9} onBack={() => router.back()} />
        <View style={s.body}>
          <SpeechBubble pose="hero">{t(lang, "create_title")} 🎉</SpeechBubble>
          <Text style={s.email}>{email}</Text>

          <TextInput
            style={s.input}
            placeholder={t(lang, "name_ph")}
            placeholderTextColor={C.faint}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoFocus
          />
          <TextInput
            style={[s.input, { marginTop: SPACING.md }]}
            placeholder={t(lang, "password_ph")}
            placeholderTextColor={C.faint}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            onSubmitEditing={submit}
          />

          <View style={{ flex: 1 }} />
          <DuoButton label={t(lang, "create_btn")} icon="🚀" loading={busy} disabled={!name || password.length < 6} onPress={submit} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.lg },
  email: { color: C.sub, fontSize: FONT.body, fontWeight: "700", marginBottom: SPACING.lg },
  input: {
    backgroundColor: C.bgSoft, color: C.text, borderRadius: RADIUS.md, padding: 18,
    fontSize: FONT.h3, fontWeight: "700", borderWidth: 2, borderColor: C.border,
  },
});
