import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import * as FileSystemLegacy from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { SafeAreaView } from "react-native-safe-area-context";
import { tokens } from "config";
import { bytesToBase64, createDossierExportFiles, resolveThreadMessageOrigin, shouldRenderMessageOnRight } from "utils";
import { useOperatorApp } from "@/context/operatorAppContext";

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
    exportDossier,
    loadingThread,
    loadingAction,
    errorMessage,
    selectConversation,
  } = useOperatorApp();
  const [draft, setDraft] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);

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

  async function handleShareZip() {
    if (!canActOnConversation) return;
    const payload = await exportDossier();
    if (!payload) return;

    setShareError(null);
    try {
      const files = createDossierExportFiles(payload);
      await shareBinaryFile(files.zipFileName, files.zipBytes, "application/zip");
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Falha ao compartilhar ZIP.");
    }
  }

  async function handleSharePdf() {
    if (!canActOnConversation) return;
    const payload = await exportDossier();
    if (!payload) return;

    setShareError(null);
    try {
      const files = createDossierExportFiles(payload);
      await shareBinaryFile(files.pdfFileName, files.pdfBytes, "application/pdf");
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Falha ao compartilhar PDF.");
    }
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  const canActOnConversation = Boolean(selectedConversationId) && !loadingAction;

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
          <View style={{ gap: 8, alignItems: "flex-end" }}>
            <Pressable
              onPress={() => void takeHandoff()}
              disabled={!canActOnConversation}
              style={{
                alignSelf: "flex-start",
                backgroundColor: tokens.colors.primary,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                opacity: canActOnConversation ? 1 : 0.6,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>Assumir Conversa</Text>
            </Pressable>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 }}>
              {[
                { label: "Marcar apto", value: "APTO" as const },
                { label: "Marcar revisao", value: "REVISAO_HUMANA" as const },
                { label: "Marcar nao apto", value: "NAO_APTO" as const },
              ].map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => void setConversationTriageResult(option.value)}
                  disabled={!canActOnConversation}
                  style={{
                    borderWidth: 1,
                    borderColor: tokens.colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    opacity: canActOnConversation ? 1 : 0.6,
                  }}
                >
                  <Text>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 }}>
              <Pressable
                onPress={() => void handleShareZip()}
                disabled={!canActOnConversation}
                style={{
                  borderWidth: 1,
                  borderColor: tokens.colors.border,
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  opacity: canActOnConversation ? 1 : 0.6,
                }}
              >
                <Text>Compartilhar ZIP</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleSharePdf()}
                disabled={!canActOnConversation}
                style={{
                  borderWidth: 1,
                  borderColor: tokens.colors.border,
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  opacity: canActOnConversation ? 1 : 0.6,
                }}
              >
                <Text>Compartilhar PDF</Text>
              </Pressable>
            </View>
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
        {shareError ? <Text style={{ marginTop: 8, color: "#b91c1c" }}>{shareError}</Text> : null}
      </View>
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

async function shareBinaryFile(fileName: string, bytes: Uint8Array, mimeType: string) {
  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!sharingAvailable) {
    throw new Error("Compartilhamento nao disponivel neste dispositivo.");
  }

  const directory = FileSystemLegacy.cacheDirectory ?? FileSystemLegacy.documentDirectory;
  if (!directory) {
    throw new Error("Diretorio temporario indisponivel para exportacao.");
  }

  const fileUri = `${directory}${fileName}`;
  await FileSystemLegacy.writeAsStringAsync(fileUri, bytesToBase64(bytes), {
    encoding: FileSystemLegacy.EncodingType.Base64,
  });

  await Sharing.shareAsync(fileUri, {
    mimeType,
    dialogTitle: `Exportar ${fileName}`,
  });
}
