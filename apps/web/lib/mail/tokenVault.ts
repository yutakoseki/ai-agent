import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { AppError } from "@shared/error";

const TOKEN_SECRET =
  process.env.OAUTH_TOKEN_ENC_KEY ||
  process.env.JWT_SECRET ||
  "";

function getKey(): Buffer {
  if (!TOKEN_SECRET) {
    throw new AppError("INTERNAL_ERROR", "Token encryption key is missing");
  }
  return createHash("sha256").update(TOKEN_SECRET).digest();
}

export function encryptSecret(input: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(input, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptSecret(payload: string): string {
  const key = getKey();
  const raw = Buffer.from(payload, "base64url");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
