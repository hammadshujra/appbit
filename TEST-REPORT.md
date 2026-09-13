# Appbit V2.9 — Hostinger Next.js verification

Release: **V2.9 Hostinger Next.js Build**
Database schema: **130** (unchanged from V2.8)

## Passed in this build workspace

- `npm run check`: PASS.
- Node regression suite: **75/75 PASS**.
- Next.js project structure regression: PASS.
- Existing APK resolver, metadata, update, R2 SigV4, R2 Accounts, R2 File Manager and download-domain source regressions: PASS.
- Astro runtime/configuration removed from the active deployment surface.
- Hostinger environment template and deployment instructions included.
- ZIP source package contains no `node_modules`, real credentials, local `.env`, or database files.

## Build verification boundary

This sandbox does not have the project npm dependencies installed and cannot reach the npm registry, so a local `next build` could not be executed here. Hostinger's deployment flow installs npm dependencies and runs the `build` script automatically. The package pins Next.js **16.3.3**, React **19.2.0**, targets Node **24**, and uses `next build` as the production build command.

A successful Hostinger deployment should produce `.next`, start `server.js`, load `/health`, redirect unauthenticated workspace pages to `/login`, and report V2.9 after login.
