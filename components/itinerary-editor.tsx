"use client";
import { useState } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Crosshair,
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
import { RouteMap } from "./route-map";

/**
 * Ordered itinerary editor modelled on NCore Fleets' booking form:
 * pickup point → passenger stops → drop-off, with reordering, swap,
 * per-point coach access notes and an interactive map.
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
  const [targetId, setTargetId] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState<Record<string, boolean>>({});
  const stops = route.length - 2;
  // Like NCore: map clicks set the chosen point, else the first point still without an address.
  const explicit = route.findIndex((p) => p.id === targetId);
  const firstEmpty = route.findIndex((p) => !p.address.trim());
  const target = explicit >= 0 ? explicit : firstEmpty >= 0 ? firstEmpty : null;
  const update = (i: number, p: TripPoint) =>
    onChange(route.map((q, n) => (n === i ? p : q)));

  return (
    <div className="itinerary">
      <div className="itinerary-toolbar">
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
          const isTarget = service && target === i && explicit === i;
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
                {service?.google && (
                  <button
                    type="button"
                    className={`text-button ${isTarget ? "on" : ""}`}
                    aria-pressed={!!isTarget}
                    aria-label={`Set ${label} on the map`}
                    disabled={disabled}
                    onClick={() => setTargetId(isTarget ? null : p.id)}
                  >
                    <Crosshair size={14} aria-hidden="true" />
                    {isTarget ? "Click the map…" : "Set on map"}
                  </button>
                )}
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
      {service?.google && (
        <RouteMap
          service={service}
          points={route}
          target={target}
          disabled={disabled}
          title={`Map of your ${leg} journey`}
          onPick={(i, place) => {
            const current = route[i];
            if (!current) return;
            update(i, { ...current, ...place });
            setTargetId(null);
          }}
        />
      )}
    </div>
  );
}
