// Location Feature Module - Public API
// Contains location context, hooks, and types

// Context
export { LocationContext, LocationProvider, useLocation } from './LocationContext';
export type { LocationContextType, LocationPreferences } from './LocationContext';

// Hooks
export { useGeolocation } from './hooks/useGeolocation';
export type { UserLocation, LocationPermissionState } from './hooks/useGeolocation';
