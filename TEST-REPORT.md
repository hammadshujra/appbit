# Appbit V2.6 Test Report

## Result

- `npm run check`: PASS
- Hostinger prebuild validation: PASS
- Automated regression suite: **61/61 PASS**
- V2.6 focused regressions: **5/5 PASS**
- ZIP integrity: validated after packaging

## V2.6 coverage

- App detail page has one app icon only (header identity).
- Artwork section contains cover + screenshots without duplicating the icon.
- Detail information uses the requested 20/80 desktop layout.
- Meta title, meta description, description, and Mod Info are separated into clean content cards.
- `Download Media` packages icon, cover, screenshots, and a media manifest.
- LiteAPKs compact sizes such as `147 M` and `1.6 G` parse as MB/GB and persist as byte values.
- Existing publishing, R2, downloads, Accounts, Team, and database schema behavior remains covered by the regression suite.

## Build note

The clean release directory does not include `node_modules`, so a full local `next build` was not run in this packaging environment. Hostinger installs dependencies from the included lockfile before its normal build.
