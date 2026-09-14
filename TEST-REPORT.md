# Appbit V2.22 — Verification Report

Release checks cover the Hostinger/Next.js runtime, filename-only download gateway, R2 folder-only upload model, new sidebar storage tree, custom folder icons, and the one-record custom-domain flow.

Key V2.22 regressions covered:

- File Manager main navigation resets to the disk list.
- R2 accounts/folders render in a collapsible sidebar tree with file counts.
- Optional folder app icons are stored in `r2_folder_meta` and served only to authenticated admins.
- New custom-domain UI requires one CNAME record and no TXT record.
- Filename-only public URLs and forced attachment downloads remain intact.
- Existing schema-132 safety migration remains preserved, and the current database schema remains 133; V2.22 does not require a new migration.

Validation result: **120/120 automated tests pass**, and `npm run check` passes the JavaScript/module and Hostinger prebuild guards. A full `next build` was not rerun in this sandbox because dependencies are not installed locally (`next: not found`); Hostinger should install the locked dependencies before building.
