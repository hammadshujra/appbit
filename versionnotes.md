# Appbit V2.15 — Version Notes

## Release identity

- Package version: `2.15.0`
- Visible version: `V2.15`
- Build ID: `2.15-hostinger-safe-schema-reconciliation`
- Framework: Next.js `16.3.3`
- React: `19.2.0`
- Node target: `24.x`
- Database schema: `130`

## Existing database deployment fix

- Fixes the startup error raised when an existing Appbit database has an empty or older `schema_migrations` marker while its `apps` table already contains Appbit data.
- Reviews the existing `apps` signature (`id`, `package_id`, `name`, and `source_page_url`) before accepting the safe reconciliation path.
- Reconciles a recognized existing database idempotently and records schema `130`.
- Never re-enters the legacy migration/drop path for a recognized existing `apps` database.
- Continues to stop safely for a partial/unrelated `apps` table or a schema marker newer than this release.
- Preserves existing MySQL records; the reviewed path does not delete rows, reset the database, or drop legacy tables.

## Hostinger runtime

- Keeps exactly one API bridge: `pages/api/[[...path]].js`.
- Keeps standard Next.js module syntax and the Webpack production build.
- Uses Hostinger’s managed Next.js runtime with `next start`, Node `24.x`, npm, and `.next` output.
- Keeps the postbuild release metadata inside `.next/server`.
- Points the native Next API runtime at the Playwright browser path used during installation.

## Cleanup and reliability

- Removes Docker deployment files and Docker-only instructions from the upload package.
- Keeps one consolidated `versionnotes.md` instead of separate version-note files.
- Adds `.gitignore` rules for dependencies, build output, local secrets, logs, and generated test files.
- Preserves the date parsing and mixed-collation repairs from V2.14.

Authentication, App Library, APK source resolution, media refresh, Publishing, Update Center, user roles, Cloudflare R2 accounts/file management, and public download links remain in the package.
