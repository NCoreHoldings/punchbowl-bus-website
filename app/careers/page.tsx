import Image from "next/image";
import { BusFront, Wrench, Phone } from "lucide-react";
import { company, pages } from "@/lib/content";
import { PageHero, QuoteCTA, SourceNote, pageMetadata } from "@/components/common";

const info = pages.careers;
export const metadata = pageMetadata(info);

export default function CareersPage() {
  return (
    <>
      <PageHero info={info} />
      <section className="section wrap split">
        <div>
          <div className="career-list">
            <article className="feature reveal">
              <BusFront aria-hidden="true" />
              <h3>Bus driving</h3>
              <p>
                People-focused work with a different view every day, built on
                customer service and teamwork. Ask the team about current
                positions, licence and driver authority requirements, and
                relevant checks.
              </p>
            </article>
            <article className="feature reveal">
              <Wrench aria-hidden="true" />
              <h3>Heavy Commercial Vehicle Mechanical Technology apprenticeships</h3>
              <p>
                A pathway into heavy vehicle maintenance, repair and testing,
                with practical workshop experience. Ask about apprenticeship
                availability and current application requirements.
              </p>
            </article>
          </div>
          <div className="notice reveal">
            <Phone aria-hidden="true" />
            <p>
              <strong>Interested in joining us?</strong> Call{" "}
              <a href={company.phoneHref}>{company.phone}</a> or visit{" "}
              {company.address}. These pathways are informational and do not
              indicate a current vacancy.
            </p>
          </div>
          <SourceNote path="employment" />
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
