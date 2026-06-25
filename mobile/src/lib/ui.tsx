import React, { useRef, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  Animated, ViewStyle, TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { C, RADIUS, SPACING, FONT, shadow, glow } from "./theme";
import { Mascot } from "./mascot";

// ─── Screen ─────────────────────────────────────────────────
export function Screen({ children, edges, bg }: { children: React.ReactNode; edges?: any; bg?: string }) {
  return (
    <SafeAreaView style={[s.screen, bg ? { backgroundColor: bg } : null]} edges={edges ?? ["top"]}>
      {children}
    </SafeAreaView>
  );
}

// ─── Entrance animation ──────────────────────────────────────
export function Entrance({
  children, delay = 0, dy = 24, style,
}: { children: React.ReactNode; delay?: number; dy?: number; style?: ViewStyle }) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(dy)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 420, delay, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, delay, useNativeDriver: true, tension: 80, friction: 10 }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[{ opacity: fade, transform: [{ translateY: slide }] }, style]}>
      {children}
    </Animated.View>
  );
}

// ─── Gradient banner ─────────────────────────────────────────
export function GradientBanner({
  children, style, colors,
}: { children: React.ReactNode; style?: ViewStyle; colors?: [string, string, ...string[]] }) {
  return (
    <LinearGradient
      colors={colors ?? ["#7c3aed", "#a855f7", "#6d28d9"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[s.banner, shadow(2), style]}
    >
      {children}
    </LinearGradient>
  );
}

// ─── Glass card ──────────────────────────────────────────────
export function Card({
  children, style, accent, glowColor, pressable, onPress,
}: {
  children: React.ReactNode; style?: ViewStyle; accent?: string;
  glowColor?: string; pressable?: boolean; onPress?: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    onPress?.();
  };
  const inner = (
    <Animated.View style={[s.card, shadow(1), glowColor && glow(glowColor, 10), { transform: [{ scale }] }, style]}>
      {accent && <View style={[s.accent, { backgroundColor: accent }]} />}
      {children}
    </Animated.View>
  );
  return pressable ? <Pressable onPress={press}>{inner}</Pressable> : inner;
}

export function SectionTitle({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[s.section, style]}>{children}</Text>;
}

// ─── Tag / chip ──────────────────────────────────────────────
export function Tag({
  icon, label, color = C.primary, light, glow: withGlow,
}: { icon?: string; label: string; color?: string; light?: boolean; glow?: boolean }) {
  return (
    <View style={[
      s.tag,
      light
        ? { backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }
        : { backgroundColor: `${color}18`, borderColor: `${color}45`, borderWidth: 1.5 },
      withGlow && glow(color, 6),
    ]}>
      <Text style={[s.tagText, { color: light ? "#fff" : color }]}>{icon ? `${icon} ` : ""}{label}</Text>
    </View>
  );
}

// ─── Duolingo-style 3D button with gradient ──────────────────
export function DuoButton({
  label, onPress, color = "primary", loading, disabled, icon, style,
}: {
  label: string; onPress: () => void;
  color?: "primary" | "green" | "white" | "red";
  loading?: boolean; disabled?: boolean; icon?: string; style?: ViewStyle;
}) {
  const press = useRef(new Animated.Value(0)).current;
  const map = {
    primary: { top: ["#a855f7", "#7c3aed"] as [string, string], bottom: "#5b21b6", fg: "#fff", glowC: C.primary },
    green:   { top: ["#22d3a5", "#059669"] as [string, string], bottom: "#065f46", fg: "#fff", glowC: C.green },
    red:     { top: ["#f43f5e", "#be123c"] as [string, string], bottom: "#9f1239", fg: "#fff", glowC: C.red },
    white:   { top: ["#2a1f48", "#1e1535"] as [string, string], bottom: "#0f0a1e", fg: C.primary, glowC: "transparent" },
  }[color];

  const depth = 4;
  const translateY = press.interpolate({ inputRange: [0, 1], outputRange: [0, depth] });

  return (
    <Animated.View style={[{ marginVertical: SPACING.sm }, style]}>
      <View style={[s.btnShadow, { backgroundColor: map.bottom, borderRadius: RADIUS.md }]} />
      <Animated.View style={{ transform: [{ translateY }] }}>
        <Pressable
          onPressIn={() => Animated.timing(press, { toValue: 1, duration: 60, useNativeDriver: true }).start()}
          onPressOut={() => Animated.timing(press, { toValue: 0, duration: 80, useNativeDriver: true }).start()}
          onPress={onPress}
          disabled={disabled || loading}
          style={[s.btnWrap, (disabled || loading) && { opacity: 0.45 }]}
        >
          <LinearGradient colors={map.top} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btn}>
            {loading
              ? <ActivityIndicator color={map.fg} />
              : <Text style={[s.btnText, { color: map.fg }]}>{icon ? `${icon}  ` : ""}{label}</Text>}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Big glowing log-meal CTA button ────────────────────────
export function LogButton({
  label, onPress, loading,
}: { label: string; onPress: () => void; loading?: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const glow1 = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (loading) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1.03, duration: 900, useNativeDriver: true }),
          Animated.timing(glow1, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(glow1, { toValue: 0.6, duration: 900, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [loading]);

  return (
    <Animated.View style={{ transform: [{ scale: pulse }], marginVertical: SPACING.md }}>
      <Animated.View style={[s.logGlow, { opacity: glow1 }]} />
      <Pressable onPress={onPress} disabled={loading}>
        <LinearGradient
          colors={["#c084fc", "#a855f7", "#7c3aed"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.logBtn}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="large" />
            : <>
                <Text style={s.logIcon}>📸</Text>
                <Text style={s.logText}>{label}</Text>
              </>
          }
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ─── Option card (onboarding answers) ───────────────────────
export function OptionCard({
  label, emoji, selected, onPress,
}: { label: string; emoji?: string; selected?: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const anim = (to: number) => Animated.spring(scale, { toValue: to, useNativeDriver: true, tension: 200, friction: 8 }).start();
  return (
    <Pressable
      onPressIn={() => anim(0.97)} onPressOut={() => anim(1)}
      onPress={onPress}
    >
      <Animated.View style={[
        s.option,
        selected && { borderColor: C.primary, backgroundColor: C.primarySoft },
        { transform: [{ scale }] },
      ]}>
        {emoji ? <Text style={s.optionEmoji}>{emoji}</Text> : null}
        <Text style={[s.optionText, selected && { color: C.primary }]}>{label}</Text>
        <View style={[s.radio, selected && { borderColor: C.primary, backgroundColor: C.primary }]}>
          {selected && <Text style={s.radioCheck}>✓</Text>}
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ─── Speech bubble ───────────────────────────────────────────
export function SpeechBubble({ children, pose = "flex" }: { children: React.ReactNode; pose?: any }) {
  return (
    <View style={s.speechRow}>
      <Mascot pose={pose} size={96} />
      <View style={s.bubble}>
        <View style={s.bubbleTail} />
        <Text style={s.bubbleText}>{children}</Text>
      </View>
    </View>
  );
}

// ─── Progress top bar (onboarding) ───────────────────────────
export function TopBar({ progress, onBack, hearts }: { progress: number; onBack?: () => void; hearts?: number }) {
  const fillWidth = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fillWidth, { toValue: progress, duration: 400, useNativeDriver: false }).start();
  }, [progress]);
  const widthPct = fillWidth.interpolate({ inputRange: [0, 1], outputRange: ["4%", "100%"] });
  return (
    <View style={s.topbar}>
      {onBack
        ? <Pressable onPress={onBack} hitSlop={12}><Text style={s.close}>✕</Text></Pressable>
        : <View style={{ width: 22 }} />}
      <View style={s.topTrack}>
        <Animated.View style={[s.topFill, { width: widthPct }]} />
      </View>
      {hearts != null ? <Text style={s.hearts}>❤️ {hearts}</Text> : <View style={{ width: 22 }} />}
    </View>
  );
}

// ─── Animated circular ring (SVG) ────────────────────────────
export function Ring({
  size = 200, stroke = 20, progress, color, value, label, sub,
}: { size?: number; stroke?: number; progress: number; color: string; value?: string; label?: string; sub?: string }) {
  const [disp, setDisp] = useState(0);

  useEffect(() => {
    let frame = 0;
    const target = Math.max(0, Math.min(progress, 1));
    const steps = 50;
    const id = setInterval(() => {
      frame++;
      setDisp(target * (frame / steps));
      if (frame >= steps) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [progress]);

  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - disp);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="1" />
            <Stop offset="100%" stopColor={`${color}88`} stopOpacity="1" />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke + 10} fill="none" opacity={0.07} />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="url(#ringGrad)" strokeWidth={stroke} fill="none"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={s.ringCenter}>
        {value != null && <Text style={s.ringValue}>{value}</Text>}
        {label != null && <Text style={s.ringLabel}>{label}</Text>}
        {sub != null && <Text style={s.ringSub}>{sub}</Text>}
      </View>
    </View>
  );
}

// ─── Animated macro bar ──────────────────────────────────────
export function MacroBar({
  label, eaten, target, unit, color, leftWord = "left",
}: { label: string; eaten: number; target: number; unit: string; color: string; leftWord?: string }) {
  const pct = Math.min(eaten / Math.max(target, 1), 1);
  const animated = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animated, { toValue: pct, duration: 800, useNativeDriver: false }).start();
  }, [pct]);

  const widthPct = animated.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const left = Math.max(target - eaten, 0);

  return (
    <View style={{ marginBottom: SPACING.lg }}>
      <View style={s.barRow}>
        <Text style={s.barLabel}>{label}</Text>
        <Text style={s.barSub}>
          <Text style={{ color: color, fontWeight: "900" }}>{Math.round(eaten)}</Text>
          {` / ${Math.round(target)} ${unit}`}
        </Text>
      </View>
      <View style={s.track}>
        <Animated.View style={[s.fill, { width: widthPct, backgroundColor: color }]} />
      </View>
      <Text style={[s.barLeft, { color }]}>{Math.round(left)} {unit} {leftWord}</Text>
    </View>
  );
}

// ─── Stat bubble ─────────────────────────────────────────────
export function Stat({
  icon, value, label, color = C.text,
}: { icon: string; value: string; label: string; color?: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statIcon}>{icon}</Text>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  banner: {
    borderRadius: RADIUS.xl, padding: SPACING.xl,
    marginBottom: SPACING.lg, overflow: "hidden",
  },

  tag: { borderRadius: RADIUS.pill, paddingVertical: 7, paddingHorizontal: 14 },
  tagText: { fontSize: FONT.small, fontWeight: "800", letterSpacing: 0.3 },

  card: {
    backgroundColor: C.card, borderRadius: RADIUS.lg,
    padding: SPACING.xl, borderWidth: 1, borderColor: C.border,
    marginBottom: SPACING.lg, overflow: "hidden",
  },
  accent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  section: { color: C.text, fontSize: FONT.h3, fontWeight: "800", marginBottom: SPACING.lg },

  btnShadow: { position: "absolute", left: 0, right: 0, top: 4, bottom: -4 },
  btnWrap: { borderRadius: RADIUS.md, overflow: "hidden" },
  btn: { borderRadius: RADIUS.md, paddingVertical: 17, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  btnText: { fontWeight: "900", fontSize: FONT.body, letterSpacing: 1, textTransform: "uppercase" },

  logGlow: {
    position: "absolute", left: "10%", right: "10%", top: 8, height: 60,
    borderRadius: RADIUS.pill, backgroundColor: C.primary,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 24,
  },
  logBtn: {
    borderRadius: RADIUS.xl, paddingVertical: 20, paddingHorizontal: 32,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
  },
  logIcon: { fontSize: 24 },
  logText: { color: "#fff", fontWeight: "900", fontSize: 18, letterSpacing: 1.2, textTransform: "uppercase" },

  option: {
    backgroundColor: C.card, borderRadius: RADIUS.md,
    paddingVertical: 18, paddingHorizontal: 18,
    marginBottom: SPACING.md, borderWidth: 1.5, borderColor: C.border,
    flexDirection: "row", alignItems: "center",
  },
  optionEmoji: { fontSize: 26, marginRight: 14 },
  optionText: { color: C.text, fontSize: FONT.h3, fontWeight: "700", flex: 1 },
  radio: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 2,
    borderColor: C.borderStrong, alignItems: "center", justifyContent: "center",
  },
  radioCheck: { color: "#fff", fontSize: 14, fontWeight: "900" },

  speechRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: SPACING.xl },
  bubble: {
    flex: 1, marginLeft: SPACING.sm, backgroundColor: C.card,
    borderWidth: 1.5, borderColor: C.border, borderRadius: RADIUS.md,
    padding: SPACING.lg, marginTop: 10,
  },
  bubbleTail: {
    position: "absolute", left: -9, top: 18, width: 16, height: 16,
    backgroundColor: C.card, borderLeftWidth: 1.5, borderBottomWidth: 1.5,
    borderColor: C.border, transform: [{ rotate: "45deg" }],
  },
  bubbleText: { color: C.text, fontSize: FONT.body, fontWeight: "700", lineHeight: 22 },

  topbar: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: 14 },
  close: { color: C.faint, fontSize: 22, fontWeight: "800", width: 22 },
  topTrack: { flex: 1, height: 10, borderRadius: RADIUS.pill, backgroundColor: C.track, overflow: "hidden" },
  topFill: { height: 10, borderRadius: RADIUS.pill, backgroundColor: C.primary },
  hearts: { color: C.red, fontSize: FONT.small, fontWeight: "800" },

  ringCenter: { position: "absolute", alignItems: "center" },
  ringValue: { color: C.text, fontSize: 44, fontWeight: "900", letterSpacing: -2 },
  ringLabel: { color: C.sub, fontSize: FONT.small, fontWeight: "800", marginTop: 2, textTransform: "uppercase", letterSpacing: 1.5 },
  ringSub: { color: C.faint, fontSize: FONT.tiny, marginTop: 4 },

  barRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  barLabel: { color: C.text, fontWeight: "800", fontSize: FONT.body },
  barSub: { color: C.sub, fontSize: FONT.small },
  barLeft: { fontSize: FONT.tiny, fontWeight: "800", marginTop: 4, opacity: 0.8 },
  track: { height: 10, borderRadius: RADIUS.pill, backgroundColor: C.track, overflow: "hidden" },
  fill: { height: 10, borderRadius: RADIUS.pill },

  stat: { flex: 1, alignItems: "center", paddingVertical: SPACING.md },
  statIcon: { fontSize: 22, marginBottom: 6 },
  statValue: { fontSize: FONT.h3, fontWeight: "900", letterSpacing: -0.5 },
  statLabel: { color: C.faint, fontSize: FONT.tiny, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.8 },
});
