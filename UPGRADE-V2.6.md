# Upgrade Appbit to V2.6 on Windows Docker

Use the existing `C:\Appbit` installation. Keep the current `.env.docker` and Docker database volumes. Do not run `docker compose down -v`.

1. Make sure Docker Desktop is running.
2. If available, create the existing database backup first:

```powershell
cd C:\Appbit
powershell -ExecutionPolicy Bypass -File .\scripts\backup-docker.ps1
```

3. Extract the V2.6 ZIP and replace the application files in `C:\Appbit`. Keep `.env.docker`.
4. Rebuild:

```powershell
cd C:\Appbit
docker compose up -d --build
```

5. Verify:

```powershell
docker compose ps
```

6. Open `http://localhost:3000` and confirm the sidebar shows **V2.6**.
7. Open an existing app that previously contained extra FAQ/recommendation/footer content and click Refresh. Confirm Core Content contains only Description + Mod Info.
8. Check the same app's App Size. A valid numeric size should be shown when the source supplies one in the hero/stat metadata or one of the existing safe fallbacks.

If an old interface remains, press Ctrl+F5 and confirm Docker rebuilt from `C:\Appbit`.
