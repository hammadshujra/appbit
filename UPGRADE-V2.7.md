# Upgrade Appbit to V2.7 on Windows Docker

1. Keep the existing `.env.docker` and Docker database volume. Do **not** run `docker compose down -v`.
2. Recommended: add a stable `R2_CREDENTIALS_KEY` (32+ random characters) to `.env.docker`. Existing `SESSION_SECRET` is used as a fallback if this is left blank.
3. Extract V2.7 over `C:\Appbit`.
4. Rebuild:

```powershell
cd C:\Appbit
docker compose up -d --build
```

5. Open Appbit and confirm **V2.7** in the sidebar.
6. Open **Update Center → Cloudflare R2**, add an account, save it, then use **Test** before uploading.

R2 account fields use Cloudflare's S3 credentials: Account ID, bucket, Access Key ID, and Secret Access Key. Appbit encrypts the saved secret.

For large files, leave the object key blank and keep **Opaque/random key** selected. Appbit uses multipart uploads with retryable chunks and can resume an interrupted session when the same file is selected again.
## Public download domains

- **Gateway mode** creates an opaque `/d/<random-token>` URL. Enter a separate download hostname after pointing that hostname to the Appbit deployment through your normal DNS/reverse-proxy setup.
- **Direct mode** uses an R2 custom domain attached to that bucket in Cloudflare. Appbit does not create Cloudflare DNS records with the R2 S3 credentials.
- Opaque links reduce exposed storage details, but they are not an anonymity or legal-evasion mechanism.

## Large uploads

V2.7 uses R2 multipart upload with 5 MiB baseline parts and retries failed parts independently. For a paused upload, keep the local file unchanged and select the same file again to resume the stored multipart session.

