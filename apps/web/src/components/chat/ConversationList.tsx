import { conversationMocks } from 'ui';
import { theme } from '@/theme';
import { StatusChip } from './StatusChip';

export function ConversationList() {
  return (
    <section className="w-full max-w-80 border-r" style={{ borderColor: theme.colors.border }} aria-label="Lista de conversas">
      <div className="border-b p-4" style={{ borderColor: theme.colors.border }}>
        <input aria-label="Buscar conversa" className="w-full rounded-lg border px-3 py-2" style={{ borderColor: theme.colors.border }} placeholder="Buscar nome ou telefone..." />
        <div className="mt-3 flex gap-2 text-sm">
          <button className="rounded px-3 py-1" style={{ backgroundColor: theme.colors.chipActiveBg, color: theme.colors.chipActiveText }}>Todos</button>
          <button className="rounded px-3 py-1" style={{ backgroundColor: theme.colors.chipBg }}>Em triagem</button>
          <button className="rounded px-3 py-1" style={{ backgroundColor: theme.colors.chipBg }}>Apto</button>
        </div>
      </div>
      {conversationMocks.map((conversation, idx) => (
        <article key={conversation.id} className="border-b p-4" style={{ borderColor: theme.colors.border, borderLeft: idx === 0 ? `3px solid ${theme.colors.textPrimary}` : 'none' }}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{conversation.name}</h3>
            <span className="text-sm" style={{ color: theme.colors.textSecondary }}>{conversation.time}</span>
          </div>
          <p className="mb-2 truncate" style={{ color: theme.colors.textSecondary }}>{conversation.preview}</p>
          <StatusChip status={conversation.status} />
        </article>
      ))}
    </section>
  );
}
