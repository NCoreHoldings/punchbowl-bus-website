// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { HeroCarousel, type HeroSlide } from "../components/hero-carousel";
import { SimpleMarkdown } from "../components/simple-markdown";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

const slides: HeroSlide[] = [
  { slug: "a", title: "Wentworth Point to Rhodes", image: "/images/a.jpg", imageAlt: "Bus A", buttonLabel: "View", buttonLink: "/baylink-shuttle" },
  { slug: "b", title: "On the road since 1947", image: "/images/b.jpg", imageAlt: "Bus B" },
];
function setMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce, addEventListener() {}, removeEventListener() {} });
}
const renderHero = (s = slides) =>
  render(
    <HeroCarousel intro={<h1>Travel together</h1>} introImage={{ src: "/i.jpg", alt: "Coach" }} slides={s} />,
  );
const activeLabel = () => document.querySelector(".hero-slide.active")?.getAttribute("aria-label");

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe("Hero carousel", () => {
  it("shows the intro first, advances automatically and loops", () => {
    vi.useFakeTimers();
    setMotion(false);
    renderHero();
    expect(screen.getByRole("region", { name: "Featured" })).toBeTruthy();
    expect(activeLabel()).toBe("1 of 3");
    act(() => vi.advanceTimersByTime(7000));
    expect(activeLabel()).toBe("2 of 3");
    act(() => vi.advanceTimersByTime(7000));
    expect(activeLabel()).toBe("3 of 3");
    act(() => vi.advanceTimersByTime(7000));
    expect(activeLabel()).toBe("1 of 3");
  });
  it("has working previous, next, dot and pause controls and hides inactive slides", () => {
    vi.useFakeTimers();
    setMotion(false);
    renderHero();
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(activeLabel()).toBe("2 of 3");
    fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    expect(activeLabel()).toBe("3 of 3");
    fireEvent.click(screen.getByRole("button", { name: "Show slide 2 of 3: Wentworth Point to Rhodes" }));
    expect(activeLabel()).toBe("2 of 3");
    expect(screen.getByRole("link", { name: /View/ }).getAttribute("href")).toBe("/baylink-shuttle");
    const hidden = document.querySelector(".hero-slide:not(.active)")!;
    expect(hidden.getAttribute("aria-hidden")).toBe("true");
    expect(hidden.hasAttribute("inert")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Pause slideshow" }));
    fireEvent.blur(screen.getByRole("button", { name: "Play slideshow" }));
    act(() => vi.advanceTimersByTime(30000));
    expect(activeLabel()).toBe("2 of 3");
  });
  it("doesn't auto-advance for visitors who prefer reduced motion", () => {
    vi.useFakeTimers();
    setMotion(true);
    renderHero();
    act(() => vi.advanceTimersByTime(30000));
    expect(activeLabel()).toBe("1 of 3");
    expect(screen.getByRole("button", { name: "Play slideshow" })).toBeTruthy();
  });
  it("is a plain hero with no controls when there are no banners", () => {
    setMotion(false);
    renderHero([]);
    expect(screen.queryByRole("button", { name: "Next slide" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Travel together" })).toBeTruthy();
  });
});

describe("Job description Markdown", () => {
  it("renders headings, lists, bold and safe links, and never raw HTML", () => {
    const html = renderToStaticMarkup(
      <SimpleMarkdown
        source={"## About\nDrive **school** routes.\n\n- HR licence\n- [Apply](/careers)\n\n<script>alert(1)</script> [bad](javascript:alert(1))"}
      />,
    );
    expect(html).toContain("<h3>About</h3>");
    expect(html).toContain("<strong>school</strong>");
    expect(html).toContain("<li>HR licence</li>");
    expect(html).toContain('<a href="/careers">Apply</a>');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('href="javascript');
  });
});
