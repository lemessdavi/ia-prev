import { iaPrevTheme as sharedTheme, messageMocks } from 'ui';

export function ChatThread() {
  return (
    <section className="flex flex-1 flex-col" style={{ backgroundColor: sharedTheme.colors.background }} aria-label="Conversa ativa">
      <header className="flex items-center justify-between border-b bg-white px-4 py-3" style={{ borderColor: sharedTheme.colors.border }}>
        <div>
          <p className="font-semibold">Carlos Mendes</p>
          <p className="text-sm" style={{ color: sharedTheme.colors.textSecondary }}>Fluxo: Auxílio-Acidente</p>
        </div>
        <button className="rounded-xl px-4 py-2 text-sm font-medium" style={{ backgroundColor: sharedTheme.colors.chipActiveBg, color: sharedTheme.colors.chipActiveText }}>
          Assumir Conversa
        </button>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {messageMocks.map((message) => (
          <div key={message.id} className={`max-w-xl rounded-2xl border p-4 ${message.from === 'client' ? 'ml-auto' : ''}`} style={{ borderColor: sharedTheme.colors.border, backgroundColor: sharedTheme.colors.surface }}>
            <p>{message.text}</p>
            <p className="mt-2 text-right text-sm" style={{ color: sharedTheme.colors.textSecondary }}>{message.time}</p>
          </div>
        ))}
      </div>
      <footer className="border-t bg-white p-4" style={{ borderColor: sharedTheme.colors.border }}>
        <label htmlFor="composer" className="sr-only">Digite a mensagem</label>
        <input id="composer" aria-label="Digite uma mensagem" className="w-full rounded-xl border px-4 py-3" style={{ borderColor: sharedTheme.colors.border }} placeholder="Digite uma mensagem..." />
      </footer>
    </section>
  );
}
