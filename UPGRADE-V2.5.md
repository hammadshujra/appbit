# Upgrade Appbit to V2.5 on Windows Docker

Use the existing `C:\Appbit` installation. Keep the current `.env.docker` and Docker database volumes.

1. Make sure Docker Desktop is running.
2. Optional but recommended: back up the database with the included backup script.

```powershell
cd C:\Appbit
powershell -ExecutionPolicy Bypass -File .\scripts\backup-docker.ps1
```

3. Extract the V2.5 ZIP and replace the application files in `C:\Appbit`. Do not delete `.env.docker` or Docker volumes.
4. Rebuild the app container:

```powershell
cd C:\Appbit
docker compose up -d --build
```

5. Verify:

```powershell
docker compose ps
```

6. Open `http://localhost:3000`, confirm the sidebar shows `V2.5`, then test both **Add APK** and **Auto Import**.

Do not run `docker compose down -v` during this upgrade.
