/**
 * ANGEL - Popup Script
 * Handles popup UI logic, tabs, shortcuts, and download settings.
 */

(function () {
  'use strict';

  const ICONS = {
    rotate: '<svg viewBox="0 0 24 24"><path d="M7.11 8.53L5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72 1.02-2.47zM6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.87-1.59-1.01-2.47zm1.01 5.32c1.16.9 2.51 1.44 3.9 1.61V17.9c-.87-.15-1.71-.49-2.46-1.03L7.1 18.32zM13 4.07V1L8.45 5.55 13 10V6.09c2.84.48 5 2.94 5 5.91s-2.16 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93s-3.05-7.44-7-7.93z"/></svg>',
    theater: '<svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM8 10h8v4H8z"/></svg>',
    fullscreen: '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
    aspect: '<svg viewBox="0 0 24 24"><path d="M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z"/></svg>',
    zoom: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
    speed: '<svg viewBox="0 0 24 24"><path d="M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z"/></svg>',
    hd: '<svg viewBox="0 0 24 24"><path d="M21 3H3c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9 8h2v8H9zm4 0h2v8h-2z"/></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>',
    like: '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    reset: '<svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>'
  };

  const KEYBOARD_CONFIG = ANGEL_KEYBOARD;
  const DOWNLOAD_CONFIG = ANGEL_DOWNLOAD_SETTINGS || {
    DEFAULT_TEMPLATE: 'angel_{username}_{shortcode}_{type}_{quality}{index}',
    STORAGE_KEYS: {
      TEMPLATE: 'angel_downloadTemplate',
      CAROUSEL_INDEX: 'angel_downloadCarouselIndex',
      SAVE_AS: 'angel_downloadSaveAs'
    },
    SUPPORTED_TAGS: ['username', 'shortcode', 'type', 'quality', 'index', 'date']
  };

  function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function getIcon(name) {
    return ICONS[name] || '';
  }

  function showSavedIndicator() {
    const indicator = document.getElementById('saved-indicator');
    if (!indicator) return;
    
    indicator.classList.add('show');
    setTimeout(() => {
      indicator.classList.remove('show');
    }, 2000);
  }

  async function updateStatus() {
    const statusCard = document.getElementById('status-card');
    const statusText = document.getElementById('status-text');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab && tab.url) {
        const isInstagram = tab.url.includes('instagram.com');
        const isReels = tab.url.includes('/reels/') || tab.url.includes('/reel/');

        if (isReels) {
          statusCard.classList.remove('inactive');
          statusText.textContent = 'Active on Instagram Reels';
        } else if (isInstagram) {
          statusCard.classList.add('inactive');
          statusText.textContent = 'Navigate to a Reels video';
        } else {
          statusCard.classList.add('inactive');
          statusText.textContent = 'Open Instagram Reels to activate';
        }
      } else {
        statusCard.classList.add('inactive');
        statusText.textContent = 'Unable to detect page';
      }
    } catch (error) {
      console.error('Error updating status:', error);
      statusCard.classList.add('inactive');
      statusText.textContent = 'Error checking status';
    }
  }

  function displayVersion() {
    const versionElement = document.getElementById('version-text');
    if (versionElement) {
      versionElement.textContent = chrome.runtime.getManifest().version;
    }
  }

  function getDownloadShortcutKeys() {
    if (KEYBOARD_CONFIG.DOWNLOAD_MODIFIER === 'shift') {
      return ['Shift', KEYBOARD_CONFIG.DOWNLOAD];
    }
    if (KEYBOARD_CONFIG.DOWNLOAD_MODIFIER === 'alt') {
      return ['Alt', KEYBOARD_CONFIG.DOWNLOAD];
    }
    if (KEYBOARD_CONFIG.DOWNLOAD_MODIFIER) {
      return ['Cmd/Ctrl', KEYBOARD_CONFIG.DOWNLOAD];
    }
    return [KEYBOARD_CONFIG.DOWNLOAD];
  }

  const SHORTCUTS_DISPLAY = [
    { label: 'Rotate', keys: [KEYBOARD_CONFIG.ROTATE_CW, KEYBOARD_CONFIG.ROTATE_CCW], icon: 'rotate' },
    { label: 'Theater', keys: [KEYBOARD_CONFIG.THEATER], icon: 'theater' },
    { label: 'Fullscreen', keys: [KEYBOARD_CONFIG.FULLSCREEN], icon: 'fullscreen' },
    { label: 'Aspect', keys: [KEYBOARD_CONFIG.ASPECT_CYCLE], icon: 'aspect' },
    { label: 'Zoom', keys: [KEYBOARD_CONFIG.ZOOM_IN, KEYBOARD_CONFIG.ZOOM_OUT], icon: 'zoom' },
    { label: 'Speed', keys: [KEYBOARD_CONFIG.SPEED_SLOW, KEYBOARD_CONFIG.SPEED_FAST], icon: 'speed' },
    { label: 'HD Mode', keys: [KEYBOARD_CONFIG.HD_TOGGLE], icon: 'hd' },
    { label: 'Download', keys: getDownloadShortcutKeys(), icon: 'download' },
    { label: 'Like', keys: ['X'], icon: 'like' },
    { label: 'Save', keys: [KEYBOARD_CONFIG.SAVE], icon: 'save' },
    { label: 'Mute', keys: [KEYBOARD_CONFIG.MUTE], icon: 'mute' },
    { label: 'Play/Pause', keys: ['Space'], icon: 'play' },
  ];

  function renderShortcuts() {
    const grid = document.getElementById('shortcuts-grid');
    if (!grid) return;

    grid.innerHTML = SHORTCUTS_DISPLAY.map(item => {
      const keysHtml = item.keys.map((k, i) => {
        let displayKey = k.toUpperCase();
        if (k === '=') displayKey = '+';
        if (k === '-') displayKey = '-';
        const separator = i < item.keys.length - 1 ? '<span class="key-separator">·</span>' : '';
        return `<span class="key">${displayKey}</span>${separator}`;
      }).join('');

      return `
        <div class="shortcut-item" role="listitem">
          <div class="shortcut-info">
            <span class="shortcut-icon" aria-hidden="true">${getIcon(item.icon)}</span>
            <span class="shortcut-label">${item.label}</span>
          </div>
          <div class="shortcut-keys" aria-label="Keyboard shortcut">${keysHtml}</div>
        </div>
      `;
    }).join('');
  }

  function renderFeatures() {
    const grid = document.querySelector('#features-tab .features-grid');
    if (!grid) return;

    const features = [
      { label: 'HD Mode', icon: 'hd' },
      { label: 'Rotate', icon: 'rotate' },
      { label: 'Theater', icon: 'theater' },
      { label: 'Download', icon: 'download' },
      { label: 'Zoom', icon: 'zoom' },
      { label: 'Aspect', icon: 'aspect' },
      { label: 'Speed', icon: 'speed' },
      { label: 'Fullscreen', icon: 'fullscreen' },
    ];

    grid.innerHTML = features.map(feature => `
      <div class="feature-card" role="listitem">
        <div class="feature-icon-wrap">
          <svg class="feature-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="${getIconPath(feature.icon)}"/>
          </svg>
        </div>
        <span class="feature-label">${feature.label}</span>
      </div>
    `).join('');
  }

  function getIconPath(iconName) {
    const paths = {
      hd: 'M21 3H3c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9 8h2v8H9zm4 0h2v8h-2z',
      rotate: 'M7.11 8.53L5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72 1.02-2.47zM6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.87-1.59-1.01-2.47zm1.01 5.32c1.16.9 2.51 1.44 3.9 1.61V17.9c-.87-.15-1.71-.49-2.46-1.03L7.1 18.32zM13 4.07V1L8.45 5.55 13 10V6.09c2.84.48 5 2.94 5 5.91s-2.16 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93s-3.05-7.44-7-7.93z',
      theater: 'M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM8 10h8v4H8z',
      download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
      zoom: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
      aspect: 'M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z',
      speed: 'M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z',
      fullscreen: 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z'
    };
    return paths[iconName] || '';
  }

  function renderSupportedTags() {
    const tagsEl = document.getElementById('download-template-tags');
    if (!tagsEl) return;

    tagsEl.textContent = `Supported: ${DOWNLOAD_CONFIG.SUPPORTED_TAGS.map(tag => `{${tag}}`).join(' ')}`;
  }

  function updateTemplatePreview(templateValue) {
    const previewEl = document.getElementById('download-template-preview');
    if (!previewEl) return;

    const template = (templateValue || '').trim() || DOWNLOAD_CONFIG.DEFAULT_TEMPLATE;
    const previewName = template
      .replace(/\{username\}/g, 'creator')
      .replace(/\{shortcode\}/g, 'C0DE123')
      .replace(/\{type\}/g, 'reel')
      .replace(/\{quality\}/g, '1080x1920')
      .replace(/\{index\}/g, '_02')
      .replace(/\{date\}/g, '20260407_120000')
      .replace(/\{[^}]+\}/g, '')
      .replace(/[_-]{2,}/g, '_')
      .replace(/^[_-]+|[_-]+$/g, '');

    previewEl.textContent = `${previewName || 'angel_download'}.mp4`;
  }

  function saveDownloadSetting(key, value) {
    if (!chrome?.storage?.local) return;

    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving download setting:', chrome.runtime.lastError.message);
      } else {
        showSavedIndicator();
      }
    });
  }

  function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;

        // Update active tab
        tabs.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        // Update active content
        tabContents.forEach(content => {
          content.classList.remove('active');
        });
        document.getElementById(`${tabId}-tab`).classList.add('active');
      });
    });
  }

  function setupToggleAccessibility() {
    const toggleRows = document.querySelectorAll('.toggle-row');
    toggleRows.forEach(row => {
      const input = row.querySelector('input[type="checkbox"]');
      if (!input) return;

      row.addEventListener('click', (e) => {
        if (e.target !== input) {
          input.checked = !input.checked;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      row.setAttribute('aria-checked', input.checked);
      input.addEventListener('change', () => {
        row.setAttribute('aria-checked', input.checked);
      });
    });
  }

  function setupDownloadSettings() {
    const templateInput = document.getElementById('download-template');
    const carouselIndexToggle = document.getElementById('download-carousel-index');
    const saveAsToggle = document.getElementById('download-save-as');
    const resetButton = document.getElementById('download-template-reset');

    if (!templateInput || !carouselIndexToggle || !saveAsToggle || !resetButton) {
      return;
    }

    const persistTemplate = debounce(() => {
      const nextValue = templateInput.value.trim() || DOWNLOAD_CONFIG.DEFAULT_TEMPLATE;
      if (templateInput.value !== nextValue) {
        templateInput.value = nextValue;
      }
      saveDownloadSetting(DOWNLOAD_CONFIG.STORAGE_KEYS.TEMPLATE, nextValue);
      updateTemplatePreview(nextValue);
    }, 300);

    templateInput.addEventListener('input', () => {
      updateTemplatePreview(templateInput.value);
      persistTemplate();
    });

    carouselIndexToggle.addEventListener('change', () => {
      saveDownloadSetting(DOWNLOAD_CONFIG.STORAGE_KEYS.CAROUSEL_INDEX, carouselIndexToggle.checked);
    });

    saveAsToggle.addEventListener('change', () => {
      saveDownloadSetting(DOWNLOAD_CONFIG.STORAGE_KEYS.SAVE_AS, saveAsToggle.checked);
    });

    resetButton.addEventListener('click', () => {
      templateInput.value = DOWNLOAD_CONFIG.DEFAULT_TEMPLATE;
      updateTemplatePreview(DOWNLOAD_CONFIG.DEFAULT_TEMPLATE);
      saveDownloadSetting(DOWNLOAD_CONFIG.STORAGE_KEYS.TEMPLATE, DOWNLOAD_CONFIG.DEFAULT_TEMPLATE);
    });
  }

  function loadDownloadSettings() {
    const templateInput = document.getElementById('download-template');
    const carouselIndexToggle = document.getElementById('download-carousel-index');
    const saveAsToggle = document.getElementById('download-save-as');

    if (!templateInput || !carouselIndexToggle || !saveAsToggle || !chrome?.storage?.local) {
      return;
    }

    chrome.storage.local.get([
      DOWNLOAD_CONFIG.STORAGE_KEYS.TEMPLATE,
      DOWNLOAD_CONFIG.STORAGE_KEYS.CAROUSEL_INDEX,
      DOWNLOAD_CONFIG.STORAGE_KEYS.SAVE_AS
    ], (items) => {
      if (chrome.runtime.lastError) {
        console.error('Error loading download settings:', chrome.runtime.lastError.message);
        return;
      }

      const template = typeof items[DOWNLOAD_CONFIG.STORAGE_KEYS.TEMPLATE] === 'string' && items[DOWNLOAD_CONFIG.STORAGE_KEYS.TEMPLATE].trim()
        ? items[DOWNLOAD_CONFIG.STORAGE_KEYS.TEMPLATE].trim()
        : DOWNLOAD_CONFIG.DEFAULT_TEMPLATE;

      templateInput.value = template;
      carouselIndexToggle.checked = items[DOWNLOAD_CONFIG.STORAGE_KEYS.CAROUSEL_INDEX] !== false;
      saveAsToggle.checked = !!items[DOWNLOAD_CONFIG.STORAGE_KEYS.SAVE_AS];
      
      // Update aria-checked attributes
      const carouselRow = carouselIndexToggle.closest('.toggle-row');
      const saveAsRow = saveAsToggle.closest('.toggle-row');
      if (carouselRow) carouselRow.setAttribute('aria-checked', carouselIndexToggle.checked);
      if (saveAsRow) saveAsRow.setAttribute('aria-checked', saveAsToggle.checked);
      
      updateTemplatePreview(template);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateStatus();
    displayVersion();
    setupTabs();
    renderShortcuts();
    renderFeatures();
    renderSupportedTags();
    setupToggleAccessibility();
    setupDownloadSettings();
    loadDownloadSettings();
  });
})();
