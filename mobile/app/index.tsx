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
  // On cold start, only a fully set-up account goes straight to the app;
  // anything else starts at Get Started. (Login/signup route to onboarding
  // explicitly, so no one gets stuck.)
  return <Redirect href={hasProfile ? "/(tabs)" : "/welcome"} />;
}
