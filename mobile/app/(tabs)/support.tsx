import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Share } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Screen, Card, DuoButton, Entrance } from "@/lib/ui";
import { C, SPACING, FONT } from "@/lib/theme";

export default function Support() {
  const { lang } = useApp();
  const [founder, setFounder] = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => { try { const me = await api.me(); setFounder(!!me?.user?.isFounder); } catch {} })();
  }, []));

  const invite = async () => {
    try {
      await Share.share({
        message: "I'm using FitWolf — snap a photo of your food and it tracks your calories with AI. Join me!",
      });
    } catch {}
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.wrap} showsVerticalScrollIndicator={false}>
        <Entrance delay={0}>
          <View style={s.titleRow}>
            <Ionicons name="heart" size={22} color={C.primary} />
            <Text style={s.title}>{t(lang, "support")}</Text>
          </View>
        </Entrance>

        {founder && (
          <Entrance delay={60}>
            <Card style={s.founderCard} accent={C.primary}>
              <View style={s.badgeRow}>
                <Ionicons name="star" size={16} color={C.primary} />
                <Text style={s.founderBadge}>FOUNDER</Text>
              </View>
              <Text style={s.founderText}>
                FitWolf is <Text style={{ color: C.primary, fontWeight: "900" }}>free forever</Text> for you.
                Thank you for being an early member.
              </Text>
            </Card>
          </Entrance>
        )}

        <Entrance delay={120}>
          <Card>
            <View style={s.hRow}>
              <Ionicons name="gift-outline" size={20} color={C.green} />
              <Text style={s.h}>FitWolf is free right now</Text>
            </View>
            <Text style={s.p}>
              We built FitWolf to help you eat better and reach your goals — AI food tracking,
              a barcode scanner, and a personal plan. Right now it's completely free to use.
            </Text>
          </Card>
        </Entrance>

        <Entrance delay={180}>
          <Card>
            <View style={s.hRow}>
              <Ionicons name="heart-outline" size={20} color={C.primary} />
              <Text style={s.h}>A little kindness</Text>
            </View>
            <Text style={s.p}>
              Running the app (servers and AI) costs a little every month. If FitWolf helps you,
              sharing it with a friend means the world to us — it's the biggest support you can give,
              and it's free.
            </Text>
            <DuoButton label="Share FitWolf" onPress={invite} />
          </Card>
        </Entrance>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { padding: SPACING.lg, paddingBottom: 60 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: SPACING.lg, marginTop: SPACING.xs },
  title: { color: C.text, fontSize: FONT.h2, fontWeight: "900" },
  founderCard: { marginBottom: SPACING.lg },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: SPACING.sm },
  founderBadge: { color: C.primary, fontSize: FONT.small, fontWeight: "900", letterSpacing: 2 },
  founderText: { color: C.text, fontSize: FONT.body, fontWeight: "700", lineHeight: 24 },
  hRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: SPACING.sm },
  h: { color: C.text, fontSize: FONT.h3, fontWeight: "900" },
  p: { color: C.sub, fontSize: FONT.body, fontWeight: "600", lineHeight: 23, marginBottom: SPACING.md },
});
