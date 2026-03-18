#!/bin/bash
set -e

APP_NAME="todododo"
APP_SRC="release/mac-arm64/${APP_NAME}.app"
APP_DEST="/Applications/${APP_NAME}.app"

if [ ! -d "$APP_SRC" ]; then
  echo "Build not found at $APP_SRC"
  exit 1
fi

echo "Quitting ${APP_NAME}..."
osascript -e "quit app \"${APP_NAME}\"" 2>/dev/null || true
sleep 2

echo "Removing old app..."
rm -rf "$APP_DEST"

echo "Installing new app..."
cp -R "$APP_SRC" "$APP_DEST"

echo "Clearing quarantine flag..."
xattr -cr "$APP_DEST" 2>/dev/null || true

echo "Launching ${APP_NAME}..."
open "$APP_DEST"

echo "Done."
