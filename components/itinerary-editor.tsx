"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Map as MapIcon,
  NotebookPen,
  Plus,
  Trash2,
} from "lucide-react";
import type { MapsService } from "@/lib/google-maps";
import {
  addStop,
  MAX_POINTS,
  MAX_STOPS,
  movePoint,
  pointLabel,
  removeStop,
  swapEndpoints,
  type TripPoint,
} from "@/lib/itinerary";
import { LocationField } from "./location-field";
import { MapPickerDialog } from "./map-picker-dialog";

/**
 * Ordered itinerary editor modelled on NCore Fleets' booking form:
 * pickup point → passenger stops → drop-off, with reordering, swap,
 * per-point coach access notes, plus a popup map for pickup and drop-off.
 */
export function ItineraryEditor({
  leg,
  route,
  onChange,
  service,
  disabled,
}: {
  /** "outward" or "return" — used for labels and input names. */
  leg: "outward" | "return";
  route: TripPoint[];
  onChange: (route: TripPoint[]) => void;
  service: MapsService | null;
  disabled?: boolean;
}) {
  const [notesOpen, setNotesOpen] = useState<Record<string, boolean>>({});
  const [mapOpen, setMapOpen] = useState(false);
  const mapButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  // Return focus to the map icon after the popup closes.
  useEffect(() => {
    if (wasOpen.current && !mapOpen) mapButton.current?.focus();
    wasOpen.current = mapOpen;
  }, [mapOpen]);
  const stops = route.length - 2;
  const last = route.length - 1;
  const update = (i: number, p: TripPoint) =>
    onChange(route.map((q, n) => (n === i ? p : q)));

  return (
    <div className="itinerary">
      <div className="itinerary-toolbar">
        {service?.google && (
          <button
            ref={mapButton}
            type="button"
            className="map-icon-button"
            aria-label={`Open map to choose the ${leg} pickup point and drop-off`}
            title="Choose pickup & drop-off on a map"
            aria-haspopup="dialog"
            disabled={disabled}
            onClick={() => setMapOpen(true)}
          >
            <MapIcon size={20} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="button small"
          disabled={disabled || route.length >= MAX_POINTS}
          onClick={() => onChange(addStop(route))}
        >
          <Plus size={15} aria-hidden="true" /> Add passenger stop
        </button>
        <button
          type="button"
          className="button small outline"
          disabled={disabled}
          onClick={() => onChange(swapEndpoints(route))}
        >
          <ArrowUpDown size={14} aria-hidden="true" /> Swap pickup & drop-off
        </button>
        <span className="itinerary-count">
          {stops} of {MAX_STOPS} stops
        </span>
      </div>
      <ol className="itinerary-list">
        {route.map((p, i) => {
          const kind = i === 0 ? "pickup" : i === route.length - 1 ? "dropoff" : "stop";
          const label = `${i + 1}. ${pointLabel(i, route.length)}`;
          const showNotes = notesOpen[p.id] || !!p.notes;
          return (
            <li key={p.id} className={`itinerary-point ${kind}`}>
              <div className="itinerary-head">
                <span className="itinerary-badge" aria-hidden="true">
                  {i + 1}
                </span>
                <strong>{label}</strong>
                <span className="itinerary-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Move ${label} up`}
                    disabled={disabled || i === 0}
                    onClick={() => onChange(movePoint(route, i, i - 1))}
                  >
                    <ChevronUp size={17} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Move ${label} down`}
                    disabled={disabled || i === route.length - 1}
                    onClick={() => onChange(movePoint(route, i, i + 1))}
                  >
                    <ChevronDown size={17} />
                  </button>
                  {kind === "stop" && (
                    <button
                      type="button"
                      className="icon-button danger"
                      aria-label={`Remove ${label}`}
                      disabled={disabled}
                      onClick={() => onChange(removeStop(route, i))}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </span>
              </div>
              <LocationField
                label={`${leg === "return" ? "Return " : ""}${label}`}
                name={`${leg}-${i}`}
                value={p}
                onChange={(v) => update(i, v)}
                service={service}
                disabled={disabled}
              />
              <div className="itinerary-extras">
                {!showNotes && (
                  <button
                    type="button"
                    className="text-button"
                    aria-label={`Add coach access notes for ${label}`}
                    disabled={disabled}
                    onClick={() => setNotesOpen((o) => ({ ...o, [p.id]: true }))}
                  >
                    <NotebookPen size={14} aria-hidden="true" /> Add coach access notes
                  </button>
                )}
              </div>
              {showNotes && (
                <label className="field itinerary-notes">
                  <span>
                    Coach access notes (optional)
                    <span className="visually-hidden"> for {label}</span>
                  </span>
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={p.notes}
                    disabled={disabled}
                    onChange={(e) => update(i, { ...p, notes: e.target.value })}
                    placeholder="e.g. Enter via Gate 3, bus bay on Smith Street"
                  />
                </label>
              )}
            </li>
          );
        })}
      </ol>
      {mapOpen && service?.google && (
        <MapPickerDialog
          leg={leg}
          service={service}
          pickup={route[0]}
          dropoff={route[last]}
          onClose={() => setMapOpen(false)}
          onApply={(from, to) => {
            const place = ({ name, address, lat, lng }: TripPoint) => ({
              name,
              address,
              lat,
              lng,
            });
            onChange(
              route.map((p, n) =>
                n === 0
                  ? { ...p, ...place(from) }
                  : n === last
                    ? { ...p, ...place(to) }
                    : p,
              ),
            );
            setMapOpen(false);
          }}
        />
      )}
    </div>
  );
}
