import { theme } from '@/theme';
import { CasePanel } from '@/components/chat/CasePanel';
import { ChatThread } from '@/components/chat/ChatThread';
import { ConversationList } from '@/components/chat/ConversationList';

export function ChatWorkspaceScreen() {
  return (
    <main className="flex h-screen" style={{ backgroundColor: theme.colors.background, color: theme.colors.textPrimary }}>
      <ConversationList />
      <ChatThread />
      <CasePanel />
    </main>
  );
}
