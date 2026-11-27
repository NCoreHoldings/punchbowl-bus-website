import { describe, expect, it, vi } from "vitest";
import {
  createEnquiryHandler,
  type HandlerConfig,
} from "../lib/enquiry-handler";
import {
  buildSubmission,
  countInput,
  emptyForm,
  withBusRoutes,
  validateJourney,
  sydneyToday,
  type TripForm,
} from "../lib/form-data";
import { websiteSubmissionSchema } from "../lib/enquiry-schema";
import { restorePending } from "../lib/pending-request";
import { newPoint, type TripPoint } from "../lib/itinerary";
const route = (...addresses: string[]): TripPoint[] =>
  addresses.map((address) => newPoint({ address }));
const PICKUP = "10 Learning Street, Sydney NSW 2000";
const DROPOFF = "20 Museum Street, Sydney NSW 2000";
const form: TripForm = {
  ...emptyForm,
  date: "2035-05-14",
  time: "09:00",
  outbound: route(PICKUP, DROPOFF),
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
        tripType: "round_trip",
        returnDate: "2035-05-14",
        returnTime: "15:00",
      },
      "request-2",
    );
    expect(result.return?.pickup.address).toBe(DROPOFF);
    expect(result.return?.destination.address).toBe(PICKUP);
    const override = buildSubmission(
      {
        ...form,
        tripType: "round_trip",
        returnDate: "2035-05-15",
        returnReversed: false,
        inbound: route("30 Other Street", "40 Home Street"),
      },
      "request-3",
    );
    expect(override.return?.pickup.address).toBe("30 Other Street");
  });
  it("sends NCore's booking type for every trip type", () => {
    expect(buildSubmission(form, "t1")).toMatchObject({
      schemaVersion: 2,
      tripType: "one_way",
      return: null,
      recurrence: null,
    });
    // Return details left over from another type are never sent.
    const leftover = { ...form, returnDate: "2035-05-15" };
    expect(
      buildSubmission({ ...leftover, tripType: "shuttle" }, "t2").return,
    ).toBeNull();
  });
  it("maps a recurring trip's schedule and checks it like New Booking", () => {
    const weekly: TripForm = {
      ...form,
      tripType: "repeatable",
      recurrenceType: "weekly",
      recurrenceDays: [3, 1],
      recurrenceEndDate: "2035-08-30",
    };
    expect(validateJourney(weekly)).toBeNull();
    expect(buildSubmission(weekly, "r1")).toMatchObject({
      tripType: "repeatable",
      return: null,
      forward: { date: "2035-05-14", time: "09:00" },
      recurrence: { type: "weekly", days: [1, 3], endDate: "2035-08-30" },
    });
    expect(
      buildSubmission({ ...weekly, recurrenceType: "monthly" }, "r2").recurrence,
    ).toEqual({ type: "monthly", days: [], endDate: "2035-08-30" });
    expect(validateJourney({ ...weekly, recurrenceDays: [] })).toMatch(
      /day of the week/,
    );
    expect(validateJourney({ ...weekly, recurrenceEndDate: "" })).toMatch(
      /last trip/,
    );
    expect(
      validateJourney({ ...weekly, recurrenceEndDate: "2035-05-13" }),
    ).toMatch(/last trip/);
    expect(
      validateJourney({ ...weekly, recurrenceEndDate: "2036-05-15" }),
    ).toMatch(/up to one year/);
  });
  it("maps a shuttle's time window to the first pickup and final arrival", () => {
    const shuttle: TripForm = {
      ...form,
      tripType: "shuttle",
      passengerCount: "300",
      finishTime: "11:30",
    };
    expect(validateJourney(shuttle)).toBeNull();
    expect(buildSubmission(shuttle, "s1")).toMatchObject({
      tripType: "shuttle",
      passengerCount: 300,
      forward: {
        date: "2035-05-14",
        time: "09:00",
        arrivalDate: "2035-05-14",
        arrivalTime: "11:30",
      },
    });
    expect(validateJourney({ ...shuttle, finishTime: "08:00" })).toMatch(
      /finish time/,
    );
    expect(
      buildSubmission({ ...shuttle, finishTime: "" }, "s2").forward,
    ).toMatchObject({ arrivalDate: null, arrivalTime: null });
  });
  it("accepts typed counts as whole numbers only", () => {
    expect(countInput("12", 5)).toBe("12");
    expect(countInput("1e3", 5)).toBe("13");
    expect(countInput("-4.5 people", 5)).toBe("45");
    expect(countInput("007", 5)).toBe("7");
    expect(countInput("0", 5)).toBe("0");
    expect(countInput("123456", 5)).toBe("12345");
    expect(validateJourney({ ...form, passengerCount: "0" })).toMatch(
      /passenger count/,
    );
    expect(validateJourney({ ...form, busCount: "101" })).toMatch(/100 buses/);
  });
  it("sends a different route for each bus", () => {
    const two = withBusRoutes({
      ...form,
      tripType: "round_trip",
      returnDate: "2035-05-14",
      returnTime: "15:00",
      busCount: "2",
      routeMode: "different",
    });
    const bus2 = { ...two.busRoutes[0], route: route("30 Second School Rd", DROPOFF) };
    expect(validateJourney(two)).toMatch(/pickup point on the route for bus 2/);
    const ready = { ...two, busRoutes: [{ ...bus2, time: "08:30" }] };
    expect(validateJourney(ready)).toBeNull();
    const result = buildSubmission(ready, "b1");
    expect(result.busCount).toBe(2);
    expect(result.otherBuses).toEqual([
      {
        time: "08:30",
        returnTime: "15:00",
        pickup: { address: "30 Second School Rd" },
        destination: { address: DROPOFF },
        stops: [],
      },
    ]);
    expect(
      validateJourney({ ...ready, busRoutes: [{ ...bus2, time: "16:00" }] }),
    ).toMatch(/return time for bus 2/);
    // With one shared route, no other buses are sent.
    const same = buildSubmission({ ...ready, routeMode: "same" }, "b2");
    expect(same.otherBuses).toBeNull();
    // Shuttles always share one route.
    expect(
      buildSubmission({ ...ready, tripType: "shuttle" }, "b3").otherBuses,
    ).toBeNull();
    // Bus 2 with no time of its own leaves with bus 1.
    expect(
      buildSubmission({ ...ready, busRoutes: [bus2] }, "b4").otherBuses?.[0]
        .time,
    ).toBe("09:00");
    expect(
      validateJourney(withBusRoutes({ ...ready, busCount: "21" })),
    ).toMatch(/up to 20 buses/);
  });
  it("needs a weekly trip's first date to be one of its days, as NCore schedules", () => {
    // 2035-05-14 is a Monday.
    expect(
      validateJourney({
        ...form,
        tripType: "repeatable",
        recurrenceType: "weekly",
        recurrenceDays: [3],
        recurrenceEndDate: "2035-06-30",
      }),
    ).toMatch(/first trip is on a Monday/);
  });
  it("keeps the contract's trip type rules consistent with the legs", () => {
    const base = buildSubmission(form, "c1");
    const bad = [
      { ...base, schemaVersion: 1 },
      { ...base, tripType: "round_trip" },
      { ...base, tripType: "repeatable" },
      { ...base, tripType: "shuttle", passengerCount: null },
      {
        ...base,
        recurrence: { type: "daily", days: [], endDate: "2035-06-01" },
      },
    ];
    for (const v of bad)
      expect(websiteSubmissionSchema.safeParse(v).success).toBe(false);
    // Version 1 enquiries without a trip type stay valid.
    const { tripType: _t, recurrence: _r, ...v1 } = base;
    expect(
      websiteSubmissionSchema.safeParse({ ...v1, schemaVersion: 1 }).success,
    ).toBe(true);
  });
  it("maps passenger stops in order, venue names and coach access notes", () => {
    const outbound = [
      newPoint({ name: "Punchbowl Public School", address: "1 School Rd, Punchbowl NSW 2196, Australia", notes: "Gate 3", lat: -33.92, lng: 151.05 }),
      newPoint({ address: "5 Stop St, Bankstown NSW 2200" }),
      newPoint({ name: "Museum", address: "Museum, 20 Museum St, Sydney NSW 2000" }),
      newPoint({ address: DROPOFF }),
    ];
    const result = buildSubmission({ ...form, outbound, tripType: "round_trip", returnDate: "2035-05-14", returnTime: "15:00" }, "stops");
    expect(result.forward?.pickup).toEqual({ name: "Punchbowl Public School", address: "1 School Rd, Punchbowl NSW 2196, Australia", instructions: "Gate 3" });
    expect(result.forward?.stops.map((s) => s.address)).toEqual(["5 Stop St, Bankstown NSW 2200", "Museum, 20 Museum St, Sydney NSW 2000"]);
    // A name already at the start of the address isn't repeated; coordinates are never sent.
    expect(result.forward?.stops[1]).toEqual({ address: "Museum, 20 Museum St, Sydney NSW 2000" });
    expect(JSON.stringify(result)).not.toContain("151.05");
    expect(result.return?.pickup.address).toBe(DROPOFF);
    expect(result.return?.stops.map((s) => s.address)).toEqual(["Museum, 20 Museum St, Sydney NSW 2000", "5 Stop St, Bankstown NSW 2200"]);
  });
  it("names the empty point when an address is missing", () => {
    expect(validateJourney({ ...form, outbound: route(PICKUP, "", DROPOFF) })).toMatch(/passenger stop 2/);
    expect(validateJourney({ ...form, outbound: route("", DROPOFF) })).toMatch(/pickup point/);
    expect(validateJourney({ ...form, tripType: "round_trip", returnDate: "2035-05-15", returnReversed: false, inbound: route(DROPOFF, "") })).toMatch(/drop-off on the return/);
  });
  it("preserves vehicle and accessibility requests in special instructions, with no seat belt question", () => {
    const result = buildSubmission(
      {
        ...form,
        vehicle: "Coach",
        notes: "Wheelchair access to be discussed",
      },
      "request-4",
    );
    expect(result.specialInstructions).toContain("Vehicle preference: Coach");
    expect(result.specialInstructions).not.toMatch(/seat ?belt/i);
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
        tripType: "round_trip",
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
