# Appbit V2.14 — Version Notes

## Release identity

- Package version: `2.14.0`
- Visible version: `V2.14`
- Build ID: `2.14-hostinger-clean-next-runtime`
- Framework: Next.js `16.3.3`
- React: `19.2.0`
- Node target: `24.x`
- Database schema: `130`

## Hostinger deployment repair

- Keeps exactly one API bridge: `pages/api/[[...path]].js`.
- Keeps the bridge in standard Next.js module syntax with `import`, `export const config`, and `export default`.
- Removes the package-wide module classification that caused the Hostinger Webpack parse error.
- Makes the prebuild guard remove only known stale catch-all route filenames before validating the canonical route.
- Keeps `next build --webpack` and the managed `next start` runtime.
- Keeps the postbuild finalizer that places `VERSION` and `BUILD-INFO.json` inside `.next/server`.
- Points the native Next API runtime at the project-local Playwright browser path used during installation.

## Cleanup

- Removes deployment files and instructions for the retired local deployment path.
- Replaces the collection of separate historical release-note and upgrade files with this single `versionnotes.md` file.
- Adds `.gitignore` rules for dependencies, build output, local secrets, logs and generated test files.
- Adds the generated `package-lock.json` for reproducible npm installation.
- Removes the stale change-history manifest from the package so it cannot report obsolete file hashes.

## Reliability fix

- Parses textual dates with calendar validation instead of converting local-midnight dates through UTC. This preserves dates such as `August 5, 2026` on hosts in non-UTC time zones while continuing to reject invalid dates and missing values.

## Preserved application behavior

Authentication, MySQL migrations, App Library, APK source resolution, media refresh, Publishing, Update Center, user roles, Cloudflare R2 accounts/file management and public download links remain in the package.

