import { useState, useRef } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { api } from "@/lib/api";
import { DuoButton, Card } from "@/lib/ui";
import { C, RADIUS, SPACING, FONT } from "@/lib/theme";

export default function ScanBarcode() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const locked = useRef(false);

  const onScan = async ({ data }: { data: string }) => {
    if (locked.current || busy) return;
    // Product barcodes are digits only. QR codes / links won't be found.
    const code = (data || "").replace(/\D/g, "");
    if (code.length < 8) {
      locked.current = true;
      setError("That's not a product barcode. Point at the striped barcode (with numbers under it), or use Search by name.");
      return;
    }
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const out = await api.scanBarcode(code);
      setResult(out.result);
    } catch (err: any) {
      const d = err?.body?.error || err?.message || "";
      setError(d.includes("product_not_found")
        ? "Product not found in the database. Try Search by name instead."
        : d.includes("no_profile") ? "Please complete your profile first."
        : "Couldn't reach the server. Check your Wi-Fi and that the backend is running.");
    } finally { setBusy(false); }
  };

  const scanAgain = () => { setResult(null); setError(""); locked.current = false; };

  if (!permission) return <View style={s.fill} />;
  if (!permission.granted) return (
    <View style={[s.fill, s.center]}>
      <Text style={s.permTitle}>📷 Camera access</Text>
      <Text style={s.permSub}>FitWolf needs the camera to scan product barcodes.</Text>
      <DuoButton label="Allow camera" icon="📷" onPress={requestPermission} style={{ width: 240 }} />
      <Pressable onPress={() => router.back()}><Text style={s.cancel}>Cancel</Text></Pressable>
    </View>
  );

  return (
    <View style={s.fill}>
      {!result && (
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
          onBarcodeScanned={onScan}
        />
      )}

      {/* Top bar */}
      <View style={s.top}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Text style={s.close}>✕</Text></Pressable>
        <Text style={s.topTitle}>Scan barcode</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Scan frame / status */}
      {!result && (
        <View style={s.center}>
          <View style={s.frame} />
          <Text style={s.hint}>{busy ? "Looking up product…" : "Point at the product barcode (striped lines)"}</Text>
          {error ? <Text style={s.err}>{error}</Text> : null}
          {error ? (
            <DuoButton label="Scan again" icon="↻" onPress={scanAgain} style={{ width: 220 }} />
          ) : null}
        </View>
      )}

      {/* Result */}
      {result && (
        <View style={[s.center, { paddingHorizontal: SPACING.lg }]}>
          <Card style={{ width: "100%" }}>
            <Text style={s.rFood}>📦  {result.food_name}</Text>
            <Text style={s.rGrams}>~{result.estimated_grams}g</Text>
            <Text style={s.rCal}>🔥 {Math.round(result.calories)} kcal</Text>
            <Text style={s.rMacros}>🥩 {result.protein}g   🍚 {result.carbs}g   🥑 {result.fat}g</Text>
            <Text style={s.added}>✓ Added to today</Text>
            <DuoButton label="Done" icon="✓" color="green" onPress={() => router.back()} />
            <DuoButton label="Scan another" icon="↻" color="white" onPress={scanAgain} />
          </Card>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  top: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 5,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: 52, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md,
  },
  close: { color: "#fff", fontSize: 24, fontWeight: "900" },
  topTitle: { color: "#fff", fontSize: FONT.h3, fontWeight: "800" },
  frame: { width: 260, height: 160, borderWidth: 3, borderColor: C.primary, borderRadius: RADIUS.lg, backgroundColor: "rgba(168,85,247,0.08)" },
  hint: { color: "#fff", fontSize: FONT.body, fontWeight: "700", marginTop: SPACING.lg },
  err: { color: "#fca5a5", fontSize: FONT.body, fontWeight: "700", marginTop: SPACING.md, textAlign: "center", paddingHorizontal: SPACING.lg },
  permTitle: { color: C.text, fontSize: FONT.h2, fontWeight: "900" },
  permSub: { color: C.sub, fontSize: FONT.body, fontWeight: "600", textAlign: "center", marginTop: SPACING.sm, marginBottom: SPACING.lg, paddingHorizontal: SPACING.xl },
  cancel: { color: C.sub, fontSize: FONT.body, fontWeight: "700", marginTop: SPACING.md },
  rFood: { color: C.text, fontSize: FONT.h3, fontWeight: "900" },
  rGrams: { color: C.sub, fontSize: FONT.small, fontWeight: "700", marginTop: 2 },
  rCal: { color: C.primary, fontSize: FONT.h2, fontWeight: "900", marginTop: SPACING.sm },
  rMacros: { color: C.text, fontSize: FONT.body, fontWeight: "700", marginTop: 4 },
  added: { color: C.green, fontSize: FONT.body, fontWeight: "800", marginTop: SPACING.md, textAlign: "center" },
});
