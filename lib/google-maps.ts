/// <reference types="google.maps" />
/**
 * Google Maps for the quote form: loads the Maps JavaScript API on demand and
 * wraps Places (New) autocomplete and reverse geocoding behind a small
 * interface, so the form works (and can be tested) without Google.
 */
export type MapsConfig = { key: string; mapId: string };
export type PlaceResult = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};
export type Suggestion = {
  id: string;
  primary: string;
  secondary: string;
  select: () => Promise<PlaceResult | null>;
};
export type MapsService = {
  suggest: (input: string) => Promise<Suggestion[]>;
  reverse: (lat: number, lng: number) => Promise<PlaceResult>;
  /** Present only when the real Google Maps API is loaded. */
  google?: typeof google;
  mapId: string;
};

/** Punchbowl depot area, used to centre the map and bias search results. */
export const HOME = { lat: -33.9287, lng: 151.0526 };
const SEARCH_RADIUS_M = 50_000;

let loading: Promise<MapsService> | null = null;
const authListeners = new Set<() => void>();
let authFailed = false;

/** Google calls window.gm_authFailure when the key is invalid or not allowed for this site. */
export function onMapsAuthFailure(listener: () => void) {
  if (authFailed) listener();
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

export function loadGoogleMaps(config: MapsConfig): Promise<MapsService> {
  if (loading) return loading;
  loading = new Promise<MapsService>((resolve, reject) => {
    const w = window as unknown as Record<string, unknown>;
    w.gm_authFailure = () => {
      authFailed = true;
      authListeners.forEach((fn) => fn());
    };
    const callback = "__punchbowlMapsReady";
    w[callback] = () => {
      createService(config.mapId).then(resolve, reject);
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({
      key: config.key,
      v: "weekly",
      loading: "async",
      callback,
      region: "AU",
      language: "en-AU",
    })}`;
    script.async = true;
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.append(script);
  });
  return loading;
}

async function createService(mapId: string): Promise<MapsService> {
  const [places, geocoding] = await Promise.all([
    google.maps.importLibrary("places") as Promise<google.maps.PlacesLibrary>,
    google.maps.importLibrary(
      "geocoding",
    ) as Promise<google.maps.GeocodingLibrary>,
  ]);
  const { AutocompleteSuggestion, AutocompleteSessionToken } = places;
  // One session token per search → selection keeps Places billing per session.
  let token = new AutocompleteSessionToken();
  const geocoder = new geocoding.Geocoder();
  return {
    google,
    mapId,
    async suggest(input) {
      const { suggestions } =
        await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: token,
          includedRegionCodes: ["au"],
          locationBias: { center: HOME, radius: SEARCH_RADIUS_M },
          language: "en-AU",
          region: "au",
        });
      return suggestions.flatMap((s) => {
        const p = s.placePrediction;
        if (!p) return [];
        return [
          {
            id: p.placeId,
            primary: p.mainText?.text ?? p.text.text,
            secondary: p.secondaryText?.text ?? "",
            async select() {
              const place = p.toPlace();
              await place.fetchFields({
                fields: ["displayName", "formattedAddress", "location"],
              });
              token = new AutocompleteSessionToken();
              if (!place.location) return null;
              return {
                name: place.displayName ?? "",
                address: place.formattedAddress ?? p.text.text,
                lat: place.location.lat(),
                lng: place.location.lng(),
              };
            },
          },
        ];
      });
    },
    async reverse(lat, lng) {
      try {
        const { results } = await geocoder.geocode({ location: { lat, lng } });
        if (results[0])
          return { name: "", address: results[0].formatted_address, lat, lng };
      } catch {
        /* Geocoding unavailable: keep the pin with its coordinates. */
      }
      return { name: "", address: pinAddress(lat, lng), lat, lng };
    },
  };
}

export function pinAddress(lat: number, lng: number) {
  return `Map pin at ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}
