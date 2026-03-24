import { api } from '@repo/convex-backend'
import { tokens } from 'config'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppSession } from '../../lib/session'

export default function ChatScreen() {
  const { sessionToken, loading, error, session } = useAppSession()
  const snapshot = useQuery(api.chat.getWorkspaceSnapshot, sessionToken ? { sessionToken } : "skip")
  const sendMessage = useMutation(api.chat.sendMessage)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.bg, padding: 16 }}>
        <Text style={{ color: tokens.colors.textMuted }}>Conectando ao Convex…</Text>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.bg, padding: 16 }}>
        <Text style={{ color: '#b91c1c' }}>{error}</Text>
      </SafeAreaView>
    )
  }

  if (!snapshot || snapshot.conversations.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.bg, padding: 16 }}>
        <Text style={{ color: tokens.colors.textMuted }}>Sem conversa disponível.</Text>
      </SafeAreaView>
    )
  }

  const selectedConversation = snapshot.conversations[0]
  const messages = snapshot.messages

  async function onSend() {
    if (!sessionToken || !selectedConversation || !draft.trim() || sending) return

    setSending(true)
    try {
      await sendMessage({
        sessionToken,
        conversationId: selectedConversation.conversationId,
        body: draft.trim(),
      })
      setDraft("")
    } finally {
      setSending(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.bg }}>
      <View style={{ borderBottomWidth: 1, borderColor: tokens.colors.border, padding: 16, backgroundColor: tokens.colors.panel }}>
        <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '600' }}>{selectedConversation.title}</Text>
        <Text style={{ color: tokens.colors.textMuted }}>Conversa: {selectedConversation.conversationId}</Text>
        <Text style={{ color: tokens.colors.textMuted }}>IA ativa: {snapshot.tenant.activeAiProfileName}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {messages.length > 0 ? (
          messages.map((message) => (
            <View
              key={message.id}
              style={{ alignSelf: message.senderId === session?.userId ? 'flex-end' : 'flex-start', maxWidth: '82%' }}
            >
              <View style={{ backgroundColor: tokens.colors.panel, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 16, padding: 12 }}>
                <Text style={{ fontSize: 16 }}>{message.body}</Text>
              </View>
              <Text style={{ marginTop: 4, color: tokens.colors.textMuted, textAlign: 'right' }}>
                {new Date(message.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ))
        ) : (
          <Text style={{ color: tokens.colors.textMuted }}>Sem mensagens para exibir.</Text>
        )}
      </ScrollView>
      <View style={{ borderTopWidth: 1, borderColor: tokens.colors.border, padding: 12, backgroundColor: tokens.colors.panel, gap: 8 }}>
        <TextInput
          accessibilityLabel="Digite uma mensagem"
          placeholder="Digite uma mensagem..."
          style={{ borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12, padding: 12, fontSize: 16 }}
          value={draft}
          onChangeText={setDraft}
        />
        <Pressable
          onPress={() => void onSend()}
          disabled={sending || draft.trim().length === 0}
          style={{
            borderRadius: 12,
            paddingVertical: 12,
            alignItems: 'center',
            backgroundColor: tokens.colors.primary,
            opacity: sending || draft.trim().length === 0 ? 0.6 : 1,
          }}
        >
          <Text style={{ color: 'white', fontWeight: '600' }}>{sending ? 'Enviando…' : 'Enviar'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
