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
 * Robust helper to obtain fresh browser geolocation coordinates.
 * Incorporates accurate GPS accuracy metadata and a smart 2-step retry mechanism
 * to eliminate stale cached positions and temporary GPS drift glitches.
 */
export async function getBrowserLocation(): Promise<LocationResult> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return {
      coords: null,
      error: 'Geolocation is not supported by your browser.',
    };
  }

  // 1. First Attempt: Fresh High Accuracy fix (maximumAge: 0)
  try {
    const position = await fetchCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });

    const accuracy = position.coords.accuracy ?? 0;

    // If initial high-accuracy reading has high uncertainty (> 120m), do a quick 1-time refinement retry
    if (accuracy > 120) {
      try {
        const refinedPosition = await fetchCurrentPosition({
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 0,
        });

        const refinedAccuracy = refinedPosition.coords.accuracy ?? accuracy;
        const bestPosition = refinedAccuracy < accuracy ? refinedPosition : position;

        return {
          coords: {
            lat: bestPosition.coords.latitude,
            lng: bestPosition.coords.longitude,
            accuracy: bestPosition.coords.accuracy,
          },
        };
      } catch {
        // Fall back to the first valid position if refinement times out
        return {
          coords: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy,
          },
        };
      }
    }

    return {
      coords: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy,
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

    // 2. Attempt 2: Quick High-Accuracy Retry for temporary timeouts or hardware delay
    try {
      const retryPosition = await fetchCurrentPosition({
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      });

      return {
        coords: {
          lat: retryPosition.coords.latitude,
          lng: retryPosition.coords.longitude,
          accuracy: retryPosition.coords.accuracy,
        },
      };
    } catch (retryErr: any) {
      if (retryErr?.code === 1) {
        return {
          coords: null,
          error: 'Location permission was denied. Please allow location access in your browser to check in.',
          isDenied: true,
        };
      }

      // 3. Fallback: Fast standard network location (for laptops/desktops without dedicated GPS)
      try {
        const fallbackPosition = await fetchCurrentPosition({
          enableHighAccuracy: false,
          timeout: 6000,
          maximumAge: 5000,
        });

        return {
          coords: {
            lat: fallbackPosition.coords.latitude,
            lng: fallbackPosition.coords.longitude,
            accuracy: fallbackPosition.coords.accuracy,
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
}
