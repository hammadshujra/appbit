# Appbit V2.15

Appbit is an Android APK publishing workspace built for Hostinger App Hosting with the Next.js framework preset.

## Hostinger settings

- Framework preset: **Next.js**
- Branch: **main**
- Node.js: **24.x**
- Root directory: **./**
- Build command: **npm run build**
- Package manager: **npm**
- Output directory: **.next**
- Runtime command: **next start**

The repository contains one Next.js API catch-all at `pages/api/[[...path]].js`. The existing Appbit Express services run behind that native API route. The production build explicitly uses Webpack for Hostinger compatibility.

## Production environment

Configure the existing Hostinger environment variables listed in `hostinger.env.example`. Keep the same variable names and values already used by the application; do not commit real secrets.

The database schema remains **130**. V2.15 adds a reviewed, non-destructive reconciliation for an existing Appbit `apps` database whose `schema_migrations` marker is missing or older. Existing records are preserved; the legacy migration/drop path is not used when the Appbit table signature is recognized.

## Local verification

```bash
npm install
npm run check
npm test
npm run build
npm start
```

The browser fallback uses the project-local Playwright browser installed during `npm install` when the host permits it. Direct metadata requests remain available if a browser cannot be installed.

## Release files

- `HOSTINGER-DEPLOY.md` — exact Hostinger setup and redeploy procedure.
- `versionnotes.md` — the complete V2.15 change record in one file.
- `VERSION` and `BUILD-INFO.json` — release identity used by the runtime and build output.
