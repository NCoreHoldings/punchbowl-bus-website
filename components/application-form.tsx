"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, LoaderCircle, Mail, Send } from "lucide-react";
import { company } from "@/lib/content";

const TO = "admin@punchbowlbus.com.au";
const MAX_CV = 4 * 1024 * 1024;
const LICENCES = [
  "Car (C)",
  "Light Rigid (LR)",
  "Medium Rigid (MR)",
  "Heavy Rigid (HR)",
  "Heavy Combination (HC)",
  "Multi Combination (MC)",
];
const QUALIFICATIONS = [
  "Certificate III Heavy Commercial Vehicle Mechanical Technology (or equivalent)",
  "Other automotive or diesel trade qualification",
  "Currently an apprentice",
  "No qualification yet – interested in an apprenticeship",
];

type Job = { slug: string; title: string; role: string };

export function ApplicationForm({ job }: { job: Job }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [fileName, setFileName] = useState("");
  const key = useRef("");
  const errorRef = useRef<HTMLDivElement>(null);
  const isDriver = /driver/i.test(job.role);
  const isMechanic = /mechanic|technician|apprentice/i.test(job.role);

  useEffect(() => {
    let active = true;
    fetch("/api/applications", { cache: "no-store" })
      .then((r) => r.json())
      .then((v) => active && setAvailable(v.available === true))
      .catch(() => active && setAvailable(false));
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const mailto = `mailto:${TO}?subject=${encodeURIComponent(`Job application: ${job.title}`)}`;
  if (available === false)
    return (
      <div className="apply-offline">
        <p>
          To apply for this position, please email your CV and a short note
          about yourself to <a href={mailto}>{TO}</a>, quoting “{job.title}”.
        </p>
        <a className="button" href={mailto}>
          <Mail size={17} aria-hidden="true" /> Email your application
        </a>
        <p className="apply-small">
          Questions? Call <a href={company.phoneHref}>{company.phone}</a>.
        </p>
      </div>
    );

  if (available === null)
    return (
      <p className="apply-small" role="status">
        <LoaderCircle className="loading-spinner" size={15} aria-hidden="true" /> Loading the application form…
      </p>
    );

  if (done)
    return (
      <div className="apply-success" role="status">
        <CheckCircle2 size={36} aria-hidden="true" />
        <h3>Application sent</h3>
        <p>
          Thanks for applying for <strong>{job.title}</strong>. Our team will
          review your application and contact you if you’re shortlisted.
        </p>
      </div>
    );

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const cv = data.get("cv");
    if (!(cv instanceof File) || !cv.size) return setError("Please attach your CV.");
    if (!/\.(pdf|docx?)$/i.test(cv.name))
      return setError("Please upload your CV as a PDF or Word document (.pdf, .docx or .doc).");
    if (cv.size > MAX_CV) return setError("Your CV must be 4 MB or smaller.");
    if (!form.reportValidity()) return;
    key.current ||= crypto.randomUUID();
    data.set("idempotencyKey", key.current);
    data.set("job", job.slug);
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        body: data,
        signal: AbortSignal.timeout(45000),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone(true);
        return;
      }
      setError(body.error || `We couldn't send your application. Please try again, or email your CV to ${TO}.`);
    } catch {
      setError(`We couldn't confirm your application was sent. Please try again — you won't be sent twice — or email your CV to ${TO}.`);
    } finally {
      setBusy(false);
    }
  }

  const off = busy;
  return (
    <form className="apply-form" onSubmit={submit} noValidate={false}>
      <p className="apply-small">Fields marked * are required.</p>
      {error && (
        <div className="form-message" role="alert" tabIndex={-1} ref={errorRef}>
          {error}
        </div>
      )}
      <fieldset disabled={off}>
        <label className="field">
          <span>Full name *</span>
          <input name="name" required maxLength={120} autoComplete="name" />
        </label>
        <label className="field">
          <span>Email *</span>
          <input name="email" type="email" required maxLength={254} autoComplete="email" />
        </label>
        <label className="field">
          <span>Phone *</span>
          <input name="phone" type="tel" required maxLength={40} autoComplete="tel" />
        </label>
        <label className="field">
          <span>Suburb *</span>
          <input name="suburb" required maxLength={80} autoComplete="address-level2" />
        </label>
        {isDriver && (
          <>
            <label className="field">
              <span>Licence class *</span>
              <select name="licence" required defaultValue="">
                <option value="" disabled>
                  Choose your licence
                </option>
                {LICENCES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>NSW Driver Authority *</span>
              <select name="driverAuthority" required defaultValue="">
                <option value="" disabled>
                  Choose one
                </option>
                <option>Yes, I hold one</option>
                <option>Applied / in progress</option>
                <option>No</option>
              </select>
            </label>
            <label className="field">
              <span>Working With Children Check *</span>
              <select name="wwcc" required defaultValue="">
                <option value="" disabled>
                  Choose one
                </option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </label>
          </>
        )}
        {isMechanic && (
          <label className="field">
            <span>Qualification *</span>
            <select name="qualification" required defaultValue="">
              <option value="" disabled>
                Choose the closest match
              </option>
              {QUALIFICATIONS.map((q) => (
                <option key={q}>{q}</option>
              ))}
            </select>
          </label>
        )}
        <fieldset className="apply-radio">
          <legend>Do you have the right to work in Australia? *</legend>
          <label>
            <input type="radio" name="rightToWork" value="Yes" required /> Yes
          </label>
          <label>
            <input type="radio" name="rightToWork" value="No" /> No
          </label>
        </fieldset>
        <label className="field">
          <span>CV / résumé * (PDF or Word, up to 4 MB)</span>
          <span className="file-drop">
            <FileText size={18} aria-hidden="true" />
            <span>{fileName || "Choose a file"}</span>
            <input
              name="cv"
              type="file"
              required
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                setFileName(e.target.files?.[0]?.name || "");
                setError("");
              }}
            />
          </span>
        </label>
        <label className="field">
          <span>Anything else you’d like us to know? (optional)</span>
          <textarea name="message" rows={4} maxLength={3000} />
        </label>
        <div className="trap" aria-hidden="true">
          <label>
            Leave this field empty
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <label className="consent">
          <input type="checkbox" name="consent" value="yes" required />
          <span>
            I agree that my application and CV will be emailed to Punchbowl
            Bus Company’s recruitment team to assess my suitability for this
            and future roles.{" "}
            <a href={`${company.source}/privacy`} target="_blank" rel="noreferrer">
              Privacy policy ↗
            </a>
          </span>
        </label>
        <button className="button apply-submit" type="submit">
          {busy ? (
            <>
              <LoaderCircle className="loading-spinner" size={17} aria-hidden="true" /> Sending application
            </>
          ) : (
            <>
              Submit application <Send size={16} aria-hidden="true" />
            </>
          )}
        </button>
      </fieldset>
    </form>
  );
}
