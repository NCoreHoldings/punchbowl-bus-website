import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Armchair, BusFront } from "lucide-react";
import { fleet, fleetHistory, pages } from "@/lib/content";
import {
  CheckList,
  PageHero,
  QuoteCTA,
  SectionHeading,
  SourceNote,
  pageMetadata,
} from "@/components/common";

const info = pages.fleet;
export const metadata = pageMetadata(info);

export default function FleetPage() {
  return (
    <>
      <PageHero info={info} />
      <section className="section wrap">
        <SectionHeading
          eyebrow="Our vehicles"
          title={"Choose the right\nvehicle for your group."}
          text="Tell us whether you’d prefer a bus or a coach when you request a quote. Vehicle availability is confirmed by our charter team."
        />
        <div className="fleet-showcase reveal">
          <Image
            src="/images/punchbowl-coach.jpg"
            alt="Punchbowl Bus Company coach in red and cream livery"
            fill
            sizes="100vw"
          />
        </div>
        <div className="fleet-grid">
          {fleet.map((f, i) => {
            const Icon = i === 0 ? BusFront : Armchair;
            return (
              <article key={f.title} className="fleet-card reveal">
                <div className="fleet-card-top">
                  <Icon size={30} aria-hidden="true" />
                  <span className="fleet-badge">{f.capacity}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
                <CheckList items={f.features} />
              </article>
            );
          })}
        </div>
      </section>

      <section className="band dark">
        <div className="wrap">
          <SectionHeading
            eyebrow="Fleet heritage"
            title={"Decades of\nbuses and coaches."}
            text="Highlights from the company’s published history of its coach and bus fleet."
          />
          <ol className="history-grid">
            {fleetHistory.map((h) => (
              <li key={h.year} className="reveal">
                <strong>{h.year}</strong>
                <p>{h.text}</p>
              </li>
            ))}
          </ol>
          <figure className="heritage-figure wide reveal">
            <Image
              src="/images/heritage.jpg"
              alt="Four historic Punchbowl buses showing the company’s changing liveries"
              width={838}
              height={126}
              sizes="100vw"
            />
          </figure>
          <SourceNote path="about-us/about-us" />
        </div>
      </section>

      <section className="section wrap center-block reveal">
        <h2>
          Need a bus <span className="accent">or a coach?</span>
        </h2>
        <p className="lead">
          Choose your vehicle preference and seatbelt requirement in the quote
          form.
        </p>
        <Link className="button" href="/request-a-quote">
          Request a quote <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </section>
      <QuoteCTA />
    </>
  );
}
