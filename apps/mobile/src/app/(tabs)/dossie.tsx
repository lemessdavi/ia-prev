import { api } from '@repo/convex-backend'
import { tokens } from 'config'
import { useQuery } from 'convex/react'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppSession } from '../../lib/session'

export default function DossieScreen() {
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
        <Text style={{ color: tokens.colors.textMuted }}>Carregando dossiê…</Text>
      </SafeAreaView>
    )
  }

  const dossier = snapshot.dossier

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.bg }}>
      <View style={{ padding: 16 }}>
        <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: '600' }}>Dossiê do Caso</Text>
        <Text style={{ marginTop: 4, color: tokens.colors.textMuted }}>WhatsApp: {snapshot.tenant.wabaLabel}</Text>
        {!dossier ? (
          <View style={{ marginTop: 16, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 16, padding: 16, backgroundColor: tokens.colors.panel }}>
            <Text style={{ color: tokens.colors.textMuted }}>Nenhum dossiê encontrado para a conversa atual.</Text>
          </View>
        ) : (
          <>
            <View style={{ marginTop: 16, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 16, padding: 16, backgroundColor: tokens.colors.panel }}>
              <Text style={{ color: tokens.colors.textMuted }}>Dados do contato</Text>
              <Text style={{ fontSize: 20, fontWeight: '500', marginTop: 10 }}>{dossier.contactId}</Text>
              <Text style={{ marginTop: 6 }}>{dossier.role}</Text>
              <Text style={{ marginTop: 6 }}>{dossier.company}</Text>
              <Text style={{ marginTop: 6 }}>{dossier.location}</Text>
              <Text style={{ marginTop: 12, color: tokens.colors.successText }}>{dossier.summary}</Text>
            </View>
            <View style={{ marginTop: 16, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 16, padding: 16, backgroundColor: tokens.colors.panel }}>
              <Text style={{ color: tokens.colors.textMuted }}>Tags</Text>
              {dossier.tags.length > 0 ? (
                dossier.tags.map((tag) => (
                  <Text key={tag} style={{ marginTop: 8 }}>{tag}</Text>
                ))
              ) : (
                <Text style={{ marginTop: 8, color: tokens.colors.textMuted }}>Nenhuma tag cadastrada.</Text>
              )}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}
