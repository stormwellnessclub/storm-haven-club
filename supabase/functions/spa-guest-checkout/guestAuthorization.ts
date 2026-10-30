/** Recognize public-client credentials, never authenticate a user from JWT contents.
 * An anonymous classification grants only the existing guest capability flow.
 * Every other bearer token must still pass auth.getUser().
 */
export function isGuestAuthorization(token: string | undefined, anonKey: string | undefined): boolean {
  if (!token || token === anonKey || token.startsWith('sb_publishable_')) return true;
  try {
    const encoded = token.split('.')[1];
    if (!encoded) return false;
    const payload = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role === 'anon' && !payload.sub;
  } catch {
    return false;
  }
}