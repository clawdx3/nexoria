import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as nacl from 'tweetnacl';

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

const PRIV_FILE = 'ed25519_private_key.pem';
const PUB_FILE = 'ed25519_public_key.pem';

export function generateAndStoreKeys(dataDir: string): KeyPair {
  mkdirSync(dataDir, { recursive: true });
  const kp = nacl.sign.keyPair();
  writeFileSync(join(dataDir, PRIV_FILE), Buffer.from(kp.secretKey).toString('base64'), { mode: 0o600 });
  writeFileSync(join(dataDir, PUB_FILE), Buffer.from(kp.publicKey).toString('base64'), { mode: 0o644 });
  return { publicKey: kp.publicKey, privateKey: kp.secretKey };
}

export function loadOrCreateKeys(dataDir: string): KeyPair {
  const privPath = join(dataDir, PRIV_FILE);
  const pubPath = join(dataDir, PUB_FILE);
  if (existsSync(privPath) && existsSync(pubPath)) {
    return {
      publicKey: new Uint8Array(Buffer.from(readFileSync(pubPath, 'utf8'), 'base64')),
      privateKey: new Uint8Array(Buffer.from(readFileSync(privPath, 'utf8'), 'base64')),
    };
  }
  return generateAndStoreKeys(dataDir);
}

export function signMessage(privateKey: Uint8Array, message: string): string {
  return Buffer.from(nacl.sign.detached(Buffer.from(message, 'utf8'), privateKey)).toString('base64');
}

export function getPublicKeyBase64(dataDir: string): string {
  const pubPath = join(dataDir, PUB_FILE);
  if (existsSync(pubPath)) return readFileSync(pubPath, 'utf8').trim();
  return Buffer.from(generateAndStoreKeys(dataDir).publicKey).toString('base64');
}
