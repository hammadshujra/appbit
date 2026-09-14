# Appbit V2.18 — Disk File Manager & Direct Downloads

## Release identity

- Package version: `2.18.0`
- Visible version: `V2.18`
- Build ID: `2.18-disk-file-manager-direct-links`
- Framework: Next.js `16.3.3`
- React: `19.2.0`
- Node target: `24.x`
- Database schema: `131`

## Storage disks and folders

- Every saved R2 account now appears in File Manager as one storage disk. The **Account Label** is only the disk display name, for example `Disk One`.
- The old **Disk Root Folder** setting has been removed from the account form and backend behavior. Appbit no longer creates or prepends a hidden root folder from the account label or a configured prefix.
- The schema-131 migration clears the obsolete `folder_prefix` setting without deleting, moving, renaming, or rewriting any existing R2 objects.
- Opening a disk starts at the actual bucket root. Folders appear only when they already exist in R2 or when the user creates them with **New folder**.
- Folder browsing now behaves like a normal file explorer: open a folder, use breadcrumbs or **Up**, and see only the immediate contents of the current folder. Search can still find files recursively within the selected disk.
- Folder creation writes a zero-byte R2 directory marker under the folder currently being viewed.

## Windows-style web file manager

- The File Manager landing page shows connected R2 accounts as disk cards instead of a storage dropdown.
- Opening a disk shows a Windows-style explorer table with **Name**, **Modified**, **Uploaded**, **Type**, **Size**, and **Actions** columns.
- Files provide **Copy link** and **Delete** actions. Folders open in place.
- The layout is responsive for Hostinger desktop and smaller screens.

## Drag, drop, and bulk upload

- Files can be dragged directly from Windows into the current disk/folder or selected with the file picker.
- Multiple files can be queued at once. Appbit processes two files concurrently while multipart parts inside each file continue to use connection-aware workers.
- Every queued file gets its own filename, byte count, status, percentage, and progress bar.
- Multipart uploads remain resumable by local-file fingerprint, retry only failed parts up to eight times with backoff, and wait for the browser to come online after a connection loss.
- Uploads use a 5 MiB starting part size, a 70 MiB API body ceiling, and support files up to 10 GiB (10 GB-class uploads).

## Direct filename download links

- Newly copied links no longer use a random `/d/<token>` URL.
- A root object named `tiktok.apk` is exposed as `https://your-download-domain/tiktok.apk`.
- A nested object keeps its folder path, for example `https://your-download-domain/TikTok/tiktok.apk`.
- Opening a direct file URL resolves the exact R2 object path and streams it with `Content-Disposition: attachment`, `Content-Type`, byte-range headers, and `X-Content-Type-Options: nosniff`, so the browser downloads the file without exposing R2 credentials.
- Hostinger's native Next.js catch-all page performs this filename/path resolution before rendering the Appbit UI. The custom Express runtime has equivalent direct-path handling.
- Existing `/d/<token>` links from V2.17 and earlier remain supported for backward compatibility, but Appbit no longer generates them for new **Copy link** actions.

## Download-only hostname DNS

- A hostname such as `downloads.example.com` remains a download endpoint, not a second website.
- The generated TXT record proves hostname control. The generated CNAME routes the download hostname to the Appbit Hostinger hostname.
- Once the hostname is verified and active, File Manager uses it as the base for direct filename links.

## Data safety

- Existing accounts, objects, multipart uploads, download-domain records, and APK data are preserved.
- No database reset, object move, object rename, or legacy-data deletion is performed by this release.
- Old objects that were previously stored under a prefix remain in that physical R2 path and are simply visible as normal folders from the bucket root after sync.
