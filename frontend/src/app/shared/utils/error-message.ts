export function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    // HttpErrorResponse: try parsed body first, then message
    if (e['error'] && typeof e['error'] === 'object') {
      const body = e['error'] as Record<string, unknown>;
      if (typeof body['error'] === 'string') return body['error'];
      if (typeof body['message'] === 'string') return body['message'];
    }
    if (typeof e['status'] === 'number' && typeof e['statusText'] === 'string') {
      const url = typeof e['url'] === 'string' ? ` (${e['url']})` : '';
      return `HTTP ${e['status']}: ${e['statusText']}${url}`;
    }
    if (typeof e['message'] === 'string') return e['message'];
  }
  return String(err);
}
