#!/bin/sh
# ====================================================================================
# Entrypoint Script
# Runs on every container start: migrations + first-time seeding
# ====================================================================================

# Exit on any error
set -e

# Set the path for a flag file that will be created in your persistent storage.
# This ensures it survives restarts and redeployments.
SETUP_COMPLETE_FLAG="/app/prisma/data/.setup_complete"
DB_FILE="/app/prisma/data/prod.db"

# Ensure the data directory exists
echo "--> ENTRYPOINT: Ensuring data directory exists..."
mkdir -p /app/prisma/data

# Run database migrations on every startup (safe and idempotent)
echo "--> ENTRYPOINT: Running database migrations..."
MIGRATE_OUTPUT=$(npx prisma migrate deploy 2>&1) || MIGRATE_FAILED=true

if [ "$MIGRATE_FAILED" = "true" ]; then
  echo "$MIGRATE_OUTPUT"
  # Check if it's a failed migration error (P3009)
  if echo "$MIGRATE_OUTPUT" | grep -q "P3009"; then
    echo "--> ENTRYPOINT: Detected failed migration state. Resetting database..."
    rm -f "$DB_FILE" "$DB_FILE-journal" "$SETUP_COMPLETE_FLAG"
    echo "--> ENTRYPOINT: Retrying migrations with fresh database..."
    npx prisma migrate deploy
  else
    echo "--> ENTRYPOINT: Migration failed with unknown error. Exiting."
    exit 1
  fi
else
  echo "$MIGRATE_OUTPUT"
fi

# Check if the setup flag file exists
if [ ! -f "$SETUP_COMPLETE_FLAG" ]; then
  # If the flag file does NOT exist, this is the first run
  echo "--> ENTRYPOINT: First time setup detected. Seeding the database..."
  tsx prisma/seed.ts

  # Create the flag file to prevent this block from running again
  echo "--> ENTRYPOINT: Seeding complete. Creating .setup_complete flag."
  touch "$SETUP_COMPLETE_FLAG"
else
  # If the flag file exists, skip the seed
  # But if admin env vars are set, ensure the admin user exists (idempotent)
  if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
    echo "--> ENTRYPOINT: Ensuring admin user exists..."
    tsx prisma/seed.ts
  fi
  echo "--> ENTRYPOINT: Database already seeded. Skipping."
fi

# Hand off control to the main container command (npm run start)
echo "--> ENTRYPOINT: Starting application..."
exec "$@"
