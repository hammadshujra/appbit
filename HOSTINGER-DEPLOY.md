# Appbit V2.10 — Hostinger Next.js deployment

This package fixes the Hostinger build error where Next.js 16 tried to use Turbopack but the Hostinger Linux/x64 build environment exposed only the WASM compiler binding. V2.10 explicitly builds with Webpack.

## Hostinger build settings

Use these values in hPanel:

- Framework: **Next.js**
- Node.js: **24.x**
- Package manager: **npm**
- Root directory: **.**
- Build command: **npm run build**
- Output directory: **.next**
- Start command: **npm start**
- Entry file: **server.js**

`npm run build` is intentionally defined as:

```bash
next build --webpack
```

Do **not** replace it with plain `next build` on this Hostinger deployment, because Next.js 16 defaults plain builds to Turbopack.

## Environment variables

Use your existing production values. At minimum configure:

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

Keep the same MySQL database if you are upgrading from V2.9. Database schema remains **130**.

## Deployment verification

1. Upload/deploy this V2.10 package.
2. Confirm the build log contains a Webpack build and does not fail with the Turbopack native-bindings message.
3. Start the application with `npm start`.
4. Open `/health`.
5. Log in and confirm the sidebar reports **V2.10**.
6. Verify App Library, Publishing, Update Center, R2 Accounts, and File Manager.

If Hostinger provides a custom Build Command field, keep it as **`npm run build`**. Do not enter `next build` manually.
