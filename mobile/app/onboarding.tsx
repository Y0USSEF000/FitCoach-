import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useApp } from "@/lib/store";
import { LANGUAGES, t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { C, RADIUS, SPACING, FONT } from "@/lib/theme";
import { Screen, DuoButton, OptionCard, TopBar } from "@/lib/ui";
import { Mascot } from "@/lib/mascot";

const STEPS = ["lang", "height", "weight", "age", "gender", "activity", "goal"] as const;
type Step = (typeof STEPS)[number] | "saving";

const SPEECH: Record<string, string> = {
  lang:     "🌍  Choose your language",
  height:   "📏  How tall are you?",
  weight:   "⚖️  What's your weight?",
  age:      "🎂  How old are you?",
  gender:   "👤  Tell me about yourself",
  activity: "🏃  How active are you?",
  goal:     "🎯  What's your goal?",
};

const UNIT: Record<string, string> = { height: "cm", weight: "kg", age: "yrs" };

export default function Onboarding() {
  const router = useRouter();
  const { lang, setLang, refresh, signOut } = useApp();
  const [step, setStep] = useState<Step>("lang");
  const [d, setD] = useState<any>({});
  const [text, setText] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Slide + fade transition ─────────────────────────────
  const opacity = useRef(new Animated.Value(1)).current;
  const slideX  = useRef(new Animated.Value(0)).current;

  const animate = (direction: "forward" | "back", cb: () => void) => {
    const outX = direction === "forward" ? -40 : 40;
    const inX  = direction === "forward" ?  50 : -50;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 90, useNativeDriver: true }),
      Animated.timing(slideX,  { toValue: outX, duration: 90, useNativeDriver: true }),
    ]).start(() => {
      cb();
      slideX.setValue(inX);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(slideX,  { toValue: 0, useNativeDriver: true, tension: 120, friction: 11 }),
      ]).start();
    });
  };

  const goNext = (next: Step) => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    animate("forward", () => { setText(""); setSel(null); setStep(next); });
  };

  const goBack = async () => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    const idx = STEPS.indexOf(step as any);
    // On the first step there's nothing to go back to (we arrived here via a
    // redirect), so log out and return to the welcome / email screen.
    if (idx <= 0) { await signOut(); router.replace("/welcome"); return; }
    animate("back", () => { setText(""); setSel(null); setStep(STEPS[idx - 1]); });
  };

  // ── Auto-advance choice (Duolingo style) ────────────────
  const pick = (key: string, value: string, next: Step | "save") => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    setSel(value);
    const merged = { ...d, [key]: value };
    setD(merged);
    autoTimer.current = setTimeout(() => {
      if (next === "save") save(merged);
      else goNext(next);
    }, 320);
  };

  useEffect(() => () => { if (autoTimer.current) clearTimeout(autoTimer.current); }, []);

  const submitNumber = (key: string, min: number, max: number, next: Step) => {
    const v = parseFloat(text);
    if (isNaN(v) || v < min || v > max) {
      Alert.alert("⚠️", `Enter a value between ${min} and ${max}`);
      return;
    }
    setD({ ...d, [key]: v });
    goNext(next);
  };

  const save = async (data: any) => {
    setStep("saving");
    try {
      await api.onboard({
        lang,
        height: data.height, weight: data.weight, age: data.age,
        gender: data.gender, activity: data.activity, goal: data.goal,
      });
      await refresh();
      router.replace("/(tabs)");
    } catch {
      Alert.alert("Error", "Could not save. Is the backend running?");
      setStep("goal");
    }
  };

  // ── Saving screen ────────────────────────────────────────
  if (step === "saving") {
    return (
      <Screen>
        <LinearGradient colors={["#0c0818", "#1a0a2e"]} style={StyleSheet.absoluteFill} />
        <View style={s.saving}>
          <View style={s.savingRing}>
            <Mascot pose="hero" size={180} />
          </View>
          <Text style={s.savingTitle}>{t(lang, "lets_go")}</Text>
          <Text style={s.savingSubtitle}>Building your plan…</Text>
        </View>
      </Screen>
    );
  }

  const idx      = STEPS.indexOf(step as any);
  const progress = idx < 0 ? 1 : (idx + 1) / STEPS.length;

  // ── Step dot indicators ──────────────────────────────────
  const Dots = () => (
    <View style={s.dots}>
      {STEPS.map((_, i) => (
        <View key={i} style={[s.dot, i === idx && s.dotActive, i < idx && s.dotDone]} />
      ))}
    </View>
  );

  return (
    <Screen edges={["top"]}>
      <LinearGradient colors={["#0c0818", "#130f22"]} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Top bar */}
        <TopBar progress={progress} onBack={goBack} />

        {/* Slide container */}
        <Animated.View style={[s.body, { opacity, transform: [{ translateX: slideX }] }]}>

          {/* Step label */}
          <View style={s.stepRow}>
            <LinearGradient colors={["#7c3aed", "#a855f7"]} style={s.stepBadge}>
              <Text style={s.stepText}>{SPEECH[step]}</Text>
            </LinearGradient>
          </View>

          <Dots />

          {/* ── Language ── */}
          {step === "lang" && (
            <>
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                {LANGUAGES.map((l) => (
                  <OptionCard
                    key={l.code}
                    label={l.label}
                    selected={sel === l.code}
                    onPress={() => setSel(l.code)}
                  />
                ))}
              </ScrollView>
              <View style={s.footer}>
                <DuoButton
                  label={t(lang, "continue_btn")}
                  disabled={!sel}
                  onPress={() => {
                    if (!sel) return;
                    // Fire-and-forget — don't await, navigate immediately
                    setLang(sel as any);
                    goNext("height");
                  }}
                />
              </View>
            </>
          )}

          {/* ── Number inputs ── */}
          {(step === "height" || step === "weight" || step === "age") && (() => {
            const cfg: Record<string, [string, number, number, Step]> = {
              height: ["height", 100, 250, "weight"],
              weight: ["weight", 30, 300, "age"],
              age:    ["age", 10, 100, "gender"],
            };
            const [key, min, max, next] = cfg[step];
            return (
              <>
                <View style={s.numWrap}>
                  <TextInput
                    style={s.numInput}
                    keyboardType="numeric"
                    placeholder="—"
                    placeholderTextColor={C.faint}
                    value={text}
                    onChangeText={setText}
                    autoFocus
                    onSubmitEditing={() => submitNumber(key, min, max, next)}
                    returnKeyType="done"
                  />
                  <Text style={s.numUnit}>{UNIT[step]}</Text>
                </View>
                <View style={s.footer}>
                  <DuoButton
                    label={t(lang, "continue_btn")}
                    disabled={!text}
                    onPress={() => submitNumber(key, min, max, next)}
                  />
                </View>
              </>
            );
          })()}

          {/* ── Gender ── */}
          {step === "gender" && (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {[
                { key: "male",   label: t(lang, "male"),   emoji: "👨" },
                { key: "female", label: t(lang, "female"), emoji: "👩" },
              ].map((o) => (
                <OptionCard
                  key={o.key}
                  label={o.label}
                  emoji={o.emoji}
                  selected={sel === o.label}
                  onPress={() => pick("gender", o.label, "activity")}
                />
              ))}
            </ScrollView>
          )}

          {/* ── Activity ── */}
          {step === "activity" && (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {[
                { key: "sedentary",  emoji: "🪑" },
                { key: "light",      emoji: "🚶" },
                { key: "moderate",   emoji: "🏃" },
                { key: "active",     emoji: "🚴" },
                { key: "very_active",emoji: "🔥" },
              ].map((o) => (
                <OptionCard
                  key={o.key}
                  label={t(lang, o.key)}
                  emoji={o.emoji}
                  selected={sel === t(lang, o.key)}
                  onPress={() => pick("activity", t(lang, o.key), "goal")}
                />
              ))}
            </ScrollView>
          )}

          {/* ── Goal ── */}
          {step === "goal" && (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {[
                { key: "lose_fat",     emoji: "🔥" },
                { key: "gain_muscle",  emoji: "💪" },
                { key: "maintain",     emoji: "⚖️" },
              ].map((o) => (
                <OptionCard
                  key={o.key}
                  label={t(lang, o.key)}
                  emoji={o.emoji}
                  selected={sel === t(lang, o.key)}
                  onPress={() => pick("goal", t(lang, o.key), "save")}
                />
              ))}
            </ScrollView>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: SPACING.lg },

  stepRow: { marginBottom: SPACING.md },
  stepBadge: {
    alignSelf: "flex-start", borderRadius: RADIUS.pill,
    paddingHorizontal: 16, paddingVertical: 9,
  },
  stepText: { color: "#fff", fontSize: FONT.body, fontWeight: "800" },

  dots: { flexDirection: "row", gap: 6, marginBottom: SPACING.xl },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.track,
  },
  dotActive: { width: 24, backgroundColor: C.primary },
  dotDone:   { backgroundColor: `${C.primary}60` },

  numWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  numInput: {
    backgroundColor: C.card, color: C.text, borderRadius: RADIUS.lg,
    padding: 24, fontSize: 56, fontWeight: "900",
    borderWidth: 2, borderColor: C.borderStrong,
    textAlign: "center", width: "65%", letterSpacing: -2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 10,
  },
  numUnit: { color: C.primary, fontSize: FONT.h2, fontWeight: "900" },

  footer: { paddingVertical: SPACING.md },

  saving: { flex: 1, justifyContent: "center", alignItems: "center", gap: SPACING.xl },
  savingRing: {
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: C.primarySoft, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: `${C.primary}50`,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 30,
  },
  savingTitle:    { color: C.primary, fontSize: FONT.h1, fontWeight: "900", letterSpacing: -1 },
  savingSubtitle: { color: C.sub, fontSize: FONT.body, fontWeight: "600" },
});
