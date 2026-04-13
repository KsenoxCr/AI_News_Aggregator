import sodium from "sodium-native";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const OPSLIMIT = sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE;
const MEMLIMIT = sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE;
const HASH_LEN = 32;

// deterministic, zero salt
export function hashKDF(input: string): Buffer {
  const out = Buffer.allocUnsafe(HASH_LEN);
  const salt = Buffer.alloc(sodium.crypto_pwhash_SALTBYTES, 0);
  sodium.crypto_pwhash(
    out,
    Buffer.from(input),
    salt,
    OPSLIMIT,
    MEMLIMIT,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
  return out;
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
