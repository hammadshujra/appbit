# Appbit V2.5

V2.5 is the Concept 4 Studio Manager redesign and private-workspace release.

## UI hard reset

- Replaced the previous dark workspace shell with the approved light Concept 4 design language.
- New A+B monogram SVG and favicon assets.
- New top-level navigation: Workspace, Apps, Release, Update, Analytics, Accounts, Team, Settings.
- Apps replaces App Library; Release replaces Publishing; Update remains a separate top-level workflow.
- Responsive sidebar supports full mode and icon-only collapsed mode.
- Standardized component geometry, buttons, cards, tables, filters, forms, responsive spacing, and light visual tokens.

## Existing functions preserved

- APK import/resolver and metadata flows.
- app detail/media refresh and work locks.
- publish/draft state and release records.
- update scanning and update workflow.
- Cloudflare R2 accounts, folders, uploads, rename/delete, custom folder icons, download domains, and filename-only download gateway.
- old public download compatibility paths.
- Admin/Partner authentication and activity/notification services.

## New studio areas

- Workspace overview with release/update/account/team summaries.
- Analytics page using existing private studio data.
- Accounts hub with connected R2 services and storage-usage visualization.
- Team page for Admin/Partner management and access explanation.
- Settings backup configuration and restore UI.

## Backup format v4

Backs up released app metadata, connected-account configuration, custom download domains, Partner/team structure, studio settings, and the organized R2 folder hierarchy. Raw APK/R2 object contents are intentionally excluded.

Database schema remains 133. This release is a UI/service upgrade and does not wipe existing records.

## V2.5 UI stabilization pass

This pass fixes the first post-redesign UI breaks without changing database schema 133 or resetting working backend data.

- Rebuilt `/login` as a full Concept 4 light Studio Manager sign-in page with a visual panel plus sign-in panel.
- Rebuilt `/health` in the same light Studio Manager design.
- Added cache-isolated `studio-logo.svg` usage so stale old-brand assets do not remain visible after deployment.
- Removed the duplicate bottom sidebar user/profile card. The top user control now shows role, name, and email and contains sign-out/profile actions.
- Added File Manager directly under Accounts in the sidebar.
- Replaced the main navigation icon set with a smoother consistent stroke icon family.
- Apps auto-import progress is hidden while idle and only appears during active/paused work; it disappears after completion.
- Workspace Recent Apps / Release Health tables now show Version and Size in separate columns.
- Analytics now includes a real 7-day SVG activity graph based on app updated/published timestamps.
- Improved R2 connected-account spacing and Cloudflare visual treatment.
- Added an explicit step-by-step Cloudflare R2 credential guide beside the connection form.
- Added Admin/Partner profile editing and profile-photo upload/removal UI using the existing secure avatar endpoints.
- Simplified File Manager disk cards to account label + usage bar + percent used/remaining; bucket text is no longer duplicated on the disk card.
- Enlarged File Manager search and removed the visible Ctrl-K badge from the File Manager search box.
- Added responsive spacing/margin fixes for account forms, team rows, import controls, tables, and File Manager controls.

## V2.5 Accounts + File Manager hotfix
- Restored the missing `bindR2AccountsPage`, account test/sync action handler, and inline R2 account save binding.
- Accounts and File Manager are independent top-level navigation items. File Manager owns its expandable account/folder tree.
- Restored Cloudflare branding on R2 account cards, account headings, and File Manager account-tree roots.
- Rebuilt File Manager sidebar sizing constraints so app/folder artwork cannot expand the sidebar.
- New Folder is now a single-instance modal and no longer duplicates/flickers.
- Fixed File Manager search icon contrast and responsive tree sizing.
- Fixed System Health button hover contrast.
- Replaced the earlier remote icon layer with bundled local SVG navigation icons so the UI does not depend on an external icon API.
- Database schema stays at 133; no destructive migration is introduced.


## V2.5 UI repair hotfix 2
- Hard-contained App Detail artwork. App icon, cover and screenshots now have fixed responsive dimensions and cannot stretch the page or create horizontal overflow.
- Rebuilt collapsed sidebar as a dedicated 82 px icon rail with a clean edge toggle and stable icon sizing.
- Replaced the remote navigation icon dependency with bundled local SVG icons; Accounts is no longer able to render without an icon because of a network/icon-name failure.
- Restored Cloudflare branding on active R2 account headers and disk cards.
- Rebuilt the Health page into the same split light experience as Sign In.
- Removed white button hover states: secondary actions hover light blue and primary actions stay blue.
- Added a new asset revision so Hostinger/browser caches cannot keep the broken pre-hotfix CSS/JS after deployment.
- Database schema remains 133 and no user data migration is introduced.
