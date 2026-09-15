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
