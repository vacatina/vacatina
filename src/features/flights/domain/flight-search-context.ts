/* ============================================================================
 * Vacatina Flight Search Context
 * Keeps the most recent canonical search URL available to the offer detail
 * modal, the offer route and the local Trip Review workspace.
 * ============================================================================ */

let lastFlightSearchQuery = '';

export function rememberFlightSearchQuery(query: string): void {
  if (query) lastFlightSearchQuery = query;
}

export function getLastFlightSearchQuery(): string {
  return lastFlightSearchQuery || '/flights/search';
}
