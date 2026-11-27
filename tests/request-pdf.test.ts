import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emptyForm, withBusRoutes, type TripForm } from "../lib/form-data";
import { newPoint, type TripPoint } from "../lib/itinerary";
import {
  clockTime,
  createRequestPdf,
  pdfSafe,
  requestPdfFilename,
  requestSections,
} from "../lib/request-pdf";

const route = (...addresses: string[]): TripPoint[] =>
  addresses.map((address) => newPoint({ address }));
const form: TripForm = {
  ...emptyForm,
  tripType: "round_trip",
  date: "2035-05-14",
  time: "09:00",
  returnDate: "2035-05-14",
  returnTime: "15:30",
  outbound: [
    newPoint({
      name: "Test School",
      address: "10 Learning Street, Sydney NSW 2000",
      notes: "Coach bay on the north side",
    }),
    ...route("5 Stop Road, Sydney NSW 2000", "20 Museum Street, Sydney NSW 2000"),
  ],
  passengerCount: "40",
  busCount: "1",
  name: "Test coordinator",
  customerGroup: "Test school",
  email: "coordinator@example.test",
  notes: "Two wheelchair users.",
};
const receipt = {
  receiptId: "11111111-1111-4111-8111-111111111111",
  receivedAt: "2035-01-01T00:00:00.000Z",
};

describe("Quote request PDF", () => {
  it("lays out the request like the review step", () => {
    const sections = requestSections(form);
    expect(sections.map((s) => s.title)).toEqual([
      "Trip overview",
      "Schedule",
      "Routes",
      "Contact details",
      "Additional details",
    ]);
    const routes = sections.find((s) => s.kind === "route");
    expect(routes?.kind === "route" && routes.routes.map((r) => r.title)).toEqual(
      ["Outward route", "Return route"],
    );
    const schedule = sections[1].kind === "rows" ? sections[1].rows : [];
    expect(schedule).toContainEqual({
      label: "Departure date",
      value: "Monday 14 May 2035",
    });
    expect(schedule).toContainEqual({ label: "Return time", value: "3:30 pm" });
  });

  it("lists each bus's own route", () => {
    const multi = withBusRoutes({
      ...form,
      tripType: "one_way",
      busCount: "3",
      routeMode: "different",
    });
    const routes = requestSections(multi).find((s) => s.kind === "route");
    expect(routes?.kind === "route" && routes.routes.map((r) => r.title)).toEqual(
      ["Bus 1 route", "Bus 2 route", "Bus 3 route"],
    );
  });

  it("keeps text within the PDF font's character set", () => {
    expect(pdfSafe("Café → Zoë’s 北京")).toBe("Cafe -> Zoe's ??");
    expect(clockTime("00:05")).toBe("12:05 am");
    expect(clockTime("")).toBe("To be discussed");
  });

  it("names the file after the receipt", () => {
    expect(requestPdfFilename(form, { receipt })).toBe(
      `punchbowl-bus-quote-request-${receipt.receiptId}.pdf`,
    );
    expect(requestPdfFilename(form, {})).toBe(
      "punchbowl-bus-quote-request-2035-05-14.pdf",
    );
  });

  it("builds a multi-page PDF for long requests", async () => {
    const long: TripForm = {
      ...form,
      outbound: route(
        ...Array.from({ length: 22 }, (_, i) => `${i + 1} Long Street, Sydney NSW 2000`),
      ),
      returnReversed: true,
      notes: "Details. ".repeat(400),
    };
    const doc = await createRequestPdf(long, {
      reference: "pbc-test",
      receipt,
      preparedAt: new Date("2035-01-01T00:00:00Z"),
    });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    const bytes = doc.output("arraybuffer");
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    if (process.env.PDF_SAMPLE_DIR) {
      writeFileSync(`${process.env.PDF_SAMPLE_DIR}/long.pdf`, Buffer.from(bytes));
      const short = await createRequestPdf(form, { reference: "pbc-test", receipt });
      writeFileSync(
        `${process.env.PDF_SAMPLE_DIR}/short.pdf`,
        Buffer.from(short.output("arraybuffer")),
      );
    }
  });
});
