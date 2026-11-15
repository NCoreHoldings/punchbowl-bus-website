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
- **Field mapping:** journey type → `forward`/`return` legs; pickup/destination → place addresses; date/times → `date`/`time`/`arrivalDate`/`arrivalTime` (Australia/Sydney); passengers/buses → `passengerCount`/`busCount`; contact → `contact`; vehicle preference, seatbelt requirement and notes → `specialInstructions`.
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

## Route planner & Google Maps

The journey step uses an ordered itinerary like NCore Fleets' booking form: **pickup point → up to 20 passenger stops → drop-off**, with reordering, swapping endpoints, coach access notes per point, and a return leg that is either the outward route reversed or a custom route.

With `GOOGLE_MAPS_BROWSER_KEY` set, each point gets Google Places search, and a map shows numbered pins and the route line. Customers can click the map to set a point or drag a pin to adjust it. Without the key, the same itinerary works with plain address fields.

NCore receives each point's venue name, full address and access notes (`pickup`, `stops[]`, `destination`). Coordinates aren't part of NCore's website-enquiry contract, so they aren't sent; NCore geocodes the addresses itself.

Google Cloud setup (https://console.cloud.google.com):

1. Create or choose a project and enable billing.
2. Enable the **Maps JavaScript API**, **Places API (New)** and **Geocoding API**.
3. Create an API key under **APIs & Services → Credentials**. Restrict it by **websites (HTTP referrers)** to `http://localhost:3001/*`, `https://punchbowl-bus-website.vercel.app/*` and the final domain, and restrict it to those three APIs. The key is visible in the browser by design; these restrictions are what protect it.
4. Optional: create a Map ID under **Map Management** and set `GOOGLE_MAPS_MAP_ID`.
5. Set `GOOGLE_MAPS_BROWSER_KEY` in `.env.local` and in Vercel, then redeploy. `GET /api/enquiries` then includes a `maps` object.

## Assets

All photos and badges are the company's own, from punchbowlbus.com.au: logo, coach (`IMAG0338.jpg`), Baylink bus (`BBG_0189_copy.jpg`), apprentice, heritage strip, ISO 9001/14001/45001 and Australian Owned & Operated badges. Fonts are Inter and Manrope (Fontsource, OFL), self-hosted. The only third-party requests are Google Maps on the quote page, when a key is configured.

## Security notes

- `.env*` files are git-ignored. Only `.env.example` is committed.
- No request bodies, credentials or customer details are logged.
- `INDEXABLE=false` adds `noindex` metadata and an `X-Robots-Tag` header, and `robots.txt` disallows all crawling.
