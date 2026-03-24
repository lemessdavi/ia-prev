import { ConvexProvider } from "convex/react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Text, View } from "react-native";
import { getConvexClient, convexUrl } from "../lib/convex-client";
import { AppSessionProvider } from "../lib/session";
import "../../global.css";

export default function RootLayout() {
  if (!convexUrl) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: "600" }}>Convex URL não configurada</Text>
          <Text style={{ marginTop: 8, textAlign: "center", color: "#52525b" }}>
            Defina EXPO_PUBLIC_CONVEX_URL para conectar o app ao backend Convex.
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <ConvexProvider client={getConvexClient()}>
      <AppSessionProvider>
        <SafeAreaProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" options={{ headerShown: false }} />
          </Stack>
        </SafeAreaProvider>
      </AppSessionProvider>
    </ConvexProvider>
  );
}
