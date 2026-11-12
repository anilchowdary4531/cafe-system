# Tiffzy Isolated Staging Deployment Guide

This directory contains ready-to-apply templates for running Tiffzy (`main` or a staging branch) in a completely isolated staging environment without touching `/home/ubuntu/cafe-system`, the production database, or the production `tiffzy` service.

## Architecture Isolation
- **Staging API hostname**: `https://staging-api.tiffzy.com` (separate DNS A record / TLS vhost)
- **Staging systemd unit**: `tiffzy-staging` (`deploy/staging/tiffzy-staging.service`) listening on `127.0.0.1:3100`
- **Staging app directory**: `/home/ubuntu/cafe-system-staging`
- **Staging PostgreSQL database**: separate `tiffzy_staging` DB (never production RDS)
- **Vercel Preview frontend**: separate Preview environment variables overriding `VITE_API_URL`, `VITE_API_BASE_URL`, `VITE_SOCKET_URL` (bypassing `frontend/vercel.json` `/api` production rewrite)

## Provisioning Checklist
1. Create DNS `A` record for `staging-api.tiffzy.com` pointing to your staging EC2 host.
2. Create an isolated PostgreSQL database (`tiffzy_staging`) and dedicated user.
3. Install `deploy/staging/nginx-staging-api.tiffzy.com.conf` to `/etc/nginx/sites-available/staging-api.tiffzy.com`, enable it, and run `sudo certbot --nginx -d staging-api.tiffzy.com`.
4. Install `deploy/staging/tiffzy-staging.service` to `/etc/systemd/system/tiffzy-staging.service` and enable it (`sudo systemctl enable tiffzy-staging`).
5. Clone the target branch (e.g., `main`) to `/home/ubuntu/cafe-system-staging` and create `/home/ubuntu/cafe-system-staging/backend/.env` from `deploy/staging/backend.env.staging.example`.
6. Run `bash /home/ubuntu/cafe-system-staging/deploy/staging/setup-staging.sh`.
7. In **Vercel Project Settings -> Environment Variables (Preview scope only)**, configure the variables from `deploy/staging/frontend.env.preview.example` and redeploy the Preview branch.
8. Add your Vercel Preview hostname to TWM Pay Admin -> **Allowed websites** (no separate TWM Pay sandbox exists; live merchant keys verify against the allowlisted domain).
9. (Optional Android staging APK): build with `./gradlew assembleDebug -PTIFFZY_BASE_URL=https://staging-api.tiffzy.com/`.

