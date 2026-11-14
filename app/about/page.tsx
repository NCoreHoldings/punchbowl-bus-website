import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Leaf } from "lucide-react";
import { aboutTimeline, accreditations, pages } from "@/lib/content";
import {
  PageHero,
  QuoteCTA,
  SectionHeading,
  SourceNote,
  pageMetadata,
} from "@/components/common";

const info = pages.about;
export const metadata = pageMetadata(info);

export default function AboutPage() {
  return (
    <>
      <PageHero info={info} />
      <section className="section wrap split">
        <div className="reveal">
          <span className="eyebrow">Our history</span>
          <h2>
            It started <span className="accent">in Punchbowl.</span>
          </h2>
          <p className="lead">
            The origins of Punchbowl Bus Company commenced in 1947, when Deluxe
            Bus Service was incorporated as Punchbowl Bus Company.
          </p>
          <p>
            Narwee Bus Company / GP Bus Company commenced in 1952, when routes
            28 and 33 were transferred from Punchbowl Bus Company. In 1958,
            Narwee Bus Company / GP Bus Company purchased Punchbowl Bus Company,
            adopting the Punchbowl Bus Company name and livery.
          </p>
          <p>
            Narwee Bus Company operated from the Hannans Road depot, which is
            Punchbowl Bus Company’s home today. Punchbowl Bus Company was then
            located on the corner of Canterbury Road and Belmore Road at
            Punchbowl.
          </p>
        </div>
        <figure className="heritage-figure stacked reveal">
          <Image
            src="/images/heritage.jpg"
            alt="Four historic Punchbowl buses showing the company’s changing liveries"
            width={838}
            height={126}
            sizes="(max-width: 850px) 100vw, 50vw"
          />
          <figcaption>Punchbowl buses through the decades.</figcaption>
        </figure>
      </section>

      <section className="band cream">
        <div className="wrap">
          <SectionHeading eyebrow="Milestones" title={"Moments that\nshaped us."} />
          <ol className="timeline">
            {aboutTimeline.map((t) => (
              <li key={t.year} className="reveal">
                <strong>{t.year}</strong>
                <h3>{t.title}</h3>
                <p>{t.text}</p>
              </li>
            ))}
          </ol>
          <SourceNote path="about-us/about-us" />
        </div>
      </section>

      <section className="section wrap">
        <SectionHeading
          eyebrow="Standards"
          title={"Certified\nand accountable."}
          text="Punchbowl Bus Company displays ISO 9001, ISO 14001 and ISO 45001 certification, and is Australian owned and operated."
          center
        />
        <div className="badge-row reveal">
          {accreditations.map((a) => (
            <Image key={a.src} src={a.src} alt={a.alt} width={150} height={110} />
          ))}
        </div>
        <Link className="env-banner reveal" href="/environment">
          <Leaf size={32} aria-hidden="true" />
          <span>
            <strong>Environment policy</strong>
            Read about our approach to environmental management.
          </span>
          <ArrowRight aria-hidden="true" />
        </Link>
      </section>
      <QuoteCTA />
    </>
  );
}
