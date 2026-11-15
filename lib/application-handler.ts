/**
 * Job applications: validates the form and CV, then emails both to the
 * company (default admin@punchbowlbus.com.au) through Resend. Nothing is
 * stored on the website. Unconfigured → applicants are asked to email their CV.
 */
import { z } from "zod";

export const APPLICATIONS_TO = "admin@punchbowlbus.com.au";
export const MAX_CV_BYTES = 4 * 1024 * 1024; // Vercel functions accept ~4.5 MB bodies
const MAX_BODY = MAX_CV_BYTES + 256 * 1024;

export type ApplicationConfig = {
  siteUrl: string;
  resendKey?: string;
  from?: string;
  to?: string;
  trustedIpHeader?: string;
};
export type OpenJob = { slug: string; title: string; role: string };
export type ApplicationDeps = {
  fetch: typeof fetch;
  allow: (scope: string) => Promise<boolean>;
  findOpenJob: (slug: string) => OpenJob | null;
};

export const applicationsAvailable = (c: Pick<ApplicationConfig, "resendKey" | "from">) =>
  Boolean(c.resendKey && c.from);

const field = (max: number) => z.string().trim().max(max);
const required = (max: number, message: string) => field(max).min(1, message);
export const applicationSchema = z.object({
  job: required(120, "Please choose a vacancy."),
  name: required(120, "Please enter your full name."),
  email: z.email("Please enter a valid email address.").max(254),
  phone: required(40, "Please enter your phone number.").regex(/^[\d\s()+-]{6,}$/, "Please enter a valid phone number."),
  suburb: required(80, "Please enter your suburb."),
  rightToWork: z.enum(["Yes", "No"], "Please tell us whether you have the right to work in Australia."),
  licence: field(60).optional(),
  driverAuthority: field(40).optional(),
  wwcc: field(20).optional(),
  qualification: field(120).optional(),
  message: field(3000).optional(),
  consent: z.literal("yes", "Please agree to how your application will be handled."),
  idempotencyKey: field(80).optional(),
  website: field(200).optional(),
});
export type Application = z.infer<typeof applicationSchema>;

const CV_TYPES: Record<string, { mime: string; magic: number[] }> = {
  pdf: { mime: "application/pdf", magic: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    magic: [0x50, 0x4b, 0x03, 0x04], // ZIP
  },
  doc: { mime: "application/msword", magic: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
};

/** Accept PDF, DOCX or DOC under the size limit, checked by content, not just name. */
export function checkCv(name: string, bytes: Uint8Array): { ext: string; mime: string } | string {
  const ext = name.toLowerCase().split(".").pop() || "";
  const type = CV_TYPES[ext];
  if (!type) return "Please upload your CV as a PDF or Word document (.pdf, .docx or .doc).";
  if (bytes.byteLength === 0) return "Your CV file is empty.";
  if (bytes.byteLength > MAX_CV_BYTES) return "Your CV must be 4 MB or smaller.";
  if (!type.magic.every((b, i) => bytes[i] === b))
    return "That file doesn't look like a valid PDF or Word document.";
  return { ext, mime: type.mime };
}

const reply = (status: number, body: Record<string, unknown>, retryAfter?: string) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...(retryAfter ? { "Retry-After": retryAfter } : {}) },
  });

const escapeHtml = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function emailRows(a: Application, job: OpenJob): [string, string][] {
  const rows: [string, string | undefined][] = [
    ["Position", `${job.title} (${job.role})`],
    ["Name", a.name],
    ["Email", a.email],
    ["Phone", a.phone],
    ["Suburb", a.suburb],
    ["Right to work in Australia", a.rightToWork],
    ["Licence class", a.licence],
    ["NSW Driver Authority", a.driverAuthority],
    ["Working With Children Check", a.wwcc],
    ["Qualification", a.qualification],
    ["Message", a.message],
  ];
  return rows.filter((r): r is [string, string] => !!r[1]);
}

export function createApplicationHandler(config: ApplicationConfig, deps: ApplicationDeps) {
  const fallback = `Online applications are temporarily unavailable. Please email your CV to ${config.to || APPLICATIONS_TO}.`;
  return async function handle(request: Request): Promise<Response> {
    let origin: string;
    try {
      origin = new URL(config.siteUrl).origin;
    } catch {
      return reply(503, { error: fallback });
    }
    if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site")
      return reply(403, { error: "Please apply from this website." });
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "multipart/form-data")
      return reply(415, { error: "Please use the application form." });
    if (!applicationsAvailable(config)) return reply(503, { error: fallback });
    try {
      const header = config.trustedIpHeader?.toLowerCase();
      const client = header ? request.headers.get(header)?.split(",")[0].trim() : null;
      if (!(await deps.allow(client ? `apply:ip:${client}` : "apply:global")))
        return reply(429, { error: "Too many attempts. Please wait one minute and try again." }, "60");
    } catch {
      return reply(503, { error: fallback });
    }
    const declared = Number(request.headers.get("content-length"));
    if (!declared || declared > MAX_BODY)
      return reply(413, { error: "Your application is too large. Your CV must be 4 MB or smaller." });

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return reply(400, { error: "We couldn't read your application. Please try again." });
    }
    const values: Record<string, string> = {};
    for (const key of Object.keys(applicationSchema.shape)) {
      const v = form.get(key);
      if (typeof v === "string" && v.trim()) values[key] = v;
    }
    const parsed = applicationSchema.safeParse(values);
    if (!parsed.success)
      return reply(400, { error: parsed.error.issues[0]?.message || "Please check your application." });
    const a = parsed.data;
    if (a.website) return reply(200, { ok: true }); // spam trap: pretend success, send nothing

    const job = deps.findOpenJob(a.job);
    if (!job) return reply(410, { error: "Sorry, this vacancy has closed." });

    const cv = form.get("cv");
    if (!(cv instanceof File)) return reply(400, { error: "Please attach your CV." });
    const bytes = new Uint8Array(await cv.arrayBuffer());
    const checked = checkCv(cv.name, bytes);
    if (typeof checked === "string") return reply(400, { error: checked });
    const safeName = `${a.name.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "Applicant"}-CV.${checked.ext}`;

    const rows = emailRows(a, job);
    const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
    const html = `<h2>New job application: ${escapeHtml(job.title)}</h2><table cellpadding="6" style="border-collapse:collapse">${rows
      .map(
        ([k, v]) =>
          `<tr><th align="left" valign="top" style="border-bottom:1px solid #ddd">${escapeHtml(k)}</th><td style="border-bottom:1px solid #ddd;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`,
      )
      .join("")}</table><p>The applicant's CV is attached. Reply to this email to contact them.</p>`;

    try {
      const res = await deps.fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.resendKey}`,
          "Content-Type": "application/json",
          ...(a.idempotencyKey ? { "Idempotency-Key": `application-${a.idempotencyKey}` } : {}),
        },
        body: JSON.stringify({
          from: config.from,
          to: [config.to || APPLICATIONS_TO],
          reply_to: a.email,
          subject: `Job application: ${job.title} — ${a.name}`,
          text,
          html,
          attachments: [{ filename: safeName, content: Buffer.from(bytes).toString("base64") }],
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return reply(502, { error: `We couldn't send your application. Please try again, or email your CV to ${config.to || APPLICATIONS_TO}.` });
    } catch {
      return reply(502, { error: `We couldn't send your application. Please try again, or email your CV to ${config.to || APPLICATIONS_TO}.` });
    }
    return reply(200, { ok: true });
  };
}
