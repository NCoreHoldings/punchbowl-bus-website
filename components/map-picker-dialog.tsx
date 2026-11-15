"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";
import type { MapsService, SampleRoute } from "@/lib/google-maps";
import { hasCoordinates, type TripPoint } from "@/lib/itinerary";
import { LocationField } from "./location-field";
import { RouteMap } from "./route-map";

/**
 * Popup map for choosing the pickup point and drop-off separately, showing
 * the chosen places and a sample route between them.
 */
export function MapPickerDialog({
  leg,
  pickup,
  dropoff,
  service,
  onApply,
  onClose,
}: {
  leg: "outward" | "return";
  pickup: TripPoint;
  dropoff: TripPoint;
  service: MapsService;
  onApply: (pickup: TripPoint, dropoff: TripPoint) => void;
  onClose: () => void;
}) {
  const [from, setFrom] = useState<TripPoint>(pickup);
  const [to, setTo] = useState<TripPoint>(dropoff);
  const [route, setRoute] = useState<SampleRoute | null>(null);
  const [routing, setRouting] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const titleId = `${leg}-map-title`;
  const noteId = `${leg}-map-note`;

  // Focus inside the popup, keep Tab within it and close on Escape. The
  // opener returns focus to its map icon when the popup closes.
  useEffect(() => {
    panel.current?.querySelector<HTMLInputElement>("input")?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        close.current();
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = [
        ...panel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (!items.length) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const ready = !!from.address.trim() && !!to.address.trim();
  const points = [from, to];
  // Rendered into <body> so it sits above the fixed site header rather than
  // inside the quote section's stacking context.
  return createPortal(
    <div
      className="map-dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        className="map-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={noteId}
      >
        <div className="map-dialog-head">
          <h3 id={titleId}>
            {leg === "return" ? "Return journey" : "Your journey"} on the map
          </h3>
          <button
            type="button"
            className="icon-button"
            aria-label="Close map"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        <div className="map-dialog-body">
          <div className="map-dialog-fields">
            <PlaceCard kind="pickup" title="Pickup point" point={from}>
              <LocationField
                label="Pickup point"
                name={`${leg}-map-pickup`}
                value={from}
                onChange={setFrom}
                service={service}
              />
            </PlaceCard>
            <PlaceCard kind="dropoff" title="Drop-off" point={to}>
              <LocationField
                label="Drop-off"
                name={`${leg}-map-dropoff`}
                value={to}
                onChange={setTo}
                service={service}
              />
            </PlaceCard>
            {(routing || route) && (
              <p className="map-route-stats" aria-live="polite">
                {routing
                  ? "Finding a sample route…"
                  : routeStats(route)}
              </p>
            )}
          </div>
          {service.google ? (
            <RouteMap
              service={service}
              points={points}
              target={!from.address.trim() ? 0 : !to.address.trim() ? 1 : null}
              title={`Map of the ${leg} pickup point and drop-off`}
              sampleRoute
              onRouteInfo={(r, loading) => {
                setRoute(r);
                setRouting(loading);
              }}
              onPick={(i, place) =>
                (i === 0 ? setFrom : setTo)((p) => ({ ...p, ...place }))
              }
            />
          ) : null}
        </div>
        <p className="map-dialog-note" id={noteId}>
          <Info size={15} aria-hidden="true" />
          <span>
            The route shown is a <strong>sample route for reference only</strong>{" "}
            and doesn’t represent the exact bus route. Our team plans the
            actual route for your trip.
          </span>
        </p>
        <div className="map-dialog-actions">
          <button type="button" className="button outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button"
            disabled={!ready}
            onClick={() => onApply(from, to)}
          >
            Use these locations
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PlaceCard({
  kind,
  title,
  point,
  children,
}: {
  kind: "pickup" | "dropoff";
  title: string;
  point: TripPoint;
  children: React.ReactNode;
}) {
  const named = point.name && !point.address.startsWith(point.name);
  return (
    <section className={`map-place ${kind}`} aria-label={title}>
      <h4>
        <span className="itinerary-badge" aria-hidden="true">
          {kind === "pickup" ? "1" : "2"}
        </span>
        {title}
      </h4>
      {children}
      {point.address.trim() && hasCoordinates(point) && (
        <div className="map-place-selected">
          <strong>{named ? point.name : point.address.split(",")[0]}</strong>
          <span>{point.address}</span>
        </div>
      )}
    </section>
  );
}

function routeStats(route: SampleRoute | null) {
  if (!route)
    return "A road route isn’t available, so a straight line is shown instead.";
  const parts = ["Sample route"];
  if (route.distanceMeters != null)
    parts.push(`${(route.distanceMeters / 1000).toFixed(1)} km`);
  if (route.durationMillis != null)
    parts.push(`about ${Math.max(1, Math.round(route.durationMillis / 60000))} min by car`);
  return parts.join(" · ");
}
