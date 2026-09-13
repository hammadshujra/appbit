# Appbit V2.9

## V2.9 — Hostinger Next.js Build

- Converted the Appbit UI runtime from Astro middleware to Next.js 16.3.3.
- Kept the existing Express backend/API, MySQL migrations, authentication, APK resolver, Update Center, Publishing and R2 Accounts/File Manager behavior.
- Added Hostinger-ready `.next` build output, custom `server.js` entry, Node 24 target and environment template.
- Database schema remains 130.
- Visible release version is `V2.9`.

# Appbit V2.8

- Reworked R2 into separate Accounts and File Manager pages under Update Center.
- Simplified R2 account setup to Label, Status, Account ID, Bucket, Access Key ID, and Secret Access Key.
- R2 endpoint and region are generated automatically; legacy gateway/direct-domain form fields are removed from the UI.
- Added tracked per-account used/remaining storage with a 10 GB planning target and automatic least-used account selection.
- Added Download Domain management with generated TXT ownership verification and CNAME routing instructions.
- Added searchable all-account File Manager with upload, resumable multipart progress, replace, delete, copy/open link, and account filtering.
- Account add/edit now uses an inline form instead of a modal.

# Appbit V2.7 — Cloudflare R2 Manager

- Adds an admin-only **Cloudflare R2** workspace directly under Update Center.
- Supports multiple R2 accounts/buckets with encrypted Secret Access Keys, connection tests, enable/disable, sync, and indexed usage.
- Adds resilient multipart uploads for large APK/XAPK/APKS files. Files are chunked into retryable parts, concurrent upload count adapts to the browser connection class, and interrupted sessions can resume after the same local file is selected again.
- Uses 5 MiB baseline multipart parts and a long upload request window so slow connections retry only a small part instead of losing a multi-gigabyte upload.
- Adds automatic least-used-account selection plus a per-account storage target for organization. Manual account selection is always available.
- Adds remote file sync, search, copy/open public links, replace-in-place, and delete-from-R2 actions.
- Adds opaque/random object keys by default, with an optional original-filename mode.
- Adds two public-link modes: direct R2 custom domain, or an opaque `/d/<token>` Appbit download gateway that can be placed behind a separate download hostname.
- Adds byte-range streaming to the public gateway so large downloads can resume without buffering the entire object in Appbit memory.
- Adds `R2_CREDENTIALS_KEY` for stable AES-256-GCM encryption of saved R2 secrets (SESSION_SECRET is used as a fallback).
- Schema: **129**. Visible version: **V2.7**.

# Appbit V2.6

## V2.6 — Core Content Boundaries + Hero App Size Fix

- Replaced broad whole-article capture with bounded LiteAPKs source-content extraction: only the Description section and Mod Info are retained.
- Explicitly excludes FAQ, Safety/Data Safety, comments/reviews, recommendations/related apps, screenshots, download/install blocks, old-version blocks, footer/navigation/social/advertising text and similar non-core sections.
- Meta title now reads the real document title plus standard Open Graph/Twitter fallbacks; meta description reads standard description/OG/Twitter metadata plus source JSON-LD description when present.
- Added a hero/front-summary app-size extractor that prioritizes typed size values near Version, Google Play, rating and Download APK/Download Now controls before generic page candidates.
- Fixed a UI/API handoff bug where a stale raw label such as `Not reported` could mask a valid numeric `fileSizeBytes` value already detected by the scraper.
- Fresh refreshes no longer preserve old contaminated source-content blobs when the bounded Description/Mod Info extraction is empty.
- Preserves the V2.5 Add APK / Auto Import 403 browser fallback and queue-recovery behavior.
- Visible release version is `V2.6`.

# Appbit V2.5

## V2.5 — Import Transport Recovery

- Fixed the V2.4 regression where a raw LiteAPKs HTTP 403 could hard-stop Add APK and Auto Import before the working browser path was attempted.
- Restored Appbit's direct public metadata request identity and added a bounded Playwright Chromium fallback for the same public URL when direct HTML is rejected or replaced with a verification page.
- Browser fallback reuses a short-lived session for an import batch and does not solve CAPTCHAs or interactive verification challenges.
- Auto Import now falls back from a rejected sitemap to public listing discovery instead of pausing immediately.
- A single inaccessible app page is recorded as failed while the remaining Auto Import / Update Center queue continues; only source-wide rate-limit/network/unavailable failures pause the batch.
- Preserves V2.4 App Size, SEO metadata and full source-content scraping.
- Visible release version is `V2.5`.

# Appbit V2.4

## V2.4 — LiteAPKs Size + Source Content Scraper Repair

- Fixed the API/display guard that could hide a valid source file size when the displayed LiteAPKs source version differed from the managed database version.
- Added exact raw size labels plus normalized byte storage.
- Strengthened SIZE extraction across compact stat cards, raw HTML, structured/hydration JSON, rendered DOM, source-provided download/details pages and safe package response headers.
- LiteAPKs app-page requests now use a normal desktop-browser profile; Chromium is used only as a bounded fallback for client-rendered public metadata.
- Added capture of page/meta title, meta description, description-section text and full written source/article content.
- Added a Source Content panel showing SEO fields and written source content.
- Visible release version is `V2.4`.

## V2.3 — File Size Pipeline + Update Scan Repair
- Fixed app-size extraction end-to-end across LiteAPKs stat cards, semantic labels, data/meta attributes, JSON-LD/hydration JSON, the app-linked download/details page, and explicit APK/XAPK/APKS response headers.
- Rejects captions such as `Total` as size values and accepts MB/GB, MiB/GiB, full unit names, and split value/unit markup.
- A download/details page may supply current size when it omits a duplicate version label; an explicit conflicting version is rejected.
- Header probing uses HEAD or a one-byte Range request and reads the total from Content-Range, without downloading the package body.
- Added a normal Chromium-rendered fallback for client-side Size injection after a successful LiteAPKs page fetch; access-denied/challenge responses are not bypassed.
- Schema 128 recovers valid size values already stored in existing source metadata.
- API display can recover a valid raw source size while preserving version boundaries.
- Update scans no longer overwrite managed current-version size/date when a newer release is merely detected.
- Visible version format is now `V2.3`.

# Appbit V2.1.0

- Fixed legacy MySQL/MariaDB ASCII-vs-utf8mb4 collation failures that blocked Add APK and auto-import writes.
- Added a dedicated LiteAPKs stat-card extractor for Version, Size, Genre, Developer, Reached/Views, and Updated values.
- Strengthened hero developer, size, views, and update-date fallbacks without guessing unrelated values.
- Kept source-access restrictions explicit: Appbit does not bypass HTTP 403/challenge pages.
- Enlarged the App Library search field and made card columns adapt progressively to viewport width.
- Changed app detail to 50/50 Metadata and Links columns, with Description directly below Links.
- Version badge now reports V2.1.0.

## V2.1.1 — Collation repair

- Repair existing Appbit-owned text and ENUM columns before category initialization, including MySQL 8 utf8mb4_0900_ai_ci / utf8mb4_unicode_ci conflicts.
- Preserve column types, defaults, comments, nullability and indexes; preflight unique-key collisions and stop safely if an unsupported definition is encountered.
- Use explicit utf8mb4_unicode_ci defaults for new tables and avoid unconditional key-column rebuilds on every startup.
- Existing Android Appbit databases cannot re-enter the destructive legacy migration when their schema version is unrecognized.
- Schema version 127, read-only collation diagnostic and backup-first Docker upgrade instructions. No UI or scraper behavior changes.

## V2.2.0 — Metadata Completeness + Background Update Repair
- Fixed a runtime bug in secondary metadata enrichment where `pageText` was referenced before initialization, preventing missing size/download/developer/date recovery.
- Added a typed LiteAPKs compact-stat fallback for value-above-label layouts, including app size and REACHED/views counters.
- When LiteAPKs exposes REACHED/views but no distinct download count, Appbit preserves that source counter as the library popularity/download count instead of reporting an empty value.
- Update scans now continue in a server-side worker after Start Scan; leaving the Update Center page no longer halts progress.
- Update Center polling is now read-only state polling; the browser is no longer responsible for advancing update jobs.
- Version raised to 2.2.0.
