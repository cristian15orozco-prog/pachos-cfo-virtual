import crypto from "node:crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const key = Buffer.from(env.tokenEncryptionKey, "hex");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars).");
  }
  return key;
}

/** Cifra un access_token de Plaid antes de persistirlo. Nunca guardar en texto plano. */
export function encryptToken(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${authTag.toString("hex")}`;
}

/** Descifra un access_token de Plaid. Solo debe usarse en memoria, nunca loguearse. */
export function decryptToken(payload: string): string {
  const [ivHex, dataHex, authTagHex] = payload.split(":");
  if (!ivHex || !dataHex || !authTagHex) {
    throw new Error("Invalid encrypted token payload format.");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}
