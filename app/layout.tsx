import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/inter";
import "./globals.css";
import { Header, Footer } from "@/components/site-shell";
import { company } from "@/lib/content";
import { indexable, siteUrl } from "@/lib/site";

const description =
  "Bus and coach charters, school and group travel, and the Baylink Shuttle. Modern buses seating up to 57 and luxury coaches from Punchbowl Bus Company, Riverwood, Sydney.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Punchbowl Bus Company | Bus & Coach Charters, Sydney",
    template: "%s | Punchbowl Bus Company",
  },
  description,
  applicationName: company.name,
  alternates: { canonical: "/" },
  robots: indexable()
    ? { index: true, follow: true }
    : { index: false, follow: false },
  openGraph: {
    siteName: company.name,
    title: "Punchbowl Bus Company | Bus & Coach Charters, Sydney",
    description,
    images: [
      {
        url: "/images/punchbowl-coach.jpg",
        width: 2688,
        height: 934,
        alt: "Punchbowl Bus Company coach in red and cream livery",
      },
    ],
    type: "website",
    locale: "en_AU",
  },
  twitter: { card: "summary_large_image", site: "@PunchbowlBusCo" },
};

export const viewport: Viewport = { themeColor: "#b51f2b" };

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BusOrCoachCompany",
  name: company.name,
  telephone: "+61 2 8522 5000",
  url: siteUrl(),
  logo: `${siteUrl()}/images/punchbowl-logo.png`,
  image: `${siteUrl()}/images/punchbowl-coach.jpg`,
  foundingDate: "1947",
  address: {
    "@type": "PostalAddress",
    streetAddress: "56 Hannans Road",
    addressLocality: "Riverwood",
    addressRegion: "NSW",
    postalCode: "2210",
    addressCountry: "AU",
  },
  openingHours: "Mo-Fr 08:00-17:00",
  sameAs: company.social.map((s) => s.href),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-AU">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
