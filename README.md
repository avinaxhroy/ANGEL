# ANGEL 🔄

> **A Natural Experience for Looking**

A lightweight, privacy-friendly browser extension that enhances Instagram Reels viewing with smart rotation, aspect ratio controls, theater mode, and true fullscreen.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Privacy](https://img.shields.io/badge/privacy-no%20data%20collection-brightgreen)

## ✨ Features

- **🔄 Smart Rotation** - Rotate videos 90°/180°/270° with automatic scaling for landscape viewing
- **📐 Aspect Ratio Controls** - Choose from Original, 9:16, 16:9, 4:3, 1:1, Fit, Fill, or Stretch
- **🎬 Theater Mode** - Cinematic viewing that dims UI while keeping scroll functionality
- **⛶ True Fullscreen** - Browser-native fullscreen without Instagram's UI clutter
- **🔍 Smooth Zoom & Pan** - Zoom in/out with mouse wheel or buttons, pan to focus on content
- **⌨️ Keyboard Shortcuts** - Full keyboard control for power users
- **✨ SPA-Aware** - Automatically re-initializes when scrolling through reels
- **🎯 Smart Centering** - Keeps content centered without cropping important areas
- **🔒 Privacy-First** - Zero data collection, no external requests

## 🎮 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `R` | Rotate clockwise (90°) |
| `L` | Rotate counter-clockwise (-90°) |
| `T` | Toggle Theater Mode |
| `F` | Toggle Fullscreen |
| `A` | Cycle through aspect ratios |
| `=` | Zoom in |
| `-` | Zoom out |
| `Shift + Scroll` | Zoom with mouse wheel |
| `Esc` | Reset all transforms |

## 📐 Aspect Ratio Modes

| Mode | Description |
|------|-------------|
| **Original** | Keep the video's native aspect ratio |
| **9:16** | Portrait mode (standard Reels) |
| **16:9** | Widescreen landscape |
| **4:3** | Classic TV ratio |
| **1:1** | Square format |
| **Fit** | Scale to fit within container |
| **Fill** | Scale to fill container (may crop edges) |
| **Stretch** | Stretch to fill (distorts aspect ratio) |

## 📦 Installation

### Chrome / Edge / Brave (Chromium browsers)

1. Download or clone this repository
2. Open your browser and navigate to:
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
   - **Brave**: `brave://extensions`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `ANGEL` folder
6. The extension icon should appear in your toolbar

### Firefox

1. Download or clone this repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select the `manifest.json` file from the `ANGEL` folder

> ⚠️ Note: Firefox temporary extensions are removed when the browser closes. For permanent installation, the extension needs to be signed by Mozilla.

## 🖥️ Usage

1. Navigate to Instagram Reels (`instagram.com/reels/`)
2. A floating control panel appears in the top-right corner (auto-hides after 3s)
3. Hover over the panel to reveal controls, or use keyboard shortcuts
4. **Theater Mode (`T`)**: Dims surrounding UI for focused viewing while keeping scroll
5. **Fullscreen (`F`)**: True browser fullscreen for immersive experience
6. **Rotate (`R`/`L`)**: Perfect for landscape videos on portrait phones or vice versa
7. **Aspect Ratio (`A`)**: Cycle through modes to find the best fit for your screen
8. The control panel is draggable - position it wherever you like!

## 🎬 View Modes Explained

### Theater Mode
- Dims Instagram's UI (header, sidebar, comments)
- Elevates the video for focused viewing
- **Scrolling still works** - navigate between reels naturally
- UI elements become visible on hover
- Perfect for browsing while minimizing distractions

### Fullscreen Mode
- Uses native Browser Fullscreen API
- Completely hides all Instagram UI
- Best for watching a single reel in immersive mode
- Press `Esc` or `F` to exit

## 🎯 Use Cases

- **Portrait videos on landscape monitors** - Rotate 90° and use Fill/Fit aspect ratio
- **Ultrawide monitor viewing** - Maximize video with 16:9 or Fill mode
- **Distraction-free browsing** - Theater mode hides UI while you scroll through reels
- **Immersive single-reel viewing** - True fullscreen for the best experience
- **Content creators** - Preview how rotated/cropped content looks
- **Accessibility** - Zoom in on content for better visibility

## 🔧 Technical Details

### How It Works

- **Content Script Injection** - Injects rotation controls via CSS/JS
- **IntersectionObserver** - Efficiently detects which video is currently visible
- **MutationObserver** - Detects new videos during SPA navigation
- **CSS Transforms** - Hardware-accelerated rotation, scaling, and translation
- **Fullscreen API** - Native browser fullscreen for best performance
- **Smart Scaling** - Calculates optimal scale based on rotation and aspect ratio

### Permissions

This extension requires minimal permissions:

| Permission | Purpose |
|------------|---------|
| `host_permissions: instagram.com` | Access Instagram pages to inject controls |

**No permissions for:**
- ❌ Browsing history
- ❌ Cookies
- ❌ Storage
- ❌ Network requests
- ❌ Other websites

### File Structure

```
ANGEL/
├── manifest.json      # Extension manifest (Manifest V3)
├── content.js         # Main content script (rotation, zoom, modes)
├── styles.css         # UI styles, theater mode, animations
├── popup.html         # Extension popup UI
├── popup.js           # Popup logic
├── icons/             # Extension icons
│   ├── icon.svg       # Source SVG
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## 🛡️ Privacy

**ANGEL is 100% privacy-friendly:**

- ✅ No data collection
- ✅ No analytics or tracking
- ✅ No external network requests
- ✅ No user accounts required
- ✅ All processing happens locally in your browser
- ✅ Open source - audit the code yourself!

## 🐛 Troubleshooting

### Controls not appearing?

1. Make sure you're on `instagram.com/reels/` or a specific reel URL
2. Try refreshing the page
3. Check if the extension is enabled in your browser's extension settings
4. The panel auto-hides after 3 seconds - move your mouse to the right edge

### Rotation not working?

1. Ensure the video has loaded and is playing
2. Click on the video first to focus it
3. Try using the on-screen buttons instead of keyboard shortcuts

### Theater mode not hiding UI?

1. Instagram frequently updates their class names
2. Theater mode dims UI elements, hover over them to reveal
3. Try combining with zoom for better viewing

### Fullscreen issues?

1. Some browsers require a user gesture (click) before allowing fullscreen
2. Disable any other fullscreen extensions that might conflict
3. Try the keyboard shortcut `F` while hovering over the video

### Zoom not responding to scroll?

1. Make sure to hold `Shift` while scrolling
2. Your cursor should be over the Instagram page
3. Use the slider in the control panel as an alternative

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see below:

```
MIT License

Copyright (c) 2026 ANGEL

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🗺️ Roadmap

- [ ] Save preferences per-reel or globally
- [ ] Custom keyboard shortcut configuration
- [ ] Picture-in-Picture mode support
- [ ] Video speed controls
- [ ] Firefox Add-on Store release

## ⭐ Support

If you find this extension useful, please consider:
- Starring the repository ⭐
- Sharing with friends who watch Instagram Reels
- Reporting bugs or suggesting features

---

**Made with ❤️ for a better Instagram Reels experience**
