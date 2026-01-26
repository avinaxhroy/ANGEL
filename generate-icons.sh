#!/bin/bash
# Script to generate PNG icons from SVG
# Requires: ImageMagick (convert) or Inkscape

SVG_FILE="icons/icon.svg"

# Using ImageMagick
if command -v convert &> /dev/null; then
    echo "Using ImageMagick to generate icons..."
    convert -background none -resize 16x16 "$SVG_FILE" icons/icon16.png
    convert -background none -resize 32x32 "$SVG_FILE" icons/icon32.png
    convert -background none -resize 48x48 "$SVG_FILE" icons/icon48.png
    convert -background none -resize 128x128 "$SVG_FILE" icons/icon128.png
    echo "Icons generated successfully!"
    exit 0
fi

# Using Inkscape
if command -v inkscape &> /dev/null; then
    echo "Using Inkscape to generate icons..."
    inkscape "$SVG_FILE" -w 16 -h 16 -o icons/icon16.png
    inkscape "$SVG_FILE" -w 32 -h 32 -o icons/icon32.png
    inkscape "$SVG_FILE" -w 48 -h 48 -o icons/icon48.png
    inkscape "$SVG_FILE" -w 128 -h 128 -o icons/icon128.png
    echo "Icons generated successfully!"
    exit 0
fi

# Using rsvg-convert (librsvg)
if command -v rsvg-convert &> /dev/null; then
    echo "Using rsvg-convert to generate icons..."
    rsvg-convert -w 16 -h 16 "$SVG_FILE" -o icons/icon16.png
    rsvg-convert -w 32 -h 32 "$SVG_FILE" -o icons/icon32.png
    rsvg-convert -w 48 -h 48 "$SVG_FILE" -o icons/icon48.png
    rsvg-convert -w 128 -h 128 "$SVG_FILE" -o icons/icon128.png
    echo "Icons generated successfully!"
    exit 0
fi

echo "Error: No suitable image converter found."
echo "Please install one of: ImageMagick, Inkscape, or librsvg"
echo ""
echo "On macOS: brew install imagemagick"
echo "On Ubuntu: sudo apt install imagemagick"
exit 1
