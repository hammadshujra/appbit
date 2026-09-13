# Appbit V2.12 — Hostinger Next.js Deployment

V2.12 is the Hostinger deployment repair. The old `.next/server/VERSION` runtime error belongs to the last successful V2.10 deployment. V2.11 did not replace it because its API catch-all route failed Hostinger's module parser. V2.12 fixes both paths.

## Hostinger settings

- Framework preset: **Next.js**
- Branch: **main**
- Node.js: **20.x**
- Root directory: **./**
- Build command: **npm run build**
- Package manager: **npm**
- Output directory: **.next**

You do not need a custom Entry File. Hostinger should run the managed Next.js runtime.

`npm run build` executes the Webpack build and npm automatically runs `postbuild`, which finalizes the `.next/server` output. Do **not** replace it with a manual plain `next build` command.

Internal production command: `next build --webpack`. Do **not** change it to plain `next build`.

## Environment variables

Keep the same production variables already configured in Hostinger:

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

## Redeploy

1. Replace the repository/application files with the V2.12 package and push the commit to the branch Hostinger is actually deploying.
2. In Hostinger, start a **new deployment** from that commit. A failed deployment leaves the previous successful build active, so seeing the old build-directory ID and `.next/server/VERSION` stack trace does not mean V2.12 is running.
3. Confirm the build log contains `Hostinger output finalized for V2.12.` near the end. That line is printed by the new postbuild finalizer.
4. After deployment finishes, open the site in a private/incognito window.
5. If Runtime Logs still show the exact old build directory from the previous deployment, verify Hostinger is connected to the new commit/branch before changing application settings.

## Expected result

The login page should load instead of an HTTP 500. The runtime must not fail because of a missing `.next/server/VERSION` file, and `/api/session/csrf` should be handled by the native Next.js API bridge.
