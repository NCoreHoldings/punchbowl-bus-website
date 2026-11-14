import { createEnquiryHandler } from "@/lib/enquiry-handler";
import { allowSubmission } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return createEnquiryHandler(
    {
      siteUrl: siteUrl(),
      apiUrl: process.env.NCORE_API_URL,
      credential: process.env.NCORE_INTEGRATION_CREDENTIAL,
      production: process.env.NODE_ENV === "production",
      trustedIpHeader: process.env.TRUSTED_CLIENT_IP_HEADER,
    },
    { fetch, allow: allowSubmission },
  )(request);
}
export async function GET() {
  return Response.json(
    {
      available: Boolean(
        process.env.NCORE_API_URL &&
        process.env.NCORE_INTEGRATION_CREDENTIAL &&
        (process.env.NODE_ENV !== "production" || process.env.REDIS_URL),
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
