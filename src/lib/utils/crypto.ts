import sodium from "libsodium-wrappers-sumo";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const HASH_LEN = 32;

// deterministic, zero salt
export async function hashKDF(input: string): Promise<Buffer> {
  await sodium.ready;
  const out = sodium.crypto_pwhash(
    HASH_LEN,
    Buffer.from(input),
    new Uint8Array(sodium.crypto_pwhash_SALTBYTES), // zero salt
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
  return Buffer.from(out);
}

const ALGO = "aes-256-gcm";
const NONCE_LEN = 12;
const TAG_LEN = 16;

export function encrypt(key: Buffer, value: string): string {
  const nonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv(ALGO, key, nonce);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, tag, encrypted]).toString("base64");
}

export function decrypt(key: Buffer, value: string): string {
  const buf = Buffer.from(value, "base64");
  const nonce = buf.subarray(0, NONCE_LEN);
  const tag = buf.subarray(NONCE_LEN, NONCE_LEN + TAG_LEN);
  const ciphertext = buf.subarray(NONCE_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, nonce);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
