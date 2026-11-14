import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { pages, services } from "@/lib/content";
import { PageHero, QuoteCTA, pageMetadata } from "@/components/common";

const info = pages.services;
export const metadata = pageMetadata(info);

export default function ServicesPage() {
  return (
    <>
      <PageHero info={info} />
      <section className="section wrap service-rows">
        {services.map((s, i) => (
          <article key={s.key} className={`split${i % 2 ? " reverse" : ""} reveal`}>
            <div className="split-media">
              <Image
                src={s.image}
                alt={s.imageAlt}
                fill
                sizes="(max-width: 850px) 100vw, 50vw"
              />
            </div>
            <div>
              <span className="eyebrow">{s.tagline}</span>
              <h2>{s.title}</h2>
              <p className="lead">{s.text}</p>
              <Link className="text-link" href={s.href}>
                Learn more <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </section>
      <QuoteCTA />
    </>
  );
}
