import { useMemo, useState } from "react";
import { Linking, Pressable, Share, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { tokens } from "config";
import { closureReasonCatalog, type ClosureReasonCode } from "utils";
import { AuthGate } from "@/components/AuthGate";
import { useOperatorApp } from "@/context/operatorAppContext";

const defaultClosureReasonCode: ClosureReasonCode = "SEM_ELEGIBILIDADE";

export default function DossieScreen() {
  const { dossier, thread, selectedConversationId, loadingDossier, loadingAction, exportDossier, closeConversation, errorMessage } =
    useOperatorApp();
  const [reasonCode, setReasonCode] = useState<ClosureReasonCode>(defaultClosureReasonCode);
  const [reasonDetail, setReasonDetail] = useState("");
  const selectedReason = useMemo(
    () => closureReasonCatalog.find((option) => option.code === reasonCode) ?? closureReasonCatalog[0],
    [reasonCode],
  );
  const reasonDetailRequired = selectedReason?.requiresDetail ?? false;
  const normalizedReasonDetail = reasonDetail.trim();
  const canCloseConversation =
    Boolean(selectedConversationId) && !loadingAction && (!reasonDetailRequired || normalizedReasonDetail.length > 0);

  async function handleExport() {
    const payload = await exportDossier();
    if (!payload) return;

    await Share.share({
      title: `Dossie ${payload.conversationId}`,
      message: JSON.stringify(payload, null, 2),
    });
  }

  async function handleCloseConversation() {
    if (!selectedReason) return;
    if (reasonDetailRequired && !normalizedReasonDetail) return;
    await closeConversation(selectedReason.code, normalizedReasonDetail || undefined);
    setReasonCode(defaultClosureReasonCode);
    setReasonDetail("");
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
            <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap" }}>
              {closureReasonCatalog.map((option) => {
                const isSelected = option.code === reasonCode;
                return (
                  <Pressable
                    key={option.code}
                    onPress={() => {
                      setReasonCode(option.code);
                      if (!option.requiresDetail) {
                        setReasonDetail("");
                      }
                    }}
                    style={{
                      marginRight: 8,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: isSelected ? tokens.colors.primary : tokens.colors.border,
                      backgroundColor: isSelected ? "#dbeafe" : "#ffffff",
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                    }}
                  >
                    <Text style={{ color: isSelected ? tokens.colors.primary : tokens.colors.textMuted }}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {selectedReason?.requiresDetail ? (
              <>
                <Text style={{ marginTop: 4, color: tokens.colors.textMuted }}>
                  {selectedReason.detailLabel ?? "Complemento do motivo"}
                </Text>
                <TextInput
                  accessibilityLabel="Complemento do motivo de encerramento"
                  multiline
                  value={reasonDetail}
                  onChangeText={setReasonDetail}
                  placeholder={selectedReason.detailPlaceholder ?? "Descreva o motivo complementar"}
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
              </>
            ) : null}
            <Pressable
              onPress={() => void handleCloseConversation()}
              disabled={!canCloseConversation}
              style={{
                marginTop: 10,
                borderWidth: 1,
                borderColor: tokens.colors.border,
                borderRadius: 10,
                paddingVertical: 10,
                opacity: canCloseConversation ? 1 : 0.6,
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
      return "Fechado";
    default:
      return status;
  }
}
