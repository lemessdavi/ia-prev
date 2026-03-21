import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PASSWORD_HASH_ALGORITHM = "scrypt";
const PASSWORD_KEY_LENGTH = 64;

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  const hash = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString("hex");
  return `${PASSWORD_HASH_ALGORITHM}:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, salt, expectedHash] = storedHash.split(":");
  if (algorithm !== PASSWORD_HASH_ALGORITHM || !salt || !expectedHash) {
    return false;
  }

  const actualHash = scryptSync(password, salt, PASSWORD_KEY_LENGTH);
  const expectedHashBuffer = Buffer.from(expectedHash, "hex");
  if (actualHash.length !== expectedHashBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualHash, expectedHashBuffer);
}
