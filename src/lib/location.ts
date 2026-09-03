export interface LocationCoordinates {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface LocationResult {
  coords: LocationCoordinates | null;
  error?: string;
  isDenied?: boolean;
}

/**
 * Helper to obtain a fresh browser geolocation position with high accuracy.
 */
function fetchCurrentPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/**
 * Robust, high-speed helper to obtain browser geolocation coordinates.
 * Uses fresh cached fix (5s) for instant response (< 50ms), fast 4s high-accuracy attempt,
 * and quick standard fallback for laptops/desktops without dedicated GPS.
 */
export async function getBrowserLocation(): Promise<LocationResult> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return {
      coords: null,
      error: 'Geolocation is not supported by your browser.',
    };
  }

  // 1. Fast High Accuracy Fix (uses cache up to 5 seconds old for instant punch)
  try {
    const position = await fetchCurrentPosition({
      enableHighAccuracy: true,
      timeout: 4000,
      maximumAge: 5000,
    });

    return {
      coords: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy ?? 0,
      },
    };
  } catch (err: any) {
    // Error Code 1: PERMISSION_DENIED (User clicked "Block" / Deny)
    if (err?.code === 1) {
      return {
        coords: null,
        error: 'Location permission was denied. Please allow location access in your browser to check in.',
        isDenied: true,
      };
    }

    // 2. Fast Fallback: Standard network/Wi-Fi positioning (for laptops/desktops without dedicated GPS)
    try {
      const fallbackPosition = await fetchCurrentPosition({
        enableHighAccuracy: false,
        timeout: 3000,
        maximumAge: 10000,
      });

      return {
        coords: {
          lat: fallbackPosition.coords.latitude,
          lng: fallbackPosition.coords.longitude,
          accuracy: fallbackPosition.coords.accuracy ?? 0,
        },
      };
    } catch (fallbackErr: any) {
      if (fallbackErr?.code === 1) {
        return {
          coords: null,
          error: 'Location permission was denied. Please allow location access in your browser to check in.',
          isDenied: true,
        };
      }

      return {
        coords: null,
        error: 'Unable to retrieve your current location. Please check your device location settings.',
      };
    }
  }
}
