import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme';

export function DossierScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dossiê do Caso</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Dados do Cliente</Text>
        <Text style={styles.name}>Carlos Mendes</Text>
        <Text style={styles.meta}>+55 11 99999-8888</Text>
        <Text style={styles.meta}>São Paulo, SP</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Documentos Recebidos</Text>
        <Text style={styles.meta}>Foto_Acidente.jpg</Text>
        <Text style={styles.meta}>Laudo_Medico.pdf</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.lg, gap: theme.spacing.md },
  title: { fontSize: 24, fontWeight: '600' },
  card: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, padding: theme.spacing.lg },
  label: { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm },
  name: { fontSize: 20, fontWeight: '600' },
  meta: { color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
});
