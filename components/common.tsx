import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowUpRight, ChevronRight, Check } from "lucide-react";
import { company, type PageInfo } from "@/lib/content";

export function pageMetadata(info: PageInfo): Metadata {
  return {
    title: info.title,
    description: info.description,
    alternates: { canonical: info.path },
    openGraph: {
      title: `${info.title} | ${company.name}`,
      description: info.description,
      url: info.path,
      images: [{ url: info.image, alt: info.imageAlt }],
    },
  };
}

export function Heading({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <span key={line} className={i ? "accent" : undefined}>
          {line}
        </span>
      ))}
    </>
  );
}

export function PageHero({ info }: { info: PageInfo }) {
  return (
    <section className="page-hero">
      <Image
        className="page-hero-photo"
        src={info.image}
        alt=""
        fill
        preload
        sizes="100vw"
      />
      <div className="page-hero-shade" aria-hidden="true" />
      <div className="wrap page-hero-inner">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <ChevronRight size={14} aria-hidden="true" />
          <span aria-current="page">{info.title}</span>
        </nav>
        <span className="eyebrow light">{info.eyebrow}</span>
        <h1>
          <Heading text={info.heading} />
        </h1>
        <p>{info.description}</p>
      </div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  text,
  center,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  center?: boolean;
}) {
  return (
    <div className={`section-heading reveal${center ? " center" : ""}`}>
      <span className="eyebrow">{eyebrow}</span>
      <h2>
        <Heading text={title} />
      </h2>
      {text && <p>{text}</p>}
    </div>
  );
}

export function CheckList({ items }: { items: readonly string[] }) {
  return (
    <ul className="check-list">
      {items.map((item) => (
        <li key={item}>
          <Check size={18} aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function QuoteCTA() {
  return (
    <section className="cta-band">
      <Image
        className="cta-photo"
        src="/images/punchbowl-coach.jpg"
        alt=""
        fill
        sizes="100vw"
      />
      <div className="wrap cta-inner reveal">
        <div>
          <span className="eyebrow light">Planning a trip?</span>
          <h2>Tell us where you’re heading.</h2>
          <p>
            Send your charter details online or call our charter staff on{" "}
            <a href={company.phoneHref}>{company.phone}</a>.
          </p>
        </div>
        <div className="cta-actions">
          <Link className="button" href="/request-a-quote">
            Request a quote <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          <a className="button ghost" href={company.phoneHref}>
            Call {company.phone}
          </a>
        </div>
      </div>
    </section>
  );
}

export function SourceNote({ path }: { path: string }) {
  return (
    <p className="source-note">
      Information from the company’s published website, checked{" "}
      {company.verified}.{" "}
      <a href={`${company.source}/${path}`}>
        View original <ArrowUpRight size={13} aria-hidden="true" />
      </a>
    </p>
  );
}
