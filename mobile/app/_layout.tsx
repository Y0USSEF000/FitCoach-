import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "@/lib/store";
import { C } from "@/lib/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider style={{ backgroundColor: C.bg }}>
      <AppProvider>
        {/* light = white icons/text on our dark background */}
        <StatusBar style="light" backgroundColor={C.bg} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: C.bg },
            animation: "fade",
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="welcome" options={{ animation: "none" }} />
          <Stack.Screen name="auth" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="verify" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="register" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="onboarding" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="(tabs)" options={{ animation: "none" }} />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}
