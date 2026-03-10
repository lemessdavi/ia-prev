import type { ReactNode } from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import { iaPrevTheme as theme } from './theme';

export function Text({ children }: { children: ReactNode }) {
  return <RNText style={styles.text}>{children}</RNText>;
}

const styles = StyleSheet.create({
  text: { color: theme.colors.textPrimary },
});
