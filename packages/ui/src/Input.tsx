import { StyleSheet, Text, TextInput, View } from 'react-native';
import { iaPrevTheme as theme } from './theme';

interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
}

export function Input({ label, placeholder, value, onChangeText }: InputProps) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor={theme.colors.textSecondary} value={value} onChangeText={onChangeText} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: theme.spacing.sm },
  label: { color: theme.colors.textSecondary },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
});
