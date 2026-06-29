import { useCallback, useState, useEffect, useRef } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api, FoodItem, Meal } from "@/lib/api";
import { Screen, DuoButton, TopBar } from "@/lib/ui";
import { C, RADIUS, SPACING, FONT, macroColors } from "@/lib/theme";

export default function AddFood() {
  const router = useRouter();
  const { lang } = useApp();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FoodItem[]>([]);
  const [recent, setRecent] = useState<Meal[]>([]);
  const [searching, setSearching] = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => { try { const r = await api.recent(); setRecent(r.recent ?? []); } catch {} })();
  }, []));

  // Live search-as-you-type: debounced 350ms, ignores out-of-order responses.
  const reqId = useRef(0);
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setResults([]); setSearching(false); return; }
    const id = ++reqId.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const r = await api.searchFoods(query);
        if (id === reqId.current) setResults(r.results ?? []);
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  const toConfirm = (food: string, basis: number, c: number, p: number, cb: number, f: number) =>
    router.push({ pathname: "/confirm-meal", params: {
      food, basis: String(basis), calories: String(c), protein: String(p), carbs: String(cb), fat: String(f),
    }});

  const pickFood = (it: FoodItem) =>
    toConfirm(it.brand ? `${it.name} (${it.brand})` : it.name, 100, it.calories, it.protein, it.carbs, it.fat);

  const pickRecent = (m: Meal) =>
    toConfirm(m.food, m.estimatedGrams || 100, m.calories, m.protein, m.carbs, m.fat);

  return (
    <Screen edges={["top"]}>
      <TopBar progress={0.5} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={s.title}>🔍 {t(lang, "add_food_title")}</Text>

        {/* Search bar — searches automatically as you type */}
        <View style={s.searchRow}>
          <TextInput
            style={s.search}
            placeholder={t(lang, "search_ph")}
            placeholderTextColor={C.faint}
            value={q}
            onChangeText={setQ}
            returnKeyType="search"
            autoCorrect={false}
            autoFocus
          />
          {q.length > 0 && (
            <Pressable style={s.clearBtn} onPress={() => setQ("")}>
              <Text style={s.clearTxt}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* Barcode entry */}
        <DuoButton color="white" icon="📷" label={t(lang, "scan_barcode")} onPress={() => router.push("/scan")} style={{ marginBottom: SPACING.lg }} />

        {/* Results */}
        {searching && <ActivityIndicator color={C.primary} style={{ marginVertical: SPACING.xl }} />}
        {!searching && results.length > 0 && (
          <View style={{ marginBottom: SPACING.lg }}>
            <Text style={s.section}>{t(lang, "db_results")}</Text>
            {results.map((it, i) => (
              <Pressable key={i} style={s.row} onPress={() => pickFood(it)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowName} numberOfLines={1}>{it.name}</Text>
                  {it.brand ? <Text style={s.rowBrand} numberOfLines={1}>{it.brand}</Text> : null}
                </View>
                <Text style={s.rowMacro}>{Math.round(it.calories)} kcal<Text style={s.per}>/100g</Text></Text>
              </Pressable>
            ))}
          </View>
        )}
        {!searching && q.length > 0 && results.length === 0 && (
          <Text style={s.empty}>{t(lang, "no_results")}</Text>
        )}

        {/* Recent (one-tap re-log) */}
        {recent.length > 0 && (
          <View>
            <Text style={s.section}>🕘 {t(lang, "recent_title")}</Text>
            {recent.map((m, i) => (
              <Pressable key={i} style={s.row} onPress={() => pickRecent(m)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowName} numberOfLines={1}>{m.food}</Text>
                  <Text style={s.rowBrand}>🥩 {m.protein}g · 🍚 {m.carbs}g · 🥑 {m.fat}g</Text>
                </View>
                <View style={s.relog}>
                  <Text style={[s.rowMacro, { color: macroColors.calories }]}>{Math.round(m.calories)}</Text>
                  <Text style={s.per}>kcal</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { padding: SPACING.lg, paddingBottom: 40 },
  title: { color: C.text, fontSize: FONT.h2, fontWeight: "900", marginBottom: SPACING.lg },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: SPACING.md },
  search: { flex: 1, backgroundColor: C.bgSoft, color: C.text, borderRadius: RADIUS.md, padding: 14, fontSize: FONT.body, fontWeight: "700", borderWidth: 2, borderColor: C.border },
  clearBtn: { justifyContent: "center", alignItems: "center", paddingHorizontal: 16, backgroundColor: C.card, borderRadius: RADIUS.md, borderWidth: 2, borderColor: C.border },
  clearTxt: { color: C.sub, fontSize: 16, fontWeight: "900" },
  section: { color: C.sub, fontSize: FONT.small, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: SPACING.sm },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, padding: SPACING.md, marginBottom: 8 },
  rowName: { color: C.text, fontSize: FONT.body, fontWeight: "800" },
  rowBrand: { color: C.faint, fontSize: FONT.tiny, fontWeight: "700", marginTop: 2 },
  rowMacro: { color: C.text, fontSize: FONT.body, fontWeight: "900" },
  per: { color: C.faint, fontSize: FONT.tiny, fontWeight: "700" },
  relog: { alignItems: "center" },
  empty: { color: C.sub, textAlign: "center", fontSize: FONT.body, fontWeight: "700", marginVertical: SPACING.xl },
});
