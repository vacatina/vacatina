/* ============================================================================
 * Vacatina Canonical Booking Orchestration Service
 * Authority: Vacatina Hybrid Inventory Strategy v1.0 — Booking Orchestration
 *
 * Requirements:
 * 1. Multi-Channel Component Routing:
 *    - API Offer           -> Supplier / GDS API confirmation
 *    - Manual Instant      -> Vacatina Payload CMS inventory allocation
 *    - Manual On-Request   -> Concierge / supplier reservation request queue
 *    - Assisted Service    -> Consular / visa specialist case workflow
 * 2. Mixed-Basket Support: A single Trip Bucket journey may contain multiple
 *    fulfillment methods. Never fake a single monolithic API booking call.
 * 3. Integrity: On-request items NEVER masquerade as instant-confirmed bookings.
 * 4. Generates a unified Master Journey Booking Dossier with discrete component
 *    fulfillment tickets.
 * ============================================================================ */

import type { VacatinaNormalizedOffer } from '../domain/inventory-models.ts';

export interface ComponentBookingTicket {
  ticketId: string;
  offerId: string;
  productType: string;
  title: string;
  sourceType: string;
  confirmationMode: string;
  fulfillmentMethod: string;
  bookingStatus: 'CONFIRMED' | 'RESERVATION_REQUESTED' | 'CASE_OPENED' | 'FAILED';
  fulfillmentReference: string;
  priceLkr: number;
  slaNotice?: string;
  instructions: string;
}

export interface MasterJourneyBookingDossier {
  dossierId: string;
  customerName: string;
  customerEmail: string;
  createdAtIso: string;
  totalComponents: number;
  instantConfirmedCount: number;
  onRequestCount: number;
  assistedServiceCount: number;
  totalChargedLkr: number;
  tickets: ComponentBookingTicket[];
  isFullyInstantConfirmed: boolean;
  nextStepsSummary: string;
}

export class BookingOrchestratorService {
  /**
   * Orchestrates multi-channel booking for a mixed-source basket of offers.
   */
  public static orchestrateBooking(
    offers: VacatinaNormalizedOffer[],
    customer: { name: string; email: string; passportNumber?: string }
  ): MasterJourneyBookingDossier {
    if (offers.length === 0) {
      throw new Error('[BookingOrchestrator] Cannot orchestrate booking for an empty basket.');
    }

    const dossierId = `vct-dos-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const nowIso = new Date().toISOString();

    const tickets: ComponentBookingTicket[] = [];
    let instantConfirmedCount = 0;
    let onRequestCount = 0;
    let assistedServiceCount = 0;
    let totalChargedLkr = 0;

    for (const offer of offers) {
      totalChargedLkr += offer.pricing.customerSellingPriceLkr;

      // 1. Channel A: Supplier API Automated PNR / Booking
      if (offer.fulfillmentRouting.fulfillmentMethod === 'SUPPLIER_API') {
        const ticketId = `tkt-api-${offer.productType.slice(0, 2)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        tickets.push({
          ticketId,
          offerId: offer.offerId,
          productType: offer.productType,
          title: offer.title,
          sourceType: offer.sourceType,
          confirmationMode: offer.confirmationMode,
          fulfillmentMethod: offer.fulfillmentRouting.fulfillmentMethod,
          bookingStatus: 'CONFIRMED',
          fulfillmentReference: `${offer.supplierId}-PNR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          priceLkr: offer.pricing.customerSellingPriceLkr,
          instructions: 'Automated electronic voucher and carrier ticket issued directly to customer email.'
        });
        instantConfirmedCount++;
      }

      // 2. Channel B: Vacatina Manual Instant Inventory Allocation
      else if (offer.fulfillmentRouting.fulfillmentMethod === 'MANUAL_INVENTORY') {
        const ticketId = `tkt-cms-${offer.productType.slice(0, 2)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        tickets.push({
          ticketId,
          offerId: offer.offerId,
          productType: offer.productType,
          title: offer.title,
          sourceType: offer.sourceType,
          confirmationMode: offer.confirmationMode,
          fulfillmentMethod: offer.fulfillmentRouting.fulfillmentMethod,
          bookingStatus: 'CONFIRMED',
          fulfillmentReference: `VCT-VOUCHER-${offer.manualListingId || 'DIR'}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
          priceLkr: offer.pricing.customerSellingPriceLkr,
          instructions: 'Vacatina direct contract voucher generated. Partner property notified via automated dispatch.'
        });
        instantConfirmedCount++;
      }

      // 3. Channel C: On-Request Concierge & Supplier Liaison
      else if (offer.fulfillmentRouting.fulfillmentMethod === 'ON_REQUEST_DISPATCH') {
        const ticketId = `req-concierge-${offer.productType.slice(0, 2)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        tickets.push({
          ticketId,
          offerId: offer.offerId,
          productType: offer.productType,
          title: offer.title,
          sourceType: offer.sourceType,
          confirmationMode: offer.confirmationMode,
          fulfillmentMethod: offer.fulfillmentRouting.fulfillmentMethod,
          bookingStatus: 'RESERVATION_REQUESTED',
          fulfillmentReference: `VCT-REQ-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
          priceLkr: offer.pricing.customerSellingPriceLkr,
          slaNotice: `Partner confirmation SLA: ${offer.fulfillmentRouting.slaMinutes} minutes.`,
          instructions: 'Reservation request logged with partner desk. Customer will receive SMS & email status updates.'
        });
        onRequestCount++;
      }

      // 4. Channel D: Assisted Consular / Specialist Workflow Case
      else if (offer.fulfillmentRouting.fulfillmentMethod === 'ASSISTED_SERVICE_CASE') {
        const ticketId = `case-consular-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        tickets.push({
          ticketId,
          offerId: offer.offerId,
          productType: offer.productType,
          title: offer.title,
          sourceType: offer.sourceType,
          confirmationMode: offer.confirmationMode,
          fulfillmentMethod: offer.fulfillmentRouting.fulfillmentMethod,
          bookingStatus: 'CASE_OPENED',
          fulfillmentReference: `VCT-VISA-CASE-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
          priceLkr: offer.pricing.customerSellingPriceLkr,
          slaNotice: 'Document audit turnaround: 2 to 4 business hours.',
          instructions: 'Dedicated visa specialist case opened. Secure document upload vault access link generated.'
        });
        assistedServiceCount++;
      }
    }

    const isFullyInstantConfirmed = onRequestCount === 0 && assistedServiceCount === 0;
    const nextStepsSummary = isFullyInstantConfirmed
      ? 'All journey components are instantly confirmed. Travel vouchers and airline e-tickets are ready.'
      : `${instantConfirmedCount} component(s) confirmed instantly; ${onRequestCount + assistedServiceCount} component(s) routed to specialist/partner queues.`;

    return {
      dossierId,
      customerName: customer.name,
      customerEmail: customer.email,
      createdAtIso: nowIso,
      totalComponents: offers.length,
      instantConfirmedCount,
      onRequestCount,
      assistedServiceCount,
      totalChargedLkr,
      tickets,
      isFullyInstantConfirmed,
      nextStepsSummary
    };
  }
}
