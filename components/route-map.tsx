"use client";
import { useEffect, useRef, useState } from "react";
import { HOME, type MapsService, type PlaceResult } from "@/lib/google-maps";
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
}: {
  service: MapsService;
  points: TripPoint[];
  /** Index of the point the next map click will set, or null. */
  target: number | null;
  onPick: (index: number, place: PlaceResult) => void;
  disabled?: boolean;
  title: string;
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
    overlays.current.line =
      mapped.length > 1
        ? new l.maps.Polyline({
            map: m,
            path: mapped.map(({ p }) => ({ lat: p.lat!, lng: p.lng! })),
            strokeColor: COLORS.dropoff,
            strokeOpacity: 0.75,
            strokeWeight: 4,
            clickable: false,
          })
        : null;
    // Re-frame only when the set of pinned locations changes.
    const key = mapped.map(({ p }) => `${p.lat},${p.lng}`).sort().join("|");
    if (key !== fitted.current) {
      fitted.current = key;
      if (mapped.length === 1) {
        m.panTo({ lat: mapped[0].p.lat!, lng: mapped[0].p.lng! });
        m.setZoom(14);
      } else if (mapped.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        mapped.forEach(({ p }) => bounds.extend({ lat: p.lat!, lng: p.lng! }));
        m.fitBounds(bounds, 56);
      }
    }
  }, [points, ready, disabled, service]);

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
      : "Drag a pin to fine-tune, or use “Set on map” on a point.";
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
