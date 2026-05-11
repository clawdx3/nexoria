import { randomBytes } from 'crypto';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as nacl from 'tweetnacl';

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

const PRIV_FILE = 'ed25519_private_key.pem';
const PUB_FILE = 'ed25519_public_key.pem';

export function generateAndStoreKeys(dataDir: string): KeyPair {
  const privPath = join(dataDir, PRIV_FILE);
  const pubPath = join(dataDir, PUB_FILE);
  const kp = nacl.sign.keyPair();
  writeFileSync(privPath, Buffer.from(kp.secretKey).toString('base64'), { mode: 0o600 });
  writeFileSync(pubPath, Buffer.from(kp.publicKey).toString('base64'), { mode: 0o644 });
  return { publicKey: kp.publicKey, privateKey: kp.secretKey };
}

export function loadOrCreateKeys(dataDir: string): KeyPair {
  const privPath = join(dataDir, PRIV_FILE);
  const pubPath = join(dataDir, PUB_FILE);
  if (existsSync(privPath) && existsSync(pubPath)) {
    const secretKey = Buffer.from(readFileSync(privPath, 'utf8'), 'base64');
    const publicKey = Buffer.from(readFileSync(pubPath, 'utf8'), 'base64');
    return { publicKey: new Uint8Array(publicKey), privateKey: new Uint8Array(secretKey) };
  }
  return generateAndStoreKeys(dataDir);
}

export function signMessage(privateKey: Uint8Array, message: string): string {
  const msgBytes = Buffer.from(message, 'utf8');
  const signature = nacl.sign.detached(msgBytes, privateKey);
  return Buffer.from(signature).toString('base64');
}

export function getPublicKeyBase64(dataDir: string): string {
  const pubPath = join(dataDir, PUB_FILE);
  if (existsSync(pubPath)) {
    return readFileSync(pubPath, 'utf8').trim();
  }
  const kp = generateAndStoreKeys(dataDir);
  return Buffer.from(kp.publicKey).toString('base64');
}
