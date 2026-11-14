import { Clock3, Zap, Repeat } from "lucide-react";
import { expressStops, pages, regularStops } from "@/lib/content";
import { PageHero, SourceNote, pageMetadata } from "@/components/common";

const info = pages["baylink-shuttle"];
export const metadata = pageMetadata(info);

export default function BaylinkPage() {
  return (
    <>
      <PageHero info={info} />
      <section className="section wrap">
        <div className="notice reveal">
          <Clock3 aria-hidden="true" />
          <p>
            <strong>Weekdays only, not including public holidays.</strong> Times
            are as published by the company. Allow for traffic, and check the
            original service page before you travel.
          </p>
        </div>
        <div className="schedule-grid">
          <article className="schedule reveal">
            <header>
              <Repeat aria-hidden="true" />
              <div>
                <span className="eyebrow">All-day service</span>
                <h2>Regular service</h2>
              </div>
            </header>
            <dl className="schedule-times">
              <div>
                <dt>6:30am – 8:00pm</dt>
                <dd>Every 30 minutes</dd>
              </div>
            </dl>
            <ol className="stop-list">
              {regularStops.map((s, i) => (
                <li key={s}>
                  {s}
                  {i === 0 && <small>Start of service, 6:30am</small>}
                  {i === regularStops.length - 1 && <small>End of service, 8:00pm</small>}
                </li>
              ))}
            </ol>
          </article>
          <article className="schedule express reveal">
            <header>
              <Zap aria-hidden="true" />
              <div>
                <span className="eyebrow light">Peak times</span>
                <h2>Express service</h2>
              </div>
            </header>
            <dl className="schedule-times">
              <div>
                <dt>6:30am – 10:00am</dt>
                <dd>Morning, every 15 minutes</dd>
              </div>
              <div>
                <dt>2:30pm – 7:30pm</dt>
                <dd>Afternoon, every 15 minutes</dd>
              </div>
            </dl>
            <ol className="stop-list">
              {expressStops.map((s, i) => (
                <li key={s}>
                  {s}
                  {i === expressStops.length - 1 && <small>End of service</small>}
                </li>
              ))}
            </ol>
          </article>
        </div>
        <SourceNote path="baylink-shuttle" />
      </section>
    </>
  );
}
