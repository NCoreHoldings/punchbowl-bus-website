"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X, Phone, MapPin, Clock3 } from "lucide-react";
import {
  accreditations,
  company,
  navigation,
  secondaryNavigation,
  services,
} from "@/lib/content";

function isActive(path: string, href: string) {
  return path === href || path.startsWith(`${href}/`);
}

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const path = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className={`header${scrolled || open ? " is-solid" : ""}`}>
      <div className="utility">
        <div className="wrap utility-inner">
          <span>
            <MapPin size={13} aria-hidden="true" /> {company.address}
          </span>
          <span className="utility-hours">
            <Clock3 size={13} aria-hidden="true" /> {company.hours}
          </span>
          <a href={company.phoneHref}>
            <Phone size={13} aria-hidden="true" /> {company.phone}
          </a>
        </div>
      </div>
      <div className="wrap header-inner">
        <Link className="brand" href="/" aria-label="Punchbowl Bus Company home">
          <Image
            src="/images/punchbowl-logo.png"
            alt=""
            width={287}
            height={156}
            preload
          />
          <span className="brand-text">
            Punchbowl
            <small>Bus Company</small>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Main">
          {navigation.map(({ title, href }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(path, href) ? "page" : undefined}
            >
              {title}
            </Link>
          ))}
        </nav>
        <Link className="button header-quote" href="/request-a-quote">
          Request a quote <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
        <button
          type="button"
          className="menu-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      <nav
        className={`mobile-nav${open ? " is-open" : ""}`}
        id="mobile-nav"
        aria-label="Mobile"
        hidden={!open}
      >
        <div className="wrap">
          {[{ title: "Home", href: "/" }, ...navigation, ...secondaryNavigation].map(
            ({ title, href }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(path, href) ? "page" : undefined}
              >
                {title}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            ),
          )}
          <Link className="button" href="/request-a-quote">
            Request a quote <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          <a className="mobile-phone" href={company.phoneHref}>
            <Phone size={16} aria-hidden="true" /> {company.phone}
          </a>
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  const path = usePathname();
  return (
    <footer className="footer">
      <div className="wrap footer-main">
        <div className="footer-brand">
          <Image
            src="/images/punchbowl-logo.png"
            alt="Punchbowl Bus Company"
            width={144}
            height={78}
          />
          <p>
            Bus and coach charters, school and group travel, and the Baylink
            Shuttle, from our Hannans Road depot in Riverwood.
          </p>
          <div className="social">
            {company.social.map((s) => (
              <a key={s.href} href={s.href} rel="noopener noreferrer" target="_blank">
                {s.label}
                <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
        <div>
          <h2>Services</h2>
          {services.map((s) => (
            <Link key={s.href} href={s.href}>
              {s.title}
            </Link>
          ))}
          <Link href="/fleet">Our fleet</Link>
        </div>
        <div>
          <h2>Company</h2>
          <Link href="/about">About us</Link>
          <Link href="/careers">Careers</Link>
          <Link href="/environment">Environment policy</Link>
          <Link href="/contact">Contact us</Link>
        </div>
        <div>
          <h2>Visit us</h2>
          <a className="footer-phone" href={company.phoneHref}>
            {company.phone}
          </a>
          <address>
            {company.address}
            <br />
            {company.hours}
          </address>
          <a href={company.mapHref} rel="noopener noreferrer" target="_blank">
            Get directions
          </a>
        </div>
      </div>
      <div className="wrap footer-badges" aria-label="Accreditations">
        {accreditations.map((a) => (
          <Image key={a.src} src={a.src} alt={a.alt} width={120} height={80} />
        ))}
      </div>
      <p className="wrap acknowledgement">
        Punchbowl Bus Company acknowledges the traditional custodians of this
        land. We pay respect to Elders past, present and emerging.
      </p>
      <div className="wrap footer-bottom">
        <span>
          © {new Date().getFullYear()} {company.name}
        </span>
        <div>
          {["Privacy", "Disclaimer", "Copyright"].map((x) => (
            <a key={x} href={`${company.source}/${x.toLowerCase()}`}>
              {x}
            </a>
          ))}
        </div>
      </div>
      {path !== "/request-a-quote" && (
        <Link className="mobile-book" href="/request-a-quote">
          Request a quote <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      )}
    </footer>
  );
}
