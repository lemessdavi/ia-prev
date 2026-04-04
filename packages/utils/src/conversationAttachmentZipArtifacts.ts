import { conversationAttachmentExportZipFileName } from "./conversationAttachmentExportZipFileName";

type ConversationAttachmentZipInput = {
  conversationId: string;
  generatedAtIso: string;
  attachments: Array<{
    fileName: string;
    bytes: Uint8Array;
    modifiedAtIso?: string;
  }>;
};

export type ConversationAttachmentZipFiles = {
  baseName: string;
  zipFileName: string;
  zipBytes: Uint8Array;
};

type ZipEntry = {
  name: string;
  bytes: Uint8Array;
  modifiedAt: Date;
};

const CRC32_TABLE = buildCrc32Table();

export function createConversationAttachmentZipFiles(input: ConversationAttachmentZipInput): ConversationAttachmentZipFiles {
  const zipFileName = conversationAttachmentExportZipFileName(input.conversationId);
  const baseName = zipFileName.toLowerCase().endsWith(".zip") ? zipFileName.slice(0, -4) : zipFileName;

  const entryNames = new Set<string>();
  const entries: ZipEntry[] = input.attachments.map((attachment, index) => {
    const normalizedName = dedupeFileName(sanitizeAttachmentFileName(attachment.fileName, index), entryNames);
    const modifiedAt = attachment.modifiedAtIso ? new Date(attachment.modifiedAtIso) : new Date(input.generatedAtIso);

    return {
      name: normalizedName,
      bytes: attachment.bytes,
      modifiedAt: Number.isNaN(modifiedAt.getTime()) ? new Date(input.generatedAtIso) : modifiedAt,
    };
  });

  const zipBytes = createZipArchive(entries);

  return {
    baseName,
    zipFileName,
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

function dedupeFileName(fileName: string, usedNames: Set<string>): string {
  if (!usedNames.has(fileName)) {
    usedNames.add(fileName);
    return fileName;
  }

  const extensionIndex = fileName.lastIndexOf(".");
  const hasExtension = extensionIndex > 0 && extensionIndex < fileName.length - 1;
  const base = hasExtension ? fileName.slice(0, extensionIndex) : fileName;
  const extension = hasExtension ? fileName.slice(extensionIndex) : "";

  let counter = 2;
  while (true) {
    const candidate = `${base}-${counter}${extension}`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
    counter += 1;
  }
}

function sanitizeAttachmentFileName(fileName: string, index: number): string {
  const normalized = fileName.trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ");
  if (normalized.length > 0) {
    return normalized.slice(0, 180);
  }

  return `arquivo-${index + 1}.bin`;
}

function utf8Encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
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

  const centralDirectoryBytes = concatBytes(centralSections);
  const localBytes = concatBytes(localSections);

  const endOfCentralDirectory = new Uint8Array(22);
  writeUint32LE(endOfCentralDirectory, 0, 0x06054b50);
  writeUint16LE(endOfCentralDirectory, 4, 0);
  writeUint16LE(endOfCentralDirectory, 6, 0);
  writeUint16LE(endOfCentralDirectory, 8, entries.length);
  writeUint16LE(endOfCentralDirectory, 10, entries.length);
  writeUint32LE(endOfCentralDirectory, 12, centralDirectoryBytes.length);
  writeUint32LE(endOfCentralDirectory, 16, localBytes.length);
  writeUint16LE(endOfCentralDirectory, 20, 0);

  return concatBytes([localBytes, centralDirectoryBytes, endOfCentralDirectory]);
}

function writeUint16LE(buffer: Uint8Array, offset: number, value: number): void {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32LE(buffer: Uint8Array, offset: number, value: number): void {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
  buffer[offset + 3] = (value >>> 24) & 0xff;
}

function toDosDateTime(value: Date): { dosDate: number; dosTime: number } {
  const year = Math.max(1980, value.getFullYear());
  const month = value.getMonth() + 1;
  const day = value.getDate();
  const hours = value.getHours();
  const minutes = value.getMinutes();
  const seconds = Math.floor(value.getSeconds() / 2);

  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  const dosTime = (hours << 11) | (minutes << 5) | seconds;

  return { dosDate, dosTime };
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const value of bytes) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ value) & 0xff]!;
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function buildCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);

  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let j = 0; j < 8; j += 1) {
      if ((value & 1) === 1) {
        value = 0xedb88320 ^ (value >>> 1);
      } else {
        value >>>= 1;
      }
    }
    table[i] = value >>> 0;
  }

  return table;
}
