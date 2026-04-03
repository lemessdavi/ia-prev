import type { DossierExportDTO } from "./backendApiTypes";

export const DOSSIER_FORMAT_VERSION = "dossie.v1";

type DossierExportInput = Omit<DossierExportDTO, "formatVersion"> & {
  formatVersion?: DossierExportDTO["formatVersion"];
};

export type DossierExportFiles = {
  baseName: string;
  jsonFileName: string;
  pdfFileName: string;
  zipFileName: string;
  jsonBytes: Uint8Array;
  pdfBytes: Uint8Array;
  zipBytes: Uint8Array;
};

type ZipEntry = {
  name: string;
  bytes: Uint8Array;
  modifiedAt: Date;
};

const CRC32_TABLE = buildCrc32Table();

export function createDossierExportFiles(payload: DossierExportInput): DossierExportFiles {
  const normalized = normalizeDossierExport(payload);
  const safeConversationId = sanitizeFileToken(normalized.conversationId);
  const baseName = `dossie-${safeConversationId}`;

  const jsonFileName = `${baseName}.json`;
  const pdfFileName = `${baseName}.pdf`;
  const zipFileName = `${baseName}.zip`;

  const jsonBytes = utf8Encode(JSON.stringify(normalized, null, 2));
  const pdfBytes = buildDossierSummaryPdf(normalized);
  const zipBytes = createZipArchive([
    { name: jsonFileName, bytes: jsonBytes, modifiedAt: new Date(normalized.generatedAtIso) },
    { name: pdfFileName, bytes: pdfBytes, modifiedAt: new Date(normalized.generatedAtIso) },
  ]);

  return {
    baseName,
    jsonFileName,
    pdfFileName,
    zipFileName,
    jsonBytes,
    pdfBytes,
    zipBytes,
  };
}

export function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triple = (a << 16) | (b << 8) | c;

    result += alphabet[(triple >> 18) & 0x3f];
    result += alphabet[(triple >> 12) & 0x3f];
    result += i + 1 < bytes.length ? alphabet[(triple >> 6) & 0x3f] : "=";
    result += i + 2 < bytes.length ? alphabet[triple & 0x3f] : "=";
  }

  return result;
}

function normalizeDossierExport(payload: DossierExportInput): DossierExportDTO {
  return {
    ...payload,
    formatVersion: payload.formatVersion ?? DOSSIER_FORMAT_VERSION,
  };
}

function sanitizeFileToken(input: string): string {
  const normalized = input.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-");
  return normalized.replace(/-+/g, "-").replace(/^-|-$/g, "") || "conversa";
}

function utf8Encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function latin1Encode(value: string): Uint8Array {
  const buffer = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) {
    const codePoint = value.charCodeAt(i);
    buffer[i] = codePoint <= 0xff ? codePoint : 0x3f;
  }
  return buffer;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function buildDossierSummaryPdf(payload: DossierExportDTO): Uint8Array {
  const lines = buildSummaryLines(payload);
  const streamCommands = lines
    .map((line, index) => {
      const y = 800 - index * 14;
      return `1 0 0 1 42 ${y} Tm (${escapePdfText(line)}) Tj`;
    })
    .join("\n");

  const contentBytes = latin1Encode(`BT\n/F1 11 Tf\n${streamCommands}\nET`);

  const objects: Uint8Array[] = [
    latin1Encode("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"),
    latin1Encode("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"),
    latin1Encode("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"),
    latin1Encode("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"),
    concatBytes([
      latin1Encode(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`),
      contentBytes,
      latin1Encode("\nendstream\nendobj\n"),
    ]),
  ];

  const header = latin1Encode("%PDF-1.4\n");
  const offsets: number[] = [];
  let cursor = header.length;

  for (const objectBytes of objects) {
    offsets.push(cursor);
    cursor += objectBytes.length;
  }

  const xrefOffset = cursor;
  const xrefLines = [
    `xref`,
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((offset) => `${offset.toString().padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    `${xrefOffset}`,
    "%%EOF",
  ];
  const xrefBytes = latin1Encode(`${xrefLines.join("\n")}\n`);

  return concatBytes([header, ...objects, xrefBytes]);
}

function buildSummaryLines(payload: DossierExportDTO): string[] {
  const lines: string[] = [
    "Dossie v1 - Resumo operacional",
    `Gerado em: ${payload.generatedAtIso}`,
    `Tenant: ${payload.tenantId}`,
    `Conversa: ${payload.conversationId}`,
    `Contato: ${payload.contactId}`,
    `Status: ${payload.conversationStatus}`,
    `Triage: ${payload.triageResult}`,
    `Fechamento: ${payload.closureReason ?? "Nao informado"}`,
    "",
    "Perfil do contato",
    `Papel: ${payload.dossier.role}`,
    `Empresa: ${payload.dossier.company}`,
    `Localizacao: ${payload.dossier.location}`,
  ];

  lines.push(...wrapText(`Resumo: ${payload.dossier.summary}`, 96));
  lines.push(...wrapText(`Tags: ${payload.dossier.tags.length > 0 ? payload.dossier.tags.join(", ") : "Nenhuma"}`, 96));
  lines.push("");
  lines.push("Indicadores");
  lines.push(`Mensagens: ${payload.messages.length}`);
  lines.push(`Anexos: ${payload.attachments.length}`);
  lines.push(`Handoffs: ${payload.handoffEvents.length}`);
  lines.push(`Eventos recentes: ${payload.recentEvents.length}`);
  lines.push("");

  for (const event of payload.recentEvents.slice(0, 4)) {
    const dateIso = new Date(event.occurredAt).toISOString();
    lines.push(...wrapText(`- [${event.type}] ${event.title} (${dateIso})`, 96));
    lines.push(...wrapText(`  ${event.description}`, 96));
  }

  const maxLines = 54;
  if (lines.length > maxLines) {
    return [...lines.slice(0, maxLines - 1), "... resumo truncado para caber em uma pagina."];
  }
  return lines;
}

function wrapText(rawText: string, maxChars: number): string[] {
  const text = rawText.replace(/\s+/g, " ").trim();
  if (!text) return [""];
  if (text.length <= maxChars) return [text];

  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length <= maxChars) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = "";
    }

    if (word.length <= maxChars) {
      currentLine = word;
      continue;
    }

    let chunkStart = 0;
    while (chunkStart < word.length) {
      const chunk = word.slice(chunkStart, chunkStart + maxChars);
      lines.push(chunk);
      chunkStart += maxChars;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function escapePdfText(rawText: string): string {
  return rawText
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\n\r\t]/g, " ");
}

function createZipArchive(entries: ZipEntry[]): Uint8Array {
  const localSections: Uint8Array[] = [];
  const centralSections: Uint8Array[] = [];
  let currentOffset = 0;

  for (const entry of entries) {
    const nameBytes = utf8Encode(entry.name);
    const crc = crc32(entry.bytes);
    const { dosDate, dosTime } = toDosDateTime(entry.modifiedAt);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeUint32LE(localHeader, 0, 0x04034b50);
    writeUint16LE(localHeader, 4, 20);
    writeUint16LE(localHeader, 6, 0x0800);
    writeUint16LE(localHeader, 8, 0);
    writeUint16LE(localHeader, 10, dosTime);
    writeUint16LE(localHeader, 12, dosDate);
    writeUint32LE(localHeader, 14, crc);
    writeUint32LE(localHeader, 18, entry.bytes.length);
    writeUint32LE(localHeader, 22, entry.bytes.length);
    writeUint16LE(localHeader, 26, nameBytes.length);
    writeUint16LE(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);

    localSections.push(localHeader, entry.bytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeUint32LE(centralHeader, 0, 0x02014b50);
    writeUint16LE(centralHeader, 4, 20);
    writeUint16LE(centralHeader, 6, 20);
    writeUint16LE(centralHeader, 8, 0x0800);
    writeUint16LE(centralHeader, 10, 0);
    writeUint16LE(centralHeader, 12, dosTime);
    writeUint16LE(centralHeader, 14, dosDate);
    writeUint32LE(centralHeader, 16, crc);
    writeUint32LE(centralHeader, 20, entry.bytes.length);
    writeUint32LE(centralHeader, 24, entry.bytes.length);
    writeUint16LE(centralHeader, 28, nameBytes.length);
    writeUint16LE(centralHeader, 30, 0);
    writeUint16LE(centralHeader, 32, 0);
    writeUint16LE(centralHeader, 34, 0);
    writeUint16LE(centralHeader, 36, 0);
    writeUint32LE(centralHeader, 38, 0);
    writeUint32LE(centralHeader, 42, currentOffset);
    centralHeader.set(nameBytes, 46);

    centralSections.push(centralHeader);
    currentOffset += localHeader.length + entry.bytes.length;
  }

  const centralDirectory = concatBytes(centralSections);
  const localDirectory = concatBytes(localSections);

  const endOfCentralDirectory = new Uint8Array(22);
  writeUint32LE(endOfCentralDirectory, 0, 0x06054b50);
  writeUint16LE(endOfCentralDirectory, 4, 0);
  writeUint16LE(endOfCentralDirectory, 6, 0);
  writeUint16LE(endOfCentralDirectory, 8, entries.length);
  writeUint16LE(endOfCentralDirectory, 10, entries.length);
  writeUint32LE(endOfCentralDirectory, 12, centralDirectory.length);
  writeUint32LE(endOfCentralDirectory, 16, localDirectory.length);
  writeUint16LE(endOfCentralDirectory, 20, 0);

  return concatBytes([localDirectory, centralDirectory, endOfCentralDirectory]);
}

function toDosDateTime(date: Date): { dosDate: number; dosTime: number } {
  const year = Math.max(1980, date.getUTCFullYear());
  const month = Math.min(Math.max(date.getUTCMonth() + 1, 1), 12);
  const day = Math.min(Math.max(date.getUTCDate(), 1), 31);
  const hours = Math.min(Math.max(date.getUTCHours(), 0), 23);
  const minutes = Math.min(Math.max(date.getUTCMinutes(), 0), 59);
  const seconds = Math.min(Math.max(Math.floor(date.getUTCSeconds() / 2), 0), 29);

  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  const dosTime = (hours << 11) | (minutes << 5) | seconds;

  return {
    dosDate,
    dosTime,
  };
}

function writeUint16LE(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32LE(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function buildCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ data[i]!) & 0xff]!;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

