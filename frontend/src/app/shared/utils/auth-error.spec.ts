import { describe, it, expect } from 'vitest';
import { authErrorMessage, stripAuthErrorParam } from './auth-error';

describe('authErrorMessage', () => {
  it('returns null when there is no auth_error param', () => {
    expect(authErrorMessage('')).toBeNull();
    expect(authErrorMessage('?foo=bar')).toBeNull();
  });

  it('maps access_denied to the cancellation message', () => {
    expect(authErrorMessage('?auth_error=access_denied')).toBe('Anmeldung abgebrochen');
  });

  it('maps any other code to the generic failure message', () => {
    expect(authErrorMessage('?auth_error=invalid_state')).toBe('Anmeldung fehlgeschlagen');
    expect(authErrorMessage('?auth_error=token_exchange_failed')).toBe('Anmeldung fehlgeschlagen');
    expect(authErrorMessage('?auth_error=auth_failed')).toBe('Anmeldung fehlgeschlagen');
  });
});

describe('stripAuthErrorParam', () => {
  it('removes only the auth_error param and keeps the path', () => {
    expect(stripAuthErrorParam('/', '?auth_error=access_denied', '')).toBe('/');
  });

  it('preserves other query params and the hash', () => {
    expect(stripAuthErrorParam('/calendar', '?auth_error=invalid_state&view=day', '#top')).toBe(
      '/calendar?view=day#top',
    );
  });
});
