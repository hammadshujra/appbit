# Appbit V2.24

V2.24 unifies the whole Appbit workspace around the finalized R2 File Manager layout and removes the layered folder artwork from app folders.

## V2.24 focus

- Folder cards no longer render any folder SVG/background layer. A folder shows only the app icon that you upload manually, plus the folder name and file count.
- New Folder and Change Icon previews now show the app icon itself rather than a folder composition.
- The R2 sidebar tree uses the manual app icon when one exists; Account/Disk identity keeps its normal disk/folder icon.
- All major pages now use the same full-width content geometry as File Manager, eliminating the large unused side gutters seen in App Library.
- Panels/cards/buttons/inputs now share one consistent corner radius and visual treatment across Dashboard, App Library, Publishing, Update Center, R2, and Settings.
- The old title-bar menu control was removed. A real sidebar edge toggle now supports a compact icon-only desktop rail and a full sidebar. The preference is persisted in local storage.
- On mobile/tablet the same edge control opens the complete sidebar rather than forcing the desktop icon-only rail.
- Existing R2 uploads, filename-only download links, global search, folder rename/delete, custom icons, and right-click actions remain intact.

## Deployment

Use Node 20–24 with the included lockfile and the normal Hostinger Next.js build. Database schema remains 133; V2.24 does not require a new database migration.
