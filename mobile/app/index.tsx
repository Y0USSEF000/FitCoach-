import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useApp } from "@/lib/store";
import { C } from "@/lib/theme";

export default function Index() {
  const { loading, authed, hasProfile } = useApp();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center" }}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }
  if (!authed) return <Redirect href="/welcome" />;
  return <Redirect href={hasProfile ? "/(tabs)" : "/onboarding"} />;
}
