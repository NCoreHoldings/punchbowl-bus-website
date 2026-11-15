/**
 * Editable website content: job vacancies (content/careers/*.md) and homepage
 * banners (content/promotions/*.md). Each file is a small "front matter"
 * header (key: value lines between --- markers) followed by Markdown text.
 * Files whose names start with "_" are templates and are ignored.
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { sydneyToday } from "./form-data";
import { imageSize } from "./image-size";

const ROOT = path.join(process.cwd(), "content");

export type FrontMatter = Record<string, string | boolean | number>;

/** Parse "key: value" lines between --- markers. Values may be quoted. */
export function parseFrontMatter(source: string): {
  data: FrontMatter;
  body: string;
} {
  const text = source.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!match) throw new Error("must start with a --- header block");
  const data: FrontMatter = {};
  for (const [i, raw] of match[1].split("\n").entries()) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const sep = line.indexOf(":");
    if (sep < 1) throw new Error(`header line ${i + 1} needs "name: value"`);
    const key = line.slice(0, sep).trim();
    let value: string | boolean | number = line.slice(sep + 1).trim();
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    else if (value === "true" || value === "yes") value = true;
    else if (value === "false" || value === "no") value = false;
    else if (/^-?\d+(\.\d+)?$/.test(value)) value = Number(value);
    data[key] = value;
  }
  return { data, body: match[2].trim() };
}

const date = z.iso.date({ message: "must be a date like 2026-12-31" });
const text = (max: number) => z.string().trim().min(1).max(max);
const link = z
  .string()
  .trim()
  .refine((v) => /^\/(?!\/)/.test(v) || /^https:\/\//.test(v) || /^(tel|mailto):/.test(v), {
    message: "must start with /, https://, tel: or mailto:",
  });

export const EMPLOYMENT_TYPES = [
  "Full-time",
  "Part-time",
  "Casual",
  "Contract",
  "Apprenticeship",
] as const;

const jobSchema = z.object({
  title: text(120),
  role: text(60),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  location: text(160),
  summary: text(400),
  salary: z.string().trim().max(120).optional(),
  /** Optional advertisement image shown on the job page. */
  poster: z
    .string()
    .trim()
    .regex(/^\/images\/[\w./-]+\.(jpe?g|png|webp)$/i, { message: "must be a picture in public/images" })
    .optional(),
  posterAlt: z.string().trim().max(400).optional(),
  posted: date,
  closes: date.optional(),
  published: z.boolean().default(true),
});
export type Job = z.infer<typeof jobSchema> & { slug: string; body: string };

/**
 * "photo" fills the hero with a wide picture; "poster" shows a designed
 * advertisement (e.g. a hiring flyer) in full beside the headline.
 */
export const PROMOTION_STYLES = ["photo", "poster"] as const;
/** Smallest pictures that still look sharp in the hero. */
export const MIN_SIZE = {
  photo: { width: 1600, height: 900 },
  poster: { width: 900, height: 900 },
} as const;

const promotionSchema = z
  .object({
    style: z.enum(PROMOTION_STYLES).default("photo"),
    title: text(120),
    text: z.string().trim().max(300).optional(),
    eyebrow: z.string().trim().max(80).optional(),
    image: z
      .string()
      .trim()
      .regex(/^\/images\/[\w./-]+\.(jpe?g|png|webp|avif)$/i, {
        message: "must be a picture in public/images, e.g. /images/promotions/offer.jpg",
      }),
    imageAlt: text(200),
    buttonLabel: z.string().trim().max(40).optional(),
    buttonLink: link.optional(),
    start: date.optional(),
    end: date.optional(),
    order: z.number().default(100),
    published: z.boolean().default(true),
  })
  .refine((p) => !p.buttonLabel === !p.buttonLink, {
    message: "buttonLabel and buttonLink must be used together",
  });
export type Promotion = z.infer<typeof promotionSchema> & { slug: string };

function readFolder(folder: string) {
  const dir = path.join(ROOT, folder);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .sort()
    .map((file) => {
      const slug = file.replace(/\.md$/, "").toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]*$/.test(slug))
        throw new Error(
          `content/${folder}/${file}: file names may only use lowercase letters, numbers and hyphens`,
        );
      try {
        return { slug, file, ...parseFrontMatter(fs.readFileSync(path.join(dir, file), "utf8")) };
      } catch (e) {
        throw new Error(`content/${folder}/${file}: ${(e as Error).message}`);
      }
    });
}

function check<T>(schema: z.ZodType<T>, data: unknown, where: string): T {
  const parsed = schema.safeParse(data);
  if (parsed.success) return parsed.data;
  const issues = parsed.error.issues
    .map((i) => `${i.path.join(".") || "file"} ${i.message}`)
    .join("; ");
  throw new Error(`${where}: ${issues}`);
}

export function allJobs(): Job[] {
  return readFolder("careers").map(({ slug, file, data, body }) => ({
    ...check(jobSchema, data, `content/careers/${file}`),
    slug,
    body,
  }));
}

export function isOpen(job: Job, today = sydneyToday()) {
  return job.published && job.posted <= today && (!job.closes || job.closes >= today);
}

/** Published vacancies that are open today (Sydney time), newest first. */
export function openJobs(today = sydneyToday()): Job[] {
  return allJobs()
    .filter((j) => isOpen(j, today))
    .sort((a, b) => b.posted.localeCompare(a.posted) || a.title.localeCompare(b.title));
}

/** Reject banner pictures that are missing or too small to look sharp. */
export function checkPicture(p: { image: string; style: keyof typeof MIN_SIZE }, where: string) {
  const file = path.join(process.cwd(), "public", p.image);
  if (!fs.existsSync(file)) throw new Error(`${where}: picture not found at public${p.image}`);
  const size = imageSize(new Uint8Array(fs.readFileSync(file)));
  if (!size) throw new Error(`${where}: picture must be a JPG, PNG or WEBP file`);
  const min = MIN_SIZE[p.style];
  if (size.width < min.width || size.height < min.height)
    throw new Error(
      `${where}: picture is ${size.width}×${size.height} pixels; ${p.style} banners need at least ${min.width}×${min.height} so they look sharp`,
    );
}

/** Published banners whose start/end dates include today (Sydney time). */
export function activePromotions(today = sydneyToday()): Promotion[] {
  return readFolder("promotions")
    .map(({ slug, file, data }) => {
      const where = `content/promotions/${file}`;
      const promo = check(promotionSchema, data, where);
      if (promo.published) checkPicture(promo, where);
      return { ...promo, slug };
    })
    .filter(
      (p) => p.published && (!p.start || p.start <= today) && (!p.end || p.end >= today),
    )
    .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}

/** "2026-12-31" → "31 December 2026" */
export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-AU", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`),
  );
