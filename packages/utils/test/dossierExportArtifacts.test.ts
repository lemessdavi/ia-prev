import assert from "node:assert/strict";
import test from "node:test";
import type { DossierExportDTO } from "../src/backendApiTypes";
import { createDossierExportFiles } from "../src/dossierExportArtifacts";

const sampleExport: DossierExportDTO = {
  formatVersion: "dossie.v1",
  tenantId: "tenant_legal",
  conversationId: "conv_ana_caio",
  conversationStatus: "FECHADO",
  triageResult: "REVISAO_HUMANA",
  contactId: "usr_caio",
  generatedAtIso: "2026-04-02T12:00:00.000Z",
  dossier: {
    id: "dos_caio",
    tenantId: "tenant_legal",
    contactId: "usr_caio",
    role: "Cliente",
    company: "Nunes & Filhos",
    location: "Sao Paulo, SP",
    summary: "Aguardando atualizacao de documentacao previdenciaria.",
    tags: ["Prioridade Alta", "Documentacao"],
    updatedAt: 1_775_130_000_000,
  },
  recentEvents: [
    {
      id: "evt_1",
      tenantId: "tenant_legal",
      contactId: "usr_caio",
      title: "Documentos recebidos",
      description: "Upload de comprovante de residencia.",
      occurredAt: 1_775_129_000_000,
      type: "interaction",
    },
  ],
  messages: [
    {
      id: "msg_1",
      tenantId: "tenant_legal",
      conversationId: "conv_ana_caio",
      senderId: "usr_ana",
      body: "Mensagem de teste.",
      createdAt: 1_775_129_500_000,
      readBy: ["usr_ana", "usr_caio"],
    },
  ],
  attachments: [
    {
      id: "att_1",
      tenantId: "tenant_legal",
      conversationId: "conv_ana_caio",
      messageId: "msg_1",
      fileName: "laudo-medico.pdf",
      contentType: "application/pdf",
      url: "https://cdn.iaprev.com/files/laudo-medico.pdf",
      createdAt: 1_775_129_510_000,
    },
  ],
  handoffEvents: [
    {
      id: "hand_1",
      tenantId: "tenant_legal",
      conversationId: "conv_ana_caio",
      from: "assistant",
      to: "human",
      performedByUserId: "usr_ana",
      createdAt: 1_775_129_520_000,
    },
  ],
  closureReason: "Documentacao validada e caso concluido",
};

test("creates deterministic export file names and a readable PDF header", () => {
  const files = createDossierExportFiles(sampleExport);

  assert.equal(files.baseName, "dossie-conv_ana_caio");
  assert.equal(files.jsonFileName, "dossie-conv_ana_caio.json");
  assert.equal(files.pdfFileName, "dossie-conv_ana_caio.pdf");
  assert.equal(files.zipFileName, "dossie-conv_ana_caio.zip");

  const jsonPayload = JSON.parse(Buffer.from(files.jsonBytes).toString("utf8")) as { formatVersion: string };
  assert.equal(jsonPayload.formatVersion, "dossie.v1");

  const pdfHeader = Buffer.from(files.pdfBytes.subarray(0, 8)).toString("latin1");
  assert.equal(pdfHeader, "%PDF-1.4");

  const pdfBody = Buffer.from(files.pdfBytes).toString("latin1");
  assert.match(pdfBody, /Dossie v1/);
  assert.match(pdfBody, /conv_ana_caio/);
  assert.match(pdfBody, /usr_caio/);
});

test("packages json + pdf inside zip with expected file entries", () => {
  const files = createDossierExportFiles(sampleExport);
  const entries = readLocalZipEntries(files.zipBytes);

  assert.deepEqual(entries.map((entry) => entry.name).sort(), [files.jsonFileName, files.pdfFileName]);

  const jsonEntry = entries.find((entry) => entry.name === files.jsonFileName);
  const pdfEntry = entries.find((entry) => entry.name === files.pdfFileName);

  assert.ok(jsonEntry);
  assert.ok(pdfEntry);
  assert.deepEqual(jsonEntry?.bytes, files.jsonBytes);
  assert.deepEqual(pdfEntry?.bytes, files.pdfBytes);
});

function readLocalZipEntries(source: Uint8Array): Array<{ name: string; bytes: Uint8Array }> {
  const entries: Array<{ name: string; bytes: Uint8Array }> = [];
  let offset = 0;

  while (offset + 4 <= source.length) {
    const signature = readUint32LE(source, offset);
    if (signature !== 0x04034b50) break;

    const compressionMethod = readUint16LE(source, offset + 8);
    const fileNameLength = readUint16LE(source, offset + 26);
    const extraFieldLength = readUint16LE(source, offset + 28);
    const compressedSize = readUint32LE(source, offset + 18);

    assert.equal(compressionMethod, 0, "expected stored zip entries without compression");

    const fileNameStart = offset + 30;
    const fileNameEnd = fileNameStart + fileNameLength;
    const dataStart = fileNameEnd + extraFieldLength;
    const dataEnd = dataStart + compressedSize;

    const fileName = Buffer.from(source.subarray(fileNameStart, fileNameEnd)).toString("utf8");
    const fileBytes = source.slice(dataStart, dataEnd);

    entries.push({ name: fileName, bytes: fileBytes });
    offset = dataEnd;
  }

  return entries;
}

function readUint16LE(source: Uint8Array, offset: number): number {
  return source[offset]! | (source[offset + 1]! << 8);
}

function readUint32LE(source: Uint8Array, offset: number): number {
  return (
    source[offset]! |
    (source[offset + 1]! << 8) |
    (source[offset + 2]! << 16) |
    (source[offset + 3]! << 24)
  ) >>> 0;
}
