import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Alert, Animated } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api, Targets, DayLog } from "@/lib/api";
import { Card, MacroBar, Ring, Stat, Screen, GradientBanner, Tag, Entrance, LogButton, DuoButton } from "@/lib/ui";
import { Mascot } from "@/lib/mascot";
import { macroColors, macroGlows, C, SPACING, FONT, RADIUS, glow } from "@/lib/theme";
import { nudgeIfNotEaten } from "@/lib/notifications";

function computeStreak(days: Record<string, any>): number {
  let streak = 0;
  const d = new Date();
  const key = () => d.toISOString().slice(0, 10);
  if (!days[key()]?.meals?.length) d.setDate(d.getDate() - 1);
  while (days[key()]?.meals?.length) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

export default function Dashboard() {
  const { lang } = useApp();
  const router = useRouter();
  const [targets, setTargets] = useState<Targets | null>(null);
  const [today, setToday] = useState<DayLog | null>(null);
  const [bmi, setBmi] = useState<number | null>(null);
  const [bmiCat, setBmiCat] = useState("");
  const [streak, setStreak] = useState(0);
  const [totalMeals, setTotalMeals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const load = async () => {
    try {
      const me = await api.me();
      if (me?.user) {
        setTargets(me.user.targets);
        setToday(me.today);
        setBmi(me.bmi);
        setBmiCat(me.bmiCategory ?? "");
        const days = me.user.days ?? {};
        setStreak(computeStreak(days));
        setTotalMeals(Object.values(days).reduce((n: number, d: any) => n + (d.meals?.length ?? 0), 0));
        nudgeIfNotEaten(lang, me.today?.meals?.length ?? 0);
      }
    } catch {}
    setLoading(false);
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const logMeal = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const asset = perm.granted
      ? (await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false }))
      : (await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images }));
    if (asset.canceled) return;
    setAnalyzing(true);
    try {
      const photo = asset.assets[0];
      const mimeType = photo.mimeType ?? "image/jpeg";
      const out = await api.analyze(photo.uri, mimeType);
      const m = out.meal;
      const r = out.result;
      const extras = [
        r.fiber > 0 ? `🌾 Fiber: ${r.fiber}g` : null,
        r.sugar > 0 ? `🍬 Sugar: ${r.sugar}g` : null,
        r.sodium > 0 ? `🧂 Sodium: ${r.sodium}mg` : null,
        r.ingredients_detected ? `\n🔍 ${r.ingredients_detected}` : null,
      ].filter(Boolean).join("   ");
      const body =
        `~${m.estimatedGrams}g\n\n` +
        `🔥 ${Math.round(m.calories)} kcal\n` +
        `🥩 ${m.protein}g protein   🍚 ${m.carbs}g carbs   🥑 ${m.fat}g fat\n` +
        (extras ? `${extras}\n` : "") +
        (r.coach_message ? `\n💬 ${r.coach_message}` : "");
      Alert.alert(`🍽️  ${m.food}`, body);
      await load();
    } catch (err: any) {
      const detail = err?.message ?? "";
      const msg = detail.includes("404") || detail.includes("no_profile")
        ? "Please complete your profile first."
        : detail && !detail.match(/^\d+$/)
          ? detail
          : t(lang, "analyze_error" as any) || "Could not analyze this photo. Please try again.";
      Alert.alert("⚠️", msg);
    } finally { setAnalyzing(false); }
  };

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator color={C.primary} size="large" />
    </View>
  );
  if (!targets || !today) return (
    <View style={s.center}>
      <Text style={{ color: C.sub, fontSize: FONT.body, fontWeight: "700" }}>No profile found.</Text>
    </View>
  );

  const calLeft = Math.max(targets.calories - today.calories, 0);
  const calPct = today.calories / Math.max(targets.calories, 1);
  const bmiColor = bmiCat === "Normal weight" ? C.green
    : bmiCat === "Underweight" ? C.blue
    : bmiCat === "Overweight" ? C.yellow : C.red;

  return (
    <Screen edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.wrap}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.primary} />}
      >
        {/* ── Header ── */}
        <Entrance delay={0}>
          <GradientBanner
            colors={["#4c1d95", "#7c3aed", "#a855f7"]}
            style={s.header}
          >
            {/* Decorative circle */}
            <View style={s.decoCircle} />
            <View style={s.decoCircle2} />

            <View style={{ flexDirection: "row", alignItems: "center", zIndex: 1 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.brand}>fit<Text style={{ color: "rgba(255,255,255,0.95)" }}>Wolf</Text></Text>
                <Text style={s.greeting}>{t(lang, "greeting")}</Text>
              </View>
              <Mascot pose="flex" size={80} />
            </View>
            <View style={s.tags}>
              <Tag light icon="🔥" label={`${streak} ${t(lang, "streak")}`} />
              <Tag light icon="🍽️" label={`${totalMeals} ${t(lang, "logged")}`} />
            </View>
          </GradientBanner>
        </Entrance>

        {/* ── Calorie ring ── */}
        <Entrance delay={80}>
          <Card style={s.ringCard}>
            <Ring
              progress={calPct}
              color={macroColors.calories}
              value={`${Math.round(calLeft)}`}
              label={t(lang, "kcal_left")}
              sub={`${Math.round(today.calories)} / ${targets.calories} ${t(lang, "eaten")}`}
              size={210}
              stroke={22}
            />
            <View style={s.statsRow}>
              <Stat icon="🥩" value={`${Math.round(today.protein)}g`} label={t(lang, "protein")} color={macroColors.protein} />
              <View style={s.divider} />
              <Stat icon="🍚" value={`${Math.round(today.carbs)}g`} label={t(lang, "carbs")} color={macroColors.carbs} />
              <View style={s.divider} />
              <Stat icon="🥑" value={`${Math.round(today.fat)}g`} label={t(lang, "fat")} color={macroColors.fat} />
            </View>
          </Card>
        </Entrance>

        {/* ── Macro bars ── */}
        <Entrance delay={160}>
          <Card>
            <MacroBar
              label={`🥩 ${t(lang, "protein")}`}
              eaten={today.protein} target={targets.protein}
              unit="g" color={macroColors.protein} leftWord={t(lang, "left")}
            />
            <MacroBar
              label={`🍚 ${t(lang, "carbs")}`}
              eaten={today.carbs} target={targets.carbs}
              unit="g" color={macroColors.carbs} leftWord={t(lang, "left")}
            />
            <MacroBar
              label={`🥑 ${t(lang, "fat")}`}
              eaten={today.fat} target={targets.fat}
              unit="g" color={macroColors.fat} leftWord={t(lang, "left")}
            />
          </Card>
        </Entrance>

        {/* ── BMI card ── */}
        {bmi != null && (
          <Entrance delay={240}>
            <Card accent={bmiColor} style={s.bmiCard}>
              <View>
                <Text style={s.bmiLabel}>📐 {t(lang, "bmi")}</Text>
                <Text style={[s.bmiCat, { color: bmiColor }]}>{bmiCat}</Text>
              </View>
              <View style={[s.bmiValueBadge, { backgroundColor: `${bmiColor}18`, borderColor: `${bmiColor}40` }]}>
                <Text style={[s.bmiValue, { color: bmiColor }]}>{bmi}</Text>
              </View>
            </Card>
          </Entrance>
        )}

        {/* ── Log CTA (photo) ── */}
        <Entrance delay={320}>
          <LogButton
            label={analyzing ? t(lang, "analyzing") : t(lang, "log_meal")}
            onPress={logMeal}
            loading={analyzing}
          />
        </Entrance>

        {/* ── Other ways to log ── */}
        <Entrance delay={380}>
          <View style={s.logRow}>
            <View style={{ flex: 1 }}>
              <DuoButton label="Search" icon="🔍" color="white" onPress={() => router.push("/search-food")} />
            </View>
            <View style={{ flex: 1 }}>
              <DuoButton label="Barcode" icon="🏷️" color="white" onPress={() => router.push("/scan-barcode")} />
            </View>
          </View>
        </Entrance>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { padding: SPACING.lg, paddingBottom: 60 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.bg },
  logRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.xs },

  header: { marginTop: SPACING.xs, paddingVertical: SPACING.xl, paddingHorizontal: SPACING.xl, overflow: "hidden" },
  decoCircle: {
    position: "absolute", width: 200, height: 200, borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.05)", top: -60, right: -40,
  },
  decoCircle2: {
    position: "absolute", width: 120, height: 120, borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.04)", bottom: -40, left: -20,
  },

  brand: { color: "rgba(255,255,255,0.55)", fontSize: FONT.h1, fontWeight: "900", letterSpacing: -1 },
  greeting: { color: "rgba(255,255,255,0.75)", fontSize: FONT.small, fontWeight: "700", marginTop: 4 },
  tags: { flexDirection: "row", gap: 8, marginTop: SPACING.lg },

  ringCard: { alignItems: "center", paddingVertical: SPACING.xxl },
  statsRow: { flexDirection: "row", alignItems: "center", marginTop: SPACING.xl, alignSelf: "stretch" },
  divider: { width: 1, height: 40, backgroundColor: C.border },

  bmiCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: SPACING.lg },
  bmiLabel: { color: C.faint, fontSize: FONT.tiny, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  bmiCat: { fontSize: FONT.h3, fontWeight: "900", marginTop: 4 },
  bmiValueBadge: {
    borderWidth: 1.5, borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
  },
  bmiValue: { fontSize: 40, fontWeight: "900", letterSpacing: -1 },
});
