import { z } from "zod";
import { websiteSubmissionSchema } from "./enquiry-schema";
import { sydneyToday } from "./form-data";
export type HandlerConfig = {
  siteUrl: string;
  apiUrl?: string;
  credential?: string;
  production?: boolean;
  trustedIpHeader?: string;
};
export type HandlerDependencies = {
  fetch: typeof fetch;
  allow: (scope: string) => Promise<boolean>;
};
const envelope = z.strictObject({
  payload: websiteSubmissionSchema,
  website: z.string().max(200).default(""),
});
const MAX = 65536;
const reply = (
  status: number,
  body: Record<string, unknown>,
  retryAfter?: string,
) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(retryAfter ? { "Retry-After": retryAfter } : {}),
    },
  });
const unavailable =
  "Online enquiries are temporarily unavailable. Please call (02) 8522 5000, or try again later.";
export function createEnquiryHandler(
  config: HandlerConfig,
  deps: HandlerDependencies,
) {
  return async function handle(request: Request) {
    let origin: string;
    try {
      origin = new URL(config.siteUrl).origin;
    } catch {
      return reply(503, { error: unavailable });
    }
    if (
      request.headers.get("origin") !== origin ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      return reply(403, {
        error: "Please submit your request from this website.",
      });
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    )
      return reply(415, { error: "Please submit the website enquiry form." });
    try {
      const header = config.trustedIpHeader?.toLowerCase();
      const client = header
        ? request.headers.get(header)?.split(",")[0].trim()
        : null;
      if (!(await deps.allow(client ? `ip:${client}` : "global")))
        return reply(
          429,
          {
            error: "Too many attempts. Please wait one minute before retrying.",
          },
          "60",
        );
    } catch {
      return reply(503, { error: unavailable });
    }
    if (Number(request.headers.get("content-length")) > MAX)
      return reply(413, {
        error: "Your request is too large. Please shorten your notes.",
      });
    let input: unknown;
    try {
      if (!request.body)
        return reply(400, { error: "Your enquiry was empty." });
      const reader = request.body.getReader();
      let size = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX) {
          await reader.cancel();
          return reply(413, {
            error: "Your request is too large. Please shorten your notes.",
          });
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      input = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return reply(400, {
        error:
          "We could not read your request. Please check the form and retry.",
      });
    }
    const parsed = envelope.safeParse(input);
    if (!parsed.success)
      return reply(422, {
        error: "Please check your journey and contact details.",
        fields: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    if (parsed.data.website)
      return reply(422, {
        error: "This request could not be accepted. Please call our team.",
      });
    const payload = parsed.data.payload;
    if ((payload.forward?.date || payload.return?.date || "") < sydneyToday())
      return reply(422, {
        error: "Please choose a journey date today or later (Sydney time).",
      });
    if (!config.apiUrl || !config.credential)
      return reply(503, { error: unavailable });
    let endpoint: URL;
    try {
      endpoint = new URL("/api/v1/website/enquiries", config.apiUrl);
      if (
        endpoint.username ||
        endpoint.password ||
        !["http:", "https:"].includes(endpoint.protocol) ||
        (config.production &&
          endpoint.protocol !== "https:" &&
          !["localhost", "127.0.0.1"].includes(endpoint.hostname))
      )
        throw new Error();
    } catch {
      return reply(503, { error: unavailable });
    }
    try {
      const upstream = await deps.fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.credential}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
        redirect: "error",
        cache: "no-store",
      });
      if (upstream.status === 200 || upstream.status === 201) {
        const receipt = z
          .object({
            receiptId: z.uuid(),
            sourceSubmissionId: z.string(),
            receivedAt: z.iso.datetime(),
          })
          .safeParse(await upstream.json());
        if (
          !receipt.success ||
          receipt.data.sourceSubmissionId !== payload.sourceSubmissionId
        )
          return reply(502, {
            error:
              "We could not verify the receipt. Retry this same request to check its status.",
            uncertain: true,
          });
        return reply(upstream.status, {
          ...receipt.data,
          message:
            "Request received. Our team will review it and contact you. Your booking is not yet confirmed.",
        });
      }
      if (upstream.status === 409)
        return reply(409, {
          error:
            "This reference already belongs to a different request. Please call (02) 8522 5000 and quote your request reference. Do not submit a replacement.",
          uncertain: true,
        });
      if (upstream.status === 422)
        return reply(422, {
          error:
            "NCore could not accept these journey details. Check your dates and times, including Sydney daylight saving changes, or call our team.",
        });
      if (upstream.status === 413)
        return reply(413, {
          error: "Your request is too large. Please shorten your notes.",
        });
      if (upstream.status === 429)
        return reply(
          429,
          {
            error:
              "The enquiry service is busy. Please wait before retrying the same request.",
          },
          "60",
        );
      if (upstream.status === 401 || upstream.status === 403)
        return reply(503, { error: unavailable });
      return reply(503, {
        error:
          "The enquiry service is unavailable. Your request may have reached us. Retry the same request to check.",
        uncertain: true,
      });
    } catch {
      return reply(503, {
        error:
          "We could not confirm receipt. Your request may have reached us. Retry the same request to check, or call (02) 8522 5000.",
        uncertain: true,
      });
    }
  };
}
