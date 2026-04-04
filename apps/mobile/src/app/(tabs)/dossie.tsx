import { useState } from "react";
import { Linking, Pressable, Share, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { tokens } from "config";
import { AuthGate } from "@/components/AuthGate";
import { useOperatorApp } from "@/context/operatorAppContext";

export default function DossieScreen() {
  const { dossier, thread, selectedConversationId, loadingDossier, loadingAction, exportDossier, closeConversation, errorMessage } =
    useOperatorApp();
  const [reason, setReason] = useState("");

  async function handleExport() {
    const payload = await exportDossier();
    if (!payload) return;

    await Share.share({
      title: `Dossie ${payload.conversationId}`,
      message: JSON.stringify(payload, null, 2),
    });
  }

  async function handleCloseConversation() {
    const normalized = reason.trim();
    if (!normalized) return;
    await closeConversation(normalized);
    setReason("");
  }

  return (
    <AuthGate>
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.bg }}>
        <View style={{ padding: 16 }}>
          <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "600" }}>
            Dossie do Caso
          </Text>
          <Text style={{ marginTop: 4, color: tokens.colors.textMuted }}>
            Status: {thread ? toStatusLabel(thread.conversationStatus) : "N/A"}
          </Text>

          <View
            style={{
              marginTop: 16,
              borderWidth: 1,
              borderColor: tokens.colors.border,
              borderRadius: 16,
              padding: 16,
              backgroundColor: tokens.colors.panel,
            }}
          >
            <Text style={{ color: tokens.colors.textMuted }}>Dados do cliente</Text>
            {loadingDossier ? (
              <Text style={{ marginTop: 8, color: tokens.colors.textMuted }}>Carregando dossie...</Text>
            ) : dossier ? (
              <>
                <Text style={{ fontSize: 20, fontWeight: "500", marginTop: 10 }}>{dossier.contactId}</Text>
                <Text style={{ marginTop: 6 }}>{dossier.dossier.role}</Text>
                <Text style={{ marginTop: 6 }}>{dossier.dossier.location}</Text>
                <Text style={{ marginTop: 12 }}>{dossier.dossier.summary}</Text>
                <Text style={{ marginTop: 12, color: tokens.colors.successText }}>
                  Gerado em {new Date(dossier.generatedAtIso).toLocaleString("pt-BR")}
                </Text>
              </>
            ) : (
              <Text style={{ marginTop: 8, color: tokens.colors.textMuted }}>Selecione uma conversa para carregar o dossie.</Text>
            )}
          </View>

          <View
            style={{
              marginTop: 16,
              borderWidth: 1,
              borderColor: tokens.colors.border,
              borderRadius: 16,
              padding: 16,
              backgroundColor: tokens.colors.panel,
            }}
          >
            <Text style={{ color: tokens.colors.textMuted }}>Anexos</Text>
            {dossier?.attachments.length ? (
              dossier.attachments.map((attachment) => (
                <Pressable key={attachment.id} onPress={() => void Linking.openURL(attachment.url)} style={{ marginTop: 8 }}>
                  <Text style={{ color: tokens.colors.primary, textDecorationLine: "underline" }}>
                    {toAttachmentLabel(attachment.fileName, attachment.contentType)}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={{ marginTop: 8, color: tokens.colors.textMuted }}>Nenhum anexo nesta conversa.</Text>
            )}
          </View>

          <Pressable
            onPress={() => void handleExport()}
            disabled={!selectedConversationId || loadingAction}
            style={{
              marginTop: 16,
              backgroundColor: tokens.colors.primary,
              borderRadius: 12,
              paddingVertical: 12,
              opacity: !selectedConversationId || loadingAction ? 0.6 : 1,
            }}
          >
            <Text style={{ textAlign: "center", color: "#fff", fontWeight: "600" }}>Exportar dossie</Text>
          </Pressable>

          <View
            style={{
              marginTop: 16,
              borderWidth: 1,
              borderColor: tokens.colors.border,
              borderRadius: 16,
              padding: 16,
              backgroundColor: tokens.colors.panel,
            }}
          >
            <Text style={{ color: tokens.colors.textMuted }}>Encerrar caso com motivo</Text>
            <TextInput
              accessibilityLabel="Motivo de encerramento"
              multiline
              value={reason}
              onChangeText={setReason}
              placeholder="Ex: documentacao validada e caso concluido"
              style={{
                marginTop: 8,
                borderWidth: 1,
                borderColor: tokens.colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                minHeight: 80,
                textAlignVertical: "top",
              }}
            />
            <Pressable
              onPress={() => void handleCloseConversation()}
              disabled={!selectedConversationId || loadingAction || !reason.trim()}
              style={{
                marginTop: 10,
                borderWidth: 1,
                borderColor: tokens.colors.border,
                borderRadius: 10,
                paddingVertical: 10,
                opacity: !selectedConversationId || loadingAction || !reason.trim() ? 0.6 : 1,
              }}
            >
              <Text style={{ textAlign: "center" }}>Encerrar caso</Text>
            </Pressable>
          </View>

          {errorMessage ? <Text style={{ marginTop: 12, color: "#b91c1c" }}>{errorMessage}</Text> : null}
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

function toStatusLabel(status: string): string {
  switch (status) {
    case "EM_TRIAGEM":
      return "Em triagem";
    case "PENDENTE_HUMANO":
      return "Pendente humano";
    case "EM_ATENDIMENTO_HUMANO":
      return "Em atendimento humano";
    case "FECHADO":
      return "Finalizado";
    default:
      return status;
  }
}
