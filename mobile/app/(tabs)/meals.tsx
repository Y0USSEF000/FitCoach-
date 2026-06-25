import { useCallback, useState } from "react";
import { Text, ScrollView, View, StyleSheet, RefreshControl, Pressable } from "react-native";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api, DayLog } from "@/lib/api";
import { Card, DuoButton, Screen, Entrance } from "@/lib/ui";
import { Mascot } from "@/lib/mascot";
import { C, SPACING, FONT, RADIUS, macroColors, shadow, glow } from "@/lib/theme";

export default function Meals() {
  const { lang } = useApp();
  const [day, setDay] = useState<DayLog | null>(null);

  const load = async () => {
    const me = await api.me();
    setDay(me?.today ?? null);
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const undo = async () => { await api.undo(); await load(); };
  const meals = day?.meals ?? [];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={s.wrap}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.primary} />}
      >
        {/* Header */}
        <Entrance delay={0}>
          <View style={s.header}>
            <Text style={s.title}>🥗 {t(lang, "meals")}</Text>
            <View style={s.dateBadge}>
              <Text style={s.dateText}>
                {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </Text>
            </View>
          </View>
        </Entrance>

        {meals.length === 0 ? (
          <Entrance delay={60}>
            <View style={s.empty}>
              <View style={s.emptyRing}>
                <Mascot pose="eat" size={140} />
              </View>
              <Text style={s.emptyTitle}>No meals yet</Text>
              <Text style={s.emptyText}>{t(lang, "no_meals")}</Text>
            </View>
          </Entrance>
        ) : (
          <>
            {meals.map((m, i) => {
              const mealColors = [macroColors.calories, macroColors.protein, macroColors.carbs, macroColors.fat];
              const accent = mealColors[i % mealColors.length];
              return (
                <Entrance key={i} delay={i * 60}>
                  <View style={[s.mealCard, shadow(2)]}>
                    {/* Gradient accent bar */}
                    <LinearGradient
                      colors={[accent, `${accent}44`]}
                      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                      style={s.mealAccent}
                    />

                    <View style={s.mealContent}>
                      <View style={s.mealTop}>
                        <Text style={s.foodName} numberOfLines={1}>{m.food}</Text>
                        <View style={[s.timePill, { backgroundColor: `${accent}18`, borderColor: `${accent}40` }]}>
                          <Text style={[s.timeText, { color: accent }]}>{m.time}</Text>
                        </View>
                      </View>

                      <Text style={s.gramsText}>~{m.estimatedGrams}g serving</Text>

                      <View style={s.macroRow}>
                        <MacroChip value={Math.round(m.calories)} label="kcal" color={macroColors.calories} icon="🔥" />
                        <MacroChip value={m.protein} label="protein" color={macroColors.protein} icon="🥩" />
                        <MacroChip value={m.carbs} label="carbs" color={macroColors.carbs} icon="🍚" />
                        <MacroChip value={m.fat} label="fat" color={macroColors.fat} icon="🥑" />
                      </View>
                    </View>
                  </View>
                </Entrance>
              );
            })}

            {/* Daily total card */}
            <Entrance delay={meals.length * 60 + 60}>
              <LinearGradient
                colors={["#16102a", "#1e1535"]}
                style={[s.totalCard, shadow(2)]}
              >
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>TODAY'S TOTAL</Text>
                  <View style={[s.totalCalBadge]}>
                    <Text style={s.totalCal}>{Math.round(day!.calories)}</Text>
                    <Text style={s.totalCalUnit}>kcal</Text>
                  </View>
                </View>
                <View style={s.totalMacros}>
                  <TotalMacro value={day!.protein} label="Protein" color={macroColors.protein} />
                  <TotalMacro value={day!.carbs} label="Carbs" color={macroColors.carbs} />
                  <TotalMacro value={day!.fat} label="Fat" color={macroColors.fat} />
                </View>
              </LinearGradient>
            </Entrance>

            <Entrance delay={meals.length * 60 + 120}>
              <DuoButton color="red" icon="↩️" label={t(lang, "undo_last")} onPress={undo} />
            </Entrance>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function MacroChip({ value, label, color, icon }: { value: number; label: string; color: string; icon: string }) {
  return (
    <View style={[s.chip, { backgroundColor: `${color}14`, borderColor: `${color}35` }]}>
      <Text style={s.chipIcon}>{icon}</Text>
      <Text style={[s.chipValue, { color }]}>{Math.round(value)}</Text>
      <Text style={s.chipLabel}>{label}</Text>
    </View>
  );
}

function TotalMacro({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={s.totalMacroItem}>
      <Text style={[s.totalMacroValue, { color }]}>{Math.round(value)}g</Text>
      <Text style={s.totalMacroLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: SPACING.lg, paddingBottom: 60 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.lg, marginTop: SPACING.xs },
  title: { color: C.text, fontSize: FONT.h2, fontWeight: "900" },
  dateBadge: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 7 },
  dateText: { color: C.sub, fontSize: FONT.small, fontWeight: "800" },

  empty: { alignItems: "center", marginTop: 50, gap: 16 },
  emptyRing: {
    width: 180, height: 180, borderRadius: 90, backgroundColor: C.card,
    borderWidth: 2, borderColor: C.border, alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { color: C.text, fontSize: FONT.h3, fontWeight: "900" },
  emptyText: { color: C.sub, textAlign: "center", fontSize: FONT.body, fontWeight: "600", paddingHorizontal: 30, lineHeight: 22 },

  mealCard: {
    backgroundColor: C.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: C.border,
    marginBottom: SPACING.lg, overflow: "hidden", flexDirection: "row",
  },
  mealAccent: { width: 5 },
  mealContent: { flex: 1, padding: SPACING.lg },
  mealTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  foodName: { color: C.text, fontWeight: "900", fontSize: FONT.h3, flex: 1, marginRight: SPACING.sm },
  timePill: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  timeText: { fontSize: FONT.tiny, fontWeight: "800" },
  gramsText: { color: C.faint, fontSize: FONT.tiny, fontWeight: "700", marginBottom: SPACING.md },

  macroRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  chip: { borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center", minWidth: 64 },
  chipIcon: { fontSize: 14, marginBottom: 2 },
  chipValue: { fontSize: FONT.body, fontWeight: "900" },
  chipLabel: { color: C.faint, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 1 },

  totalCard: { borderRadius: RADIUS.lg, padding: SPACING.xl, marginBottom: SPACING.lg, borderWidth: 1, borderColor: C.borderStrong },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.lg },
  totalLabel: { color: C.sub, fontSize: FONT.tiny, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" },
  totalCalBadge: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  totalCal: { color: C.text, fontSize: 36, fontWeight: "900", letterSpacing: -1 },
  totalCalUnit: { color: C.sub, fontSize: FONT.small, fontWeight: "800" },
  totalMacros: { flexDirection: "row", justifyContent: "space-around" },
  totalMacroItem: { alignItems: "center" },
  totalMacroValue: { fontSize: FONT.h3, fontWeight: "900" },
  totalMacroLabel: { color: C.faint, fontSize: FONT.tiny, fontWeight: "800", textTransform: "uppercase", marginTop: 2 },
});
