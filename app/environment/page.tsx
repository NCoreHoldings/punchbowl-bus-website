import { ArrowUpRight, Leaf, ShieldCheck, Users } from "lucide-react";
import { company, pages } from "@/lib/content";
import { PageHero, QuoteCTA, SourceNote, pageMetadata } from "@/components/common";

const info = pages.environment;
export const metadata = pageMetadata(info);

export default function EnvironmentPage() {
  return (
    <>
      <PageHero info={info} />
      <section className="section wrap narrow">
        <h2 className="reveal">
          Responsibility, <span className="accent">every day.</span>
        </h2>
        <p className="lead reveal">
          Punchbowl’s published environmental policy describes a commitment to
          an environmental management system and continual improvement. It
          covers the impacts of operations, waste handling, staff training and
          emergency planning.
        </p>
        <div className="feature-grid">
          <article className="feature reveal">
            <Leaf aria-hidden="true" />
            <h3>Resource awareness</h3>
            <p>Considering recyclable materials and opportunities to minimise waste.</p>
          </article>
          <article className="feature reveal">
            <ShieldCheck aria-hidden="true" />
            <h3>Responsible operations</h3>
            <p>Assessing environmental impacts and maintaining appropriate procedures.</p>
          </article>
          <article className="feature reveal">
            <Users aria-hidden="true" />
            <h3>Shared responsibility</h3>
            <p>Supporting employees and contractors with environmental awareness and training.</p>
          </article>
        </div>
        <a className="text-link" href={`${company.source}/environment-policy`}>
          Read the full company policy <ArrowUpRight size={17} aria-hidden="true" />
        </a>
        <SourceNote path="environment-policy" />
      </section>
      <QuoteCTA />
    </>
  );
}
