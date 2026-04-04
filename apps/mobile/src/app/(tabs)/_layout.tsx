import { Ionicons } from '@expo/vector-icons'
import { Redirect, Tabs } from 'expo-router'
import { tokens } from 'config'
import { useOperatorApp } from '@/context/operatorAppContext'

export default function TabsLayout() {
  const { isAuthenticated } = useOperatorApp()

  if (!isAuthenticated) {
    return <Redirect href="/login" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.colors.primary,
        tabBarInactiveTintColor: tokens.colors.textMuted,
        tabBarStyle: { borderTopColor: tokens.colors.border }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Conversas',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbox-ellipses-outline" size={size} color={color} />
        }}
      />
      {/* TODO(lemes): decidir o produto/fluxo de Dossie antes de voltar com essa navegacao. */}
    </Tabs>
  )
}
