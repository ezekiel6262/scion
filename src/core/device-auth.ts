import type { LiveApi } from './live-api';

type StoredIdentity = { accountId: string; publicKey: CryptoKey; privateKey: CryptoKey };
export type LiveSession = { token: string; accountId: string; expiresAt: string };

const DB = 'scion-live-auth';
const STORE = 'identity';
const SESSION = 'scion.live.session';
const encoder = new TextEncoder();

const base58 = (bytes: Uint8Array) => {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let value = 0n;
  for (const byte of bytes) value = value * 256n + BigInt(byte);
  let out = '';
  while (value > 0) { out = alphabet[Number(value % 58n)] + out; value /= 58n; }
  for (const byte of bytes) { if (byte !== 0) break; out = `1${out}`; }
  return out || '1';
};

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

async function storedIdentity(): Promise<StoredIdentity | undefined> {
  const db = await openDb();
  return new Promise<StoredIdentity | undefined>((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get('primary');
    request.onsuccess = () => resolve(request.result as StoredIdentity | undefined);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

async function createIdentity(): Promise<StoredIdentity> {
  const generated = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const rawPublic = new Uint8Array(await crypto.subtle.exportKey('raw', generated.publicKey));
  const privateJwk = await crypto.subtle.exportKey('jwk', generated.privateKey);
  const privateKey = await crypto.subtle.importKey('jwk', privateJwk, { name: 'Ed25519' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', rawPublic));
  const accountId = `creator-${[...digest.slice(0, 6)].map((x) => x.toString(16).padStart(2, '0')).join('')}.near`;
  const identity = { accountId, publicKey: generated.publicKey, privateKey };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(identity, 'primary');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
  return identity;
}

export function restoredSession(): LiveSession | undefined {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION) ?? 'null') as LiveSession | null;
    return session && Date.parse(session.expiresAt) > Date.now() + 30_000 ? session : undefined;
  } catch { return undefined; }
}

export async function authenticateDevice(api: LiveApi): Promise<LiveSession> {
  const cached = restoredSession();
  if (cached) return cached;
  const identity = await storedIdentity() ?? await createIdentity();
  const rawPublic = new Uint8Array(await crypto.subtle.exportKey('raw', identity.publicKey));
  const challenge = await api.authChallenge(identity.accountId, `ed25519:${base58(rawPublic)}`);
  const signed = new Uint8Array(await crypto.subtle.sign('Ed25519', identity.privateKey, encoder.encode(challenge.message)));
  const signature = btoa(String.fromCharCode(...signed));
  const session = await api.authVerify(challenge.id, signature);
  localStorage.setItem(SESSION, JSON.stringify(session));
  return session;
}
