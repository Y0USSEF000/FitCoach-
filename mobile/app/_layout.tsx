import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "@/lib/store";
import { C } from "@/lib/theme";

// Silence a benign expo-router dev-only message that fires during startup
// redirects ("The action 'GO_BACK' was not handled"). It never affects the
// app and never appears in production.
const _origError = console.error;
console.error = (...args: any[]) => {
  if (typeof args[0] === "string" && args[0].includes("GO_BACK")) return;
  _origError(...args);
};

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
