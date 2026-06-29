import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api, Targets } from "@/lib/api";
import { Card, DuoButton, Screen, Entrance } from "@/lib/ui";
import { Mascot } from "@/lib/mascot";
import { C, SPACING, FONT, RADIUS, macroColors, shadow } from "@/lib/theme";

// ── Parse the AI's text plan into structured meal cards + tips ──
type ParsedMeal = { emoji: string; label: string; desc: string; kcal?: string; protein?: string };

const MEAL_META: Record<string, { color: string; fallback: string }> = {
  "🌅": { color: macroColors.calories, fallback: "Breakfast" },
  "☀️": { color: macroColors.carbs, fallback: "Lunch" },
  "🌞": { color: macroColors.carbs, fallback: "Lunch" },
  "🌙": { color: C.primary, fallback: "Dinner" },
  "🍎": { color: macroColors.protein, fallback: "Snack" },
  "🥪": { color: macroColors.protein, fallback: "Snack" },
};
const MEAL_EMOJIS = Object.keys(MEAL_META);

function parsePlan(plan: string): { meals: ParsedMeal[]; tips: string[] } {
  const lines = plan.split("\n").map((l) => l.trim()).filter(Boolean);
  const meals: ParsedMeal[] = [];
  const tips: string[] = [];
  let mode: "meal" | "tips" = "meal";
  let current: ParsedMeal | null = null;

  for (const line of lines) {
    if (line.includes("💡") || /^(tips?|conseils|tipps|consejos|نصائح)\s*:?/i.test(line)) {
      mode = "tips";
      continue;
    }
    const emoji = MEAL_EMOJIS.find((e) => line.startsWith(e));
    if (emoji && mode === "meal") {
      let rest = line.slice(emoji.length).trim();
      const ci = rest.indexOf(":");
      let label = MEAL_META[emoji].fallback;
      if (ci > -1 && ci <= 18) { label = rest.slice(0, ci).trim(); rest = rest.slice(ci + 1).trim(); }
      const kcal = rest.match(/~?\s*(\d{2,4})\s*(kcal|cal|سعرة|calor)/i)?.[1];
      const protein = rest.match(/(\d{1,3})\s*g\b/i)?.[1];
      // strip the trailing "— ~X kcal, Yg protein" so the description reads cleanly
      const desc = rest.replace(/[—\-–|]?\s*~?\s*\d{2,4}\s*(kcal|cal|سعرة|calor)[^]*$/i, "").trim() || rest;
      current = { emoji, label, desc, kcal, protein };
      meals.push(current);
      continue;
    }
    if (mode === "tips") tips.push(line.replace(/^[•\-\*▪◦]\s*/, "").trim());
    else if (current) current.desc += " " + line;
  }
  return { meals, tips };
}

export default function Program() {
  const { lang } = useApp();
  const [plan, setPlan] = useState<string | null>(null);
  const [coach, setCoach] = useState("");
  const [loading, setLoading] = useState(false);
  const [targets, setTargets] = useState<Targets | null>(null);

  useFocusEffect(useCallback(() => {
    (async () => { try { const me = await api.me(); setTargets(me?.user?.targets ?? null); } catch {} })();
  }, []));

  const generate = async () => {
    setLoading(true);
    try { const out = await api.program(); setPlan(out.plan); setCoach(out.coach ?? ""); }
    catch { setPlan("⚠️ Could not generate the meal plan. Check your connection."); }
    finally { setLoading(false); }
  };

  const meals = [
    { emoji: "🌅", key: "breakfast", color: macroColors.calories },
    { emoji: "☀️", key: "lunch", color: macroColors.carbs },
    { emoji: "🌙", key: "dinner", color: C.primary },
    { emoji: "🍎", key: "snack", color: macroColors.protein },
  ];

  const parsed = plan ? parsePlan(plan) : { meals: [], tips: [] };

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.wrap} showsVerticalScrollIndicator={false}>

        <Entrance delay={0}>
          <Text style={s.title}>📋 {t(lang, "program")}</Text>
        </Entrance>

        {!plan && !loading && (
          <>
            <Entrance delay={60}>
              <LinearGradient colors={["#2d1f52", "#1a1133"]} style={[s.heroCard, shadow(2)]}>
                <View style={s.decoCircle} />
                <View style={s.mascotWrap}><Mascot pose="eat" size={150} /></View>
                <Text style={s.heroTitle}>Fit<Text style={{ color: C.primary }}>Wolf</Text> Plan</Text>
                <Text style={s.heroSub}>{t(lang, "program_sub")}</Text>
              </LinearGradient>
            </Entrance>

            {targets && (
              <Entrance delay={120}>
                <LinearGradient colors={["#2d1f52", "#1e1535"]} style={[s.targetCard, shadow(1)]}>
                  <Text style={s.targetHeading}>🎯 {t(lang, "planned_for")}</Text>
                  <View style={s.targetRow}>
                    {[
                      { v: `${targets.calories}`, u: "kcal", c: macroColors.calories },
                      { v: `${targets.protein}g`, u: t(lang, "protein"), c: macroColors.protein },
                      { v: `${targets.carbs}g`, u: t(lang, "carbs"), c: macroColors.carbs },
                      { v: `${targets.fat}g`, u: t(lang, "fat"), c: macroColors.fat },
                    ].map((item, i) => (
                      <View key={i} style={s.targetItem}>
                        <Text style={[s.targetValue, { color: item.c }]}>{item.v}</Text>
                        <Text style={s.targetUnit}>{item.u}</Text>
                      </View>
                    ))}
                  </View>
                </LinearGradient>
              </Entrance>
            )}

            <Entrance delay={180}>
              <Card>
                <Text style={s.includedLabel}>{t(lang, "included")}</Text>
                <View style={s.mealsGrid}>
                  {meals.map((m) => (
                    <LinearGradient key={m.key} colors={[`${m.color}20`, `${m.color}08`]} style={[s.mealPill, { borderColor: `${m.color}40` }]}>
                      <Text style={s.mealEmoji}>{m.emoji}</Text>
                      <Text style={[s.mealText, { color: m.color }]}>{t(lang, m.key)}</Text>
                    </LinearGradient>
                  ))}
                </View>
              </Card>
            </Entrance>

            <Entrance delay={240}>
              <DuoButton label={t(lang, "get_program")} icon="✨" onPress={generate} />
            </Entrance>
          </>
        )}

        {loading && (
          <View style={s.loadingWrap}>
            <View style={s.loadingRing}><Mascot pose="eat" size={130} /></View>
            <ActivityIndicator color={C.primary} size="large" style={{ marginTop: SPACING.xl }} />
            <Text style={s.loadingText}>{t(lang, "generating")}</Text>
          </View>
        )}

        {plan && !loading && (
          <>
            {/* Coach message */}
            {coach ? (
              <Entrance delay={0}>
                <LinearGradient colors={["#2d1f52", "#1e1535"]} style={[s.coachCard, shadow(1)]}>
                  <View style={s.coachHeader}>
                    <Mascot pose="flex" size={40} />
                    <Text style={s.coachBadge}>💬 FANG SAYS</Text>
                    <View style={s.coachDot} />
                  </View>
                  <Text style={s.coachText}>{coach}</Text>
                </LinearGradient>
              </Entrance>
            ) : null}

            {/* Structured meal cards */}
            {parsed.meals.length > 0 ? parsed.meals.map((m, i) => {
              const color = MEAL_META[m.emoji]?.color ?? C.primary;
              return (
                <Entrance key={i} delay={60 + i * 70}>
                  <View style={[s.mealCard, shadow(1)]}>
                    <LinearGradient colors={[color, `${color}99`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.mealBadge}>
                      <Text style={s.mealBadgeEmoji}>{m.emoji}</Text>
                    </LinearGradient>
                    <View style={s.mealBody}>
                      <Text style={[s.mealLabel, { color }]}>{m.label}</Text>
                      <Text style={s.mealDesc}>{m.desc}</Text>
                      {(m.kcal || m.protein) && (
                        <View style={s.mealChips}>
                          {m.kcal ? <View style={[s.chip, { backgroundColor: `${macroColors.calories}1a`, borderColor: `${macroColors.calories}44` }]}><Text style={[s.chipTxt, { color: macroColors.calories }]}>🔥 {m.kcal} kcal</Text></View> : null}
                          {m.protein ? <View style={[s.chip, { backgroundColor: `${macroColors.protein}1a`, borderColor: `${macroColors.protein}44` }]}><Text style={[s.chipTxt, { color: macroColors.protein }]}>🥩 {m.protein}g</Text></View> : null}
                        </View>
                      )}
                    </View>
                  </View>
                </Entrance>
              );
            }) : (
              <Entrance delay={60}><Card><Text style={s.planText}>{plan}</Text></Card></Entrance>
            )}

            {/* Tips */}
            {parsed.tips.length > 0 && (
              <Entrance delay={60 + parsed.meals.length * 70}>
                <LinearGradient colors={["#1e3a2e", "#16241d"]} style={[s.tipsCard, shadow(1)]}>
                  <Text style={s.tipsHeading}>💡 {t(lang, "tips") }</Text>
                  {parsed.tips.map((tip, i) => (
                    <View key={i} style={s.tipRow}>
                      <Text style={s.tipBullet}>✓</Text>
                      <Text style={s.tipText}>{tip}</Text>
                    </View>
                  ))}
                </LinearGradient>
              </Entrance>
            )}

            <Entrance delay={120 + parsed.meals.length * 70}>
              <DuoButton color="white" icon="↻" label={t(lang, "get_program")} onPress={generate} />
            </Entrance>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { padding: SPACING.lg, paddingBottom: 60 },
  title: { color: C.text, fontSize: FONT.h2, fontWeight: "900", marginBottom: SPACING.lg, marginTop: SPACING.xs },

  heroCard: { borderRadius: RADIUS.xl, padding: SPACING.xxl, alignItems: "center", marginBottom: SPACING.lg, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  decoCircle: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(168,85,247,0.07)", top: -60, right: -60 },
  mascotWrap: { width: 160, height: 160, borderRadius: 80, backgroundColor: C.primarySoft, alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: SPACING.xl },
  heroTitle: { fontSize: FONT.h2, fontWeight: "900", color: C.text, letterSpacing: -0.5 },
  heroSub: { color: C.sub, fontSize: FONT.body, fontWeight: "600", textAlign: "center", marginTop: SPACING.sm, lineHeight: 22, paddingHorizontal: SPACING.md },

  targetCard: { borderRadius: RADIUS.lg, padding: SPACING.xl, marginBottom: SPACING.lg, borderWidth: 1, borderColor: C.border },
  targetHeading: { color: C.sub, fontSize: FONT.small, fontWeight: "900", marginBottom: SPACING.lg, letterSpacing: 1, textTransform: "uppercase" },
  targetRow: { flexDirection: "row", justifyContent: "space-between" },
  targetItem: { alignItems: "center", flex: 1 },
  targetValue: { fontSize: FONT.h3, fontWeight: "900" },
  targetUnit: { color: C.faint, fontSize: FONT.tiny, fontWeight: "700", marginTop: 2, textTransform: "uppercase" },

  includedLabel: { color: C.text, fontSize: FONT.h3, fontWeight: "800", marginBottom: SPACING.md },
  mealsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  mealPill: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: RADIUS.pill, paddingVertical: 10, paddingHorizontal: 16, gap: 8 },
  mealEmoji: { fontSize: 18 },
  mealText: { fontSize: FONT.small, fontWeight: "800" },

  loadingWrap: { alignItems: "center", marginTop: 40, gap: SPACING.lg },
  loadingRing: { width: 180, height: 180, borderRadius: 90, backgroundColor: C.card, borderWidth: 2, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  loadingText: { color: C.sub, fontSize: FONT.body, fontWeight: "700" },

  coachCard: { borderRadius: RADIUS.lg, padding: SPACING.xl, marginBottom: SPACING.lg, borderWidth: 1, borderColor: C.borderGlow },
  coachHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: SPACING.md },
  coachBadge: { color: C.primary, fontSize: FONT.tiny, fontWeight: "900", letterSpacing: 2 },
  coachDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  coachText: { color: C.text, fontSize: FONT.body, fontWeight: "600", lineHeight: 24, fontStyle: "italic" },

  // meal cards
  mealCard: { flexDirection: "row", backgroundColor: C.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: C.border, padding: SPACING.md, marginBottom: SPACING.md, alignItems: "flex-start", gap: SPACING.md },
  mealBadge: { width: 54, height: 54, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  mealBadgeEmoji: { fontSize: 26 },
  mealBody: { flex: 1 },
  mealLabel: { fontSize: FONT.body, fontWeight: "900", marginBottom: 2, textTransform: "capitalize" },
  mealDesc: { color: C.text, fontSize: FONT.small, fontWeight: "600", lineHeight: 20 },
  mealChips: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  chip: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  chipTxt: { fontSize: FONT.tiny, fontWeight: "800" },

  // tips
  tipsCard: { borderRadius: RADIUS.lg, padding: SPACING.xl, marginBottom: SPACING.lg, borderWidth: 1, borderColor: `${C.green}44` },
  tipsHeading: { color: C.green, fontSize: FONT.h3, fontWeight: "900", marginBottom: SPACING.md },
  tipRow: { flexDirection: "row", gap: 10, marginBottom: 8, alignItems: "flex-start" },
  tipBullet: { color: C.green, fontSize: FONT.body, fontWeight: "900", marginTop: 1 },
  tipText: { color: C.text, fontSize: FONT.small, fontWeight: "600", lineHeight: 20, flex: 1 },

  planText: { color: C.text, fontSize: FONT.body, fontWeight: "600", lineHeight: 28 },
});
