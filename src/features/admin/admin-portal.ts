import { adminWorkspaceHtml } from './admin-workspace.ts';
import { demoOpsEnabled, flightAdminConsoleHtml, wireFlightAdminConsole } from './flight-admin-console.ts';

/**
 * Renders the admin portal shell.
 *
 * Production path: real server-authorised workspace (admin-workspace.ts).
 * Isolated UI-acceptance path: deterministic demo fixture console, only when the
 * explicit local-only fixture has been enabled (see flight-admin-console.ts).
 */
export function renderAdminPortalHtml(activeTab = 'overview'): string {
  if (demoOpsEnabled()) {
    queueMicrotask(() => {
      const root = document.getElementById('flight-admin-console');
      if (root) wireFlightAdminConsole(root, activeTab);
    });
    return flightAdminConsoleHtml(activeTab);
  }
  return adminWorkspaceHtml();
}
