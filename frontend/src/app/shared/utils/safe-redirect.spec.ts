import { describe, it, expect } from 'vitest';
import { isSafeRedirectUrl } from './safe-redirect';

const ORIGIN = 'https://app.example.com';

describe('isSafeRedirectUrl', () => {
  describe('safe URLs', () => {
    it('accepts relative URLs (resolve to the current origin)', () => {
      expect(isSafeRedirectUrl('/auth/start', ORIGIN, '')).toBe(true);
      expect(isSafeRedirectUrl('/api/auth/start', ORIGIN, '/api')).toBe(true);
      expect(isSafeRedirectUrl('auth/start', ORIGIN, '')).toBe(true);
    });

    it('accepts absolute same-origin URLs', () => {
      expect(isSafeRedirectUrl('https://app.example.com/auth/start', ORIGIN, '')).toBe(true);
      expect(isSafeRedirectUrl('https://app.example.com/api/auth/start?x=1', ORIGIN, '/api')).toBe(true);
    });

    it('accepts https URLs on the configured backend host', () => {
      expect(
        isSafeRedirectUrl('https://backend.example.com/auth/start', ORIGIN, 'https://backend.example.com'),
      ).toBe(true);
    });

    it('accepts http same-origin URLs in a local dev context', () => {
      expect(isSafeRedirectUrl('http://localhost:4200/auth/start', 'http://localhost:4200', '')).toBe(true);
    });
  });

  describe('malicious or unexpected URLs', () => {
    it('rejects javascript: URLs', () => {
      expect(isSafeRedirectUrl('javascript:alert(1)', ORIGIN, '')).toBe(false);
      expect(isSafeRedirectUrl('JavaScript:alert(1)', ORIGIN, '')).toBe(false);
    });

    it('rejects data: URLs', () => {
      expect(isSafeRedirectUrl('data:text/html,<script>alert(1)</script>', ORIGIN, '')).toBe(false);
    });

    it('rejects cross-origin http: URLs', () => {
      expect(isSafeRedirectUrl('http://app.example.com/auth/start', ORIGIN, '')).toBe(false);
      expect(isSafeRedirectUrl('http://evil.com/auth/start', ORIGIN, '')).toBe(false);
    });

    it('rejects https URLs on foreign hosts', () => {
      expect(isSafeRedirectUrl('https://evil.com/auth/start', ORIGIN, '')).toBe(false);
      expect(
        isSafeRedirectUrl('https://evil.com/auth/start', ORIGIN, 'https://backend.example.com'),
      ).toBe(false);
    });

    it('rejects protocol-relative URLs to foreign hosts', () => {
      expect(isSafeRedirectUrl('//evil.com/auth/start', ORIGIN, '')).toBe(false);
    });

    it('rejects an http backend even when configured (https required cross-origin)', () => {
      expect(
        isSafeRedirectUrl('http://backend.example.com/auth/start', ORIGIN, 'http://backend.example.com'),
      ).toBe(false);
    });

    it('rejects unparseable input', () => {
      expect(isSafeRedirectUrl('https://', ORIGIN, '')).toBe(false);
    });
  });
});
