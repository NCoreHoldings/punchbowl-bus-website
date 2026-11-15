"use client";
import { useEffect, useRef, useState } from "react";
import {
  HOME,
  type LatLng,
  type MapsService,
  type PlaceResult,
  type SampleRoute,
} from "@/lib/google-maps";
import { hasCoordinates, pointLabel, type TripPoint } from "@/lib/itinerary";

const COLORS = { pickup: "#2f6b45", dropoff: "#b51f2b", stop: "#14161b" };

/**
 * Interactive Google map for one leg of the journey. Shows numbered pins in
 * route order; clicking the map sets the target point and pins can be dragged.
 */
export function RouteMap({
  service,
  points,
  target,
  onPick,
  disabled,
  title,
  sampleRoute = false,
  onRouteInfo,
}: {
  service: MapsService;
  points: TripPoint[];
  /** Index of the point the next map click will set, or null. */
  target: number | null;
  onPick: (index: number, place: PlaceResult) => void;
  disabled?: boolean;
  title: string;
  /** Draw a sample driving route between the first and last points. */
  sampleRoute?: boolean;
  onRouteInfo?: (route: SampleRoute | null, loading: boolean) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const libs = useRef<{
    marker: google.maps.MarkerLibrary;
    maps: google.maps.MapsLibrary;
  } | null>(null);
  const overlays = useRef<{ markers: google.maps.marker.AdvancedMarkerElement[]; line: google.maps.Polyline | null }>({ markers: [], line: null });
  const latest = useRef({ target, onPick, disabled, points });
  latest.current = { target, onPick, disabled, points };
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [locating, setLocating] = useState(false);
  const fitted = useRef("");
  const [routePath, setRoutePath] = useState<LatLng[] | null>(null);
  const routeInfo = useRef(onRouteInfo);
  routeInfo.current = onRouteInfo;
  const first = points[0];
  const last = points[points.length - 1];
  const endpoints =
    sampleRoute && first && last && hasCoordinates(first) && hasCoordinates(last)
      ? `${first.lat},${first.lng}|${last.lat},${last.lng}`
      : "";

  // Fetch a sample driving route whenever both endpoints are pinned.
  useEffect(() => {
    setRoutePath(null);
    if (!endpoints) {
      routeInfo.current?.(null, false);
      return;
    }
    let cancelled = false;
    const [a, b] = endpoints.split("|").map((v) => {
      const [lat, lng] = v.split(",").map(Number);
      return { lat, lng };
    });
    routeInfo.current?.(null, true);
    service.route(a, b).then((r) => {
      if (cancelled) return;
      setRoutePath(r?.path ?? null);
      routeInfo.current?.(r, false);
    });
    return () => {
      cancelled = true;
    };
  }, [endpoints, service]);

  useEffect(() => {
    const g = service.google;
    if (!g || !el.current) return;
    let cancelled = false;
    let click: google.maps.MapsEventListener | null = null;
    (async () => {
      try {
        const [maps, marker] = await Promise.all([
          g.maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
          g.maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
        ]);
        if (cancelled || !el.current) return;
        libs.current = { maps, marker };
        map.current = new maps.Map(el.current, {
          center: HOME,
          zoom: 10,
          mapId: service.mapId,
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          gestureHandling: "cooperative",
        });
        click = map.current.addListener(
          "click",
          async (e: google.maps.MapMouseEvent) => {
            const { target: t, disabled: off, onPick: pick } = latest.current;
            if (off || t === null || !e.latLng) return;
            setLocating(true);
            try {
              pick(t, await service.reverse(e.latLng.lat(), e.latLng.lng()));
            } finally {
              setLocating(false);
            }
          },
        );
        setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      click?.remove();
    };
  }, [service]);

  // Redraw pins and the route line whenever the points change.
  useEffect(() => {
    const m = map.current;
    const l = libs.current;
    if (!ready || !m || !l) return;
    overlays.current.markers.forEach((mk) => (mk.map = null));
    overlays.current.line?.setMap(null);
    const mapped = points
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => hasCoordinates(p));
    overlays.current.markers = mapped.map(({ p, i }) => {
      const last = i === points.length - 1;
      const color = i === 0 ? COLORS.pickup : last ? COLORS.dropoff : COLORS.stop;
      const pin = new l.marker.PinElement({
        background: color,
        borderColor: "#ffffff",
        glyphColor: "#ffffff",
        glyphText: String(i + 1),
      });
      const marker = new l.marker.AdvancedMarkerElement({
        map: m,
        position: { lat: p.lat!, lng: p.lng! },
        content: pin,
        title: `${i + 1}. ${pointLabel(i, points.length)}: ${p.address}`,
        gmpDraggable: !disabled,
      });
      marker.addListener("dragend", async () => {
        const pos = marker.position;
        if (!pos) return;
        const lat = typeof pos.lat === "function" ? pos.lat() : pos.lat;
        const lng = typeof pos.lng === "function" ? pos.lng() : pos.lng;
        setLocating(true);
        try {
          latest.current.onPick(i, await service.reverse(lat, lng));
        } finally {
          setLocating(false);
        }
      });
      return marker;
    });
    // A real driving path when available; otherwise a dashed straight line.
    overlays.current.line = routePath
      ? new l.maps.Polyline({
          map: m,
          path: routePath,
          strokeColor: COLORS.dropoff,
          strokeOpacity: 0.8,
          strokeWeight: 5,
          clickable: false,
        })
      : mapped.length > 1
        ? new l.maps.Polyline({
            map: m,
            path: mapped.map(({ p }) => ({ lat: p.lat!, lng: p.lng! })),
            strokeColor: COLORS.dropoff,
            strokeOpacity: 0,
            clickable: false,
            icons: [
              {
                icon: { path: "M 0,-1 0,1", strokeOpacity: 0.8, scale: 3 },
                offset: "0",
                repeat: "14px",
              },
            ],
          })
        : null;
    // Re-frame only when the set of pinned locations changes.
    const key =
      mapped.map(({ p }) => `${p.lat},${p.lng}`).sort().join("|") +
      (routePath ? `|route:${routePath.length}` : "");
    if (key !== fitted.current) {
      fitted.current = key;
      if (mapped.length === 1) {
        m.panTo({ lat: mapped[0].p.lat!, lng: mapped[0].p.lng! });
        m.setZoom(14);
      } else if (mapped.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        mapped.forEach(({ p }) => bounds.extend({ lat: p.lat!, lng: p.lng! }));
        routePath?.forEach((pt) => bounds.extend(pt));
        m.fitBounds(bounds, 56);
      }
    }
  }, [points, ready, disabled, service, routePath]);

  if (failed)
    return (
      <p className="form-message warning">
        The map couldn’t load. You can still search for each address above.
      </p>
    );
  const hint = disabled
    ? null
    : target !== null
      ? `Click the map to set ${target + 1}. ${pointLabel(target, points.length)}`
      : "Drag a pin to fine-tune its location.";
  return (
    <div className="route-map">
      <div ref={el} className="route-map-canvas" role="region" aria-label={title} />
      {hint && (
        <div className={`route-map-hint ${target !== null ? "picking" : ""}`} aria-live="polite">
          {locating ? "Finding that address…" : hint}
        </div>
      )}
    </div>
  );
}
