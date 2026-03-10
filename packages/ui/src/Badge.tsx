import { StyleSheet, Text, View } from 'react-native';
import { iaPrevTheme as theme } from './theme';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning';
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  return (
    <View style={[styles.base, styles[variant]]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, alignSelf: 'flex-start' },
  default: { backgroundColor: theme.colors.chipBg },
  success: { backgroundColor: theme.colors.successBg },
  warning: { backgroundColor: theme.colors.warningBg },
  text: { color: theme.colors.textPrimary, fontSize: 12, fontWeight: '500' },
});
