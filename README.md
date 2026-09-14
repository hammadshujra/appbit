
## V2.20 download-link contract

Copy link uses the database filename, not the internal R2 object key. For example, an object stored internally as `apk/0Dd8n3ww9vd4n86tD2mMctrS.apk` with filename `TikTok_Platinum_v46.9.5_(MOD)_arm8.apk` is copied as `https://download-domain/TikTok_Platinum_v46.9.5_(MOD)_arm8.apk`. File-like URLs are download-only routes and never fall back to the Appbit UI.

A custom hostname is activated only after both TXT ownership verification and an HTTPS gateway probe succeed. Cloudflare 525 means Cloudflare cannot complete TLS to the configured origin; DNS verification alone does not make that hostname a working Appbit download gateway.
# Appbit V2.20

Appbit V2.20 keeps the Hostinger-managed Next.js deployment from V2.18 and refines the Cloudflare R2 File Manager around an Explorer-style workflow.

## Hostinger runtime

- Framework: Next.js `16.3.3`
- React: `19.2.0`
- Build: `next build --webpack`
- Start: `next start`
- Supported Node: `>=20.9 <25` (Hostinger Node 24.x is supported)
- Database schema: `131`

## V2.20 focus

- The File Manager landing page shows two R2 disks per desktop row.
- The supplied `folder-icon.svg` is used for both disk cards and folder tiles.
- Opening a disk root shows folders only. Root-level file upload is intentionally disabled.
- Folders use large Explorer-style tiles with the folder name below the icon.
- The file-manager search bar and the separate Upload Activity panel are removed.
- Only one breadcrumb is shown. The duplicate `Account / root` helper path is gone.
- Drag/drop and multi-file upload appear only after opening a folder.
- Upload queue progress remains visible directly below the drop zone while files are uploading.
- File rows inside folders keep Name, Modified, Uploaded, Type, Size, Copy link, and Delete.
- Public download links are filename-only. Internal folders never appear in newly copied links.
- Example: internal `apk/TikTok/tiktok.apk` -> public `https://example.com/tiktok.apk`.
- Old V2.18 folder/path links and older `/d/<token>` links remain readable for backward compatibility.

## Deploy

Use the Hostinger Next.js preset, install from `package-lock.json`, and run `npm run build`.

Open `/health` after deployment, then `/login`. The complete V2.20 release record is in `versionnotes.md`.
