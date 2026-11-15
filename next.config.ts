import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  // Job and banner files are read at request time when pages refresh hourly.
  outputFileTracingIncludes: {
    "/": ["./content/**/*"],
    "/careers": ["./content/**/*"],
    "/careers/*": ["./content/**/*"],
    "/api/applications": ["./content/**/*"],
    "/sitemap.xml": ["./content/**/*"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          ...(process.env.INDEXABLE !== "true"
            ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]
            : []),
        ],
      },
    ];
  },
};
export default config;
