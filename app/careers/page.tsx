import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  BusFront,
  CalendarClock,
  MapPin,
  Wrench,
} from "lucide-react";
import { company, pages } from "@/lib/content";
import { PageHero, QuoteCTA, SectionHeading, pageMetadata } from "@/components/common";
import { formatDate, openJobs, type Job } from "@/lib/site-content";

const info = pages.careers;
export const metadata = pageMetadata(info);
// Vacancies past their closing date drop off within the hour, without a redeploy.
export const revalidate = 3600;

export default function CareersPage() {
  const jobs = openJobs();
  return (
    <>
      <PageHero info={info} />
      <section className="section wrap">
        <SectionHeading
          eyebrow="Current vacancies"
          title={"Join the\nPunchbowl team."}
          text="Browse our open positions and apply online with your CV."
        />
        {jobs.length ? (
          <ul className="job-list">
            {jobs.map((job) => (
              <li key={job.slug}>
                <JobCard job={job} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="no-vacancies" role="status">
            <BriefcaseBusiness size={28} aria-hidden="true" />
            <p>
              <strong>
                There are currently no vacancies available. Please check back
                later for future opportunities.
              </strong>{" "}
              You’re also welcome to call us on{" "}
              <a href={company.phoneHref}>{company.phone}</a> or follow our{" "}
              <a href={company.facebook} target="_blank" rel="noopener noreferrer">
                Facebook page
              </a>{" "}
              for announcements.
            </p>
          </div>
        )}
      </section>

      <section className="section wrap split careers-about">
        <div>
          <span className="eyebrow">Working with us</span>
          <h2>Careers that keep Sydney moving.</h2>
          <div className="career-list">
            <article className="feature reveal">
              <BusFront aria-hidden="true" />
              <h3>Bus driving</h3>
              <p>
                People-focused work with a different view every day, built on
                customer service and teamwork.
              </p>
            </article>
            <article className="feature reveal">
              <Wrench aria-hidden="true" />
              <h3>Mechanics & apprenticeships</h3>
              <p>
                Heavy vehicle maintenance, repair and testing, with practical
                workshop experience, including Heavy Commercial Vehicle
                Mechanical Technology apprenticeships.
              </p>
            </article>
          </div>
        </div>
        <div className="split-media tall reveal">
          <Image
            src="/images/apprentice.jpg"
            alt="Punchbowl apprentice mechanic working on a bus engine"
            fill
            sizes="(max-width: 850px) 100vw, 50vw"
          />
        </div>
      </section>
      <QuoteCTA />
    </>
  );
}

function JobCard({ job }: { job: Job }) {
  const Icon = /mechanic|technician|apprentice/i.test(job.role) ? Wrench : BusFront;
  return (
    <article className="job-card">
      <div className="job-card-icon" aria-hidden="true">
        <Icon size={24} />
      </div>
      <div className="job-card-body">
        <span className="job-tag">
          {job.role} · {job.employmentType}
        </span>
        <h3>
          <Link href={`/careers/${job.slug}`}>{job.title}</Link>
        </h3>
        <p>{job.summary}</p>
        <ul className="job-meta">
          <li>
            <MapPin size={15} aria-hidden="true" /> {job.location}
          </li>
          {job.closes && (
            <li>
              <CalendarClock size={15} aria-hidden="true" /> Applications close{" "}
              {formatDate(job.closes)}
            </li>
          )}
        </ul>
      </div>
      <Link
        className="button"
        href={`/careers/${job.slug}#apply`}
        aria-label={`Apply now for ${job.title}`}
      >
        Apply now <ArrowUpRight size={17} aria-hidden="true" />
      </Link>
    </article>
  );
}
