import type { MetadataRoute } from "next";
import { pages } from "@/lib/content";
import { siteUrl } from "@/lib/site";
import { openJobs } from "@/lib/site-content";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const jobs = openJobs().map((j) => `/careers/${j.slug}`);
  return ["/", ...Object.values(pages).map((p) => p.path), ...jobs].map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
