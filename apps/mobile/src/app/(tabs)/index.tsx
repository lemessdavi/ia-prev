import { SafeAreaView } from 'react-native-safe-area-context'
import { FlatList, Text, View } from 'react-native'
import { api } from '@repo/convex-backend'
import { useQuery } from 'convex/react'
import { tokens } from 'config'
import { useAppSession } from '../../lib/session'

export default function ConversationsScreen() {
  const { sessionToken, loading, error } = useAppSession()
  const snapshot = useQuery(api.chat.getWorkspaceSnapshot, sessionToken ? { sessionToken } : "skip")

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

  if (!snapshot) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.bg, padding: 16 }}>
        <Text style={{ color: tokens.colors.textMuted }}>Carregando workspace…</Text>
      </SafeAreaView>
    )
  }

  const { tenant, conversations } = snapshot

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.bg }}>
      <View style={{ padding: 16 }}>
        <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: '600' }}>{tenant.tenantName}</Text>
        <Text style={{ marginTop: 4, color: tokens.colors.textMuted }}>Conversas</Text>
        <Text style={{ marginTop: 4, color: tokens.colors.textMuted }}>WhatsApp: {tenant.wabaLabel}</Text>
        <Text style={{ marginTop: 4, color: tokens.colors.textMuted }}>IA ativa: {tenant.activeAiProfileName}</Text>
      </View>
      {conversations.length > 0 ? (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.conversationId}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: tokens.colors.panel, borderTopWidth: 1, borderColor: tokens.colors.border, padding: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '500' }}>{item.title}</Text>
              <Text style={{ color: tokens.colors.textMuted, marginTop: 4 }}>{item.lastMessagePreview}</Text>
              <Text style={{ marginTop: 8 }}>Não lidas: {item.unreadCount}</Text>
            </View>
          )}
        />
      ) : (
        <View style={{ padding: 16 }}>
          <Text style={{ color: tokens.colors.textMuted }}>Nenhuma conversa disponível para este tenant.</Text>
        </View>
      )}
    </SafeAreaView>
  )
}
