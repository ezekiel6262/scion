// Real cryptography (WebCrypto). Nothing in this file is simulated.
// AES-256-GCM seals strategy sections; ECDSA P-256 signs capabilities, receipts
// and attestations; ECDH P-256 re-seals released views to one holder.

const te = new TextEncoder();
const td = new TextDecoder();
const subtle = globalThis.crypto.subtle;

export const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};
export const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Deterministic JSON with sorted keys, so signatures and hashes are reproducible. */
export function stable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  const o = v as Record<string, unknown>;
  return '{' + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}';
}

export async function sha256(input: string) {
  return hex(await subtle.digest('SHA-256', te.encode(input)));
}

export interface Sealed { iv: string; ct: string }

export const newDek = () => subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

export async function seal(key: CryptoKey, data: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(data)));
  return { iv: b64(iv), ct: b64(ct) };
}

export async function open<T = unknown>(key: CryptoKey, s: Sealed): Promise<T> {
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv) }, key, unb64(s.ct));
  return JSON.parse(td.decode(pt)) as T;
}

export const newSigner = () => subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as Promise<CryptoKeyPair>;

export async function sign(priv: CryptoKey, payload: unknown) {
  return b64(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, te.encode(stable(payload))));
}

export async function verify(pub: CryptoKey, payload: unknown, sig: string) {
  return subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, unb64(sig), te.encode(stable(payload)));
}

export const newBoxKeys = () => subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']) as Promise<CryptoKeyPair>;

export async function exportPub(k: CryptoKey) {
  return subtle.exportKey('jwk', k);
}

export interface Box { epk: JsonWebKey; sealed: Sealed }

/** Encrypt data so only the holder of `recipientPub`'s private key can read it. */
export async function boxFor(recipientPub: CryptoKey, data: unknown): Promise<Box> {
  const eph = await newBoxKeys();
  const k = await subtle.deriveKey({ name: 'ECDH', public: recipientPub }, eph.privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  return { epk: await exportPub(eph.publicKey), sealed: await seal(k, data) };
}

export async function unbox<T = unknown>(recipientPriv: CryptoKey, box: Box): Promise<T> {
  const epk = await subtle.importKey('jwk', box.epk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const k = await subtle.deriveKey({ name: 'ECDH', public: epk }, recipientPriv, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  return open<T>(k, box.sealed);
}

export const short = (s: string, n = 6) => (s.length <= n * 2 + 1 ? s : `${s.slice(0, n)}…${s.slice(-n)}`);
