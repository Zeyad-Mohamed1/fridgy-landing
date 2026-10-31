#!/bin/sh
# Server update: pull, build static site in a throwaway node container, publish to /var/www/fridgy-landing
set -e
cd "$(dirname "$0")"
git pull --ff-only
docker run --rm -v "$PWD":/w -w /w -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 node:22-alpine \
  sh -c "corepack enable && pnpm install --frozen-lockfile && pnpm build"
mkdir -p /var/www/fridgy-landing
rm -rf /var/www/fridgy-landing.new && cp -a dist /var/www/fridgy-landing.new
rm -rf /var/www/fridgy-landing.old
mv /var/www/fridgy-landing /var/www/fridgy-landing.old
mv /var/www/fridgy-landing.new /var/www/fridgy-landing
rm -rf /var/www/fridgy-landing.old
echo "Deployed $(git rev-parse --short HEAD)"
