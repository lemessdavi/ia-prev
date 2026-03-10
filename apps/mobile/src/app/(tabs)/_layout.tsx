import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { theme } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.textPrimary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: { borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
        headerShown: false,
      }}
    >
      <Tabs.Screen name="conversas/index" options={{ title: 'Conversas', tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="chat/index" options={{ title: 'Chat', tabBarIcon: ({ color, size }) => <Ionicons name="paper-plane-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="dossie/index" options={{ title: 'Dossiê', tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
