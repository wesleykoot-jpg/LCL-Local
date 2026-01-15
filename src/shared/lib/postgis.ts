export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Converts lat/lng into PostGIS POINT string with lng first.
 * Returns POINT(0 0) and fallback flag when coordinates are missing or zeroed.
 */
export function toPostgisPoint(coords?: Coordinates | null): { point: string; isFallback: boolean } {
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
    return { point: 'POINT(0 0)', isFallback: true };
  }

  const isZero = Math.abs(coords.lat) < 1e-6 && Math.abs(coords.lng) < 1e-6;
  return { point: `POINT(${coords.lng} ${coords.lat})`, isFallback: isZero };
}
