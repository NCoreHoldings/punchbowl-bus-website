import { ArrowRight, Check } from "lucide-react";
import { company, pages } from "@/lib/content";
import { PageHero, pageMetadata } from "@/components/common";
import { EnquiryForm } from "@/components/enquiry-form";

const info = pages["request-a-quote"];
export const metadata = pageMetadata(info);

export default function QuotePage() {
  return (
    <>
      <PageHero info={info} />
      <section className="wrap quote-layout">
        <div className="quote-card">
          <EnquiryForm />
        </div>
        <aside className="quote-aside">
          <span className="eyebrow">What happens next</span>
          <h2>From request to the road.</h2>
          <ul className="check-list">
            <li>
              <Check size={18} aria-hidden="true" />
              Your request goes straight to our charter team.
            </li>
            <li>
              <Check size={18} aria-hidden="true" />
              We review your trip and contact you to discuss the quote.
            </li>
            <li>
              <Check size={18} aria-hidden="true" />
              Nothing is booked until you confirm with our team.
            </li>
          </ul>
          <hr />
          <span className="mini-label">Prefer to talk?</span>
          <a className="quote-phone" href={company.phoneHref}>
            {company.phone}
          </a>
          <small>{company.hours}</small>
          <p className="privacy-note">
            Your details are sent securely to our booking system for review.{" "}
            <a href={`${company.source}/privacy`}>
              Privacy policy <ArrowRight size={12} aria-hidden="true" />
            </a>
          </p>
        </aside>
      </section>
    </>
  );
}
