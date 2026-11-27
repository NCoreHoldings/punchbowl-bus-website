"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  BusFront,
  CalendarClock,
  CheckCircle2,
  Copy,
  CopyCheck,
  FileDown,
  GitFork,
  LoaderCircle,
  MapPin,
  NotebookPen,
  Plus,
  Route as RouteIcon,
  Trash2,
  Undo2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  activeBusRoutes,
  addBus,
  buildSubmission,
  copyRoute,
  countInput,
  differentRoutes,
  freshForm,
  MAX_SEPARATE_ROUTE_BUSES,
  removeBus,
  routeFilled,
  routeLine,
  sameRoute,
  VEHICLE_OPTIONS,
  validateBasics,
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
  function next() {
    const issue = step === 0 ? validateBasics(form) : validateJourney(form);
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
      const issue = validateBasics(form) || validateJourney(form);
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
    hint = "",
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
      {hint && <small>{hint}</small>}
    </label>
  );
  const buses = Number(form.busCount) || 0;
  const separate = differentRoutes(form);
  const multi = buses >= 2 && form.tripType !== "shuttle";
  const otherBuses = activeBusRoutes(form);
  const allMatchBus1 = otherBuses.every((b) => sameRoute(b.route, form.outbound));
  function copyBus1ToAll() {
    const customised = otherBuses.filter(
      (b) => routeFilled(b.route) && !sameRoute(b.route, form.outbound),
    );
    if (
      customised.length &&
      !window.confirm(
        `Replace the route of ${customised
          .map((b) => `bus ${otherBuses.indexOf(b) + 2}`)
          .join(", ")} with bus 1's?`,
      )
    )
      return;
    const ids = new Set(otherBuses.map((b) => b.id));
    update(
      "busRoutes",
      form.busRoutes.map((b) =>
        ids.has(b.id)
          ? { ...b, route: copyRoute(form.outbound), time: "", returnTime: "" }
          : b,
      ),
    );
  }
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
        {["Basic details", "Route & schedule", "Review & send"].map((label, i) => (
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
            "First, the basic details.",
            "Now, the route and schedule.",
            "Everything looking good?",
          ][step]
        }
      </h2>
      <p className="form-intro">
        {
          [
            "Who’s travelling and what you need. You’ll set the route and times next. Fields marked * are required.",
            "Set the pickup, stops and drop-off, then the date and time. With two or more buses, each bus can have its own route.",
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
        <div className="booking-sections">
          <Section icon={UserRound} title="Your details">
            <div className="form-grid">
              {field("name", "Contact name", "text", true, false, {
                maxLength: 200,
                autoComplete: "name",
              })}
              {field(
                "customerGroup",
                "School, organisation or group (optional)",
                "text",
                false,
                false,
                { maxLength: 200, autoComplete: "organization" },
              )}
              {field("email", "Email address", "email", false, false, {
                autoComplete: "email",
              })}
              {field("phone", "Phone number", "tel", false, false, {
                maxLength: 60,
                autoComplete: "tel",
              })}
              <p className="field full field-hint">
                Please provide at least one of email or phone.
              </p>
            </div>
          </Section>
          <Section icon={RouteIcon} title="Trip type">
            <fieldset className="field full trip-types">
              <legend className="visually-hidden">Trip type *</legend>
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
              <p className="field-hint">
                We run repeated trips between one pickup and one drop-off until
                everyone has arrived. Tell us the total number of passengers
                and your time window, and we’ll plan the runs.
              </p>
            )}
          </Section>
          <Section icon={BusFront} title="Vehicles & passengers">
            <fieldset className="field full trip-types">
              <legend>Vehicle type</legend>
              <div className="trip-type-options three">
                {VEHICLE_OPTIONS.map((v) => (
                  <label key={v.value} className="trip-type">
                    <input
                      type="radio"
                      name="vehicle"
                      value={v.value}
                      checked={form.vehicle === v.value}
                      disabled={locked || busy}
                      onChange={() => update("vehicle", v.value)}
                    />
                    <span>
                      <strong>{v.value}</strong>
                      <small>{v.hint}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="form-grid">
              {countField(
                "busCount",
                "Buses required (optional)",
                3,
                false,
                { placeholder: "Let our team advise" },
                form.tripType === "shuttle"
                  ? "The runs are shared between the buses."
                  : "Two or more buses can each have their own route.",
              )}
              {countField(
                "passengerCount",
                form.tripType === "shuttle"
                  ? "Total passengers to move"
                  : "Total passengers",
                5,
                true,
                {},
                form.tripType === "shuttle"
                  ? "Everyone to move across all runs."
                  : "Across all buses.",
              )}
            </div>
            {multi && (
              <p className="info-note">
                {separate
                  ? `Each of the ${buses} buses has its own route — you’ll set them on the next step.`
                  : `All ${buses} buses share one route. You can give each bus its own route on the next step.`}
              </p>
            )}
            {buses >= 2 && form.tripType === "shuttle" && (
              <p className="info-note">
                All shuttle buses share one route and take turns running it.
              </p>
            )}
          </Section>
          <Section icon={NotebookPen} title="Trip notes">
            <label className="field full">
              <span>Anything else we should know? (optional)</span>
              <textarea
                maxLength={15000}
                rows={4}
                value={form.notes}
                disabled={locked || busy}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Accessibility requirements, luggage, timing needs or other trip details"
              />
              <small>Please avoid including sensitive passenger information.</small>
            </label>
          </Section>
        </div>
      )}
      {step === 1 && (
        <div className="booking-sections">
          {multi && (
            <fieldset className="field full trip-types">
              <legend>Routes for the {buses} buses *</legend>
              <div className="trip-type-options two">
                {(
                  [
                    [
                      "same",
                      "Same route for all buses",
                      "One shared route and schedule",
                      RouteIcon,
                    ],
                    [
                      "different",
                      "Different route for each bus",
                      "Each bus gets its own stops and pickup time",
                      GitFork,
                    ],
                  ] as const
                ).map(([value, label, hint, Icon]) => (
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
                    <span className="with-icon">
                      <Icon size={18} aria-hidden />
                      <span>
                        <strong>{label}</strong>
                        <small>{hint}</small>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <Section
            icon={MapPin}
            title={
              form.tripType === "shuttle"
                ? "Shuttle route"
                : separate
                  ? "Bus 1 route"
                  : multi
                    ? "Route (all buses)"
                    : "Route"
            }
            hint="Pickup point, any passenger stops, then the drop-off."
          >
            <ItineraryEditor
              leg="outward"
              route={form.outbound}
              onChange={(route) => update("outbound", route)}
              service={maps}
              disabled={locked || busy}
            />
          </Section>
          <Section
            icon={CalendarClock}
            title={
              separate
                ? "Bus 1 schedule"
                : multi
                  ? "Schedule (all buses)"
                  : "Schedule"
            }
            hint="All dates and times are Sydney local time."
          >
            <div className="form-grid">
              {field("date", dateLabel[form.tripType], "date", true, false, {
                min: sydneyToday(),
              })}
              {field("time", timeLabel[form.tripType], "time")}
              {form.tripType === "shuttle" &&
                field("finishTime", "Everyone delivered by (optional)", "time")}
              {form.tripType === "repeatable" && (
                <>
                  <p className="field full sub-heading">
                    <strong>How often?</strong> Each trip uses the same route
                    and pickup time. We can quote up to one year of trips.
                  </p>
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
                            type === "weekly" &&
                            !f.recurrenceDays.length &&
                            f.date
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
                  {field(
                    "recurrenceEndDate",
                    "Last trip date",
                    "date",
                    true,
                    false,
                    { min: form.date || sydneyToday() },
                  )}
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
                                    : form.recurrenceDays.filter(
                                        (x) => x !== d,
                                      ),
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
            </div>
          </Section>
          {form.tripType === "round_trip" && (
            <Section
              icon={Undo2}
              title={separate ? "Bus 1 return journey" : "Return journey"}
              hint="By default we’ll drive the outward route in reverse."
            >
              <div className="form-grid">
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
                      onClick={() =>
                        update("inbound", reverseRoute(form.outbound))
                      }
                    >
                      Copy outward route in reverse
                    </button>
                  </div>
                )}
              </div>
            </Section>
          )}
          {separate && (
            <section className="bus-cards" aria-label="Other buses">
              <div className="bus-cards-head">
                <h3>
                  {buses === 2
                    ? "Bus 2: its own route"
                    : `Buses 2–${Math.min(buses, MAX_SEPARATE_ROUTE_BUSES)}: separate routes`}
                </h3>
                <p>Bus numbers are just references for your request.</p>
              </div>
              {buses > MAX_SEPARATE_ROUTE_BUSES && (
                <p className="form-message warning">
                  We can take separate routes for up to{" "}
                  {MAX_SEPARATE_ROUTE_BUSES} buses online. For more, choose
                  “Same route for all buses” and describe the routes in your
                  notes, or call {company.phone}.
                </p>
              )}
              <div
                className={`copy-banner ${routeFilled(form.outbound) ? "ready" : ""}`}
              >
                <span>
                  {routeFilled(form.outbound) ? (
                    <>
                      <strong>Bus 1:</strong> {routeLine(form.outbound)}. Copy
                      it to the other buses, then change only what differs.
                    </>
                  ) : (
                    "Fill in bus 1’s pickup and drop-off above to copy its route to the other buses."
                  )}
                </span>
                <button
                  type="button"
                  className="button outline small"
                  disabled={
                    locked ||
                    busy ||
                    !routeFilled(form.outbound) ||
                    allMatchBus1
                  }
                  onClick={copyBus1ToAll}
                >
                  {allMatchBus1 && routeFilled(form.outbound) ? (
                    <>
                      <CopyCheck size={15} /> All buses match bus 1
                    </>
                  ) : (
                    <>
                      <Copy size={15} /> Copy bus 1 to all buses
                    </>
                  )}
                </button>
              </div>
              {otherBuses.map((bus, i) => {
                const n = i + 2;
                const change = (patch: Partial<BusRoute>) =>
                  update(
                    "busRoutes",
                    form.busRoutes.map((b) =>
                      b.id === bus.id ? { ...b, ...patch } : b,
                    ),
                  );
                const sources = [
                  { n: 1, route: form.outbound, time: "", returnTime: "" },
                  ...otherBuses
                    .slice(0, i)
                    .map((b, j) => ({ ...b, n: j + 2 })),
                ].filter((s) => routeFilled(s.route));
                return (
                  <article
                    className="bus-card"
                    key={bus.id}
                    aria-labelledby={`bus-${n}-title`}
                  >
                    <header>
                      <span className="bus-badge" aria-hidden>
                        <BusFront size={17} />
                      </span>
                      <div className="bus-card-title">
                        <h4 id={`bus-${n}-title`}>Bus {n}</h4>
                        <p>
                          {routeFilled(bus.route)
                            ? routeLine(bus.route)
                            : "Own route and pickup time"}
                        </p>
                      </div>
                      <div className="bus-card-tools">
                        {sources.length > 0 && (
                          <select
                            aria-label={`Copy a route onto bus ${n}`}
                            value=""
                            disabled={locked || busy}
                            onChange={(e) => {
                              const s = sources.find(
                                (x) => x.n === Number(e.target.value),
                              );
                              if (s)
                                change({
                                  route: copyRoute(s.route),
                                  time: s.time,
                                  returnTime: s.returnTime,
                                });
                            }}
                          >
                            <option value="">Copy route from…</option>
                            {sources.map((s) => (
                              <option key={s.n} value={s.n}>
                                Bus {s.n}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          type="button"
                          className="text-button"
                          disabled={locked || busy}
                          onClick={() => setForm((f) => removeBus(f, bus.id))}
                          aria-label={`Remove bus ${n}`}
                        >
                          <Trash2 size={15} /> Remove
                        </button>
                      </div>
                    </header>
                    <div className="bus-card-body">
                      <ItineraryEditor
                        leg={`bus-${n}`}
                        route={bus.route}
                        onChange={(route) => change({ route })}
                        service={maps}
                        disabled={locked || busy}
                      />
                      <div className="bus-route-times">
                        <label className="field">
                          <span>Bus {n} pickup time</span>
                          <input
                            type="time"
                            name={`bus-${n}-time`}
                            value={bus.time}
                            disabled={locked || busy}
                            onChange={(e) => change({ time: e.target.value })}
                          />
                          <small>
                            Same day as bus 1. Leave empty for the same time.
                          </small>
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
                              Returns on bus 1’s return date, along this route
                              in reverse.
                            </small>
                          </label>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
          {form.tripType !== "shuttle" &&
            (separate || buses <= 1) &&
            buses < MAX_SEPARATE_ROUTE_BUSES && (
              <button
                type="button"
                className="add-bus"
                disabled={locked || busy}
                onClick={() => setForm(addBus)}
              >
                <Plus size={18} />
                {separate
                  ? "Add another bus"
                  : "Add another bus with a different route"}
              </button>
            )}
        </div>
      )}
      {step === 2 && (
        <>
          <dl className="review-list">
            <div>
              <dt>Your details</dt>
              <dd>
                {form.name}
                {form.customerGroup && ` · ${form.customerGroup}`}
                {form.email && (
                  <>
                    <br />
                    {form.email}
                  </>
                )}
                {form.phone && (
                  <>
                    <br />
                    {form.phone}
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>Trip type</dt>
              <dd>{tripTypeLabel(form.tripType)}</dd>
            </div>
            <div>
              <dt>Vehicles & passengers</dt>
              <dd>
                {form.vehicle === "No preference"
                  ? "Any vehicle"
                  : form.vehicle}{" "}
                ·{" "}
                {form.busCount
                  ? `${form.busCount} bus${form.busCount === "1" ? "" : "es"}`
                  : "Buses to be advised"}{" "}
                · {form.passengerCount} passengers
                {separate && (
                  <>
                    <br />
                    Each bus has its own route
                  </>
                )}
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
            {form.notes && (
              <div className="full">
                <dt>Trip notes</dt>
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

function Section({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="booking-section">
      <h3>
        <Icon size={18} aria-hidden />
        {title}
      </h3>
      {hint && <p className="field-hint">{hint}</p>}
      {children}
    </section>
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
