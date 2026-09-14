# Appbit V2.14

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

The database schema remains **130**. Appbit retains authentication, App Library, APK metadata resolution, Publishing, Update Center, Cloudflare R2 management and public download links.

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
- `versionnotes.md` — the complete V2.14 change record in one file.
- `VERSION` and `BUILD-INFO.json` — release identity used by the runtime and build output.

