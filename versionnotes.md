# Appbit V2.20

- Fixed Copy link so it is generated from the real uploaded filename, never from the internal R2 object key or old random object leaf.
- A file stored internally under any folder/random legacy key now copies as `https://domain/ActualFileName.apk`.
- Direct `.apk`/file-like requests can no longer fall through to the Appbit application page. Missing download filenames return a plain 404 instead.
- Custom download hostnames now require both the TXT ownership check and a live HTTPS Appbit gateway check before Appbit marks them active. This prevents broken 525/SSL hostnames from being used in copied links. Schema 132 deactivates older TXT-only active hostnames once so they must pass the new HTTPS check.
- Download responses continue to force `Content-Disposition: attachment`, including range requests.
- Legacy `/d/<token>` and old exact object-key paths remain readable for backward compatibility, but Appbit no longer generates them for Copy link.

# Appbit V2.19 — Explorer File Manager & Filename-Only Downloads

## Release identity

- Package version: `2.19.0`
- Visible version: `V2.19`
- Build ID: `2.19-explorer-folders-filename-only-links`
- Framework: Next.js `16.3.3`
- React: `19.2.0`
- Node target: `24.x`
- Database schema: `131`

## File Manager landing page

- R2 account cards are displayed as storage disks in a fixed two-column desktop grid.
- The user-supplied `folder-icon.svg` is used as the large disk icon.
- Disk cards continue to show the account label, bucket, storage use, and remaining tracked capacity.
- The File Manager main page has no file search box.

## Disk root behavior

- Opening a disk shows one breadcrumb only: `File Manager / Account Label`.
- The duplicate `Account Label / root` path line has been removed.
- The disk root is folder-only. Files cannot be uploaded directly to the disk root from the File Manager.
- **New folder**, **Up**, **All Disks**, and **Refresh** remain available.
- Folders are displayed as large Explorer-style tiles using the supplied folder SVG, with the folder name below the icon.
- Folder rows no longer show Modified, Uploaded, Type, Size, or an Open button.

## Inside a folder

- After a folder is opened, the drag-and-drop upload zone appears.
- Multiple files can be selected or dropped at once.
- The live per-file queue remains directly below the uploader with filename, bytes, percentage, and progress bar.
- The separate persistent **Upload Activity** panel has been removed from the File Manager.
- Files are shown in the existing table with **Name**, **Modified**, **Uploaded**, **Type**, **Size**, and **Actions**.
- File actions remain **Copy link** and **Delete**.
- Nested folders also use the same large folder-tile layout.

## Filename-only public links

- Internal folders are organizational only and never appear in newly generated public URLs.
- Example internal key: `apk/TikTok/tiktok.apk`
- Copied public URL: `https://your-domain/tiktok.apk`
- The public gateway resolves current links by filename and streams the matching R2 object with `Content-Disposition: attachment`.
- Existing V2.18 folder/path links are still resolved by exact object key first for backward compatibility.
- Existing `/d/<token>` links from older releases remain supported.

## Counters

- File counters now exclude zero-byte R2 folder marker objects, so a disk containing only four folders reports zero files instead of four files.

## Hostinger

- The managed Next.js runtime remains unchanged.
- Production builds continue to use Webpack explicitly with `next build --webpack`.
- The native Next catch-all continues to serve filename download requests before rendering the Appbit UI.

## Capacity and hostname notes

- Each connected account continues to use the existing **10 GB** tracking target unless that storage-account logic is changed separately.
- The configured **Download-only hostname** is used only for public file delivery; File Manager folders remain private organizational paths.
