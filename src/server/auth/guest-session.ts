import crypto from 'node:crypto';

export const GUEST_SESSION_COOKIE = 'vacatina_guest';
const MAX_AGE_SECONDS = 30 * 86400;

export interface GuestSession {
  version: 1;
  id: string;
  csrf: string;
  expires: number;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export class GuestSessionManager {
  private secret: string;
  private secure: boolean;

  constructor(secret: string, secure: boolean = false) {
    if (secret.length < 32 || /placeholder|change.me|dev_jwt_secret/i.test(secret)) {
      throw new Error('SESSION_SIGNING_SECRET must contain at least 32 random characters');
    }
    this.secret = secret;
    this.secure = secure;
  }

  public create(nowSeconds: number = Math.floor(Date.now() / 1000)): GuestSession {
    return { version: 1, id: 'guest_' + crypto.randomUUID(), csrf: crypto.randomBytes(32).toString('base64url'), expires: nowSeconds + MAX_AGE_SECONDS };
  }

  public encode(session: GuestSession): string {
    const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
    return payload + '.' + crypto.createHmac('sha256', this.secret).update(payload).digest('base64url');
  }

  public decode(value: string | undefined, nowSeconds: number = Math.floor(Date.now() / 1000)): GuestSession | null {
    if (!value || value.length > 2048) return null;
    try {
      const [payload, signature, extra] = value.split('.');
      if (!payload || !signature || extra || !safeEqual(signature, crypto.createHmac('sha256', this.secret).update(payload).digest('base64url'))) return null;
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (data.version !== 1 || !/^guest_[a-f0-9-]{36}$/.test(data.id) || !/^[A-Za-z0-9_-]{43}$/.test(data.csrf) || !Number.isFinite(data.expires) || data.expires <= nowSeconds) return null;
      return data;
    } catch { return null; }
  }

  public resolve(cookieHeader: string | null): { session: GuestSession; setCookie?: string } {
    const value = cookieHeader?.split(';').map(part => part.trim()).find(part => part.startsWith(GUEST_SESSION_COOKIE + '='))?.slice(GUEST_SESSION_COOKIE.length + 1);
    const existing = this.decode(value);
    if (existing) return { session: existing };
    const session = this.create();
    return { session, setCookie: `${GUEST_SESSION_COOKIE}=${this.encode(session)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${this.secure ? '; Secure' : ''}` };
  }

  public verifyCsrf(session: GuestSession, value: string | null): boolean {
    return Boolean(value && safeEqual(session.csrf, value));
  }
}
