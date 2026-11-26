import { z } from "zod";
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v),
      "Control characters are not allowed",
    );
const place = z.strictObject({
  name: text(200).optional(),
  address: text(1000).min(1),
  instructions: text(8000).optional(),
});
const time = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  .nullable()
  .default(null);
const leg = z.strictObject({
  date: z.iso.date(),
  time,
  arrivalDate: z.iso.date().nullable().default(null),
  arrivalTime: time,
  pickup: place,
  destination: place,
  stops: z.array(place).max(20).default([]),
});
/**
 * NCore Fleets booking types. Version 2 of the contract lets the customer pick
 * one; version 1 payloads carry none, and the type is derived from the legs.
 */
export const tripTypes = [
  "one_way",
  "round_trip",
  "repeatable",
  "shuttle",
] as const;
export type TripType = (typeof tripTypes)[number];
/** Recurring trips: every occurrence repeats the Forward leg; the first trip is its date. */
const recurrence = z.strictObject({
  type: z.enum(["daily", "weekly", "monthly"]),
  /** Weekdays for weekly trips, 0 = Sunday … 6 = Saturday. */
  days: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  /** Date of the last trip. */
  endDate: z.iso.date(),
});
/** NCore quotes recurring bookings for up to one year. */
export const MAX_RECURRENCE_DAYS = 366;
/**
 * Buses 2..N when each bus has its own route (NCore's "Different route for
 * each vehicle"). Bus 1 is the Forward/Return legs. Every bus travels on the
 * Forward date; on a round trip it returns on the Return date along its own
 * route in reverse.
 */
const otherBus = z.strictObject({
  time,
  /** Round trips only. */
  returnTime: time,
  pickup: place,
  destination: place,
  stops: z.array(place).max(20).default([]),
});
export const websiteSubmissionSchema = z
  .strictObject({
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    sourceSubmissionId: text(128)
      .min(1)
      .regex(/^[A-Za-z0-9_.:-]+$/),
    customerGroup: text(200).min(1),
    contact: z
      .strictObject({
        name: text(200).min(1),
        email: z.email().max(254).nullable().default(null),
        phone: text(60).nullable().default(null),
      })
      .refine(
        (v) => Boolean(v.email || v.phone),
        "An email or phone is required",
      ),
    forward: leg.nullable().default(null),
    return: leg.nullable().default(null),
    passengerCount: z.number().int().min(1).max(10000).nullable().default(null),
    busCount: z.number().int().min(1).max(100).nullable().default(null),
    specialInstructions: text(16000).default(""),
    /** Version 2 only; null derives one way or round trip from the legs. */
    tripType: z.enum(tripTypes).nullable().default(null),
    /** Recurring trips only. */
    recurrence: recurrence.nullable().default(null),
    /** Version 2 only: separate routes for buses 2..N. */
    otherBuses: z.array(otherBus).min(1).max(99).nullable().default(null),
  })
  .superRefine((v, ctx) => {
    const issue = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: "custom", message, path });
    if (v.schemaVersion === 1 && (v.tripType || v.recurrence || v.otherBuses))
      issue("Trip types need schema version 2", ["schemaVersion"]);
    if (v.otherBuses) {
      if (v.tripType === "shuttle")
        issue("Shuttle buses share one route", ["otherBuses"]);
      if (!v.forward) issue("Enter bus 1's route", ["forward"]);
      if (v.busCount !== v.otherBuses.length + 1)
        issue("Give one route for each bus", ["otherBuses"]);
      v.otherBuses.forEach((b, i) => {
        if (b.returnTime !== null && !v.return)
          issue("Return times apply to round trips only", [
            "otherBuses",
            i,
            "returnTime",
          ]);
      });
    }
    if (v.tripType === "one_way" && v.forward && v.return)
      issue("A one-way trip has a single leg", ["return"]);
    if (v.tripType === "round_trip" && !(v.forward && v.return))
      issue("A round trip needs Forward and Return legs", ["return"]);
    if (v.tripType === "repeatable" || v.tripType === "shuttle") {
      if (!v.forward) issue("Enter the trip details", ["forward"]);
      if (v.return)
        issue("Recurring and shuttle trips use a single leg", ["return"]);
    }
    if (v.tripType === "shuttle" && v.passengerCount === null)
      issue("A shuttle needs the total number of passengers", [
        "passengerCount",
      ]);
    if (v.tripType === "repeatable" && !v.recurrence)
      issue("Choose how often the trip repeats", ["recurrence"]);
    if (v.tripType !== "repeatable" && v.recurrence)
      issue("Only recurring trips repeat", ["recurrence"]);
    if (v.recurrence && v.forward) {
      const r = v.recurrence;
      if (r.type === "weekly" && !r.days.length)
        issue("Choose at least one weekday", ["recurrence", "days"]);
      // NCore only schedules chosen weekdays, so the first trip must be one.
      else if (
        r.type === "weekly" &&
        !r.days.includes(new Date(`${v.forward.date}T12:00Z`).getUTCDay())
      )
        issue("The first trip must fall on a chosen weekday", [
          "recurrence",
          "days",
        ]);
      if (r.type !== "weekly" && r.days.length)
        issue("Weekdays apply to weekly trips only", ["recurrence", "days"]);
      if (new Set(r.days).size !== r.days.length)
        issue("Each weekday may appear once", ["recurrence", "days"]);
      const span =
        (Date.parse(r.endDate) - Date.parse(v.forward.date)) / 86400000;
      if (span < 0)
        issue("The last trip precedes the first", ["recurrence", "endDate"]);
      else if (span > MAX_RECURRENCE_DAYS)
        issue("Recurring trips can span up to one year", [
          "recurrence",
          "endDate",
        ]);
    }
    if (!v.forward && !v.return)
      ctx.addIssue({
        code: "custom",
        message: "Request a Forward or Return trip",
        path: ["forward"],
      });
    for (const name of ["forward", "return"] as const) {
      const l = v[name];
      if (!l) continue;
      if (l.arrivalTime !== null && l.arrivalDate === null)
        ctx.addIssue({
          code: "custom",
          message: "Arrival date is required with arrival time",
          path: [name, "arrivalDate"],
        });
      if (
        l.time !== null &&
        l.arrivalTime !== null &&
        `${l.arrivalDate}T${l.arrivalTime}` <= `${l.date}T${l.time}`
      )
        ctx.addIssue({
          code: "custom",
          message: "Arrival must follow departure",
          path: [name, "arrivalTime"],
        });
    }
    if (
      v.forward &&
      v.return &&
      `${v.return.date}T${v.return.time ?? "23:59"}` <
        `${v.forward.date}T${v.forward.time ?? "00:00"}`
    )
      ctx.addIssue({
        code: "custom",
        message: "Return precedes Forward",
        path: ["return", "date"],
      });
  });
export type WebsiteSubmission = z.infer<typeof websiteSubmissionSchema>;
