declare module 'tweetnacl' {
  export interface KeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
  }
  export function sign(msg: Uint8Array, secretKey: Uint8Array): Uint8Array;
  export namespace sign {
    export function keyPair(): KeyPair;
    export function keyPairFromSecretKey(secretKey: Uint8Array): KeyPair;
    export function detached(msg: Uint8Array, secretKey: Uint8Array): Uint8Array;
    export namespace detached {
      export function verify(msg: Uint8Array, sig: Uint8Array, publicKey: Uint8Array): boolean;
    }
    export function open(signedMsg: Uint8Array, publicKey: Uint8Array): Uint8Array | null;
  }
  export function randomBytes(n: number): Uint8Array;
}
