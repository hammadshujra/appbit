# Appbit V2.17 — Version Notes

## Release identity

- Package version: `2.17.0`
- Visible version: `V2.17`
- Build ID: `2.17-file-manager-download-health`
- Framework: Next.js `16.3.3`
- React: `19.2.0`
- Node target: `24.x`
- Database schema: `130`

## File Manager

- Treats each saved R2 account as a storage disk.
- Adds folder prefixes, breadcrumb navigation, an Up action, and a New folder action.
- Creates folders as zero-byte R2 directory markers; this uses the existing `r2_objects` table and does not reset or rewrite existing records.
- Keeps account, object key, file name, size, and added date visible.
- Adds server-side account/prefix/search filtering.
- Removes the visible replacement workflow from normal file rows; the existing object key and public token remain stable.

## Upload reliability

- Supports selecting multiple files and processes them through a controlled queue.
- Keeps multipart uploads resumable per file and per folder/account context.
- Shows real progress fill, current bytes, part number, queue status, and pause/error feedback.
- Retries only the failed part up to eight times with backoff.
- Waits for the browser to come back online instead of restarting the file.
- Uses a 5 MiB starting part size, a 70 MiB API body ceiling, and a 10 GiB (10 GB) file limit.

## Public download links

- R2 objects are served through the opaque `/d/<token>` gateway.
- The gateway sends `Content-Disposition: attachment`, `Content-Type`, range headers, and `nosniff`, so APK links download instead of exposing storage credentials.
- The file manager now puts Download first, followed by Copy link and Open.
- A deleted custom hostname no longer appears in newly copied links; the R2 object remains safe. Re-adding a deleted hostname produces a fresh DNS record, which must be copied to the DNS provider.

## Download-only hostname DNS

- A hostname such as `downloads.example.com` is a download endpoint, not a website.
- No homepage, website files, or separate A record are required for Appbit.
- The generated TXT record proves hostname control.
- The generated CNAME points the hostname to the Appbit Hostinger hostname and routes `/d/<token>`.
- DNS verification normalizes split TXT fragments and treats temporary DNS resolver errors as retryable verification waits.

## Login and health

- Replaces the unconstrained login layout with a responsive card, bounded logo, accessible fields, and a health link.
- Adds a public, secret-free `/health` page that polls deployment, database, schema, and gateway status.
- Keeps detailed `/api/health` checks administrator-only.
- Keeps the existing Hostinger native Next.js runtime and API route structure.

## Data safety

- Schema version remains `130`.
- Existing Appbit records are preserved.
- The recognized existing-apps reconciliation remains non-destructive.
- No database reset or legacy data deletion was added.
