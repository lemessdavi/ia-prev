import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { messageMocks } from '@/mocks/chat';
import { theme } from '@/theme';

export function ChatScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Carlos Mendes</Text>
        <Text style={styles.subtitle}>Fluxo: Auxílio-Acidente</Text>
      </View>
      <ScrollView contentContainerStyle={styles.messages}>
        {messageMocks.map((message) => (
          <View key={message.id} style={[styles.message, message.from === 'client' && styles.clientMessage]}>
            <Text>{message.text}</Text>
            <Text style={styles.time}>{message.time}</Text>
          </View>
        ))}
      </ScrollView>
      <TextInput accessibilityLabel="Digite uma mensagem" placeholder="Digite uma mensagem..." style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: theme.spacing.lg, borderBottomColor: theme.colors.border, borderBottomWidth: 1, backgroundColor: theme.colors.surface },
  title: { fontSize: 20, fontWeight: '600', color: theme.colors.textPrimary },
  subtitle: { color: theme.colors.textSecondary },
  messages: { padding: theme.spacing.lg, gap: theme.spacing.md },
  message: { borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, padding: theme.spacing.lg, maxWidth: '88%' },
  clientMessage: { alignSelf: 'flex-end' },
  time: { textAlign: 'right', color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
  input: { borderTopWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, padding: theme.spacing.lg },
});
