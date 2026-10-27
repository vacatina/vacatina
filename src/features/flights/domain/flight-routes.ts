/* ============================================================================
 * Vacatina Flights Route Ownership
 * The dedicated Flights product owns /flights and all /flights/* subroutes.
 * ============================================================================ */

export function isDedicatedFlightsPath(path: string): boolean {
  return path === '/flights' || path.startsWith('/flights/');
}

export function isFlightOfferPath(path: string): boolean {
  return path.startsWith('/flights/offer/');
}

export function flightOfferIdFromPath(path: string): string | null {
  if (!isFlightOfferPath(path)) return null;
  try {
    const offerId = decodeURIComponent(path.slice('/flights/offer/'.length)).split('/')[0];
    return offerId || null;
  } catch {
    return null;
  }
}
