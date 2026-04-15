#!/bin/sh
set -e

echo "Running Prisma migrations..."
node ./node_modules/prisma/build/index.js migrate deploy

echo "Seeding database..."
node ./node_modules/tsx/dist/cli.mjs prisma/seed.ts || echo "Seed already applied or skipped"

echo "Starting server..."
exec node server.js
