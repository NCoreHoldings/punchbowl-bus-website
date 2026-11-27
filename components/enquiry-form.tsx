"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  FileDown,
  LoaderCircle,
} from "lucide-react";
import {
  activeBusRoutes,
  asksSeatbelts,
  buildSubmission,
  countInput,
  differentRoutes,
  freshForm,
  MAX_SEPARATE_ROUTE_BUSES,
  withBusRoutes,
  type BusRoute,
  RECURRENCE_OPTIONS,
  returnRoute,
  sydneyToday,
  TRIP_TYPE_OPTIONS,
  tripTypeLabel,
  validateJourney,
  WEEKDAYS,
  type RecurrenceType,
  type TripForm,
} from "@/lib/form-data";
import {
  loadGoogleMaps,
  onMapsAuthFailure,
  type MapsConfig,
  type MapsService,
} from "@/lib/google-maps";
import { pointLabel, reverseRoute, type TripPoint } from "@/lib/itinerary";
import { ItineraryEditor } from "./itinerary-editor";
import { company } from "@/lib/content";
import { restorePending, type PendingRequest } from "@/lib/pending-request";
import { downloadRequestPdf, type RequestPdfStatus } from "@/lib/request-pdf";
const STORAGE = "punchbowl-pending-enquiry-v1";
type Pending = PendingRequest;
type Receipt = { receiptId: string; receivedAt: string };
type TextKey = {
  [K in keyof TripForm]: TripForm[K] extends string ? K : never;
}[keyof TripForm];
export function EnquiryForm() {
  const [form, setForm] = useState<TripForm>(freshForm);
  const [maps, setMaps] = useState<MapsService | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  /** The request exactly as sent, kept for its PDF after the form clears. */
  const [sent, setSent] = useState<{ form: TripForm; reference: string } | null>(
    null,
  );
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [consent, setConsent] = useState(false);
  const [wait, setWait] = useState(0);
  const [conflict, setConflict] = useState(false);
  const pending = useRef<Pending | null>(null);
  const busyRef = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/enquiries", { cache: "no-store" })
      .then((r) => r.json())
      .then((v) => {
        if (!active) return;
        setAvailable(v.available === true);
        const config = v.maps as MapsConfig | null;
        if (config?.key)
          loadGoogleMaps(config)
            .then((service) => {
              if (active) setMaps(service);
            })
            .catch(() => {
              /* Maps is optional: plain address fields remain. */
            });
      })
      .catch(() => {
        if (active) setAvailable(false);
      });
    try {
      const saved = sessionStorage.getItem(STORAGE);
      if (saved) {
        const p = restorePending(saved);
        if (p) {
          pending.current = p;
          setForm(p.form);
          setLocked(true);
          setStep(2);
          setConsent(true);
          setError(
            "A previous request has an unconfirmed result. Retry the unchanged request to retrieve its receipt.",
          );
        }
      }
    } catch {
      /* Storage may be disabled; in-memory retries remain available. */
    }
    const stopAuth = onMapsAuthFailure(() => setMaps(null));
    return () => {
      active = false;
      stopAuth();
    };
  }, []);
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  function update<K extends keyof TripForm>(key: K, value: TripForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }
  function changeStep(next: number) {
    setStep(next);
    setError("");
    setTimeout(() => titleRef.current?.focus(), 0);
  }
  function validateContact() {
    if (!form.name.trim()) return "Please enter your contact name.";
    if (!form.email.trim() && !form.phone.trim())
      return "Please enter an email address or phone number so we can contact you.";
    try {
      buildSubmission(form, "validate");
      return null;
    } catch {
      return "Please check your email address, contact details and notes.";
    }
  }
  function next() {
    const issue = step === 0 ? validateJourney(form) : validateContact();
    if (issue) {
      setError(issue);
      return;
    }
    changeStep(step + 1);
  }
  function clearPending() {
    pending.current = null;
    setLocked(false);
    try {
      sessionStorage.removeItem(STORAGE);
    } catch {}
  }
  async function submit() {
    if (busyRef.current || wait > 0 || conflict) return;
    if (!consent) {
      setError("Please acknowledge how your request will be handled.");
      return;
    }
    if (!pending.current) {
      const issue = validateJourney(form) || validateContact();
      if (issue) {
        setError(issue);
        return;
      }
      try {
        pending.current = {
          body: JSON.stringify({
            payload: buildSubmission(form, `pbc-${crypto.randomUUID()}`),
            website: form.website,
          }),
          form: { ...form },
        };
      } catch {
        setError("Please check your request details.");
        return;
      }
    }
    const snapshot = pending.current;
    try {
      sessionStorage.setItem(STORAGE, JSON.stringify(snapshot));
    } catch {}
    busyRef.current = true;
    setBusy(true);
    setLocked(true);
    setError("");
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: snapshot.body,
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (
        response.ok &&
        typeof result.receiptId === "string" &&
        typeof result.receivedAt === "string"
      ) {
        setSent({
          form: snapshot.form,
          reference: JSON.parse(snapshot.body).payload.sourceSubmissionId,
        });
        setReceipt(result);
        clearPending();
        return;
      }
      setError(
        result.error ||
          "We could not confirm receipt. Please retry the unchanged request.",
      );
      if (response.status === 429)
        setWait(
          Math.min(
            300,
            Math.max(1, Number(response.headers.get("Retry-After")) || 60),
          ),
        );
      if (response.status === 409) setConflict(true);
      if (!result.uncertain && response.status !== 429) clearPending();
    } catch {
      setError(
        "We could not confirm receipt. Your request may have reached us. Retry the unchanged request, or call our team with your reference.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function savePdf(source: TripForm, status: RequestPdfStatus) {
    if (pdfBusy) return;
    setPdfBusy(true);
    setPdfError("");
    try {
      await downloadRequestPdf(source, status);
    } catch {
      setPdfError("The PDF could not be created. Please try again.");
    } finally {
      setPdfBusy(false);
    }
  }
  const pdfButton = (source: TripForm, status: RequestPdfStatus) => (
    <button
      type="button"
      className="button outline"
      disabled={pdfBusy}
      onClick={() => void savePdf(source, status)}
    >
      {pdfBusy ? (
        <LoaderCircle className="loading-spinner" size={17} />
      ) : (
        <FileDown size={17} />
      )}
      Download PDF
    </button>
  );
  const field = (
    key: TextKey,
    label: string,
    type = "text",
    required = false,
    full = false,
    extra: Record<string, string | number> = {},
  ) => (
    <label className={`field ${full ? "full" : ""}`} key={key}>
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        name={key}
        type={type}
        value={form[key]}
        onChange={(e) => update(key, e.target.value)}
        required={required}
        disabled={locked || busy}
        maxLength={type === "email" ? 254 : 1000}
        {...extra}
      />
    </label>
  );
  // Counts are typed by hand: digits only, no spinner, like New Booking.
  const countField = (
    key: "passengerCount" | "busCount",
    label: string,
    maxDigits: number,
    required: boolean,
    extra: Record<string, string> = {},
  ) => (
    <label className="field" key={key}>
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        name={key}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={form[key]}
        onChange={(e) => {
          const value = countInput(e.target.value, maxDigits);
          setForm((f) => {
            const next = { ...f, [key]: value };
            return key === "busCount" ? withBusRoutes(next) : next;
          });
          setError("");
        }}
        required={required}
        disabled={locked || busy}
        {...extra}
      />
    </label>
  );
  const buses = Number(form.busCount) || 0;
  const separate = differentRoutes(form);
  // The server reports whether the booking system is configured; without it, sending
  // can never succeed, so the review step explains this next to the button.
  const offline = step === 2 && available === false;
  const prettyDate = (s: string) =>
    s
      ? new Intl.DateTimeFormat("en-AU", {
          dateStyle: "medium",
          timeZone: "Australia/Sydney",
        }).format(new Date(`${s}T12:00:00+11:00`))
      : "Not specified";
  if (receipt)
    return (
      <div className="success-panel" role="status">
        <CheckCircle2 size={43} />
        <span className="eyebrow">THANKS FOR BRINGING US ALONG</span>
        <h2>
          Your request
          <br />
          is on its way.
        </h2>
        <p>
          Your enquiry has been received by the Punchbowl Bus Company team.
          We’ll review your trip details and contact you using the details you
          provided.
        </p>
        <div className="receipt">
          Receipt: {receipt.receiptId}
          <br />
          Received:{" "}
          {new Date(receipt.receivedAt).toLocaleString("en-AU", {
            timeZone: "Australia/Sydney",
          })}{" "}
          (Sydney)
        </div>
        <p>
          <strong>
            This is an enquiry receipt, not a booking confirmation.
          </strong>{" "}
          Availability, pricing and arrangements will be discussed with our
          team.
        </p>
        <div className="success-actions">
          {sent &&
            pdfButton(sent.form, {
              reference: sent.reference,
              receipt,
            })}
          <a className="button dark" href="/">
            Back to home <ArrowUpRight size={18} />
          </a>
        </div>
        {pdfError && (
          <p className="form-message" role="alert">
            {pdfError}
          </p>
        )}
      </div>
    );
  return (
    <form
      className="enquiry-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (step < 2) next();
        else void submit();
      }}
    >
      <ol className="form-steps" aria-label="Enquiry progress">
        {["Journey", "Contact", "Review & submit"].map((label, i) => (
          <li
            key={label}
            className={step === i ? "current" : ""}
            aria-current={step === i ? "step" : undefined}
          >
            <span>{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {available === false && (
        <div className="form-message warning" role="status">
          Online submission is not connected yet. You can explore the form, or{" "}
          <a href={company.phoneHref}>call {company.phone}</a> to discuss your
          trip.
        </div>
      )}
      <h2 tabIndex={-1} ref={titleRef}>
        {
          [
            "First, the journey.",
            "Now, a little about you.",
            "Everything looking good?",
          ][step]
        }
      </h2>
      <p className="form-intro">
        {
          [
            "All dates and times are local to Sydney. Fields marked * are required.",
            "We’ll use these details to follow up about your trip.",
            "Check your details before sending your request to our charter team.",
          ][step]
        }
      </p>
      {error && (
        <div className="form-message" role="alert" tabIndex={-1} ref={errorRef}>
          {error}
          {locked && pending.current && (
            <div>
              Request reference:{" "}
              {JSON.parse(pending.current.body).payload.sourceSubmissionId}
            </div>
          )}
        </div>
      )}
      {step === 0 && (
        <div className="form-grid">
          <fieldset className="field full trip-types">
            <legend>Trip type *</legend>
            <div className="trip-type-options">
              {TRIP_TYPE_OPTIONS.map((t) => (
                <label key={t.value} className="trip-type">
                  <input
                    type="radio"
                    name="tripType"
                    value={t.value}
                    checked={form.tripType === t.value}
                    disabled={locked || busy}
                    onChange={() => update("tripType", t.value)}
                  />
                  <span>
                    <strong>{t.label}</strong>
                    <small>{t.hint}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {form.tripType === "shuttle" && (
            <p className="field full form-intro">
              We run repeated trips between one pickup and one drop-off until
              everyone has arrived. Tell us the total number of passengers and
              your time window, and we’ll plan the runs.
            </p>
          )}
          <div className="field full">
            <span>
              {form.tripType === "shuttle"
                ? "Shuttle route"
                : separate
                  ? "Bus 1 route"
                  : "Your route"}{" "}
              *
            </span>
            <ItineraryEditor
              leg="outward"
              route={form.outbound}
              onChange={(route) => update("outbound", route)}
              service={maps}
              disabled={locked || busy}
            />
          </div>
          {field("date", dateLabel[form.tripType], "date", true, false, {
            min: sydneyToday(),
          })}
          {field("time", timeLabel[form.tripType], "time")}
          {form.tripType === "shuttle" &&
            field("finishTime", "Everyone delivered by (optional)", "time")}
          {form.tripType === "repeatable" && (
            <>
              <div className="form-divider">
                <h3>How often?</h3>
                <p>
                  Each trip uses the same route and pickup time. We can quote
                  up to one year of trips.
                </p>
              </div>
              <label className="field">
                <span>Repeats *</span>
                <select
                  value={form.recurrenceType}
                  disabled={locked || busy}
                  onChange={(e) => {
                    const type = e.target.value as RecurrenceType;
                    setForm((f) => ({
                      ...f,
                      recurrenceType: type,
                      // Start a weekly schedule on the first trip's weekday.
                      recurrenceDays:
                        type === "weekly" && !f.recurrenceDays.length && f.date
                          ? [new Date(`${f.date}T12:00Z`).getUTCDay()]
                          : f.recurrenceDays,
                    }));
                    setError("");
                  }}
                >
                  {RECURRENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {form.recurrenceType === "monthly" &&
                  Number(form.date.slice(8)) > 28 && (
                    <small>
                      Months without day {Number(form.date.slice(8))} are
                      skipped.
                    </small>
                  )}
              </label>
              {field("recurrenceEndDate", "Last trip date", "date", true, false, {
                min: form.date || sydneyToday(),
              })}
              {form.recurrenceType === "weekly" && (
                <fieldset className="field full weekdays">
                  <legend>On these days *</legend>
                  <div>
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                      <label key={d}>
                        <input
                          type="checkbox"
                          name="recurrenceDays"
                          value={d}
                          checked={form.recurrenceDays.includes(d)}
                          disabled={locked || busy}
                          onChange={(e) =>
                            update(
                              "recurrenceDays",
                              e.target.checked
                                ? [...form.recurrenceDays, d].sort()
                                : form.recurrenceDays.filter((x) => x !== d),
                            )
                          }
                        />
                        <span>{WEEKDAYS[d]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </>
          )}
          {form.tripType === "round_trip" && (
            <>
              <div className="form-divider">
                <h3>The journey home</h3>
                <p>
                  By default we’ll drive your outward route in reverse.
                </p>
              </div>
              {field("returnDate", "Return date", "date", true, false, {
                min: form.date || sydneyToday(),
              })}
              {field("returnTime", "Return departure time (optional)", "time")}
              <label className="consent field full">
                <input
                  type="checkbox"
                  checked={form.returnReversed}
                  disabled={locked || busy}
                  onChange={(e) => {
                    const reversed = e.target.checked;
                    setForm((f) => ({
                      ...f,
                      returnReversed: reversed,
                      inbound:
                        !reversed && !f.inbound.some((p) => p.address.trim())
                          ? reverseRoute(f.outbound)
                          : f.inbound,
                    }));
                    setError("");
                  }}
                />
                <span>Return by the same route in reverse</span>
              </label>
              {form.returnReversed ? (
                <p className="field full route-summary">
                  {routeSummary(returnRoute(form))}
                </p>
              ) : (
                <div className="field full">
                  <span>Return route *</span>
                  <ItineraryEditor
                    leg="return"
                    route={form.inbound}
                    onChange={(route) => update("inbound", route)}
                    service={maps}
                    disabled={locked || busy}
                  />
                  <button
                    type="button"
                    className="text-button"
                    disabled={locked || busy}
                    onClick={() => update("inbound", reverseRoute(form.outbound))}
                  >
                    Copy outward route in reverse
                  </button>
                </div>
              )}
            </>
          )}
          <div className="form-divider">
            <h3>Who’s coming along?</h3>
          </div>
          {countField(
            "passengerCount",
            form.tripType === "shuttle"
              ? "Total passengers to move"
              : "Number of passengers",
            5,
            true,
          )}
          {countField("busCount", "Number of buses (optional)", 3, false, {
            placeholder: "Let our team advise",
          })}
          {buses >= 2 && form.tripType === "shuttle" && (
            <p className="field full form-intro">
              All shuttle buses share one route and take turns running it.
            </p>
          )}
          {buses >= 2 && form.tripType !== "shuttle" && (
            <fieldset className="field full trip-types">
              <legend>Routes for the {buses} buses *</legend>
              <div className="trip-type-options two">
                {(
                  [
                    [
                      "same",
                      "Same route for all buses",
                      "Every bus follows the route above",
                    ],
                    [
                      "different",
                      "Different route for each bus",
                      "Each bus has its own stops and pickup time",
                    ],
                  ] as const
                ).map(([value, label, hint]) => (
                  <label key={value} className="trip-type">
                    <input
                      type="radio"
                      name="routeMode"
                      value={value}
                      checked={form.routeMode === value}
                      disabled={locked || busy}
                      onChange={() =>
                        setForm((f) => withBusRoutes({ ...f, routeMode: value }))
                      }
                    />
                    <span>
                      <strong>{label}</strong>
                      <small>{hint}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {separate && (
            <>
              {buses > MAX_SEPARATE_ROUTE_BUSES && (
                <p className="field full form-message warning">
                  We can take separate routes for up to{" "}
                  {MAX_SEPARATE_ROUTE_BUSES} buses online. For more, choose
                  “Same route for all buses” and describe the routes in your
                  notes, or call {company.phone}.
                </p>
              )}
              {activeBusRoutes(form).map((bus, i) => {
                const n = i + 2;
                const change = (patch: Partial<BusRoute>) =>
                  update(
                    "busRoutes",
                    form.busRoutes.map((b) =>
                      b.id === bus.id ? { ...b, ...patch } : b,
                    ),
                  );
                return (
                  <div className="field full bus-route" key={bus.id}>
                    <span>Bus {n} route *</span>
                    <ItineraryEditor
                      leg={`bus-${n}`}
                      route={bus.route}
                      onChange={(route) => change({ route })}
                      service={maps}
                      disabled={locked || busy}
                    />
                    <div className="bus-route-times">
                      <label className="field">
                        <span>Bus {n} departure time</span>
                        <input
                          type="time"
                          name={`bus-${n}-time`}
                          value={bus.time}
                          disabled={locked || busy}
                          onChange={(e) => change({ time: e.target.value })}
                        />
                        <small>Leave empty for the same time as bus 1.</small>
                      </label>
                      {form.tripType === "round_trip" && (
                        <label className="field">
                          <span>Bus {n} return departure time</span>
                          <input
                            type="time"
                            name={`bus-${n}-return-time`}
                            value={bus.returnTime}
                            disabled={locked || busy}
                            onChange={(e) =>
                              change({ returnTime: e.target.value })
                            }
                          />
                          <small>
                            Returns on the same day as bus 1, along its route
                            in reverse.
                          </small>
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
          <label className="field">
            <span>Vehicle preference</span>
            <select
              value={form.vehicle}
              disabled={locked || busy}
              onChange={(e) => update("vehicle", e.target.value)}
            >
              {["No preference", "Bus", "Coach"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          {asksSeatbelts(form) && (
            <label className="field">
              <span>Seat belts</span>
              <select
                value={form.seatbelts}
                disabled={locked || busy}
                onChange={(e) => update("seatbelts", e.target.value)}
              >
                {["Please discuss", "Required", "No preference"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {step === 1 && (
        <div className="form-grid">
          {field("name", "Contact name", "text", true, true, {
            maxLength: 200,
            autoComplete: "name",
          })}
          {field(
            "customerGroup",
            "School, organisation or group (optional)",
            "text",
            false,
            true,
            { maxLength: 200, autoComplete: "organization" },
          )}
          {field("email", "Email address", "email", false, true, {
            autoComplete: "email",
          })}
          {field("phone", "Phone number", "tel", false, true, {
            maxLength: 60,
            autoComplete: "tel",
          })}
          <p className="field full form-intro">
            Please provide at least one of email or phone.
          </p>
          <label className="field full">
            <span>Anything else we should know? (optional)</span>
            <textarea
              maxLength={15000}
              rows={5}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Accessibility requirements, extra stops, timing needs or other trip details"
            />
            <small>
              Please avoid including sensitive passenger information.
            </small>
          </label>
        </div>
      )}
      {step === 2 && (
        <>
          <dl className="review-list">
            <div>
              <dt>Trip type</dt>
              <dd>{tripTypeLabel(form.tripType)}</dd>
            </div>
            <div>
              <dt>Passengers / buses</dt>
              <dd>
                {form.passengerCount} passengers ·{" "}
                {form.busCount
                  ? `${form.busCount} bus(es)`
                  : "Buses to be advised"}
              </dd>
            </div>
            <div className="full">
              <dt>
                {form.tripType === "shuttle"
                  ? "Shuttle route"
                  : separate
                    ? "Bus 1 route"
                    : "Outward route"}
              </dt>
              <dd>
                <RouteList route={form.outbound} />
              </dd>
            </div>
            <div>
              <dt>{dateLabel[form.tripType]} (Sydney time)</dt>
              <dd>
                {prettyDate(form.date)} · {form.time || "Time to be discussed"}
              </dd>
            </div>
            {form.tripType === "shuttle" && (
              <div>
                <dt>Everyone delivered by</dt>
                <dd>{form.finishTime || "To be discussed"}</dd>
              </div>
            )}
            {form.tripType === "repeatable" && (
              <div>
                <dt>Repeats</dt>
                <dd>
                  {form.recurrenceType === "weekly"
                    ? `Weekly on ${[1, 2, 3, 4, 5, 6, 0]
                        .filter((d) => form.recurrenceDays.includes(d))
                        .map((d) => WEEKDAYS[d])
                        .join(", ")}`
                    : RECURRENCE_OPTIONS.find(
                        (o) => o.value === form.recurrenceType,
                      )!.label}
                  <br />
                  Last trip: {prettyDate(form.recurrenceEndDate)}
                </dd>
              </div>
            )}
            {form.tripType === "round_trip" && (
              <>
                <div>
                  <dt>Return (Sydney time)</dt>
                  <dd>
                    {prettyDate(form.returnDate)} ·{" "}
                    {form.returnTime || "Time to be discussed"}
                  </dd>
                </div>
                <div className="full">
                  <dt>
                    Return route
                    {form.returnReversed ? " (outward route reversed)" : ""}
                  </dt>
                  <dd>
                    <RouteList route={returnRoute(form)} />
                  </dd>
                </div>
              </>
            )}
            {separate &&
              activeBusRoutes(form).map((bus, i) => (
                <div className="full" key={bus.id}>
                  <dt>Bus {i + 2} route</dt>
                  <dd>
                    Departs {bus.time || form.time || "at a time to be discussed"}
                    {form.tripType === "round_trip" &&
                      ` · returns ${bus.returnTime || form.returnTime || "at a time to be discussed"} along this route in reverse`}
                    <RouteList route={bus.route} />
                  </dd>
                </div>
              ))}
            <div>
              <dt>Contact</dt>
              <dd>
                {form.name}
                {form.customerGroup && ` · ${form.customerGroup}`}
                <br />
                {form.email}
                <br />
                {form.phone}
              </dd>
            </div>
            <div>
              <dt>Preferences</dt>
              <dd>
                {form.vehicle}
                {asksSeatbelts(form) && ` · Seat belts: ${form.seatbelts}`}
              </dd>
            </div>
            {form.notes && (
              <div className="full">
                <dt>Additional details</dt>
                <dd>{form.notes}</dd>
              </div>
            )}
          </dl>
          <label className="consent">
            <input
              type="checkbox"
              checked={consent}
              disabled={locked || busy}
              onChange={(e) => setConsent(e.target.checked)}
              required
            />
            <span>
              I understand this is a quote request, not a confirmed booking. My
              details will be sent to Punchbowl Bus Company’s enquiry team.{" "}
              <a
                href={`${company.source}/privacy`}
                target="_blank"
                rel="noreferrer"
              >
                Privacy policy ↗
              </a>
            </span>
          </label>
          <div className="pdf-download">
            <p>
              Keep a copy of this quote request, or share it with your group.
            </p>
            {pdfButton(form, {
              reference:
                locked && pending.current
                  ? JSON.parse(pending.current.body).payload.sourceSubmissionId
                  : undefined,
            })}
          </div>
          {pdfError && (
            <p className="form-message" role="alert">
              {pdfError}
            </p>
          )}
          {locked && (
            <p className="form-message warning">
              Your request details are held unchanged until receipt is
              confirmed. Retrying uses the same reference to avoid duplicate
              enquiries.
            </p>
          )}
        </>
      )}
      <div className="trap" aria-hidden="true">
        <label>
          Leave this field empty
          <input
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => update("website", e.target.value)}
          />
        </label>
      </div>
      {offline && (
        <p className="form-message warning" id="send-unavailable" role="note">
          <strong>Online sending isn’t available right now</strong>, so this
          request can’t be sent from the website. Your details are complete —
          please <a href={company.phoneHref}>call {company.phone}</a> and our
          team will take your request over the phone.
        </p>
      )}
      <div className="form-actions">
        {step > 0 ? (
          <button
            type="button"
            className="button outline"
            disabled={busy || locked}
            onClick={() => changeStep(step - 1)}
          >
            <ArrowLeft size={16} />
            Back
          </button>
        ) : (
          <span />
        )}
        <button
          className="button"
          type="submit"
          disabled={busy || wait > 0 || conflict || offline}
          aria-describedby={offline ? "send-unavailable" : undefined}
        >
          {busy ? (
            <>
              <LoaderCircle className="loading-spinner" size={17} />
              Sending request
            </>
          ) : wait > 0 ? (
            `Retry in ${wait}s`
          ) : step < 2 ? (
            <>
              Continue <ArrowRight size={17} />
            </>
          ) : offline ? (
            "Online sending unavailable"
          ) : locked ? (
            <>
              Retry same request <ArrowRight size={17} />
            </>
          ) : (
            <>
              Send quote request <ArrowUpRight size={17} />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

const dateLabel: Record<TripForm["tripType"], string> = {
  one_way: "Departure date",
  round_trip: "Departure date",
  repeatable: "First trip date",
  shuttle: "Shuttle date",
};
const timeLabel: Record<TripForm["tripType"], string> = {
  one_way: "Departure time (optional)",
  round_trip: "Departure time (optional)",
  repeatable: "Pickup time for each trip (optional)",
  shuttle: "First pickup time (optional)",
};
function routeSummary(route: TripPoint[]) {
  const named = route
    .map((p) => p.name || p.address.split(",")[0].trim())
    .filter(Boolean);
  return named.length === route.length
    ? `Return route: ${named.join(" → ")}`
    : "Your return route will mirror the outward route once its addresses are set.";
}
function RouteList({ route }: { route: TripPoint[] }) {
  return (
    <ol className="review-route">
      {route.map((p, i) => (
        <li key={p.id}>
          <span>
            {i + 1}. {pointLabel(i, route.length)}
          </span>
          {p.name && !p.address.startsWith(p.name) && <strong>{p.name}</strong>}
          {p.address}
          {p.notes.trim() && <small>Access: {p.notes.trim()}</small>}
        </li>
      ))}
    </ol>
  );
}
