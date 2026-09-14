# Appbit V2.14 — Verification Report

## Checks

- `npm install`: PASS. The optional Playwright browser download timed out in this sandbox and the installer exited cleanly with direct HTTP scraping preserved.
- Node.js syntax and local-import checks (`npm run check`): PASS.
- Regression suite (`npm test`): **85/85 passed**.
- Next.js production build with Webpack (`npm run build`): PASS.
- Build output finalizer: PASS; `.next/server/VERSION` and `.next/server/BUILD-INFO.json` were created.
- Stale-route fixture: PASS; `pages/api/[...path].mjs` was removed by the V2.14 prebuild guard.
- Native Next runtime smoke test: PASS; `/`, `/login`, and `/api/session/csrf` returned successfully, and the CSRF response reported version `2.14`.
- Python browser fixtures: not run because Python Playwright is not installed in this sandbox.

## Deployment target

The package is configured for Hostinger App Hosting with the Next.js preset, `main` branch, Node.js 24.x, `npm run build`, npm, and `.next` output.
