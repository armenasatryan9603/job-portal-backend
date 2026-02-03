#!/bin/bash

# Script to apply Prisma migrations to NeonDB
# Usage: ./scripts/apply-migration.sh

set -e

echo "🚀 Applying Prisma migrations to NeonDB..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable is not set"
    echo "Please set it in your .env file or export it before running this script"
    exit 1
fi

# Navigate to backend directory
cd "$(dirname "$0")/.."

# Apply migrations
echo "📦 Running Prisma migrate deploy..."
npx prisma migrate deploy

# Regenerate Prisma Client
echo "🔄 Regenerating Prisma Client..."
npx prisma generate

echo "✅ Migration applied successfully!"
echo ""
echo "Next steps:"
echo "1. Verify the migration was applied: Check your NeonDB dashboard"
echo "2. Restart your backend server to use the updated Prisma Client"
echo "3. Test the card binding functionality"
