# Appbit V2.11 — Hostinger Next.js deployment

V2.11 is built specifically for Hostinger's managed **Next.js** runtime. It fixes the runtime `ENOENT ... /.next/server/VERSION` 500 and no longer depends on Hostinger starting Appbit's custom `server.js`.

## Hostinger build settings

Keep the same values shown in hPanel:

- Framework preset: **Next.js**
- Node.js: **20.x** is supported for this package (22.x or 24.x are also acceptable)
- Branch: **main**
- Root directory: **./**
- Build command: **npm run build**
- Package manager: **npm**
- Output directory: **.next**

`npm run build` resolves to:

```bash
next build --webpack
```

Do **not** change it to plain `next build`; V2.11 intentionally keeps the Webpack override that fixed Hostinger's Turbopack native-binding build failure.

With the **Next.js** preset you do not need a custom Entry File. The package now uses the normal managed Next runtime (`next start`) and exposes the Appbit backend through native Next.js API routes.

## Why V2.10 returned HTTP 500

V2.10 compiled `src/version.js` into `.next/server` but that module still read a loose `VERSION` file from the filesystem. Hostinger runs the compiled Next server from a generated deployment directory, so the runtime looked for `.next/server/VERSION` and crashed when it was not present.

V2.11 bundles the visible version/build identity directly into the server code. It also mounts Appbit's API/auth/R2 services through `pages/api/[[...path]].js`, because Hostinger's Next.js preset starts the managed Next runtime rather than the old custom `server.js` process.

## Environment variables

Keep your existing production values. At minimum configure:

```env
NODE_ENV=production
SESSION_SECRET=replace-with-a-long-random-secret
R2_CREDENTIALS_KEY=replace-with-another-long-random-secret
ADMIN_NAME=Administrator
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=replace-with-a-strong-password
DB_HOST=localhost
DB_PORT=3306
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_SSL=false
TRUST_PROXY=1
```

Keep the same MySQL database if you are upgrading from V2.10. Database schema remains **130**.

## Deployment verification

1. Upload/deploy the **V2.11** ZIP.
2. Keep Framework preset **Next.js**, Build command **npm run build**, Output directory **.next**.
3. Confirm the build uses Webpack and completes.
4. Open `/login` and sign in.
5. Confirm the sidebar reports **V2.11**.
6. Verify Dashboard, App Library, Publishing, Update Center, R2 Accounts, and File Manager.
7. Check Runtime Logs. The old `ENOENT ... .next/server/VERSION` message must not appear.

If the database variables are wrong, Appbit now returns a clear database-not-ready API message instead of trying to render missing server-side template files from `.next/server`.
