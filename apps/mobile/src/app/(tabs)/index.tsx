import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { tokens } from "config";
import { AuthGate } from "@/components/AuthGate";
import { type InboxFilter, useOperatorApp } from "@/context/operatorAppContext";

const statusOptions: Array<{ label: string; value: InboxFilter }> = [
  { label: "Todos", value: "ALL" },
  { label: "Apto", value: "APTO" },
  { label: "Revisao", value: "REVISAO_HUMANA" },
  { label: "Nao apto", value: "NAO_APTO" },
  { label: "Finalizado", value: "FINALIZADO" },
];

export default function ConversationsScreen() {
  const {
    workspace,
    conversations,
    selectedConversationId,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    loadingConversations,
    errorMessage,
    selectConversation,
    logout,
  } = useOperatorApp();

  return (
    <AuthGate>
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.bg }}>
        <View style={{ padding: 16 }}>
          <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: "600" }}>
            {workspace?.tenantName ?? "Conversas"}
          </Text>
          <Text style={{ marginTop: 4, color: tokens.colors.textMuted }}>WhatsApp: {workspace?.wabaLabel ?? "-"}</Text>
          <Text style={{ marginTop: 4, color: tokens.colors.textMuted }}>IA ativa: {workspace?.activeAiProfileName ?? "-"}</Text>
          <Pressable onPress={() => void logout()} style={{ marginTop: 8 }}>
            <Text style={{ color: tokens.colors.primary }}>Sair</Text>
          </Pressable>

          <TextInput
            accessibilityLabel="Buscar conversa"
            placeholder="Buscar nome ou mensagem..."
            value={search}
            onChangeText={setSearch}
            style={{
              marginTop: 12,
              borderWidth: 1,
              borderColor: tokens.colors.border,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          />
          <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {statusOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setStatusFilter(option.value)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: option.value === statusFilter ? tokens.colors.primary : "#e4e4e7",
                }}
              >
                <Text style={{ color: option.value === statusFilter ? "#ffffff" : "#27272a" }}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {loadingConversations ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: tokens.colors.textMuted }}>Carregando conversas...</Text>
          </View>
        ) : conversations.length > 0 ? (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.conversationId}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => void selectConversation(item.conversationId)}
                style={{
                  backgroundColor: item.conversationId === selectedConversationId ? "#f4f4f5" : tokens.colors.panel,
                  borderTopWidth: 1,
                  borderColor: tokens.colors.border,
                  padding: 16,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 20, fontWeight: "500" }}>{item.title}</Text>
                  {item.unreadCount > 0 ? (
                    <Text style={{ backgroundColor: "#18181b", color: "#fff", borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 }}>
                      {item.unreadCount}
                    </Text>
                  ) : null}
                </View>
                <Text style={{ color: tokens.colors.textMuted, marginTop: 4 }}>{item.lastMessagePreview}</Text>
                <Text style={{ marginTop: 8 }}>{toTriageLabel(item.triageResult)}</Text>
              </Pressable>
            )}
          />
        ) : (
          <View style={{ padding: 16 }}>
            <Text style={{ color: tokens.colors.textMuted }}>Nenhuma conversa para os filtros atuais.</Text>
          </View>
        )}

        {errorMessage ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: "#b91c1c" }}>{errorMessage}</Text>
          </View>
        ) : null}
      </SafeAreaView>
    </AuthGate>
  );
}

function toTriageLabel(result: string): string {
  switch (result) {
    case "APTO":
      return "Apto";
    case "REVISAO_HUMANA":
      return "Revisao humana";
    case "NAO_APTO":
      return "Nao apto";
    case "N_A":
      return "N/A";
    default:
      return result;
  }
}
