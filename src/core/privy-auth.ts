import Privy, { LocalStorage, create as createWallet } from '@privy-io/js-sdk-core';

type PrivyUser = {
  linked_accounts?: Array<{ type?: string; chain_type?: string }>;
};

const appId = import.meta.env.VITE_PRIVY_APP_ID?.trim();
const clientId = import.meta.env.VITE_PRIVY_APP_CLIENT_ID?.trim();
let client: Privy | undefined;
let initialized: Promise<Privy> | undefined;

export const privyAuthStatus = () => ({ configured: Boolean(appId && clientId) });

export function privyClient() {
  if (!appId || !clientId) throw new Error('Scion email login is awaiting its production auth client.');
  client ??= new Privy({ appId, clientId, storage: new LocalStorage() });
  initialized ??= client.initialize().then(() => client!);
  return initialized;
}

const hasNearWallet = (user: unknown) => Boolean((user as PrivyUser | null)?.linked_accounts?.some((account) => account.type === 'wallet' && account.chain_type === 'near'));

export async function ensurePrivyNearWallet(privy: Privy, user: unknown) {
  if (hasNearWallet(user)) return user;
  await createWallet(
    {
      fetchPrivyRoute: privy.fetchPrivyRoute.bind(privy),
      getCompiledPath: privy.getCompiledPath.bind(privy),
      app: { appId: privy.app.appId },
    },
    { request: { chain_type: 'near' } },
  );
  const refreshed = await privy.user.get();
  if (!hasNearWallet(refreshed.user)) throw new Error('Your embedded NEAR wallet could not be created. Please try again.');
  return refreshed.user;
}

export async function sendEmailCode(email: string) {
  const privy = await privyClient();
  await privy.auth.email.sendCode(email.trim());
}

export async function verifyEmailCode(email: string, code: string) {
  const privy = await privyClient();
  const result = await privy.auth.email.loginWithCode(email.trim(), code.trim());
  return ensurePrivyNearWallet(privy, result.user);
}

export async function restorePrivyUser() {
  if (!privyAuthStatus().configured) return undefined;
  try {
    const privy = await privyClient();
    const result = await privy.user.get();
    return result.user ? ensurePrivyNearWallet(privy, result.user) : undefined;
  } catch {
    return undefined;
  }
}

export async function logoutPrivy() {
  if (!client) return;
  await client.auth.logout().catch(() => undefined);
}
