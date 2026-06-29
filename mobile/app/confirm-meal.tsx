import { useMemo, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Screen, DuoButton, TopBar } from "@/lib/ui";
import { Mascot } from "@/lib/mascot";
import { C, RADIUS, SPACING, FONT, macroColors } from "@/lib/theme";

export default function ConfirmMeal() {
  const router = useRouter();
  const { lang } = useApp();
  const p = useLocalSearchParams<{
    food: string; basis: string; calories: string; protein: string; carbs: string; fat: string; source?: string;
  }>();

  const basis = Math.max(parseFloat(p.basis ?? "100") || 100, 1); // grams the macros refer to
  const per = {
    calories: (parseFloat(p.calories ?? "0") || 0) / basis,
    protein: (parseFloat(p.protein ?? "0") || 0) / basis,
    carbs: (parseFloat(p.carbs ?? "0") || 0) / basis,
    fat: (parseFloat(p.fat ?? "0") || 0) / basis,
  };

  const [grams, setGrams] = useState(String(Math.round(basis)));
  const g = Math.max(parseFloat(grams) || 0, 0);

  const m = useMemo(() => ({
    calories: Math.round(per.calories * g),
    protein: Math.round(per.protein * g),
    carbs: Math.round(per.carbs * g),
    fat: Math.round(per.fat * g),
  }), [g]);

  const [busy, setBusy] = useState(false);
  const food = String(p.food ?? "Food");
  const verified = String(p.source ?? "") === "database";

  const setG = (v: number) => setGrams(String(Math.max(Math.round(v), 0)));
  const mult = (x: number) => setG(basis * x);

  const save = async () => {
    if (g <= 0) { Alert.alert("🐺", t(lang, "serving_g")); return; }
    setBusy(true);
    try {
      await api.logMeal({ food, grams: g, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat });
      router.back();
    } catch {
      Alert.alert("⚠️", "Could not save. Is the backend running?");
    } finally { setBusy(false); }
  };

  return (
    <Screen edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <TopBar progress={1} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
          <View style={s.head}>
            <Mascot pose="eat" size={64} />
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={s.label}>{t(lang, "confirm_title")}</Text>
              <Text style={s.food} numberOfLines={2}>{food}</Text>
            </View>
          </View>

          {/* Source badge — tells the user how trustworthy the numbers are */}
          <View style={[s.badge, verified
            ? { backgroundColor: `${C.green}1a`, borderColor: `${C.green}55` }
            : { backgroundColor: `${C.yellow}1a`, borderColor: `${C.yellow}55` }]}>
            <Text style={[s.badgeTxt, { color: verified ? C.green : C.yellow }]}>
              {verified ? `📊 ${t(lang, "verified_db")}` : `🧠 ${t(lang, "ai_estimate")}`}
            </Text>
          </View>

          {/* Serving size editor */}
          <View style={s.card}>
            <Text style={s.section}>{t(lang, "serving_g")}</Text>
            <View style={s.gramsRow}>
              <Pressable style={s.step} onPress={() => setG(g - 25)}><Text style={s.stepTxt}>−25</Text></Pressable>
              <TextInput
                style={s.gramsInput}
                keyboardType="numeric"
                value={grams}
                onChangeText={(v) => setGrams(v.replace(/[^0-9.]/g, ""))}
              />
              <Pressable style={s.step} onPress={() => setG(g + 25)}><Text style={s.stepTxt}>+25</Text></Pressable>
            </View>
            <View style={s.multRow}>
              {[0.5, 1, 1.5, 2].map((x) => (
                <Pressable key={x} style={s.mult} onPress={() => mult(x)}>
                  <Text style={s.multTxt}>{x}×</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Live macros */}
          <View style={s.card}>
            <View style={s.calRow}>
              <Text style={s.calVal}>{m.calories}</Text>
              <Text style={s.calUnit}>kcal</Text>
            </View>
            <View style={s.macroRow}>
              <Macro label={t(lang, "protein")} value={m.protein} color={macroColors.protein} icon="🥩" />
              <Macro label={t(lang, "carbs")} value={m.carbs} color={macroColors.carbs} icon="🍚" />
              <Macro label={t(lang, "fat")} value={m.fat} color={macroColors.fat} icon="🥑" />
            </View>
          </View>

          <DuoButton label={t(lang, "save_meal")} icon="✅" color="green" loading={busy} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Macro({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <View style={[s.macro, { backgroundColor: `${color}14`, borderColor: `${color}35` }]}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={[s.macroVal, { color }]}>{value}g</Text>
      <Text style={s.macroLbl}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: SPACING.lg, paddingBottom: 40 },
  head: { flexDirection: "row", alignItems: "center", marginBottom: SPACING.lg },
  label: { color: C.sub, fontSize: FONT.small, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  food: { color: C.text, fontSize: FONT.h2, fontWeight: "900", marginTop: 2 },
  badge: { alignSelf: "flex-start", borderWidth: 1.5, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 6, marginBottom: SPACING.lg },
  badgeTxt: { fontSize: FONT.small, fontWeight: "800" },

  card: { backgroundColor: C.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: C.border, padding: SPACING.xl, marginBottom: SPACING.lg },
  section: { color: C.sub, fontSize: FONT.small, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: SPACING.md },

  gramsRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  step: { backgroundColor: C.cardAlt, borderRadius: RADIUS.md, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: C.border },
  stepTxt: { color: C.text, fontWeight: "900", fontSize: FONT.body },
  gramsInput: { flex: 1, backgroundColor: C.bgSoft, color: C.text, borderRadius: RADIUS.md, padding: 14, fontSize: 26, fontWeight: "900", textAlign: "center", borderWidth: 2, borderColor: C.border },
  multRow: { flexDirection: "row", gap: 8, marginTop: SPACING.md },
  mult: { flex: 1, backgroundColor: C.cardAlt, borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: C.border },
  multTxt: { color: C.sub, fontWeight: "800" },

  calRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 6 },
  calVal: { color: C.text, fontSize: 48, fontWeight: "900", letterSpacing: -1 },
  calUnit: { color: C.sub, fontSize: FONT.h3, fontWeight: "800" },
  macroRow: { flexDirection: "row", gap: 8, marginTop: SPACING.lg },
  macro: { flex: 1, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: "center" },
  macroVal: { fontWeight: "900", fontSize: FONT.h3, marginTop: 2 },
  macroLbl: { color: C.faint, fontSize: FONT.tiny, fontWeight: "700", marginTop: 2, textTransform: "uppercase" },
});
