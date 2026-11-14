import Link from "next/link";
import { ArrowUpRight, GraduationCap, Users, ArrowLeftRight, School } from "lucide-react";
import { pages } from "@/lib/content";
import {
  PageHero,
  QuoteCTA,
  SectionHeading,
  SourceNote,
  pageMetadata,
} from "@/components/common";

const info = pages["school-group-travel"];
export const metadata = pageMetadata(info);

const options = [
  { icon: School, title: "School transfers", text: "Getting students between campuses, venues and events." },
  { icon: Users, title: "Single & multiple bus hire", text: "One bus for a class, or several for a whole year group." },
  { icon: GraduationCap, title: "Local excursions", text: "Excursions in and around the Sydney area." },
  { icon: ArrowLeftRight, title: "One-way or return", text: "Charters arranged as a single leg or a return journey." },
];

export default function SchoolGroupPage() {
  return (
    <>
      <PageHero info={info} />
      <section className="section wrap">
        <SectionHeading
          eyebrow="Group / school charters"
          title={"Every kind of\ngroup trip."}
          text="Tell us how many students and accompanying adults are travelling, your timing, pickup instructions and any seatbelt or accessibility requirements."
        />
        <div className="feature-grid four">
          {options.map(({ icon: Icon, title, text }) => (
            <article key={title} className="feature reveal">
              <Icon aria-hidden="true" />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <div className="button-row center">
          <Link className="button" href="/request-a-quote">
            Plan a school or group trip <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
        <SourceNote path="group-school-charters" />
      </section>
      <QuoteCTA />
    </>
  );
}
