#!/bin/sh
# Stop a preview or staging job before it can reach production. A preview once
# read and wrote the production Firestore. See issue #46.
#
#   PROJECT_ID=<staging project ID> scripts/check-not-production.sh
#
# Run it after the web-client build, which bakes the project ID into dist/.
set -eu

PRODUCTION=hanlearn-dd14f

if [ -z "${PROJECT_ID:-}" ] || [ "$PROJECT_ID" = "$PRODUCTION" ]; then
  echo "::error::STAGING_FIREBASE_PROJECT_ID is empty or names the production project"
  exit 1
fi
if grep -rqF "$PRODUCTION" web-client/dist; then
  echo "::error::The build holds the production project ID"
  exit 1
fi
