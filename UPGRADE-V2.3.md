# Upgrade Appbit to V2.3 on Windows Docker

Use the existing `C:\Appbit` installation. Do not delete Docker volumes or the existing database. Keep your current `.env.docker`.

1. Make sure Docker Desktop is running.
2. Back up the existing database if your current package has the backup script:

```powershell
cd C:\Appbit
powershell -ExecutionPolicy Bypass -File .\scripts\backup-docker.ps1
```

3. Extract the V2.3 ZIP and replace the application files in `C:\Appbit`. Keep your live `.env.docker`.
4. Rebuild and recreate the application container:

```powershell
cd C:\Appbit
docker compose up -d --build
```

5. Verify the container:

```powershell
docker compose ps
```

6. Open `http://localhost:3000`, confirm the sidebar reports `V2.3`, then open the same app that previously displayed `App Size: Not reported` and run its metadata Refresh.

If the old UI/version is still visible, use Ctrl+F5 and confirm Docker rebuilt from `C:\Appbit`. Never run `docker compose down -v` for this upgrade.
