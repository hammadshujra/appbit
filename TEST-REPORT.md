# Appbit V2.20 — Verification Report

- `npm test`: PASS — 109/109 tests.
- `npm run check`: PASS — JavaScript syntax, local module checks, file checks, and Hostinger prebuild guard.
- Copy-link regression verifies the public URL is generated from `r2_objects.filename`, never from the internal R2 object key or old random object leaf.
- Download routing regression verifies file-like URLs always resolve as downloads or return a plain 404; they never fall through to the Appbit application page.
- Response regression verifies `Content-Disposition: attachment` remains set for public file responses and range requests.
- Custom-domain regression verifies TXT ownership plus a live HTTPS `/api/health/public` gateway check are both required before a hostname is activated.
- Schema 132 deactivates pre-V2.20 TXT-only custom domains once, preventing a previously broken 525/SSL hostname from continuing to be used by Copy link.
- Explorer folder, drag/drop multi-upload, R2 account, Hostinger Webpack, collation, APK resolver, and existing regression suites all pass.
- A full `next build --webpack` was not run in this workspace because the supplied source ZIP does not contain `node_modules`; Hostinger installs dependencies from `package-lock.json` before building.
