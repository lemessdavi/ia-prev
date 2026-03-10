import { Pressable, StyleSheet, Text } from 'react-native';
import { iaPrevTheme as theme } from './theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
}

export function Button({ title, onPress, variant = 'primary', disabled = false }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.base, styles[variant], disabled && styles.disabled]}
    >
      <Text style={[styles.text, variant === 'primary' ? styles.textPrimary : styles.textNeutral]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, borderRadius: theme.radius.sm },
  primary: { backgroundColor: theme.colors.chipActiveBg },
  secondary: { backgroundColor: theme.colors.chipBg },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border },
  text: { textAlign: 'center', fontWeight: '500' },
  textPrimary: { color: theme.colors.chipActiveText },
  textNeutral: { color: theme.colors.textPrimary },
  disabled: { opacity: 0.5 },
});
