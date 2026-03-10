import { SafeAreaView } from 'react-native-safe-area-context'
import { Text, View, TextInput, ScrollView } from 'react-native'
import { messages } from 'utils'
import { tokens } from 'config'

export default function ChatScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.bg }}>
      <View style={{ borderBottomWidth: 1, borderColor: tokens.colors.border, padding: 16, backgroundColor: tokens.colors.panel }}>
        <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '600' }}>Carlos Mendes</Text>
        <Text style={{ color: tokens.colors.textMuted }}>Fluxo: Auxílio-Acidente</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {messages.map((message) => (
          <View key={message.id} style={{ alignSelf: message.from === 'client' ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
            <View style={{ backgroundColor: tokens.colors.panel, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 16, padding: 12 }}>
              <Text style={{ fontSize: 16 }}>{message.text}</Text>
            </View>
            <Text style={{ marginTop: 4, color: tokens.colors.textMuted, textAlign: 'right' }}>{message.time}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={{ borderTopWidth: 1, borderColor: tokens.colors.border, padding: 12, backgroundColor: tokens.colors.panel }}>
        <TextInput accessibilityLabel="Digite uma mensagem" placeholder="Digite uma mensagem..." style={{ borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12, padding: 12, fontSize: 16 }} />
      </View>
    </SafeAreaView>
  )
}
