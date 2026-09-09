/**
 * crypto.randomUUID() is only exposed in secure contexts. localhost counts as one, but a
 * LAN address over plain HTTP (http://192.168.x.x:3001) does not — so reaching the dev
 * server from a phone or tablet would throw on the practice screen without this fallback.
 *
 * These ids are local IndexedDB record keys, never security tokens, so a non-cryptographic
 * fallback is adequate.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
