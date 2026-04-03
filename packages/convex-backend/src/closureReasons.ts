export const closureReasonCatalog = [
  {
    code: "SEM_ELEGIBILIDADE",
    label: "Sem elegibilidade",
    requiresDetail: false,
  },
  {
    code: "CLIENTE_INATIVO",
    label: "Cliente inativo",
    requiresDetail: false,
  },
  {
    code: "DESISTENCIA",
    label: "Desistencia",
    requiresDetail: false,
  },
  {
    code: "ENCAMINHADO",
    label: "Encaminhado",
    requiresDetail: true,
    detailLabel: "Destino do encaminhamento",
    detailPlaceholder: "Ex: Encaminhado para atendimento presencial no INSS",
  },
  {
    code: "CONVERTIDO",
    label: "Convertido",
    requiresDetail: false,
  },
  {
    code: "OUTRO",
    label: "Outro",
    requiresDetail: true,
    detailLabel: "Detalhe complementar",
    detailPlaceholder: "Descreva o motivo do encerramento",
  },
] as const;

export type ClosureReasonCatalogEntry = (typeof closureReasonCatalog)[number];
export type ClosureReasonCode = ClosureReasonCatalogEntry["code"];

const closureReasonByCode = new Map<ClosureReasonCode, ClosureReasonCatalogEntry>(
  closureReasonCatalog.map((entry) => [entry.code, entry]),
);

export function getClosureReasonByCode(reasonCode: string): ClosureReasonCatalogEntry | undefined {
  return closureReasonByCode.get(reasonCode as ClosureReasonCode);
}

export function normalizeClosureReasonDetail(reasonDetail?: string): string | undefined {
  const normalized = reasonDetail?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

export function formatClosureReason(reasonCode: ClosureReasonCode, reasonDetail?: string): string {
  const entry = closureReasonByCode.get(reasonCode);
  const normalizedDetail = normalizeClosureReasonDetail(reasonDetail);

  if (!entry) {
    return normalizedDetail ? `${reasonCode}: ${normalizedDetail}` : reasonCode;
  }

  return normalizedDetail ? `${entry.label}: ${normalizedDetail}` : entry.label;
}
