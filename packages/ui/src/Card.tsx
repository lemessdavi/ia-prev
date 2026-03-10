import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { iaPrevTheme as theme } from './theme';

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: theme.spacing.lg },
});
