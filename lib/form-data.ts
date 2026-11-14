import {
  websiteSubmissionSchema,
  type WebsiteSubmission,
} from "./enquiry-schema";
export type TripForm = {
  tripType: string;
  date: string;
  time: string;
  pickup: string;
  destination: string;
  returnDate: string;
  returnTime: string;
  returnPickup: string;
  returnDestination: string;
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
  pickup: "",
  destination: "",
  returnDate: "",
  returnTime: "",
  returnPickup: "",
  returnDestination: "",
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
export function sydneyToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function buildSubmission(form: TripForm, id: string): WebsiteSubmission {
  const leg = (
    date: string,
    time: string,
    pickup: string,
    destination: string,
  ) => ({
    date,
    time: time || null,
    arrivalDate: null,
    arrivalTime: null,
    pickup: { address: pickup.trim() },
    destination: { address: destination.trim() },
    stops: [],
  });
  return websiteSubmissionSchema.parse({
    schemaVersion: 1,
    sourceSubmissionId: id,
    customerGroup: form.customerGroup.trim() || form.name.trim(),
    contact: {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    },
    forward: leg(form.date, form.time, form.pickup, form.destination),
    return:
      form.tripType === "return"
        ? leg(
            form.returnDate,
            form.returnTime,
            form.returnPickup || form.destination,
            form.returnDestination || form.pickup,
          )
        : null,
    passengerCount: Number(form.passengerCount),
    busCount: form.busCount ? Number(form.busCount) : null,
    specialInstructions: `Vehicle preference: ${form.vehicle}\nSeatbelt preference: ${form.seatbelts}${form.notes.trim() ? `\n\n${form.notes.trim()}` : ""}`,
  });
}
export function validateJourney(form: TripForm): string | null {
  if (!form.pickup.trim() || !form.destination.trim())
    return "Please enter both pickup and destination addresses.";
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
  if (
    form.tripType === "return" &&
    (!form.returnDate ||
      form.returnDate < form.date ||
      (form.returnDate === form.date &&
        form.time &&
        form.returnTime &&
        form.returnTime < form.time))
  )
    return "Please choose a return date and time after your outward departure.";
  const parsed = websiteSubmissionSchema.safeParse({
    schemaVersion: 1,
    sourceSubmissionId: "validation",
    customerGroup: "Validation",
    contact: { name: "Validation", phone: "000" },
    forward: {
      date: form.date,
      time: form.time || null,
      pickup: { address: form.pickup },
      destination: { address: form.destination },
    },
    return:
      form.tripType === "return"
        ? {
            date: form.returnDate,
            time: form.returnTime || null,
            pickup: { address: form.returnPickup || form.destination },
            destination: { address: form.returnDestination || form.pickup },
          }
        : null,
  });
  return parsed.success
    ? null
    : "Please check your journey dates, times and addresses.";
}
