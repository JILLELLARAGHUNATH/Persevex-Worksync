export interface LocationCoordinates {
  lat: number;
  lng: number;
}

export interface LocationResult {
  coords: LocationCoordinates | null;
  error?: string;
  isDenied?: boolean;
}

/**
 * Robust helper to obtain browser geolocation coordinates with a generous user interaction timeout
 * and automatic fast fallback to low-accuracy/cached network location if high-accuracy times out.
 */
export async function getBrowserLocation(): Promise<LocationResult> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return {
      coords: null,
      error: 'Geolocation is not supported by your browser.',
    };
  }

  // 1. First attempt: Standard request with generous 15s timeout to allow user to click "Allow"
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000,
        }
      );
    });

    return {
      coords: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
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

    // Error Code 2 (POSITION_UNAVAILABLE) or 3 (TIMEOUT): Try fast low-accuracy fallback
    try {
      const fallbackPosition = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 120000,
          }
        );
      });

      return {
        coords: {
          lat: fallbackPosition.coords.latitude,
          lng: fallbackPosition.coords.longitude,
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
