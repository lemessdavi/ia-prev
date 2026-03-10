import { theme } from '@/theme';
import type { ConversationStatus } from 'ui';

const styles = {
  Apto: { bg: theme.colors.successBg, color: theme.colors.successText },
  'Revisão Humana': { bg: theme.colors.warningBg, color: theme.colors.warningText },
  'Em triagem': { bg: theme.colors.infoBg, color: theme.colors.infoText },
};

export function StatusChip({ status }: { status: ConversationStatus }) {
  const token = styles[status];
  return <span style={{ backgroundColor: token.bg, color: token.color }} className="rounded px-2 py-1 text-xs font-medium">{status}</span>;
}
