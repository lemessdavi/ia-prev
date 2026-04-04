import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { OperatorAppProvider } from "@/context/operatorAppContext";
import "../../global.css";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <OperatorAppProvider>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="chat/[conversationId]" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" options={{ headerShown: false }} />
        </Stack>
      </OperatorAppProvider>
    </SafeAreaProvider>
  );
}
