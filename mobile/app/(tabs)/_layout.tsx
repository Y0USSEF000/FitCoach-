import { Tabs } from "expo-router";
import { View, Text, StyleSheet, Animated, Platform } from "react-native";
import { useRef, useEffect } from "react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { C, RADIUS, shadow, glow } from "@/lib/theme";
import { LinearGradient } from "expo-linear-gradient";

function TabIcon({ emoji, focused, label }: { emoji: string; focused: boolean; label: string }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.1 : 1,
      useNativeDriver: true,
      tension: 260,
      friction: 9,
    }).start();
  }, [focused]);

  return (
    <View style={s.tabItem} pointerEvents="none">
      <Animated.View style={[s.tabInner, focused && s.tabActive, { transform: [{ scale }] }]}>
        {focused && (
          <LinearGradient
            colors={["#a855f7", "#7c3aed"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Text style={s.emoji}>{emoji}</Text>
      </Animated.View>
      <Text style={[s.tabLabel, focused && s.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const { lang } = useApp();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: s.bar,
        tabBarBackground: () => (
          <LinearGradient
            colors={["#1a1133", "#130f22"]}
            style={StyleSheet.absoluteFill}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t(lang, "dashboard"),
          tabBarShowLabel: false,
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} label={t(lang, "dashboard")} />,
        }}
      />
      <Tabs.Screen
        name="meals"
        options={{
          title: t(lang, "meals"),
          tabBarShowLabel: false,
          tabBarIcon: ({ focused }) => <TabIcon emoji="🥗" focused={focused} label={t(lang, "meals")} />,
        }}
      />
      <Tabs.Screen
        name="program"
        options={{
          title: t(lang, "program"),
          tabBarShowLabel: false,
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} label={t(lang, "program")} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t(lang, "settings"),
          tabBarShowLabel: false,
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} label={t(lang, "settings")} />,
        }}
      />
    </Tabs>
  );
}

const BAR_HEIGHT = Platform.OS === "ios" ? 90 : 68;

const s = StyleSheet.create({
  bar: {
    height: BAR_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: "transparent",
    elevation: 24,
    ...shadow(3),
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 4,
  },
  tabInner: {
    width: 46,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    opacity: 0.4,
  },
  tabActive: {
    opacity: 1,
  },
  emoji: { fontSize: 22 },
  tabLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: C.faint,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: C.primary,
  },
});
