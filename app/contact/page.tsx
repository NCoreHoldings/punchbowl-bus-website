import Link from "next/link";
import { ArrowUpRight, Clock3, MapPin, Phone, Mail } from "lucide-react";
import { company, pages } from "@/lib/content";
import { PageHero, SourceNote, pageMetadata } from "@/components/common";

const info = pages.contact;
export const metadata = pageMetadata(info);

export default function ContactPage() {
  return (
    <>
      <PageHero info={info} />
      <section className="section wrap contact-layout">
        <div className="contact-cards">
          <a className="contact-card reveal" href={company.phoneHref}>
            <Phone aria-hidden="true" />
            <span className="mini-label">Telephone</span>
            <strong>{company.phone}</strong>
            <span className="text-link">
              Call now <ArrowUpRight size={16} aria-hidden="true" />
            </span>
          </a>
          <a
            className="contact-card reveal"
            href={company.mapHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPin aria-hidden="true" />
            <span className="mini-label">In person</span>
            <strong>{company.address}</strong>
            <span className="text-link">
              Get directions <ArrowUpRight size={16} aria-hidden="true" />
            </span>
          </a>
          <div className="contact-card reveal">
            <Clock3 aria-hidden="true" />
            <span className="mini-label">Office hours</span>
            <strong>8:00am – 5:00pm</strong>
            <span>Monday to Friday</span>
          </div>
          <div className="contact-card reveal">
            <Mail aria-hidden="true" />
            <span className="mini-label">Mail</span>
            <strong>56 Hannans Rd, Riverwood NSW 2210</strong>
          </div>
        </div>
        <aside className="contact-aside reveal">
          <span className="eyebrow light">Charter enquiries</span>
          <h2>Planning a trip?</h2>
          <p>
            Send your trip details and our charter team will review your request
            and contact you.
          </p>
          <Link className="button" href="/request-a-quote">
            Request a quote <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </aside>
      </section>
      <div className="wrap source-block">
        <SourceNote path="contact-us" />
      </div>
    </>
  );
}
