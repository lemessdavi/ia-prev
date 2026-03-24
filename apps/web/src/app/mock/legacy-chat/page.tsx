import { tokens } from 'config'
import { conversations, dossier, messages, tenant } from 'utils'

const statusStyles = {
  Apto: { backgroundColor: tokens.colors.successBg, color: tokens.colors.successText },
  'Em triagem': { backgroundColor: tokens.colors.infoBg, color: tokens.colors.infoText },
  'Revisão Humana': { backgroundColor: tokens.colors.warningBg, color: tokens.colors.warningText }
} as const

export default function Home() {
  const hasConversations = conversations.length > 0
  const hasMessages = messages.length > 0
  const hasDocuments = dossier.documents.length > 0

  return (
    <main className="min-h-screen p-1" style={{ backgroundColor: tokens.colors.bg, color: tokens.colors.text }}>
      <div className="mx-auto grid h-[97vh] max-w-[1600px] grid-cols-[260px_360px_1fr_360px] overflow-hidden rounded-2xl border" style={{ borderColor: tokens.colors.border, backgroundColor: tokens.colors.panel }}>
        <aside className="border-r p-6" style={{ borderColor: tokens.colors.border }} aria-label="Navegação lateral">
          <h1 className="text-3xl font-semibold">{tenant.tenantName}</h1>
          <p className="mt-2 text-base" style={{ color: tokens.colors.textMuted }}>WhatsApp: {tenant.wabaLabel}</p>
          <p className="mt-1 text-base" style={{ color: tokens.colors.textMuted }}>IA ativa: {tenant.activeAiProfileName}</p>
          <nav className="mt-10 space-y-6 text-2xl" aria-label="Menu principal">
            <p>Conversas</p>
            <p className="text-zinc-500">Relatórios</p>
          </nav>
          <button className="mt-[42rem] text-xl" aria-label="Sair">Sair</button>
        </aside>

        <section className="border-r" style={{ borderColor: tokens.colors.border }} aria-label="Lista de conversas">
          <div className="border-b p-4" style={{ borderColor: tokens.colors.border }}>
            <input aria-label="Buscar conversa" placeholder="Buscar nome ou telefone…" className="w-full rounded-xl border px-4 py-3 text-lg" style={{ borderColor: tokens.colors.border }} />
            <div className="mt-4 flex gap-2 text-base">
              {['Todos', 'Em triagem', 'Apto'].map((item, index) => (
                <button key={item} className="rounded-xl px-3 py-2" style={index === 0 ? { backgroundColor: tokens.colors.primary, color: '#fff' } : { backgroundColor: '#eee' }}>{item}</button>
              ))}
            </div>
          </div>
          {hasConversations ? (
            conversations.map((conversation) => (
              <article key={conversation.id} className="border-b p-5" style={{ borderColor: tokens.colors.border, backgroundColor: conversation.selected ? '#fafafa' : 'transparent' }}>
                <div className="flex items-start justify-between">
                  <h2 className="text-3xl font-medium">{conversation.name}</h2>
                  <span className="text-xl text-zinc-500">{conversation.time}</span>
                </div>
                <p className="mt-2 text-2xl text-zinc-500">{conversation.preview}</p>
                <span className="mt-3 inline-block rounded-lg px-2 py-1 text-xl" style={statusStyles[conversation.status]}>{conversation.status}</span>
              </article>
            ))
          ) : (
            <p className="p-5 text-xl" style={{ color: tokens.colors.textMuted }}>Nenhuma conversa disponível para este tenant.</p>
          )}
        </section>

        <section className="flex flex-col border-r" style={{ borderColor: tokens.colors.border }} aria-label="Chat">
          <header className="flex items-center justify-between border-b p-5" style={{ borderColor: tokens.colors.border }}>
            <div>
              <h2 className="text-3xl font-medium">Carlos Mendes</h2>
              <p className="text-xl" style={{ color: tokens.colors.textMuted }}>Fluxo: Auxílio-Acidente</p>
            </div>
            <button className="rounded-xl px-6 py-3 text-xl text-white" style={{ backgroundColor: tokens.colors.primary }}>Assumir Conversa</button>
          </header>
          <div className="flex-1 space-y-6 overflow-auto p-6">
            {hasMessages ? (
              messages.map((message) => (
                <div key={message.id} className={message.from === 'client' ? 'ml-auto max-w-[65%]' : 'max-w-[75%]'}>
                  <div className="rounded-3xl border p-5 text-3xl leading-snug" style={{ borderColor: tokens.colors.border, backgroundColor: '#f6f6f7' }}>{message.text}</div>
                  <p className="mt-1 text-right text-xl" style={{ color: tokens.colors.textMuted }}>{message.time}</p>
                </div>
              ))
            ) : (
              <p className="text-xl" style={{ color: tokens.colors.textMuted }}>Sem mensagens para exibir.</p>
            )}
          </div>
          <footer className="border-t p-4" style={{ borderColor: tokens.colors.border }}>
            <label htmlFor="message" className="sr-only">Digite uma mensagem</label>
            <input id="message" className="w-full rounded-2xl border px-5 py-4 text-2xl" style={{ borderColor: tokens.colors.border }} placeholder="Digite uma mensagem…" />
          </footer>
        </section>

        <aside className="p-6" aria-label="Dossiê do caso">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-semibold">Dossiê do Caso</h2>
            <span className="rounded-xl px-3 py-1" style={statusStyles.Apto}>Apto</span>
          </div>
          <section className="mt-8 rounded-2xl border p-5" style={{ borderColor: tokens.colors.border }}>
            <h3 className="text-xl uppercase text-zinc-500">Dados do cliente</h3>
            <p className="mt-4 text-2xl font-medium">{dossier.name}</p>
            <p className="mt-3 text-xl text-zinc-500">{dossier.phone}</p>
            <p className="mt-3 text-xl text-zinc-500">{dossier.city}</p>
            <p className="mt-6 text-xl" style={{ color: tokens.colors.successText }}>{dossier.consent}</p>
            <p className="text-lg text-zinc-500">{dossier.consentAt}</p>
          </section>
          <section className="mt-6 rounded-2xl border p-5" style={{ borderColor: tokens.colors.border }}>
            <h3 className="text-xl uppercase text-zinc-500">Documentos recebidos</h3>
            {hasDocuments ? (
              dossier.documents.map((doc) => (
                <p key={doc} className="mt-4 text-2xl">{doc}</p>
              ))
            ) : (
              <p className="mt-4 text-xl" style={{ color: tokens.colors.textMuted }}>Nenhum documento recebido.</p>
            )}
          </section>
        </aside>
      </div>
    </main>
  )
}
