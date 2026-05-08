#!/bin/sh

# Patch react-native-image-viewing (missing platform fallback)
cp node_modules/react-native-image-viewing/dist/components/ImageItem/ImageItem.ios.js \
   node_modules/react-native-image-viewing/dist/components/ImageItem/ImageItem.js 2>/dev/null
cp node_modules/react-native-image-viewing/dist/components/ImageItem/ImageItem.ios.d.ts \
   node_modules/react-native-image-viewing/dist/components/ImageItem/ImageItem.d.ts 2>/dev/null

exec "$@"
