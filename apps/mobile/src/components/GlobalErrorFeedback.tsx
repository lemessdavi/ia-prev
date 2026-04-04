import { Modal, Pressable, Text, View } from "react-native";
import { tokens } from "config";
import { useOperatorApp } from "@/context/operatorAppContext";

export function GlobalErrorFeedback() {
  const { blockingErrorMessage, toastErrorMessage, clearError } = useOperatorApp();

  return (
    <>
      <Modal visible={Boolean(blockingErrorMessage)} transparent animationType="fade" onRequestClose={clearError}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            padding: 20,
          }}
          testID="global-error-modal"
        >
          <View
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 16,
              backgroundColor: tokens.colors.panel,
              borderWidth: 1,
              borderColor: tokens.colors.border,
              padding: 16,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "600" }}>Atencao</Text>
            <Text style={{ marginTop: 10, color: tokens.colors.text }} testID="global-error-modal-message">
              {blockingErrorMessage}
            </Text>
            <Pressable
              onPress={clearError}
              style={{
                marginTop: 16,
                borderRadius: 10,
                backgroundColor: tokens.colors.primary,
                paddingVertical: 10,
              }}
              testID="global-error-modal-close"
            >
              <Text style={{ color: "#ffffff", textAlign: "center", fontWeight: "600" }}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {toastErrorMessage ? (
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", left: 12, right: 12, bottom: 18, alignItems: "center" }}
          testID="global-error-toast"
        >
          <View
            style={{
              width: "100%",
              maxWidth: 560,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#fecaca",
              backgroundColor: "#fef2f2",
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <Text style={{ color: "#b91c1c" }}>{toastErrorMessage}</Text>
          </View>
        </View>
      ) : null}
    </>
  );
}
