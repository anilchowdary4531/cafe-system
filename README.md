# Cafe System (Frontend + Backend)

This repository contains:
- `frontend/`: React + Vite web app
- `backend/`: Fastify + Prisma API server

All API base URLs and secrets are configured via environment variables (no hardcoded deployment URLs in code).

## Backend Environment

Files:
- `backend/.env` (development)
- `backend/.env.production` (production build/run)

Required:
- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL` (absolute origin, no trailing slash)

Recommended:
- `PORT` (defaults to `4000`)
- `HOST` (defaults to `0.0.0.0`)
- `CORS_ORIGINS` (optional comma-separated allow-list in addition to `FRONTEND_URL`)

Optional (Production storage - invoices/assets):
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_PUBLIC_BASE_URL` (CloudFront/public base URL, optional)
- `STORAGE_DRIVER` (`s3` or `local`, optional override)

Optional (Email OTP via Resend):
- `RESEND_API_KEY`
- `RESEND_FROM` (e.g. `"Cafe System <no-reply@yourdomain.com>"`)
- `RESEND_REPLY_TO` (optional)
- `OTP_EMAIL_SUBJECT` (optional)
- `EMAIL_STRICT=true` to fail hard if email provider is missing
- `EMAIL_SIMULATE=true` to force console simulation instead of live email send

## Frontend Environment

Files:
- `frontend/.env.development`
- `frontend/.env.production`

Required:
- `VITE_API_URL` (base URL of the backend API)

## Upload APIs

- `POST /owner/:restaurantId/uploads/presign` (S3 presign)
- `POST /owner/:restaurantId/assets/logo` (multipart)
- `POST /owner/:restaurantId/assets/banner` (multipart)
- `POST /owner/:restaurantId/assets/menu-image?entityId=...` (multipart)
- `DELETE /owner/:restaurantId/assets` body: `{ key }`

## Deploy Notes

Vercel (Frontend):
- Set `VITE_API_URL` in Vercel project environment variables for Production/Preview.

AWS EC2 (Backend):
- Set `NODE_ENV=production`
- Provide `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` and optionally `CORS_ORIGINS` in the runtime environment (or `backend/.env.production` when running manually).

## Migrations

Local:
```bash
cd backend
npx prisma migrate dev
```

EC2:
```bash
cd /path/to/cafe-system/backend
npx prisma migrate deploy
```

## EC2 Run (PM2)

```bash
cd /path/to/cafe-system/backend
npm install --omit=dev
pm2 start src/server.js --name cafe-backend --update-env
pm2 save
```
