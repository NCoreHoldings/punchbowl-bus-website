import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export default function NotFound() {
  return (
    <section className="wrap section center-block not-found">
      <span className="eyebrow">Page not found</span>
      <h1>
        This stop isn’t <span className="accent">on our route.</span>
      </h1>
      <p className="lead">The page you’re looking for has moved or doesn’t exist.</p>
      <div className="button-row center">
        <Link className="button" href="/">
          Back to home <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
        <Link className="button outline" href="/contact">
          Contact us
        </Link>
      </div>
    </section>
  );
}
