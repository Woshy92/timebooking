// Maps the backend's coarse-grained ?auth_error=<code> redirect parameter to a
// German, user-facing message. Returns null when there is no auth error.
export function authErrorMessage(search: string): string | null {
  const code = new URLSearchParams(search).get('auth_error');
  if (!code) return null;
  return code === 'access_denied' ? 'Anmeldung abgebrochen' : 'Anmeldung fehlgeschlagen';
}

// Builds a URL string with the auth_error parameter stripped, preserving any
// other query params and the hash. Intended for history.replaceState.
export function stripAuthErrorParam(pathname: string, search: string, hash: string): string {
  const params = new URLSearchParams(search);
  params.delete('auth_error');
  const query = params.toString();
  return pathname + (query ? `?${query}` : '') + hash;
}
