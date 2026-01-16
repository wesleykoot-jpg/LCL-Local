import { Capacitor } from '@capacitor/core';
import {
  Geolocation,
  type GeolocationOptions,
  type PermissionState,
  type PermissionStatus,
  type Position,
} from '@capacitor/geolocation';

const AMSTERDAM_COORDINATES = {
  lat: 52.3676,
  lng: 4.9041,
  accuracy: 12,
};

const isTestEnvironment = () => {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return true;
  }
  return typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';
};

const toPermissionStatus = (state: PermissionState): PermissionStatus => ({
  location: state,
  coarseLocation: state,
});

const toPosition = (coords: { lat: number; lng: number; accuracy?: number }): Position => ({
  coords: {
    latitude: coords.lat,
    longitude: coords.lng,
    accuracy: coords.accuracy ?? 10,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: Date.now(),
});

const toPositionFromWeb = (position: GeolocationPosition): Position => ({
  coords: {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    altitude: position.coords.altitude,
    altitudeAccuracy: position.coords.altitudeAccuracy,
    heading: position.coords.heading,
    speed: position.coords.speed,
  },
  timestamp: position.timestamp,
});

const requestWebPosition = (options?: PositionOptions): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });

export const locationService = {
  isNativePlatform: () => Capacitor.isNativePlatform(),

  async checkPermissions(): Promise<PermissionStatus> {
    if (isTestEnvironment()) {
      return toPermissionStatus('granted');
    }
    if (Capacitor.isNativePlatform()) {
      return Geolocation.checkPermissions();
    }
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      return toPermissionStatus(status.state as PermissionState);
    }
    return toPermissionStatus('prompt');
  },

  async requestPermissions(): Promise<PermissionStatus> {
    if (isTestEnvironment()) {
      return toPermissionStatus('granted');
    }
    if (Capacitor.isNativePlatform()) {
      return Geolocation.requestPermissions();
    }
    try {
      await requestWebPosition();
      return toPermissionStatus('granted');
    } catch {
      return toPermissionStatus('denied');
    }
  },

  async getCurrentPosition(options?: GeolocationOptions): Promise<Position> {
    if (isTestEnvironment()) {
      return toPosition(AMSTERDAM_COORDINATES);
    }
    if (Capacitor.isNativePlatform()) {
      return Geolocation.getCurrentPosition(options);
    }
    const position = await requestWebPosition(options);
    return toPositionFromWeb(position);
  },

  async watchPosition(
    options: GeolocationOptions,
    callback: (position: Position | null, error?: { message: string }) => void,
  ): Promise<string> {
    if (isTestEnvironment()) {
      callback(toPosition(AMSTERDAM_COORDINATES));
      return 'test-watch';
    }
    if (Capacitor.isNativePlatform()) {
      return Geolocation.watchPosition(options, callback);
    }

    if (!navigator.geolocation) {
      callback(null, { message: 'Geolocation not supported' });
      return 'web-watch-unsupported';
    }

    const id = navigator.geolocation.watchPosition(
      position => callback(toPositionFromWeb(position)),
      error => callback(null, { message: error.message }),
      options,
    );

    return id.toString();
  },

  async clearWatch(watchId: string): Promise<void> {
    if (isTestEnvironment()) {
      return;
    }
    if (Capacitor.isNativePlatform()) {
      await Geolocation.clearWatch({ id: watchId });
      return;
    }
    const numericId = Number(watchId);
    if (!Number.isNaN(numericId) && navigator.geolocation) {
      navigator.geolocation.clearWatch(numericId);
    }
  },
};
