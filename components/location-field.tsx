"use client";
import { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, MapPin } from "lucide-react";
import type { MapsService, Suggestion } from "@/lib/google-maps";
import { hasCoordinates, type TripPoint } from "@/lib/itinerary";

/**
 * Address input with Google Places suggestions (when Maps is available).
 * Free text is always accepted, so the form still works without Google.
 */
export function LocationField({
  label,
  name,
  value,
  onChange,
  service,
  disabled,
}: {
  label: string;
  name: string;
  value: TripPoint;
  onChange: (point: TripPoint) => void;
  service: MapsService | null;
  disabled?: boolean;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const query = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function type(text: string) {
    onChange({ ...value, address: text, name: "", lat: undefined, lng: undefined });
    query.current = text;
    setFailed(false);
    if (timer.current) clearTimeout(timer.current);
    if (!service || text.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await service.suggest(text.trim());
        if (query.current !== text) return;
        setSuggestions(found);
        setActive(-1);
        setOpen(true);
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setSearching(false);
      }
    }, 280);
  }

  async function choose(s: Suggestion) {
    setOpen(false);
    setSearching(true);
    try {
      const place = await s.select();
      if (place) {
        query.current = place.address;
        onChange({ ...value, ...place });
      } else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setSearching(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !suggestions.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      void choose(suggestions[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  const located = hasCoordinates(value);
  const showList = open && !!service;
  return (
    <div className="location-field">
      <label htmlFor={id} className="visually-hidden">
        {label}
      </label>
      <div className="location-input">
        <MapPin size={17} aria-hidden="true" />
        <input
          id={id}
          name={name}
          type="text"
          value={value.address}
          disabled={disabled}
          placeholder={
            service
              ? "Search an address, school or venue"
              : "Street address, suburb and postcode"
          }
          autoComplete="off"
          maxLength={1000}
          onChange={(e) => type(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          {...(service
            ? {
                role: "combobox",
                "aria-autocomplete": "list" as const,
                "aria-expanded": showList,
                "aria-controls": listId,
                "aria-activedescendant":
                  showList && active >= 0 ? `${listId}-${active}` : undefined,
              }
            : {})}
        />
        {searching && (
          <LoaderCircle className="loading-spinner" size={16} aria-hidden="true" />
        )}
      </div>
      {showList && (
        <ul className="location-options" id={listId} role="listbox" aria-label={`${label} suggestions`}>
          {suggestions.length ? (
            suggestions.map((s, i) => (
              <li
                key={s.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? "active" : ""}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void choose(s);
                }}
              >
                <strong>{s.primary}</strong>
                {s.secondary && <span>{s.secondary}</span>}
              </li>
            ))
          ) : (
            <li className="location-empty" role="presentation">
              No matches. Keep typing, or set the point on the map.
            </li>
          )}
          <li className="location-attribution" role="presentation">
            Powered by Google
          </li>
        </ul>
      )}
      {service && value.address.trim() && (
        <small className={`location-status ${located ? "ok" : ""}`} aria-live="polite">
          {located ? (
            <>
              <CheckCircle2 size={14} aria-hidden="true" />
              {value.name && !value.address.startsWith(value.name)
                ? `${value.name} · located on the map`
                : "Located on the map"}
            </>
          ) : failed ? (
            "We couldn't load that place. Try another suggestion or set it on the map."
          ) : (
            "Choose a suggestion or set it on the map to pin this location."
          )}
        </small>
      )}
    </div>
  );
}
