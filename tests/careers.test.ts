import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import fsSync from "node:fs";
import { imageSize } from "../lib/image-size";
import {
  activePromotions,
  checkPicture,
  allJobs,
  isOpen,
  openJobs,
  parseFrontMatter,
  type Job,
} from "../lib/site-content";
import { checkCv, createApplicationHandler, type ApplicationConfig } from "../lib/application-handler";

describe("Content files", () => {
  it("parses headers with quotes, booleans, numbers and comments", () => {
    const { data, body } = parseFrontMatter(
      '---\n# note\ntitle: "Driver: weekends"\npublished: false\norder: 5\n---\n## About\nText',
    );
    expect(data).toEqual({ title: "Driver: weekends", published: false, order: 5 });
    expect(body).toBe("## About\nText");
    expect(() => parseFrontMatter("title: no header")).toThrow(/--- header/);
  });
  it("loads the real content folder: templates hidden, starter banners valid", () => {
    expect(allJobs().map((j) => j.slug)).not.toContain("_driver-template");
    expect(activePromotions("2026-11-15").map((p) => p.slug)).toEqual([
      "apprentice-diesel-mechanic",
      "baylink-shuttle",
    ]);
    // The hiring poster ends with its closing date.
    expect(activePromotions("2026-12-11").map((p) => p.slug)).toEqual(["baylink-shuttle"]);
    expect(activePromotions("2026-11-15")[0].style).toBe("poster");
  });
  it("job templates become valid vacancies once published", () => {
    for (const file of ["_driver-template.md", "_mechanic-template.md"]) {
      const raw = fs.readFileSync(path.join("content/careers", file), "utf8");
      const { data } = parseFrontMatter(raw);
      expect(data.published).toBe(false);
      expect(data.employmentType).toBe("Full-time");
    }
  });
  it("shows a job only while published and between posted and closing dates", () => {
    const job = { published: true, posted: "2026-12-01", closes: "2026-12-31" } as Job;
    expect(isOpen(job, "2026-11-30")).toBe(false);
    expect(isOpen(job, "2026-12-01")).toBe(true);
    expect(isOpen(job, "2026-12-31")).toBe(true);
    expect(isOpen(job, "2027-01-01")).toBe(false);
    expect(isOpen({ ...job, published: false }, "2026-12-15")).toBe(false);
    expect(isOpen({ ...job, closes: undefined }, "2030-01-01")).toBe(true);
    expect(openJobs("2026-11-15").map((j) => j.slug)).toEqual(["apprentice-diesel-mechanic"]);
    expect(openJobs("2026-12-11")).toEqual([]);
  });
});

describe("Banner picture quality", () => {
  it("reads picture sizes from file headers", () => {
    const read = (f: string) => imageSize(new Uint8Array(fsSync.readFileSync(f)));
    expect(read("public/images/heritage.jpg")).toEqual({ width: 838, height: 126 });
    expect(read("public/images/baylink-bus.jpg")).toEqual({ width: 2400, height: 1600 });
    expect(read("public/images/iso-9001.png")).toEqual({ width: 300, height: 265 });
  });
  it("rejects pictures too small to look sharp and accepts good ones", () => {
    expect(() => checkPicture({ image: "/images/heritage.jpg", style: "photo" }, "test")).toThrow(
      /838×126 pixels; photo banners need at least 1600×900/,
    );
    expect(() => checkPicture({ image: "/images/missing.jpg", style: "photo" }, "test")).toThrow(/not found/);
    expect(() => checkPicture({ image: "/images/baylink-bus.jpg", style: "photo" }, "test")).not.toThrow();
    expect(() =>
      checkPicture({ image: "/images/promotions/apprentice-diesel-mechanic.jpg", style: "poster" }, "test"),
    ).not.toThrow();
    expect(() =>
      checkPicture({ image: "/images/promotions/apprentice-diesel-mechanic.jpg", style: "photo" }, "test"),
    ).toThrow(/1198×1313/);
  });
});

const pdf = () => new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]);
describe("CV checks", () => {
  it("accepts PDF, DOCX and DOC by content and rejects everything else", () => {
    expect(checkCv("cv.pdf", pdf())).toMatchObject({ ext: "pdf" });
    expect(checkCv("cv.docx", new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1]))).toMatchObject({ ext: "docx" });
    expect(checkCv("cv.doc", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))).toMatchObject({ ext: "doc" });
    expect(checkCv("cv.exe", pdf())).toMatch(/PDF or Word/);
    expect(checkCv("cv.pdf", new Uint8Array([0x4d, 0x5a]))).toMatch(/doesn't look like/);
    expect(checkCv("cv.pdf", new Uint8Array(4 * 1024 * 1024 + 1).fill(0x25))).toMatch(/4 MB/);
  });
});

const config: ApplicationConfig = {
  siteUrl: "http://localhost:3001",
  resendKey: "re_TEST_ONLY",
  from: "Punchbowl Careers <careers@punchbowlbus.com.au>",
};
const openJob = { slug: "bus-driver", title: "Bus Driver", role: "Driver" };
function setup(settings = config, status = 200) {
  const send = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: "email_1" }, { status }));
  const allow = vi.fn().mockResolvedValue(true);
  const handle = createApplicationHandler(settings, {
    fetch: send,
    allow,
    findOpenJob: (slug) => (slug === "bus-driver" ? openJob : null),
  });
  return { handle, send, allow };
}
function form(overrides: Record<string, string | File | null> = {}) {
  const fd = new FormData();
  const values: Record<string, string | File | null> = {
    job: "bus-driver",
    name: "Alex <Test>",
    email: "alex@example.test",
    phone: "0400 000 000",
    suburb: "Riverwood",
    rightToWork: "Yes",
    licence: "Heavy Rigid (HR)",
    driverAuthority: "Yes, I hold one",
    wwcc: "Yes",
    message: "Available weekends",
    consent: "yes",
    idempotencyKey: "key-1",
    cv: new File([pdf()], "My CV.pdf", { type: "application/pdf" }),
    ...overrides,
  };
  for (const [k, v] of Object.entries(values)) if (v !== null) fd.set(k, v);
  return fd;
}
async function post(handle: (r: Request) => Promise<Response>, body: FormData, headers: Record<string, string> = {}) {
  const probe = new Request("http://localhost:3001/api/applications", { method: "POST", body });
  const bytes = await probe.arrayBuffer();
  return handle(
    new Request("http://localhost:3001/api/applications", {
      method: "POST",
      body: bytes,
      headers: {
        "content-type": probe.headers.get("content-type")!,
        "content-length": String(bytes.byteLength),
        origin: "http://localhost:3001",
        ...headers,
      },
    }),
  );
}

describe("Application endpoint", () => {
  it("emails the application with the CV attached to admin@punchbowlbus.com.au", async () => {
    const { handle, send } = setup();
    const res = await post(handle, form());
    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    const [url, init] = send.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init!.headers as Record<string, string>)["Idempotency-Key"]).toBe("application-key-1");
    const email = JSON.parse(init!.body as string);
    expect(email.to).toEqual(["admin@punchbowlbus.com.au"]);
    expect(email.reply_to).toBe("alex@example.test");
    expect(email.subject).toBe("Job application: Bus Driver — Alex <Test>");
    expect(email.text).toContain("Licence class: Heavy Rigid (HR)");
    expect(email.html).toContain("Alex &lt;Test&gt;");
    expect(email.html).not.toContain("<Test>");
    expect(email.attachments[0].filename).toBe("Alex-Test-CV.pdf");
    expect(Buffer.from(email.attachments[0].content, "base64")).toEqual(Buffer.from(pdf()));
  });
  it("refuses other sites, non-form bodies and an unconfigured mailer", async () => {
    const { handle, send } = setup();
    expect((await post(handle, form(), { origin: "https://evil.example" })).status).toBe(403);
    const json = await handle(
      new Request("http://localhost:3001/api/applications", {
        method: "POST",
        headers: { origin: "http://localhost:3001", "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(json.status).toBe(415);
    const off = setup({ ...config, resendKey: undefined });
    const res = await post(off.handle, form());
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain("admin@punchbowlbus.com.au");
    expect(send).not.toHaveBeenCalled();
    expect(off.send).not.toHaveBeenCalled();
  });
  it("rejects missing consent, a bad CV and closed vacancies without sending", async () => {
    const { handle, send } = setup();
    expect((await post(handle, form({ consent: null }))).status).toBe(400);
    const bad = await post(handle, form({ cv: new File([new Uint8Array([0x4d, 0x5a, 0])], "cv.pdf") }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatch(/doesn't look like/);
    expect((await post(handle, form({ cv: null }))).status).toBe(400);
    expect((await post(handle, form({ job: "old-job" }))).status).toBe(410);
    expect(send).not.toHaveBeenCalled();
  });
  it("silently drops spam-trap submissions and rate-limits", async () => {
    const { handle, send, allow } = setup();
    expect((await post(handle, form({ website: "http://spam.example" }))).status).toBe(200);
    expect(send).not.toHaveBeenCalled();
    allow.mockResolvedValueOnce(false);
    const limited = await post(handle, form());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
  });
  it("reports a delivery failure so the applicant can retry", async () => {
    const { handle } = setup(config, 500);
    const res = await post(handle, form());
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("try again");
  });
});
