#!/bin/bash

# =====================================================
# ANGEL Chrome Extension Build Script
# Creates a production-ready .zip for Chrome Web Store
# =====================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory (project root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Get version from manifest.json
VERSION=$(grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)
BUILD_DIR="$SCRIPT_DIR/build"
ZIP_NAME="ANGEL-v${VERSION}.zip"
OUTPUT_PATH="$BUILD_DIR/$ZIP_NAME"

echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     ANGEL Chrome Extension Build Script          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Version:${NC} $VERSION"
echo ""

# Files and directories to include in the extension
INCLUDE_FILES=(
    "manifest.json"
    "content.js"
    "popup.html"
    "popup.js"
    "styles.css"
    "hd-video-interceptor.js"
    "icons"
)

# Create build directory
echo -e "${BLUE}→${NC} Creating build directory..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Create a temporary directory for packaging
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo -e "${BLUE}→${NC} Copying extension files..."

# Copy all required files
for item in "${INCLUDE_FILES[@]}"; do
    if [ -e "$item" ]; then
        cp -r "$item" "$TEMP_DIR/"
        echo -e "   ${GREEN}✓${NC} $item"
    else
        echo -e "   ${RED}✗${NC} $item (not found)"
        exit 1
    fi
done

# Remove any .DS_Store files (macOS junk)
find "$TEMP_DIR" -name ".DS_Store" -delete 2>/dev/null || true

# Create the zip file
echo ""
echo -e "${BLUE}→${NC} Creating zip archive..."
cd "$TEMP_DIR"
zip -r -q "$OUTPUT_PATH" ./*

# Get file size
FILE_SIZE=$(ls -lh "$OUTPUT_PATH" | awk '{print $5}')

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║               Build Complete! ✓                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Output:${NC} $OUTPUT_PATH"
echo -e "${YELLOW}Size:${NC}   $FILE_SIZE"
echo ""
echo -e "${BLUE}Contents:${NC}"
unzip -l "$OUTPUT_PATH" | tail -n +4 | head -n -2 | awk '{print "   " $4}'
echo ""
echo -e "${GREEN}Ready for Chrome Web Store upload! 🚀${NC}"
