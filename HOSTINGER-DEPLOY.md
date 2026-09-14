# Appbit V2.15 — Hostinger App Hosting

This package is prepared for Hostinger’s managed Next.js runtime. Push the repository contents to the `main` branch and use the settings below.

## Build configuration

- Framework preset: **Next.js**
- Branch: **main**
- Node.js: **24.x**
- Root directory: **./**
- Build command: **npm run build**
- Package manager: **npm**
- Output directory: **.next**

You do not need a custom Entry File. Hostinger should start the saved build with its managed Next.js runtime (`next start`).

`npm run build` runs the release guard, `next build --webpack`, and the output finalizer automatically. Keep the build command exactly as shown.
Do **not** replace it with plain `next build`.

## Environment variables

Keep the existing Hostinger values and variable names:

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

`SESSION_SECRET` and `R2_CREDENTIALS_KEY` must be long, stable secrets. Never place their real values in GitHub or this ZIP.

## Build log checks

The log should contain this line before Next.js compilation:

```text
[Appbit] Hostinger prebuild V2.15: API route verified — pages/api/[[...path]].js (Next.js module syntax).
```

The completed build should contain:

```text
[Appbit] Hostinger output finalized for V2.15.
```

After the first successful runtime initialization, the log should also contain:

```text
[Appbit] Database ready. Schema v130.
```

## Existing database safety

This release handles the existing database error where `apps` is present but `schema_migrations` has no recognized current marker. It first verifies the existing Appbit table signature (`id`, `package_id`, `name`, and `source_page_url`), then performs the existing idempotent reconciliation and records schema `130`.

That path does not delete rows, reset the database, drop legacy tables, or run the legacy import. Do not create a new database and do not remove the existing database environment variables. A partial Appbit table or a schema marker newer than `130` still stops for manual review.

The prebuild guard removes only the three known stale API catch-all filenames before checking the canonical route. This prevents an older repository file from recreating the reported route conflict.

## Redeploy procedure

1. Replace the repository contents with this V2.15 package.
2. Commit and push the files to the exact `main` branch selected in Hostinger.
3. Confirm the deployment commit is the new V2.15 commit.
4. Start a fresh deployment with the settings above.
5. Confirm the V2.15 build lines and `Database ready. Schema v130.` appear.
6. Open the domain in a private browser window and sign in.

If the log still reports an older route filename or the old schema error, Hostinger is building an older commit or a different branch. Check the repository selection and branch first, then start a new deployment. Do not erase the MySQL database to resolve it.

## Runtime checks

- `/login` should load the sign-in page.
- `/api/session/csrf` should return a JSON CSRF response.
- The Appbit interface should load after successful sign-in.
- `/api/health` is available to the administrator after the database is ready.
- Public R2 links continue to use `/d/<token>` through the Next.js rewrite.
