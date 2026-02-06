/**
 * ANGEL - Popup Script
 * Handles popup UI logic and status display
 */

(function () {
  'use strict';

  /**
   * Update the status display in the popup
   */
  async function updateStatus() {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab && tab.url) {
        const isInstagram = tab.url.includes('instagram.com');
        const isReels = tab.url.includes('/reels/') || tab.url.includes('/reel/');

        if (isReels) {
          statusDot.classList.remove('inactive');
          statusText.textContent = 'Active on Instagram Reels';
        } else if (isInstagram) {
          statusDot.classList.add('inactive');
          statusText.textContent = 'On Instagram (navigate to Reels)';
        } else {
          statusDot.classList.add('inactive');
          statusText.textContent = 'Navigate to Instagram Reels';
        }
      } else {
        statusDot.classList.add('inactive');
        statusText.textContent = 'Navigate to Instagram Reels';
      }
    } catch (error) {
      console.error('Error updating status:', error);
      statusDot.classList.add('inactive');
      statusText.textContent = 'Unable to check status';
    }
  }

  /**
   * Display the extension version from manifest
   */
  function displayVersion() {
    const versionElement = document.getElementById('version-text');
    if (versionElement) {
      const manifest = chrome.runtime.getManifest();
      versionElement.textContent = `Version ${manifest.version}`;
    }
  }

  // Configuration mirrored from content.js
  const KEYBOARD_CONFIG = {
    ROTATE_CW: 'r',
    ROTATE_CCW: 'l',
    FULLSCREEN: 'f',
    THEATER: 't',
    RESET: 'escape',
    ZOOM_IN: '=',
    ZOOM_OUT: '-',
    ASPECT_CYCLE: 'a',
    HD_TOGGLE: 'h',
    SPEED_SLOW: '[',
    SPEED_FAST: ']',
    SAVE: 's'
  };

  const SHORTCUTS_DISPLAY = [
    { label: 'Rotate', keys: [KEYBOARD_CONFIG.ROTATE_CW, KEYBOARD_CONFIG.ROTATE_CCW] },
    { label: 'Theater', keys: [KEYBOARD_CONFIG.THEATER] },
    { label: 'Fullscreen', keys: [KEYBOARD_CONFIG.FULLSCREEN] },
    { label: 'Aspect', keys: [KEYBOARD_CONFIG.ASPECT_CYCLE] },
    { label: 'Zoom', keys: [KEYBOARD_CONFIG.ZOOM_IN, KEYBOARD_CONFIG.ZOOM_OUT] },
    { label: 'Speed', keys: [KEYBOARD_CONFIG.SPEED_SLOW, KEYBOARD_CONFIG.SPEED_FAST] },
    { label: 'HD Mode', keys: [KEYBOARD_CONFIG.HD_TOGGLE] },
    { label: 'Like', keys: ['X'] },
    { label: 'Save', keys: [KEYBOARD_CONFIG.SAVE] },
    { label: 'Mute/Unmute', keys: ['M'] },
    { label: 'Play/Pause', keys: ['Space'] },
    { label: 'Reset', keys: ['Esc'] } // Visual override for Escape
  ];

  /**
   * Render shortcuts grid dynamically
   */
  function renderShortcuts() {
    const grid = document.getElementById('shortcuts-grid');
    if (!grid) return;

    grid.innerHTML = SHORTCUTS_DISPLAY.map(item => {
      const keysHtml = item.keys.map(k => {
        // Map common symbols to friendlier display chars if needed
        let displayKey = k.toUpperCase();
        if (k === '=') displayKey = '+';
        if (k === '-') displayKey = '-';
        return `<span class="key">${displayKey}</span>`;
      }).join('');

      return `
        <div class="item">
          <span class="action">${item.label}</span>
          <div>${keysHtml}</div>
        </div>
      `;
    }).join('');
  }

  // Initialize popup
  document.addEventListener('DOMContentLoaded', () => {
    updateStatus();
    displayVersion();
    renderShortcuts();
  });
})();

