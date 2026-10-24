/* ============================================================================
 * Vacatina Search Command Center & AI Intent Service
 * Authorities:
 * - 01_PRODUCT_ARCHITECTURE.md (11 Tabs in Locked Order)
 * - 03_FUNCTIONAL_FLOWS.md
 * ============================================================================ */

import type {
  CommandCenterTabId,
  SupportedCurrency,
  TravellerCounts
} from '../domain/types.ts';
import { validateAndNormalizeTravellers } from '../validation/travellers.ts';

export const LOCKED_11_TAB_ORDER: Array<{
  id: CommandCenterTabId;
  domTabId: string;
  domPanelId: string;
  label: string;
  isOrchestration?: boolean;
}> = [
  { id: 'bundle', domTabId: 'tab-bundle', domPanelId: 'panel-bundle', label: 'Build Your Bundle', isOrchestration: true },
  { id: 'flights', domTabId: 'tab-flights', domPanelId: 'panel-flights', label: 'Flights' },
  { id: 'hotels', domTabId: 'tab-hotels', domPanelId: 'panel-hotels', label: 'Hotels' },
  { id: 'visa', domTabId: 'tab-visa', domPanelId: 'panel-visa', label: 'Visa Assistance' },
  { id: 'packages', domTabId: 'tab-packages', domPanelId: 'panel-packages', label: 'Holiday Packages' },
  { id: 'cars', domTabId: 'tab-cars', domPanelId: 'panel-cars', label: 'Cars & Transfers' },
  { id: 'rails', domTabId: 'tab-rails', domPanelId: 'panel-rails', label: 'Rails' },
  { id: 'cruises', domTabId: 'tab-cruises', domPanelId: 'panel-cruises', label: 'Cruises' },
  { id: 'activities', domTabId: 'tab-activities', domPanelId: 'panel-activities', label: 'Activities' },
  { id: 'sightseeing', domTabId: 'tab-sightseeing', domPanelId: 'panel-sightseeing', label: 'Sightseeing Tours' },
  { id: 'insurance', domTabId: 'tab-insurance', domPanelId: 'panel-insurance', label: 'Travel Insurance' }
];

export interface SearchStateSnapshot {
  activeTab: CommandCenterTabId;
  currency: SupportedCurrency;
  travellers: TravellerCounts;
  flights: {
    tripType: 'round-trip' | 'one-way' | 'multi-city';
    from: string;
    to: string;
    departureDate: string;
    returnDate: string;
    directOnly: boolean;
  };
  bundle: {
    origin: string;
    destination: string;
    dateWindow: string;
    components: string[];
  };
  hotels: {
    destination: string;
    checkIn: string;
    checkOut: string;
  };
  visa: {
    country: string;
    citizenship: string;
    residence: string;
    travelDate: string;
    purpose: string;
  };
  packages: {
    destination: string;
    departureCity: string;
    travelWindow: string;
    packageType: string;
  };
  cars: {
    serviceType: string;
    pickup: string;
    dropoff: string;
    pickupDateTime: string;
  };
  rails: {
    fromStation: string;
    toStation: string;
    departureDate: string;
    railClass: string;
  };
  cruises: {
    region: string;
    departurePort: string;
    travelWindow: string;
    cabinPreference: string;
    duration: string;
  };
  activities: {
    destination: string;
    date: string;
    category: string;
  };
  sightseeing: {
    destination: string;
    date: string;
    tourType: string;
  };
  insurance: {
    region: string;
    residence: string;
    tripStart: string;
    tripEnd: string;
    coverageType: string;
  };
}

export class SearchCommandService {
  private state: SearchStateSnapshot = {
    activeTab: 'flights',
    currency: 'LKR',
    travellers: {
      adults: 1,
      children: 0,
      infants: 0,
      cabin: 'Economy',
      rooms: 1
    },
    flights: {
      tripType: 'round-trip',
      from: 'Colombo (CMB) — Bandaranaike',
      to: 'London (LHR) — Heathrow Airport',
      departureDate: '12 Nov 2026',
      returnDate: '27 Nov 2026',
      directOnly: false
    },
    bundle: {
      origin: 'Colombo (CMB)',
      destination: 'London (LHR), United Kingdom',
      dateWindow: '12 Nov 2026 – 27 Nov 2026',
      components: ['Flights', 'Hotels', 'Visa Assistance']
    },
    hotels: {
      destination: 'London, Greater London, United Kingdom',
      checkIn: '13 Nov 2026',
      checkOut: '20 Nov 2026'
    },
    visa: {
      country: 'United Kingdom',
      citizenship: 'Sri Lanka (LKA)',
      residence: 'Sri Lanka',
      travelDate: '12 Nov 2026',
      purpose: 'Tourism / Leisure'
    },
    packages: {
      destination: 'Maldives / Male Atoll',
      departureCity: 'Colombo (CMB)',
      travelWindow: 'Dec 2026',
      packageType: 'Luxury Getaway'
    },
    cars: {
      serviceType: 'Airport Transfer',
      pickup: 'Heathrow Airport (LHR)',
      dropoff: 'Central London Hotel',
      pickupDateTime: '12 Nov 2026 · 14:30'
    },
    rails: {
      fromStation: 'London St Pancras',
      toStation: 'Paris Gare du Nord',
      departureDate: '18 Nov 2026',
      railClass: 'Standard Class'
    },
    cruises: {
      region: 'Mediterranean Eastern',
      departurePort: 'Athens (Piraeus)',
      travelWindow: 'May – Oct 2027',
      cabinPreference: 'Balcony Stateroom',
      duration: '7 Nights'
    },
    activities: {
      destination: 'Dubai, United Arab Emirates',
      date: '15 Nov 2026',
      category: 'Desert Safari & Adventure'
    },
    sightseeing: {
      destination: 'London, United Kingdom',
      date: '16 Nov 2026',
      tourType: 'Guided Group & Landmark Pass'
    },
    insurance: {
      region: 'Worldwide (incl. USA & UK)',
      residence: 'Sri Lanka',
      tripStart: '12 Nov 2026',
      tripEnd: '27 Nov 2026',
      coverageType: 'Single Trip Comprehensive'
    }
  };

  private listeners: Set<(state: SearchStateSnapshot) => void> = new Set();

  public getState(): SearchStateSnapshot {
    return JSON.parse(JSON.stringify(this.state));
  }

  public subscribe(listener: (state: SearchStateSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snap = this.getState();
    this.listeners.forEach(fn => fn(snap));
  }

  public setActiveTab(tabId: CommandCenterTabId): void {
    this.state.activeTab = tabId;
    this.emit();
  }

  public setCurrency(currency: SupportedCurrency): void {
    this.state.currency = currency;
    this.emit();
  }

  public updateTravellers(partial: Partial<TravellerCounts>): {
    adjusted: TravellerCounts;
    notice: string | null;
    errors: string[];
  } {
    const merged = { ...this.state.travellers, ...partial };
    const result = validateAndNormalizeTravellers(merged);
    this.state.travellers = result.adjusted;
    this.emit();
    return {
      adjusted: result.adjusted,
      notice: result.notice,
      errors: result.errors
    };
  }

  public swapFlightOriginDestination(): { from: string; to: string } {
    const prevFrom = this.state.flights.from;
    this.state.flights.from = this.state.flights.to;
    this.state.flights.to = prevFrom;
    this.emit();
    return { from: this.state.flights.from, to: this.state.flights.to };
  }

  public prefillTab(tabId: CommandCenterTabId, updates: Record<string, string>): void {
    this.state.activeTab = tabId;
    switch (tabId) {
      case 'flights':
        if (updates.from) this.state.flights.from = updates.from;
        if (updates.to) this.state.flights.to = updates.to;
        break;
      case 'hotels':
        if (updates.destination) this.state.hotels.destination = updates.destination;
        break;
      case 'visa':
        if (updates.country) this.state.visa.country = updates.country;
        break;
      case 'packages':
        if (updates.destination) this.state.packages.destination = updates.destination;
        break;
      case 'cars':
        if (updates.pickup) this.state.cars.pickup = updates.pickup;
        if (updates.serviceType) this.state.cars.serviceType = updates.serviceType;
        break;
      case 'rails':
        if (updates.fromStation) this.state.rails.fromStation = updates.fromStation;
        if (updates.toStation) this.state.rails.toStation = updates.toStation;
        break;
      case 'cruises':
        if (updates.region) this.state.cruises.region = updates.region;
        break;
      case 'activities':
        if (updates.destination) this.state.activities.destination = updates.destination;
        break;
      case 'sightseeing':
        if (updates.destination) this.state.sightseeing.destination = updates.destination;
        break;
      case 'insurance':
        if (updates.region) this.state.insurance.region = updates.region;
        break;
      case 'bundle':
        if (updates.destination) this.state.bundle.destination = updates.destination;
        break;
    }
    this.emit();
  }

  /**
   * Parses an natural-language prompt from `✦ Ask Vacatina` into a structured Bundle prefill.
   */
  public parseAiPromptToBundle(promptText: string): {
    destination: string;
    components: string[];
    summary: string;
  } {
    const text = (promptText || '').toLowerCase();
    let destination = 'Dubai (DXB), United Arab Emirates';
    if (text.includes('maldives') || text.includes('male')) {
      destination = 'Malé (MLE), Maldives';
    } else if (text.includes('london') || text.includes('uk')) {
      destination = 'London (LHR), United Kingdom';
    } else if (text.includes('bali')) {
      destination = 'Bali (DPS), Indonesia';
    } else if (text.includes('bangkok') || text.includes('thailand')) {
      destination = 'Bangkok (BKK), Thailand';
    } else if (text.includes('singapore')) {
      destination = 'Singapore (SIN)';
    }

    const components: string[] = ['Flights', 'Hotels'];
    if (text.includes('visa') || !text.includes('no visa')) components.push('Visa Assistance');
    if (text.includes('transfer') || text.includes('car') || text.includes('airport')) components.push('Cars & Transfers');
    if (text.includes('safari') || text.includes('activity') || text.includes('activities')) components.push('Activities');
    if (text.includes('tour') || text.includes('sightseeing')) components.push('Sightseeing Tours');
    if (text.includes('insurance')) components.push('Travel Insurance');

    this.state.activeTab = 'bundle';
    this.state.bundle.destination = destination;
    this.state.bundle.components = components;
    this.emit();

    return {
      destination,
      components,
      summary: `Configured Bundle for ${destination} (${components.join(' + ')})`
    };
  }
}

export const searchCommandService = new SearchCommandService();
