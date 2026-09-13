# Appbit V2.13

Current release: **V2.13**. This Hostinger repair keeps the managed Next.js deployment and fixes the API-route module classification that prevented the newer build from replacing the last successful deployment.

V2.13 uses one standard Next.js Pages API catch-all at `pages/api/[[...path]].js`. The route uses Next.js module syntax only, while `package.json` no longer forces all `.js` files into CommonJS mode. A prebuild guard now rejects stale/duplicate catch-all routes before Webpack starts.

## Hostinger runtime

- Framework preset: Next.js
- Node.js: 24.x
- Build command: `npm run build`
- Production bundler: Webpack (`next build --webpack`)
- Output directory: `.next`
- Runtime: Hostinger-managed `next start`
- API bridge: `pages/api/[[...path]].js`
- Prebuild validation: `scripts/hostinger-prebuild.js`
- Postbuild finalizer: `scripts/hostinger-postbuild.js`

# Appbit V2.11

**APK Publishing Workspace — Hostinger Native Next.js Runtime**

V2.11 fixes the Hostinger production 500 reported after the successful V2.10 Webpack build. Hostinger's managed Next.js runtime executes compiled server modules from `.next/server`; V2.10 still attempted to read a loose `VERSION` file from that directory and failed with `ENOENT`. V2.11 bundles release identity into the server code and runs Appbit's backend through native Next.js API routes.

## Hostinger architecture

- Next.js **16.3.3** / React **19.2**.
- Production build: `next build --webpack`.
- Production runtime: `next start`.
- Hostinger Framework preset: **Next.js**.
- Output directory: **.next**.
- Existing Appbit Express routers/services are hosted behind `pages/api/[[...path]].js`.
- MySQL schema remains **130**.
- Existing APK resolver, Publishing, Update Center, R2 Accounts/File Manager, authentication, backups and app metadata functionality are preserved.

## Current navigation

- Dashboard
- App Library
- Publishing
- Update Center
- R2 Account
  - Accounts
  - File Manager
- Settings

## Local production

```bash
npm install
npm run check
npm run build
npm start
```

`npm run build` intentionally uses Webpack on Next.js 16 for Hostinger compatibility.

Visible release version: **V2.13**.
