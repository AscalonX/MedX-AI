#!/bin/sh
# PNG exports for the MedX logo system (run from repo root after build.py). Uses headless Chrome.
set -e
L="$PWD/docs/design/logo"
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP="$(mktemp -d)"
shot() { # svg size out [bg]
  printf '<!doctype html><body style="margin:0;background:%s"><img src="%s" style="display:block;width:%spx;height:%spx">' "${4:-transparent}" "$1" "$2" "$2" > "$TMP/p.html"
  "$C" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --default-background-color=00000000 \
    --force-device-scale-factor=1 --window-size="$2,$2" --screenshot="$3" "file://$TMP/p.html" >/dev/null 2>&1
}
shot "$L/app-icon.svg" 1024 "$L/app-icon-1024.png"
shot "$L/favicon.svg" 32 "$L/favicon-32.png"
shot "$L/favicon.svg" 16 "$L/favicon-16.png"
shot "$L/app-icon.svg" 180 "$L/apple-touch-icon-180.png"
for s in 16 32 64 256; do shot "$L/mark-color.svg" $s "$L/mark-color-$s.png"; done
shot "$L/mark-white.svg" 256 "$L/mark-white-256.png"
"$C" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --force-device-scale-factor=1 \
  --window-size=1280,640 --virtual-time-budget=4000 --screenshot="$L/readme-banner.png" "file://$L/readme-banner.html" >/dev/null 2>&1
magick "$L/favicon-16.png" "$L/favicon-32.png" "$PWD/apps/web/app/favicon.ico"
cp "$L/apple-touch-icon-180.png" "$PWD/apps/web/app/apple-icon.png"
rm -rf "$TMP"
echo ok
