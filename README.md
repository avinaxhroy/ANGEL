# ANGEL

> A simple way to watch Instagram Reels.

ANGEL is a browser extension that gives you more control over how you watch Instagram Reels. If you want to rotate a video, change its shape, zoom in, or watch in clean fullscreen without all the distracting comments and buttons, this extension is for you.

## What it does

- **Rotate videos**: Turn videos (90°, 180°, 270°) to fit your screen.
- **Resize videos**: Change video shapes (like 16:9 widescreen, square 1:1, or stretch to fill).
- **Theater mode**: Dims the comments and menus so you can focus on the video, but still lets you scroll to the next one.
- **Clean fullscreen**: Hides all of Instagram's buttons and text so you only see the video.
- **Download videos & photos**: Save Reels, photos, or carousels with clean filenames that include the creator's name and date.
- **Zoom and move**: Use your mouse wheel or the slider to zoom in and drag the video around to see details.
- **Control panel**: A small menu appears in the top-right corner when you move your mouse there. You can drag it anywhere you want.
- **No tracking**: We don't collect data, run ads, or talk to external servers. Everything happens on your device.

---

## Keyboard Controls

You can press these keys on your keyboard while watching a Reel:

| Key | Action |
|-----|--------|
| `R` | Rotate right (90 degrees) |
| `L` | Rotate left (-90 degrees) |
| `T` | Turn Theater Mode on/off |
| `F` | Turn Fullscreen on/off |
| `A` | Cycle through video shapes (aspect ratios) |
| `=` | Zoom in |
| `-` | Zoom out |
| `Shift + Scroll` | Zoom in/out with your mouse wheel |
| `Esc` | Reset the video back to normal |
| `X` | Like or unlike the video |
| `.` | Download the video or image |

---

## How to install it

### On Chrome, Edge, or Brave
1. Download or clone this repository to your computer.
2. Open your browser and go to your extensions page:
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
   - **Brave**: `brave://extensions`
3. Turn on the **Developer mode** switch (usually in the top-right corner).
4. Click the **Load unpacked** button.
5. Select the `ANGEL` folder you downloaded.

### On Firefox
1. Download or clone this repository to your computer.
2. Open Firefox and go to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**.
4. Select the `manifest.json` file inside the `ANGEL` folder.
   *(Note: Firefox removes temporary extensions when you close the browser.)*

---

## How to use it

1. Go to Instagram Reels (`instagram.com/reels/`).
2. Move your mouse to the top-right corner of the page. A floating control panel will slide out. It hides itself after 3 seconds when you move your mouse away.
3. Click the buttons on the panel, or use the keyboard shortcuts listed above.
4. Click the extension icon in your browser toolbar to customize how saved files are named.

---

## Troubleshooting

### The control panel isn't showing up
- Make sure you are on `instagram.com/reels/` or a specific Reel page.
- Try refreshing the page.
- Move your mouse to the far right edge of the screen—the panel hides itself when you aren't using it.

### Keyboard keys aren't working
- Click on the page or the video first. The browser needs you to click the page to know you are interacting with it.

### The video or layout looks strange
- Press the `Esc` key on your keyboard. This resets all zoom, rotation, and resizing.

---

## Security & Privacy

ANGEL only requests permission to run on `instagram.com`. It cannot see your other tabs, your browsing history, cookies, or any other website. It does not collect any data or make external web requests.

---

## License

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
