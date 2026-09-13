# Appbit V2.12 local Docker

V2.12 uses the same native Next.js runtime locally and on Hostinger. Docker remains optional for local use; Hostinger deployment does not use `docker-compose.yml`.

```powershell
cd C:\Appbit
docker compose up -d --build
```

The Docker image runs `npm run build` (Webpack) followed by `npm start`, which now resolves to `next start`. The Appbit backend is mounted through the native Next.js API adapter, matching the Hostinger runtime architecture.
