"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";
import {
  buildSubmission,
  emptyForm,
  sydneyToday,
  validateJourney,
  type TripForm,
} from "@/lib/form-data";
import { company } from "@/lib/content";
import { restorePending, type PendingRequest } from "@/lib/pending-request";
const STORAGE = "punchbowl-pending-enquiry-v1";
type Pending = PendingRequest;
type Receipt = { receiptId: string; receivedAt: string };
export function EnquiryForm() {
  const [form, setForm] = useState<TripForm>({ ...emptyForm });
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
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
        if (active) setAvailable(v.available === true);
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
          setForm({ ...emptyForm, ...p.form });
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
    return () => {
      active = false;
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
  function update(key: keyof TripForm, value: string) {
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
  const field = (
    key: keyof TripForm,
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
  // The server reports whether NCore Fleets is configured; without it, sending
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
          Your enquiry has been received by our team in NCore Fleets. We’ll
          review your trip details and contact you using the details you
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
        <a className="button dark" href="/">
          Back to home <ArrowUpRight size={18} />
        </a>
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
          <label className="field full">
            <span>Journey type *</span>
            <select
              value={form.tripType}
              onChange={(e) => update("tripType", e.target.value)}
            >
              <option value="one-way">One-way journey</option>
              <option value="return">Outward & return journey</option>
            </select>
          </label>
          {field("pickup", "Pickup address", "text", true, true, {
            autoComplete: "off",
            placeholder: "Street address, suburb and postcode",
          })}
          {field("destination", "Destination address", "text", true, true, {
            autoComplete: "off",
            placeholder: "Street address, suburb and postcode",
          })}
          {field("date", "Departure date", "date", true, false, {
            min: sydneyToday(),
          })}
          {field("time", "Departure time (optional)", "time")}
          {form.tripType === "return" && (
            <>
              <div className="form-divider">
                <h3>The journey home</h3>
                <p>
                  Leave return addresses blank to reverse your outward journey.
                </p>
              </div>
              {field("returnDate", "Return date", "date", true, false, {
                min: form.date || sydneyToday(),
              })}
              {field("returnTime", "Return departure time (optional)", "time")}
              {field(
                "returnPickup",
                "Return pickup (optional)",
                "text",
                false,
                true,
                {
                  placeholder:
                    form.destination || "Same as outward destination",
                },
              )}
              {field(
                "returnDestination",
                "Return destination (optional)",
                "text",
                false,
                true,
                { placeholder: form.pickup || "Same as outward pickup" },
              )}
            </>
          )}
          <div className="form-divider">
            <h3>Who’s coming along?</h3>
          </div>
          {field(
            "passengerCount",
            "Number of passengers",
            "number",
            true,
            false,
            { min: 1, max: 10000, step: 1 },
          )}
          {field(
            "busCount",
            "Number of buses (optional)",
            "number",
            false,
            false,
            { min: 1, max: 100, step: 1, placeholder: "Let our team advise" },
          )}
          <label className="field">
            <span>Vehicle preference</span>
            <select
              value={form.vehicle}
              onChange={(e) => update("vehicle", e.target.value)}
            >
              {["No preference", "Bus", "Coach"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Seat belts</span>
            <select
              value={form.seatbelts}
              onChange={(e) => update("seatbelts", e.target.value)}
            >
              {["Please discuss", "Required", "No preference"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
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
              <dt>Journey</dt>
              <dd>
                {form.tripType === "return" ? "Outward & return" : "One way"}
              </dd>
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
            <div>
              <dt>Pickup</dt>
              <dd>{form.pickup}</dd>
            </div>
            <div>
              <dt>Destination</dt>
              <dd>{form.destination}</dd>
            </div>
            <div>
              <dt>Departure (Sydney time)</dt>
              <dd>
                {prettyDate(form.date)} · {form.time || "Time to be discussed"}
              </dd>
            </div>
            {form.tripType === "return" && (
              <>
                <div>
                  <dt>Return (Sydney time)</dt>
                  <dd>
                    {prettyDate(form.returnDate)} ·{" "}
                    {form.returnTime || "Time to be discussed"}
                  </dd>
                </div>
                <div>
                  <dt>Return pickup</dt>
                  <dd>{form.returnPickup || form.destination}</dd>
                </div>
                <div>
                  <dt>Return destination</dt>
                  <dd>{form.returnDestination || form.pickup}</dd>
                </div>
              </>
            )}
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
                {form.vehicle} · Seat belts: {form.seatbelts}
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
              details will be sent to Punchbowl’s enquiry team using NCore
              Fleets.{" "}
              <a
                href={`${company.source}/privacy`}
                target="_blank"
                rel="noreferrer"
              >
                Privacy policy ↗
              </a>
            </span>
          </label>
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
