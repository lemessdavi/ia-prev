import { SafeAreaView } from 'react-native-safe-area-context'
import { Text, View } from 'react-native'
import { dossier } from 'utils'
import { tokens } from 'config'

export default function DossieScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.bg }}>
      <View style={{ padding: 16 }}>
        <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: '600' }}>Dossiê do Caso</Text>
        <View style={{ marginTop: 16, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 16, padding: 16, backgroundColor: tokens.colors.panel }}>
          <Text style={{ color: tokens.colors.textMuted }}>Dados do cliente</Text>
          <Text style={{ fontSize: 20, fontWeight: '500', marginTop: 10 }}>{dossier.name}</Text>
          <Text style={{ marginTop: 6 }}>{dossier.phone}</Text>
          <Text style={{ marginTop: 6 }}>{dossier.city}</Text>
          <Text style={{ marginTop: 12, color: tokens.colors.successText }}>{dossier.consent}</Text>
        </View>
      </View>
    </SafeAreaView>
  )
}
