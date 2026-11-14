import { buildSubmission, emptyForm, type TripForm } from "./form-data";
import { websiteSubmissionSchema } from "./enquiry-schema";
export type PendingRequest = { body: string; form: TripForm };
/** Preserve the original request bytes, but never hydrate a corrupted browser draft. */
export function restorePending(raw: string): PendingRequest | null {
  try {
    const value = JSON.parse(raw) as PendingRequest;
    if (
      typeof value.body !== "string" ||
      !value.form ||
      !Object.keys(emptyForm).every(
        (key) => typeof value.form[key as keyof TripForm] === "string",
      )
    )
      return null;
    const envelope = JSON.parse(value.body);
    const parsed = websiteSubmissionSchema.safeParse(envelope.payload);
    if (!parsed.success || typeof envelope.website !== "string") return null;
    const displayed = buildSubmission(
      value.form,
      parsed.data.sourceSubmissionId,
    );
    if (JSON.stringify(displayed) !== JSON.stringify(parsed.data)) return null;
    return value;
  } catch {
    return null;
  }
}
