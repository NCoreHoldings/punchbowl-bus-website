import { z } from "zod";
import {
  websiteSubmissionSchema,
  type WebsiteSubmission,
} from "./enquiry-schema";
import {
  emptyRoute,
  MAX_POINTS,
  pointLabel,
  type TripPoint,
} from "./itinerary";
export type TripForm = {
  tripType: string;
  date: string;
  time: string;
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
  tripType: "one-way",
  date: "",
  time: "",
  outbound: emptyRoute(),
  returnDate: "",
  returnTime: "",
  returnReversed: true,
  inbound: emptyRoute(),
  passengerCount: "",
  busCount: "",
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
  return { ...emptyForm, outbound: emptyRoute(), inbound: emptyRoute() };
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
  tripType: z.string(),
  date: z.string(),
  time: z.string(),
  outbound: routeSchema,
  returnDate: z.string(),
  returnTime: z.string(),
  returnReversed: z.boolean(),
  inbound: routeSchema,
  passengerCount: z.string(),
  busCount: z.string(),
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
function toLeg(date: string, time: string, route: TripPoint[]) {
  return {
    date,
    time: time || null,
    arrivalDate: null,
    arrivalTime: null,
    pickup: toPlace(route[0]),
    destination: toPlace(route[route.length - 1]),
    stops: route.slice(1, -1).map(toPlace),
  };
}

export function buildSubmission(form: TripForm, id: string): WebsiteSubmission {
  return websiteSubmissionSchema.parse({
    schemaVersion: 1,
    sourceSubmissionId: id,
    customerGroup: form.customerGroup.trim() || form.name.trim(),
    contact: {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    },
    forward: toLeg(form.date, form.time, form.outbound),
    return:
      form.tripType === "return"
        ? toLeg(form.returnDate, form.returnTime, returnRoute(form))
        : null,
    passengerCount: Number(form.passengerCount),
    busCount: form.busCount ? Number(form.busCount) : null,
    specialInstructions: `Vehicle preference: ${form.vehicle}\nSeatbelt preference: ${form.seatbelts}${form.notes.trim() ? `\n\n${form.notes.trim()}` : ""}`,
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
  if (form.tripType === "return") {
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
  const parsed = websiteSubmissionSchema.safeParse({
    schemaVersion: 1,
    sourceSubmissionId: "validation",
    customerGroup: "Validation",
    contact: { name: "Validation", phone: "000" },
    forward: toLeg(form.date, form.time, form.outbound),
    return:
      form.tripType === "return"
        ? toLeg(form.returnDate, form.returnTime, returnRoute(form))
        : null,
  });
  return parsed.success
    ? null
    : "Please check your journey dates, times, addresses and access notes.";
}
