import { theme } from '@/theme';

export function CasePanel() {
  return (
    <aside className="w-full max-w-80 space-y-4 border-l p-4" style={{ borderColor: theme.colors.border }} aria-label="Dossiê do caso">
      <h2 className="text-xl font-semibold">Dossiê do Caso</h2>
      <section className="rounded-xl border bg-white p-4" style={{ borderColor: theme.colors.border }}>
        <p className="text-sm" style={{ color: theme.colors.textSecondary }}>Dados do cliente</p>
        <p className="mt-2 text-lg font-semibold">Carlos Mendes</p>
        <p style={{ color: theme.colors.textSecondary }}>+55 11 99999-8888</p>
        <div className="mt-3"><span className="rounded px-2 py-1 text-xs font-medium" style={{ backgroundColor: theme.colors.successBg, color: theme.colors.successText }}>Consentimento LGPD Aceito</span></div>
      </section>
      <section className="rounded-xl border bg-white p-4" style={{ borderColor: theme.colors.border }}>
        <p className="font-medium">Documentos recebidos</p>
        <ul className="mt-2 space-y-2">
          <li>Foto_Acidente.jpg</li>
          <li>Laudo_Medico.pdf</li>
        </ul>
      </section>
      <button className="w-full rounded-xl border bg-white px-3 py-2">Exportar Dossiê (PDF)</button>
      <button className="w-full rounded-xl border bg-white px-3 py-2" style={{ color: theme.colors.buttonDanger }}>Encerrar Caso</button>
    </aside>
  );
}
