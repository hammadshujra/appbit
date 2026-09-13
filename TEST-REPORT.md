# Appbit V2.10 — Hostinger Webpack verification

Release: **V2.10 Hostinger Next.js Webpack Build**

## Fix

The Hostinger failure was caused by Next.js 16 selecting Turbopack by default while the platform exposed only the WASM binding. V2.10 forces the supported Webpack production path with `next build --webpack`.

## Verification performed in this package

- Static package/version checks.
- Hostinger build-script regression test.
- Existing custom Next/Express route regression checks.
- JavaScript syntax/module checks available without installing remote dependencies.
- ZIP CRC/integrity verification before release.

## Deployment acceptance

A successful Hostinger build must run `npm run build`, which resolves to `next build --webpack`, create `.next`, start `server.js`, and report V2.10 after login.
