/* ============================================================================
 * Vacatina Canonical Pricing Engine
 * Authority: Vacatina Hybrid Inventory Strategy v1.0 — Pricing Architecture
 *
 * Requirements:
 * 1. Multi-Layer Pricing:
 *    Supplier/Base Price -> Vacatina Markup -> Approved Manual Override -> Customer Selling Price.
 * 2. Raw Cost Integrity: Original supplier raw price and currency are NEVER overwritten.
 * 3. Percentage and Fixed-Amount Markups supported with rule metadata.
 * 4. Auditable Administrative Overrides: Tracks previous value, new value, reason,
 *    admin user, variance, and timestamp.
 * 5. Multi-Currency Support: Computes authoritative LKR base, and converts to requested
 *    customer viewing currency without altering the underlying contract.
 * 6. B2C Protection: Emits clean customer-facing selling price; does NOT expose
 *    supplier cost or markup breakdown to end travellers.
 * ============================================================================ */

import type { SupportedCurrency } from '../domain/types.ts';
import type {
  ManualPriceOverrideAudit,
  MarkupSpecification,
  MarkupType,
  PricingLayers
} from '../domain/inventory-models.ts';
import { CANONICAL_EXCHANGE_RATES_TO_LKR } from '../mock-data/catalog.ts';

export interface PricingCalculationInput {
  supplierRawBasePrice: number;
  supplierBaseCurrency: SupportedCurrency;
  markup: {
    type: MarkupType;
    value: number;
    ruleId?: string;
    ruleDescription?: string;
  };
  manualOverride?: {
    overrideId: string;
    newValueLkr: number;
    overrideReason: string;
    authorizedByUserId: string;
    authorizedByName: string;
    timestampIso?: string;
  };
  customerDisplayCurrency?: SupportedCurrency;
  isPromotionalRate?: boolean;
}

export class PricingEngineService {
  /**
   * Computes the 4-layer pricing structure for any inventory offer.
   */
  public static calculatePricing(input: PricingCalculationInput): PricingLayers {
    if (input.supplierRawBasePrice < 0) {
      throw new Error(`[PricingEngine] Raw supplier price cannot be negative: ${input.supplierRawBasePrice}`);
    }

    const supplierBaseCurrency = input.supplierBaseCurrency || 'LKR';
    const customerDisplayCurrency = input.customerDisplayCurrency || 'LKR';

    // 1. Layer 1: Supplier Base Price conversion to authoritative LKR
    const rateToLkr = CANONICAL_EXCHANGE_RATES_TO_LKR[supplierBaseCurrency] || 1;
    const supplierBasePriceLkr = Math.round(input.supplierRawBasePrice * rateToLkr);

    // 2. Layer 2: Vacatina Markup Calculation
    let markupAmountLkr = 0;
    if (input.markup.type === 'PERCENTAGE') {
      markupAmountLkr = Math.round(supplierBasePriceLkr * (input.markup.value / 100));
    } else if (input.markup.type === 'FIXED') {
      // Fixed markup is defined in LKR
      markupAmountLkr = Math.round(input.markup.value);
    } else if (input.markup.type === 'TIERED') {
      // Tiered markup logic: higher tiers receive lower percentage
      if (supplierBasePriceLkr > 500000) {
        markupAmountLkr = Math.round(supplierBasePriceLkr * 0.05); // 5% for high-ticket
      } else if (supplierBasePriceLkr > 100000) {
        markupAmountLkr = Math.round(supplierBasePriceLkr * 0.08); // 8% mid-ticket
      } else {
        markupAmountLkr = Math.round(supplierBasePriceLkr * 0.12); // 12% lower ticket
      }
    }

    const vacatinaMarkup: MarkupSpecification = {
      type: input.markup.type,
      value: input.markup.value,
      amountLkr: markupAmountLkr,
      ruleId: input.markup.ruleId || 'DEFAULT_STANDARD_MARGIN',
      ruleDescription: input.markup.ruleDescription || 'Standard Vacatina Commercial Margin'
    };

    const calculatedSubtotalLkr = supplierBasePriceLkr + markupAmountLkr;

    // 3. Layer 3: Auditable Administrative Override (if approved)
    let manualOverrideAudit: ManualPriceOverrideAudit | undefined;
    let finalCustomerSellingPriceLkr = calculatedSubtotalLkr;

    if (input.manualOverride) {
      if (input.manualOverride.newValueLkr < 0) {
        throw new Error(`[PricingEngine] Manual override price cannot be negative: ${input.manualOverride.newValueLkr}`);
      }
      manualOverrideAudit = {
        overrideId: input.manualOverride.overrideId,
        previousValueLkr: calculatedSubtotalLkr,
        newValueLkr: Math.round(input.manualOverride.newValueLkr),
        varianceLkr: Math.round(input.manualOverride.newValueLkr - calculatedSubtotalLkr),
        overrideReason: input.manualOverride.overrideReason,
        authorizedByUserId: input.manualOverride.authorizedByUserId,
        authorizedByName: input.manualOverride.authorizedByName,
        timestampIso: input.manualOverride.timestampIso || new Date().toISOString()
      };
      finalCustomerSellingPriceLkr = manualOverrideAudit.newValueLkr;
    }

    // 4. Layer 4: Customer Display Currency Conversion
    const targetCurrencyRate = CANONICAL_EXCHANGE_RATES_TO_LKR[customerDisplayCurrency] || 1;
    const customerSellingPriceDisplay =
      customerDisplayCurrency === 'LKR'
        ? finalCustomerSellingPriceLkr
        : Math.round((finalCustomerSellingPriceLkr / targetCurrencyRate) * 100) / 100;

    return {
      supplierRawBasePrice: input.supplierRawBasePrice,
      supplierBaseCurrency,
      exchangeRateToBase: rateToLkr,
      supplierBasePriceLkr,
      vacatinaMarkup,
      manualOverride: manualOverrideAudit,
      customerSellingPriceLkr: finalCustomerSellingPriceLkr,
      customerDisplayCurrency,
      customerSellingPriceDisplay,
      isPromotionalRate: Boolean(input.isPromotionalRate)
    };
  }

  /**
   * Applies an administrative price override to an existing pricing structure with full audit logging.
   */
  public static applyAdminOverride(
    existing: PricingLayers,
    newValueLkr: number,
    reason: string,
    authorizedByUserId: string,
    authorizedByName: string
  ): PricingLayers {
    if (newValueLkr < 0) {
      throw new Error(`[PricingEngine] Override value cannot be negative: ${newValueLkr}`);
    }

    const previousSellingPriceLkr = existing.customerSellingPriceLkr;
    const overrideAudit: ManualPriceOverrideAudit = {
      overrideId: `ovr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      previousValueLkr: previousSellingPriceLkr,
      newValueLkr: Math.round(newValueLkr),
      varianceLkr: Math.round(newValueLkr - previousSellingPriceLkr),
      overrideReason: reason,
      authorizedByUserId,
      authorizedByName,
      timestampIso: new Date().toISOString()
    };

    const targetCurrencyRate = CANONICAL_EXCHANGE_RATES_TO_LKR[existing.customerDisplayCurrency] || 1;
    const customerSellingPriceDisplay =
      existing.customerDisplayCurrency === 'LKR'
        ? overrideAudit.newValueLkr
        : Math.round((overrideAudit.newValueLkr / targetCurrencyRate) * 100) / 100;

    return {
      ...existing,
      manualOverride: overrideAudit,
      customerSellingPriceLkr: overrideAudit.newValueLkr,
      customerSellingPriceDisplay
    };
  }

  /**
   * Convert display currency without modifying the underlying LKR or supplier price.
   */
  public static switchDisplayCurrency(
    pricing: PricingLayers,
    newCurrency: SupportedCurrency
  ): PricingLayers {
    const targetCurrencyRate = CANONICAL_EXCHANGE_RATES_TO_LKR[newCurrency] || 1;
    const customerSellingPriceDisplay =
      newCurrency === 'LKR'
        ? pricing.customerSellingPriceLkr
        : Math.round((pricing.customerSellingPriceLkr / targetCurrencyRate) * 100) / 100;

    return {
      ...pricing,
      customerDisplayCurrency: newCurrency,
      customerSellingPriceDisplay
    };
  }
}
