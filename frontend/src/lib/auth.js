import { AuthClient } from '@dfinity/auth-client';
import { writable } from 'svelte/store';

export const identity = writable(null);
export const isAuthenticated = writable(false);
export const principal = writable('');

let _authClient = null;

const II_URL =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? `http://localhost:4943?canisterId=rdmx6-jaaaa-aaaaa-aaadq-cai`
    : 'https://identity.ic0.app';

export async function initAuth() {
  _authClient = await AuthClient.create();
  const authed = await _authClient.isAuthenticated();
  if (authed) {
    _applyIdentity(_authClient.getIdentity());
  }
}

function _applyIdentity(id) {
  identity.set(id);
  isAuthenticated.set(true);
  principal.set(id.getPrincipal().toText());
}

export async function login() {
  if (!_authClient) _authClient = await AuthClient.create();
  return new Promise((resolve, reject) => {
    _authClient.login({
      identityProvider: II_URL,
      maxTimeToLive: BigInt(7 * 24 * 60 * 60 * 1_000_000_000), // 7 days
      onSuccess: () => {
        _applyIdentity(_authClient.getIdentity());
        resolve();
      },
      onError: reject,
    });
  });
}

export async function logout() {
  if (!_authClient) return;
  await _authClient.logout();
  identity.set(null);
  isAuthenticated.set(false);
  principal.set('');
}
