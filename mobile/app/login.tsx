import { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Screen, DuoButton, TopBar, SpeechBubble } from "@/lib/ui";
import { C, RADIUS, SPACING, FONT } from "@/lib/theme";

export default function Login() {
  const router = useRouter();
  const { lang, signIn } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!e.includes("@") || !e.includes(".")) { Alert.alert("🐺", t(lang, "err_email")); return; }
    if (password.length < 6) { Alert.alert("🐺", "Password must be at least 6 characters."); return; }
    setBusy(true);
    try {
      const res = await api.authLogin(e, password);   // 401 if email/password don't match
      await signIn(res.token);
      router.replace(res.profileComplete ? "/(tabs)" : "/onboarding");
    } catch (err: any) {
      const d = err?.body?.error || err?.message || "";
      const msg = d.includes("bad_credentials")
        ? "Wrong email or password. Please try again."
        : "Could not log in. Check your connection and that the server is running.";
      Alert.alert("⚠️", msg);
    } finally { setBusy(false); }
  };

  return (
    <Screen edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <TopBar progress={0.5} onBack={() => router.back()} />
        <View style={s.body}>
          <SpeechBubble pose="flex">Welcome back! Log in with your email and password.</SpeechBubble>
          <Text style={s.title}>Log in</Text>

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
          />
          <TextInput
            style={[s.input, { marginTop: SPACING.sm }]}
            placeholder="Password"
            placeholderTextColor={C.faint}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={submit}
          />

          <View style={{ flex: 1 }} />
          <DuoButton label={busy ? "Logging in…" : "Log in"} loading={busy} disabled={!email || !password} onPress={submit} />
          <DuoButton label="I don't have an account" color="white" onPress={() => router.replace("/auth")} />
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
