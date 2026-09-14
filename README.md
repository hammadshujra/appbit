# Appbit V2.17

Appbit is an Android APK publishing workspace prepared for Hostinger App Hosting with the Next.js framework preset.

## Hostinger settings

- Framework preset: **Next.js**
- Branch: **main**
- Node.js: **24.x**
- Root directory: **./**
- Build command: **npm run build**
- Package manager: **npm**
- Output directory: **.next**
- Managed runtime: **next start**

The repository contains one Next.js API catch-all at `pages/api/[[...path]].js`. Appbit’s existing Express services run behind that native API route, and the production build explicitly uses Webpack for Hostinger compatibility.

## Environment

Keep the same Hostinger environment variable names and existing secret values in `hostinger.env.example`. Do not commit real credentials. Do not add a `PORT` variable for the managed runtime.

## V2.17 focus

- Windows-style R2 file browsing with account disks, folders, breadcrumbs, search, and metadata.
- Bulk selection and resumable multipart uploads with visible progress and per-part retries, supporting files up to 10 GB.
- Explicit Download, Copy link, and Open actions for generated public file links.
- Download-only hostname instructions for TXT verification and CNAME routing; no website or homepage is required.
- Dedicated public `/health` deployment screen and repaired responsive `/login` card.
- Existing MySQL data and the reviewed schema-130 reconciliation remain protected.

## Verification

```bash
npm install
npm run check
npm test
npm run build
npm start
```

Open `/health` after deployment, then `/login`. The complete V2.17 release record is in `versionnotes.md`.
