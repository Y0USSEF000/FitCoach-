import { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert, ScrollView, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import { Screen, DuoButton, TopBar } from "@/lib/ui";
import { C, RADIUS, SPACING, FONT } from "@/lib/theme";

export default function SearchFood() {
  const router = useRouter();
  const { lang } = useApp();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<any[] | null>(null);
  const [logging, setLogging] = useState<number | null>(null);

  const search = async () => {
    const q = query.trim();
    if (q.length < 2) { Alert.alert("🐺", "Type a food name, e.g. \"shawarma\" or \"pizza\"."); return; }
    setBusy(true);
    setOptions(null);
    try {
      const out = await api.searchFood(q);
      setOptions(out.options ?? []);
    } catch (err: any) {
      const d = err?.message ?? "";
      Alert.alert("⚠️", d.includes("no_profile") ? "Please complete your profile first." : "Search failed. Try again.");
    } finally { setBusy(false); }
  };

  const pick = async (item: any, i: number) => {
    if (logging != null) return;
    setLogging(i);
    try {
      await api.logFood(item);
      Alert.alert("✓ Added", `${item.food_name}\n🔥 ${Math.round(item.calories)} kcal`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("⚠️", "Couldn't add this. Try again.");
    } finally { setLogging(null); }
  };

  return (
    <Screen edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <TopBar progress={1} onBack={() => router.back()} />
        <View style={s.body}>
          <Text style={s.title}>🔍 Search food</Text>
          <Text style={s.sub}>Search a food, then tap the exact one you ate.</Text>

          <View style={s.searchRow}>
            <TextInput
              style={s.input}
              placeholder="e.g. shawarma"
              placeholderTextColor={C.faint}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={search}
            />
            <DuoButton label="" icon="🔍" loading={busy} disabled={!query} onPress={search} style={s.searchBtn} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {busy && <ActivityIndicator color={C.primary} size="large" style={{ marginTop: SPACING.xl }} />}

            {options && options.length === 0 && !busy && (
              <Text style={s.empty}>No matches. Try a different name.</Text>
            )}

            {options?.map((o, i) => (
              <Pressable key={i} onPress={() => pick(o, i)} disabled={logging != null}
                style={[s.opt, logging === i && { borderColor: C.green, opacity: 0.7 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.optName}>{o.food_name}</Text>
                  <Text style={s.optMacros}>~{o.estimated_grams}g  ·  🥩 {o.protein}g  🍚 {o.carbs}g  🥑 {o.fat}g</Text>
                </View>
                <View style={s.optCalBox}>
                  {logging === i
                    ? <ActivityIndicator color={C.green} />
                    : <><Text style={s.optCal}>{Math.round(o.calories)}</Text><Text style={s.optKcal}>kcal</Text></>}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
  title: { color: C.text, fontSize: FONT.h1, fontWeight: "900", letterSpacing: -0.5 },
  sub: { color: C.sub, fontSize: FONT.body, fontWeight: "600", marginTop: 6, marginBottom: SPACING.md },
  searchRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  input: {
    flex: 1, backgroundColor: C.bgSoft, color: C.text, borderRadius: RADIUS.md, padding: 16,
    fontSize: FONT.h3, fontWeight: "700", borderWidth: 2, borderColor: C.border,
  },
  searchBtn: { width: 64 },
  empty: { color: C.sub, fontSize: FONT.body, fontWeight: "700", textAlign: "center", marginTop: SPACING.xl },
  opt: {
    flexDirection: "row", alignItems: "center", backgroundColor: C.card,
    borderRadius: RADIUS.md, borderWidth: 2, borderColor: C.border,
    padding: SPACING.md, marginTop: SPACING.sm,
  },
  optName: { color: C.text, fontSize: FONT.body, fontWeight: "800" },
  optMacros: { color: C.sub, fontSize: FONT.small, fontWeight: "600", marginTop: 4 },
  optCalBox: { alignItems: "center", minWidth: 56, marginLeft: SPACING.sm },
  optCal: { color: C.primary, fontSize: FONT.h3, fontWeight: "900" },
  optKcal: { color: C.faint, fontSize: FONT.tiny, fontWeight: "700" },
});
