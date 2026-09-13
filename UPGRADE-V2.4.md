# Upgrade Appbit to V2.4 on Windows Docker

Use the existing `C:\Appbit` installation. Keep the current `.env.docker`, MySQL data and Docker volumes.

1. Make sure Docker Desktop is running.
2. Back up the existing database if available.
3. Extract the V2.4 ZIP over `C:\Appbit`, replacing application files but not your live environment file.
4. Rebuild:

```powershell
cd C:\Appbit
docker compose up -d --build
```

5. Verify:

```powershell
docker compose ps
```

6. Open `http://localhost:3000`, confirm **V2.4** in the sidebar, open an app that previously showed `App Size: Not reported`, and click **Refresh**.

Do not use `docker compose down -v`; that would remove volumes.
