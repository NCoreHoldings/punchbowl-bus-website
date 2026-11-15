// All company facts below come from https://punchbowlbus.com.au (checked 13–14 November 2026).
// Do not add services, prices, contact details or claims that are not published by the company.

export const company = {
  name: "Punchbowl Bus Company",
  phone: "(02) 8522 5000",
  phoneHref: "tel:+61285225000",
  address: "56 Hannans Road, Riverwood NSW 2210",
  hours: "Monday–Friday, 8am–5pm",
  mapHref:
    "https://www.google.com/maps/search/?api=1&query=56+Hannans+Road+Riverwood+NSW+2210",
  source: "https://punchbowlbus.com.au",
  verified: "14 November 2026",
  facebook: "https://www.facebook.com/profile.php?id=61593083106909",
  social: [
    { label: "Facebook", href: "https://www.facebook.com/profile.php?id=61593083106909" },
    { label: "X (Twitter)", href: "https://twitter.com/PunchbowlBusCo" },
  ],
};

export type NavItem = { title: string; href: string };

export const navigation: NavItem[] = [
  { title: "Services", href: "/services" },
  { title: "Charters", href: "/charters" },
  { title: "Fleet", href: "/fleet" },
  { title: "Baylink Shuttle", href: "/baylink-shuttle" },
  { title: "About", href: "/about" },
  { title: "Contact", href: "/contact" },
];

export const secondaryNavigation: NavItem[] = [
  { title: "School & group travel", href: "/school-group-travel" },
  { title: "Careers", href: "/careers" },
  { title: "Environment", href: "/environment" },
];

export const services = [
  {
    key: "charters",
    title: "Bus & coach charters",
    tagline: "Day trips and extended tours",
    text: "Buses seating up to 57 passengers for local charters, and luxury coaches for day trips to Canberra, the Blue Mountains or Wollongong.",
    href: "/charters",
    image: "/images/punchbowl-coach.jpg",
    imageAlt: "Punchbowl Bus Company coach in red and cream livery",
  },
  {
    key: "schools",
    title: "School & group charters",
    tagline: "From one class to the whole school",
    text: "School transfers, single and multiple bus hire, local excursions and one-way or return charters around Sydney.",
    href: "/school-group-travel",
    image: "/images/heritage.jpg",
    imageAlt: "Punchbowl buses through the decades",
  },
  {
    key: "baylink",
    title: "Baylink Shuttle",
    tagline: "Wentworth Point ↔ Rhodes",
    text: "A weekday shuttle connecting Wentworth Point and Rhodes, with an all-day regular loop and peak express services.",
    href: "/baylink-shuttle",
    image: "/images/baylink-bus.jpg",
    imageAlt: "Baylink Shuttle bus crossing the bridge to Rhodes",
  },
] as const;

export const fleet = [
  {
    title: "Modern buses",
    capacity: "Up to 57 seats",
    text: "Our modern buses are available for local school charters in and around the Sydney area.",
    features: [
      "Seat up to 57 passengers",
      "Local school and group charters",
      "Single or multiple bus hire",
    ],
  },
  {
    title: "Luxury coaches",
    capacity: "Day trips & tours",
    text: "Coaches for day trips to Canberra, the Blue Mountains or Wollongong, and for extended tours.",
    features: [
      "Leather seats fitted with seat belts",
      "Air conditioning",
      "TV and DVD",
    ],
  },
] as const;

export const fleetHistory = [
  {
    year: "1967",
    text: "Luxury coaches arrive: a Leyland Leopard with Coachmaster bodywork and jet air ventilation.",
  },
  { year: "1972", text: "Mercedes-Benz O302 coaches join the fleet." },
  {
    year: "1980",
    text: "Australian-built Denning coaches are ordered.",
  },
  {
    year: "1984",
    text: "Punchbowl orders the world’s first Leyland Tiger three-axle coach.",
  },
  {
    year: "1986",
    text: "Mercedes O303 three-axle coaches replace the Dennings, then are fully refurbished in 1995.",
  },
  {
    year: "1990s",
    text: "Low-floor Scania buses with Custom Coach CB60 bodies bring step-free, wheelchair-accessible travel.",
  },
];

export const aboutTimeline = [
  {
    year: "1947",
    title: "The name takes the road",
    text: "Deluxe Bus Service is incorporated as Punchbowl Bus Company.",
  },
  {
    year: "1958",
    title: "A shared future",
    text: "Narwee Bus Company / GP Bus Company purchases Punchbowl Bus Company and adopts its name and livery.",
  },
  {
    year: "1967",
    title: "Coaches join the story",
    text: "Punchbowl introduces luxury coaches to the area.",
  },
  {
    year: "1997",
    title: "A new network",
    text: "New route numbers, from 940 to 945, introduce networking under the company’s commercial contracts.",
  },
  {
    year: "1998–2005",
    title: "Growing across the region",
    text: "Routes in the Hurstville, Kogarah and Greenacre areas are taken over from other operators.",
  },
  {
    year: "2010",
    title: "A network review",
    text: "More frequent, direct services, including new routes 939, 946, 955 and the S14 Shopper Hopper.",
  },
];

export const regularStops = [
  "Alora, Baywater Drive",
  "Pulse, Stromboli Strait",
  "Nuvolari Place, Hill Road (northbound)",
  "Verona Drive, Hill Road (northbound)",
  "Ferry Wharf, Wentworth Point School",
  "Marina Square, Footbridge Boulevard",
  "Rhodes Station, Walker Street",
  "Gauthorpe Street",
  "Wentworth Point Community Centre & Library, Footbridge Boulevard",
  "Hill Road southbound (set down only if requested)",
];

export const expressStops = [
  "Ferry Wharf, Wentworth Point School",
  "Marina Square, Footbridge Boulevard",
  "Rhodes Station, Walker Street",
  "Wentworth Point Community Centre & Library, Footbridge Boulevard",
];

export const accreditations = [
  { src: "/images/iso-9001.png", alt: "ISO 9001 certified" },
  { src: "/images/iso-14001.png", alt: "ISO 14001 certified" },
  { src: "/images/iso-45001.png", alt: "ISO 45001 certified" },
  {
    src: "/images/australian-owned-operated.png",
    alt: "Australian owned and operated",
  },
];

export type PageInfo = {
  path: string;
  title: string;
  eyebrow: string;
  heading: string;
  description: string;
  image: string;
  imageAlt: string;
};

const page = (p: PageInfo) => p;

export const pages = {
  services: page({
    path: "/services",
    title: "Our services",
    eyebrow: "Our services",
    heading: "Every journey,\nhandled with care.",
    description:
      "Bus and coach charters, school and group travel, and the Baylink Shuttle between Wentworth Point and Rhodes.",
    image: "/images/punchbowl-coach.jpg",
    imageAlt: "Punchbowl coach parked under gum trees",
  }),
  charters: page({
    path: "/charters",
    title: "Bus & coach charters",
    eyebrow: "Charter & bus hire",
    heading: "Your group.\nYour journey.",
    description:
      "Modern buses seating up to 57 passengers and luxury coaches for day trips and extended tours. Tell us where you’re heading.",
    image: "/images/punchbowl-coach.jpg",
    imageAlt: "Punchbowl Bus Company coach in red and cream livery",
  }),
  "school-group-travel": page({
    path: "/school-group-travel",
    title: "School & group charters",
    eyebrow: "Group & school charters",
    heading: "Room for\nthe whole group.",
    description:
      "School transfers, local excursions and one-way or return charters around Sydney, from a single class to an entire school.",
    image: "/images/punchbowl-coach.jpg",
    imageAlt: "Punchbowl coach ready for a group charter",
  }),
  fleet: page({
    path: "/fleet",
    title: "Our fleet",
    eyebrow: "Bus fleet",
    heading: "Buses and coaches\nfor every trip.",
    description:
      "Modern buses seating up to 57 passengers, and luxury coaches with leather seats, seat belts and air conditioning.",
    image: "/images/punchbowl-coach.jpg",
    imageAlt: "Punchbowl Bus Company coach",
  }),
  about: page({
    path: "/about",
    title: "About us",
    eyebrow: "About us",
    heading: "On the road\nsince 1947.",
    description:
      "From our beginnings in Punchbowl to our depot on Hannans Road, Riverwood, our history is tied to the communities of Sydney’s south.",
    image: "/images/heritage.jpg",
    imageAlt: "Historic Punchbowl buses in their changing liveries",
  }),
  "baylink-shuttle": page({
    path: "/baylink-shuttle",
    title: "Baylink Shuttle",
    eyebrow: "Baylink Shuttle",
    heading: "Wentworth Point\nto Rhodes.",
    description:
      "The Baylink Shuttle operates weekdays between Wentworth Point and Rhodes, excluding public holidays.",
    image: "/images/baylink-bus.jpg",
    imageAlt: "Baylink Shuttle bus on the bridge between Wentworth Point and Rhodes",
  }),
  careers: page({
    path: "/careers",
    title: "Careers",
    eyebrow: "Employment",
    heading: "Build a career\nthat moves people.",
    description:
      "Driving and heavy-vehicle mechanical apprenticeship pathways with Punchbowl Bus Company.",
    image: "/images/apprentice.jpg",
    imageAlt: "Punchbowl apprentice mechanic working on a bus engine",
  }),
  contact: page({
    path: "/contact",
    title: "Contact us",
    eyebrow: "Contact us",
    heading: "Let’s talk\nabout your trip.",
    description:
      "Call our Riverwood team, visit us at the depot, or send a charter enquiry online.",
    image: "/images/punchbowl-coach.jpg",
    imageAlt: "Punchbowl Bus Company coach",
  }),
  "request-a-quote": page({
    path: "/request-a-quote",
    title: "Request a quote",
    eyebrow: "Booking enquiry",
    heading: "Request a\ncharter quote.",
    description:
      "Share your trip details. Our charter team will review your request and contact you. This is an enquiry, not a confirmed booking.",
    image: "/images/punchbowl-coach.jpg",
    imageAlt: "Punchbowl Bus Company coach",
  }),
  environment: page({
    path: "/environment",
    title: "Environment policy",
    eyebrow: "Environment",
    heading: "Care for the places\nwe travel.",
    description:
      "Responsible environmental management is part of how Punchbowl Bus Company operates.",
    image: "/images/baylink-bus.jpg",
    imageAlt: "Baylink Shuttle bus beside the water",
  }),
} satisfies Record<string, PageInfo>;
