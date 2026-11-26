import { z } from "zod";
import {
  MAX_RECURRENCE_DAYS,
  tripTypes,
  websiteSubmissionSchema,
  type TripType,
  type WebsiteSubmission,
} from "./enquiry-schema";
import {
  emptyRoute,
  MAX_POINTS,
  pointId,
  pointLabel,
  type TripPoint,
} from "./itinerary";
/** The trip types of NCore Fleets' New Booking form, in the same order and words. */
export const TRIP_TYPE_OPTIONS: { value: TripType; label: string; hint: string }[] =
  [
    { value: "one_way", label: "One way", hint: "A single journey" },
    { value: "round_trip", label: "Round trip", hint: "There and back again" },
    {
      value: "repeatable",
      label: "Recurring",
      hint: "The same trip on a schedule",
    },
    {
      value: "shuttle",
      label: "Shuttle",
      hint: "Repeated runs to move a large group",
    },
  ];
export const tripTypeLabel = (type: TripType) =>
  TRIP_TYPE_OPTIONS.find((o) => o.value === type)!.label;
export const RECURRENCE_OPTIONS = [
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Weekly, on chosen days" },
  { value: "monthly", label: "Monthly, on the same date" },
] as const;
export type RecurrenceType = (typeof RECURRENCE_OPTIONS)[number]["value"];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
/** One of buses 2..N when each bus has its own route (bus 1 uses the main route). */
export type BusRoute = {
  id: string;
  route: TripPoint[];
  /** Blank means the same time as bus 1. */
  time: string;
  returnTime: string;
};
/** Above this, customers describe the routes in their notes or call us. */
export const MAX_SEPARATE_ROUTE_BUSES = 20;
export type TripForm = {
  tripType: TripType;
  date: string;
  time: string;
  /** Shuttles: the time every passenger should have arrived by. */
  finishTime: string;
  /** Recurring trips: how often, which weekdays and the last trip date. */
  recurrenceType: RecurrenceType;
  recurrenceDays: number[];
  recurrenceEndDate: string;
  /** Outbound itinerary: pickup point, passenger stops, drop-off. */
  outbound: TripPoint[];
  returnDate: string;
  returnTime: string;
  /** When true the return leg is the outbound route in reverse. */
  returnReversed: boolean;
  /** Custom return itinerary, used only when returnReversed is false. */
  inbound: TripPoint[];
  passengerCount: string;
  busCount: string;
  /** With two or more buses: one shared route, or a different route for each bus. */
  routeMode: "same" | "different";
  /** Buses 2..N; drafts beyond the bus count are kept but not sent. */
  busRoutes: BusRoute[];
  vehicle: string;
  seatbelts: string;
  name: string;
  customerGroup: string;
  email: string;
  phone: string;
  notes: string;
  website: string;
};
export const emptyForm: TripForm = {
  tripType: "one_way",
  date: "",
  time: "",
  finishTime: "",
  recurrenceType: "weekly",
  recurrenceDays: [],
  recurrenceEndDate: "",
  outbound: emptyRoute(),
  returnDate: "",
  returnTime: "",
  returnReversed: true,
  inbound: emptyRoute(),
  passengerCount: "",
  busCount: "",
  routeMode: "same",
  busRoutes: [],
  vehicle: "No preference",
  seatbelts: "Please discuss",
  name: "",
  customerGroup: "",
  email: "",
  phone: "",
  notes: "",
  website: "",
};
export function freshForm(): TripForm {
  return {
    ...emptyForm,
    recurrenceDays: [],
    busRoutes: [],
    outbound: emptyRoute(),
    inbound: emptyRoute(),
  };
}

const pointSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  notes: z.string(),
  lat: z.number().finite().optional(),
  lng: z.number().finite().optional(),
});
const routeSchema = z.array(pointSchema).min(2).max(MAX_POINTS);
/** Shape check for a form restored from browser storage. */
export const tripFormSchema = z.object({
  tripType: z.enum(tripTypes),
  date: z.string(),
  time: z.string(),
  finishTime: z.string(),
  recurrenceType: z.enum(["daily", "weekly", "monthly"]),
  recurrenceDays: z.array(z.number().int().min(0).max(6)).max(7),
  recurrenceEndDate: z.string(),
  outbound: routeSchema,
  returnDate: z.string(),
  returnTime: z.string(),
  returnReversed: z.boolean(),
  inbound: routeSchema,
  passengerCount: z.string(),
  busCount: z.string(),
  routeMode: z.enum(["same", "different"]),
  busRoutes: z
    .array(
      z.object({
        id: z.string(),
        route: routeSchema,
        time: z.string(),
        returnTime: z.string(),
      }),
    )
    .max(MAX_SEPARATE_ROUTE_BUSES),
  vehicle: z.string(),
  seatbelts: z.string(),
  name: z.string(),
  customerGroup: z.string(),
  email: z.string(),
  phone: z.string(),
  notes: z.string(),
  website: z.string(),
});

export function sydneyToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Digits only, for counts typed by hand (no spinners, no "1e3" or "-2"). */
export function countInput(value: string, maxDigits: number) {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, maxDigits);
}

/** True when each bus has its own route, as in NCore's New Booking form. */
export function differentRoutes(form: TripForm) {
  return (
    form.routeMode === "different" &&
    form.tripType !== "shuttle" &&
    Number(form.busCount) >= 2
  );
}

/** Buses 2..N in use, with a route draft for each (drafts are never dropped). */
export function activeBusRoutes(form: TripForm): BusRoute[] {
  const count = Math.min(Number(form.busCount) || 0, MAX_SEPARATE_ROUTE_BUSES);
  return form.busRoutes.slice(0, Math.max(0, count - 1));
}

/** Adds route drafts so every bus 2..N has one. */
export function withBusRoutes(form: TripForm): TripForm {
  const count = Math.min(Number(form.busCount) || 0, MAX_SEPARATE_ROUTE_BUSES);
  if (form.busRoutes.length >= count - 1) return form;
  const busRoutes = [...form.busRoutes];
  while (busRoutes.length < count - 1)
    busRoutes.push({ id: pointId(), route: emptyRoute(), time: "", returnTime: "" });
  return { ...form, busRoutes };
}

/** The return itinerary actually requested. */
export function returnRoute(form: TripForm): TripPoint[] {
  return form.returnReversed ? [...form.outbound].reverse() : form.inbound;
}

/** NCore place: name, address and access instructions (no coordinates). */
function toPlace(p: TripPoint) {
  const address = p.address.trim();
  const name = p.name.trim();
  const notes = p.notes.trim();
  return {
    ...(name && !address.toLowerCase().startsWith(name.toLowerCase())
      ? { name }
      : {}),
    address,
    ...(notes ? { instructions: notes } : {}),
  };
}
function toLeg(
  date: string,
  time: string,
  route: TripPoint[],
  arrivalTime = "",
) {
  return {
    date,
    time: time || null,
    arrivalDate: arrivalTime ? date : null,
    arrivalTime: arrivalTime || null,
    pickup: toPlace(route[0]),
    destination: toPlace(route[route.length - 1]),
    stops: route.slice(1, -1).map(toPlace),
  };
}

/** The journey part of the NCore submission for the chosen trip type. */
function journey(form: TripForm) {
  const shuttle = form.tripType === "shuttle";
  return {
    tripType: form.tripType,
    forward: toLeg(
      form.date,
      form.time,
      form.outbound,
      shuttle ? form.finishTime : "",
    ),
    return:
      form.tripType === "round_trip"
        ? toLeg(form.returnDate, form.returnTime, returnRoute(form))
        : null,
    recurrence:
      form.tripType === "repeatable"
        ? {
            type: form.recurrenceType,
            days:
              form.recurrenceType === "weekly"
                ? [...form.recurrenceDays].sort()
                : [],
            endDate: form.recurrenceEndDate,
          }
        : null,
    busCount: form.busCount ? Number(form.busCount) : null,
    otherBuses: differentRoutes(form)
      ? activeBusRoutes(form).map((b) => {
          const leg = toLeg(form.date, b.time || form.time, b.route);
          return {
            time: leg.time,
            returnTime:
              form.tripType === "round_trip"
                ? b.returnTime || form.returnTime || null
                : null,
            pickup: leg.pickup,
            destination: leg.destination,
            stops: leg.stops,
          };
        })
      : null,
  };
}

/** Seat belts are asked only when every bus follows the same route. */
export function asksSeatbelts(form: TripForm) {
  return !differentRoutes(form);
}

export function buildSubmission(form: TripForm, id: string): WebsiteSubmission {
  return websiteSubmissionSchema.parse({
    schemaVersion: 2,
    sourceSubmissionId: id,
    customerGroup: form.customerGroup.trim() || form.name.trim(),
    contact: {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    },
    ...journey(form),
    passengerCount: Number(form.passengerCount),
    specialInstructions:
      [
        `Vehicle preference: ${form.vehicle}`,
        ...(asksSeatbelts(form)
          ? [`Seatbelt preference: ${form.seatbelts}`]
          : []),
      ].join("\n") + (form.notes.trim() ? `\n\n${form.notes.trim()}` : ""),
  });
}

function routeIssue(route: TripPoint[], leg: string): string | null {
  const missing = route.findIndex((p) => !p.address.trim());
  if (missing < 0) return null;
  const label = pointLabel(missing, route.length).toLowerCase();
  const where =
    label === "passenger stop" ? `passenger stop ${missing + 1}` : label;
  return label === "passenger stop"
    ? `Please choose an address for ${where} on the ${leg}, or remove that stop.`
    : `Please choose an address for the ${where} on the ${leg}.`;
}

export function validateJourney(form: TripForm): string | null {
  const outward = routeIssue(form.outbound, "outward journey");
  if (outward) return outward;
  if (!form.date || form.date < sydneyToday())
    return "Please choose a journey date today or later (Sydney time).";
  if (
    !Number.isInteger(Number(form.passengerCount)) ||
    Number(form.passengerCount) < 1 ||
    Number(form.passengerCount) > 10000
  )
    return "Enter a passenger count between 1 and 10,000.";
  if (
    form.busCount &&
    (!Number.isInteger(Number(form.busCount)) ||
      Number(form.busCount) < 1 ||
      Number(form.busCount) > 100)
  )
    return "Enter between 1 and 100 buses, or leave this blank.";
  if (form.tripType === "repeatable") {
    const end = form.recurrenceEndDate;
    if (!end || end < form.date)
      return "Please choose the date of the last trip, on or after the first trip.";
    if (
      (Date.parse(end) - Date.parse(form.date)) / 86400000 >
      MAX_RECURRENCE_DAYS
    )
      return "Recurring trips can be quoted for up to one year. Please choose an earlier last trip date.";
    if (form.recurrenceType === "weekly" && !form.recurrenceDays.length)
      return "Please choose at least one day of the week for your recurring trip.";
    if (
      form.recurrenceType === "weekly" &&
      !form.recurrenceDays.includes(new Date(`${form.date}T12:00Z`).getUTCDay())
    )
      return `Your first trip is on a ${WEEKDAY_NAMES[new Date(`${form.date}T12:00Z`).getUTCDay()]}. Please tick that day too, or choose a first trip date on one of your chosen days.`;
  }
  if (
    form.tripType === "shuttle" &&
    form.time &&
    form.finishTime &&
    form.finishTime <= form.time
  )
    return "Please choose a finish time after the first pickup.";
  if (form.tripType === "round_trip") {
    if (
      !form.returnDate ||
      form.returnDate < form.date ||
      (form.returnDate === form.date &&
        form.time &&
        form.returnTime &&
        form.returnTime < form.time)
    )
      return "Please choose a return date and time after your outward departure.";
    const back = routeIssue(returnRoute(form), "return journey");
    if (back) return back;
  }
  if (differentRoutes(form)) {
    if (Number(form.busCount) > MAX_SEPARATE_ROUTE_BUSES)
      return `We can take separate routes for up to ${MAX_SEPARATE_ROUTE_BUSES} buses online. Please choose "Same route for all buses" and describe the routes in your notes, or call our team.`;
    for (const [i, b] of activeBusRoutes(form).entries()) {
      const issue = routeIssue(b.route, `route for bus ${i + 2}`);
      if (issue) return issue;
      const out = b.time || form.time,
        back = b.returnTime || form.returnTime;
      if (
        form.tripType === "round_trip" &&
        form.returnDate === form.date &&
        out &&
        back &&
        back < out
      )
        return `Please choose a return time for bus ${i + 2} after its departure.`;
    }
  }
  const parsed = websiteSubmissionSchema.safeParse({
    schemaVersion: 2,
    sourceSubmissionId: "validation",
    customerGroup: "Validation",
    contact: { name: "Validation", phone: "000" },
    passengerCount: Number(form.passengerCount),
    ...journey(form),
  });
  return parsed.success
    ? null
    : "Please check your journey dates, times, addresses and access notes.";
}
