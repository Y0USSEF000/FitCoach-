import { useCallback, useState } from "react";
import { View, Text, ScrollView, Switch, Pressable, TextInput, StyleSheet, Alert, Animated } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useApp } from "@/lib/store";
import { LANGUAGES, Lang, t } from "@/lib/i18n";
import { api, NotificationPrefs } from "@/lib/api";
import { DuoButton, Screen, Entrance } from "@/lib/ui";
import { C, SPACING, FONT, RADIUS, shadow } from "@/lib/theme";
import { requestPermissions, rescheduleAll } from "@/lib/notifications";

const DEFAULTS: NotificationPrefs = {
  mealReminders: true, waterReminders: true, didYouEatToday: true,
  mealTimes: ["08:00", "13:00", "19:00"], waterIntervalHours: 2,
};

export default function Settings() {
  const { lang, setLang, refresh, signOut } = useApp();
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULTS);

  const load = async () => { const p = await api.getNotifications(); if (p) setPrefs(p); };
  useFocusEffect(useCallback(() => { load(); }, []));

  const update = (patch: Partial<NotificationPrefs>) => setPrefs({ ...prefs, ...patch });

  const save = async () => {
    const ok = await requestPermissions();
    if (!ok) Alert.alert("⚠️", "Enable notifications on a physical device.");
    try { await api.setNotifications(prefs); } catch {}
    await rescheduleAll(lang, prefs);
    Alert.alert("✅", t(lang, "save"));
  };

  const changeLang = async (l: Lang) => { await setLang(l); await rescheduleAll(l, prefs); };

  const reset = () => {
    Alert.alert(t(lang, "reset"), "Reset all your data?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset", style: "destructive", onPress: async () => {
          try { await api.reset(); } catch {}
          await signOut();
          router.replace("/welcome");
        }
      },
    ]);
  };

  const setMealTime = (i: number, v: string) => {
    const times = [...prefs.mealTimes]; times[i] = v; update({ mealTimes: times });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.wrap} showsVerticalScrollIndicator={false}>

        <Entrance delay={0}>
          <Text style={s.title}>⚙️ {t(lang, "settings")}</Text>
        </Entrance>

        {/* Notifications block */}
        <Entrance delay={60}>
          <View style={[s.section, shadow(1)]}>
            <LinearGradient colors={["#1e1535", "#130f22"]} style={s.sectionGrad}>
              <Text style={s.sectionTitle}>🔔 {t(lang, "notifications")}</Text>

              <ToggleRow
                icon="🍽️" label={t(lang, "meal_reminders")}
                value={prefs.mealReminders} onChange={(v) => update({ mealReminders: v })}
              />
              <ToggleRow
                icon="💧" label={t(lang, "water_reminders")}
                value={prefs.waterReminders} onChange={(v) => update({ waterReminders: v })}
              />
              <ToggleRow
                icon="👀" label={t(lang, "did_you_eat")}
                value={prefs.didYouEatToday} onChange={(v) => update({ didYouEatToday: v })}
              />

              {prefs.mealReminders && (
                <View style={s.subBlock}>
                  <Text style={s.subLabel}>{t(lang, "meal_times")}</Text>
                  <View style={s.timeRow}>
                    {prefs.mealTimes.map((time, i) => (
                      <TextInput
                        key={i} style={s.timeInput} value={time}
                        onChangeText={(v) => setMealTime(i, v)}
                        placeholder="08:00" placeholderTextColor={C.faint}
                      />
                    ))}
                  </View>
                </View>
              )}
              {prefs.waterReminders && (
                <View style={s.subBlock}>
                  <Text style={s.subLabel}>{t(lang, "water_every")}</Text>
                  <TextInput
                    style={[s.timeInput, { width: 90, marginTop: 8 }]}
                    keyboardType="numeric"
                    value={String(prefs.waterIntervalHours)}
                    onChangeText={(v) => update({ waterIntervalHours: parseInt(v || "2", 10) || 2 })}
                  />
                </View>
              )}

              <DuoButton label={t(lang, "save")} icon="💾" onPress={save} style={{ marginTop: SPACING.lg }} />
            </LinearGradient>
          </View>
        </Entrance>

        {/* Language block */}
        <Entrance delay={120}>
          <View style={[s.section, shadow(1)]}>
            <LinearGradient colors={["#1e1535", "#130f22"]} style={s.sectionGrad}>
              <Text style={s.sectionTitle}>🌍 {t(lang, "change_lang")}</Text>
              <View style={s.langGrid}>
                {LANGUAGES.map((l) => {
                  const active = lang === l.code;
                  return (
                    <Pressable
                      key={l.code}
                      onPress={() => changeLang(l.code)}
                    >
                      <LinearGradient
                        colors={active ? [C.primarySoft, "#2d1f52"] : [C.card, C.card]}
                        style={[s.langBtn, active && { borderColor: C.primary }]}
                      >
                        <Text style={[s.langText, active && { color: C.primary, fontWeight: "900" }]}>
                          {l.label}
                        </Text>
                        {active && <View style={s.langCheck}><Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>✓</Text></View>}
                      </LinearGradient>
                    </Pressable>
                  );
                })}
              </View>
            </LinearGradient>
          </View>
        </Entrance>

        {/* Danger zone */}
        <Entrance delay={180}>
          <View style={[s.dangerSection, shadow(1)]}>
            <Text style={s.dangerLabel}>DANGER ZONE</Text>
            <DuoButton color="red" icon="🔄" label={t(lang, "reset")} onPress={reset} />
          </View>
        </Entrance>
      </ScrollView>
    </Screen>
  );
}

function ToggleRow({ icon, label, value, onChange }: { icon: string; label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.row}>
      <Text style={s.rowIcon}>{icon}</Text>
      <Text style={s.rowLabel}>{label}</Text>
      <Switch
        value={value} onValueChange={onChange}
        trackColor={{ true: C.primary, false: C.track }}
        thumbColor="#fff"
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: SPACING.lg, paddingBottom: 60 },
  title: { color: C.text, fontSize: FONT.h2, fontWeight: "900", marginBottom: SPACING.lg, marginTop: SPACING.xs },

  section: { borderRadius: RADIUS.lg, marginBottom: SPACING.lg, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  sectionGrad: { padding: SPACING.xl },
  sectionTitle: { color: C.text, fontSize: FONT.h3, fontWeight: "800", marginBottom: SPACING.lg },

  row: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: C.border },
  rowIcon: { fontSize: 20, marginRight: SPACING.md, width: 28 },
  rowLabel: { color: C.text, fontSize: FONT.body, flex: 1, fontWeight: "700" },

  subBlock: { marginTop: SPACING.md, paddingTop: SPACING.md },
  subLabel: { color: C.sub, fontSize: FONT.small, fontWeight: "800", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 },
  timeRow: { flexDirection: "row", gap: 8 },
  timeInput: {
    backgroundColor: C.bg, color: C.text, borderRadius: RADIUS.sm,
    padding: 12, borderWidth: 1.5, borderColor: C.borderStrong,
    textAlign: "center", flex: 1, fontWeight: "800", fontSize: FONT.body,
  },

  langGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  langBtn: {
    borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: 16,
    borderWidth: 1.5, borderColor: C.border,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  langText: { color: C.text, fontSize: FONT.body, fontWeight: "700" },
  langCheck: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
  },

  dangerSection: {
    borderRadius: RADIUS.lg, padding: SPACING.xl, marginBottom: SPACING.lg,
    borderWidth: 1, borderColor: `${C.red}30`, backgroundColor: `${C.red}08`,
  },
  dangerLabel: { color: C.red, fontSize: FONT.tiny, fontWeight: "900", letterSpacing: 2, marginBottom: SPACING.md },
});
