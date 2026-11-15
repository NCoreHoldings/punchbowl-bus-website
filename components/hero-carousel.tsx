"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

export type HeroSlide = {
  slug: string;
  /** "photo" fills the hero; "poster" shows a designed advert in full. */
  style?: "photo" | "poster";
  title: string;
  eyebrow?: string;
  text?: string;
  image: string;
  imageAlt: string;
  buttonLabel?: string;
  buttonLink?: string;
};

const INTERVAL_MS = 7000;

/**
 * Homepage hero carousel. The first slide is the company introduction
 * (passed as children); the rest come from content/promotions. Auto-advances
 * unless the visitor prefers reduced motion, and pauses on hover, focus,
 * when the tab is hidden, or with the pause button.
 */
export function HeroCarousel({
  intro,
  introImage,
  slides,
  footer,
}: {
  intro: ReactNode;
  introImage: { src: string; alt: string };
  slides: HeroSlide[];
  footer?: ReactNode;
}) {
  const count = slides.length + 1;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hold, setHold] = useState(false);
  const touchX = useRef<number | null>(null);
  const multi = count > 1;

  useEffect(() => {
    if (!multi) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPlaying(!reduce.matches);
  }, [multi]);

  useEffect(() => {
    const onVisibility = () => setHold(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const go = useCallback(
    (to: number) => setIndex(((to % count) + count) % count),
    [count],
  );

  useEffect(() => {
    if (!multi || !playing || hold) return;
    const timer = setTimeout(() => go(index + 1), INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [multi, playing, hold, index, go]);

  const autoplaying = multi && playing && !hold;
  return (
    <section
      className="home-hero"
      {...(multi
        ? {
            "aria-roledescription": "carousel",
            "aria-label": "Featured",
          }
        : {})}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setHold(false);
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start == null || end == null || Math.abs(end - start) < 50) return;
        go(index + (end < start ? 1 : -1));
      }}
    >
      <div className="hero-slides" aria-live={autoplaying ? "off" : "polite"}>
        <Slide active={index === 0} position={1} count={count} multi={multi}>
          <Image
            className="hero-photo"
            src={introImage.src}
            alt={introImage.alt}
            fill
            preload
            sizes="100vw"
          />
          <div className="hero-shade" aria-hidden="true" />
          {intro}
        </Slide>
        {slides.map((s, i) => (
          <Slide
            key={s.slug}
            active={index === i + 1}
            position={i + 2}
            count={count}
            multi={multi}
          >
            {s.style === "poster" ? (
              <>
                <Image
                  className="hero-photo poster-backdrop"
                  src={s.image}
                  alt=""
                  fill
                  loading="eager"
                  sizes="50vw"
                  quality={40}
                />
                <div className="hero-shade poster-shade" aria-hidden="true" />
              </>
            ) : (
              <>
                <Image
                  className="hero-photo still"
                  src={s.image}
                  alt={s.imageAlt}
                  fill
                  loading="eager"
                  sizes="100vw"
                />
                <div className="hero-shade" aria-hidden="true" />
              </>
            )}
            <div className={`wrap hero-content ${s.style === "poster" ? "poster-layout" : ""}`}>
              {s.style === "poster" && (
                <PosterFrame slide={s} />
              )}
              <div className="poster-copy">
              {s.eyebrow && (
                <span className="eyebrow light hero-eyebrow">{s.eyebrow}</span>
              )}
              <h2 className="hero-title">{s.title}</h2>
              {s.text && <p>{s.text}</p>}
              {s.buttonLabel && s.buttonLink && (
                <div className="hero-actions">
                  <SlideLink href={s.buttonLink} label={s.buttonLabel} />
                </div>
              )}
              </div>
            </div>
          </Slide>
        ))}
      </div>
      {multi && (
        <div className="wrap hero-controls">
          <button
            type="button"
            className="hero-control"
            aria-label={playing ? "Pause slideshow" : "Play slideshow"}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            className="hero-control"
            aria-label="Previous slide"
            onClick={() => go(index - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="hero-dots">
            {Array.from({ length: count }, (_, i) => (
              <button
                key={i}
                type="button"
                className={i === index ? "active" : ""}
                aria-label={`Show slide ${i + 1} of ${count}${
                  i > 0 ? `: ${slides[i - 1].title}` : ""
                }`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => go(i)}
              />
            ))}
          </div>
          <button
            type="button"
            className="hero-control"
            aria-label="Next slide"
            onClick={() => go(index + 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
      {footer}
    </section>
  );
}

function Slide({
  active,
  position,
  count,
  multi,
  children,
}: {
  active: boolean;
  position: number;
  count: number;
  multi: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`hero-slide ${active ? "active" : ""}`}
      {...(multi
        ? {
            role: "group",
            "aria-roledescription": "slide",
            "aria-label": `${position} of ${count}`,
          }
        : {})}
      aria-hidden={!active}
      inert={!active}
    >
      {children}
    </div>
  );
}

/** The advert itself, shown uncropped; links to the slide's button target. */
function PosterFrame({ slide }: { slide: HeroSlide }) {
  const img = (
    <Image
      src={slide.image}
      alt={slide.imageAlt}
      width={1200}
      height={1300}
      sizes="(max-width: 850px) 80vw, 460px"
      loading="eager"
      className="poster-image"
    />
  );
  if (!slide.buttonLink) return <div className="poster-frame">{img}</div>;
  return slide.buttonLink.startsWith("/") ? (
    <Link className="poster-frame" href={slide.buttonLink} tabIndex={-1}>
      {img}
    </Link>
  ) : (
    <a className="poster-frame" href={slide.buttonLink} tabIndex={-1} target="_blank" rel="noopener noreferrer">
      {img}
    </a>
  );
}

function SlideLink({ href, label }: { href: string; label: string }) {
  const content = (
    <>
      {label} <ArrowUpRight size={18} aria-hidden="true" />
    </>
  );
  if (href.startsWith("/"))
    return (
      <Link className="button" href={href}>
        {content}
      </Link>
    );
  const external = href.startsWith("https://");
  return (
    <a
      className="button"
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {content}
    </a>
  );
}
