import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, Text, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, useLocalSearchParams } from "expo-router";
import * as FileSystemLegacy from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { SafeAreaView } from "react-native-safe-area-context";
import { tokens } from "config";
import { resolveThreadMessageOrigin, shouldRenderMessageOnRight, type TriageResult } from "utils";
import { useOperatorApp } from "@/context/operatorAppContext";

const CHAT_BOTTOM_THRESHOLD_PX = 72;

const triageStatusOptions: { label: string; value: TriageResult }[] = [
  { label: "Apto", value: "APTO" },
  { label: "Revisao humana", value: "REVISAO_HUMANA" },
  { label: "Nao apto", value: "NAO_APTO" },
];

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const {
    isAuthenticated,
    thread,
    selectedConversationId,
    workspace,
    sendMessage,
    takeHandoff,
    setConversationTriageResult,
    exportConversationAttachmentArchive,
    loadingThread,
    loadingAction,
    errorMessage,
    selectConversation,
  } = useOperatorApp();
  const [draft, setDraft] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const [triageSheetOpen, setTriageSheetOpen] = useState(false);
  const [isChatPinnedToBottom, setIsChatPinnedToBottom] = useState(true);
  const chatScrollViewRef = useRef<ScrollView>(null);
  const latestContentHeightRef = useRef(0);

  const scrollChatToBottom = useCallback((animated: boolean) => {
    const scrollView = chatScrollViewRef.current;
    if (!scrollView) return;

    scrollView.scrollToEnd?.({ animated });
    scrollView.scrollTo?.({
      y: Math.max(latestContentHeightRef.current, CHAT_BOTTOM_THRESHOLD_PX),
      animated,
    });
  }, []);

  const isNearBottom = useCallback((nativeEvent: NativeScrollEvent) => {
    return nativeEvent.contentSize.height - nativeEvent.layoutMeasurement.height - nativeEvent.contentOffset.y <= CHAT_BOTTOM_THRESHOLD_PX;
  }, []);

  const handleChatScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setIsChatPinnedToBottom(isNearBottom(event.nativeEvent));
    },
    [isNearBottom],
  );

  const handleJumpToLatestMessages = useCallback(() => {
    setIsChatPinnedToBottom(true);
    scrollChatToBottom(true);
  }, [scrollChatToBottom]);

  useEffect(() => {
    if (!conversationId) return;
    if (selectedConversationId === conversationId) return;
    void selectConversation(conversationId);
  }, [conversationId, selectConversation, selectedConversationId]);

  useEffect(() => {
    setIsChatPinnedToBottom(true);
  }, [conversationId]);

  useEffect(() => {
    if (!isChatPinnedToBottom) return;
    scrollChatToBottom(false);
  }, [isChatPinnedToBottom, scrollChatToBottom, thread?.messages.length]);

  async function handleSend() {
    const normalized = draft.trim();
    if (!normalized) return;
    await sendMessage(normalized);
    setDraft("");
  }

  async function handleShareZip() {
    if (!canActOnConversation) return;
    const payload = await exportConversationAttachmentArchive();
    if (!payload) return;

    setShareError(null);
    try {
      await shareDownloadedFile(payload.zipDownloadUrl, payload.zipFileName);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Falha ao compartilhar ZIP.");
    }
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
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
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
                <Text>Compartilhar ZIP de anexos</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={chatScrollViewRef}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          onScroll={handleChatScroll}
          onContentSizeChange={(_, contentHeight) => {
            latestContentHeightRef.current = contentHeight;
            if (isChatPinnedToBottom) {
              scrollChatToBottom(false);
            }
          }}
          scrollEventThrottle={16}
        >
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
        {!isChatPinnedToBottom ? (
          <Pressable
            onPress={handleJumpToLatestMessages}
            accessibilityRole="button"
            accessibilityLabel="Voltar para o final da conversa"
            testID="chat-scroll-to-latest-button"
            style={{
              position: "absolute",
              right: 16,
              bottom: 16,
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tokens.colors.primary,
            }}
          >
            <Ionicons name="arrow-down" size={18} color="#fff" />
          </Pressable>
        ) : null}
      </View>
      <View style={{ borderTopWidth: 1, borderColor: tokens.colors.border, padding: 12, backgroundColor: tokens.colors.panel }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
          <TextInput
            accessibilityLabel="Digite uma mensagem"
            placeholder="Digite uma mensagem..."
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => void handleSend()}
            editable={canActOnConversation}
            style={{ flex: 1, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12, padding: 12, fontSize: 16 }}
          />
          <Pressable
            onPress={() => void handleSend()}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensagem"
            disabled={!canActOnConversation || !draft.trim()}
            style={{
              width: 46,
              height: 46,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tokens.colors.primary,
              borderRadius: 12,
              opacity: !canActOnConversation || !draft.trim() ? 0.6 : 1,
            }}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
        {errorMessage ? <Text style={{ marginTop: 8, color: "#b91c1c" }}>{errorMessage}</Text> : null}
        {shareError ? <Text style={{ marginTop: 8, color: "#b91c1c" }}>{shareError}</Text> : null}
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

async function shareDownloadedFile(fileUrl: string, fileName: string) {
  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!sharingAvailable) {
    throw new Error("Compartilhamento nao disponivel neste dispositivo.");
  }

  const directory = FileSystemLegacy.cacheDirectory ?? FileSystemLegacy.documentDirectory;
  if (!directory) {
    throw new Error("Diretorio temporario indisponivel para exportacao.");
  }

  const fileUri = `${directory}${fileName}`;
  const download = await FileSystemLegacy.downloadAsync(fileUrl, fileUri);

  await Sharing.shareAsync(download.uri, {
    mimeType: "application/zip",
    dialogTitle: `Exportar ${fileName}`,
  });
}
