#!/bin/sh
set -e

echo "🔍 Installing Chrome..."
npx puppeteer browsers install chrome
echo "✅ Chrome installed"

echo "🚀 Starting server..."
exec node dist/server.js
