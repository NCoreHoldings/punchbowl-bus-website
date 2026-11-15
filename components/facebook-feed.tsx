"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";

/**
 * Latest posts from the company's Facebook Page via Facebook's official Page
 * Plugin. The iframe only loads when the section scrolls near the screen, so
 * visitors who never reach it don't load Facebook at all.
 */
export function FacebookFeed({ pageUrl }: { pageUrl: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () =>
      setWidth(Math.max(280, Math.min(500, Math.floor(el.clientWidth))));
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    const seen = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          seen.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    seen.observe(el);
    return () => {
      resize.disconnect();
      seen.disconnect();
    };
  }, []);

  const height = 640;
  const src = `https://www.facebook.com/plugins/page.php?${new URLSearchParams({
    href: pageUrl,
    tabs: "timeline",
    width: String(width || 500),
    height: String(height),
    small_header: "false",
    adapt_container_width: "true",
    hide_cover: "false",
    show_facepile: "false",
  })}`;

  return (
    <section className="section wrap facebook-section" aria-labelledby="facebook-title">
      <div className="facebook-intro">
        <span className="eyebrow">Latest from Facebook</span>
        <h2 id="facebook-title">News from the depot.</h2>
        <p>
          Updates, photos and announcements from the Punchbowl team. Follow
          our page so you don’t miss what’s new.
        </p>
        <a
          className="button"
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Follow us on Facebook <ArrowUpRight size={18} aria-hidden="true" />
        </a>
      </div>
      <div className="facebook-frame" ref={box} style={{ minHeight: height }}>
        {visible && width > 0 ? (
          <iframe
            title="Punchbowl Bus Company posts on Facebook"
            src={src}
            width={width}
            height={height}
            loading="lazy"
            allow="encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ border: 0, overflow: "hidden" }}
          />
        ) : (
          <p className="facebook-placeholder">Loading Facebook posts…</p>
        )}
      </div>
    </section>
  );
}
