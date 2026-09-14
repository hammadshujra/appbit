# Appbit V2.21

V2.21 refines the Cloudflare R2 workspace around a cleaner file-manager model and a simpler custom-domain connection flow.

## File Manager

- Clicking **File Manager** in the main sidebar always returns to the disk list instead of reopening the last nested folder.
- Connected R2 accounts are now shown directly under File Manager in a collapsible sidebar tree, with nested folders and descendant file counts.
- Folder cards show the number of files stored inside them.
- New folders can optionally have a custom app icon (PNG, JPG, or WebP, up to 1 MB). The app icon is visually layered behind the supplied folder SVG so it appears to rise out of the folder.
- File uploads remain folder-only and keep drag-and-drop, multi-file upload, resumable multipart transfer, and the existing 10 GB per-file ceiling.
- Public download links remain filename-only: `https://domain/filename.apk`. Internal account/folder paths are never exposed in newly copied links.

## Custom download domain

- The old TXT + CNAME setup has been replaced with a **one-record CNAME** workflow.
- After entering a domain, Appbit shows one clear DNS record with Type, Name, Target, TTL, and small copy controls.
- Verification checks the one CNAME/address route and then confirms that HTTPS actually reaches this Appbit deployment before the domain can become active. This prevents a DNS-only setup from generating broken 525/SSL download links.
- Cloudflare users should keep Proxy status **DNS only** until verification succeeds, then may change proxy behavior as appropriate for their hosting/SSL setup.

## Database

- Schema version: **133**.
- Adds `r2_folder_meta` to store optional per-folder app icons without changing R2 object paths.
