/* ============================================================================
 * Vacatina 4-Layer Pricing Precedence Engine
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md (Q13) & ADR-006
 *
 * Mathematical Rule:
 * Final Selling Price = Layer 4 (if override present & active)
 *                     || (Layer 1 + Layer 2 Platform Margin + Layer 3 Agency Adjustment)
 *
 * All operations execute in integer minor currency units (cents / cents of rupee).
 * ============================================================================ */

import type { PricingLayersEntity, TravelProductSlug } from '../types.ts';

export interface CalculatePricingInput {
  productType: TravelProductSlug;
  rawSupplierCostMinor: number;
  rawCurrency: string;
  targetCurrency?: string;
  organizationTier?: 'STANDARD_B2C' | 'BRONZE' | 'SILVER' | 'GOLD';
  agencyCustomMarkupPercent?: number;
  manualOverrideMinor?: number;
  overrideReason?: string;
  overrideExpiresAtIso?: string;
}

export class PricingPrecedenceService {
  /**
   * Configurable commercial markup policies (Layer 2).
   * Controlled dynamically by authorized Admin / Finance roles without redeploying code.
   */
  private static dynamicMarkupRules: Partial<Record<TravelProductSlug, number>> = {};
  private static dynamicFixedFees: Record<string, number> = {};

  /**
   * Baseline default platform markup percentages by product category (Fallback defaults).
   */
  private static readonly PLATFORM_MARKUP_PERCENT: Record<TravelProductSlug, number> = {
    flights: 5.5,
    hotels: 12.0,
    packages: 10.0,
    cars: 8.0,
    rails: 6.0,
    cruises: 9.0,
    activities: 14.0,
    sightseeing: 12.5,
    insurance: 15.0,
    visa: 0.0 // Visa uses fixed service fee instead of percentage
  };

  /**
   * Baseline default fixed fee minor units for products with flat service rates.
   */
  private static readonly FIXED_FEE_MINOR: Record<string, number> = {
    visa_service_fee_minor: 1250000 // LKR 12,500.00 minor
  };

  /**
   * Sets a dynamic commercial markup percentage for a product vertical.
   */
  public static setCommercialMarkupPolicy(productType: TravelProductSlug, percent: number): void {
    if (percent < 0 || percent > 100) {
      throw new Error(`Invalid markup percentage: ${percent}. Must be between 0 and 100.`);
    }
    this.dynamicMarkupRules[productType] = percent;
  }

  /**
   * Sets a dynamic fixed fee in minor currency units for flat service products.
   */
  public static setCommercialFixedFeePolicy(feeKey: string, feeMinor: number): void {
    if (feeMinor < 0) {
      throw new Error(`Invalid fee minor: ${feeMinor}. Cannot be negative.`);
    }
    this.dynamicFixedFees[feeKey] = feeMinor;
  }

  /**
   * Resets dynamic policies to baseline defaults (used in testing/staging).
   */
  public static resetCommercialPolicies(): void {
    this.dynamicMarkupRules = {};
    this.dynamicFixedFees = {};
  }

  /**
   * Retrieves active commercial policy rate for transparency and auditing.
   */
  public static getActiveCommercialPolicy(productType: TravelProductSlug): {
    markupPercent: number;
    isDynamicOverride: boolean;
  } {
    const isDynamic = this.dynamicMarkupRules[productType] !== undefined;
    const markupPercent = isDynamic
      ? this.dynamicMarkupRules[productType]!
      : (this.PLATFORM_MARKUP_PERCENT[productType] || 8.0);
    return { markupPercent, isDynamicOverride: isDynamic };
  }

  /**
   * B2B preferential tier commission discount percentage (Layer 3)
   */
  private static readonly TIER_DISCOUNT_PERCENT: Record<string, number> = {
    STANDARD_B2C: 0.0,
    BRONZE: 0.5,
    SILVER: 2.0,
    GOLD: 3.5
  };

  public static calculatePricing(input: CalculatePricingInput): PricingLayersEntity {
    const rawSupplierCostMinor = Math.round(input.rawSupplierCostMinor);
    const currency = input.targetCurrency || input.rawCurrency || 'LKR';

    // Layer 2: Platform Base B2C Margin (Evaluates dynamic Finance policy before baseline default)
    let platformMarkupMinor = 0;
    if (input.productType === 'visa') {
      platformMarkupMinor = this.dynamicFixedFees.visa_service_fee_minor ?? this.FIXED_FEE_MINOR.visa_service_fee_minor;
    } else {
      const markupRate = this.dynamicMarkupRules[input.productType] ?? (this.PLATFORM_MARKUP_PERCENT[input.productType] || 8.0);
      platformMarkupMinor = Math.round(rawSupplierCostMinor * (markupRate / 100));
    }

    // Layer 3: B2B Agency Tier Adjustment
    let b2bAgencyMarginMinor = 0;
    if (input.organizationTier && input.organizationTier !== 'STANDARD_B2C') {
      const tierDiscountRate = this.TIER_DISCOUNT_PERCENT[input.organizationTier] || 0;
      const agencyDiscountMinor = Math.round(rawSupplierCostMinor * (tierDiscountRate / 100));
      
      // If agency configured their own additional markup to client
      const agencyCustomRate = input.agencyCustomMarkupPercent || 0;
      const agencyCustomMarkupMinor = Math.round(rawSupplierCostMinor * (agencyCustomRate / 100));
      
      b2bAgencyMarginMinor = agencyCustomMarkupMinor - agencyDiscountMinor;
    }

    // Calculated baseline before override
    const standardTotalMinor = rawSupplierCostMinor + platformMarkupMinor + b2bAgencyMarginMinor;

    // Layer 4: Admin Manual Override
    let finalSellingPriceMinor = standardTotalMinor;
    let activeOverrideMinor: number | undefined = undefined;
    let activeOverrideReason: string | undefined = undefined;

    if (input.manualOverrideMinor !== undefined && input.manualOverrideMinor > 0) {
      const isExpired = input.overrideExpiresAtIso && new Date(input.overrideExpiresAtIso).getTime() < Date.now();
      if (!isExpired) {
        activeOverrideMinor = Math.round(input.manualOverrideMinor);
        activeOverrideReason = input.overrideReason || 'Administrative promotional override';
        finalSellingPriceMinor = activeOverrideMinor; // Layer 4 takes authoritative precedence
      }
    }

    return {
      rawSupplierCostMinor,
      rawCurrency: input.rawCurrency,
      platformMarkupMinor,
      b2bAgencyMarginMinor,
      manualOverrideMinor: activeOverrideMinor,
      overrideReason: activeOverrideReason,
      finalSellingPriceMinor,
      currency
    };
  }
}
