export type GeoCoords = { lat: number; lng: number };

export const DEFAULT_OFFICE_LAT = 12.91648;
export const DEFAULT_OFFICE_LNG = 77.618145;
export const DEFAULT_OFFICE_RADIUS = 100; // meters

function parseFiniteNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function haversineMeters(from: GeoCoords, to: GeoCoords): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(from.lat - to.lat);
  const dLon = toRad(from.lng - to.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(to.lat)) * Math.cos(toRad(from.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isLocationCheckEnabled(settings: any): boolean {
  if (process.env.ENABLE_LOCATION_CHECK === 'false') return false;
  if (process.env.ENABLE_LOCATION_CHECK === 'true') return true;
  if (settings?.enableLocationCheck === false) return false;
  return true; // Enforced by default
}

export function assertWithinOfficeGeofence(
  settings: any,
  coords: GeoCoords | null | undefined
): { ok: true; distance?: number } | { ok: false; error: string; distance?: number } {
  if (!isLocationCheckEnabled(settings)) {
    return { ok: true };
  }

  const officeLat = parseFiniteNumber(settings?.officeLatitude) ?? parseFiniteNumber(process.env.OFFICE_LATITUDE) ?? DEFAULT_OFFICE_LAT;
  const officeLng = parseFiniteNumber(settings?.officeLongitude) ?? parseFiniteNumber(process.env.OFFICE_LONGITUDE) ?? DEFAULT_OFFICE_LNG;
  const radius = parseFiniteNumber(settings?.officeRadiusMeters) ?? parseFiniteNumber(process.env.OFFICE_RADIUS_METERS) ?? DEFAULT_OFFICE_RADIUS;

  if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number' || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
    return {
      ok: false,
      error: 'Location required: Please allow location access in your browser to check in.',
    };
  }

  const distance = Math.round(haversineMeters(coords, { lat: officeLat, lng: officeLng }));

  if (distance > radius) {
    return {
      ok: false,
      distance,
      error: `Access Denied: You are ${distance}m away from the office. You must be within the ${radius}m office radius to check in.`,
    };
  }

  return { ok: true, distance };
}