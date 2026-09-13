# Appbit V2.11 — Hostinger runtime repair verification

Release: **V2.11 Hostinger Native Next.js Runtime Repair**

## Hostinger runtime issue fixed

The supplied runtime log showed Next.js starting successfully, followed by HTTP 500 because the compiled page attempted to open `.next/server/VERSION`. V2.11 removes that runtime filesystem dependency.

V2.11 also corrects the deployment architecture for Hostinger's **Next.js preset**: Appbit now exposes its existing Express-backed application services through a native Next.js catch-all API route, so the managed `next start` runtime serves authentication, App Library APIs, Publishing, Update Center, and R2 without relying on custom `server.js` startup.

## Verification performed

- `npm run check`: **PASS**.
- Node regression suite: **81/81 PASS**.
- Browser parser fixtures: standard parser **PASS**.
- V2.1 parser fixtures: **PASS**.
- V2.4 content/size browser fixtures: **PASS**.
- V2.6 core-content/hero-size browser fixtures: **PASS**.
- V2.11 regression coverage verifies:
  - release identity has no runtime `fs.readFileSync` dependency;
  - native `pages/api/[[...path]].js` exists with Next body parsing disabled for Appbit/large-file flows;
  - existing Appbit API/auth/R2 download routers are mounted in the managed Next runtime;
  - `/login` uses native Next UI plus `/api/auth/login`;
  - expired sessions redirect to `/login`;
  - `/d/<token>` is rewritten to the R2 streaming API;
  - database-not-ready API requests return JSON instead of requiring EJS files from `.next/server`.

## Build limitation in this sandbox

The npm registry was not reachable from this execution environment, so a fresh `next build --webpack` could not be run here. Hostinger already completed the V2.10 Webpack build; the V2.11 source is syntax/regression checked and Hostinger remains the final production build/runtime verification environment.
