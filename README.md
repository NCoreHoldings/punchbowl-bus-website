# Punchbowl Bus Company website

Public marketing website for Punchbowl Bus Company. Built with Next.js 16 (App Router), React 19 and plain CSS. Every page is statically generated. The only server code is the quote-enquiry API route, which forwards enquiries to NCore Fleets.

## Pages

| Route | Content |
|---|---|
| `/` | Home: hero, services, fleet, how it works, Baylink, history |
| `/services` | Services overview |
| `/charters` | Bus & coach charters / bus hire, FAQ |
| `/school-group-travel` | Group and school charters |
| `/fleet` | Buses, coaches, fleet heritage |
| `/baylink-shuttle` | Baylink stops and timetable |
| `/about` | History, milestones, ISO accreditations |
| `/careers` | Driving and apprenticeship pathways |
| `/contact` | Phone, address, hours |
| `/request-a-quote` | Booking enquiry form (sent to NCore Fleets) |
| `/environment` | Environment policy summary |

Company facts live in `lib/content.ts`. All of them come from https://punchbowlbus.com.au (checked 14 Nov 2026). The design tokens are in `app/globals.css`.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3001
```

Scripts: `npm run typecheck`, `npm test` (Vitest), `npm run build`, `npm start`.
Node 20.9+ is required. The scripts use the Webpack bundler because Turbopack's CSS worker failed on the original Windows host.

## NCore Fleets integration

```
Browser ──POST /api/enquiries──▶ this site (server) ──POST /api/v1/website/enquiries──▶ NCore Fleets
                                  origin check, schema,          Bearer <integration credential>
                                  honeypot, rate limit
```

- The customer never logs in. The browser only talks to this site's `/api/enquiries`. The NCore credential stays on the server and never reaches client JavaScript.
- **Tenant identification:** each NCore website-integration credential belongs to exactly one company installation. NCore links the enquiry to that company from the credential. The payload contains no tenant ID, and NCore rejects any unknown keys.
- **Duplicate prevention:** every submission carries a stable `sourceSubmissionId`. Retries resend identical bytes, so NCore returns the original receipt (200) instead of creating a duplicate. Double-clicks are blocked in the UI.
- **Trip types (contract version 2):** the form offers the same four types as NCore's New Booking form: One way, Round trip, Recurring and Shuttle. It sends `tripType` (`one_way`, `round_trip`, `repeatable`, `shuttle`). Recurring trips add `recurrence` (`daily`, `weekly` with weekdays, or `monthly`, plus the last trip date, up to one year). Shuttles send the first pickup as `forward.time` and "everyone delivered by" as `forward.arrivalTime`. NCore prefills New Booking with that type, schedule and a default seat capacity. With two or more buses (not shuttles), customers can choose a different route for each bus: buses 2..N are sent as `otherBuses` (own route and departure time, plus a return time on round trips) and open in New Booking as "Different route for each vehicle". Weekly recurring trips must start on one of their chosen weekdays, because NCore only schedules those days. NCore still accepts version 1 enquiries, so **deploy the NCore backend before this website**.
- **Field mapping:** trip type → `forward`/`return` legs; pickup/destination → place addresses; date/times → `date`/`time`/`arrivalDate`/`arrivalTime` (Australia/Sydney); passengers/buses → `passengerCount`/`busCount`; contact → `contact`; vehicle type and trip notes → `specialInstructions`. The form has no seat belt question; customers mention seat belt needs in their notes.
- **Abuse controls:** exact `Origin` match with `SITE_URL`, JSON-only, a 64 KiB streaming body limit, a strict schema, a honeypot field and Redis rate limiting (10/min per client IP, or 30/min global without a trusted IP header). The upstream call has a 15 s timeout and refuses redirects. Production requires an HTTPS upstream.
- Received enquiries appear in **NCore → Charter Management → Website enquiries** for staff review and conversion to a draft booking. Nothing is auto-confirmed.
- If the integration isn't configured, the form shows an "unavailable, please call" notice. It never shows a fake receipt.

### Creating the credential

1. In NCore, sign in as an administrator and open **Dashboard → Charter Management → Website enquiries → Website integrations**.
2. Create an integration named e.g. "Punchbowl public website", with the website's HTTPS URL.
3. Copy the credential (it's shown once) into `NCORE_INTEGRATION_CREDENTIAL`. Use `.env.local` locally or a Vercel env var. Never commit it.

NCore's prerequisites (its side, not this repo): migrations applied, Redis, `BUSINESS_TIMEZONE=Australia/Sydney`, `COMPANY_ISOLATION_MODE=isolated` and a stable `INSTALLATION_COMPANY_KEY` on a database dedicated to this company.

## Deploying to Vercel

1. Import the GitHub repository in Vercel. The framework (Next.js) is auto-detected, so no build settings need changing.
2. Add a Redis store (e.g. Upstash via the Vercel Marketplace) and copy its `rediss://` URL.
3. Set the environment variables (Production):

   | Variable | Value |
   |---|---|
   | `SITE_URL` | e.g. `https://punchbowl-bus-website.vercel.app` (later the real domain) |
   | `INDEXABLE` | `false` until launch, then `true` |
   | `NCORE_API_URL` | Public HTTPS origin of the production NCore backend |
   | `NCORE_INTEGRATION_CREDENTIAL` | Credential from the NCore production integration |
   | `REDIS_URL` | Redis connection URL |
   | `TRUSTED_CLIENT_IP_HEADER` | `x-real-ip` (Vercel overwrites this header) |
   | `GOOGLE_MAPS_BROWSER_KEY` | Optional. Google Maps browser key for address search and the route map (see below) |
   | `GOOGLE_MAPS_MAP_ID` | Optional. Map ID from Google Cloud Map Management (`DEMO_MAP_ID` if empty) |

4. Redeploy after changing variables. Open `/api/enquiries` with a GET request: it should return `{"available":true}`.
5. Submit a clearly marked test enquiry and confirm it appears in NCore's Website enquiries inbox.

When the domain moves, update `SITE_URL` and the integration's website in NCore.

## Jobs, homepage banners & Facebook

- **Careers:** `/careers` lists open vacancies from `content/careers/*.md`, or shows a "no vacancies" message. Each job has its own page, `/careers/<file-name>`, with an **Apply now** form: contact details, role-specific questions, a CV upload (PDF or Word, 4 MB maximum) and consent. The form is emailed with the CV attached to `admin@punchbowlbus.com.au`. Job pages include Google job-posting data.
- **Homepage banners:** the hero is an accessible slideshow. The company introduction comes first, then the banners in `content/promotions/*.md`, each with optional start and end dates.
- **Facebook:** the homepage shows the page's latest posts through Facebook's official Page Plugin. It loads only when visitors scroll near it.
- **Editing:** staff edit these files on GitHub; see [content/README.md](content/README.md). Pages refresh hourly, so closing and end dates apply without a redeploy.

To turn on emailed applications, create a free account at https://resend.com, verify `punchbowlbus.com.au` by adding the DNS records Resend gives you, and create an API key. Then set these in Vercel and redeploy:

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | The Resend API key |
| `APPLICATIONS_FROM_EMAIL` | e.g. `Punchbowl Careers <careers@punchbowlbus.com.au>` (verified domain) |
| `APPLICATIONS_TO_EMAIL` | Optional; defaults to `admin@punchbowlbus.com.au` |

Until then, the Apply section asks applicants to email their CV instead. Applications also use the same Redis rate limiting as enquiries.

## Quote form layout

The form follows the steps of NCore Fleets' New Booking:

1. **Basic details:** your details, trip type, then vehicles & passengers (vehicle type, buses required, total passengers), and trip notes.
2. **Route & schedule:** with two or more buses, choose "Same route for all buses" or "Different route for each bus". Then set the route (bus 1's route when the routes differ), the schedule and, on round trips, the return journey. With different routes, each of buses 2..N gets a card with its own route and pickup time, "Copy route from…" and Remove. "Copy bus 1 to all buses" fills every card at once, and **Add another bus** adds one more (up to 20 online).
3. **Review & send:** the summary, a PDF copy and the consent checkbox.

## Route planner & Google Maps

The journey step uses an ordered itinerary like NCore Fleets' booking form: **pickup point → up to 20 passenger stops → drop-off**, with reordering, swapping endpoints, coach access notes per point, and a return leg that is either the outward route reversed or a custom route.

With `GOOGLE_MAPS_BROWSER_KEY` set, each point gets Google Places search, and a **map icon** on each route opens a popup. In the popup, customers search for the pickup point and drop-off separately, see each selected place's name and address, and see a sample driving route with its distance and an approximate drive time. They can also click the map to set an empty point or drag a pin to adjust it. The popup states that the route is **a sample for reference only, not the exact bus route**. Without the key, the map icon is hidden and the itinerary uses plain address fields.

The sample route uses the Routes API through the Maps JavaScript API. If the Routes API isn't enabled for the key, the popup shows a dashed straight line instead.

NCore receives each point's venue name, full address and access notes (`pickup`, `stops[]`, `destination`). Coordinates aren't part of NCore's website-enquiry contract, so they aren't sent; NCore geocodes the addresses itself.

Google Cloud setup (https://console.cloud.google.com):

1. Create or choose a project and enable billing.
2. Enable the **Maps JavaScript API**, **Places API (New)**, **Geocoding API** and **Routes API**.
3. Create an API key under **APIs & Services → Credentials**. Restrict it by **websites (HTTP referrers)** to `http://localhost:3001/*`, `https://punchbowl-bus-website.vercel.app/*` and the final domain, and restrict it to those four APIs. The key is visible in the browser by design; these restrictions are what protect it.
4. Optional: create a Map ID under **Map Management** and set `GOOGLE_MAPS_MAP_ID`.
5. Set `GOOGLE_MAPS_BROWSER_KEY` in `.env.local` and in Vercel, then redeploy. `GET /api/enquiries` then includes a `maps` object.

## Assets

All photos and badges are the company's own, from punchbowlbus.com.au: logo, coach (`IMAG0338.jpg`), Baylink bus (`BBG_0189_copy.jpg`), apprentice, heritage strip, ISO 9001/14001/45001 and Australian Owned & Operated badges. Fonts are Inter and Manrope (Fontsource, OFL), self-hosted. The only third-party requests are Google Maps on the quote page, when a key is configured.

## Security notes

- `.env*` files are git-ignored. Only `.env.example` is committed.
- No request bodies, credentials or customer details are logged.
- `INDEXABLE=false` adds `noindex` metadata and an `X-Robots-Tag` header, and `robots.txt` disallows all crawling.
