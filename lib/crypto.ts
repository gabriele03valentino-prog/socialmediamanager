import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM. Formato a DB: base64(iv(12) || tag(16) || ciphertext).
// La chiave si imposta in TOKEN_ENCRYPTION_KEY come 64 caratteri esadecimali (32 byte).

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY non impostata. Genera con: openssl rand -hex 32",
    );
  }
  if (hex.length !== 64) {
    throw new Error("TOKEN_ENCRYPTION_KEY deve essere 64 caratteri esadecimali (32 byte).");
  }
  return Buffer.from(hex, "hex");
}

export function encryptToken(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptToken(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}
