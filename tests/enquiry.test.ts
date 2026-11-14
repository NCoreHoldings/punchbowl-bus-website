import { describe, expect, it, vi } from "vitest";
import {
  createEnquiryHandler,
  type HandlerConfig,
} from "../lib/enquiry-handler";
import {
  buildSubmission,
  emptyForm,
  validateJourney,
  sydneyToday,
  type TripForm,
} from "../lib/form-data";
import { websiteSubmissionSchema } from "../lib/enquiry-schema";
import { restorePending } from "../lib/pending-request";
const form: TripForm = {
  ...emptyForm,
  date: "2035-05-14",
  time: "09:00",
  pickup: "10 Learning Street, Sydney NSW 2000",
  destination: "20 Museum Street, Sydney NSW 2000",
  passengerCount: "40",
  name: "Test coordinator",
  customerGroup: "Test school",
  email: "coordinator@example.test",
};
const config: HandlerConfig = {
  siteUrl: "http://localhost:3001",
  apiUrl: "https://ncore.example.test",
  credential: "TEST_ONLY_NOT_A_REAL_CREDENTIAL",
};
const receipt = {
  receiptId: "11111111-1111-4111-8111-111111111111",
  sourceSubmissionId: "test-request-1",
  receivedAt: "2035-01-01T00:00:00.000Z",
};
const payload = () => buildSubmission(form, "test-request-1");
describe("Uncertain submission recovery", () => {
  it("restores the original request bytes and source ID after reload", () => {
    const body = JSON.stringify({ payload: payload(), website: "" }, null, 2);
    expect(restorePending(JSON.stringify({ body, form }))).toEqual({
      body,
      form,
    });
  });
  it("rejects broken storage and inconsistent display details", () => {
    expect(restorePending("{bad")).toBeNull();
    expect(restorePending(JSON.stringify({ body: "{bad", form }))).toBeNull();
    expect(
      restorePending(
        JSON.stringify({
          body: JSON.stringify({ payload: payload(), website: "" }),
          form: { ...form, date: "bad" },
        }),
      ),
    ).toBeNull();
    expect(
      restorePending(
        JSON.stringify({
          body: JSON.stringify({ payload: payload(), website: "" }),
          form: { ...form, name: "Different person" },
        }),
      ),
    ).toBeNull();
  });
});
const req = (
  body: unknown = { payload: payload(), website: "" },
  headers: Record<string, string> = {},
) =>
  new Request("http://localhost:3001/api/enquiries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3001",
      ...headers,
    },
    body: JSON.stringify(body),
  });
function setup(status = 201, body: unknown = receipt, settings = config) {
  const upstream = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => Response.json(body, { status }));
  const allow = vi.fn().mockResolvedValue(true);
  return {
    handle: createEnquiryHandler(settings, { fetch: upstream, allow }),
    upstream,
    allow,
  };
}
describe("Public form mapping and NCore contract", () => {
  it("creates a valid one-way enquiry without inventing times or buses", () => {
    const result = buildSubmission({ ...form, time: "" }, "request-1");
    expect(websiteSubmissionSchema.parse(result)).toEqual(result);
    expect(result.forward?.time).toBeNull();
    expect(result.return).toBeNull();
    expect(result.busCount).toBeNull();
    expect(result.forward?.arrivalTime).toBeNull();
  });
  it("reverses outward locations for a return trip and preserves explicit overrides", () => {
    const result = buildSubmission(
      {
        ...form,
        tripType: "return",
        returnDate: "2035-05-14",
        returnTime: "15:00",
      },
      "request-2",
    );
    expect(result.return?.pickup.address).toBe(form.destination);
    expect(result.return?.destination.address).toBe(form.pickup);
    const override = buildSubmission(
      {
        ...form,
        tripType: "return",
        returnDate: "2035-05-15",
        returnPickup: "30 Other Street",
        returnDestination: "40 Home Street",
      },
      "request-3",
    );
    expect(override.return?.pickup.address).toBe("30 Other Street");
  });
  it("preserves vehicle, seatbelt and accessibility requests in special instructions", () => {
    const result = buildSubmission(
      {
        ...form,
        vehicle: "Coach",
        seatbelts: "Required",
        notes: "Wheelchair access to be discussed",
      },
      "request-4",
    );
    expect(result.specialInstructions).toContain("Coach");
    expect(result.specialInstructions).toContain("Required");
    expect(result.specialInstructions).toContain("Wheelchair access");
  });
  it("accepts phone-only contact and uses an individual name when no group is supplied", () => {
    const result = buildSubmission(
      { ...form, email: "", phone: "0400000001", customerGroup: "" },
      "request-5",
    );
    expect(result.contact.email).toBeNull();
    expect(result.customerGroup).toBe(form.name);
  });
  it("rejects impossible dates, past dates, return-before-departure and fractional counts", () => {
    expect(validateJourney({ ...form, date: "2035-02-30" })).toBeTruthy();
    expect(validateJourney({ ...form, date: "2000-01-01" })).toBeTruthy();
    expect(
      validateJourney({
        ...form,
        tripType: "return",
        returnDate: "2035-05-13",
      }),
    ).toBeTruthy();
    expect(validateJourney({ ...form, passengerCount: "2.5" })).toBeTruthy();
  });
  it("accepts midnight without treating it as an unknown time", () => {
    expect(
      buildSubmission({ ...form, time: "00:00" }, "midnight").forward?.time,
    ).toBe("00:00");
  });
  it("calculates dates in Sydney across the UTC day boundary", () => {
    expect(sydneyToday(new Date("2035-01-01T15:00:00Z"))).toBe("2035-01-02");
  });
  it("rejects unknown tenant fields and missing contact details", () => {
    expect(
      websiteSubmissionSchema.safeParse({ ...payload(), tenantId: "other" })
        .success,
    ).toBe(false);
    expect(() =>
      buildSubmission({ ...form, email: "", phone: "" }, "no-contact"),
    ).toThrow();
  });
});
describe("Same-origin enquiry endpoint", () => {
  it("forwards the documented payload and exposes only a verified receipt", async () => {
    const { handle, upstream } = setup();
    const res = await handle(req());
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const [url, options] = upstream.mock.calls[0];
    expect(String(url)).toBe(
      "https://ncore.example.test/api/v1/website/enquiries",
    );
    expect(options?.headers).toMatchObject({
      Authorization: `Bearer ${config.credential}`,
    });
    expect(JSON.parse(options?.body as string)).toEqual(payload());
    expect(await res.json()).toMatchObject(receipt);
  });
  it("retains the same source ID and exact content on duplicate retries", async () => {
    const { handle, upstream } = setup(200);
    const first = await handle(req());
    const second = await handle(req());
    expect(first.status).toBe(200);
    expect(await second.json()).toMatchObject(receipt);
    expect(upstream.mock.calls[0][1]?.body).toBe(
      upstream.mock.calls[1][1]?.body,
    );
  });
  it("rejects foreign and absent origins before contacting NCore", async () => {
    const { handle, upstream } = setup();
    expect(
      (await handle(req(undefined, { Origin: "https://attacker.test" })))
        .status,
    ).toBe(403);
    const request = req();
    request.headers.delete("origin");
    expect((await handle(request)).status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("rejects cross-site fetch metadata even with a matching origin", async () => {
    const { handle } = setup();
    expect(
      (await handle(req(undefined, { "sec-fetch-site": "cross-site" }))).status,
    ).toBe(403);
  });
  it("rejects unsupported content types, invalid JSON, bots and excess bodies", async () => {
    const { handle, upstream } = setup();
    expect(
      (await handle(req(undefined, { "Content-Type": "text/plain" }))).status,
    ).toBe(415);
    expect(
      (
        await handle(
          new Request("http://localhost:3001/api/enquiries", {
            method: "POST",
            headers: {
              Origin: config.siteUrl,
              "Content-Type": "application/json",
            },
            body: "{bad",
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await handle(req({ payload: payload(), website: "spam" }))).status,
    ).toBe(422);
    expect(await handle(req({ padding: "x".repeat(66000) }))).toHaveProperty(
      "status",
      413,
    );
    expect(upstream).not.toHaveBeenCalled();
  });
  it("validates the contract and blocks past journey dates server-side", async () => {
    const { handle, upstream } = setup();
    expect(
      (await handle(req({ payload: { ...payload(), tenantId: "rogue" } })))
        .status,
    ).toBe(422);
    expect(
      (
        await handle(
          req({
            payload: buildSubmission({ ...form, date: "2020-01-01" }, "past"),
          }),
        )
      ).status,
    ).toBe(422);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("fails clearly when credentials are missing", async () => {
    const { handle, upstream } = setup(201, receipt, {
      siteUrl: config.siteUrl,
    });
    const res = await handle(req());
    expect(res.status).toBe(503);
    expect(await res.json()).not.toHaveProperty("receiptId");
    expect(upstream).not.toHaveBeenCalled();
  });
  it("does not reveal credentials or upstream authentication messages", async () => {
    const { handle } = setup(401, { error: "secret internal auth details" });
    const res = await handle(req());
    const text = await res.text();
    expect(res.status).toBe(503);
    expect(text).not.toContain("internal auth");
    expect(text).not.toContain(config.credential);
  });
  it("blocks insecure production upstreams", async () => {
    const { handle, upstream } = setup(201, receipt, {
      ...config,
      apiUrl: "http://remote.example.test",
      production: true,
    });
    expect((await handle(req())).status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("enforces rate limits and fails closed when the limiter fails", async () => {
    const { handle, allow, upstream } = setup();
    allow.mockResolvedValueOnce(false);
    const res = await handle(req());
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    allow.mockRejectedValueOnce(new Error("unavailable"));
    expect((await handle(req())).status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("does not trust arbitrary forwarded IP addresses", async () => {
    const { handle, allow } = setup();
    await handle(req(undefined, { "x-forwarded-for": "1.2.3.4" }));
    expect(allow).toHaveBeenCalledWith("global");
  });
  it("uses only the explicitly configured trusted proxy header", async () => {
    const { handle, allow } = setup(201, receipt, {
      ...config,
      trustedIpHeader: "x-real-ip",
    });
    await handle(req(undefined, { "x-real-ip": "1.2.3.4" }));
    expect(allow).toHaveBeenCalledWith("ip:1.2.3.4");
  });
  it.each([409, 500, 503])(
    "keeps uncertain request identity for upstream %i",
    async (status) => {
      const { handle } = setup(status, { error: "upstream" });
      const res = await handle(req());
      expect(await res.json()).toHaveProperty("uncertain", true);
    },
  );
  it.each([422, 413, 429])(
    "maps actionable upstream status %i without success",
    async (status) => {
      const { handle } = setup(status, { error: "upstream" });
      const res = await handle(req());
      expect(res.status).toBe(status);
      expect(await res.json()).not.toHaveProperty("receiptId");
    },
  );
  it("marks network timeouts as uncertain rather than encouraging a replacement request", async () => {
    const { handle, upstream } = setup();
    upstream.mockRejectedValueOnce(
      new DOMException("Timed out", "TimeoutError"),
    );
    const res = await handle(req());
    expect(res.status).toBe(503);
    expect(await res.json()).toHaveProperty("uncertain", true);
  });
  it.each([
    { ...receipt, sourceSubmissionId: "wrong" },
    { ...receipt, receiptId: "invalid" },
    { success: true },
  ])("never accepts a malformed or mismatched receipt", async (body) => {
    const { handle } = setup(201, body);
    const res = await handle(req());
    expect(res.status).toBe(502);
    expect(await res.json()).toHaveProperty("uncertain", true);
  });
});
