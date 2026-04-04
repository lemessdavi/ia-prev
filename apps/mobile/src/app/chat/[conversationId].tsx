import { useEffect, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { tokens } from "config";
import { resolveThreadMessageOrigin, shouldRenderMessageOnRight, type TriageResult } from "utils";
import { useOperatorApp } from "@/context/operatorAppContext";

const triageStatusOptions: { label: string; value: TriageResult }[] = [
  { label: "Apto", value: "APTO" },
  { label: "Revisao humana", value: "REVISAO_HUMANA" },
  { label: "Nao apto", value: "NAO_APTO" },
];

export default function ChatScreen() {
  const router = useRouter();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const {
    isAuthenticated,
    thread,
    selectedConversationId,
    workspace,
    sendMessage,
    takeHandoff,
    setConversationTriageResult,
    loadingThread,
    loadingAction,
    errorMessage,
    selectConversation,
  } = useOperatorApp();
  const [draft, setDraft] = useState("");
  const [triageSheetOpen, setTriageSheetOpen] = useState(false);

  useEffect(() => {
    if (!conversationId) return;
    if (selectedConversationId === conversationId) return;
    void selectConversation(conversationId);
  }, [conversationId, selectConversation, selectedConversationId]);

  async function handleSend() {
    const normalized = draft.trim();
    if (!normalized) return;
    await sendMessage(normalized);
    setDraft("");
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  const canActOnConversation = Boolean(selectedConversationId) && !loadingAction;
  const currentTriageResult = thread?.triageResult ?? "N_A";

  async function handleSetTriageResult(nextResult: TriageResult) {
    await setConversationTriageResult(nextResult);
    setTriageSheetOpen(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.bg }}>
      <View style={{ borderBottomWidth: 1, borderColor: tokens.colors.border, padding: 16, backgroundColor: tokens.colors.panel }}>
        <Pressable onPress={() => router.back()} style={{ alignSelf: "flex-start" }}>
          <Text style={{ color: tokens.colors.primary }}>Voltar</Text>
        </Pressable>
        <View style={{ marginTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "600" }}>
              {thread?.title ?? "Selecione uma conversa"}
            </Text>
            <Text style={{ color: tokens.colors.textMuted }}>Operador: {workspace?.operator.fullName ?? "-"}</Text>
            <Text style={{ marginTop: 4, color: tokens.colors.textMuted }}>Triagem: {toTriageLabel(thread?.triageResult ?? "N_A")}</Text>
          </View>
          <View style={{ width: 170, gap: 8, alignItems: "flex-end" }}>
            <Pressable
              onPress={() => void takeHandoff()}
              disabled={!canActOnConversation}
              style={{
                alignSelf: "flex-end",
                backgroundColor: tokens.colors.primary,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                opacity: canActOnConversation ? 1 : 0.6,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>Assumir Conversa</Text>
            </Pressable>
            <View style={{ width: "100%", gap: 6 }}>
              <Pressable
                onPress={() => setTriageSheetOpen(true)}
                disabled={!canActOnConversation}
                style={{
                  borderWidth: 1,
                  borderColor: tokens.colors.border,
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  backgroundColor: tokens.colors.panel,
                  opacity: canActOnConversation ? 1 : 0.6,
                }}
              >
                <Text style={{ fontSize: 12, color: tokens.colors.textMuted }}>Triagem manual</Text>
                <Text style={{ marginTop: 2 }}>{toTriageLabel(currentTriageResult)}</Text>
              </Pressable>
            </View>
            <View style={{ height: 2 }} />
          </View>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {loadingThread ? (
          <Text style={{ color: tokens.colors.textMuted }}>Carregando mensagens...</Text>
        ) : thread?.messages.length ? (
          thread.messages.map((message) => {
            const operatorUserId = workspace?.operator.userId ?? "";
            const messageOrigin = resolveThreadMessageOrigin(message.senderId, operatorUserId);
            const isOwn = shouldRenderMessageOnRight(message.senderId, operatorUserId);
            const isAssistant = messageOrigin === "assistant";
            return (
              <View key={message.id} style={{ alignSelf: isOwn ? "flex-end" : "flex-start", maxWidth: "82%" }}>
                {isAssistant ? (
                  <Text style={{ marginBottom: 4, fontSize: 11, fontWeight: "600", color: tokens.colors.textMuted }}>IA</Text>
                ) : null}
                <View
                  style={{
                    backgroundColor: tokens.colors.panel,
                    borderWidth: 1,
                    borderColor: tokens.colors.border,
                    borderRadius: 16,
                    padding: 12,
                  }}
                >
                  <Text style={{ fontSize: 16 }}>{message.body}</Text>
                  {message.attachment ? (
                    <Pressable onPress={() => void Linking.openURL(message.attachment!.url)} style={{ marginTop: 8 }}>
                      <Text style={{ color: tokens.colors.primary, textDecorationLine: "underline" }}>
                        {toAttachmentLabel(message.attachment.fileName, message.attachment.contentType)}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={{ marginTop: 4, color: tokens.colors.textMuted, textAlign: "right" }}>
                  {new Date(message.createdAt).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={{ color: tokens.colors.textMuted }}>Sem mensagens para exibir.</Text>
        )}
      </ScrollView>
      <View style={{ borderTopWidth: 1, borderColor: tokens.colors.border, padding: 12, backgroundColor: tokens.colors.panel }}>
        <TextInput
          accessibilityLabel="Digite uma mensagem"
          placeholder="Digite uma mensagem..."
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => void handleSend()}
          editable={canActOnConversation}
          style={{ borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12, padding: 12, fontSize: 16 }}
        />
        <Pressable
          onPress={() => void handleSend()}
          disabled={!canActOnConversation || !draft.trim()}
          style={{
            marginTop: 10,
            backgroundColor: tokens.colors.primary,
            borderRadius: 10,
            paddingVertical: 10,
            opacity: !canActOnConversation || !draft.trim() ? 0.6 : 1,
          }}
        >
          <Text style={{ textAlign: "center", color: "#fff", fontWeight: "600" }}>Enviar</Text>
        </Pressable>
        {errorMessage ? <Text style={{ marginTop: 8, color: "#b91c1c" }}>{errorMessage}</Text> : null}
      </View>
      <Modal visible={triageSheetOpen} transparent animationType="slide" onRequestClose={() => setTriageSheetOpen(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.35)",
            }}
            onPress={() => setTriageSheetOpen(false)}
          />
          <View
            style={{
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              borderWidth: 1,
              borderColor: tokens.colors.border,
              backgroundColor: "#ffffff",
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 24,
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600" }}>Selecionar status da triagem</Text>
            <View>
              <Text style={{ fontSize: 12, color: tokens.colors.textMuted }}>Status atual</Text>
              <Text style={{ marginTop: 4 }}>{toTriageLabel(currentTriageResult)}</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {triageStatusOptions.map((option) => {
                const isSelected = option.value === currentTriageResult;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => void handleSetTriageResult(option.value)}
                    disabled={!canActOnConversation}
                    style={{
                      minWidth: 104,
                      paddingHorizontal: 10,
                      paddingVertical: 9,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: isSelected ? tokens.colors.primary : tokens.colors.border,
                      backgroundColor: isSelected ? tokens.colors.primary : "#e4e4e7",
                      opacity: canActOnConversation ? 1 : 0.6,
                    }}
                  >
                    <Text style={{ color: isSelected ? "#ffffff" : "#27272a", fontWeight: isSelected ? "600" : "500" }}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => void handleSetTriageResult("N_A")}
              disabled={!canActOnConversation}
              style={{
                borderWidth: 1,
                borderColor: currentTriageResult === "N_A" ? tokens.colors.primary : tokens.colors.border,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                backgroundColor: currentTriageResult === "N_A" ? "#f4f4f5" : tokens.colors.panel,
                opacity: canActOnConversation ? 1 : 0.6,
              }}
            >
              <Text style={{ fontWeight: "500" }}>Nenhum (N/A)</Text>
            </Pressable>
            <Pressable
              onPress={() => setTriageSheetOpen(false)}
              style={{
                borderWidth: 1,
                borderColor: tokens.colors.border,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                backgroundColor: tokens.colors.panel,
              }}
            >
              <Text style={{ textAlign: "center", color: tokens.colors.textMuted }}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function toAttachmentLabel(fileName: string, contentType: string): string {
  if (contentType.includes("audio")) return `Reproduzir audio: ${fileName}`;
  if (contentType.includes("image")) return `Visualizar imagem: ${fileName}`;
  if (contentType.includes("pdf")) return `Visualizar PDF: ${fileName}`;
  return `Baixar arquivo: ${fileName}`;
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
