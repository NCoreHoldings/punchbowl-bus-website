import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, ArrowRight, Phone } from "lucide-react";
import { company, fleet, services } from "@/lib/content";
import { CheckList, QuoteCTA, SectionHeading } from "@/components/common";

export default function Home() {
  return (
    <>
      <section className="home-hero">
        <Image
          className="hero-photo"
          src="/images/punchbowl-coach.jpg"
          alt="Punchbowl Bus Company coach in its red and cream livery"
          fill
          preload
          sizes="100vw"
        />
        <div className="hero-shade" aria-hidden="true" />
        <div className="wrap hero-content">
          <span className="eyebrow light hero-eyebrow">
            Sydney bus &amp; coach charters · Since 1947
          </span>
          <h1>
            Travel together,
            <span className="accent"> the Punchbowl way.</span>
          </h1>
          <p>
            Modern buses seating up to 57 passengers and luxury coaches for
            school charters, day trips and extended tours across Sydney and
            beyond.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/request-a-quote">
              Request a quote <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <a className="button ghost" href={company.phoneHref}>
              <Phone size={17} aria-hidden="true" /> {company.phone}
            </a>
          </div>
        </div>
        <div className="wrap hero-stats" aria-label="At a glance">
          <div>
            <strong>1947</strong>
            <span>Serving Sydney since</span>
          </div>
          <div>
            <strong>57</strong>
            <span>Seats per bus, up to</span>
          </div>
          <div>
            <strong>ISO</strong>
            <span>9001 · 14001 · 45001</span>
          </div>
          <div>
            <strong>Local</strong>
            <span>Australian owned &amp; operated</span>
          </div>
        </div>
      </section>

      <section className="section wrap">
        <SectionHeading
          eyebrow="Our services"
          title={"Where would you\nlike to go?"}
          text="From the school excursion to the weekend away, choose the service that fits your group."
        />
        <div className="service-grid">
          {services.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              className="service-card reveal"
            >
              <div className="service-media">
                <Image
                  src={s.image}
                  alt={s.imageAlt}
                  fill
                  sizes="(max-width: 850px) 100vw, 33vw"
                />
              </div>
              <div className="service-body">
                <span className="mini-label">{s.tagline}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                <span className="text-link">
                  Learn more <ArrowRight size={17} aria-hidden="true" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="band dark">
        <div className="wrap split">
          <div className="split-media reveal">
            <Image
              src="/images/punchbowl-coach.jpg"
              alt="Punchbowl coach parked under gum trees"
              fill
              sizes="(max-width: 850px) 100vw, 50vw"
            />
          </div>
          <div className="reveal">
            <span className="eyebrow light">Bus fleet</span>
            <h2>
              Comfort for the <span className="accent">whole journey.</span>
            </h2>
            <div className="fleet-mini">
              {fleet.map((f) => (
                <div key={f.title}>
                  <h3>
                    {f.title} <small>{f.capacity}</small>
                  </h3>
                  <CheckList items={f.features} />
                </div>
              ))}
            </div>
            <Link className="text-link light" href="/fleet">
              Explore the fleet <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="section wrap">
        <SectionHeading
          eyebrow="How it works"
          title={"Plan your charter\nin three steps."}
          center
        />
        <ol className="steps">
          <li className="reveal">
            <span>01</span>
            <h3>Send your trip details</h3>
            <p>
              Date, pickup point, destination, times, passenger numbers and
              your choice of bus or coach.
            </p>
          </li>
          <li className="reveal">
            <span>02</span>
            <h3>Our charter team reviews it</h3>
            <p>
              We check your requirements and get in touch to discuss your
              quote.
            </p>
          </li>
          <li className="reveal">
            <span>03</span>
            <h3>Confirm and travel</h3>
            <p>
              Once arrangements are confirmed with our team, your group is
              ready to go.
            </p>
          </li>
        </ol>
      </section>

      <section className="band cream">
        <div className="wrap split reverse">
          <div className="split-media reveal">
            <Image
              src="/images/baylink-bus.jpg"
              alt="Baylink Shuttle bus crossing the bridge to Rhodes"
              fill
              sizes="(max-width: 850px) 100vw, 50vw"
            />
          </div>
          <div className="reveal">
            <span className="eyebrow">Baylink Shuttle</span>
            <h2>
              Wentworth Point <span className="accent">to Rhodes.</span>
            </h2>
            <p className="lead">
              The Baylink Shuttle runs weekdays, excluding public holidays. The
              regular loop runs every 30 minutes from 6:30am to 8:00pm, with
              express services every 15 minutes in the morning and afternoon
              peaks.
            </p>
            <Link className="button dark" href="/baylink-shuttle">
              Stops &amp; times <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="section wrap heritage">
        <div className="reveal">
          <span className="eyebrow">About us</span>
          <h2>
            A local name <span className="accent">since 1947.</span>
          </h2>
          <p className="lead">
            Punchbowl Bus Company began when Deluxe Bus Service was incorporated
            under the Punchbowl name in 1947. Today our Hannans Road depot in
            Riverwood is home to our buses and coaches.
          </p>
          <Link className="text-link" href="/about">
            Read our history <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <figure className="heritage-figure reveal">
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

      <QuoteCTA />
    </>
  );
}
