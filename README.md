# Appbit Studio Manager V2.5

V2.5 is a complete UI replacement built around the approved Concept 4 direction. The existing Appbit backend, database schema, APK resolver, publishing workflow, update scanner, Cloudflare R2 integration, filename-only download gateway, and custom-domain system remain in place.

## Studio navigation

The primary sidebar is now:

1. **Workspace** — private studio dashboard and activity overview.
2. **Apps** — replaces the old App Library while retaining import, search, taxonomy, app details, media refresh, draft/publish state, and app locking.
3. **Release** — replaces the old Publishing page and shows published/release workflows.
4. **Update** — a separate top-level update center for scans and available app updates.
5. **Analytics** — private operational analytics derived from the studio's app/release/update/account data.
6. **Accounts** — Admin-only connected storage/download services, Cloudflare R2 accounts, download domains, storage usage, and File Manager access.
7. **Team** — Admin-only Admin/Partner management.
8. **Settings** — Admin-only studio settings, health, maintenance, and JSON backup/restore.

## Roles

- **Admin:** full access to apps, releases, updates, analytics, connected accounts, R2/File Manager, team management, backup/restore, health, and maintenance.
- **Partner:** app/release/update/analytics work only. Partners cannot manage infrastructure credentials, connected R2 accounts, team members, backup/restore, or destructive maintenance.

## JSON studio backup

V2.5 backup format version 4 is intentionally metadata-focused. It includes:

- published/released apps and version metadata;
- connected R2 account configuration required to reconnect the studio;
- custom download-domain configuration;
- Admin/Partner team structure (the current Admin password is never replaced during restore);
- organized R2 folder hierarchy and folder metadata/icons;
- studio settings.

It does **not** copy APK binaries or raw objects stored in Cloudflare R2. The R2 object list is read only to derive the folder hierarchy. Because a portable backup can contain connection credentials and Partner password hashes, backup JSON files must be stored securely.

## Logo and favicon

`public/logo.svg` is the V2.5 A+B vector monogram. The same vector is used for `favicon.svg`, with PNG icon variants included for compatibility.

## Deployment

Use Node 20–24 with the included lockfile and the normal Hostinger managed Next.js build. Database schema remains **133**; V2.5 does not apply a destructive database migration.

```bash
npm ci
npm run check
npm run build
npm start
```

See `HOSTINGER-DEPLOY.md` for the existing Hostinger deployment and custom download-domain setup.

## V2.5 UI stabilization

The current package includes a post-redesign UI stabilization pass: new Concept 4 login/health screens, top-only profile control, File Manager under Accounts, active-only import progress, real Analytics charting, improved R2 account setup guidance, Admin/Partner profile photos, simplified File Manager disk cards, and spacing/icon consistency fixes. Schema remains 133.
