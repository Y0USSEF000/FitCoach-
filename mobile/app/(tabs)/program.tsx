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

// Colors per meal time (matched by the emoji the AI uses).
const MEAL_COLORS: Record<string, string> = {
  "🌅": macroColors.calories, "☀️": macroColors.carbs, "☀": macroColors.carbs,
  "🌙": C.primary, "🍎": macroColors.protein,
};
const mealColor = (e: string) => MEAL_COLORS[e] ?? C.primary;

type ParsedMeal = { emoji: string; title: string; body: string; kcal?: string };

// Turn the AI's plain-text plan into structured meal cards + a tips list.
// Anchors on the meal emojis (language-independent) and the 💡 tips marker.
function parsePlan(plan: string): { meals: ParsedMeal[]; tips: string[] } {
  const emojis = ["🌅", "☀️", "🌙", "🍎"];
  let mealPart = plan;
  let tipsPart = "";
  const tipIdx = plan.indexOf("💡");
  if (tipIdx >= 0) { mealPart = plan.slice(0, tipIdx); tipsPart = plan.slice(tipIdx + 2); }

  const positions: { idx: number; emoji: string }[] = [];
  for (const e of emojis) {
    let i = mealPart.indexOf(e);
    while (i >= 0) { positions.push({ idx: i, emoji: e }); i = mealPart.indexOf(e, i + e.length); }
  }
  positions.sort((a, b) => a.idx - b.idx);

  const meals: ParsedMeal[] = [];
  for (let k = 0; k < positions.length; k++) {
    const start = positions[k].idx;
    const end = k + 1 < positions.length ? positions[k + 1].idx : mealPart.length;
    const chunk = mealPart.slice(start, end).trim();
    const emoji = positions[k].emoji;
    let rest = chunk.slice(emoji.length).trim();
    let title = rest, body = "";
    const colon = rest.indexOf(":");
    if (colon >= 0) { title = rest.slice(0, colon).trim(); body = rest.slice(colon + 1).trim(); }
    const kcal = chunk.match(/(\d[\d,.]*)\s*kcal/i)?.[1];
    meals.push({ emoji, title, body: body.replace(/\s*\n\s*/g, "  ").trim(), kcal });
  }

  const tips = tipsPart.split("\n")
    .map((l) => l.replace(/^[\s•\-*\d.):]+/, "").trim())
    .filter((l) => l.length > 1);
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

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.wrap} showsVerticalScrollIndicator={false}>

        {/* Title */}
        <Entrance delay={0}>
          <Text style={s.title}>📋 {t(lang, "program")}</Text>
        </Entrance>

        {!plan && !loading && (
          <>
            {/* Hero */}
            <Entrance delay={60}>
              <LinearGradient colors={["#2d1f52", "#1a1133"]} style={[s.heroCard, shadow(2)]}>
                <View style={s.decoCircle} />
                <View style={s.mascotWrap}>
                  <Mascot pose="eat" size={150} />
                </View>
                <Text style={s.heroTitle}>
                  Fit<Text style={{ color: C.primary }}>Wolf</Text> Plan
                </Text>
                <Text style={s.heroSub}>{t(lang, "program_sub")}</Text>
              </LinearGradient>
            </Entrance>

            {/* Targets */}
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

            {/* Meal types included */}
            <Entrance delay={180}>
              <Card>
                <Text style={s.includedLabel}>{t(lang, "included")}</Text>
                <View style={s.mealsGrid}>
                  {meals.map((m) => (
                    <LinearGradient
                      key={m.key}
                      colors={[`${m.color}20`, `${m.color}08`]}
                      style={[s.mealPill, { borderColor: `${m.color}40` }]}
                    >
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
            <View style={s.loadingRing}>
              <Mascot pose="eat" size={130} />
            </View>
            <ActivityIndicator color={C.primary} size="large" style={{ marginTop: SPACING.xl }} />
            <Text style={s.loadingText}>{t(lang, "generating")}</Text>
          </View>
        )}

        {plan && !loading && (() => {
          const { meals: planMeals, tips } = parsePlan(plan);
          return (
          <>
            {/* Coach message */}
            {coach ? (
              <Entrance delay={0}>
                <LinearGradient colors={["#2d1f52", "#1e1535"]} style={[s.coachCard, shadow(1)]}>
                  <View style={s.coachHeader}>
                    <Text style={s.coachBadge}>💬 FANG</Text>
                    <View style={s.coachDot} />
                  </View>
                  <Text style={s.coachText}>{coach}</Text>
                </LinearGradient>
              </Entrance>
            ) : null}

            {/* How to use — explainer */}
            <Entrance delay={40}>
              <Card style={s.introCard} accent={C.primary}>
                <Text style={s.introTitle}>📖 {t(lang, "how_to_use")}</Text>
                <Text style={s.introText}>{t(lang, "how_to_use_body")}</Text>
              </Card>
            </Entrance>

            {/* Meal cards */}
            {planMeals.length > 0 ? planMeals.map((m, i) => {
              const col = mealColor(m.emoji);
              return (
                <Entrance key={i} delay={90 + i * 60}>
                  <Card style={s.mealCard} accent={col}>
                    <View style={s.mealHead}>
                      <View style={[s.mealIcon, { backgroundColor: `${col}22` }]}>
                        <Text style={{ fontSize: 22 }}>{m.emoji}</Text>
                      </View>
                      <Text style={[s.mealTitle, { color: col }]}>{m.title}</Text>
                      {m.kcal ? (
                        <View style={[s.kcalBadge, { borderColor: `${col}55`, backgroundColor: `${col}15` }]}>
                          <Text style={[s.kcalText, { color: col }]}>{m.kcal} kcal</Text>
                        </View>
                      ) : null}
                    </View>
                    {m.body ? <Text style={s.mealBody}>{m.body}</Text> : null}
                  </Card>
                </Entrance>
              );
            }) : (
              <Entrance delay={90}>
                <Card><Text style={s.planText}>{plan}</Text></Card>
              </Entrance>
            )}

            {/* Tips */}
            {tips.length > 0 && (
              <Entrance delay={300}>
                <Card style={s.tipsCard} accent={C.green}>
                  <Text style={s.tipsTitle}>💡 {t(lang, "tips")}</Text>
                  {tips.map((tip, i) => (
                    <View key={i} style={s.tipRow}>
                      <Text style={s.tipCheck}>✓</Text>
                      <Text style={s.tipText}>{tip}</Text>
                    </View>
                  ))}
                </Card>
              </Entrance>
            )}

            <Entrance delay={360}>
              <DuoButton color="white" icon="↻" label={t(lang, "get_program")} onPress={generate} />
            </Entrance>
          </>
          );
        })()}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { padding: SPACING.lg, paddingBottom: 60 },
  title: { color: C.text, fontSize: FONT.h2, fontWeight: "900", marginBottom: SPACING.lg, marginTop: SPACING.xs },

  heroCard: {
    borderRadius: RADIUS.xl, padding: SPACING.xxl, alignItems: "center",
    marginBottom: SPACING.lg, borderWidth: 1, borderColor: C.border, overflow: "hidden",
  },
  decoCircle: {
    position: "absolute", width: 220, height: 220, borderRadius: 110,
    backgroundColor: "rgba(168,85,247,0.07)", top: -60, right: -60,
  },
  mascotWrap: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: C.primarySoft, alignItems: "center", justifyContent: "center",
    overflow: "hidden", marginBottom: SPACING.xl,
  },
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
  mealPill: {
    flexDirection: "row", alignItems: "center", borderWidth: 1.5,
    borderRadius: RADIUS.pill, paddingVertical: 10, paddingHorizontal: 16, gap: 8,
  },
  mealEmoji: { fontSize: 18 },
  mealText: { fontSize: FONT.small, fontWeight: "800" },

  loadingWrap: { alignItems: "center", marginTop: 40, gap: SPACING.lg },
  loadingRing: {
    width: 180, height: 180, borderRadius: 90, backgroundColor: C.card,
    borderWidth: 2, borderColor: C.border, alignItems: "center", justifyContent: "center",
  },
  loadingText: { color: C.sub, fontSize: FONT.body, fontWeight: "700" },

  coachCard: {
    borderRadius: RADIUS.lg, padding: SPACING.xl, marginBottom: SPACING.lg,
    borderWidth: 1, borderColor: C.borderGlow,
  },
  coachHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: SPACING.md },
  coachBadge: { color: C.primary, fontSize: FONT.tiny, fontWeight: "900", letterSpacing: 2 },
  coachDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  coachText: { color: C.text, fontSize: FONT.body, fontWeight: "600", lineHeight: 24, fontStyle: "italic" },

  planText: { color: C.text, fontSize: FONT.body, fontWeight: "600", lineHeight: 28 },

  introCard: { marginBottom: SPACING.lg },
  introTitle: { color: C.text, fontSize: FONT.h3, fontWeight: "900", marginBottom: SPACING.sm },
  introText: { color: C.sub, fontSize: FONT.body, fontWeight: "600", lineHeight: 22 },

  mealCard: { marginBottom: SPACING.md },
  mealHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  mealIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  mealTitle: { flex: 1, fontSize: FONT.h3, fontWeight: "900" },
  kcalBadge: { borderWidth: 1.5, borderRadius: RADIUS.pill, paddingVertical: 5, paddingHorizontal: 12 },
  kcalText: { fontSize: FONT.small, fontWeight: "900" },
  mealBody: { color: C.text, fontSize: FONT.body, fontWeight: "600", lineHeight: 24, marginTop: SPACING.md },

  tipsCard: { marginBottom: SPACING.lg },
  tipsTitle: { color: C.text, fontSize: FONT.h3, fontWeight: "900", marginBottom: SPACING.md },
  tipRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.sm, alignItems: "flex-start" },
  tipCheck: { color: C.green, fontSize: FONT.body, fontWeight: "900", marginTop: 1 },
  tipText: { flex: 1, color: C.sub, fontSize: FONT.body, fontWeight: "600", lineHeight: 22 },
});
