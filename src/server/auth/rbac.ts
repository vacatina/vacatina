/* ============================================================================
 * Vacatina Tenant-Aware Authorization & RBAC Engine
 * Authority: docs/11_PRODUCTION_IMPLEMENTATION_CHARTER.md & ADR-003
 * Deny-by-default permission evaluation with strict organization boundary checks.
 * ============================================================================ */

import type { UserRole, UUID } from '../db/schema.ts';

export interface SecurityContext {
  userId: UUID;
  email: string;
  role: UserRole;
  organizationId?: UUID;
  organizationType?: 'AGENCY' | 'CORPORATE' | 'SUPPLIER' | 'PLATFORM';
  isElevatedMfa?: boolean;
}

export type PermissionSlug =
  // Customer & Profile
  | 'traveller:read_own'
  | 'traveller:write_own'
  | 'trip:manage_own'
  | 'booking:view_own'
  | 'visa:apply_own'
  
  // B2B Partner Agency
  | 'agency:view_dashboard'
  | 'agency:manage_clients'
  | 'agency:create_quote'
  | 'agency:manage_bookings'
  | 'agency:view_commissions'
  | 'agency:request_payout'
  | 'agency:manage_team'
  | 'agency:configure_markups'
  
  // Backoffice Operations & Support
  | 'ops:triage_queue'
  | 'ops:reconcile_booking'
  | 'ops:override_booking_status'
  | 'ops:view_tickets'
  | 'ops:resolve_ticket'
  
  // Finance & Refunds
  | 'finance:view_ledger'
  | 'finance:authorize_refund'
  | 'finance:reconcile_gateway'
  
  // Visa Desk
  | 'visa:review_application'
  | 'visa:verify_documents'
  | 'visa:update_consular_status'
  
  // CMS & Content (Separation of Duties - Directive 8 & Operational Governance)
  | 'cms:edit_listings'
  | 'cms:verify_commercial'
  | 'cms:approve_pricing'
  | 'cms:publish_listings'
  | 'cms:manage_promotions'
  
  // Platform Super-Admin
  | 'platform:full_audit'
  | 'platform:configure_adapters'
  | 'platform:system_admin';

// Static Role Permission Matrix (Deny by default)
const ROLE_PERMISSIONS: Record<UserRole, PermissionSlug[]> = {
  CUSTOMER: [
    'traveller:read_own',
    'traveller:write_own',
    'trip:manage_own',
    'booking:view_own',
    'visa:apply_own'
  ],
  BOOKING_AGENT: [
    'agency:view_dashboard',
    'agency:manage_clients',
    'agency:create_quote',
    'agency:manage_bookings',
    'agency:view_commissions'
  ],
  AGENCY_MANAGER: [
    'agency:view_dashboard',
    'agency:manage_clients',
    'agency:create_quote',
    'agency:manage_bookings',
    'agency:view_commissions',
    'agency:configure_markups'
  ],
  AGENCY_OWNER: [
    'agency:view_dashboard',
    'agency:manage_clients',
    'agency:create_quote',
    'agency:manage_bookings',
    'agency:view_commissions',
    'agency:request_payout',
    'agency:manage_team',
    'agency:configure_markups'
  ],
  CORPORATE_COORDINATOR: [
    'agency:view_dashboard',
    'agency:manage_clients',
    'agency:create_quote',
    'agency:manage_bookings'
  ],
  SUPPLIER_USER: [
    'ops:triage_queue'
  ],
  SUPPORT_STAFF: [
    'ops:triage_queue',
    'ops:view_tickets',
    'ops:resolve_ticket',
    'booking:view_own'
  ],
  FINANCE_OPS: [
    'finance:view_ledger',
    'finance:authorize_refund',
    'finance:reconcile_gateway',
    'ops:triage_queue',
    'cms:approve_pricing'
  ],
  CONTENT_MARKETING: [
    'cms:edit_listings',
    'cms:manage_promotions'
  ],
  ANALYTICS: [
    'agency:view_commissions',
    'finance:view_ledger'
  ],
  PLATFORM_ADMIN: [
    'traveller:read_own',
    'traveller:write_own',
    'trip:manage_own',
    'booking:view_own',
    'visa:apply_own',
    'agency:view_dashboard',
    'agency:manage_clients',
    'agency:create_quote',
    'agency:manage_bookings',
    'agency:view_commissions',
    'agency:request_payout',
    'agency:manage_team',
    'agency:configure_markups',
    'ops:triage_queue',
    'ops:reconcile_booking',
    'ops:override_booking_status',
    'ops:view_tickets',
    'ops:resolve_ticket',
    'finance:view_ledger',
    'finance:authorize_refund',
    'finance:reconcile_gateway',
    'visa:review_application',
    'visa:verify_documents',
    'visa:update_consular_status',
    'cms:edit_listings',
    'cms:verify_commercial',
    'cms:approve_pricing',
    'cms:publish_listings',
    'cms:manage_promotions',
    'platform:full_audit',
    'platform:configure_adapters',
    'platform:system_admin'
  ]
};

export class AuthorizationEngine {
  /**
   * Evaluates if the authenticated subject holds the required permission.
   */
  public static hasPermission(context: SecurityContext, permission: PermissionSlug): boolean {
    const granted = ROLE_PERMISSIONS[context.role] || [];
    return granted.includes(permission);
  }

  /**
   * Enforces that the requested resource belongs to the subject's active organization.
   * Catastrophic defect prevention: Blocks cross-tenant data leakage.
   */
  public static assertTenantOwnership(
    context: SecurityContext,
    resourceOrganizationId?: UUID
  ): boolean {
    if (context.role === 'PLATFORM_ADMIN') return true; // Super-admin bypass with audit
    if (!context.organizationId) {
      // B2C Customer context cannot access tenant resources
      return !resourceOrganizationId;
    }
    return context.organizationId === resourceOrganizationId;
  }

  /**
   * Unified Policy Guard: Checks both role permission and tenant ownership.
   */
  public static authorizeResourceAccess(
    context: SecurityContext,
    permission: PermissionSlug,
    resourceOrganizationId?: UUID
  ): { allowed: boolean; reason?: string } {
    if (!this.hasPermission(context, permission)) {
      return { allowed: false, reason: `Forbidden: Role '${context.role}' lacks permission '${permission}'` };
    }
    if (!this.assertTenantOwnership(context, resourceOrganizationId)) {
      return { allowed: false, reason: `Forbidden: Tenant mismatch. Access to organization '${resourceOrganizationId}' denied` };
    }
    return { allowed: true };
  }
}

export { authenticateClerkRequest, verifyClerkJwt, mapClerkPayloadToSecurityContext } from './clerk-verifier.ts';
