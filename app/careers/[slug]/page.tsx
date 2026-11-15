import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, CalendarClock, CircleDollarSign, MapPin } from "lucide-react";
import { company, pages } from "@/lib/content";
import { PageHero } from "@/components/common";
import { SimpleMarkdown } from "@/components/simple-markdown";
import { ApplicationForm } from "@/components/application-form";
import { allJobs, formatDate, isOpen } from "@/lib/site-content";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return allJobs()
    .filter((j) => j.published)
    .map((j) => ({ slug: j.slug }));
}

const findJob = (slug: string) => allJobs().find((j) => j.slug === slug && j.published);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const job = findJob((await params).slug);
  if (!job) return { title: "Vacancy not found" };
  const path = `/careers/${job.slug}`;
  return {
    title: `${job.title} | Careers`,
    description: job.summary,
    alternates: { canonical: path },
    openGraph: {
      title: `${job.title} | ${company.name}`,
      description: job.summary,
      url: path,
      images: [{ url: pages.careers.image, alt: pages.careers.imageAlt }],
    },
  };
}

const EMPLOYMENT: Record<string, string> = {
  "Full-time": "FULL_TIME",
  "Part-time": "PART_TIME",
  Casual: "PER_DIEM",
  Contract: "CONTRACTOR",
  Apprenticeship: "INTERN",
};

export default async function JobPage({ params }: Props) {
  const job = findJob((await params).slug);
  if (!job) notFound();
  const open = isOpen(job);
  const info = {
    ...pages.careers,
    path: `/careers/${job.slug}`,
    title: job.title,
    eyebrow: `${job.role} · ${job.employmentType}`,
    heading: job.title,
    description: job.summary,
  };
  // Google job search: https://developers.google.com/search/docs/appearance/structured-data/job-posting
  const posting = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: `<p>${job.summary}</p>`,
    datePosted: job.posted,
    ...(job.closes ? { validThrough: `${job.closes}T23:59:59+10:00` } : {}),
    employmentType: EMPLOYMENT[job.employmentType],
    hiringOrganization: { "@type": "Organization", name: company.name, sameAs: siteUrl() },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        streetAddress: "56 Hannans Road",
        addressLocality: "Riverwood",
        addressRegion: "NSW",
        postalCode: "2210",
        addressCountry: "AU",
      },
    },
  };

  return (
    <>
      {open && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(posting).replace(/</g, "\\u003c") }}
        />
      )}
      <PageHero info={info} parent={{ title: "Careers", href: "/careers" }} />
      <section className="section wrap job-layout">
        <article className="job-details">
          <Link className="text-link back-link" href="/careers">
            <ArrowLeft size={16} aria-hidden="true" /> All vacancies
          </Link>
          <ul className="job-facts">
            <li>
              <BriefcaseBusiness size={18} aria-hidden="true" />
              <span>
                <small>Position</small>
                {job.role} · {job.employmentType}
              </span>
            </li>
            <li>
              <MapPin size={18} aria-hidden="true" />
              <span>
                <small>Location</small>
                {job.location}
              </span>
            </li>
            {job.salary && (
              <li>
                <CircleDollarSign size={18} aria-hidden="true" />
                <span>
                  <small>Pay</small>
                  {job.salary}
                </span>
              </li>
            )}
            {job.closes && (
              <li>
                <CalendarClock size={18} aria-hidden="true" />
                <span>
                  <small>Applications close</small>
                  {formatDate(job.closes)}
                </span>
              </li>
            )}
          </ul>
          {job.poster && (
            <figure className="job-poster">
              <a href={job.poster} target="_blank" rel="noopener" aria-label="Open the full-size job advertisement">
                <Image
                  src={job.poster}
                  alt={job.posterAlt || `${job.title} job advertisement`}
                  width={1200}
                  height={1300}
                  sizes="(max-width: 950px) 100vw, 640px"
                />
              </a>
              <figcaption>Tap or click the advertisement to view it full size.</figcaption>
            </figure>
          )}
          <div className="prose">
            <SimpleMarkdown source={job.body} />
          </div>
        </article>
        <aside className="job-apply" id="apply" aria-labelledby="apply-title">
          <h2 id="apply-title">{open ? "Apply now" : "Applications closed"}</h2>
          {open ? (
            <ApplicationForm job={{ slug: job.slug, title: job.title, role: job.role }} />
          ) : (
            <p className="form-message warning">
              Sorry, this vacancy has closed.{" "}
              <Link href="/careers">See current vacancies</Link>.
            </p>
          )}
        </aside>
      </section>
    </>
  );
}
