import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Screen, DuoButton } from "@/lib/ui";
import { Mascot } from "@/lib/mascot";
import { C, SPACING, FONT } from "@/lib/theme";

export default function Welcome() {
  const router = useRouter();
  const { lang } = useApp();

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(40)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(rise, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Screen edges={["top", "bottom"]}>
      {/* Full-screen gradient background */}
      <LinearGradient
        colors={["#0c0818", "#1a0a2e", "#0c0818"]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[s.wrap, { opacity: fade, transform: [{ translateY: rise }] }]}>
        <View style={s.hero}>
          {/* Glow ring behind mascot */}
          <Animated.View style={[s.glowRing, { transform: [{ scale: pulse }] }]} />
          <LinearGradient
            colors={["#4c1d95", "#7c3aed", "#a855f7"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.badge}
          >
            <Mascot pose="hero" size={290} style={s.badgeImg} />
          </LinearGradient>

          <Text style={s.brand}>
            Fit<Text style={{ color: C.primary }}>Wolf</Text>
          </Text>
          <Text style={s.tagline}>{t(lang, "tagline")}</Text>
        </View>

        <View style={s.actions}>
          <DuoButton label={t(lang, "get_started")} onPress={() => router.push("/auth")} />
          <DuoButton label={t(lang, "have_account")} color="white" onPress={() => router.push("/auth")} />
        </View>
      </Animated.View>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "space-between", paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl },
  hero: { flex: 1, justifyContent: "center", alignItems: "center" },

  glowRing: {
    position: "absolute",
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: "transparent",
    shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 40,
    borderWidth: 1, borderColor: `${C.primary}20`,
  },

  badge: {
    width: 260, height: 260, borderRadius: 130,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
    shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 24,
  },
  badgeImg: { resizeMode: "contain" },
  brand: { fontSize: 54, fontWeight: "900", color: C.text, letterSpacing: -2, marginTop: SPACING.xl },
  tagline: { color: C.sub, fontSize: FONT.body, fontWeight: "600", textAlign: "center", marginTop: SPACING.lg, lineHeight: 24, paddingHorizontal: SPACING.xl },
  actions: { gap: SPACING.sm },
});
