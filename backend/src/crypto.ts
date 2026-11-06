import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const id = (prefix: string) => `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
export const hash = (value: unknown) => createHash('sha256').update(typeof value === 'string' ? value : stable(value)).digest('hex');
export const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  return JSON.stringify(value);
};
export const signToken = (payload: string, secret: string) => `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
export const verifyToken = (token: string, secret: string) => {
  const index = token.lastIndexOf('.'); if (index < 1) return null;
  const payload = token.slice(0, index), signature = token.slice(index + 1);
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return payload;
};
