# Appbit V2.21

Appbit is a Hostinger-managed Next.js APK publishing workspace with Cloudflare R2 storage integration.

## V2.21 focus

The R2 File Manager now has a collapsible storage tree in the application sidebar, folder file counts, optional custom app icons, and a reset-to-main behavior whenever File Manager is clicked from the primary navigation. Custom download domains use one CNAME record instead of the previous TXT + CNAME flow.

Public links remain filename-only (`https://domain/filename.apk`) while account and folder paths stay private to the Appbit organization layer. Folder uploads remain multipart/resumable with the existing 10 GB per-file limit.

## Deployment

Use Node 20–24 with the included lockfile. Hostinger should run the normal Next.js build command. Keep the existing database environment variables and R2 credentials configuration. On first startup V2.21 migrates the database to schema 133 and creates the optional folder-icon metadata table.

Open `/health` after deployment, then `/login`. The complete release record is in `versionnotes.md`.
