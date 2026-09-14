# Appbit V2.21 — Verification Report

Release checks cover the Hostinger/Next.js runtime, filename-only download gateway, R2 folder-only upload model, new sidebar storage tree, custom folder icons, and the one-record custom-domain flow.

Key V2.21 regressions covered:

- File Manager main navigation resets to the disk list.
- R2 accounts/folders render in a collapsible sidebar tree with file counts.
- Optional folder app icons are stored in `r2_folder_meta` and served only to authenticated admins.
- New custom-domain UI requires one CNAME record and no TXT record.
- Filename-only public URLs and forced attachment downloads remain intact.
- Existing V2.20 schema-132 safety migration remains preserved; V2.21 advances schema to 133.

Validation result: **114/114 automated tests pass**, and `npm run check` passes the JavaScript/module and Hostinger prebuild guards.
