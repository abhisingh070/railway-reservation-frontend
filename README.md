# Railway Desk

A responsive React and Vite frontend for the Railway Reservation System. The frontend calls the API documented in [`docs/api-spec.md`](docs/api-spec.md); it does not contain mock train or passenger data.

## Run locally

1. Start the separate Spring Boot backend on `http://localhost:8080`.
2. In this project, run `npm install` if needed, then `npm run dev`.
3. Open the local URL printed by Vite (usually `http://localhost:5173`).

In development, Vite proxies `/api` requests to `http://localhost:8080` to avoid browser CORS restrictions. Production builds use the documented backend URL directly.

## Frontend features

- Search routes and browse train services; view train details and create train records.
- Check journey date seat availability and confirmed passengers.
- Add passengers and create reservations.
- Look up reservation status, cancel tickets, and see waitlist promotions returned by cancellation.
- View a passenger's reservation history, including confirmed, waitlisted, and cancelled bookings.

Waiting-list entries are shown through reservation creation results and passenger history because the API does not expose a standalone waiting-list endpoint.

## Commands

- `npm run dev` — start Vite.
- `npm run build` — create the production build in `dist/`.
- `npm run preview` — preview the production build.
