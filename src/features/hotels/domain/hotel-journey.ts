import type { CanonicalHotelOffer, HotelSelectedConfiguration } from './hotel-models.ts';
import type { HotelSearchRequest } from './hotel-search-models.ts';
import { isJourneyDate, journeyEscape } from '../../journeys/domain/journey-models.ts';

export const HOTEL_DEMO_DISCLOSURE = 'Property, ratings, room, meal plan, cancellation terms and prices are planning references, not verified hotel inventory. No supplier is connected and no room is held.';
export const hotelEscape = journeyEscape;

export function hotelDemoOffer(hotel: CanonicalHotelOffer): CanonicalHotelOffer {
  return { ...hotel, inventoryMode: 'demo_fixture' };
}

export function parseHotelQuery(query: URLSearchParams): HotelSearchRequest {
  return {
    searchId: `hotel-search-${Date.now()}`,
    destination: query.get('destination') ?? query.get('to') ?? 'Bentota',
    checkInDate: query.get('checkIn') ?? query.get('checkin') ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    checkOutDate: query.get('checkOut') ?? query.get('checkout') ?? new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
    occupancy: { rooms: Number(query.get('rooms') ?? 1), adults: Number(query.get('adults') ?? 2), children: Number(query.get('children') ?? 0) }
  };
}

export function validateHotelSearch(request: HotelSearchRequest): string[] {
  const errors: string[] = [];
  if (!request.destination.trim()) errors.push('Enter a destination.');
  if (!isJourneyDate(request.checkInDate) || request.checkInDate < new Date().toISOString().slice(0, 10)) errors.push('Choose a valid future check-in date.');
  if (!isJourneyDate(request.checkOutDate) || request.checkOutDate <= request.checkInDate) errors.push('Check-out must be after check-in.');
  const { rooms, adults, children } = request.occupancy;
  if (![rooms, adults, children].every(Number.isInteger) || rooms < 1 || rooms > 8 || adults < rooms || adults > 16 || children < 0 || children > 8) errors.push('Choose 1–8 rooms, at least one adult per room, up to 16 adults and 8 children.');
  return errors;
}

export function hotelQuery(request: HotelSearchRequest): string {
  return new URLSearchParams({ destination: request.destination, checkIn: request.checkInDate, checkOut: request.checkOutDate, ...Object.fromEntries(Object.entries(request.occupancy).filter(([key]) => key !== 'childAges').map(([key, value]) => [key, String(value)])) }).toString();
}

export function validateHotelConfiguration(hotel: CanonicalHotelOffer, config: HotelSelectedConfiguration): void {
  const room = hotel.roomCategories.find(r => r.roomId === config.roomId);
  const plan = room?.ratePlans.find(p => p.planId === config.planId);
  const errors = validateHotelSearch({ searchId: '', destination: hotel.location.city, checkInDate: config.checkInDate, checkOutDate: config.checkOutDate, occupancy: { rooms: config.roomsCount, adults: config.adultsCount, children: config.childrenCount } });
  if (!room || !plan || hotel.hotelId !== config.hotelId || hotel.canonicalOfferId !== config.canonicalOfferId) errors.push('Choose a canonical room and rate for this property.');
  if (room && (config.adultsCount > room.maxAdults * config.roomsCount || config.childrenCount > room.maxChildren * config.roomsCount || config.adultsCount + config.childrenCount > room.maxOccupancy * config.roomsCount)) errors.push('This room category cannot accommodate your party.');
  if (errors.length) throw new Error(errors.join(' '));
}
