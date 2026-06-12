import { environment } from '../../../environments/environment';

// Defense-in-depth guard for full-page redirects (window.location.href).
// A URL is considered safe only if it resolves to
//   (a) the current origin (covers relative URLs like '/auth/start'), or
//   (b) an https URL whose host matches the configured backend host
//       (derived from environment.backendUrl, which may be relative).
// Everything else is rejected: javascript:, data:, cross-origin http:,
// foreign hosts, and protocol-relative URLs like //evil.com.
export function isSafeRedirectUrl(
  url: string,
  currentOrigin: string = window.location.origin,
  backendUrl: string = environment.backendUrl,
): boolean {
  let resolved: URL;
  try {
    // Resolve against the current origin so relative and protocol-relative
    // URLs are normalized before any checks run.
    resolved = new URL(url, currentOrigin);
  } catch {
    return false;
  }

  // Only plain web protocols are ever acceptable (rejects javascript:, data:, blob:, ...).
  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return false;

  // Same-origin is always fine (this is where relative URLs end up).
  if (resolved.origin === currentOrigin) return true;

  // Cross-origin: only https to the configured backend host is allowed.
  let backendHost: string;
  try {
    backendHost = new URL(backendUrl, currentOrigin).host;
  } catch {
    return false;
  }
  return resolved.protocol === 'https:' && resolved.host === backendHost;
}
