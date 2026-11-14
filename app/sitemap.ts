import type { MetadataRoute } from "next";
import { pages } from "@/lib/content";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return ["/", ...Object.values(pages).map((p) => p.path)].map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
