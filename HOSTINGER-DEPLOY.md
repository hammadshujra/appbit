# Appbit V2.13 — Hostinger Next.js Deployment

V2.13 fixes the module-parse failure reported for `pages/api/[[...path]].js`. The failing V2.11 route mixed CommonJS and ESM while the package explicitly declared `"type": "commonjs"`. V2.13 removes that package-wide module classification and ships one standard Next.js API route using Next.js `import`/`export` syntax only.

## Hostinger settings

- Framework preset: **Next.js**
- Branch: **main**
- Node.js: **24.x**
- Root directory: **./**
- Build command: **npm run build**
- Package manager: **npm**
- Output directory: **.next**

You do not need a custom Entry File. Hostinger should run the managed Next.js runtime.

`npm run build` automatically runs the V2.13 prebuild guard, then `next build --webpack`, then the postbuild finalizer. Do **not** replace it with plain `next build`.

## What you must see in the build log

Before Next.js compilation starts, the log must contain:

```text
[Appbit] Hostinger prebuild V2.13: API route verified — pages/api/[[...path]].js (Next.js module syntax).
```

Near the end of a successful build, it must contain:

```text
[Appbit] Hostinger output finalized for V2.13.
```

If the log still names `pages/api/[...path].mjs`, or shows an older V2.11 route without the V2.13 prebuild line, Hostinger is building an older commit/package.

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

1. Replace the repository/application files with the V2.13 package.
2. Commit and push the V2.13 files to the exact branch Hostinger deploys.
3. Start a **new deployment**. Failed deployments leave the previous successful runtime active.
4. Confirm the V2.13 prebuild line appears before compilation.
5. Confirm `Hostinger output finalized for V2.13.` appears after the build.
6. After deployment, open the site in a private/incognito window.

## Expected result

The build must no longer fail on `import`/`export` in `pages/api/[[...path]].js`. The login page should load instead of the previous 500, `/api/session/csrf` should be served by the native Next.js API bridge, and runtime requests must not depend on a loose root `VERSION` file.
