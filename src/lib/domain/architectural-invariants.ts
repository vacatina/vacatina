/* ============================================================================
 * Vacatina Architectural Invariant Guard
 * Client-neutral error type so both the browser services and the server
 * inventory layer can throw the same class (preserving `instanceof`).
 * ============================================================================ */

export class ArchitecturalInvariantViolationError extends Error {
  public code: string;

  constructor(code: string, message: string) {
    super(`[ARCHITECTURAL_INVARIANT_VIOLATION:${code}] ${message}`);
    this.name = 'ArchitecturalInvariantViolationError';
    this.code = code;
  }
}
