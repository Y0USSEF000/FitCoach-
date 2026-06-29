import { useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Screen, DuoButton, TopBar } from "@/lib/ui";
import { C, SPACING, FONT, RADIUS } from "@/lib/theme";

export default function Scan() {
  const router = useRouter();
  const { lang } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [looking, setLooking] = useState(false);
  const lock = useRef(false);

  const onScan = async ({ data }: { data: string }) => {
    if (lock.current) return;
    lock.current = true;
    setLooking(true);
    try {
      const item = await api.barcodeFood(data);
      if (!item) {
        setTimeout(() => { lock.current = false; setLooking(false); }, 1200);
        return; // keep scanning; not found
      }
      router.replace({ pathname: "/confirm-meal", params: {
        food: item.brand ? `${item.name} (${item.brand})` : item.name,
        basis: "100", calories: String(item.calories), protein: String(item.protein),
        carbs: String(item.carbs), fat: String(item.fat),
      }});
    } catch {
      setTimeout(() => { lock.current = false; setLooking(false); }, 1200);
    }
  };

  if (!permission) return <Screen><View style={s.center}><ActivityIndicator color={C.primary} /></View></Screen>;

  if (!permission.granted) {
    return (
      <Screen edges={["top"]}>
        <TopBar progress={0.5} onBack={() => router.back()} />
        <View style={s.center}>
          <Text style={s.permTitle}>📷 {t(lang, "scan_barcode")}</Text>
          <Text style={s.permText}>{t(lang, "camera_perm")}</Text>
          <DuoButton label={t(lang, "allow_camera")} onPress={requestPermission} style={{ alignSelf: "stretch", marginTop: SPACING.lg }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={["top"]}>
      <TopBar progress={0.5} onBack={() => router.back()} />
      <View style={s.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39"] }}
          onBarcodeScanned={onScan}
        />
        <View style={s.frame} pointerEvents="none" />
        <View style={s.hint} pointerEvents="none">
          <Text style={s.hintText}>{looking ? t(lang, "looking_up") : t(lang, "point_barcode")}</Text>
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: SPACING.xl, gap: 6 },
  permTitle: { color: C.text, fontSize: FONT.h2, fontWeight: "900" },
  permText: { color: C.sub, fontSize: FONT.body, fontWeight: "600", textAlign: "center", marginTop: SPACING.sm },
  cameraWrap: { flex: 1, margin: SPACING.lg, borderRadius: RADIUS.xl, overflow: "hidden", backgroundColor: "#000" },
  frame: {
    position: "absolute", top: "30%", left: "12%", right: "12%", height: "30%",
    borderWidth: 3, borderColor: C.primary, borderRadius: RADIUS.lg,
  },
  hint: { position: "absolute", bottom: 30, left: 0, right: 0, alignItems: "center" },
  hintText: { color: "#fff", fontSize: FONT.body, fontWeight: "800", backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.pill },
});
