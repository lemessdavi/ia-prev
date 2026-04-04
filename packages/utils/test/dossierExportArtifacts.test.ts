import assert from "node:assert/strict";
import test from "node:test";
import { bytesToBase64, createConversationAttachmentZipFiles } from "../src/conversationAttachmentZipArtifacts";

const sampleExport = {
  conversationId: "conv_ana_caio",
  generatedAtIso: "2026-04-02T12:00:00.000Z",
  attachments: [
    {
      fileName: "laudo-medico.pdf",
      bytes: new TextEncoder().encode("conteudo-pdf"),
    },
    {
      fileName: "audio.ogg",
      bytes: new TextEncoder().encode("conteudo-audio"),
    },
  ],
};

test("creates deterministic zip file names for conversation attachments", () => {
  const files = createConversationAttachmentZipFiles(sampleExport);

  assert.equal(files.baseName, "arquivos-conversa-conv_ana_caio");
  assert.equal(files.zipFileName, "arquivos-conversa-conv_ana_caio.zip");
});

test("packages only the attachment files inside zip", () => {
  const files = createConversationAttachmentZipFiles(sampleExport);
  const entries = readLocalZipEntries(files.zipBytes);

  assert.deepEqual(entries.map((entry) => entry.name).sort(), ["audio.ogg", "laudo-medico.pdf"]);
  assert.deepEqual(
    entries.find((entry) => entry.name === "laudo-medico.pdf")?.bytes,
    new TextEncoder().encode("conteudo-pdf"),
  );
  assert.deepEqual(
    entries.find((entry) => entry.name === "audio.ogg")?.bytes,
    new TextEncoder().encode("conteudo-audio"),
  );
});

test("encodes bytes to base64", () => {
  const payload = new Uint8Array([77, 97, 116, 114, 105, 122]);
  assert.equal(bytesToBase64(payload), "TWF0cml6");
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
