# Appbit V2.9 local Docker

V2.9 uses Next.js with the existing Express backend. Docker is optional for local use; Hostinger deployment does not use `docker-compose.yml`.

```powershell
cd C:\Appbit
Docker compose up -d --build
```

The Docker image installs dependencies, attempts to install Playwright Chromium with its Linux dependencies, runs Appbit checks, builds Next.js, and starts `server.js` on port 3000. Keep `.env.docker` and the MySQL volume when upgrading an existing local installation.
