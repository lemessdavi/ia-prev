import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { tokens } from "config";
import { resolveThreadMessageOrigin, shouldRenderMessageOnRight } from "utils";
import { AuthGate } from "@/components/AuthGate";
import { useOperatorApp } from "@/context/operatorAppContext";

export default function ChatScreen() {
  const { thread, selectedConversationId, workspace, sendMessage, takeHandoff, loadingThread, loadingAction, errorMessage } =
    useOperatorApp();
  const [draft, setDraft] = useState("");

  async function handleSend() {
    const normalized = draft.trim();
    if (!normalized) return;
    await sendMessage(normalized);
    setDraft("");
  }

  return (
    <AuthGate>
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.bg }}>
        <View style={{ borderBottomWidth: 1, borderColor: tokens.colors.border, padding: 16, backgroundColor: tokens.colors.panel }}>
          <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "600" }}>
            {thread?.title ?? "Selecione uma conversa"}
          </Text>
          <Text style={{ color: tokens.colors.textMuted }}>Operador: {workspace?.operator.fullName ?? "-"}</Text>
          <Pressable
            onPress={() => void takeHandoff()}
            disabled={!selectedConversationId || loadingAction}
            style={{
              marginTop: 10,
              alignSelf: "flex-start",
              backgroundColor: tokens.colors.primary,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 10,
              opacity: !selectedConversationId || loadingAction ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Assumir Conversa</Text>
          </Pressable>
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
                    <Text style={{ marginBottom: 4, fontSize: 11, fontWeight: "600", color: tokens.colors.textMuted }}>🤖 IA</Text>
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
            editable={Boolean(selectedConversationId) && !loadingAction}
            style={{ borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12, padding: 12, fontSize: 16 }}
          />
          <Pressable
            onPress={() => void handleSend()}
            disabled={!selectedConversationId || loadingAction || !draft.trim()}
            style={{
              marginTop: 10,
              backgroundColor: tokens.colors.primary,
              borderRadius: 10,
              paddingVertical: 10,
              opacity: !selectedConversationId || loadingAction || !draft.trim() ? 0.6 : 1,
            }}
          >
            <Text style={{ textAlign: "center", color: "#fff", fontWeight: "600" }}>Enviar</Text>
          </Pressable>
          {errorMessage ? <Text style={{ marginTop: 8, color: "#b91c1c" }}>{errorMessage}</Text> : null}
        </View>
      </SafeAreaView>
    </AuthGate>
  );
}

function toAttachmentLabel(fileName: string, contentType: string): string {
  if (contentType.includes("audio")) return `Reproduzir audio: ${fileName}`;
  if (contentType.includes("image")) return `Visualizar imagem: ${fileName}`;
  if (contentType.includes("pdf")) return `Visualizar PDF: ${fileName}`;
  return `Baixar arquivo: ${fileName}`;
}
