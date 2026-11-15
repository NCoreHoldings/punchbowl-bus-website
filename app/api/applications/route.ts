import { allowSubmission } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site";
import { allJobs, isOpen } from "@/lib/site-content";
import {
  applicationsAvailable,
  createApplicationHandler,
  type ApplicationConfig,
} from "@/lib/application-handler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const config = (): ApplicationConfig => ({
  siteUrl: siteUrl(),
  resendKey: process.env.RESEND_API_KEY,
  from: process.env.APPLICATIONS_FROM_EMAIL,
  to: process.env.APPLICATIONS_TO_EMAIL || undefined,
  trustedIpHeader: process.env.TRUSTED_CLIENT_IP_HEADER,
});

export async function POST(request: Request) {
  return createApplicationHandler(config(), {
    fetch,
    allow: allowSubmission,
    findOpenJob: (slug) => {
      const job = allJobs().find((j) => j.slug === slug && isOpen(j));
      return job ? { slug: job.slug, title: job.title, role: job.role } : null;
    },
  })(request);
}

export async function GET() {
  return Response.json(
    {
      available:
        applicationsAvailable(config()) &&
        (process.env.NODE_ENV !== "production" || !!process.env.REDIS_URL),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
