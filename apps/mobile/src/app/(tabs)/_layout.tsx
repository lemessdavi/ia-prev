import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { tokens } from 'config'

export default function TabsLayout() {
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
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => <Ionicons name="paper-plane-outline" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="dossie"
        options={{
          title: 'Dossiê',
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />
        }}
      />
    </Tabs>
  )
}
