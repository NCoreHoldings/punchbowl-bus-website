import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, BusFront, Mountain, Route } from "lucide-react";
import { company, pages } from "@/lib/content";
import {
  CheckList,
  PageHero,
  QuoteCTA,
  SectionHeading,
  SourceNote,
  pageMetadata,
} from "@/components/common";

const info = pages.charters;
export const metadata = pageMetadata(info);

const faqs = [
  [
    "How do I arrange a charter?",
    "Send a quote request with your date, pickup point, destination, times and group size, or call our charter staff. Our team reviews the details and contacts you. A request is not a confirmed booking.",
  ],
  [
    "Can I choose between a bus and a coach?",
    "Yes. Tell us your preference in the request. Our buses seat up to 57 passengers; our coaches have leather seats fitted with seat belts, air conditioning, TV and DVD.",
  ],
  [
    "Can I include stops along the way?",
    "Add any diversions, such as a comfort stop, in the further details section of the form.",
  ],
  [
    "Do you have seat belts?",
    "Our coaches have seat belts. Tell us if seat belts are required and the team will confirm a suitable vehicle.",
  ],
];

export default function ChartersPage() {
  return (
    <>
      <PageHero info={info} />
      <section className="section wrap split">
        <div className="reveal">
          <span className="eyebrow">Bus charter</span>
          <h2>
            Room for your <span className="accent">plans.</span>
          </h2>
          <p className="lead">
            Punchbowl Bus Company operates a fleet of modern buses that seat up
            to 57 passengers. Our buses are available for local school charters
            in and around the Sydney area.
          </p>
          <p>
            We also operate luxury coaches with leather seats fitted with seat
            belts, air conditioning, TV and DVD, available for day trips to
            Canberra, the Blue Mountains or Wollongong. We can also organise
            day trips and extended tours for groups and individuals.
          </p>
          <div className="button-row">
            <Link href="/request-a-quote" className="button">
              Request a quote <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <a className="button outline" href={company.phoneHref}>
              Call {company.phone}
            </a>
          </div>
        </div>
        <div className="split-media reveal">
          <Image
            src="/images/punchbowl-coach.jpg"
            alt="Punchbowl coach in red and cream livery"
            fill
            sizes="(max-width: 850px) 100vw, 50vw"
          />
        </div>
      </section>

      <section className="band cream">
        <div className="wrap">
          <SectionHeading
            eyebrow="Charter options"
            title={"Local trips,\nday trips, tours."}
          />
          <div className="feature-grid">
            <article className="feature reveal">
              <BusFront aria-hidden="true" />
              <h3>Local bus charters</h3>
              <p>
                School and group charters in and around Sydney, with buses
                seating up to 57.
              </p>
            </article>
            <article className="feature reveal">
              <Mountain aria-hidden="true" />
              <h3>Coach day trips</h3>
              <p>Canberra, the Blue Mountains or Wollongong in a luxury coach.</p>
            </article>
            <article className="feature reveal">
              <Route aria-hidden="true" />
              <h3>Extended tours</h3>
              <p>
                Day trips and extended tours for groups and individuals,
                organised with our team.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section wrap faq-layout">
        <div className="reveal">
          <span className="eyebrow">Questions</span>
          <h2>
            Good to <span className="accent">know.</span>
          </h2>
          <CheckList
            items={[
              "One-way or return journeys",
              "Bus or coach",
              "Comfort stops and diversions",
            ]}
          />
        </div>
        <div className="faq">
          {faqs.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
          <SourceNote path="bus-charter" />
        </div>
      </section>
      <QuoteCTA />
    </>
  );
}
