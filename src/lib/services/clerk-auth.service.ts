/* ============================================================================
 * Vacatina Clerk Authentication & Identity Provider Service
 * Authority: docs/vacatina-frontend-backend-contract.md (Section 17) & ADR-003
 *
 * Responsibilities:
 * - Initializes ClerkJS client SDK using production publishable key.
 * - Bridges Clerk identity (user profile, email, avatar, roles) with Vacatina shell state.
 * - Provides openSignIn(), openSignUp(), openUserProfile(), and signOut() controls.
 * - Enforces zero dead-ends: if Clerk SDK fails to load (offline/adblock),
 *   gracefully falls back to Vacatina's internal authentication modal.
 * ============================================================================ */

export interface ClerkUserSnapshot {
  id: string;
  name: string;
  shortName: string;
  email: string;
  avatarUrl?: string;
  initials: string;
  roleLabel: string;
  organizationId?: string;
  organizationName?: string;
  organizationRole?: string;
}

export interface ClerkConfig {
  publishableKey: string;
  frontendApi: string;
  scriptUrl: string;
}

declare const __VACATINA_PUBLIC_DEMO_BUILD__: boolean;
const publicDemoBuild = typeof __VACATINA_PUBLIC_DEMO_BUILD__ !== 'undefined' && __VACATINA_PUBLIC_DEMO_BUILD__;
const publicDemo = () => publicDemoBuild || (typeof document !== 'undefined' && document.documentElement.dataset.vacatinaDemo === 'true');
export const CLERK_DEFAULT_CONFIG: ClerkConfig = publicDemoBuild ? { publishableKey:'',frontendApi:'',scriptUrl:'' } : {
  publishableKey: '',
  frontendApi: '',
  scriptUrl: ''
};

declare global {
  interface Window {
    Clerk?: any;
    __VACATINA_CLERK__?: ClerkAuthService;
  }
}

export class ClerkAuthService {
  private config: ClerkConfig;
  private isLoaded = false;
  private isLoading = false;
  private currentUser: ClerkUserSnapshot | null = null;
  private listeners: Array<(user: ClerkUserSnapshot | null) => void> = [];

  constructor(customConfig?: Partial<ClerkConfig>) {
    this.config = {
      ...CLERK_DEFAULT_CONFIG,
      ...customConfig
    };
  }

  public getConfig(): ClerkConfig {
    return { ...this.config };
  }

  public isReady(): boolean {
    return !publicDemo() && this.isLoaded && typeof window !== 'undefined' && Boolean(window.Clerk);
  }

  public isConfigured(): boolean {
    return Boolean(this.config.publishableKey && this.config.publishableKey.startsWith('pk_'));
  }

  public getCurrentUser(): ClerkUserSnapshot | null {
    return this.currentUser ? { ...this.currentUser } : null;
  }

  public subscribe(listener: (user: ClerkUserSnapshot | null) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(user: ClerkUserSnapshot | null): void {
    this.currentUser = user;
    for (const listener of this.listeners) {
      try {
        listener(user);
      } catch (err) {
        console.error('[ClerkAuthService] Listener notification error:', err);
      }
    }
  }

  /**
   * Initializes Clerk client-side SDK.
   * Loads the ClerkJS script if not already present on the page.
   */
  public async init(publishableKey?: string, frontendApi?: string): Promise<boolean> {
    if (publicDemo()) return false;
    if (typeof window === 'undefined') return false;
    if (this.isLoaded) return true;
    if (this.isLoading) return false;

    // Read from DOM if not provided
    if (!publishableKey) {
      const script = document.querySelector('script[data-clerk-publishable-key]');
      if (script) publishableKey = script.getAttribute('data-clerk-publishable-key') || undefined;
    }
    if (publishableKey) this.config.publishableKey = publishableKey;
    if (!frontendApi && this.config.publishableKey) {
      try {
        const domain = Buffer.from(this.config.publishableKey.split('_').slice(2).join('_'), 'base64').toString('utf8').replace(/\$$/, '');
        if (/^[a-z0-9.-]+$/i.test(domain)) frontendApi = 'https://' + domain;
      } catch {}
    }
    if (frontendApi) {
      this.config.frontendApi = frontendApi;
      this.config.scriptUrl = `${frontendApi.replace(/\/$/, '')}/npm/@clerk/clerk-js@latest/dist/clerk.browser.js`;
    }

    this.isLoading = true;

    try {
      // 1. Ensure ClerkJS script tag exists
      await this.ensureScriptLoaded();

      // 2. Initialize Clerk instance
      if (window.Clerk) {
        if (!window.Clerk.loaded) {
          await window.Clerk.load({
            publishableKey: this.config.publishableKey
          });
        }

        this.isLoaded = true;
        this.isLoading = false;

        // 3. Sync existing session if signed in
        this.syncClerkSession(window.Clerk.user);

        // 4. Attach session listener for live auth transitions
        if (typeof window.Clerk.addListener === 'function') {
          window.Clerk.addListener((payload: any) => {
            this.syncClerkSession(payload?.user || window.Clerk?.user);
          });
        }

        console.log('[Vacatina Auth] ClerkJS initialized successfully with instance:', this.config.frontendApi);
        return true;
      }

      this.isLoading = false;
      return false;
    } catch (err) {
      console.warn('[Vacatina Auth] ClerkJS initialization deferred or blocked (falling back to native auth):', (err as Error).message);
      this.isLoading = false;
      return false;
    }
  }

  private ensureScriptLoaded(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') return resolve();
      if (window.Clerk) return resolve();

      const existingScript = document.querySelector<HTMLScriptElement>(`script[src*="@clerk/clerk-js"]`);
      if (existingScript) {
        if (existingScript.getAttribute('data-loaded') === 'true' || window.Clerk) {
          return resolve();
        }
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', (e) => reject(e));
        return;
      }

      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = this.config.scriptUrl;
      script.setAttribute('data-clerk-publishable-key', this.config.publishableKey);

      const timeout = setTimeout(() => {
        reject(new Error('ClerkJS script load timeout (3000ms)'));
      }, 3000);

      script.onload = () => {
        clearTimeout(timeout);
        script.setAttribute('data-loaded', 'true');
        resolve();
      };

      script.onerror = (err) => {
        clearTimeout(timeout);
        reject(new Error('Failed to load ClerkJS script'));
      };

      document.head.appendChild(script);
    });
  }

  private syncClerkSession(clerkUser: any): void {
    if (clerkUser) {
      const email = clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress || 'traveller@vacatina.com';
      const fullName = (clerkUser.fullName || `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim()) || 'Verified Traveller';
      const shortName = clerkUser.firstName || fullName.split(' ')[0] || 'Traveller';
      const initials = (clerkUser.firstName && clerkUser.lastName)
        ? `${clerkUser.firstName[0]}${clerkUser.lastName[0]}`.toUpperCase()
        : fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'VT';

      const activeOrg = (typeof window !== 'undefined' && window.Clerk?.organization) || clerkUser.organization;
      const orgId = activeOrg?.id;
      const orgName = activeOrg?.name;
      const orgRole = activeOrg?.membership?.role;

      const roleLabel = orgName
        ? `${orgName} · Partner Agency`
        : 'Verified B2C Traveller (Clerk)';

      const snapshot: ClerkUserSnapshot = {
        id: clerkUser.id,
        name: fullName,
        shortName,
        email,
        avatarUrl: clerkUser.imageUrl,
        initials,
        roleLabel,
        organizationId: orgId,
        organizationName: orgName,
        organizationRole: orgRole
      };

      this.notify(snapshot);

      // Automatically sync to Vacatina OS shell state
      if (typeof window !== 'undefined' && (window as any).__VACATINA_OS__?.setSignedInState) {
        (window as any).__VACATINA_OS__.setSignedInState(true, false, {
          name: fullName,
          email,
          userId: clerkUser.id
        });
      }

      // Mount Clerk Organization Switcher if container is present
      this.mountOrganizationSwitcher('clerk-organization-switcher');
    } else {
      this.notify(null);
      this.unmountOrganizationSwitcher('clerk-organization-switcher');
      if (typeof window !== 'undefined' && (window as any).__VACATINA_OS__?.setSignedInState) {
        const currentState = (window as any).__VACATINA_OS__.getAuthState?.();
        if (currentState?.isSignedIn) {
          (window as any).__VACATINA_OS__.setSignedInState(false, false);
        }
      }
    }
  }

  /**
   * Opens Clerk Sign In modal.
   * If Clerk is unavailable, executes fallbackCallback or opens native modal.
   */
  public async openSignIn(options?: { redirectUrl?: string }, fallbackCallback?: () => void): Promise<void> {
    if (publicDemo()) return;
    if (this.isReady()) {
      try {
        await window.Clerk.openSignIn({
          afterSignInUrl: options?.redirectUrl || window.location.href,
          redirectUrl: options?.redirectUrl || window.location.href
        });
        return;
      } catch (e) {
        console.warn('[Vacatina Auth] Clerk openSignIn failed, falling back:', (e as Error).message);
      }
    }

    // Try initializing once on-demand
    if (!this.isLoaded) {
      const initialized = await this.init();
      if (initialized && this.isReady()) {
        try {
          await window.Clerk.openSignIn(options);
          return;
        } catch {}
      }
    }

    // Execute fallback
    if (fallbackCallback) {
      fallbackCallback();
    }
  }

  /**
   * Opens Clerk Sign Up modal.
   */
  public async openSignUp(options?: { redirectUrl?: string }, fallbackCallback?: () => void): Promise<void> {
    if (publicDemo()) return;
    if (this.isReady()) {
      try {
        await window.Clerk.openSignUp({
          afterSignUpUrl: options?.redirectUrl || window.location.href,
          redirectUrl: options?.redirectUrl || window.location.href
        });
        return;
      } catch (e) {
        console.warn('[Vacatina Auth] Clerk openSignUp failed, falling back:', (e as Error).message);
      }
    }

    if (!this.isLoaded) {
      const initialized = await this.init();
      if (initialized && this.isReady()) {
        try {
          await window.Clerk.openSignUp(options);
          return;
        } catch {}
      }
    }

    if (fallbackCallback) {
      fallbackCallback();
    }
  }

  /**
   * Opens Clerk User Profile modal.
   */
  public openUserProfile(): void {
    if (this.isReady() && typeof window.Clerk.openUserProfile === 'function') {
      window.Clerk.openUserProfile();
    }
  }

  /**
   * Mounts Clerk OrganizationSwitcher into target element.
   */
  public mountOrganizationSwitcher(target: HTMLElement | string, options?: any): void {
    if (!this.isReady() || typeof window.Clerk.mountOrganizationSwitcher !== 'function') return;
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (el) {
      try {
        window.Clerk.mountOrganizationSwitcher(el, {
          appearance: {
            variables: {
              colorPrimary: '#1B1464',
              colorText: '#1B1464',
              borderRadius: '0.75rem'
            }
          },
          ...options
        });
      } catch (err) {
        console.warn('[ClerkAuthService] OrganizationSwitcher mount deferred:', err);
      }
    }
  }

  /**
   * Unmounts Clerk OrganizationSwitcher.
   */
  public unmountOrganizationSwitcher(target: HTMLElement | string): void {
    if (!this.isReady() || typeof window.Clerk.unmountOrganizationSwitcher !== 'function') return;
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (el) {
      try {
        window.Clerk.unmountOrganizationSwitcher(el);
      } catch {}
    }
  }

  /**
   * Opens Clerk Organization Profile modal for team invitations and member management.
   */
  public openOrganizationProfile(): void {
    if (this.isReady() && typeof window.Clerk.openOrganizationProfile === 'function') {
      window.Clerk.openOrganizationProfile();
    }
  }

  /**
   * Opens Clerk Create Organization modal.
   */
  public openCreateOrganization(): void {
    if (this.isReady() && typeof window.Clerk.openCreateOrganization === 'function') {
      window.Clerk.openCreateOrganization();
    }
  }

  /**
   * Signs out of Clerk and clears session.
   */
  public async signOut(): Promise<void> {
    if (this.isReady() && typeof window.Clerk.signOut === 'function') {
      try {
        await window.Clerk.signOut();
      } catch (e) {
        console.warn('[Vacatina Auth] Clerk signOut error:', (e as Error).message);
      }
    }
    this.notify(null);
    if (typeof window !== 'undefined' && (window as any).__VACATINA_OS__?.setSignedInState) {
      (window as any).__VACATINA_OS__.setSignedInState(false, true);
    }
  }

  /**
   * Retrieves active Clerk JWT session token for API authorization.
   */
  public async getToken(): Promise<string | null> {
    if (this.isReady() && window.Clerk.session) {
      try {
        return await window.Clerk.session.getToken();
      } catch {
        return null;
      }
    }
    return null;
  }
}

export const clerkAuthService = new ClerkAuthService();
if (typeof window !== 'undefined') {
  window.__VACATINA_CLERK__ = clerkAuthService;
}
