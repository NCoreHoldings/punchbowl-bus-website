import type { jsPDF } from "jspdf";
import { company } from "./content";
import {
  activeBusRoutes,
  differentRoutes,
  RECURRENCE_OPTIONS,
  returnRoute,
  tripTypeLabel,
  type TripForm,
} from "./form-data";
import { pointLabel, type TripPoint } from "./itinerary";

/** What the PDF knows about where the request stands. */
export type RequestPdfStatus = {
  /** The request reference (sourceSubmissionId), once the request is sent. */
  reference?: string;
  /** Present once our team has confirmed receipt. */
  receipt?: { receiptId: string; receivedAt: string };
  /** When the PDF was made; defaults to now. */
  preparedAt?: Date;
};

export type PdfRow = { label: string; value: string };
export type PdfRoute = { title: string; note?: string; points: TripPoint[] };
export type PdfSection =
  | { kind: "rows"; title: string; rows: PdfRow[] }
  | { kind: "route"; title: string; routes: PdfRoute[] }
  | { kind: "text"; title: string; text: string };

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const DATE_LABEL: Record<TripForm["tripType"], string> = {
  one_way: "Departure date",
  round_trip: "Departure date",
  repeatable: "First trip date",
  shuttle: "Shuttle date",
};
const TIME_LABEL: Record<TripForm["tripType"], string> = {
  one_way: "Departure time",
  round_trip: "Departure time",
  repeatable: "Pickup time (each trip)",
  shuttle: "First pickup",
};

export function longDate(s: string) {
  if (!s) return "Not specified";
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${s}T12:00:00Z`));
}
/** "14:30" → "2:30 pm". */
export function clockTime(s: string, fallback = "To be discussed") {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return s || fallback;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "am" : "pm"}`;
}
function sydneyDateTime(d: Date) {
  return `${new Intl.DateTimeFormat("en-AU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(d)} (Sydney)`;
}

/** The request laid out as PDF sections, in the order of the review step. */
export function requestSections(form: TripForm): PdfSection[] {
  const separate = differentRoutes(form);
  const trip: PdfRow[] = [
    { label: "Trip type", value: tripTypeLabel(form.tripType) },
    {
      label: "Passengers",
      value: form.passengerCount || "Not specified",
    },
    {
      label: "Buses",
      value: form.busCount
        ? `${form.busCount}${separate ? " (a different route for each bus)" : ""}`
        : "To be advised",
    },
    { label: "Vehicle preference", value: form.vehicle },
  ];

  const schedule: PdfRow[] = [
    { label: `${DATE_LABEL[form.tripType]}`, value: longDate(form.date) },
    { label: TIME_LABEL[form.tripType], value: clockTime(form.time) },
  ];
  if (form.tripType === "shuttle")
    schedule.push({
      label: "Everyone delivered by",
      value: clockTime(form.finishTime),
    });
  if (form.tripType === "repeatable") {
    schedule.push({
      label: "Repeats",
      value:
        form.recurrenceType === "weekly"
          ? `Weekly on ${[1, 2, 3, 4, 5, 6, 0]
              .filter((d) => form.recurrenceDays.includes(d))
              .map((d) => WEEKDAY_NAMES[d])
              .join(", ")}`
          : RECURRENCE_OPTIONS.find((o) => o.value === form.recurrenceType)!
              .label,
    });
    schedule.push({
      label: "Last trip date",
      value: longDate(form.recurrenceEndDate),
    });
  }
  if (form.tripType === "round_trip") {
    schedule.push({ label: "Return date", value: longDate(form.returnDate) });
    schedule.push({ label: "Return time", value: clockTime(form.returnTime) });
  }
  schedule.push({
    label: "Time zone",
    value: "All dates and times are Sydney local time",
  });

  const routes: PdfRoute[] = [
    {
      title:
        form.tripType === "shuttle"
          ? "Shuttle route"
          : separate
            ? "Bus 1 route"
            : "Outward route",
      points: form.outbound,
    },
  ];
  if (form.tripType === "round_trip")
    routes.push({
      title: "Return route",
      note: form.returnReversed ? "The outward route in reverse" : undefined,
      points: returnRoute(form),
    });
  if (separate)
    activeBusRoutes(form).forEach((bus, i) =>
      routes.push({
        title: `Bus ${i + 2} route`,
        note:
          `Departs ${clockTime(bus.time || form.time)}` +
          (form.tripType === "round_trip"
            ? ` · returns ${clockTime(bus.returnTime || form.returnTime)} along this route in reverse`
            : ""),
        points: bus.route,
      }),
    );

  const contact: PdfRow[] = [{ label: "Contact name", value: form.name }];
  if (form.customerGroup)
    contact.push({ label: "Organisation / group", value: form.customerGroup });
  if (form.email) contact.push({ label: "Email", value: form.email });
  if (form.phone) contact.push({ label: "Phone", value: form.phone });

  const sections: PdfSection[] = [
    { kind: "rows", title: "Contact details", rows: contact },
    { kind: "rows", title: "Trip overview", rows: trip },
    { kind: "rows", title: "Schedule", rows: schedule },
    { kind: "route", title: routes.length > 1 ? "Routes" : "Route", routes },
  ];
  if (form.notes.trim())
    sections.push({
      kind: "text",
      title: "Additional details",
      text: form.notes.trim(),
    });
  return sections;
}

export function requestPdfFilename(form: TripForm, status: RequestPdfStatus) {
  const stamp =
    status.receipt?.receiptId ||
    status.reference?.replace(/^pbc-/, "").slice(0, 8) ||
    form.date ||
    "draft";
  return `punchbowl-bus-quote-request-${stamp.replace(/[^\w-]+/g, "-")}.pdf`;
}

// The built-in PDF fonts cover Windows-1252 only; anything else would print as
// gibberish, so accents are folded and other characters become "?".
const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
export function pdfSafe(text: string) {
  return text
    .replace(/→/g, "->")
    .replace(/[‘’]/g, "'")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\n\t\x20-\x7e\xa0-\xff]/g, (c) =>
      CP1252_EXTRA.includes(c) ? c : "?",
    );
}

type RGB = [number, number, number];
const RED: RGB = [181, 31, 43];
const INK: RGB = [20, 22, 27];
const TEXT: RGB = [43, 46, 53];
const MUTED: RGB = [93, 98, 108];
const LINE: RGB = [226, 220, 207];
const CREAM: RGB = [244, 238, 226];
const WARN: RGB = [246, 239, 220];

const PAGE_W = 210;
const PAGE_H = 297;
const M = 18; // margin
const CONTENT_W = PAGE_W - M * 2;
const BOTTOM = PAGE_H - 24;

/** Builds the quote request PDF. Runs in the browser; jsPDF loads on demand. */
export async function createRequestPdf(
  form: TripForm,
  status: RequestPdfStatus = {},
): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const prepared = status.preparedAt ?? new Date();
  doc.setProperties({
    title: `Quote request – ${company.name}`,
    subject: "Charter quote request",
    author: company.name,
    creator: company.name,
  });

  let y = 0;
  const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const font = (style: "normal" | "bold", size: number, c: RGB = TEXT) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    color(c);
  };
  const lines = (text: string, width: number) =>
    doc.splitTextToSize(pdfSafe(text), width) as string[];
  const lineH = (size: number) => size * 0.3528 * 1.35;
  const continuationHeader = () => {
    doc.setFillColor(...RED);
    doc.rect(0, 0, PAGE_W, 4, "F");
    font("bold", 9, INK);
    doc.text(pdfSafe(company.name.toUpperCase()), M, 14);
    font("normal", 9, MUTED);
    doc.text("Quote request (continued)", PAGE_W - M, 14, { align: "right" });
    doc.setDrawColor(...LINE);
    doc.line(M, 18, PAGE_W - M, 18);
    y = 26;
  };
  /** Start a new page when `height` would not fit. */
  const room = (height: number) => {
    if (y + height <= BOTTOM) return;
    doc.addPage();
    continuationHeader();
  };

  // ---- Letterhead ----
  doc.setFillColor(...INK);
  doc.rect(0, 0, PAGE_W, 38, "F");
  doc.setFillColor(...RED);
  doc.rect(0, 38, PAGE_W, 2.2, "F");
  font("bold", 18, [255, 255, 255]);
  doc.text(pdfSafe(company.name), M, 17);
  font("normal", 9.5, [212, 174, 100]);
  doc.text("CHARTER QUOTE REQUEST", M, 25);
  font("normal", 8.5, [220, 222, 226]);
  const contactLines = [
    company.address,
    `${company.phone} · ${company.hours}`,
    company.source.replace(/^https?:\/\//, ""),
  ];
  contactLines.forEach((l, i) =>
    doc.text(pdfSafe(l), PAGE_W - M, 14 + i * 5, { align: "right" }),
  );
  y = 52;

  // ---- Title and status ----
  font("bold", 20, INK);
  doc.text("Quote request", M, y);
  font("normal", 9.5, MUTED);
  doc.text(`Prepared ${pdfSafe(sydneyDateTime(prepared))}`, PAGE_W - M, y, {
    align: "right",
  });
  y += 8;

  const refRows: PdfRow[] = [];
  if (status.receipt) {
    refRows.push({ label: "Receipt ID", value: status.receipt.receiptId });
    refRows.push({
      label: "Received",
      value: sydneyDateTime(new Date(status.receipt.receivedAt)),
    });
  }
  if (status.reference)
    refRows.push({ label: "Request reference", value: status.reference });
  refRows.push({
    label: "Status",
    value: status.receipt
      ? "Received by our team – awaiting review"
      : status.reference
        ? "Sent – receipt not yet confirmed"
        : "Not yet sent",
  });
  const boxH = 8 + refRows.length * 6;
  doc.setFillColor(...CREAM);
  doc.roundedRect(M, y, CONTENT_W, boxH, 2.5, 2.5, "F");
  let ry = y + 7;
  for (const r of refRows) {
    font("bold", 8, MUTED);
    doc.text(r.label.toUpperCase(), M + 6, ry);
    font("normal", 10, INK);
    doc.text(lines(r.value, CONTENT_W - 60)[0] ?? "", M + 52, ry);
    ry += 6;
  }
  y += boxH + 10;

  // ---- Sections ----
  /** A heading, kept on the same page as the first `next` mm below it. */
  const sectionTitle = (title: string, next = 10) => {
    room(9 + next);
    font("bold", 11, RED);
    doc.text(pdfSafe(title.toUpperCase()), M, y);
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.4);
    doc.line(M, y + 2, PAGE_W - M, y + 2);
    doc.setLineWidth(0.2);
    y += 9;
  };
  const LABEL_W = 52;
  const rowsBlock = (rows: PdfRow[]) => {
    for (const r of rows) {
      const value = lines(r.value || "–", CONTENT_W - LABEL_W);
      const label = lines(r.label, LABEL_W - 4);
      const h = Math.max(value.length, label.length) * lineH(10) + 3;
      room(h);
      font("bold", 9, MUTED);
      doc.text(label, M, y);
      font("normal", 10, TEXT);
      doc.text(value, M + LABEL_W, y);
      y += h;
      doc.setDrawColor(...LINE);
      doc.line(M, y - 2.4, PAGE_W - M, y - 2.4);
      y += 1.2;
    }
    y += 5;
  };
  const NUM_W = 9;
  const KIND_W = 30;
  const locW = CONTENT_W - NUM_W - KIND_W - 3;
  const tableHead = () => {
    doc.setFillColor(...INK);
    doc.rect(M, y, CONTENT_W, 7, "F");
    font("bold", 8, [255, 255, 255]);
    doc.text("#", M + 3, y + 4.7);
    doc.text("POINT", M + NUM_W, y + 4.7);
    doc.text("LOCATION AND ACCESS NOTES", M + NUM_W + KIND_W, y + 4.7);
    y += 7;
  };
  const routeRows = (route: PdfRoute) =>
    route.points.map((p) => {
      const name =
        p.name && !p.address.startsWith(p.name) ? lines(p.name, locW) : [];
      const address = lines(p.address || "Address not provided", locW);
      const notes = p.notes.trim()
        ? lines(`Access: ${p.notes.trim()}`, locW)
        : [];
      const h =
        name.length * lineH(10) +
        address.length * lineH(9.5) +
        notes.length * lineH(8.5) +
        5;
      return { name, address, notes, h };
    });
  /** Height to keep together: the whole route when it fits on a page. */
  const routeStart = (route: PdfRoute) => {
    const total = 11 + routeRows(route).reduce((sum, r) => sum + r.h, 0);
    return total <= BOTTOM - 26 ? total : 60;
  };
  const routeBlock = (route: PdfRoute) => {
    const rows = routeRows(route);
    room(routeStart(route));
    font("bold", 10.5, INK);
    const title = pdfSafe(route.title);
    doc.text(title, M, y);
    if (route.note) {
      const w = doc.getTextWidth(title) + 3;
      font("normal", 9, MUTED);
      doc.text(lines(`– ${route.note}`, CONTENT_W - w)[0], M + w, y);
    }
    y += 4;
    tableHead();
    rows.forEach((r, i) => {
      if (y + r.h > BOTTOM) {
        doc.addPage();
        continuationHeader();
        font("bold", 9, MUTED);
        doc.text(`${title} (continued)`, M, y);
        y += 3;
        tableHead();
      }
      if (i % 2 === 1) {
        doc.setFillColor(250, 247, 241);
        doc.rect(M, y, CONTENT_W, r.h, "F");
      }
      let cy = y + 5;
      font("bold", 9.5, RED);
      doc.text(String(i + 1), M + 3, cy);
      font("bold", 9, INK);
      doc.text(pointLabel(i, rows.length), M + NUM_W, cy);
      const x = M + NUM_W + KIND_W;
      if (r.name.length) {
        font("bold", 10, INK);
        doc.text(r.name, x, cy);
        cy += r.name.length * lineH(10);
      }
      font("normal", 9.5, TEXT);
      doc.text(r.address, x, cy);
      cy += r.address.length * lineH(9.5);
      if (r.notes.length) {
        font("normal", 8.5, MUTED);
        doc.text(r.notes, x, cy);
      }
      y += r.h;
      doc.setDrawColor(...LINE);
      doc.line(M, y, PAGE_W - M, y);
    });
    y += 8;
  };

  for (const s of requestSections(form)) {
    sectionTitle(s.title, s.kind === "route" ? routeStart(s.routes[0]) : 10);
    if (s.kind === "rows") rowsBlock(s.rows);
    else if (s.kind === "route") s.routes.forEach(routeBlock);
    else {
      font("normal", 10, TEXT);
      for (const l of lines(s.text, CONTENT_W)) {
        room(lineH(10));
        doc.text(l, M, y);
        y += lineH(10);
      }
      y += 6;
    }
  }

  // ---- Important notice ----
  const notice = lines(
    "This document is a record of a quote request. It is not a booking confirmation. " +
      `Availability, pricing and arrangements will be confirmed by the ${company.name} team. ` +
      `For changes, call ${company.phone} and quote your reference.`,
    CONTENT_W - 12,
  );
  const nh = notice.length * lineH(9) + 12;
  room(nh);
  doc.setFillColor(...WARN);
  doc.roundedRect(M, y, CONTENT_W, nh, 2.5, 2.5, "F");
  doc.setFillColor(...RED);
  doc.rect(M, y, 1.4, nh, "F");
  font("bold", 9.5, INK);
  doc.text("Please note", M + 6, y + 6.5);
  font("normal", 9, TEXT);
  doc.text(notice, M + 6, y + 6.5 + lineH(9.5));

  // ---- Footer on every page ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.line(M, PAGE_H - 15, PAGE_W - M, PAGE_H - 15);
    font("normal", 8, MUTED);
    doc.text(
      pdfSafe(`${company.name} · ${company.address} · ${company.phone}`),
      M,
      PAGE_H - 10,
    );
    doc.text(`Page ${i} of ${pages}`, PAGE_W - M, PAGE_H - 10, {
      align: "right",
    });
  }
  return doc;
}

/** Builds the PDF and hands it to the browser as a download. */
export async function downloadRequestPdf(
  form: TripForm,
  status: RequestPdfStatus = {},
) {
  const doc = await createRequestPdf(form, status);
  doc.save(requestPdfFilename(form, status));
}
