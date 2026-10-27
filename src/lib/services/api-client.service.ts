/** Same-origin Vacatina API boundary. Never import server services into a browser. */
export class VacatinaApiError extends Error {
  public status: number;
  public code?: string;
  constructor(message: string, status: number, code?: string) { super(message); this.status = status; this.code = code; }
}

export interface VacatinaSession {
  sessionId: string;
  authenticated: boolean;
  csrfToken?: string;
  user?: { id: string; email?: string; role?: string };
  clerk?: { publishableKey?: string; frontendApi?: string };
  capabilities?: Record<string, unknown>;
}

let apiSessionPromise: Promise<VacatinaSession> | undefined;

export async function getApiSession(refresh = false): Promise<VacatinaSession> {
  if (refresh) apiSessionPromise = undefined;
  if (!apiSessionPromise) {
    apiSessionPromise = (async () => {
      const token = await getApiBearerToken();
      const response = await fetch('/api/v1/session', {
        credentials: 'same-origin', cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new VacatinaApiError('Your travel session could not be loaded. Please retry.', response.status);
      if (!response.headers.get('content-type')?.includes('json')) throw new VacatinaApiError('The travel service is temporarily unavailable. Please retry.', response.status, 'INVALID_API_RESPONSE');
      return response.json();
    })().catch(error => { apiSessionPromise = undefined; throw error; });
  }
  return apiSessionPromise;
}

async function getApiBearerToken(): Promise<string | undefined> {
  if (typeof window === 'undefined') return undefined;
  return window.Clerk?.session?.getToken?.();
}

export async function apiRequest<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  if (!path.startsWith('/api/v1/')) throw new Error('Only the Vacatina API can be requested.');
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = await getApiBearerToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const method = (options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !token) {
    const session = await getApiSession();
    if (session.csrfToken) headers.set('X-CSRF-Token', session.csrfToken);
  }
  let response: Response;
  try {
    response = await fetch(path, { ...options, method, headers, credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new VacatinaApiError('We could not reach the travel service. Check your connection and retry.', 0, 'NETWORK_UNAVAILABLE');
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('json')) throw new VacatinaApiError('The travel service is temporarily unavailable. Please retry.', response.status, 'INVALID_API_RESPONSE');
  const body = await response.json();
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) apiSessionPromise = undefined;
    throw new VacatinaApiError(body.detail || body.message || 'Your request could not be completed.', response.status, body.code);
  }
  return body as T;
}
