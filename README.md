# Appbit V2.23

V2.23 keeps the approved V2.22 responsive R2 File Manager layout and fixes the folder artwork composition exactly as requested.

## V2.23 focus

- Created folder cards now use three fixed visual layers: supplied folder back artwork, the manually uploaded app icon in the middle, and the supplied small blue/front artwork above it.
- Appbit does not generate or extract folder app icons automatically. The icon is still chosen by the user when creating a folder or through right-click → Change Icon.
- The app icon can no longer fall behind the whole folder artwork; its z-order is locked between the back and front layers.
- New Folder and Change Icon previews use the same three-layer composition as the actual folder card.
- The Account One heading keeps the normal folder icon but removes the circular badge/background around it.
- The approved V2.22 status cards, search, sidebar tree, right-click actions, responsive layout, and filename-only public downloads are preserved.

## Deployment

Use Node 20–24 with the included lockfile and the normal Hostinger Next.js build. Database schema remains 133; V2.23 does not require a new table migration.
