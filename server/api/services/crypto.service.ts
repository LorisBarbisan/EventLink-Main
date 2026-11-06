import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const DELIMITER = ":";

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set. Generate a 32-byte key: " +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must be exactly 32 bytes when decoded from base64 (got ${key.length})`
    );
  }
  return key;
}

/** Encrypts a plaintext token. Returns "iv:tag:ciphertext" (all base64). */
export function encryptToken(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(
    DELIMITER
  );
}

/** Decrypts a stored "iv:tag:ciphertext" value back to the plaintext token. */
export function decryptToken(stored: string): string {
  const key = getKey();
  const parts = stored.split(DELIMITER);
  if (parts.length !== 3) throw new Error("Invalid encrypted token format");
  const [ivB64, tagB64, encB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(encB64, "base64");
  if (iv.length !== IV_BYTES) throw new Error("Invalid IV length");
  if (tag.length !== TAG_BYTES) throw new Error("Invalid auth tag length");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
