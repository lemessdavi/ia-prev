import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { conversationMocks } from '@/mocks/chat';
import { StatusBadge } from '@/components/StatusBadge';
import { theme } from '@/theme';

export function ConversationsScreen() {
  return (
    <View style={styles.container}>
      <TextInput accessibilityLabel="Buscar conversa" placeholder="Buscar nome ou telefone..." style={styles.search} />
      <FlatList
        data={conversationMocks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.preview}>{item.preview}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.time}>{item.time}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.lg, gap: theme.spacing.md },
  search: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, padding: theme.spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingVertical: theme.spacing.md },
  name: { fontSize: 18, fontWeight: '600', color: theme.colors.textPrimary },
  preview: { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm },
  time: { color: theme.colors.textSecondary },
});
