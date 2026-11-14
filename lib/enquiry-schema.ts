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
export const websiteSubmissionSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
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
  })
  .superRefine((v, ctx) => {
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
