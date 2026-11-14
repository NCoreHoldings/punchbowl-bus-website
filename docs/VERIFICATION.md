# Verification — 14 November 2026

## Build & tests

- `npm run typecheck`: passed
- `npm test`: 37 passed (API contract, abuse controls, idempotent retries, form component)
- `npm run build`: passed. 11 pages and the 404 page are static; `/api/enquiries` is dynamic.

## Pages & layout

- All 11 routes return 200. An unknown route returns the custom 404.
- Checked at 1440px (desktop) and 390px (mobile): no horizontal overflow. The mobile menu opens and closes, including with the Escape key.

## NCore Fleets integration (local, end to end)

Environment: this site on `localhost:3001`, NCore backend on `localhost:8000` (`COMPANY_ISOLATION_MODE=isolated`, `INSTALLATION_COMPANY_KEY=punchbowl-bus`, dedicated Punchbowl dev database), and NCore's Redis from `compose.redis.yaml`.

1. An administrator created a website integration in the NCore dashboard. Its credential is stored only in the git-ignored `.env.local`.
2. `GET /api/enquiries` returned `{"available":true}`.
3. A clearly labelled test enquiry was submitted through the real form (journey → contact → review → send). The send button was double-clicked: **one** POST was sent, and it returned **201**.
4. The receipt shown was `65eaa2b1-2a8d-4d36-8480-674310abbdd8`.
5. A read-only database check confirmed the stored `WebsiteEnquiry`:
   - status `PENDING_REVIEW`, the status shown in NCore's Website enquiries staff inbox
   - integration `companyKey` = `punchbowl-bus`, matching the installation, which confirms the tenant
   - payload fields mapped correctly: group, contact, 40 passengers, 2026-12-10 09:00 Australia/Sydney, and vehicle/seatbelt preferences in `specialInstructions`
   - exactly one record for the integration and source submission ID, so no duplicate

## Security checks

- Cross-origin POST → 403. POST with no Origin → 403. Non-JSON POST → 415.
- The integration credential is absent from client JS, the rendered HTML and the git repository.

## Not yet verified

- Production: the Vercel deployment, the production NCore backend (the website-enquiry feature isn't deployed there yet) and production Redis.
- The test enquiry should be **rejected** by staff in NCore → Website enquiries.
