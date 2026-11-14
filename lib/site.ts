/** Public origin of this website, used for canonical URLs, sitemap and social previews. */
export function siteUrl(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3001";
}

export const indexable = () => process.env.INDEXABLE === "true";
