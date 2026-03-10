import { SafeAreaView } from 'react-native-safe-area-context'
import { FlatList, Text, View } from 'react-native'
import { conversations } from 'utils'
import { tokens } from 'config'

export default function ConversationsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.bg }}>
      <View style={{ padding: 16 }}>
        <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: '600' }}>IA Prev</Text>
        <Text style={{ marginTop: 4, color: tokens.colors.textMuted }}>Conversas</Text>
      </View>
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
    </SafeAreaView>
  )
}
