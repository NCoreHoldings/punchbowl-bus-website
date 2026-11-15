/**
 * Ordered journey points, modelled on NCore Fleets' booking itinerary:
 * 1. Pickup point → passenger stops → Drop-off.
 * NCore accepts up to 20 intermediate stops per leg.
 */
export type TripPoint = {
  id: string;
  /** Venue or place name chosen from search (optional). */
  name: string;
  /** Full street address — the value NCore staff work from. */
  address: string;
  /** Coach access notes for this point (entrance, parking, timing). */
  notes: string;
  lat?: number;
  lng?: number;
};

export const MAX_STOPS = 20;
export const MAX_POINTS = MAX_STOPS + 2;

let counter = 0;
export function pointId() {
  counter += 1;
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `point-${Date.now()}-${counter}`;
}

export function newPoint(partial: Partial<TripPoint> = {}): TripPoint {
  return { id: pointId(), name: "", address: "", notes: "", ...partial };
}

export function emptyRoute(): TripPoint[] {
  return [newPoint(), newPoint()];
}

export function pointLabel(index: number, total: number) {
  if (index === 0) return "Pickup point";
  if (index === total - 1) return "Drop-off";
  return "Passenger stop";
}

/** Insert a new passenger stop just before the drop-off. */
export function addStop(route: TripPoint[]): TripPoint[] {
  if (route.length >= MAX_POINTS) return route;
  return [...route.slice(0, -1), newPoint(), route[route.length - 1]];
}

export function removeStop(route: TripPoint[], index: number): TripPoint[] {
  if (index <= 0 || index >= route.length - 1) return route;
  return route.filter((_, i) => i !== index);
}

export function movePoint(
  route: TripPoint[],
  from: number,
  to: number,
): TripPoint[] {
  if (to < 0 || to >= route.length || from === to) return route;
  const next = [...route];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function swapEndpoints(route: TripPoint[]): TripPoint[] {
  if (route.length < 2) return route;
  const next = [...route];
  [next[0], next[next.length - 1]] = [next[next.length - 1], next[0]];
  return next;
}

/** The outbound route driven in reverse, with fresh IDs (NCore's "copy outbound in reverse"). */
export function reverseRoute(route: TripPoint[]): TripPoint[] {
  return [...route].reverse().map((p) => ({ ...p, id: pointId() }));
}

export function hasCoordinates(p: TripPoint) {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng);
}
