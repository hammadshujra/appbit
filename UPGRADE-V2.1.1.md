# Appbit V2.1.1 — Existing Docker installation

This is a collation repair for the V2.1.0 package, not a fresh installation or database reset. It preserves the existing app IDs, media, settings, import queues, and named Docker volumes. It does not guarantee that an external source will provide all metadata or allow access.

## 1. Back up the current database

Extract the new ZIP into C:\Appbit without starting or rebuilding Docker. Keep your existing .env.docker and backups folder. Open PowerShell in C:\Appbit while Docker Desktop is running, then execute:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-docker.ps1
```

The script creates a private SQL backup in C:\Appbit\backups. Check that it reports a successful backup. Do not proceed if it fails. Keep your existing .env.docker file and database volumes. Do not run docker compose down -v, docker volume rm, or delete the database.

If your local installation uses a different Compose service or database configuration, inspect docker-compose.yml and adjust the backup procedure rather than running the script against an unrelated database.

## 2. Replace application files

The V2.1.1 application files are now in C:\Appbit. Confirm that the backup completed before proceeding. Do not remove your .env.docker, backups folder, or any locally configured files. The ZIP contains templates but no live .env.docker file.

## 3. Rebuild only the application

```powershell
cd C:\Appbit
docker compose up -d --build --no-deps appbit
docker compose logs --tail=100 appbit
```

The existing MySQL service must already be running. The first application start performs the schema repair before category initialization. If it encounters conflicting unique keys, unsupported schema definitions, or another database error, it stops the repair and reports the error instead of merging or deleting records. Do not manually force a conversion or reset the database.

## 4. Verify the running release

Open http://localhost:3000 and look for V2.1.1 under APK Publishing Workspace. Open http://localhost:3000/health while signed in as the administrator to inspect runtime and schema status. The expected schema version is 127.

Run the read-only collation diagnostic:

```powershell
docker compose exec -T appbit node scripts/check-collations.js
```

It should report schema 127 and no remaining mismatched Appbit text columns. Open App Library and confirm that the category controls load. Then test one existing app and one Add APK import. A real HTTP 403 from LiteAPKs remains a separate external access restriction; this database repair does not bypass it.

If there is still an error, send the output of docker compose logs --tail=100 appbit and the read-only diagnostic. Do not send your .env.docker, database password, or SQL backup.
