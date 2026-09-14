# Appbit V2.17 — Hostinger App Hosting

Push the repository contents to the `main` branch selected by Hostinger and use the settings below.

## Build configuration

- Framework preset: **Next.js**
- Branch: **main**
- Node.js: **24.x**
- Root directory: **./**
- Build command: **npm run build**
- Package manager: **npm**
- Output directory: **.next**

Hostinger should use its managed Next.js runtime (`next start`). You do not need a custom Entry File and you do not need a `PORT` variable. Keep `npm run build` exactly as shown; it runs the release guard, `next build --webpack`, and the output finalizer. Do **not** replace it with plain `next build`.

## Environment variables

Keep the existing Hostinger variable names and values:

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
- `WORK_LOCK_TIMEOUT_SECONDS`
- `APK_RESOLVER_DAILY_PAGES`
- `APK_RESOLVER_FULL_PAGES`
- `APK_RESOLVER_MAX_ITEMS`
- `APK_RESOLVER_REQUEST_GAP_MS`

Keep `SESSION_SECRET` and `R2_CREDENTIALS_KEY` long and stable. Never place their real values in GitHub or this package.

## Build log checks

The build should contain:

```text
[Appbit] Hostinger prebuild V2.17: API route verified — pages/api/[[...path]].js (Next.js module syntax).
[Appbit] Hostinger output finalized for V2.17.
```

After runtime initialization, the database line should report:

```text
[Appbit] Database ready. Schema v130.
```

## Existing database safety

The release continues the reviewed handling for an existing Appbit database where `apps` already contains Appbit records but `schema_migrations` is empty or older. It verifies the recognized Appbit table signature, performs idempotent reconciliation, and records schema `130`.

This path does not reset the database, delete rows, or run the old legacy migration. Do not remove the existing database variables. A partial/unrelated `apps` table or a marker newer than `130` still stops for manual review.

## First deployment checks

1. Push the V2.17 files to the exact `main` branch selected in Hostinger.
2. Start a fresh deployment with the settings above.
3. Open `/health`. Wait until Database and Schema show passing.
4. Open `/login` and sign in.
5. If the app still shows the old schema error, verify Hostinger is building the new commit/branch; do not erase MySQL data.

## R2 download hostname

A hostname such as `downloads.example.com` is for download links only. It does not need a website, homepage, separate hosting, or an A record for Appbit.

In Appbit, open **R2 Account → Accounts**, add the hostname, and copy the exact generated records:

1. Add the TXT name/value to prove ownership.
2. Add the CNAME from the subdomain to the Appbit Hostinger hostname.
3. Wait for propagation and click **Check DNS again**.
4. When active, newly copied links use `https://downloads.example.com/d/<token>`.

TXT verification and CNAME routing are separate. If a hostname is deleted and later added again, copy the new displayed TXT record before verifying. Removing the hostname never deletes R2 objects, but old links using the removed hostname cannot resolve until that hostname is active again.

## Upload and link checks

- File Manager supports folders, search, bulk selection, and files up to 10 GB per file.
- Uploads are sent as small multipart requests through the Appbit API; a temporary network failure retries the current part.
- Use **Download** for the automatic APK download, **Copy link** to share it, and **Open** to inspect the endpoint in a new tab.
- The fallback Appbit-host link remains available before a custom hostname is verified.
