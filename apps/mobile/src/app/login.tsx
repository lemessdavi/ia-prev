import { useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { tokens } from "config";
import { Button } from "ui";
import { useOperatorApp } from "@/context/operatorAppContext";

export default function LoginScreen() {
  const { isAuthenticated, login, loadingAuth, clearError } = useOperatorApp();
  const [username, setUsername] = useState("ana.lima");
  const [password, setPassword] = useState("Ana@123456");

  if (isAuthenticated) {
    return <Redirect href="/" />;
  }

  return (
    <SafeAreaView style={{ flex: 1, justifyContent: "center", padding: 20, backgroundColor: tokens.colors.bg }}>
      <View
        style={{
          borderWidth: 1,
          borderColor: tokens.colors.border,
          borderRadius: 16,
          backgroundColor: tokens.colors.panel,
          padding: 16,
          gap: 12,
        }}
      >
        <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "600" }}>
          IA Prev Operador
        </Text>
        <Text style={{ color: tokens.colors.textMuted }}>
          Login tenant-aware. Ajuste `EXPO_PUBLIC_CONVEX_URL` para apontar para seu backend Convex.
        </Text>
        <View>
          <Text style={{ marginBottom: 6 }}>Usuario</Text>
          <TextInput
            accessibilityLabel="Usuario"
            autoCapitalize="none"
            style={{
              borderWidth: 1,
              borderColor: tokens.colors.border,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
            value={username}
            onChangeText={(value) => {
              clearError();
              setUsername(value);
            }}
          />
        </View>
        <View>
          <Text style={{ marginBottom: 6 }}>Senha</Text>
          <TextInput
            accessibilityLabel="Senha"
            secureTextEntry
            style={{
              borderWidth: 1,
              borderColor: tokens.colors.border,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
            value={password}
            onChangeText={(value) => {
              clearError();
              setPassword(value);
            }}
          />
        </View>
        <Button title="Entrar" onPress={() => void login(username, password)} disabled={loadingAuth} />
        {loadingAuth ? <ActivityIndicator color={tokens.colors.primary} /> : null}
      </View>
    </SafeAreaView>
  );
}
