# Upgrade Appbit to V2.8

Keep the existing `.env.docker` and Docker database volumes. Do not run `docker compose down -v`.

```powershell
cd C:\Appbit
docker compose up -d --build
```

After startup, confirm **V2.8** in the sidebar. Open **R2 Account → Accounts** to verify existing R2 credentials, then **Sync Files**. Configure the Download Domain if required, then use **R2 Account → File Manager** for uploads and file management.
