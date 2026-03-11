import { SafeAreaView } from 'react-native-safe-area-context'
import { FlatList, Text, View } from 'react-native'
import { conversations, tenant } from 'utils'
import { tokens } from 'config'

export default function ConversationsScreen() {
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
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: tokens.colors.panel, borderTopWidth: 1, borderColor: tokens.colors.border, padding: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '500' }}>{item.name}</Text>
              <Text style={{ color: tokens.colors.textMuted, marginTop: 4 }}>{item.preview}</Text>
              <Text style={{ marginTop: 8 }}>{item.status}</Text>
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
