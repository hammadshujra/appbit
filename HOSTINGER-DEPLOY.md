# Appbit V2.9 — Hostinger Next.js deployment

This package is a real Next.js server application with Appbit's existing Express/MySQL backend mounted in a custom Next.js server.

## Hostinger build settings

Use **Deploy Web App** in hPanel and upload this ZIP (or connect the same files through GitHub).

- Framework: **Next.js**
- Node.js: **24.x**
- Package manager: **npm**
- Root directory: `.`
- Build command / script: **build** (`npm run build`)
- Output directory: **.next**
- Entry file: **server.js**
- Start script: `npm start`

Hostinger currently supports Next.js as a backend framework and Node 18/20/22/24. This package targets Node 24 and Next.js 16.3.3.

## MySQL

Create a MySQL database in hPanel: Websites → Dashboard → Databases → Management. Hostinger documents the database host as normally `localhost` for its managed MySQL service.

Add the production environment values from `hostinger.env.example` during deployment. Do **not** upload real passwords inside the ZIP.

Required variables:

- `NODE_ENV=production`
- `SESSION_SECRET`
- `R2_CREDENTIALS_KEY`
- `ADMIN_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `DB_HOST`
- `DB_PORT=3306`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_SSL=false`
- `TRUST_PROXY=1`

Do not set `PORT`; Hostinger supplies the runtime port and Appbit reads it automatically.

## First deployment

1. Create the MySQL database and user in Hostinger.
2. Add the environment variables in the Node.js deployment form (Hostinger can import a `.env`-style list).
3. Upload this ZIP under **Deploy Web App**.
4. Verify framework detection says **Next.js**.
5. Confirm Node 24, output `.next`, entry `server.js`, build script `build`, package manager `npm`.
6. Deploy.
7. Open `/health` and then `/login` on the temporary/live domain.
8. Log in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` values.
9. Confirm the sidebar reports V2.9.

Appbit creates/updates its own database tables during startup; no manual table SQL is required for a fresh database.

## Runtime notes

- Large R2 uploads are split into small multipart requests by Appbit, so the browser does not send one multi-GB request to Hostinger.
- LiteAPKs direct HTTP parsing is the primary scraper path. During `npm install`, Appbit makes a non-fatal attempt to install Playwright Chromium into the project runtime for the existing 403/browser fallback. If Hostinger's runtime lacks a required Chromium system library, the direct HTTP path still works and browser-launch failure does not crash Appbit.
- Hostinger places backend Node.js application build files outside `public_html` and manages routing automatically.
