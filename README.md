# Appbit V2.10

**APK Publishing Workspace — Next.js / Hostinger build**

V2.10 keeps the V2.9 Next.js runtime and fixes Hostinger production builds by forcing Webpack. V2.9 converted the Appbit web runtime from Astro middleware to **Next.js 16.3.3** while preserving the existing Appbit Express API, authentication, MySQL schema/migrations, APK resolver, publishing/update workflows, and Cloudflare R2 Accounts + File Manager introduced in V2.8.

## Framework and runtime

- Next.js 16.3.3
- React 19.2
- Express 5 custom server (`server.js`)
- MySQL / MariaDB through `mysql2`
- Node.js 20.9–24 (Hostinger deployment target: Node 24)
- Cloudflare R2 multi-account manager and multipart uploader

The Next.js page layer serves the authenticated Appbit workspace shell. Existing `/api/*`, login, health and opaque download routes continue through Appbit's Express backend.

## Hostinger

See `HOSTINGER-DEPLOY.md`. Recommended build settings:

- Framework: Next.js
- Node: 24
- Build script: `build`
- Output directory: `.next`
- Entry file: `server.js`
- Package manager: npm

Use `hostinger.env.example` as the environment-variable template. Keep all real credentials in Hostinger's Environment Variables UI.

## Local/Docker

Docker remains supported. The Dockerfile now runs the Next.js build. Existing MySQL/R2 data is preserved when you keep your Docker volumes and environment file.

```bash
npm install
npm run check
npm run build
npm start
```

Visible release version: **V2.10**. Database schema remains **130**; the framework conversion does not require a destructive migration.
