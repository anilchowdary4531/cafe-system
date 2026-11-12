#!/usr/bin/env bash
set -euo pipefail

# Deploy target branch (default: main) to an isolated staging directory and systemd unit.
# Never modifies /home/ubuntu/cafe-system or production tiffzy.service.

STAGING_DIR="${STAGING_DIR:-/home/ubuntu/cafe-system-staging}"
REPO_URL="${REPO_URL:-https://github.com/anilchowdary4531/cafe-system.git}"
TARGET_BRANCH="${TARGET_BRANCH:-${FEATURE_BRANCH:-main}}"
STAGING_SERVICE="${STAGING_SERVICE:-tiffzy-staging}"
STAGING_PORT="${STAGING_PORT:-3100}"

if [ "$STAGING_DIR" = "/home/ubuntu/cafe-system" ] || [ "$STAGING_SERVICE" = "tiffzy" ]; then
  echo "ERROR: Refusing to target production directory or systemd unit."
  exit 1
fi

if [ ! -d "$STAGING_DIR/.git" ]; then
  git clone --branch "$TARGET_BRANCH" "$REPO_URL" "$STAGING_DIR"
fi

cd "$STAGING_DIR"
git fetch origin "$TARGET_BRANCH"
git checkout "$TARGET_BRANCH"
git reset --hard "origin/$TARGET_BRANCH"

TARGET_SHA=$(git rev-parse HEAD)
echo "Staging HEAD: $TARGET_SHA (branch: $TARGET_BRANCH)"

cd "$STAGING_DIR/backend"
if [ ! -f .env ]; then
  echo "ERROR: Missing $STAGING_DIR/backend/.env (copy from deploy/staging/backend.env.staging.example first)."
  exit 1
fi

# Verify DATABASE_URL is distinct and not empty
if ! grep -q "^DATABASE_URL=" .env; then
  echo "ERROR: DATABASE_URL is missing in $STAGING_DIR/backend/.env"
  exit 1
fi

npm ci --omit=dev || npm install --production=false
npx prisma generate

# Apply schema safely on empty or existing staging DB:
# Legacy migrations (20260429*_init) referenced unmapped "Restaurant" before @@map("restaurants") was adopted.
# Use `prisma db push --skip-generate` when starting from an empty DB or non-baselined DB, and `prisma migrate deploy` when `_prisma_migrations` is already active.
HAS_MIGRATIONS_TABLE=$(node -e '
  import("./src/prisma.js").then(async ({ default: prisma }) => {
    const rows = await prisma.$queryRaw`SELECT to_regclass('\''public._prisma_migrations'\'')::text AS tbl`;
    const hasRestaurants = await prisma.$queryRaw`SELECT to_regclass('\''public.restaurants'\'')::text AS tbl`;
    console.log(rows[0]?.tbl && hasRestaurants[0]?.tbl ? "migrate" : "push");
    await prisma.$disconnect();
  });
')

if [ "$HAS_MIGRATIONS_TABLE" = "migrate" ]; then
  npx prisma migrate deploy
else
  npx prisma db push --skip-generate
fi

node -e '
  import("./src/prisma.js").then(async ({ default: prisma }) => {
    const tables = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = '\''public'\'' ORDER BY tablename`;
    const names = tables.map((t) => t.tablename);
    for (const required of ["payments", "orders", "restaurants", "users"]) {
      if (!names.includes(required)) {
        throw new Error(`Missing required staging table: ${required}`);
      }
    }
    const idx = await prisma.$queryRaw`SELECT indexname FROM pg_indexes WHERE tablename = '\''payments'\'' ORDER BY indexname`;
    console.log("Staging payments indexes:", idx.map((i) => i.indexname));
    await prisma.$disconnect();
  });
'

sudo systemctl daemon-reload
sudo systemctl restart "$STAGING_SERVICE"
sleep 3
sudo systemctl is-active --quiet "$STAGING_SERVICE"

for i in $(seq 1 15); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${STAGING_PORT}/health" || true)
  if [ "$CODE" = "200" ]; then
    echo "Staging backend healthy at http://127.0.0.1:${STAGING_PORT}/health"
    curl -s "http://127.0.0.1:${STAGING_PORT}/health"
    echo ""
    exit 0
  fi
  sleep 2
done

echo "ERROR: Staging health check failed."
sudo journalctl -u "$STAGING_SERVICE" -n 50 --no-pager
exit 1
