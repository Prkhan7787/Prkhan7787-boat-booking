# Boat Booking System

Mini project for booking scheduled boat trips. The project uses a responsive vanilla HTML/CSS/JS frontend, an Express REST API, and PostgreSQL. The backend can serve the frontend itself, which keeps the Azure App Service deployment simple.

## Features

- Search routes and boats by date, passenger count, and boat type.
- View boat details and submit passenger information.
- Transactional booking creation locks the boat row and prevents overselling.
- JWT protected admin login, dashboard statistics, boat CRUD, booking status management, and passenger directory.
- Customer and boat-owner registration, role-based login redirects, private owner boat inventory/bookings, and customer booking history.
- Owner-scoped CRUD always derives `owner_id` from the verified JWT. The additive database migration keeps legacy boats and bookings intact.
- PostgreSQL schema and demo seed script; health endpoint and Azure configuration included.

## Requirements

- Node.js 18 or later
- PostgreSQL 14 or later

## Setup

```sh
cd backend
npm install
copy .env.example .env   # Windows PowerShell: Copy-Item .env.example .env
```

Create a PostgreSQL database (for example `boat_booking`), set `DATABASE_URL` in `backend/.env`, then initialize:

```sh
npm run db:setup
npm run seed
npm start
```

Before running `npm run seed`, set `ADMIN_PASSWORD` and `OWNER_PASSWORD` (each at least 12 characters) in `backend/.env`. The seed creates demo admin and boat-owner accounts without truncating existing users, boats, bookings, or passengers. Re-running it preserves booking history.

Open http://localhost:5000. For frontend-only work, serve `frontend/` with any static server and set `API_BASE_URL` in `frontend/js/api.js` when the API is on another origin.

## Environment variables

See `backend/.env.example`. Set a long random `JWT_SECRET` and a TLS-enabled PostgreSQL connection string in production. `FRONTEND_URL` accepts a comma-separated list of allowed origins. Never commit `.env`.

Demo admin is created by the seed script using `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Set a password of at least 12 characters in `backend/.env` before running the seed. Seed data is fictional.

Demo boat owner is created with `OWNER_EMAIL` and `OWNER_PASSWORD`. New registrations may select only `customer` or `boat_owner`; `admin` is never accepted from registration.

## API

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/boats`, `GET /api/boats/:id`
- Admin: `POST /api/boats`, `PUT /api/boats/:id`, `DELETE /api/boats/:id`
- Owner: `GET|POST /api/owner/boats`, `GET|PUT|DELETE /api/owner/boats/:id`, `GET /api/owner/bookings`, `GET /api/owner/stats`
- Customer: `GET /api/customer/bookings` (only bookings created while signed in)
- Admin: `GET /api/admin/users`
- `POST /api/bookings` (public booking), admin `GET /api/bookings`, `GET /api/bookings/:id`, `PUT /api/bookings/:id`, `DELETE /api/bookings/:id`
- Admin: `GET /api/passengers`, `GET /api/passengers/:id`, `GET /api/admin/stats`

Responses follow `{ "success": true, "data": ... }` or `{ "success": false, "message": ... }`.

## Azure deployment

Deploy the repository root to Azure App Service with Node 20. Configure startup command `npm --prefix backend start` and the environment variables from `.env.example`, pointing `DATABASE_URL` to Azure Database for PostgreSQL Flexible Server. Set `NODE_ENV=production`, a strong `JWT_SECRET`, and `FRONTEND_URL` to the deployed origin(s). Enable TLS and firewall access for the App Service. The server listens on `process.env.PORT` and exposes `/api/health` for health checks. The same deployment serves frontend and API; the frontend may alternatively be deployed to Static Web Apps by configuring its API base URL and CORS origin.

## Project structure

`frontend/` contains customer, admin, and owner pages, styles, scripts, and assets. `backend/` contains Express, PostgreSQL configuration, auth, routes, middleware, migrations, and seed scripts. `database/` contains the schema and demo records.

## Verification

Run `npm run check` inside `backend` to check JavaScript syntax. The API and database flows need a running PostgreSQL instance. Verify registration as both roles, role redirects, owner boat CRUD, owner booking isolation, customer booking history, admin access, and the existing customer booking flow. Use separate test owner accounts to confirm one owner cannot read/update/delete another owner's boats or bookings. Automated integration tests are not included yet.
