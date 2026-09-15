# Appbit V2.5 — UI Repair Hotfix 2 Test Report

Date: 2026-09-15
Build: `2.5-ui-repair-2`
Schema: `133` (unchanged)

## Fixes verified

- App-detail icon, cover and screenshot media are hard-contained and cannot expand the page.
- Global horizontal overflow is blocked at the shell/workspace level.
- Collapsed sidebar uses a dedicated 82px icon rail with stable logo/toggle placement.
- Navigation icons are bundled local SVGs; no remote icon API is required.
- Accounts always has a local icon.
- Cloudflare identity is preserved in R2 disk cards and active account headers.
- Health page uses the new split light Studio Manager design.
- Sign-in / Health / Studio buttons do not turn white on hover.
- Asset revision `252` is included so browsers do not keep the broken pre-hotfix CSS/JS.

## Automated validation

- `npm test`: **56/56 passed**.
- `npm run check`: **passed**.
- JavaScript syntax/local module validation: **passed**.
- Hostinger prebuild check: **passed**.

A full Next.js production build was not run in this clean packaging directory because `node_modules` is not installed. The lockfile remains included for Hostinger's install/build flow.
