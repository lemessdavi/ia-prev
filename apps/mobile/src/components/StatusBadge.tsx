import { Text, View } from 'react-native';
import { theme } from '@/theme';
import type { ConversationStatus } from 'ui';

const map = {
  Apto: { backgroundColor: theme.colors.successBg, color: theme.colors.successText },
  'Revisão Humana': { backgroundColor: theme.colors.warningBg, color: theme.colors.warningText },
  'Em triagem': { backgroundColor: theme.colors.infoBg, color: theme.colors.infoText },
} as const;

export function StatusBadge({ status }: { status: ConversationStatus }) {
  return (
    <View style={[{ borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs }, map[status]]}>
      <Text>{status}</Text>
    </View>
  );
}
