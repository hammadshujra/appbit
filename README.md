# Appbit V2.22

V2.22 implements the approved R2 File Manager mockup as the production layout.

## V2.22 focus

- Full-width responsive R2 workspace with four premium status cards.
- Account view keeps only account search and New Folder actions; duplicate All Disks / Up / Refresh controls are removed.
- Global File Manager search and account-scoped search locate files and folders and jump directly to their location.
- Sidebar storage tree remains the primary disk/folder navigation.
- Folder cards use the supplied base folder SVG. App icons are never inferred or extracted automatically: the user uploads the icon manually when creating a folder or later through right-click → Change Icon.
- Right-click folder actions: Open, Rename, Change Icon, Delete.
- Right-click file actions: Copy Link, Rename, Delete.
- Recursive folder delete and server-side folder/file rename are implemented for R2.
- Responsive breakpoints cover wide desktop, laptop, tablet, and mobile layouts without overlapping controls.
- Public filename-only download behavior from V2.20/V2.21 is preserved.

## Deployment

Use Node 20–24 with the included lockfile and the normal Hostinger Next.js build. Database schema remains 133; V2.22 does not require a new table migration.
