/**
 * ANGEL v3.5 - Enhanced Instagram Reels Experience
 * 
 * Complete rewrite with proper architecture:
 * - CSS-only transforms (no DOM manipulation/lifting)
 * - Unified VideoController for state management
 * - Overlay mode for rotated/enhanced videos
 * - Proper scroll navigation in all modes
 * 
 * Features:
 * - Smart rotation (0°, 90°, 180°, 270°)
 * - Aspect ratio controls (Original, 9:16, 16:9, 4:3, 1:1, Fit, Fill, Stretch)
 * - Theater mode with dimmed background
 * - True fullscreen mode
 * - Smooth zoom and pan controls
 * - Keyboard shortcuts
 * - State persistence across reel navigation
 * 
 * Privacy-first: No tracking, no data collection, no API usage
 */

(function () {
  'use strict';

  // Prevent double initialization with health check
  if (window.__ANGEL_INITIALIZED__) {
    // Verify the extension is actually working
    if (typeof window.__ANGEL_HEALTH_CHECK__ === 'function' && window.__ANGEL_HEALTH_CHECK__()) {
      console.log('[ANGEL] Already initialized and healthy, skipping...');
      return;
    } else {
      console.warn('[ANGEL] Re-initializing due to health check failure');
      try {
        if (typeof window.__ANGEL_CLEANUP__ === 'function') {
          window.__ANGEL_CLEANUP__();
        }
      } catch (e) {
        console.error('[ANGEL] Cleanup failed:', e);
      }
    }
  }
  window.__ANGEL_INITIALIZED__ = true;

  // Health check function
  window.__ANGEL_HEALTH_CHECK__ = function () {
    try {
      return document.body != null && typeof GlobalState !== 'undefined';
    } catch (e) {
      return false;
    }
  };

  // ============================================
  // CONFIGURATION
  // ============================================
  const CONFIG = {
    VERSION: '3.6.2',

    ASPECT_RATIOS: {
      'original': { label: 'Original', icon: '○', value: null, type: 'geometry' },
      '9:16': { label: '9:16', icon: '▯', value: 9 / 16, type: 'geometry' },
      '16:9': { label: '16:9', icon: '▭', value: 16 / 9, type: 'geometry' },
      '4:3': { label: '4:3', icon: '□', value: 4 / 3, type: 'geometry' },
      '1:1': { label: '1:1', icon: '■', value: 1, type: 'geometry' },
      'fit': { label: 'Fit', icon: '⊡', value: 'fit', type: 'mode' },
      'fill': { label: 'Fill', icon: '⧈', value: 'fill', type: 'mode' },
      'stretch': { label: 'Stretch', icon: '↔', value: 'stretch', type: 'mode' }
    },

    // Keyboard shortcuts — single source of truth is shared-config.js
    KEYBOARD: ANGEL_KEYBOARD,

    ZOOM: {
      MIN: 0.5,
      MAX: 3.0,
      STEP: 0.1
    },

    PLAYBACK_SPEED: {
      MIN: 0.25,
      MAX: 2.0,
      STEP: 0.25,
      DEFAULT: 1.0,
      HOLD_SLOW: 0.5,
      HOLD_FAST: 2.0
    },

    DOWNLOAD: {
      DEFAULT_TEMPLATE: ANGEL_DOWNLOAD_SETTINGS?.DEFAULT_TEMPLATE || 'angel_{username}_{shortcode}_{type}_{quality}{index}',
      MAX_FILENAME_LENGTH: 180
    },

    UI_HIDE_DELAY: 3000,
    SCROLL_NAV_DEBOUNCE: 400,
    VIDEO_DETECT_DEBOUNCE: 300, // Increased from 100ms for better performance

    ANIMATIONS: {
      TRANSFORM_DURATION: 400, // ms for smooth transform transitions
      FADE_DURATION: 300, // ms for fade in/out
      ROTATION_DURATION: 400, // ms for rotation animation
      ZOOM_DURATION: 250, // ms for zoom transitions
      ASPECT_DURATION: 350 // ms for aspect ratio changes
    },

    SELECTORS: {
      CONTROL_PANEL: 'angel-ctrl',
      TOAST: 'angel-toast',
      OVERLAY: 'angel-overlay',
      BACKDROP: 'angel-backdrop',
      LOADER: 'angel-loader',
      HD_PROGRESS: 'angel-hd-progress'
    },

    ICONS: {
      LOGO: '<svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>',
      PLAY: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
      PAUSE: '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
      REWIND: '<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>',
      FORWARD: '<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>',
      VOLUME_HIGH: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
      VOLUME_LOW: '<svg viewBox="0 0 24 24"><path d="M7 9v6h4l5 5V4L7 9H3v6h4z"/></svg>',
      VOLUME_MUTE: '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>',
      ROTATE_CW: '<svg viewBox="0 0 24 24"><path d="M15.55 5.55L11 1v3.07C7.06 4.56 4 7.92 4 12s3.06 7.44 7 7.93v-2.02c-2.84-.48-5-2.94-5-5.91s2.16-5.43 5-5.91V10l4.55-4.45zM19.93 11c-.17-1.39-.72-2.73-1.62-3.89l-1.42 1.42c.54.75.88 1.6 1.02 2.47h2.02zM13 17.9v2.02c1.39-.17 2.74-.71 3.9-1.61l-1.44-1.44c-.75.54-1.59.89-2.46 1.03zm3.89-2.42l1.42 1.41c.9-1.16 1.45-2.5 1.62-3.89h-2.02c-.14.87-.48 1.72-1.02 2.48z"/></svg>',
      ROTATE_CCW: '<svg viewBox="0 0 24 24"><path d="M8.45 5.55L13 1v3.07c3.94.49 7 3.85 7 7.93s-3.06 7.44-7 7.93v-2.02c2.84-.48 5-2.94 5-5.91s-2.16-5.43-5-5.91V10l-4.55-4.45zM4.07 11c.17-1.39.72-2.73 1.62-3.89l1.42 1.42c-.54.75-.88 1.6-1.02 2.47H4.07zm7 8.95c-1.39-.17-2.74-.71-3.9-1.61l1.44-1.44c.75.54 1.59.89 2.46 1.03v2.02zm-3.89-2.42l-1.42 1.41c-.9-1.16-1.45-2.5-1.62-3.89h2.02c.14.87.48 1.72 1.02 2.48z"/></svg>',
      FULLSCREEN: '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
      FULLSCREEN_EXIT: '<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>',
      THEATER: '<svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM8 10h8v4H8z"/></svg>',
      HD: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-8 12H9.5v-2h-2v2H6V9h1.5v2.5h2V9H11v6zm2-6h4c.55 0 1 .45 1 1v4c0 .55-.45 1-1 1h-4V9zm1.5 4.5h2v-3h-2v3z"/></svg>',
      LIKE: '<svg viewBox="0 0 24 24"><path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 4.05 7.15 12 11.95C21.95 15.65 26 12.28 26 8.5 26 5.42 23.58 3 20.5 3c-1.74 0-3.41.81-4.5 2.09C14.91 3.81 13.24 3 11.5 3z"/></svg>',
      LIKE_ACTIVE: '<svg viewBox="0 0 24 24" fill="#ff4757"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
      COMMENT: '<svg viewBox="0 0 24 24"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>',
      SHARE: '<svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>',
      SAVE: '<svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/></svg>',
      SAVE_ACTIVE: '<svg viewBox="0 0 24 24" fill="#ffa502"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>',
      MINIMIZE: '<svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>',
      RESET: '<svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
      DOWNLOAD: '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>'
    }
  };

  const MEDIA_SURFACES = {
    STORY: 'story',
    HIGHLIGHT: 'highlight',
    REEL: 'reel',
    POST: 'post',
    TV: 'tv',
    MEDIA: 'media'
  };

  const ACTION_LABEL_PATTERNS = Object.freeze({
    like: [/^like$/i, /^unlike$/i, /^gefällt mir$/i, /^me gusta$/i, /^j'aime$/i, /^mi piace$/i],
    save: [/^save$/i, /^remove$/i, /^unsave$/i, /^guardar$/i, /^enregistrer$/i, /^speichern$/i, /^salva$/i],
    comment: [/^comment$/i, /^view comments$/i, /^comentar$/i, /^commenter$/i, /^kommentieren$/i],
    share: [/^share$/i, /^send$/i, /^share post$/i, /^compartir$/i, /^partager$/i, /^teilen$/i, /^condividi$/i],
    menu: [/^more options$/i, /^options$/i, /^more$/i, /^menu$/i, /^story options$/i]
  });

  // ============================================
  // GLOBAL STATE
  // ============================================
  const GlobalState = {
    // Transform settings (persist across reels)
    rotation: 0,
    zoom: 1,
    aspectRatio: 'original',
    panX: 0,
    panY: 0,

    // Mode flags
    isOverlayActive: false,
    isTheaterMode: false,
    isFullscreen: false,
    enhancedModeActive: false, // True once user activates any enhancement, stays true until ESC

    // Audio preferences (persist across reels)
    userMuted: null, // null = use video's default, true/false = user preference
    userVolume: null, // null = use video's default, 0-1 = user preference
    playbackSpeed: 1.0, // User's playback speed preference (persists across reels)
    isHoldingSpeedKey: false, // True when holding [ or ] for temporary speed change
    previousSpeed: 1.0, // Speed to return to when releasing hold key
    downloadFilenameTemplate: CONFIG.DOWNLOAD.DEFAULT_TEMPLATE,
    downloadCarouselIndex: true,
    downloadSaveAs: false,

    // Current video reference
    currentVideo: null,
    currentVideoSrc: null,
    lastViewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },

    // CSS-rendered video size captured at overlay activation (before any transform).
    // Used as the scale divisor so zoom is resolution-independent (same result for
    // 1080p, 1440p, 4K source videos).
    videoNaturalW: 0,
    videoNaturalH: 0,

    // Cached elements
    backdrop: null,
    overlay: null,
    controlPanel: null,

    // Timers
    hideTimer: null,
    scrollNavTimeout: null,
    reelNavigationInProgress: false,

    // Observers
    mutationObserver: null,
    resizeObserver: null,
    intersectionObserver: null,

    // HD Video settings
    hdMode: true, // HD mode enabled by default
    hdVideoMap: new Map(), // Maps video URL keys to HD URLs
    hdVideoList: [], // Recent HD URLs emitted by the page-context interceptor
    currentVideoQuality: null, // { width, height } of current video
    hdAppliedToCurrentVideo: false, // Whether HD was applied to current video
    hdLoading: false, // Whether HD is currently loading
    preferredQuality: 'auto', // User's quality preference: 'auto', '720p', '1080p', '1440p', '4K'
    pendingHDRequests: new Map(), // v4: Track in-flight HD requests for deduplication
    hdRestorePausedUntil: 0, // Temporarily pause HD source swaps during native IG interactions
    hdInteractionEpoch: 0, // Invalidates delayed HD retries when Instagram is settling

    // Loading states
    isTransitioning: false, // True during mode transitions

    // Computed
    aspectKeys: Object.keys(CONFIG.ASPECT_RATIOS),

    // Performance monitoring (optional, for debugging)
    performanceMetrics: {
      videoDetections: 0,
      hdAttempts: 0,
      hdSuccesses: 0,
      lastDetectionTime: 0
    },

    activeVideoCache: {
      video: null,
      at: 0,
      path: '',
      width: 0,
      height: 0
    },

    inlineDownloadSyncCache: {
      signature: '',
      at: 0,
      mount: null
    },

    // Reset transforms only (preserves audio preferences and playback speed)
    reset() {
      this.rotation = 0;
      this.zoom = 1;
      this.aspectRatio = 'original';
      this.panX = 0;
      this.panY = 0;
      this.isOverlayActive = false;
      this.isTheaterMode = false;
      this.enhancedModeActive = false; // Exit enhanced mode on reset
      // Note: userMuted, userVolume, and playbackSpeed intentionally NOT reset
    },

    // Full reset including audio and playback speed
    fullReset() {
      this.reset();
      this.userMuted = null;
      this.userVolume = null;
      this.playbackSpeed = 1.0;
      this.isHoldingSpeedKey = false;
      this.previousSpeed = 1.0;
    }
  };

  // ============================================
  // SETTINGS PERSISTENCE (chrome.storage.local)
  // ============================================
  const Settings = {
    isWatching: false,

    KEYS: {
      HD_MODE:        'angel_hdMode',
      ASPECT_RATIO:   'angel_aspectRatio',
      PLAYBACK_SPEED: 'angel_playbackSpeed',
      MUTED:          'angel_muted',
      VOLUME:         'angel_volume',
      DOWNLOAD_TEMPLATE: ANGEL_DOWNLOAD_SETTINGS?.STORAGE_KEYS?.TEMPLATE || 'angel_downloadTemplate',
      DOWNLOAD_CAROUSEL_INDEX: ANGEL_DOWNLOAD_SETTINGS?.STORAGE_KEYS?.CAROUSEL_INDEX || 'angel_downloadCarouselIndex',
      DOWNLOAD_SAVE_AS: ANGEL_DOWNLOAD_SETTINGS?.STORAGE_KEYS?.SAVE_AS || 'angel_downloadSaveAs',
      PANEL_LEFT:     'angel_panelLeft',
      PANEL_TOP:      'angel_panelTop',
    },

    /** Load persisted settings into GlobalState and restore panel position. */
    load() {
      if (!chrome?.storage?.local) return;

      if (!this.isWatching && chrome.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
          if (areaName !== 'local') return;

          if (changes[this.KEYS.DOWNLOAD_TEMPLATE]) {
            const value = changes[this.KEYS.DOWNLOAD_TEMPLATE].newValue;
            GlobalState.downloadFilenameTemplate = typeof value === 'string' && value.trim()
              ? value.trim()
              : CONFIG.DOWNLOAD.DEFAULT_TEMPLATE;
          }
          if (changes[this.KEYS.DOWNLOAD_CAROUSEL_INDEX]) {
            GlobalState.downloadCarouselIndex = !!changes[this.KEYS.DOWNLOAD_CAROUSEL_INDEX].newValue;
          }
          if (changes[this.KEYS.DOWNLOAD_SAVE_AS]) {
            GlobalState.downloadSaveAs = !!changes[this.KEYS.DOWNLOAD_SAVE_AS].newValue;
          }
        });
        this.isWatching = true;
      }

      const keys = Object.values(this.KEYS);
      chrome.storage.local.get(keys, (items) => {
        if (chrome.runtime.lastError) return;

        if (items[this.KEYS.HD_MODE] !== undefined) {
          GlobalState.hdMode = !!items[this.KEYS.HD_MODE];
        }
        if (items[this.KEYS.ASPECT_RATIO] && CONFIG.ASPECT_RATIOS[items[this.KEYS.ASPECT_RATIO]]) {
          GlobalState.aspectRatio = items[this.KEYS.ASPECT_RATIO];
        }
        if (typeof items[this.KEYS.PLAYBACK_SPEED] === 'number') {
          const spd = items[this.KEYS.PLAYBACK_SPEED];
          if (spd >= CONFIG.PLAYBACK_SPEED.MIN && spd <= CONFIG.PLAYBACK_SPEED.MAX) {
            GlobalState.playbackSpeed = spd;
          }
        }
        if (items[this.KEYS.MUTED] !== undefined) {
          GlobalState.userMuted = !!items[this.KEYS.MUTED];
        }
        if (typeof items[this.KEYS.VOLUME] === 'number') {
          GlobalState.userVolume = Math.min(1, Math.max(0, items[this.KEYS.VOLUME]));
        }
        if (typeof items[this.KEYS.DOWNLOAD_TEMPLATE] === 'string' && items[this.KEYS.DOWNLOAD_TEMPLATE].trim()) {
          GlobalState.downloadFilenameTemplate = items[this.KEYS.DOWNLOAD_TEMPLATE].trim();
        }
        if (items[this.KEYS.DOWNLOAD_CAROUSEL_INDEX] !== undefined) {
          GlobalState.downloadCarouselIndex = !!items[this.KEYS.DOWNLOAD_CAROUSEL_INDEX];
        }
        if (items[this.KEYS.DOWNLOAD_SAVE_AS] !== undefined) {
          GlobalState.downloadSaveAs = !!items[this.KEYS.DOWNLOAD_SAVE_AS];
        }

        // Restore panel position after the panel has been created
        const left = items[this.KEYS.PANEL_LEFT];
        const top  = items[this.KEYS.PANEL_TOP];
        if (typeof left === 'number' && typeof top === 'number') {
          const apply = () => {
            const panel = document.getElementById(CONFIG.SELECTORS.CONTROL_PANEL);
            if (panel) {
              panel.style.left   = `${left}px`;
              panel.style.top    = `${top}px`;
              panel.style.right  = 'auto';
              panel.style.bottom = 'auto';
              clampToViewport(panel);
            }
          };
          // Try immediately, then retry in case the panel isn't created yet
          apply();
          setTimeout(apply, 1200);
        }

        updateControlPanel();
      });
    },

    /** Persist a single key/value pair. */
    save(key, value) {
      if (!chrome?.storage?.local) return;
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          log('Settings save error:', chrome.runtime.lastError.message);
        }
      });
    },

    saveHDMode()        { this.save(this.KEYS.HD_MODE,        GlobalState.hdMode); },
    saveAspectRatio()   { this.save(this.KEYS.ASPECT_RATIO,   GlobalState.aspectRatio); },
    savePlaybackSpeed() { this.save(this.KEYS.PLAYBACK_SPEED, GlobalState.playbackSpeed); },
    saveMuted()         { this.save(this.KEYS.MUTED,          GlobalState.userMuted); },
    saveVolume()        { this.save(this.KEYS.VOLUME,         GlobalState.userVolume); },
    saveDownloadTemplate() { this.save(this.KEYS.DOWNLOAD_TEMPLATE, GlobalState.downloadFilenameTemplate); },
    saveDownloadCarouselIndex() { this.save(this.KEYS.DOWNLOAD_CAROUSEL_INDEX, GlobalState.downloadCarouselIndex); },
    saveDownloadSaveAs() { this.save(this.KEYS.DOWNLOAD_SAVE_AS, GlobalState.downloadSaveAs); },
    savePanelPosition(left, top) {
      this.save(this.KEYS.PANEL_LEFT, left);
      this.save(this.KEYS.PANEL_TOP,  top);
    },
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // Throttle - executes at most once per interval (better for scroll)
  function throttle(fn, interval) {
    let lastCall = 0;
    let timeout = null;
    return function (...args) {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;

      if (timeSinceLastCall >= interval) {
        lastCall = now;
        fn.apply(this, args);
      } else {
        // Schedule one final call if throttled
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          lastCall = Date.now();
          fn.apply(this, args);
        }, interval - timeSinceLastCall);
      }
    };
  }

  function isReelsPage() {
    // Matches /reel/, /reels/, /p/ (feed posts with video), /tv/ (IGTV)
    // /stories/ deliberately excluded — ephemeral content with different DOM
    return /instagram\.com\/(reels?|p|tv)\b/.test(window.location.href);
  }

  function isStoryPage() {
    return /^\/stories\/(?!highlights\/)[^/]+/.test(window.location.pathname);
  }

  function isHighlightPage() {
    return /^\/stories\/highlights\/[^/]+/.test(window.location.pathname);
  }

  function getPathMediaIdentifier() {
    const path = window.location.pathname;
    const mediaMatch = path.match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
    if (mediaMatch?.[1]) return mediaMatch[1];

    const highlightMatch = path.match(/^\/stories\/highlights\/([^/]+)/);
    if (highlightMatch?.[1]) {
      return `highlight_${sanitizeFilenameSegment(highlightMatch[1]) || highlightMatch[1]}`;
    }

    const storyMatch = path.match(/^\/stories\/(?!highlights\/)([^/]+)(?:\/([^/]+))?/);
    if (storyMatch) {
      const storyId = sanitizeFilenameSegment(storyMatch[2] || storyMatch[1]);
      return storyId ? `story_${storyId}` : null;
    }

    return null;
  }

  function getMediaSurface(container = null) {
    const path = window.location.pathname;

    if (isHighlightPage()) return MEDIA_SURFACES.HIGHLIGHT;
    if (isStoryPage()) return MEDIA_SURFACES.STORY;
    if (/^\/(?:reel|reels)\//.test(path)) return MEDIA_SURFACES.REEL;
    if (/^\/p\//.test(path)) return MEDIA_SURFACES.POST;
    if (/^\/tv\//.test(path)) return MEDIA_SURFACES.TV;

    const href = container?.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]')?.getAttribute('href') || '';
    if (/\/(?:reel|reels)\//.test(href)) return MEDIA_SURFACES.REEL;
    if (/\/p\//.test(href)) return MEDIA_SURFACES.POST;
    if (/\/tv\//.test(href)) return MEDIA_SURFACES.TV;

    return MEDIA_SURFACES.MEDIA;
  }

  function log(...args) {
    console.log('[ANGEL]', ...args);
  }

  // ============================================
  // LOADING INDICATORS
  // ============================================

  function showLoader(message = 'Loading...') {
    try {
      let loader = document.getElementById(CONFIG.SELECTORS.LOADER);

      if (!loader) {
        loader = document.createElement('div');
        loader.id = CONFIG.SELECTORS.LOADER;
        loader.innerHTML = `
          <div class="ir-loader-spinner"></div>
          <div class="ir-loader-text">${message}</div>
        `;
        document.body.appendChild(loader);
      } else {
        const text = loader.querySelector('.ir-loader-text');
        if (text) text.textContent = message;
      }

      // Trigger animation
      requestAnimationFrame(() => {
        loader.classList.add('visible');
      });
    } catch (e) {
      log('Error showing loader:', e);
    }
  }

  function hideLoader() {
    try {
      const loader = document.getElementById(CONFIG.SELECTORS.LOADER);
      if (loader) {
        loader.classList.remove('visible');
      }
    } catch (e) {
      log('Error hiding loader:', e);
    }
  }

  // ============================================
  // TOAST NOTIFICATIONS
  // ============================================

  function showToast(message, icon = '') {
    try {
      if (!document.body) {
        log('Cannot show toast: document.body not available');
        return;
      }

      let toast = document.getElementById(CONFIG.SELECTORS.TOAST);

      if (!toast) {
        toast = document.createElement('div');
        toast.id = CONFIG.SELECTORS.TOAST;
        try {
          document.body.appendChild(toast);
        } catch (e) {
          log('Failed to append toast:', e);
          return;
        }
      }

      // Sanitize both message and icon to prevent XSS
      const safeMessage = String(message).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeIcon = String(icon).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      toast.innerHTML = safeIcon ? `<span class="ir-toast-icon">${safeIcon}</span>${safeMessage}` : safeMessage;
      toast.classList.add('visible');

      clearTimeout(toast._hideTimer);
      toast._hideTimer = setTimeout(() => {
        try {
          toast.classList.remove('visible');
        } catch (e) {
          log('Error hiding toast:', e);
        }
      }, 1500);
    } catch (e) {
      log('Error showing toast:', e);
    }
  }

  // ============================================
  // VIDEO DETECTION
  // ============================================

  function findActiveVideo(force = false) {
    try {
      const cache = GlobalState.activeVideoCache;
      if (!force &&
        cache.video &&
        cache.video.isConnected &&
        cache.path === window.location.pathname &&
        cache.width === window.innerWidth &&
        cache.height === window.innerHeight &&
        Date.now() - cache.at < 150) {
        return cache.video;
      }

      // Multiple selector strategies for resilience
      const selectors = [
        'video',
        'video[playsinline]',
        'article video',
        'div[role="presentation"] video'
      ];

      let videos = [];
      for (const selector of selectors) {
        try {
          videos = Array.from(document.querySelectorAll(selector));
          if (videos.length > 0) break;
        } catch (e) {
          log('Selector failed:', selector, e);
        }
      }

      if (videos.length === 0) {
        GlobalState.activeVideoCache = { video: null, at: Date.now(), path: window.location.pathname, width: window.innerWidth, height: window.innerHeight };
        return null;
      }

      // Filter to only visible videos with reasonable size
      const validVideos = videos.filter(v => {
        try {
          if (!v.offsetParent && !v.classList.contains('ir-overlay-video')) return false;
          const rect = v.getBoundingClientRect();
          return rect.width > 100 && rect.height > 100;
        } catch (e) {
          return false;
        }
      });

      if (validVideos.length === 0) {
        GlobalState.activeVideoCache = { video: null, at: Date.now(), path: window.location.pathname, width: window.innerWidth, height: window.innerHeight };
        return null;
      }

      // Find the video closest to viewport center
      const viewportCenterY = window.innerHeight / 2;
      let bestVideo = null;
      let bestScore = -Infinity;

      for (const video of validVideos) {
        try {
          const rect = video.getBoundingClientRect();
          const videoCenterY = rect.top + rect.height / 2;
          const distanceFromCenter = Math.abs(videoCenterY - viewportCenterY);

          // Score: closer to center is better, playing videos get bonus
          let score = 1000 - distanceFromCenter;
          if (!video.paused) score += 500;
          if (rect.height > 400) score += 200; // Bonus for full-size reels

          if (score > bestScore) {
            bestScore = score;
            bestVideo = video;
          }
        } catch (e) {
          log('Error scoring video:', e);
          continue;
        }
      }

      GlobalState.activeVideoCache = {
        video: bestVideo,
        at: Date.now(),
        path: window.location.pathname,
        width: window.innerWidth,
        height: window.innerHeight
      };
      return bestVideo;
    } catch (e) {
      log('Error in findActiveVideo:', e);
      return null;
    }
  }

  function findActiveImage(root = document) {
    try {
      const images = Array.from(root.querySelectorAll('img')).filter(isLikelyMediaImage);
      if (images.length === 0) return null;

      const viewportCenterX = window.innerWidth / 2;
      const viewportCenterY = window.innerHeight / 2;
      let bestImage = null;
      let bestScore = -Infinity;

      for (const img of images) {
        try {
          const rect = img.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const distance = Math.hypot(centerX - viewportCenterX, centerY - viewportCenterY);

          let score = rect.width * rect.height - distance * 120;
          if (rect.height >= window.innerHeight * 0.45) score += 50000;
          if (rect.width >= window.innerWidth * 0.45) score += 25000;

          if (score > bestScore) {
            bestScore = score;
            bestImage = img;
          }
        } catch (e) {
          continue;
        }
      }

      return bestImage;
    } catch (e) {
      log('Error in findActiveImage:', e);
      return null;
    }
  }

  function getScrollContainer() {
    // Cache the result — re-discover only when the cached element leaves the DOM
    // or the page URL changes (SPA navigation).
    const cache = getScrollContainer._cache;
    if (cache && cache.el && cache.el.isConnected && cache.path === window.location.pathname) {
      return cache.el;
    }

    try {
      const selectors = [
        'main[role="main"]',
        'main',
        '[role="main"]',
        'body > div > div > div',
        '#react-root'
      ];

      for (const selector of selectors) {
        try {
          const mainEl = document.querySelector(selector);
          if (!mainEl) continue;

          let el = mainEl;
          for (let i = 0; i < 10 && el; i++) {
            const style = window.getComputedStyle(el);
            if ((style.overflowY === 'scroll' || style.overflowY === 'auto') &&
              el.scrollHeight > el.clientHeight) {
              log('Found scroll container:', selector);
              getScrollContainer._cache = { el, path: window.location.pathname };
              return el;
            }
            for (const child of el.children) {
              const childStyle = window.getComputedStyle(child);
              if ((childStyle.overflowY === 'scroll' || childStyle.overflowY === 'auto') &&
                child.scrollHeight > child.clientHeight) {
                log('Found scroll container in children:', selector);
                getScrollContainer._cache = { el: child, path: window.location.pathname };
                return child;
              }
            }
            el = el.parentElement;
          }
        } catch (e) {
          log('Selector failed:', selector, e);
        }
      }
    } catch (e) {
      log('Error in getScrollContainer:', e);
    }

    log('Using fallback scroll container: documentElement');
    getScrollContainer._cache = { el: document.documentElement, path: window.location.pathname };
    return document.documentElement;
  }
  getScrollContainer._cache = null;

  // ============================================
  // OVERLAY MANAGEMENT
  // ============================================

  function createBackdrop() {
    try {
      if (GlobalState.backdrop && document.body.contains(GlobalState.backdrop)) {
        return GlobalState.backdrop;
      }

      const backdrop = document.createElement('div');
      backdrop.id = CONFIG.SELECTORS.BACKDROP;
      backdrop.className = 'ir-backdrop';
      backdrop.onclick = (e) => {
        try {
          if (e.target === backdrop) {
            resetAll();
          }
        } catch (err) {
          log('Error in backdrop click:', err);
        }
      };

      if (document.body) {
        document.body.appendChild(backdrop);
        GlobalState.backdrop = backdrop;
        return backdrop;
      } else {
        log('Error: document.body not available');
        return null;
      }
    } catch (e) {
      log('Error creating backdrop:', e);
      return null;
    }
  }

  function createOverlay() {
    try {
      if (GlobalState.overlay && document.body.contains(GlobalState.overlay)) {
        return GlobalState.overlay;
      }

      const overlay = document.createElement('div');
      overlay.id = CONFIG.SELECTORS.OVERLAY;
      overlay.className = 'ir-overlay';

      if (document.body) {
        document.body.appendChild(overlay);
        GlobalState.overlay = overlay;
        return overlay;
      } else {
        log('Error: document.body not available');
        return null;
      }
    } catch (e) {
      log('Error creating overlay:', e);
      return null;
    }
  }

  function activateOverlay() {
    if (GlobalState.isOverlayActive) return;

    // Get fresh video reference and validate it's still in DOM
    let video = GlobalState.currentVideo;
    if (!video || !video.isConnected) {
      video = findActiveVideo();
      if (video && video !== GlobalState.currentVideo) {
        handleVideoChange(video);
      }
    }

    if (!video || !video.isConnected) {
      log('Cannot activate overlay: no valid video found');
      return;
    }

    log('Activating overlay mode');

    // Create backdrop and overlay if needed
    const backdrop = createBackdrop();
    const overlay = createOverlay();

    // Store original video properties
    video._ir_originalStyles = video.getAttribute('style') || '';
    video._ir_originalParent = video.parentElement;
    video._ir_originalSibling = video.nextSibling;

    // Capture the CSS-rendered size NOW (before we move the element or change
    // any styles) so calculateTransforms can use it as the scale divisor.
    // This makes scaling resolution-independent: the same visual size is produced
    // whether the source is 1080p, 1440p, or 4K.
    GlobalState.videoNaturalW = video.offsetWidth || 390;
    GlobalState.videoNaturalH = video.offsetHeight || 694;

    // Create placeholder to maintain DOM structure
    const placeholder = document.createElement('div');
    placeholder.className = 'ir-video-placeholder';
    placeholder.style.cssText = `
      width: ${GlobalState.videoNaturalW}px;
      height: ${GlobalState.videoNaturalH}px;
      display: block;
    `;
    video._ir_placeholder = placeholder;
    video.parentElement.insertBefore(placeholder, video);

    // Move video to overlay
    overlay.appendChild(video);
    video.classList.add('ir-overlay-video');

    // Set isOverlayActive = true BEFORE calculateTransforms so the scaling
    // branch inside it is used — otherwise scale stays at 1 and the video
    // flashes at natural/tiny size during the overlay fade-in.
    GlobalState.isOverlayActive = true;

    // Pre-apply transforms immediately (no transition) so the video is already
    // in the correct full-screen position/size when the overlay fades in.
    // We must use setProperty with 'important' to override the !important CSS transition.
    const initialTransforms = calculateTransforms(video);
    video.style.setProperty('transition', 'none', 'important');
    video.style.transform = initialTransforms.transform;
    video.style.transformOrigin = 'center center';
    video.style.width = initialTransforms.width;
    video.style.height = initialTransforms.height;
    video.style.objectFit = initialTransforms.objectFit;
    // Force reflow to commit the no-transition state before showing overlay
    void video.offsetHeight;
    // Re-enable transitions for subsequent interactive changes
    video.style.removeProperty('transition');

    // Show backdrop and overlay — video is already at correct dimensions
    backdrop.classList.add('active');
    overlay.classList.add('active');
    document.body.classList.add('ir-overlay-active');

    // Ensure video keeps playing after moving to overlay
    // Moving video to a different DOM container can stop playback
    const ensurePlayback = () => {
      if (video && (video.paused || video.readyState < 3)) {
        video.play().catch(err => {
          log('Play failed, retrying:', err);
          // Retry after a short delay
          setTimeout(() => {
            video.play().catch(() => { });
          }, 100);
        });
      }
    };

    // Try immediately
    ensurePlayback();

    // Also try after a small delay in case video needs time to settle
    setTimeout(ensurePlayback, 50);
    setTimeout(ensurePlayback, 200);

    // Show exit hint
    showExitHint();
  }

  function deactivateOverlay(options = {}) {
    if (!GlobalState.isOverlayActive) return;

    const { resumePlayback = true } = options;
    const video = GlobalState.currentVideo;
    log('Deactivating overlay mode');

    // Clean up event listeners from video to prevent memory leaks
    if (video && video._ir_muteListener) {
      try {
        video.removeEventListener('seeked', video._ir_muteListener);
        video.removeEventListener('play', video._ir_muteListener);
        video.removeEventListener('playing', video._ir_muteListener);
        delete video._ir_muteListener;
      } catch (e) {
        log('Error cleaning up video listeners:', e);
      }
    }

    // Hide backdrop and overlay
    if (GlobalState.backdrop) {
      GlobalState.backdrop.classList.remove('active');
    }
    if (GlobalState.overlay) {
      GlobalState.overlay.classList.remove('active');
    }
    document.body.classList.remove('ir-overlay-active');

    // Restore video to original position
    if (video && video._ir_originalParent) {
      try {
        if (video._ir_placeholder && video._ir_placeholder.parentElement) {
          video._ir_placeholder.parentElement.insertBefore(video, video._ir_placeholder);
          video._ir_placeholder.remove();
        } else {
          video._ir_originalParent.appendChild(video);
        }
      } catch (e) {
        log('Error restoring video:', e);
        if (video._ir_originalParent) {
          video._ir_originalParent.appendChild(video);
        }
      }

      // Clean up stored references
      delete video._ir_placeholder;
      delete video._ir_originalParent;
      delete video._ir_originalSibling;
    }

    // Restore video styles
    if (video) {
      video.classList.remove('ir-overlay-video');
      if (video._ir_originalStyles) {
        video.setAttribute('style', video._ir_originalStyles);
      } else {
        video.removeAttribute('style');
      }
      delete video._ir_originalStyles;

      // Ensure video keeps playing unless this is a reel-navigation handoff.
      if (resumePlayback && video.paused) {
        video.play().catch(() => { });
      }
    }

    GlobalState.isOverlayActive = false;
    hideExitHint();
  }

  function showExitHint() {
    let hint = document.getElementById('ir-exit-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'ir-exit-hint';
      hint.innerHTML = 'Press <kbd>ESC</kbd> to exit • Scroll to navigate';
      hint.onclick = resetAll;
      document.body.appendChild(hint);
    }
    hint.classList.add('visible');

    // Auto-hide after 3 seconds
    clearTimeout(hint._hideTimer);
    hint._hideTimer = setTimeout(() => {
      hint.classList.remove('visible');
    }, 3000);
  }

  function hideExitHint() {
    const hint = document.getElementById('ir-exit-hint');
    if (hint) {
      hint.classList.remove('visible');
    }
  }

  // ============================================
  // TRANSFORM APPLICATION
  // ============================================

  function applyTransforms() {
    let video = GlobalState.currentVideo;

    // Validate video is still in DOM, refresh if needed
    if (!video || !video.isConnected) {
      video = findActiveVideo();
      if (video && video !== GlobalState.currentVideo) {
        handleVideoChange(video);
      }
    }

    if (!video) return;

    // Check if any enhancement is active (including enhanced mode flag)
    const hasActiveEnhancement = GlobalState.rotation !== 0 ||
      GlobalState.isTheaterMode ||
      GlobalState.aspectRatio !== 'original' ||
      GlobalState.zoom !== 1;

    // Once user activates any enhancement, stay in enhanced mode until ESC
    if (hasActiveEnhancement) {
      GlobalState.enhancedModeActive = true;
    }

    // Keep overlay active as long as enhancedModeActive is true
    const needsOverlay = GlobalState.enhancedModeActive;

    // Track whether overlay was just activated so we can skip the redundant animated
    // re-apply below (activateOverlay already snapped the video to correct position).
    const justActivated = needsOverlay && !GlobalState.isOverlayActive;

    // Manage overlay state
    if (justActivated) {
      activateOverlay();
    } else if (!needsOverlay && GlobalState.isOverlayActive) {
      deactivateOverlay();
    }

    // Calculate transforms
    const transforms = calculateTransforms(video);

    // Apply smooth CSS transitions — but skip animation when overlay was just activated
    // because activateOverlay() already pre-applied the correct transform instantly.
    if (!justActivated) {
      const duration = CONFIG.ANIMATIONS.TRANSFORM_DURATION;
      video.style.setProperty(
        'transition',
        `transform ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${CONFIG.ANIMATIONS.FADE_DURATION}ms ease`,
        'important'
      );
    }

    // Apply to video
    video.style.transform = transforms.transform;
    video.style.transformOrigin = 'center center';
    video.style.width = transforms.width;
    video.style.height = transforms.height;
    video.style.objectFit = transforms.objectFit;

    if (GlobalState.isOverlayActive) {
      video.style.minWidth = '0px';
      video.style.minHeight = '0px';
      video.style.maxWidth = 'none';
      video.style.maxHeight = 'none';
    }
  }

  function fitBoxWithin(maxW, maxH, aspectRatio) {
    const safeAspect = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : (9 / 16);
    const safeMaxW = Math.max(1, maxW || 1);
    const safeMaxH = Math.max(1, maxH || 1);

    let width = safeMaxW;
    let height = width / safeAspect;

    if (height > safeMaxH) {
      height = safeMaxH;
      width = height * safeAspect;
    }

    return { width, height };
  }

  function calculateDomSizeForVisualFit(maxVisualW, maxVisualH, domAspect, isRotated90) {
    const visualAspect = isRotated90 ? (1 / domAspect) : domAspect;
    const visual = fitBoxWithin(maxVisualW, maxVisualH, visualAspect);

    return isRotated90
      ? { domW: visual.height, domH: visual.width }
      : { domW: visual.width, domH: visual.height };
  }

  function calculateTransforms(video) {
    const vw = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    const vh = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);

    // In overlay mode: set EXPLICIT pixel dimensions so the displayed size is
    // completely independent of source resolution (720p / 1080p / 1440p / 4K).
    // scale() is only used for user-driven zoom, never for sizing.
    // In non-overlay mode: no transforms needed.
    if (!GlobalState.isOverlayActive) {
      return { transform: '', width: 'auto', height: 'auto', objectFit: 'contain' };
    }

    const isRotated90 = GlobalState.rotation === 90 || GlobalState.rotation === 270;
    const aspectConfig = CONFIG.ASPECT_RATIOS[GlobalState.aspectRatio];
    let domW, domH;
    let objectFit = 'contain';

    // When rotated 90°/270° the DOM width/height axes are visually swapped:
    //   visual width  = DOM height
    //   visual height = DOM width
    // So we solve for DOM dimensions by working in visual space first, then swap.

    switch (aspectConfig.value) {
      case 'fit':
      case null: { // 'original'
        // Consistent 9:16 portrait target — same visual size regardless of reel source quality
        const dims = calculateDomSizeForVisualFit(vw * 0.92, vh * 0.92, 9 / 16, isRotated90);
        domW = dims.domW;
        domH = dims.domH;
        break;
      }
      case 'fill': {
        // Fill full viewport — objectFit cover handles cropping
        domW = isRotated90 ? vh : vw;
        domH = isRotated90 ? vw : vh;
        objectFit = 'cover';
        break;
      }
      case 'stretch': {
        // Stretch to fill — objectFit fill ignores aspect ratio
        domW = (isRotated90 ? vh : vw) * 0.98;
        domH = (isRotated90 ? vw : vh) * 0.98;
        objectFit = 'fill';
        break;
      }
      default: {
        if (typeof aspectConfig.value === 'number') {
          const dims = calculateDomSizeForVisualFit(vw * 0.9, vh * 0.9, aspectConfig.value, isRotated90);
          domW = dims.domW;
          domH = dims.domH;
        } else {
          // Fallback: use actual video intrinsic aspect ratio
          const videoAspect = (video.videoWidth || 9) / (video.videoHeight || 16);
          const dims = calculateDomSizeForVisualFit(vw * 0.92, vh * 0.92, videoAspect, isRotated90);
          domW = dims.domW;
          domH = dims.domH;
        }
        break;
      }
    }

    // Build transform: center + optional rotation + optional user zoom
    let tx = '-50%', ty = '-50%';
    if (GlobalState.panX !== 0 || GlobalState.panY !== 0) {
      tx = `calc(-50% + ${GlobalState.panX}px)`;
      ty = `calc(-50% + ${GlobalState.panY}px)`;
    }
    const transformParts = [`translate(${tx}, ${ty})`];
    if (GlobalState.rotation !== 0) {
      transformParts.push(`rotate(${GlobalState.rotation}deg)`);
    }
    if (GlobalState.zoom !== 1) {
      transformParts.push(`scale(${GlobalState.zoom})`);
    }

    return {
      transform: transformParts.join(' '),
      width: Math.round(domW) + 'px',
      height: Math.round(domH) + 'px',
      objectFit
    };
  }

  // ============================================
  // VIDEO CHANGE HANDLING
  // ============================================

  function handleVideoChange(newVideo) {
    if (!newVideo) return;
    const newSrc = newVideo.currentSrc || newVideo.src;
    const previousVideo = GlobalState.currentVideo;
    if (newVideo === GlobalState.currentVideo && newSrc === GlobalState.currentVideoSrc) return;
    if (newSrc === GlobalState.currentVideoSrc) return;

    log('Video changed:', newSrc?.substring(0, 50) + '...');

    // Track performance
    GlobalState.performanceMetrics.videoDetections++;
    GlobalState.performanceMetrics.lastDetectionTime = Date.now();

    // If we were in overlay mode, we need to migrate to new video
    const wasOverlayActive = GlobalState.isOverlayActive;
    const isSameVideoElement = newVideo === GlobalState.currentVideo;

    if (wasOverlayActive && GlobalState.currentVideo && !isSameVideoElement) {
      // Restore old video first
      const oldVideo = GlobalState.currentVideo;

      // Remove from overlay
      if (oldVideo._ir_originalParent) {
        try {
          if (oldVideo._ir_placeholder && oldVideo._ir_placeholder.parentElement) {
            oldVideo._ir_placeholder.parentElement.insertBefore(oldVideo, oldVideo._ir_placeholder);
            oldVideo._ir_placeholder.remove();
          }
        } catch (e) {
          log('Error restoring old video:', e);
        }
      }

      oldVideo.classList.remove('ir-overlay-video');
      if (oldVideo._ir_originalStyles) {
        oldVideo.setAttribute('style', oldVideo._ir_originalStyles);
      } else {
        oldVideo.removeAttribute('style');
      }

      // Clean up references, intervals, and observers
      if (oldVideo._dimensionCheckInterval) {
        clearInterval(oldVideo._dimensionCheckInterval);
        delete oldVideo._dimensionCheckInterval;
      }
      if (oldVideo._dimensionResizeObserver) {
        oldVideo._dimensionResizeObserver.disconnect();
        delete oldVideo._dimensionResizeObserver;
      }
      if (oldVideo._hdQualityCheckInterval) {
        clearInterval(oldVideo._hdQualityCheckInterval);
        delete oldVideo._hdQualityCheckInterval;
      }
      if (oldVideo._timeUpdateHDHandler) {
        oldVideo.removeEventListener('timeupdate', oldVideo._timeUpdateHDHandler);
        delete oldVideo._timeUpdateHDHandler;
      }
      if (oldVideo._srcObserver) {
        oldVideo._srcObserver.disconnect();
        delete oldVideo._srcObserver;
      }
      // Unobserve from IntersectionObserver
      if (GlobalState.intersectionObserver) {
        try {
          GlobalState.intersectionObserver.unobserve(oldVideo);
        } catch (e) {
          log('Error unobserving old video:', e);
        }
      }
      delete oldVideo._ir_originalStyles;
      delete oldVideo._ir_originalParent;
      delete oldVideo._ir_originalSibling;
      delete oldVideo._ir_placeholder;
    }

    // Update current video reference
    GlobalState.currentVideo = newVideo;
    GlobalState.currentVideoSrc = newSrc;
    GlobalState.activeVideoCache = {
      video: newVideo,
      at: Date.now(),
      path: window.location.pathname,
      width: window.innerWidth,
      height: window.innerHeight
    };
    GlobalState.inlineDownloadSyncCache = { signature: '', at: 0, mount: null };
    GlobalState.isOverlayActive = wasOverlayActive && isSameVideoElement;

    // Apply saved audio preferences to new video
    if (GlobalState.userMuted !== null) {
      applyVideoMuteState(newVideo, GlobalState.userMuted);
    }
    if (GlobalState.userVolume !== null) {
      newVideo.volume = GlobalState.userVolume;
    }

    // Apply saved playback speed preference to new video
    if (GlobalState.playbackSpeed !== null && GlobalState.playbackSpeed !== CONFIG.PLAYBACK_SPEED.DEFAULT) {
      newVideo.playbackRate = GlobalState.playbackSpeed;
    }

    // Add listener to maintain mute preference when video loops
    // (Instagram resets mute state on loop/replay)
    if (!newVideo._ir_muteListener) {
      newVideo._ir_muteListener = () => {
        if (GlobalState.userMuted !== null && newVideo.muted !== GlobalState.userMuted) {
          applyVideoMuteState(newVideo, GlobalState.userMuted);
        }
        if (GlobalState.userVolume !== null && newVideo.volume !== GlobalState.userVolume) {
          newVideo.volume = GlobalState.userVolume;
        }
        // Restore playback speed if changed
        if (GlobalState.playbackSpeed !== null && newVideo.playbackRate !== GlobalState.playbackSpeed && !GlobalState.isHoldingSpeedKey) {
          newVideo.playbackRate = GlobalState.playbackSpeed;
        }
      };
      // Listen for loop restart (seeking to 0) and play events
      newVideo.addEventListener('seeked', newVideo._ir_muteListener);
      newVideo.addEventListener('play', newVideo._ir_muteListener);
      newVideo.addEventListener('playing', newVideo._ir_muteListener);
    }

    // Reset HD state for new video and try to apply HD
    GlobalState.hdAppliedToCurrentVideo = false;
    GlobalState.currentVideoQuality = null;
    newVideo._hdApplied = false;
    newVideo._hdUrl = null;
    newVideo._hdRetryCount = 0; // Reset retry counter for new video
    newVideo._hdAttemptStartTime = null;
    if (newVideo !== previousVideo || GlobalState.reelNavigationInProgress) {
      clearHDInteractionSuppression(newVideo);
    }

    // Setup observer to detect when Instagram changes the video source back
    setupVideoSourceObserver(newVideo);

    // Use IntersectionObserver for lazy HD loading (performance optimization)
    if (GlobalState.intersectionObserver) {
      try {
        GlobalState.intersectionObserver.observe(newVideo);
      } catch (e) {
        log('Error observing video with IntersectionObserver:', e);
        // Fallback to immediate loading
        if (GlobalState.hdMode) {
          setTimeout(() => {
            applyHDToVideo(newVideo);
          }, 100);
        }
      }
    } else if (GlobalState.hdMode) {
      // Fallback if IntersectionObserver not available
      setTimeout(() => {
        applyHDToVideo(newVideo);
      }, 100);
    }

    // If we had transforms active, reapply to new video.
    // When coming from overlay mode (navigating reels), reactivate immediately —
    // no setTimeout — so there is zero visible flash between reels.
    if (wasOverlayActive ||
      GlobalState.rotation !== 0 ||
      GlobalState.zoom !== 1 ||
      GlobalState.aspectRatio !== 'original' ||
      GlobalState.isTheaterMode) {
      if (wasOverlayActive && GlobalState.enhancedModeActive) {
        // Synchronous reactivation: no blink, no gap
        applyTransforms();
      } else {
        // Non-overlay transforms: tiny delay is fine
        setTimeout(() => { applyTransforms(); }, 50);
      }
    }

    updateControlPanel();
    syncInlineDownloadButtons(true);
  }

  // ============================================
  // ACTIONS
  // ============================================

  function rotate(degrees) {
    const activeVideo = GlobalState.currentVideo || findActiveVideo(true);
    pauseHDRestoration(4500, 'rotate', activeVideo);
    GlobalState.rotation = ((GlobalState.rotation + degrees) % 360 + 360) % 360;
    applyTransforms();
    showToast(`${GlobalState.rotation}°`, '↻');
    updateControlPanel();
  }

  function setZoom(level) {
    GlobalState.zoom = Math.max(CONFIG.ZOOM.MIN, Math.min(CONFIG.ZOOM.MAX, level));
    applyTransforms();
    showToast(`${Math.round(GlobalState.zoom * 100)}%`, '🔍');
    updateControlPanel();
  }

  function setAspectRatio(ratio) {
    if (!CONFIG.ASPECT_RATIOS[ratio]) return;
    GlobalState.aspectRatio = ratio;
    applyTransforms();
    showToast(CONFIG.ASPECT_RATIOS[ratio].label, '📐');
    updateControlPanel();
    Settings.saveAspectRatio();
  }

  function cycleAspectRatio() {
    const currentIdx = GlobalState.aspectKeys.indexOf(GlobalState.aspectRatio);
    const nextIdx = (currentIdx + 1) % GlobalState.aspectKeys.length;
    setAspectRatio(GlobalState.aspectKeys[nextIdx]);
  }

  function toggleTheaterMode() {
    if (GlobalState.isTransitioning) return;

    GlobalState.isTransitioning = true;
    showLoader('Switching mode...');

    GlobalState.isTheaterMode = !GlobalState.isTheaterMode;
    applyTransforms();
    showToast(GlobalState.isTheaterMode ? 'Theater Mode' : 'Normal Mode', '🎬');
    updateControlPanel();

    setTimeout(() => {
      GlobalState.isTransitioning = false;
      hideLoader();
    }, CONFIG.ANIMATIONS.FADE_DURATION);
  }

  async function toggleFullscreen() {
    if (GlobalState.isTransitioning) return;

    GlobalState.isTransitioning = true;
    showLoader('Entering fullscreen...');

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => { });
      GlobalState.isFullscreen = false;
      showToast('Exit Fullscreen', '⛶');
    } else {
      const target = GlobalState.overlay || GlobalState.currentVideo || document.documentElement;
      try {
        await target.requestFullscreen();
        GlobalState.isFullscreen = true;
        showToast('Fullscreen', '⛶');
      } catch (e) {
        log('Fullscreen failed:', e);
      }
    }
    updateControlPanel();

    setTimeout(() => {
      GlobalState.isTransitioning = false;
      hideLoader();
    }, CONFIG.ANIMATIONS.FADE_DURATION);
  }

  // ============================================
  // AUDIO & PLAYBACK CONTROLS
  // ============================================

  function getVisibleVideos() {
    return Array.from(document.querySelectorAll('video')).filter(video => {
      try {
        if (!video.isConnected) return false;
        const rect = video.getBoundingClientRect();
        return rect.width > 50 && rect.height > 50 &&
          rect.bottom > 0 && rect.right > 0 &&
          rect.top < window.innerHeight && rect.left < window.innerWidth;
      } catch (e) {
        return false;
      }
    });
  }

  function applyVideoMuteState(video, muted) {
    if (!video) return;

    if (!muted && video.volume === 0) {
      const restoredVolume = GlobalState.userVolume && GlobalState.userVolume > 0
        ? GlobalState.userVolume
        : 1;
      video.volume = restoredVolume;
      GlobalState.userVolume = restoredVolume;
      Settings.saveVolume();
    }

    video.muted = muted;
    video.defaultMuted = muted;
    if (muted) {
      video.setAttribute('muted', '');
    } else {
      video.removeAttribute('muted');
    }
  }

  function toggleMute() {
    const activeVideo = findActiveVideo(true);
    if (activeVideo && activeVideo !== GlobalState.currentVideo) {
      handleVideoChange(activeVideo);
    }

    const video = activeVideo || GlobalState.currentVideo;
    if (!video) {
      log('toggleMute: No video found');
      showToast('No video found', '⚠️');
      return;
    }

    const isEffectivelyMuted = video.muted || video.volume === 0;
    const newMutedState = !isEffectivelyMuted;

    const targetVideos = new Set([video, ...getVisibleVideos()]);
    targetVideos.forEach(targetVideo => applyVideoMuteState(targetVideo, newMutedState));
    GlobalState.userMuted = newMutedState; // Save preference
    Settings.saveMuted();

    log('toggleMute:', newMutedState ? 'muted' : 'unmuted');
    showToast(newMutedState ? 'Muted' : 'Unmuted', newMutedState ? '🔇' : '🔊');
    updateControlPanel();

    // Re-apply after a short delay to combat Instagram's internal handlers
    // that might reset the mute state
    setTimeout(() => {
      if (GlobalState.userMuted !== null) {
        targetVideos.forEach(targetVideo => applyVideoMuteState(targetVideo, GlobalState.userMuted));
        updateControlPanel();
      }
    }, 50);
  }

  function setVolume(level) {
    const video = GlobalState.currentVideo;
    if (!video) return;

    const newVolume = Math.max(0, Math.min(1, level));
    video.volume = newVolume;
    GlobalState.userVolume = newVolume; // Save preference
    Settings.saveVolume();

    if (newVolume > 0 && video.muted) {
      video.muted = false;
      GlobalState.userMuted = false;
    }
    if (newVolume === 0) {
      GlobalState.userMuted = true;
    }
    Settings.saveMuted();
    updateControlPanel();
  }

  function setPlaybackSpeed(speed, showToastMsg = true) {
    const video = GlobalState.currentVideo;
    if (!video) return;

    const newSpeed = Math.max(CONFIG.PLAYBACK_SPEED.MIN, Math.min(CONFIG.PLAYBACK_SPEED.MAX, speed));
    video.playbackRate = newSpeed;

    // Only save to persistent state if not a temporary hold
    if (!GlobalState.isHoldingSpeedKey) {
      GlobalState.playbackSpeed = newSpeed;
      Settings.savePlaybackSpeed();
    }

    if (showToastMsg) {
      const speedText = newSpeed.toFixed(2).replace('.00', '') + 'x';
      const icon = newSpeed < 1 ? '🐌' : newSpeed > 1 ? '⚡' : '▶️';
      showToast(`Speed: ${speedText}`, icon);
    }

    updateControlPanel();
  }

  function togglePlayPause() {
    const video = GlobalState.currentVideo;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => { });
      showToast('Play', '▶️');
    } else {
      video.pause();
      showToast('Pause', '⏸️');
    }
    updateControlPanel();
  }

  function seekVideo(seconds) {
    const video = GlobalState.currentVideo;
    if (!video) return;

    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
    showToast(`${seconds > 0 ? '+' : ''}${seconds}s`, '⏱️');
  }

  // ============================================
  // HD VIDEO CONTROLS
  // ============================================

  /**
   * Inject HD interceptor script into page context
   * Content scripts can't intercept fetch() in page context, so we inject a script
   */
  function injectHDInterceptor() {
    if (document.getElementById('angel-hd-script')) return;

    // Load the interceptor script
    const script = document.createElement('script');
    script.id = 'angel-hd-script';
    script.src = chrome.runtime.getURL('hd-video-interceptor.js');
    script.onload = () => {
      log('HD interceptor injected');
    };
    script.onerror = () => {
      log('Failed to inject HD interceptor');
    };
    (document.head || document.documentElement).appendChild(script);
  }

  /**
   * Listen for HD video events from injected script
   */
  function setupHDVideoListeners() {
    // Receive HD video data from interceptor
    window.addEventListener('angel-hd-video', (event) => {
      const data = cacheHDVideoData(event.detail);
      if (data && data.url) {

        log('HD video available:', data.width + 'x' + data.height, data.source);

        // Try to apply HD to current video
        if (GlobalState.hdMode && GlobalState.currentVideo) {
          setTimeout(() => applyHDToVideo(GlobalState.currentVideo), 100);
        }
      }
    });
  }

  function clearPendingHDForVideo(video) {
    const keys = new Set();
    if (video) {
      [video.currentSrc, video.src, video._hdUrl].forEach(src => {
        if (src) keys.add(src);
      });
    }
    if (GlobalState.currentVideoSrc) keys.add(GlobalState.currentVideoSrc);
    keys.forEach(key => GlobalState.pendingHDRequests.delete(key));
  }

  function getVideoSource(video) {
    return video ? (video.currentSrc || video.src || '') : '';
  }

  function suppressHDForInteraction(video, durationMs = 60000) {
    if (!video) return;
    video._hdInteractionSuppressUntil = Math.max(
      video._hdInteractionSuppressUntil || 0,
      Date.now() + durationMs
    );
    video._hdInteractionSuppressedSrc = getVideoSource(video);
  }

  function clearHDInteractionSuppression(video) {
    if (!video) return;
    delete video._hdInteractionSuppressUntil;
    delete video._hdInteractionSuppressedSrc;
  }

  function isHDSuppressedForInteraction(video) {
    return !!video && Date.now() < (video._hdInteractionSuppressUntil || 0);
  }

  function keepPlaybackAliveAfterInteraction(video, reason = 'interaction') {
    if (!video) return;
    const shouldBePlaying = !video.paused;
    if (!shouldBePlaying) return;

    [120, 400, 900, 1600].forEach(delay => {
      setTimeout(() => {
        if (!video.isConnected || video !== GlobalState.currentVideo) return;
        if (GlobalState.isOverlayActive && video === GlobalState.currentVideo) {
          applyTransforms();
        }
        if (video.paused || video.readyState < 2) {
          log('Keeping playback alive after', reason);
          video.play().catch(() => { });
        }
      }, delay);
    });
  }

  function pauseHDRestoration(durationMs = 2500, reason = 'interaction', video = GlobalState.currentVideo) {
    const pausedUntil = Math.max(
      GlobalState.hdRestorePausedUntil || 0,
      Date.now() + durationMs
    );
    GlobalState.hdRestorePausedUntil = pausedUntil;
    GlobalState.hdInteractionEpoch++;
    if (video) {
      video._hdSettlingUntil = Math.max(video._hdSettlingUntil || 0, pausedUntil);
      suppressHDForInteraction(video);
      markHDDriftAccepted(video);
      keepPlaybackAliveAfterInteraction(video, reason);
    }
    GlobalState.hdLoading = false;
    updateControlPanel();
    log('HD restoration paused after', reason);
  }

  function isHDRestorationPaused(video = null) {
    const now = Date.now();
    return now < (GlobalState.hdRestorePausedUntil || 0) ||
      (video && now < (video._hdSettlingUntil || 0)) ||
      isHDSuppressedForInteraction(video);
  }

  function markHDDriftAccepted(video) {
    if (!video) return;
    video._hdApplied = false;
    video._hdRetryCount = 0;
    video._hdAttemptStartTime = null;
    clearPendingHDForVideo(video);
    if (video === GlobalState.currentVideo) {
      GlobalState.hdAppliedToCurrentVideo = false;
      GlobalState.hdLoading = false;
      updateControlPanel();
    }
  }

  function isInstagramLikeTarget(target) {
    if (!target || target.closest?.('#angel-overlay, #angel-backdrop, #angel-ctrl')) return false;

    const labelled = target.closest?.('[aria-label]') ||
      target.closest?.('button, [role="button"]')?.querySelector?.('[aria-label]');
    const label = (labelled?.getAttribute?.('aria-label') || '').trim().toLowerCase();

    return /^(like|unlike)$/i.test(label);
  }

  function cacheHDVideoData(data) {
    if (!data || !data.url) return null;

    const hdData = {
      url: String(data.url),
      downloadUrl: data.downloadUrl ? String(data.downloadUrl) : String(data.url),
      width: Number(data.width) || 0,
      height: Number(data.height) || 0,
      bandwidth: data.bandwidth || null,
      codecs: data.codecs || null,
      qualityScore: Number(data.qualityScore) || 0,
      source: data.source || 'unknown',
      mediaId: data.mediaId ? String(data.mediaId) : null,
      code: data.code ? String(data.code) : null,
      timestamp: Number(data.timestamp) || Date.now()
    };

    const keys = new Set([hdData.url]);
    const urlKey = extractUrlKey(hdData.url);
    if (urlKey) keys.add(urlKey);
    if (hdData.mediaId) keys.add(hdData.mediaId);
    if (hdData.code) keys.add(`code:${hdData.code}`);

    keys.forEach(key => GlobalState.hdVideoMap.set(key, hdData));

    const existingIndex = GlobalState.hdVideoList.findIndex(item =>
      item.url === hdData.url ||
      (hdData.mediaId && item.mediaId === hdData.mediaId) ||
      (hdData.code && item.code === hdData.code)
    );

    if (existingIndex >= 0) {
      GlobalState.hdVideoList[existingIndex] = hdData;
    } else {
      GlobalState.hdVideoList.push(hdData);
    }

    if (GlobalState.hdVideoList.length > 80) {
      GlobalState.hdVideoList.splice(0, GlobalState.hdVideoList.length - 80);
    }

    return hdData;
  }

  function getLocalHDForUrl(videoUrl) {
    if (!videoUrl) return null;

    const direct = GlobalState.hdVideoMap.get(videoUrl);
    if (direct?.url) return direct;

    const urlKey = extractUrlKey(videoUrl);
    if (urlKey) {
      const byKey = GlobalState.hdVideoMap.get(urlKey);
      if (byKey?.url) return byKey;
    }

    for (const hdInfo of new Set(GlobalState.hdVideoMap.values())) {
      if (!hdInfo?.url) continue;
      if (hdInfo.url === videoUrl) return hdInfo;
      if (urlKey && extractUrlKey(hdInfo.url) === urlKey) return hdInfo;
    }

    return null;
  }

  function getRecentLocalHD(maxAgeMs = 30000) {
    const now = Date.now();
    for (let i = GlobalState.hdVideoList.length - 1; i >= 0; i--) {
      const item = GlobalState.hdVideoList[i];
      if (item?.url && now - item.timestamp <= maxAgeMs) return item;
    }
    return null;
  }

  function getLocalHDForShortcode(shortcode, maxAgeMs = 120000) {
    if (!shortcode) return null;

    const byCode = GlobalState.hdVideoMap.get(`code:${shortcode}`);
    if (byCode?.url && Date.now() - byCode.timestamp <= maxAgeMs) return byCode;

    for (let i = GlobalState.hdVideoList.length - 1; i >= 0; i--) {
      const item = GlobalState.hdVideoList[i];
      if (item?.url && item.code === shortcode && Date.now() - item.timestamp <= maxAgeMs) {
        return item;
      }
    }

    return null;
  }

  function getHighestQualityLocalHD(maxAgeMs = 120000) {
    const now = Date.now();
    return GlobalState.hdVideoList
      .filter(item => item?.url && now - item.timestamp <= maxAgeMs)
      .reduce((best, item) => {
        if (!best) return item;
        const itemScore = item.qualityScore || ((item.width || 0) * (item.height || 0));
        const bestScore = best.qualityScore || ((best.width || 0) * (best.height || 0));
        return itemScore > bestScore ? item : best;
      }, null);
  }

  function hdInfoMatchesRequest(hdInfo, videoUrl, shortcode) {
    if (!hdInfo?.url) return false;
    if (shortcode && hdInfo.code === shortcode) return true;

    const requestedKey = extractUrlKey(videoUrl);
    if (requestedKey && extractUrlKey(hdInfo.url) === requestedKey) return true;

    return !shortcode && Date.now() - (hdInfo.timestamp || 0) <= 30000;
  }

  function requestHDInfoFromPage(videoUrl, shortcode, timeoutMs = 1800) {
    return new Promise((resolve) => {
      const requestId = `angel-hd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let settled = false;

      const finish = (hdInfo = null) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('angel-hd-response', handleResponse);
        window.removeEventListener('angel-hd-video', handleVideo);
        clearTimeout(timeoutId);
        resolve(hdInfo ? cacheHDVideoData(hdInfo) : null);
      };

      const handleResponse = (event) => {
        const detail = event.detail || {};
        if (detail.requestId !== requestId) return;
        finish(detail.hdInfo || null);
      };

      const handleVideo = (event) => {
        const hdInfo = cacheHDVideoData(event.detail);
        if (hdInfoMatchesRequest(hdInfo, videoUrl, shortcode)) {
          finish(hdInfo);
        }
      };

      const timeoutId = setTimeout(() => finish(null), timeoutMs);

      window.addEventListener('angel-hd-response', handleResponse);
      window.addEventListener('angel-hd-video', handleVideo);
      window.dispatchEvent(new CustomEvent('angel-hd-request', {
        detail: { requestId, videoUrl, shortcode }
      }));
    });
  }

  /**
   * Setup observer to detect when Instagram changes video source back to low quality
   * This happens when user interacts (likes, shares, etc.)
   */
  function setupVideoSourceObserver(video) {
    if (!video || video._srcObserver) return;

    // Capture stable dimensions once per reel so HD/SD source swaps don't resize the frame.
    captureVideoDimensions(video);

    // Track recent HD reapplication to prevent infinite loops
    video._lastHDReapplyTime = 0;
    const HD_REAPPLY_COOLDOWN = 500; // 500ms cooldown (reduced from 1s for faster HD restoration)

    // Create a MutationObserver to watch for src attribute changes AND style changes
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
          const newSrc = video.src || video.currentSrc;
          const hdUrl = video._hdUrl;

          // If we have an HD URL stored and the src changed to something different
          if (hdUrl && newSrc && newSrc !== hdUrl && GlobalState.hdMode) {
            if (isHDRestorationPaused(video)) {
              log('HD reapply skipped (Instagram interaction settling)');
              markHDDriftAccepted(video);
              return;
            }

            const now = Date.now();
            // Prevent rapid re-application (cooldown)
            if (now - video._lastHDReapplyTime < HD_REAPPLY_COOLDOWN) {
              log('HD reapply skipped (cooldown active)');
              return;
            }

            log('Instagram reverted video source, re-applying HD...');
            video._lastHDReapplyTime = now;

            // Store current playback state BEFORE any changes
            const wasPlaying = !video.paused;
            const currentTime = video.currentTime;
            const wasMuted = video.muted;
            const volume = video.volume;

            // Reset HD flag and re-apply
            video._hdApplied = false;
            video._hdRetryCount = 0; // Reset retry counter
            video._hdAttemptStartTime = Date.now();

            // Preserve dimensions immediately in inline mode. Overlay mode owns its
            // dimensions through applyTransforms(), so do not lock a rotated box.
            if (GlobalState.isOverlayActive && video === GlobalState.currentVideo) {
              applyTransforms();
            } else {
              enforceDimensions(video);
            }

            // Re-apply HD with a slightly longer delay to let Instagram's change stabilize
            const reapplyEpoch = GlobalState.hdInteractionEpoch;
            setTimeout(() => {
              if (GlobalState.hdInteractionEpoch !== reapplyEpoch || isHDRestorationPaused(video)) {
                markHDDriftAccepted(video);
                return;
              }
              if (video === GlobalState.currentVideo && GlobalState.hdMode) {
                // Directly set the HD source without going through full applyHDToVideo
                // to avoid re-triggering the observer loop
                video.src = hdUrl;
                video._hdApplied = true;
                GlobalState.hdAppliedToCurrentVideo = true;

                video.addEventListener('loadeddata', function onReloaded() {
                  video.currentTime = currentTime;
                  video.muted = wasMuted;
                  video.volume = volume;
                  if (wasPlaying) {
                    video.play().catch(() => { });
                  }
                  GlobalState.hdLoading = false;
                  if (GlobalState.isOverlayActive && video === GlobalState.currentVideo) {
                    applyTransforms();
                  } else {
                    enforceDimensions(video);
                  }
                  video.removeEventListener('loadeddata', onReloaded);
                }, { once: true });
              }
            }, 100);
          }
        }

        // Watch for style changes that might affect dimensions
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          // Enforce dimensions if they've been changed
          enforceDimensionsIfNeeded(video);
        }
      }
    });

    observer.observe(video, {
      attributes: true,
      attributeFilter: ['src', 'style', 'width', 'height']
    });

    video._srcObserver = observer;

    // Also listen for multiple events to catch dimension changes
    const dimensionCheckEvents = ['loadeddata', 'loadedmetadata', 'resize', 'canplay'];
    dimensionCheckEvents.forEach(eventType => {
      video.addEventListener(eventType, () => {
        if (video._originalDimensions && GlobalState.hdMode) {
          enforceDimensions(video);
        }
      });
    });

    // Periodic HD quality check (every 5 seconds) — coarse safety net for paused videos.
    // The _timeUpdateHDHandler below handles source-drift detection in real time during
    // playback, so a slow fallback interval is sufficient here.
    video._hdQualityCheckInterval = setInterval(() => {
      if (!GlobalState.hdMode || video !== GlobalState.currentVideo) return;

      const currentSrc = video.currentSrc || video.src;
      const hdUrl = video._hdUrl;

      // If HD was applied but source has drifted, re-apply
      if (hdUrl && currentSrc && currentSrc !== hdUrl && video._hdApplied) {
        if (isHDRestorationPaused(video)) {
          markHDDriftAccepted(video);
          return;
        }

        const now = Date.now();
        if (now - video._lastHDReapplyTime >= HD_REAPPLY_COOLDOWN) {
          log('Periodic check: HD source drifted, re-applying...');
          video._hdApplied = false;
          video._lastHDReapplyTime = now;
          applyHDToVideo(video);
        }
      }
    }, 5000); // Reduced from 1000ms — real-time drift is caught by timeupdate handler

    // Replace 500ms dimension poll with a ResizeObserver so we only fire on actual resize
    if (typeof ResizeObserver !== 'undefined') {
      const dimObserver = new ResizeObserver(() => {
        if (video._originalDimensions && GlobalState.hdMode) {
          enforceDimensionsIfNeeded(video);
        }
      });
      dimObserver.observe(video);
      video._dimensionResizeObserver = dimObserver;
    } else {
      // Fallback for environments without ResizeObserver
      video._dimensionCheckInterval = setInterval(() => {
        if (video._originalDimensions && GlobalState.hdMode) {
          enforceDimensionsIfNeeded(video);
        }
      }, 500);
    }

    // Listen for timeupdate to catch source changes during playback
    // Instagram can swap sources mid-stream without triggering src attribute mutation
    let lastCheckedSrc = video.currentSrc || video.src;
    const onTimeUpdate = throttle(() => {
      if (!GlobalState.hdMode || video !== GlobalState.currentVideo) return;

      const currentSrc = video.currentSrc || video.src;
      const hdUrl = video._hdUrl;

      // If source changed during playback away from HD
      if (hdUrl && currentSrc !== lastCheckedSrc) {
        lastCheckedSrc = currentSrc;

        if (currentSrc !== hdUrl && video._hdApplied) {
          if (isHDRestorationPaused(video)) {
            markHDDriftAccepted(video);
            return;
          }

          const now = Date.now();
          if (now - video._lastHDReapplyTime >= HD_REAPPLY_COOLDOWN) {
            log('Timeupdate: Source drifted from HD during playback, restoring...');
            video._hdApplied = false;
            video._lastHDReapplyTime = now;

            // Restore HD with minimal disruption
            const wasPlaying = !video.paused;
            const currentTime = video.currentTime;
            const wasMuted = video.muted;
            const volume = video.volume;

            video.src = hdUrl;
            video._hdApplied = true;

            video.addEventListener('loadeddata', function restore() {
              video.currentTime = currentTime;
              video.muted = wasMuted;
              video.volume = volume;
              if (wasPlaying) {
                video.play().catch(() => { });
              }
              video.removeEventListener('loadeddata', restore);
            }, { once: true });
          }
        }
      }
    }, 250); // Throttle to 4x/sec to avoid performance issues

    video.addEventListener('timeupdate', onTimeUpdate);
    video._timeUpdateHDHandler = onTimeUpdate;
  }

  /**
   * Capture a stable display size for the current reel.
   * This is used to keep frame size consistent when Instagram swaps SD/HD sources.
   */
  function captureVideoDimensions(video, force = false) {
    if (!video) return null;
    if (video._originalDimensions && !force) return video._originalDimensions;

    const isOverlayVideo = video.classList.contains('ir-overlay-video') ||
      (GlobalState.isOverlayActive && video === GlobalState.currentVideo);
    const styleWidth = parseFloat(video.style.width);
    const styleHeight = parseFloat(video.style.height);
    const rect = isOverlayVideo ? null : video.getBoundingClientRect();

    // getBoundingClientRect() includes CSS transforms. In rotation mode that
    // reports the visual, swapped box, so prefer untransformed layout dimensions.
    const width = Math.round(
      (isOverlayVideo ? styleWidth : 0) ||
      video.offsetWidth ||
      rect?.width ||
      0
    );
    const height = Math.round(
      (isOverlayVideo ? styleHeight : 0) ||
      video.offsetHeight ||
      rect?.height ||
      0
    );

    if (width > 0 && height > 0) {
      video._originalDimensions = { width, height };
      return video._originalDimensions;
    }

    return null;
  }

  /**
   * Force dimensions to original values
   */
  function enforceDimensions(video) {
    // Don't enforce dimensions when in overlay mode - transforms handle sizing
    if (GlobalState.isOverlayActive || GlobalState.enhancedModeActive) return;

    const original = video._originalDimensions || captureVideoDimensions(video);
    if (!original) return;

    video.style.width = original.width + 'px';
    video.style.height = original.height + 'px';
    video.style.minWidth = original.width + 'px';
    video.style.minHeight = original.height + 'px';
    video.style.maxWidth = original.width + 'px';
    video.style.maxHeight = original.height + 'px';
  }

  /**
   * Only enforce if dimensions have drifted
   */
  function enforceDimensionsIfNeeded(video) {
    // Don't enforce dimensions when in overlay mode - transforms handle sizing
    if (GlobalState.isOverlayActive || GlobalState.enhancedModeActive) return;

    const original = video._originalDimensions || captureVideoDimensions(video);
    if (!original) return;

    const current = { width: video.offsetWidth, height: video.offsetHeight };

    // Allow 1px tolerance for rounding
    if (Math.abs(current.width - original.width) > 1 || Math.abs(current.height - original.height) > 1) {
      log('Dimensions drifted, enforcing:', original);
      enforceDimensions(video);
    }
  }

  /**
   * Extract URL key for matching (same as interceptor)
   */
  function extractUrlKey(url) {
    if (!url) return null;

    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      const segments = path.split('/').filter(s => s.length > 0);
      const lastSegment = segments[segments.length - 1];

      if (lastSegment) {
        return lastSegment.split('.')[0];
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Find HD info for a video - tries multiple strategies with fast timeout
   */
  function findHDInfo(videoUrl) {
    // Strategy 1: Query the injected script's API if available
    if (window.__angel_hd && window.__angel_hd.getHDForUrl) {
      const hdInfo = window.__angel_hd.getHDForUrl(videoUrl);
      if (hdInfo && hdInfo.url) {
        log('Found HD via interceptor API');
        return cacheHDVideoData(hdInfo);
      }
    }

    // Strategy 2: Check our local cache populated by page-context events
    const localHD = getLocalHDForUrl(videoUrl);
    if (localHD?.url) {
      log('Found HD via local event cache');
      return localHD;
    }

    // Strategy 3: Check our local map by URL key
    const urlKey = extractUrlKey(videoUrl);
    if (urlKey) {
      for (const [key, value] of GlobalState.hdVideoMap.entries()) {
        if (!value?.url) continue;
        if (extractUrlKey(value.url) === urlKey || key.includes(urlKey)) {
          log('Found HD via local map');
          return value;
        }
      }
    }

    // Strategy 4: Get the latest HD video if it was captured recently (8s window)
    const recentLocal = getRecentLocalHD(8000);
    if (recentLocal?.url) {
      log('Using latest local HD video (within 8s window)');
      return recentLocal;
    }

    if (window.__angel_hd && window.__angel_hd.getLatestHD) {
      const latest = window.__angel_hd.getLatestHD();
      if (latest && latest.url) {
        if (Date.now() - latest.timestamp < 8000) {
          log('Using latest HD video (within 8s window)');
          return cacheHDVideoData(latest);
        }
      }
    }

    // Strategy 5: Use globally highest quality HD from cache as last resort
    const bestLocal = getHighestQualityLocalHD(120000);
    if (bestLocal?.url) {
      log('Using highest quality local HD from cache');
      return bestLocal;
    }

    if (window.__angel_hd && window.__angel_hd.getHighestQualityHD) {
      const best = window.__angel_hd.getHighestQualityHD();
      if (best && best.url) {
        // Only use if it's from the current session (within last 2 minutes)
        if (Date.now() - best.timestamp < 120000) {
          log('Using highest quality HD from cache');
          return cacheHDVideoData(best);
        }
      }
    }

    // Strategy 6: Trigger a proactive API fetch for the current page's shortcode
    // so next retry attempt will find the HD URL
    if (window.__angel_hd && window.__angel_hd.fetchCurrentPageHD) {
      window.__angel_hd.fetchCurrentPageHD();
    }

    return null;
  }

  /**
   * v4: Adaptive retry configuration with exponential backoff and jitter
   */
  const HD_RETRY_CONFIG = {
    initialDelay: 100,    // Start fast (100ms vs previous 200ms)
    maxDelay: 1000,       // Cap at 1s
    maxAttempts: 5,       // More attempts with shorter initial delays
    maxWaitTime: 4000,    // Reduced from 5s for faster fallback
    jitter: 0.2           // 20% randomization to prevent thundering herd
  };

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  function getRetryDelay(attempt) {
    const base = Math.min(
      HD_RETRY_CONFIG.initialDelay * Math.pow(2, attempt),
      HD_RETRY_CONFIG.maxDelay
    );
    const jitter = base * HD_RETRY_CONFIG.jitter * (Math.random() - 0.5);
    return Math.round(base + jitter);
  }

  /**
   * Attempt to apply HD source to a video element with robust retry and smooth fallback
   * v4: Now with request deduplication and adaptive retry with jitter
   */
  function applyHDToVideo(video) {
    if (!video || !GlobalState.hdMode) return false;
    if (isHDRestorationPaused(video)) {
      log('HD apply skipped while Instagram interaction settles');
      markHDDriftAccepted(video);
      return false;
    }

    const currentSrc = video.currentSrc || video.src;
    if (!currentSrc) return false;

    // Don't re-apply if already applied
    if (video._hdApplied) return false;

    // v4: Check for pending request for same video (deduplication)
    if (GlobalState.pendingHDRequests.has(currentSrc)) {
      log('HD request already pending for this video, skipping duplicate');
      return false;
    }

    // Mark request as pending
    GlobalState.pendingHDRequests.set(currentSrc, Date.now());

    // Initialize retry counter if needed
    if (!video._hdRetryCount) {
      video._hdRetryCount = 0;
      video._hdAttemptStartTime = Date.now();
    }

    // Track HD attempts
    GlobalState.performanceMetrics.hdAttempts++;

    // Set loading state only on first attempt
    if (video._hdRetryCount === 0) {
      GlobalState.hdLoading = true;
      updateControlPanel();
    }

    // Find HD info using multiple strategies
    let hdInfo = findHDInfo(currentSrc);

    // Fallback: if Instagram briefly downgrades after interactions, reuse last known HD URL.
    if ((!hdInfo || !hdInfo.url) && video._hdUrl) {
      hdInfo = {
        url: video._hdUrl,
        width: GlobalState.currentVideoQuality?.width || video.videoWidth || 0,
        height: GlobalState.currentVideoQuality?.height || video.videoHeight || 0
      };
      log('Using stored HD URL fallback');
    }

    // v4: Use adaptive retry config
    const elapsedTime = Date.now() - video._hdAttemptStartTime;

    if (!hdInfo || !hdInfo.url) {
      // Check if we should give up (smooth fallback)
      if (video._hdRetryCount >= HD_RETRY_CONFIG.maxAttempts || elapsedTime >= HD_RETRY_CONFIG.maxWaitTime) {
        log('HD not available after retries, falling back to SD gracefully');
        video._hdApplied = true; // Mark as "attempted" to prevent further retries
        GlobalState.hdLoading = false;
        GlobalState.pendingHDRequests.delete(currentSrc); // Clean up pending
        GlobalState.hdAppliedToCurrentVideo = false;
        updateControlPanel();
        // No notification for fallback - silent and smooth
        return false;
      }

      // v4: Retry with adaptive exponential backoff + jitter
      video._hdRetryCount++;
      const backoffDelay = getRetryDelay(video._hdRetryCount);
      const retryEpoch = GlobalState.hdInteractionEpoch;
      log(`No HD found, retry ${video._hdRetryCount}/${HD_RETRY_CONFIG.maxAttempts} in ${backoffDelay}ms...`);

      setTimeout(() => {
        if (
          retryEpoch === GlobalState.hdInteractionEpoch &&
          !isHDRestorationPaused(video) &&
          !video._hdApplied &&
          GlobalState.hdMode &&
          video === GlobalState.currentVideo
        ) {
          GlobalState.pendingHDRequests.delete(currentSrc); // Allow retry
          applyHDToVideo(video);
        } else {
          GlobalState.pendingHDRequests.delete(currentSrc); // Clean up
        }
      }, backoffDelay);
      return false;
    }

    // Check if we're already at HD quality (no upgrade needed)
    if (currentSrc === hdInfo.url) {
      video._hdApplied = true;
      GlobalState.currentVideoQuality = { width: hdInfo.width, height: hdInfo.height };
      GlobalState.hdAppliedToCurrentVideo = true;
      GlobalState.hdLoading = false;
      GlobalState.pendingHDRequests.delete(currentSrc); // Clean up pending
      GlobalState.performanceMetrics.hdSuccesses++;
      updateControlPanel();
      // NO NOTIFICATION - already at HD quality
      return true;
    }

    // Store current playback state
    const wasPlaying = !video.paused;
    const currentTime = video.currentTime;
    const wasMuted = video.muted;
    const volume = video.volume;

    const isOverlayVideo = GlobalState.isOverlayActive && video === GlobalState.currentVideo;
    let originalWidth = 0;
    let originalHeight = 0;
    let originalObjectFit = 'contain';

    if (!isOverlayVideo) {
      // Preserve stable video dimensions to prevent SD/HD source swaps from changing frame size.
      const originalDims = captureVideoDimensions(video) || {
        width: Math.round(video.offsetWidth || 0),
        height: Math.round(video.offsetHeight || 0)
      };
      originalWidth = originalDims.width;
      originalHeight = originalDims.height;
      const computedStyle = window.getComputedStyle(video);
      originalObjectFit = computedStyle.objectFit;
    }

    log('Upgrading to HD:', hdInfo.width + 'x' + hdInfo.height);

    if (isOverlayVideo) {
      applyTransforms();
    } else {
      // Aggressively lock dimensions before source change in inline mode only.
      video.style.width = originalWidth + 'px';
      video.style.height = originalHeight + 'px';
      video.style.minWidth = originalWidth + 'px';
      video.style.minHeight = originalHeight + 'px';
      video.style.maxWidth = originalWidth + 'px';
      video.style.maxHeight = originalHeight + 'px';
      video.style.objectFit = originalObjectFit || 'contain';
    }

    // Replace source and store HD URL for reversion detection
    video.src = hdInfo.url;
    video._hdApplied = true;
    video._hdUrl = hdInfo.url; // Store for observer to detect if Instagram reverts

    // Restore state when loaded
    video.addEventListener('loadeddata', function onLoaded() {
      GlobalState.hdLoading = false;

      video.currentTime = currentTime;
      video.muted = wasMuted;
      video.volume = volume;
      if (wasPlaying) {
        video.play().catch(() => { });
      }

      // Re-enforce dimensions after load in inline mode. Overlay mode is sized
      // from viewport math, not from the swapped rotated bounding rectangle.
      if (isOverlayVideo && GlobalState.isOverlayActive && video === GlobalState.currentVideo) {
        applyTransforms();
      } else {
        enforceDimensions(video);
      }

      video.removeEventListener('loadeddata', onLoaded);
    }, { once: true });

    GlobalState.currentVideoQuality = { width: hdInfo.width, height: hdInfo.height };
    GlobalState.hdAppliedToCurrentVideo = true;
    GlobalState.performanceMetrics.hdSuccesses++; // Track success
    GlobalState.pendingHDRequests.delete(currentSrc); // v4: Clean up pending request

    // v4: Trigger prefetch for upcoming videos
    triggerHDPrefetch();

    // Silent upgrade: repeated HD toasts are noisy while browsing.
    updateControlPanel();

    return true;
  }

  /**
   * v4: Prefetch HD URLs for upcoming videos for faster loading
   */
  function triggerHDPrefetch() {
    if (!window.__angel_hd?.prefetchForVideos) return;

    try {
      // Find all video elements on page that aren't current
      const allVideos = document.querySelectorAll('video');
      const upcomingUrls = [];

      for (const video of allVideos) {
        if (video !== GlobalState.currentVideo) {
          const src = video.currentSrc || video.src;
          if (src && !video._hdApplied) {
            upcomingUrls.push(src);
          }
        }
      }

      if (upcomingUrls.length > 0) {
        const prefetched = window.__angel_hd.prefetchForVideos(upcomingUrls);
        if (prefetched > 0) {
          log(`Prefetch triggered for ${prefetched} upcoming videos`);
        }
      }
    } catch (e) {
      // Non-critical, ignore errors
    }
  }

  /**
   * Toggle HD mode on/off
   */
  function toggleHDMode() {
    GlobalState.hdMode = !GlobalState.hdMode;
    Settings.saveHDMode();

    if (GlobalState.hdMode) {
      showToast('HD Mode ON', '📺');
      // Try to apply HD to current video
      if (GlobalState.currentVideo) {
        GlobalState.currentVideo._hdApplied = false;
        applyHDToVideo(GlobalState.currentVideo);
      }
    } else {
      showToast('HD Mode OFF (Auto)', '📺');
      GlobalState.hdAppliedToCurrentVideo = false;
    }

    updateControlPanel();
  }

  /**
   * Get quality label for display
   */
  function formatVideoTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Shared resolution bucket helper.
   * Returns { simple, full } — simple is the badge label, full includes dimensions.
   */
  function resolveQualityStrings(height, width) {
    let tier;
    if (height >= 2160)      tier = '4K';
    else if (height >= 1440) tier = '1440p';
    else if (height >= 1080) tier = '1080p';
    else if (height >= 720)  tier = '720p';
    else if (height >= 480)  tier = '480p';
    else                     tier = `${height}p`;
    return { simple: tier, full: `${tier} (${width}×${height})` };
  }

  function getQualityLabel() {
    if (GlobalState.hdLoading) return '⏳ Loading...';
    if (!GlobalState.hdMode)  return 'SD';

    const video = GlobalState.currentVideo;
    if (video && video.videoHeight > 0) {
      return resolveQualityStrings(video.videoHeight, video.videoWidth).full;
    }
    const q = GlobalState.currentVideoQuality;
    if (q && q.height) {
      return resolveQualityStrings(q.height, q.width || '?').full;
    }
    if (window.__angel_hd?.getStats && window.__angel_hd.getStats().totalVideos === 0) {
      return 'Waiting for HD...';
    }
    return GlobalState.hdAppliedToCurrentVideo ? 'HD' : 'SD';
  }

  function getSimpleQualityLabel() {
    const video = GlobalState.currentVideo;
    if (video && video.videoHeight > 0) {
      return resolveQualityStrings(video.videoHeight, video.videoWidth).simple;
    }
    const q = GlobalState.currentVideoQuality;
    if (q && q.height) {
      return resolveQualityStrings(q.height, q.width || 0).simple;
    }
    return GlobalState.hdMode ? 'HD' : 'SD';
  }

  // ============================================
  // INSTAGRAM INTERACTION (Like, Share, Comment)
  // ============================================

  function findReelActionButtons() {
    // Instagram's reel action buttons are in the main page, not in our overlay
    // This function needs to be very robust as Instagram changes DOM frequently

    const buttons = {};

    // In overlay mode, trust the tracked current video and its original container.
    // findActiveVideo() can drift to adjacent reels while rotated/overlay is active.
    const isOverlayContext = GlobalState.isOverlayActive && !!GlobalState.currentVideo;

    // CRITICAL: Always get fresh video reference to avoid targeting wrong reel
    // This fixes the race condition when user likes right after scrolling
    const video = isOverlayContext ? GlobalState.currentVideo : findActiveVideo();

    // Update GlobalState if we found a different video (handles scroll timing issues)
    if (video && video !== GlobalState.currentVideo) {
      log('findReelActionButtons: syncing to new video');
      handleVideoChange(video);
    }
    let reelContainer = null;

    if (video) {
      const containerSource = (isOverlayContext && video._ir_originalParent)
        ? video._ir_originalParent
        : video;

      // Find the reel container (article or section containing the video)
      // Be very specific to avoid picking up other reels' containers
      reelContainer = containerSource.closest('article') ||
        containerSource.closest('section') ||
        containerSource.closest('[role="presentation"]') ||
        containerSource.closest('div[style*="height: 100%"]');

      // If no container found, try parent traversal to find a reel-like container
      if (!reelContainer) {
        let parent = containerSource.parentElement;
        for (let i = 0; i < 10 && parent; i++) {
          // Look for a container that seems like a reel wrapper
          if (parent.querySelector('svg[aria-label]') ||
            parent.querySelector('[aria-label*="like" i]') ||
            parent.querySelector('[aria-label*="comment" i]')) {
            reelContainer = parent;
            break;
          }
          parent = parent.parentElement;
        }
      }
    }

    // CRITICAL FIX: Only search within the reel container
    // Do NOT fall back to broader areas - this causes the wrong-reel bug
    // If we can't find the reel container, we should still try to find buttons
    // but verify they're in the same viewport position as the video
    const searchAreas = reelContainer ? [reelContainer] : [];

    // If no reel container, use viewport-based search as fallback
    // CRITICAL: Get fresh video rect to ensure we match buttons to the current visible video
    // In overlay mode, use the original placeholder position to match the right reel actions.
    const videoRect = video
      ? ((isOverlayContext && video._ir_placeholder)
        ? video._ir_placeholder.getBoundingClientRect()
        : video.getBoundingClientRect())
      : null;

    // Additional check: verify video is actually visible in viewport
    if (videoRect) {
      const viewportHeight = window.innerHeight;
      const videoCenterY = videoRect.top + videoRect.height / 2;
      // If video center is not within viewport, something is wrong
      if (videoCenterY < 0 || videoCenterY > viewportHeight) {
        log('Warning: current video not centered in viewport, refreshing video reference');
        const freshVideo = findActiveVideo();
        if (freshVideo && freshVideo !== video) {
          handleVideoChange(freshVideo);
          // Return empty - caller should retry
          return {};
        }
      }
    }

    // Strategy 1: Find buttons by aria-label (most reliable)
    const ariaLabelPatterns = {
      like: [/^like$/i, /^unlike$/i, /^gefällt mir$/i, /^me gusta$/i, /^j'aime$/i, /^mi piace$/i],
      save: [/^save$/i, /^remove$/i, /^unsave$/i, /^guardar$/i, /^enregistrer$/i, /^speichern$/i, /^salva$/i],
      comment: [/^comment$/i, /^view comments$/i, /^comentar$/i, /^commenter$/i, /^kommentieren$/i],
      share: [/^share$/i, /^send$/i, /^share post$/i, /^compartir$/i, /^partager$/i, /^teilen$/i, /^condividi$/i]
    };

    // Strategy 2: SVG path signatures (Instagram heart has distinctive paths)
    const svgPathSignatures = {
      like: [
        'M16.792', // Instagram heart outline
        'M34.6 3.1', // Instagram heart filled
        'M20.884', // Another heart variant
        'M1 8.5', // Compact heart
        'M12 21.35', // Standard heart
        'M16.5 3' // Another heart
      ],
      save: [
        'M20 22', // Bookmark path
        'M17 3H7', // Save icon
        'M5 21V5', // Bookmark variant
        'M19 21l-7-5' // Another bookmark
      ],
      comment: [
        'M20.656 17.008', // Comment bubble
        'M47.5 46.1', // Larger comment
        'M20 2c-10.025', // Chat bubble
        'M22.46 6c' // Speech bubble
      ],
      share: [
        'M22 3', // Paper plane / share
        'M15 8', // Send arrow
        'M18 16.08', // Share icon
        'M14.0453' // DM/share variant
      ]
    };

    // Helper: Check if element is visible and not in our overlay
    function isValidElement(el) {
      if (!el) return false;

      // Check not in our overlay
      if (el.closest('#angel-overlay, #angel-backdrop, #angel-ctrl')) return false;

      // Check if element or any parent has a class starting with 'angel-' or 'ir-'
      let current = el;
      while (current && current !== document.body) {
        if (current.id && (current.id.startsWith('angel-') || current.id.startsWith('ir-'))) return false;
        if (current.className && typeof current.className === 'string') {
          const classes = current.className.split(' ');
          for (const cls of classes) {
            if (cls.startsWith('angel-') || cls.startsWith('ir-')) return false;
          }
        }
        current = current.parentElement;
      }

      // Check visibility
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      // Check computed visibility
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;

      // CRITICAL: Verify button is in viewport and near the current video
      // This prevents finding buttons from other reels that might be partially visible
      if (videoRect) {
        // Button should be within reasonable vertical range of the video
        // Instagram reels show action buttons on the right side of the video
        const buttonCenterY = rect.top + rect.height / 2;
        const videoCenterY = videoRect.top + videoRect.height / 2;
        const verticalDistance = Math.abs(buttonCenterY - videoCenterY);

        // Allow buttons within 80% of video height distance from video center
        const maxDistance = videoRect.height * 0.8;
        if (verticalDistance > maxDistance) {
          return false;
        }
      }

      return true;
    }

    // Helper: Find clickable parent
    function findClickableParent(el, maxDepth = 10) {
      let current = el;
      for (let i = 0; i < maxDepth && current; i++) {
        if (current.tagName === 'BUTTON' ||
          current.tagName === 'A' ||
          current.getAttribute('role') === 'button' ||
          current.hasAttribute('tabindex') ||
          current.onclick ||
          (current.className && typeof current.className === 'string' &&
            (current.className.includes('_abl-') || current.className.includes('x1i10hfl')))) {
          return current;
        }
        current = current.parentElement;
      }
      // Fallback: try closest common patterns
      return el.closest('button, [role="button"], a[tabindex]') || el;
    }

    // Method 1: Search by aria-label on any element
    for (const searchArea of searchAreas) {
      if (!searchArea) continue;

      // Get all elements with aria-label
      const elementsWithLabel = searchArea.querySelectorAll('[aria-label]');

      for (const el of elementsWithLabel) {
        const label = el.getAttribute('aria-label') || '';

        for (const [action, patterns] of Object.entries(ariaLabelPatterns)) {
          if (buttons[action]) continue;

          for (const pattern of patterns) {
            if (pattern.test(label)) {
              if (isValidElement(el)) {
                buttons[action] = findClickableParent(el);
                log(`Found ${action} button via aria-label: "${label}"`);
                break;
              }
            }
          }
        }
      }
    }

    // Method 2: Search SVGs by their path data
    for (const searchArea of searchAreas) {
      if (!searchArea) continue;

      const svgs = searchArea.querySelectorAll('svg');

      for (const svg of svgs) {
        if (!isValidElement(svg)) continue;

        // Check aria-label on SVG itself
        const svgLabel = svg.getAttribute('aria-label') || '';
        for (const [action, patterns] of Object.entries(ariaLabelPatterns)) {
          if (buttons[action]) continue;
          for (const pattern of patterns) {
            if (pattern.test(svgLabel)) {
              buttons[action] = findClickableParent(svg);
              log(`Found ${action} button via SVG aria-label: "${svgLabel}"`);
              break;
            }
          }
        }

        // Check path data signatures
        const paths = svg.querySelectorAll('path, polygon, circle');
        for (const path of paths) {
          const d = path.getAttribute('d') || '';
          const points = path.getAttribute('points') || '';
          const pathData = d + points;

          for (const [action, signatures] of Object.entries(svgPathSignatures)) {
            if (buttons[action]) continue;

            for (const sig of signatures) {
              if (pathData.includes(sig)) {
                buttons[action] = findClickableParent(svg);
                log(`Found ${action} button via SVG path signature`);
                break;
              }
            }
          }
        }
      }
    }

    // Method 3: Look for buttons in typical Instagram reel action bar positions
    // Instagram reels usually have actions in a vertical bar on the right side
    if (!buttons.like || !buttons.save) {
      for (const searchArea of searchAreas) {
        if (!searchArea) continue;

        // Find all SVGs that might be action buttons
        const actionSvgs = searchArea.querySelectorAll('svg[width="24"], svg[height="24"], svg[viewBox*="24"]');
        const validSvgs = Array.from(actionSvgs).filter(isValidElement);

        // Group by vertical position (Instagram shows actions vertically)
        const svgsByPosition = validSvgs.sort((a, b) => {
          const rectA = a.getBoundingClientRect();
          const rectB = b.getBoundingClientRect();
          return rectA.top - rectB.top;
        });

        // Usually order is: Like, Comment, Share, Save (top to bottom)
        // Or sometimes: Like, Comment, Share, Audio, Save
        if (svgsByPosition.length >= 3) {
          if (!buttons.like && svgsByPosition[0]) {
            const candidate = findClickableParent(svgsByPosition[0]);
            // Verify it looks like a like button (has heart-like content or proper label)
            const svg = svgsByPosition[0];
            const pathD = svg.querySelector('path')?.getAttribute('d') || '';
            if (pathD.toLowerCase().includes('m') && (pathD.includes('c') || pathD.includes('C'))) {
              // Could be like button by position, but only use if we have no other option
              if (!buttons.like) {
                log('Found potential like button by position (first action icon)');
                buttons.like = candidate;
              }
            }
          }
        }
      }
    }

    // Method 4: Fallback - Search globally but use viewport filtering from isValidElement
    // This is only used when no reel container was found
    if (searchAreas.length === 0 && videoRect && (!buttons.like || !buttons.save)) {
      log('No reel container found, using viewport-based global search');

      // Search globally but isValidElement will filter by viewport proximity
      const globalSearch = document.body;
      const elementsWithLabel = globalSearch.querySelectorAll('[aria-label]');

      for (const el of elementsWithLabel) {
        const label = el.getAttribute('aria-label') || '';

        for (const [action, patterns] of Object.entries(ariaLabelPatterns)) {
          if (buttons[action]) continue;

          for (const pattern of patterns) {
            if (pattern.test(label)) {
              if (isValidElement(el)) {
                buttons[action] = findClickableParent(el);
                log(`Found ${action} button via global viewport search: "${label}"`);
                break;
              }
            }
          }
        }
      }
    }

    // Method 5: Double-tap like area (Instagram allows double-tap on video to like)
    // Store reference for fallback like action
    if (!buttons.like && video) {
      buttons._doubleTapFallback = true;
      log('Will use double-tap fallback for like');
    }

    // Log results
    const foundActions = Object.keys(buttons).filter(k => !k.startsWith('_'));
    if (foundActions.length > 0) {
      log('Found action buttons:', foundActions.join(', '));
    } else {
      log('Warning: No action buttons found - will use fallbacks');
    }

    return buttons;
  }

  // Shared click helper for all button interactions
  function simulateButtonClick(element) {
    if (!element) return false;
    try {
      // Store scroll position before click to detect unwanted scrolls
      const scrollContainer = getScrollContainer();
      const scrollBefore = scrollContainer ? scrollContainer.scrollTop : window.scrollY;

      // Focus the element first for better React compatibility
      // Use preventScroll to avoid any scroll jump
      if (typeof element.focus === 'function') {
        element.focus({ preventScroll: true });
      }

      // Get element position for realistic mouse events
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Create realistic event options
      const eventOptions = {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: centerX,
        clientY: centerY,
        screenX: centerX,
        screenY: centerY,
        button: 0,
        buttons: 1
      };

      // Simulate full pointer/mouse event sequence for React
      // Use only pointer events first (React 17+ uses pointer events)
      element.dispatchEvent(new PointerEvent('pointerdown', { ...eventOptions, bubbles: true, cancelable: true, pointerType: 'mouse' }));
      element.dispatchEvent(new PointerEvent('pointerup', { ...eventOptions, bubbles: true, cancelable: true, pointerType: 'mouse' }));

      // Then trigger a native click
      element.click();

      // CRITICAL: Restore scroll position if it changed unexpectedly
      // This fixes the weird scroll behavior on like shortcut
      requestAnimationFrame(() => {
        const scrollAfter = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
        const scrollDiff = Math.abs(scrollAfter - scrollBefore);

        // If scroll changed by more than a small threshold, restore it
        if (scrollDiff > 50 && scrollDiff < window.innerHeight * 0.8) {
          log('Restoring scroll position after button click (drift:', scrollDiff, ')');
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollBefore;
          } else {
            window.scrollTo(0, scrollBefore);
          }
        }
      });

      return true;
    } catch (err) {
      log('Button click error:', err);
      return false;
    }
  }

  // Helper to check if like state changed
  function getLikeState(buttons) {
    if (!buttons?.like) return null;
    const svg = buttons.like.querySelector('svg') || buttons.like;
    const label = (svg.getAttribute('aria-label') || '').toLowerCase();
    // Check fill color as well (liked hearts are filled with red)
    const fill = svg.getAttribute('fill') || '';
    const hasFill = fill && fill !== 'none' && fill !== 'currentColor' && fill !== 'inherit';
    return label.includes('unlike') || label.includes('remove') || label.includes('quitar') || hasFill;
  }

  // Helper to check if save state changed  
  function getSaveState(buttons) {
    if (!buttons?.save) return null;
    const svg = buttons.save.querySelector('svg') || buttons.save;
    const label = (svg.getAttribute('aria-label') || '').toLowerCase();
    // Check fill as well (saved bookmarks are filled)
    const fill = svg.getAttribute('fill') || '';
    const hasFill = fill && fill !== 'none' && fill !== 'currentColor' && fill !== 'inherit';
    return label.includes('remove') || label.includes('unsave') || label.includes('quitar') || hasFill;
  }

  function triggerLike() {
    // Ensure we have the current reel's video before finding buttons
    // This prevents liking the previous reel when user scrolls then quickly likes
    const useOverlayVideo = GlobalState.isOverlayActive && !!GlobalState.currentVideo;
    const currentVideo = useOverlayVideo ? GlobalState.currentVideo : findActiveVideo();
    if (!useOverlayVideo && currentVideo && currentVideo !== GlobalState.currentVideo) {
      log('triggerLike: syncing to new video before action');
      handleVideoChange(currentVideo);
      // Give DOM time to settle after video change
      setTimeout(() => triggerLike(), 100);
      return;
    }

    // CRITICAL: Verify we're not in the middle of a scroll
    // Check if video is properly centered in viewport
    if (currentVideo) {
      const rect = currentVideo.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const videoCenterY = rect.top + rect.height / 2;
      const centerOffset = Math.abs(videoCenterY - viewportHeight / 2);

      // If video is more than 30% off-center, wait for scroll to complete
      if (centerOffset > viewportHeight * 0.3) {
        log('triggerLike: video not centered, waiting for scroll to settle...');
        setTimeout(() => triggerLike(), 200);
        return;
      }
    }

    const buttons = findReelActionButtons();

    // If findReelActionButtons returned empty (due to stale video), retry
    if (Object.keys(buttons).length === 0 && !buttons._doubleTapFallback) {
      log('triggerLike: no buttons found, retrying...');
      setTimeout(() => triggerLike(), 150);
      return;
    }

    const wasLiked = getLikeState(buttons);

    log('triggerLike called, button found:', !!buttons.like, 'current state:', wasLiked);

    // Helper for double-tap like on video (fallback)
    function doubleTapLike(callback) {
      const video = GlobalState.currentVideo || findActiveVideo();
      if (!video) {
        callback(false);
        return;
      }

      // Find the video's display container - Instagram uses specific structure
      const container = video.closest('div[role="button"]') ||
        video.closest('article') ||
        video.parentElement?.parentElement;  // Go up two levels for reel container

      if (!container) {
        callback(false);
        return;
      }

      log('Attempting double-tap like on video container');

      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Simulate proper double-click for Instagram
      const createTouchEvent = (type) => new MouseEvent(type, {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: centerX,
        clientY: centerY,
        detail: type === 'dblclick' ? 2 : 1
      });

      // Instagram uses dblclick event for liking
      container.dispatchEvent(createTouchEvent('dblclick'));

      // Check if like succeeded after a delay
      setTimeout(() => {
        const newButtons = findReelActionButtons();
        const isNowLiked = getLikeState(newButtons);
        callback(isNowLiked === true); // Only success if now liked
      }, 300);
    }

    function verifyAndShowResult() {
      // Wait for Instagram to update the DOM
      setTimeout(() => {
        const newButtons = findReelActionButtons();
        const isNowLiked = getLikeState(newButtons);

        log('Like verification - was:', wasLiked, 'now:', isNowLiked);

        // Check if state actually changed
        if (wasLiked !== null && isNowLiked !== null && wasLiked !== isNowLiked) {
          // State changed - action worked!
          showToast(isNowLiked ? 'Liked!' : 'Unliked', isNowLiked ? '❤️' : '🤍');
        } else if (isNowLiked !== null) {
          // State didn't change but we have a state - show current state
          showToast(isNowLiked ? 'Already liked' : 'Already unliked', isNowLiked ? '❤️' : '🤍');
        } else {
          // Couldn't verify - be honest
          showToast('Action sent', '🔄');
        }
        updateControlPanel();
      }, 350); // Give Instagram time to update
    }

    if (buttons.like) {
      log('Clicking like button element');
      pauseHDRestoration(4500, 'like', currentVideo);
      simulateButtonClick(buttons.like);
      verifyAndShowResult();
    } else if (buttons._doubleTapFallback) {
      // Use double-tap fallback
      log('Using double-tap fallback for like');
      pauseHDRestoration(4500, 'double-tap like', currentVideo);
      doubleTapLike((success) => {
        if (success) {
          showToast('Liked!', '❤️');
        } else {
          showToast('Double-tap did not work', '⚠️');
        }
        updateControlPanel();
      });
    } else {
      // Retry with expanded search after a delay
      log('Like button not found, retrying with delay...');
      setTimeout(() => {
        const retryButtons = findReelActionButtons();
        if (retryButtons.like) {
          log('Found like button on retry');
          pauseHDRestoration(4500, 'like retry', GlobalState.currentVideo);
          simulateButtonClick(retryButtons.like);
          verifyAndShowResult();
        } else if (retryButtons._doubleTapFallback) {
          pauseHDRestoration(4500, 'double-tap like retry', GlobalState.currentVideo);
          doubleTapLike((success) => {
            if (success) {
              showToast('Liked!', '❤️');
            } else {
              showToast('Like button not found', '⚠️');
            }
          });
        } else {
          showToast('Like button not found', '⚠️');
          log('Could not find like button after retry');
        }
      }, 300);
    }
  }



  function triggerSave() {
    // Ensure we have the current reel's video before finding buttons
    // Mirrors the overlay-aware pattern from triggerLike()
    const useOverlayVideo = GlobalState.isOverlayActive && !!GlobalState.currentVideo;
    const currentVideo = useOverlayVideo ? GlobalState.currentVideo : findActiveVideo();
    if (!useOverlayVideo && currentVideo && currentVideo !== GlobalState.currentVideo) {
      log('triggerSave: syncing to new video before action');
      handleVideoChange(currentVideo);
      setTimeout(() => triggerSave(), 100);
      return;
    }

    // Verify we're not mid-scroll (same guard as triggerLike)
    if (currentVideo) {
      const rect = currentVideo.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const videoCenterY = rect.top + rect.height / 2;
      const centerOffset = Math.abs(videoCenterY - viewportHeight / 2);

      if (centerOffset > viewportHeight * 0.3) {
        log('triggerSave: video not centered, waiting for scroll to settle...');
        setTimeout(() => triggerSave(), 200);
        return;
      }
    }

    const buttons = findReelActionButtons();

    if (Object.keys(buttons).length === 0) {
      log('triggerSave: no buttons found, retrying...');
      setTimeout(() => triggerSave(), 150);
      return;
    }
    const wasSaved = getSaveState(buttons);

    log('triggerSave called, button found:', !!buttons.save, 'current state:', wasSaved);

    function verifyAndShowResult() {
      // Wait for Instagram to update the DOM
      setTimeout(() => {
        const newButtons = findReelActionButtons();
        const isNowSaved = getSaveState(newButtons);

        log('Save verification - was:', wasSaved, 'now:', isNowSaved);

        // Check if state actually changed
        if (wasSaved !== null && isNowSaved !== null && wasSaved !== isNowSaved) {
          // State changed - action worked!
          showToast(isNowSaved ? 'Saved!' : 'Unsaved', isNowSaved ? '🔖' : '📑');
        } else if (isNowSaved !== null) {
          // State didn't change but we have a state - show current state
          showToast(isNowSaved ? 'Already saved' : 'Already unsaved', isNowSaved ? '🔖' : '📑');
        } else {
          // Couldn't verify - be honest
          showToast('Action sent', '🔄');
        }
        updateControlPanel();
      }, 350); // Give Instagram time to update
    }

    if (buttons.save) {
      log('Clicking save button element');
      simulateButtonClick(buttons.save);
      verifyAndShowResult();
    } else {
      // Retry after a delay
      log('Save button not found, retrying...');
      setTimeout(() => {
        const retryButtons = findReelActionButtons();
        if (retryButtons.save) {
          log('Found save button on retry');
          simulateButtonClick(retryButtons.save);
          verifyAndShowResult();
        } else {
          showToast('Save button not found', '⚠️');
          log('Could not find save button after retry');
        }
      }, 300);
    }
  }

  // ============================================
  // DOWNLOAD REEL / PHOTO / CAROUSEL
  // ============================================

  function triggerDownload(requestedMediaInfo = null) {
    const mediaInfo = requestedMediaInfo || detectCurrentMedia();

    if (!mediaInfo.type || mediaInfo.type === 'unknown') {
      showToast('No media found to download', '⚠️');
      return;
    }

    if (mediaInfo.type === 'video') {
      downloadVideo(mediaInfo);
    } else if (mediaInfo.type === 'image') {
      downloadImage(mediaInfo);
    } else if (mediaInfo.type === 'carousel') {
      const totalCarouselSlides = getTotalSlides(mediaInfo.container);
      if (totalCarouselSlides <= 1) {
        downloadCurrentCarouselSlide(mediaInfo);
      } else {
        showCarouselDownloadPrompt(mediaInfo);
      }
    }
  }

  function getViewportMediaScore(media) {
    if (!media) return -Infinity;

    const rect = media.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 120) return -Infinity;

    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.hypot(centerX - viewportCenterX, centerY - viewportCenterY);
    const containsViewportCenter =
      viewportCenterX >= rect.left && viewportCenterX <= rect.right &&
      viewportCenterY >= rect.top && viewportCenterY <= rect.bottom;

    let score = rect.width * rect.height - distance * 140;
    if (containsViewportCenter) score += 250000;
    if (media.tagName === 'IMG') score += 2500;
    if (media.tagName === 'VIDEO' && !media.paused) score += 1500;
    if (media === GlobalState.currentVideo) score += 2000;
    return score;
  }

  function buildMediaContext(container, media = null) {
    if (!container) return null;

    const resolvedMedia = media && container.contains(media)
      ? media
      : getBestVisibleMediaInContainer(container);

    if (!resolvedMedia) return null;

    const mediaInfo = buildMediaInfo(container, resolvedMedia);
    if (!mediaInfo?.type || mediaInfo.type === 'unknown') return null;

    let score = scorePostContainerCandidate(container, resolvedMedia, 0) + getViewportMediaScore(resolvedMedia);
    if (mediaInfo.surface === MEDIA_SURFACES.REEL && mediaInfo.type === 'video') score += 400000;
    if (mediaInfo.surface === MEDIA_SURFACES.REEL && mediaInfo.type !== 'video') score -= 400000;
    if (mediaInfo.type === 'carousel') score += 3000;
    if (resolvedMedia.tagName === 'IMG' && mediaInfo.type !== 'video') score += 1250;
    if (resolvedMedia.tagName === 'VIDEO' && mediaInfo.type === 'video' && resolvedMedia.paused) score -= 300;

    return {
      container,
      media: resolvedMedia,
      mediaInfo,
      score
    };
  }

  function getMostRelevantMediaContext() {
    const contexts = [];
    const seenContainers = new Set();

    const addContext = (container, media = null) => {
      if (!container || seenContainers.has(container)) return;
      seenContainers.add(container);

      const context = buildMediaContext(container, media);
      if (context) {
        contexts.push(context);
      }
    };

    const explicitMediaCandidates = [
      findActiveImage(),
      findActiveVideo(),
      GlobalState.currentVideo?.isConnected ? GlobalState.currentVideo : null
    ].filter(Boolean);

    for (const media of explicitMediaCandidates) {
      addContext(findPostContainerFromElement(media), media);
    }

    const visibleContainers = Array.from(document.querySelectorAll('article, div[role="dialog"], section')).slice(0, 60);
    for (const container of visibleContainers) {
      if (!isVisibleUiElement(container)) continue;

      const rect = container.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;

      addContext(container);
    }

    if (contexts.length === 0) return null;
    contexts.sort((a, b) => b.score - a.score);
    return contexts[0];
  }

  function detectCurrentMedia() {
    const pageSurface = getMediaSurface();
    if (pageSurface === MEDIA_SURFACES.REEL || pageSurface === MEDIA_SURFACES.TV) {
      const reelVideo = findActiveVideo() || (GlobalState.currentVideo?.isConnected ? GlobalState.currentVideo : null);
      if (reelVideo) {
        const reelContainer = findPostContainerFromElement(reelVideo);
        const reelMedia = buildMediaInfo(reelContainer, reelVideo);
        if (reelMedia?.type === 'video') {
          return reelMedia;
        }

        return {
          type: 'video',
          video: reelVideo,
          container: reelContainer,
          shortcode: getCurrentShortcode(reelContainer),
          surface: pageSurface
        };
      }
    }

    const context = getMostRelevantMediaContext();
    if (context?.mediaInfo) {
      return context.mediaInfo;
    }

    const activeVideo = findActiveVideo();
    const video = activeVideo || (GlobalState.currentVideo?.isConnected ? GlobalState.currentVideo : null);
    const preferredMedia = video || findActiveImage();
    const container = preferredMedia ? findPostContainerFromElement(preferredMedia) : findPostContainer();

    if (!container) {
      if (preferredMedia?.tagName === 'VIDEO') {
        return { type: 'video', video: preferredMedia, container: null, surface: getMediaSurface() };
      }
      if (preferredMedia?.tagName === 'IMG') {
        return { type: 'image', img: preferredMedia, container: null, surface: getMediaSurface() };
      }
      return { type: 'unknown' };
    }

    return buildMediaInfo(container, preferredMedia || getBestVisibleMediaInContainer(container));
  }

  function detectMediaFromInteraction(target, point = null) {
    const pointInfo = point ? detectMediaFromPoint(point.x, point.y) : null;
    const targetInfo = detectMediaFromElement(target, point);

    return pointInfo || targetInfo || { type: 'unknown' };
  }

  function detectMediaFromPoint(x, y) {
    if (typeof document.elementsFromPoint !== 'function') return null;

    const elements = document.elementsFromPoint(x, y);
    for (const el of elements) {
      const info = detectMediaFromElement(el, { x, y });
      if (info?.type && info.type !== 'unknown') {
        return info;
      }
    }

    return null;
  }

  function detectMediaFromElement(target, point = null) {
    if (!target || target.nodeType !== Node.ELEMENT_NODE) return null;
    if (target.closest?.('#angel-hover-download-btn, #angel-ctrl, .angel-inline-download-slot')) return null;

    const directMedia = getClosestMediaElement(target);
    const container = findPostContainerFromElement(directMedia || target);
    const media = directMedia || getBestVisibleMediaInContainer(container, point);

    if (!container && !media) return null;

    return buildMediaInfo(container || findPostContainerFromElement(media), media);
  }

  function buildMediaInfo(container, preferredMedia = null) {
    const inferredContainer = container || preferredMedia?.closest?.('article, div[role="dialog"], [role="presentation"], section');
    const surface = getMediaSurface(inferredContainer);

    if (!container && preferredMedia) {
      return preferredMedia.tagName === 'VIDEO'
        ? { type: 'video', video: preferredMedia, container: null, surface }
        : { type: 'image', img: preferredMedia, container: null, surface };
    }

    if (!container) return { type: 'unknown' };

    const hasCarouselArrows = !!findCarouselNavButton(container, 'next') || !!findCarouselNavButton(container, 'previous');
    const hasSlideCounter = Array.from(container.querySelectorAll('span')).some(
      span => /^\d+\s*\/\s*\d+$/.test(span.textContent?.trim() || '')
    );
    const hasTablist = container.querySelector('[role="tablist"]') !== null;
    const isCarousel = hasCarouselArrows || hasSlideCounter || hasTablist;
    const shortcode = getCurrentShortcode(container);

    if (isCarousel) {
      const visibleVideo = getVisibleCarouselVideo(container);
      return {
        type: 'carousel',
        container,
        video: visibleVideo,
        hasVideo: !!visibleVideo,
        shortcode,
        surface
      };
    }

    const media = preferredMedia || getBestVisibleMediaInContainer(container);
    if (media?.tagName === 'VIDEO') {
      return { type: 'video', video: media, container, shortcode, surface };
    }
    if (media?.tagName === 'IMG') {
      return { type: 'image', img: media, container, shortcode, surface };
    }

    return { type: 'unknown' };
  }

  function isLikelyMediaImage(el) {
    if (!el || el.tagName !== 'IMG') return false;
    if (!isUsableMediaElement(el)) return false;

    const src = el.currentSrc || el.src || '';
    if (!src && !el.srcset) return false;

    const alt = (el.getAttribute('alt') || '').toLowerCase();
    if (alt.includes('profile picture') || alt.includes('instagram')) return false;

    const rect = el.getBoundingClientRect();
    if (rect.width <= 220 && rect.height <= 220 && Math.abs(rect.width - rect.height) < 24) {
      return false;
    }

    return true;
  }

  function isDownloadableMediaElement(el) {
    if (!el) return false;
    if (el.tagName === 'VIDEO') return isUsableMediaElement(el);
    if (el.tagName === 'IMG') return isLikelyMediaImage(el);
    return false;
  }

  function getClosestMediaElement(target) {
    if (!target || target.nodeType !== Node.ELEMENT_NODE) return null;
    const media = target.closest?.('video, img');
    return isDownloadableMediaElement(media) ? media : null;
  }

  function getPostContainerCandidates(element, maxDepth = 10) {
    const candidates = [];
    const seen = new Set();
    let current = element;

    for (let depth = 0; depth < maxDepth && current; depth++, current = current.parentElement) {
      if (current.nodeType !== Node.ELEMENT_NODE || seen.has(current)) continue;
      seen.add(current);
      candidates.push({ node: current, depth });

      if (current.matches?.('main, main[role="main"], body')) {
        break;
      }
    }

    return candidates;
  }

  function scorePostContainerCandidate(container, sourceElement = null, depth = 0) {
    if (!container || !container.isConnected) return -Infinity;
    if (!getBestVisibleMediaInContainer(container)) return -Infinity;

    let score = 0;
    const role = container.getAttribute?.('role') || '';

    if (container.tagName === 'ARTICLE') score += 900;
    if (role === 'dialog') score += 825;
    if (container.tagName === 'SECTION') score += 250;
    if (role === 'presentation') score += 90;
    if (container.tagName === 'MAIN') score -= 150;

    if (container.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]')) {
      score += 260;
    }
    if (container.querySelector('time[datetime]')) score += 120;
    if (container.querySelector('[role="tablist"]') || findCarouselNavButton(container, 'next') || findCarouselNavButton(container, 'previous')) {
      score += 220;
    }
    if (findActionReferenceInContainer(container, ['share', 'comment', 'like', 'save', 'menu'])) {
      score += 520;
    }

    score += Math.min(container.querySelectorAll('video, img').length, 8) * 18;
    if (sourceElement && container.contains(sourceElement)) score += 40;

    return score - (depth * 24);
  }

  function findPostContainerFromElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;

    const candidates = getPostContainerCandidates(element);
    let bestCandidate = null;
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      const score = scorePostContainerCandidate(candidate.node, element, candidate.depth);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate.node;
      }
    }

    if (bestCandidate) {
      return bestCandidate;
    }

    let parent = element;
    for (let i = 0; i < 8 && parent; i++) {
      if (getBestVisibleMediaInContainer(parent)) {
        return parent;
      }
      parent = parent.parentElement;
    }

    return null;
  }

  function getBestVisibleMediaInContainer(container, point = null) {
    if (!container) return null;

    const mediaElements = Array.from(container.querySelectorAll('video, img'))
      .filter(isDownloadableMediaElement);

    if (mediaElements.length === 0) return null;

    let best = null;
    let bestScore = -Infinity;

    for (const media of mediaElements) {
      const rect = media.getBoundingClientRect();
      let score = rect.width * rect.height;

      if (point) {
        const inside =
          point.x >= rect.left &&
          point.x <= rect.right &&
          point.y >= rect.top &&
          point.y <= rect.bottom;
        const dx = (rect.left + rect.width / 2) - point.x;
        const dy = (rect.top + rect.height / 2) - point.y;
        score += inside ? 1000000 : 0;
        score -= Math.sqrt(dx * dx + dy * dy) * 100;
      }

      if (media.tagName === 'VIDEO') score += 5000;
      if (media === GlobalState.currentVideo) score += 10000;

      if (score > bestScore) {
        bestScore = score;
        best = media;
      }
    }

    return best;
  }

  function isUsableMediaElement(el) {
    if (!el) return false;

    const rect = el.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 120) return false;
    if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= window.innerHeight || rect.left >= window.innerWidth) return false;

    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function getVisibleCarouselVideo(container) {
    if (!container) return null;

    const videos = Array.from(container.querySelectorAll('video')).filter(isUsableMediaElement);
    if (videos.length === 0) return null;

    videos.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      return (bRect.width * bRect.height) - (aRect.width * aRect.height);
    });

    return videos[0];
  }

  function findPostContainer() {
    const context = getMostRelevantMediaContext();
    if (context?.container) return context.container;

    const activeVideo = findActiveVideo();
    const video = activeVideo || (GlobalState.currentVideo?.isConnected ? GlobalState.currentVideo : null);
    if (video) return findPostContainerFromElement(video);

    const activeImg = findActiveImage();
    if (activeImg) return findPostContainerFromElement(activeImg);

    return document.querySelector('article') || document.querySelector('main [role="main"] article');
  }

  function getBestImageUrl(imgEl) {
    if (!imgEl) return null;

    if (imgEl.srcset) {
      const sources = imgEl.srcset.split(',').map(s => {
        const parts = s.trim().split(' ');
        return { url: parts[0], width: parseInt(parts[1]) || 0 };
      });
      sources.sort((a, b) => b.width - a.width);
      if (sources[0]?.url) {
        return { url: sources[0].url, width: sources[0].width };
      }
    }

    return { url: imgEl.src, width: 0 };
  }

  function getVisibleCarouselImage(container) {
    if (!container) return null;

    const imgs = Array.from(container.querySelectorAll('img')).filter(isLikelyMediaImage);
    if (imgs.length === 0) return null;

    const containerRect = container.getBoundingClientRect();
    const containerCenterX = containerRect.left + containerRect.width / 2;
    const containerCenterY = containerRect.top + containerRect.height / 2;
    let bestImage = null;
    let bestScore = -Infinity;

    for (const img of imgs) {
      const rect = img.getBoundingClientRect();
      if (rect.width <= 100 || rect.height <= 100) continue;
      if (rect.bottom <= containerRect.top || rect.top >= containerRect.bottom) continue;
      if (rect.right <= containerRect.left || rect.left >= containerRect.right) continue;

      const style = window.getComputedStyle(img);
      if (style.opacity === '0' || style.display === 'none' || style.visibility === 'hidden') continue;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const containsContainerCenter =
        containerCenterX >= rect.left && containerCenterX <= rect.right &&
        containerCenterY >= rect.top && containerCenterY <= rect.bottom;

      let score = rect.width * rect.height - Math.hypot(centerX - containerCenterX, centerY - containerCenterY) * 120;
      if (containsContainerCenter) score += 200000;
      if (img.closest('[aria-hidden="true"]')) score -= 100000;

      if (score > bestScore) {
        bestScore = score;
        bestImage = img;
      }
    }

    return bestImage || imgs[0] || null;
  }

  const CAROUSEL_NAV_LABEL_PATTERNS = Object.freeze({
    next: [/next/i, /siguiente/i, /suivant/i, /weiter/i, /prossim/i, /seguinte/i],
    previous: [/previous/i, /prev/i, /anterior/i, /précédent/i, /zurück/i, /precedent/i, /precedente/i]
  });

  function getCarouselNavButtons(container, direction) {
    if (!container) return [];

    const containerRect = container.getBoundingClientRect();
    const sideThreshold = direction === 'next'
      ? containerRect.left + containerRect.width * 0.65
      : containerRect.left + containerRect.width * 0.35;

    return Array.from(container.querySelectorAll('button, [role="button"]')).filter(button => {
      if (!isVisibleUiElement(button)) return false;
      if (button.closest?.('.angel-inline-download-slot')) return false;

      const rect = button.getBoundingClientRect();
      if (rect.width < 20 || rect.width > 84 || rect.height < 20 || rect.height > 84) return false;
      if (rect.bottom <= containerRect.top || rect.top >= containerRect.bottom) return false;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const verticallyAligned =
        centerY >= containerRect.top + containerRect.height * 0.18 &&
        centerY <= containerRect.bottom - containerRect.height * 0.18;
      const onDesiredSide = direction === 'next' ? centerX >= sideThreshold : centerX <= sideThreshold;

      return verticallyAligned && onDesiredSide;
    });
  }

  function findCarouselNavButton(container, direction) {
    const candidates = getCarouselNavButtons(container, direction);
    if (candidates.length === 0) return null;

    const patterns = CAROUSEL_NAV_LABEL_PATTERNS[direction] || [];
    const labeledCandidates = candidates.filter(button => {
      const label = getActionElementLabel(button);
      return patterns.some(pattern => pattern.test(label));
    });

    const pool = labeledCandidates.length > 0 ? labeledCandidates : candidates;
    const containerRect = container.getBoundingClientRect();
    const targetX = direction === 'next' ? containerRect.right : containerRect.left;
    const targetY = containerRect.top + containerRect.height / 2;

    pool.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      const aDist = Math.hypot((aRect.left + aRect.width / 2) - targetX, (aRect.top + aRect.height / 2) - targetY);
      const bDist = Math.hypot((bRect.left + bRect.width / 2) - targetX, (bRect.top + bRect.height / 2) - targetY);
      return aDist - bDist;
    });

    return pool[0] || null;
  }

  function captureCurrentCarouselSlide(container) {
    const visibleVideo = getVisibleCarouselVideo(container);
    if (visibleVideo) {
      const src = visibleVideo.currentSrc || visibleVideo.src;
      if (!src) return null;

      return {
        url: src,
        width: visibleVideo.videoWidth || 0,
        isVideo: true,
        signature: `video:${extractUrlKey(src) || src}`
      };
    }

    const visibleImg = getVisibleCarouselImage(container);
    if (!visibleImg) return null;

    const best = getBestImageUrl(visibleImg);
    if (!best?.url) return null;

    return {
      url: best.url,
      width: best.width || 0,
      isVideo: false,
      signature: `image:${extractUrlKey(best.url) || best.url}`
    };
  }

  async function moveCarousel(container, direction, previousSignature = null) {
    const button = findCarouselNavButton(container, direction);
    if (!button) return false;

    const baselineSignature = previousSignature || captureCurrentCarouselSlide(container)?.signature || null;
    for (let attempt = 0; attempt < 4; attempt++) {
      button.click();
      await sleep(350 + attempt * 100);

      const nextSignature = captureCurrentCarouselSlide(container)?.signature || null;
      if (nextSignature && nextSignature !== baselineSignature) {
        return true;
      }
    }

    return false;
  }

  function getCurrentSlideIndex(container) {
    if (!container) return 0;

    const counterSpan = Array.from(container.querySelectorAll('span')).find(
      span => /^\d+\s*\/\s*\d+$/.test(span.textContent?.trim() || '')
    );
    if (counterSpan) {
      const match = counterSpan.textContent.trim().match(/^(\d+)/);
      if (match) return parseInt(match[1]) - 1;
    }

    const tabs = container.querySelectorAll('[role="tablist"] [role="tab"]');
    for (let i = 0; i < tabs.length; i++) {
      if (tabs[i].getAttribute('aria-selected') === 'true') return i;
    }

    return 0;
  }

  function getTotalSlides(container) {
    if (!container) return 1;

    const counterSpan = Array.from(container.querySelectorAll('span')).find(
      span => /^\d+\s*\/\s*\d+$/.test(span.textContent?.trim() || '')
    );
    if (counterSpan) {
      const match = counterSpan.textContent.trim().match(/\/\s*(\d+)$/);
      if (match) return parseInt(match[1]);
    }

    const tabs = container.querySelectorAll('[role="tablist"] [role="tab"]');
    if (tabs.length > 0) return tabs.length;

    const slideButtons = Array.from(container.querySelectorAll('button, [role="button"]')).filter(button => {
      const label = getActionElementLabel(button);
      return /slide|photo|image/i.test(label);
    });
    if (slideButtons.length > 1) return slideButtons.length;

    return 1;
  }

  async function getAllCarouselSlides(container) {
    const slides = [];
    const seenSignatures = new Set();
    const originalSlide = captureCurrentCarouselSlide(container);

    if (!originalSlide) {
      return [];
    }

    for (let i = 0; i < 20; i++) {
      const currentSlide = captureCurrentCarouselSlide(container);
      if (!currentSlide?.signature) break;
      const moved = await moveCarousel(container, 'previous', currentSlide.signature);
      if (!moved) break;
    }

    for (let i = 0; i < 20; i++) {
      const slide = captureCurrentCarouselSlide(container);
      if (!slide?.signature || seenSignatures.has(slide.signature)) break;

      seenSignatures.add(slide.signature);
      slides.push(slide.isVideo
        ? { url: slide.url, width: slide.width, isVideo: true }
        : { url: slide.url, width: slide.width });

      const moved = await moveCarousel(container, 'next', slide.signature);
      if (!moved) {
        break;
      }
    }

    if (slides.length === 0) {
      slides.push(originalSlide.isVideo
        ? { url: originalSlide.url, width: originalSlide.width, isVideo: true }
        : { url: originalSlide.url, width: originalSlide.width });
    }

    if (originalSlide.signature) {
      for (let i = 0; i < 20; i++) {
        const currentSlide = captureCurrentCarouselSlide(container);
        if (currentSlide?.signature === originalSlide.signature) break;
        const moved = await moveCarousel(container, 'previous', currentSlide?.signature || null);
        if (!moved) break;
      }
    }

    return slides.filter(Boolean);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  const RESERVED_INSTAGRAM_PATHS = new Set([
    'accounts', 'direct', 'explore', 'reel', 'reels', 'p', 'stories', 'tv'
  ]);

  function sanitizeFilenameSegment(value) {
    const raw = String(value || '');
    const normalized = typeof raw.normalize === 'function'
      ? raw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      : raw;

    return normalized
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
      .replace(/\s+/g, '_')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/_{2,}/g, '_')
      .replace(/^[-_.]+|[-_.]+$/g, '');
  }

  function extractUsernameFromHref(href) {
    if (!href || typeof href !== 'string') return '';

    try {
      const pathname = href.startsWith('http') ? new URL(href).pathname : href;
      const [firstSegment] = pathname.split('/').filter(Boolean);
      if (!firstSegment) return '';

      const normalized = firstSegment.replace(/^@/, '');
      if (RESERVED_INSTAGRAM_PATHS.has(normalized.toLowerCase())) return '';
      return sanitizeFilenameSegment(normalized);
    } catch (e) {
      return '';
    }
  }

  function normalizeUsernameCandidate(value) {
    if (!value) return '';

    const normalized = sanitizeFilenameSegment(String(value)
      .replace(/^@/, '')
      .replace(/\s+on Instagram.*$/i, '')
      .trim());

    if (!normalized || RESERVED_INSTAGRAM_PATHS.has(normalized.toLowerCase())) {
      return '';
    }

    return normalized;
  }

  function getMediaUsername(container = null) {
    const selectors = ['header a[href^="/"]', 'a[href^="/"]'];

    if (container) {
      for (const selector of selectors) {
        const links = Array.from(container.querySelectorAll(selector)).slice(0, 8);
        for (const link of links) {
          const usernameFromHref = extractUsernameFromHref(link.getAttribute('href'));
          if (usernameFromHref) return usernameFromHref;

          const usernameFromText = normalizeUsernameCandidate(link.textContent);
          if (usernameFromText) return usernameFromText;
        }
      }
    }

    const storyPathMatch = window.location.pathname.match(/^\/stories\/(?!highlights\/)([^/]+)/);
    if (storyPathMatch?.[1]) {
      const storyUsername = normalizeUsernameCandidate(storyPathMatch[1]);
      if (storyUsername) return storyUsername;
    }

    const pageUsername = extractUsernameFromHref(window.location.pathname);
    if (pageUsername) return pageUsername;

    const metaTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
    const metaMatch = metaTitle.match(/^@?([^:]+?)\s+on Instagram/i);
    if (metaMatch?.[1]) {
      const metaUsername = normalizeUsernameCandidate(metaMatch[1]);
      if (metaUsername) return metaUsername;
    }

    const headerTitle = document.querySelector('main header h2, header h2, header h1')?.textContent;
    const headerUsername = normalizeUsernameCandidate(headerTitle);
    return headerUsername || 'instagram';
  }

  function getMediaTimestamp(container = null) {
    const containerTime = container?.querySelector('time[datetime]')?.getAttribute('datetime');
    if (containerTime) return containerTime;

    const pageTime = document.querySelector('time[datetime]')?.getAttribute('datetime');
    if (pageTime) return pageTime;

    return document.querySelector('meta[property="article:published_time"]')?.getAttribute('content') || null;
  }

  function formatDownloadTimestamp(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
      return formatDownloadTimestamp();
    }

    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  }

  function normalizeDownloadQuality(value) {
    const quality = String(value || 'original')
      .replace(/×/g, 'x')
      .replace(/\?/g, 'unknown')
      .replace(/px\b/ig, 'w');

    return sanitizeFilenameSegment(quality) || 'original';
  }

  function getFileExtensionFromUrl(url, fallback = 'bin') {
    if (!url || typeof url !== 'string' || url.startsWith('blob:')) {
      return fallback;
    }

    try {
      const pathname = new URL(url, window.location.href).pathname;
      const match = pathname.match(/\.([A-Za-z0-9]{2,5})(?:$|\?)/);
      if (!match?.[1]) return fallback;

      const ext = match[1].toLowerCase();
      return ext === 'jpeg' ? 'jpg' : ext;
    } catch (e) {
      return fallback;
    }
  }

  function resolveDownloadType(mediaInfo, options = {}) {
    const baseType = options.type || mediaInfo.type || 'media';
    const surface = options.surface || mediaInfo.surface || getMediaSurface(mediaInfo.container);

    if (options.parentType === 'carousel') {
      if (baseType === 'video') return 'carousel-video';
      if (baseType === 'image') return 'carousel-photo';
      return 'carousel';
    }

    if (surface === MEDIA_SURFACES.STORY) {
      return baseType === 'video' ? 'story-video' : 'story-photo';
    }

    if (surface === MEDIA_SURFACES.HIGHLIGHT) {
      return baseType === 'video' ? 'highlight-video' : 'highlight-photo';
    }

    if (surface === MEDIA_SURFACES.REEL && baseType === 'video') return 'reel';
    if (surface === MEDIA_SURFACES.TV && baseType === 'video') return 'igtv';
    if (baseType === 'video') return 'video';
    if (baseType === 'image') return 'photo';
    if (baseType === 'carousel') return 'carousel';
    return sanitizeFilenameSegment(baseType) || 'media';
  }

  function buildDownloadFilename(mediaInfo, options = {}) {
    const extension = sanitizeFilenameSegment(
      options.extension || getFileExtensionFromUrl(options.url, options.type === 'video' ? 'mp4' : 'jpg')
    ) || 'bin';
    const template = (GlobalState.downloadFilenameTemplate || CONFIG.DOWNLOAD.DEFAULT_TEMPLATE || '').trim() || CONFIG.DOWNLOAD.DEFAULT_TEMPLATE;
    const shortcode = sanitizeFilenameSegment(mediaInfo.shortcode || getCurrentShortcode(mediaInfo.container) || `instagram_${Date.now()}`);
    const indexValue = Number.isInteger(options.index)
      ? options.index
      : (Number.isInteger(mediaInfo.carouselIndex) ? mediaInfo.carouselIndex : null);
    const indexToken = indexValue && GlobalState.downloadCarouselIndex
      ? `_${String(indexValue).padStart(2, '0')}`
      : '';
    const tokens = {
      username: getMediaUsername(mediaInfo.container),
      shortcode: shortcode || `instagram_${Date.now()}`,
      type: resolveDownloadType(mediaInfo, options),
      quality: normalizeDownloadQuality(options.quality),
      index: indexToken,
      date: formatDownloadTimestamp(options.timestamp || getMediaTimestamp(mediaInfo.container))
    };

    let baseName = template
      .replace(/\{(username|shortcode|type|quality|index|date)\}/g, (_, key) => tokens[key] || '')
      .replace(/\{[^}]+\}/g, '')
      .replace(/[_-]{2,}/g, '_');

    baseName = sanitizeFilenameSegment(baseName);

    if (!baseName) {
      baseName = sanitizeFilenameSegment([
        'angel',
        tokens.username,
        tokens.shortcode,
        tokens.type,
        tokens.quality
      ].filter(Boolean).join('_'));
    }

    if (tokens.index && !template.includes('{index}')) {
      baseName = sanitizeFilenameSegment(`${baseName}${tokens.index}`);
    }

    const maxBaseLength = Math.max(32, CONFIG.DOWNLOAD.MAX_FILENAME_LENGTH - extension.length - 1);
    if (baseName.length > maxBaseLength) {
      baseName = baseName.slice(0, maxBaseLength).replace(/[-_.]+$/g, '');
    }

    return `${baseName || 'angel_download'}.${extension}`;
  }

  function showCarouselDownloadPrompt(mediaInfo) {
    const container = mediaInfo.container;
    const totalSlides = getTotalSlides(container);
    const currentSlide = getCurrentSlideIndex(container) + 1;
    const visibleVideo = getVisibleCarouselVideo(container);
    const isVideoSlide = visibleVideo !== null;

    const existing = document.getElementById('angel-download-prompt');
    if (existing) existing.remove();

    const prompt = document.createElement('div');
    prompt.id = 'angel-download-prompt';
    prompt.className = 'ir-download-prompt';
    prompt.innerHTML = `
      <div class="ir-dp-backdrop"></div>
      <div class="ir-dp-dialog">
        <div class="ir-dp-header">
          <span class="ir-dp-icon">⬇️</span>
          <h3>Download Carousel</h3>
          <button class="ir-dp-close" title="Close">&times;</button>
        </div>
        <div class="ir-dp-body">
          <p>Slide ${currentSlide} of ${totalSlides}${isVideoSlide ? ' (Video)' : ' (Photo)'}</p>
          <div class="ir-dp-actions">
            <button class="ir-dp-btn ir-dp-btn-primary" data-action="current">
              <span>Current Slide</span>
              <kbd>${currentSlide} slide of ${totalSlides}</kbd>
            </button>
            <button class="ir-dp-btn ir-dp-btn-secondary" data-action="all">
              <span>All Slides</span>
              <kbd>${totalSlides} files</kbd>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(prompt);

    prompt.querySelector('.ir-dp-close').onclick = () => prompt.remove();
    prompt.querySelector('.ir-dp-backdrop').onclick = () => prompt.remove();

    prompt.querySelector('[data-action="current"]').onclick = () => {
      prompt.remove();
      downloadCurrentCarouselSlide(mediaInfo);
    };

    prompt.querySelector('[data-action="all"]').onclick = () => {
      prompt.remove();
      downloadAllCarouselSlides(mediaInfo);
    };

    document.addEventListener('keydown', function dpKeyHandler(e) {
      if (e.key === 'Escape') {
        prompt.remove();
        document.removeEventListener('keydown', dpKeyHandler);
      }
    });
  }

  function downloadCurrentCarouselSlide(mediaInfo) {
    const container = mediaInfo.container;
    const slideIndex = getCurrentSlideIndex(container) + 1;

    const video = getVisibleCarouselVideo(container);
    if (video) {
      downloadVideo({
        type: 'video',
        video,
        container,
        shortcode: mediaInfo.shortcode,
        carouselIndex: slideIndex,
        parentType: 'carousel'
      });
      return;
    }

    const img = getVisibleCarouselImage(container);
    if (img) {
      const best = getBestImageUrl(img);
      const filename = buildDownloadFilename({
        type: 'image',
        img,
        container,
        shortcode: mediaInfo.shortcode,
        carouselIndex: slideIndex,
        parentType: 'carousel'
      }, {
        type: 'image',
        parentType: 'carousel',
        index: slideIndex,
        quality: best.width > 0 ? `${best.width}px` : 'original',
        url: best.url,
        extension: getFileExtensionFromUrl(best.url, 'jpg')
      });

      downloadImageFile(best.url, filename, best.width);
      return;
    }

    showToast('Could not find media on current slide', '⚠️');
  }

  async function downloadAllCarouselSlides(mediaInfo) {
    showToast('Collecting slides...', '⬇️');

    try {
      const slides = await getAllCarouselSlides(mediaInfo.container);

      if (slides.length === 0) {
        showToast('No slides found', '⚠️');
        return;
      }

      const shortcode = mediaInfo.shortcode || getCurrentShortcode(mediaInfo.container) || `post_${Date.now()}`;
      let downloaded = 0;

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        if (!slide || !slide.url) continue;

        const ext = slide.isVideo ? 'mp4' : 'jpg';
        const label = slide.width ? `${slide.width}px` : 'original';
        const filename = buildDownloadFilename({
          type: slide.isVideo ? 'video' : 'image',
          container: mediaInfo.container,
          shortcode,
          carouselIndex: i + 1,
          parentType: 'carousel'
        }, {
          type: slide.isVideo ? 'video' : 'image',
          parentType: 'carousel',
          index: i + 1,
          quality: label,
          url: slide.url,
          extension: ext
        });

        const success = await downloadFileAsBlob(slide.url, filename, { saveAs: false });
        if (success) downloaded++;

        if (i < slides.length - 1) {
          await sleep(500);
        }
      }

      showToast(`Downloaded ${downloaded}/${slides.length} slides`, '✅');
    } catch (err) {
      log('Download all slides error:', err);
      showToast('Error downloading slides', '⚠️');
    }
  }

  function startDownload(downloadOptions, onComplete) {
    const complete = (downloadId, errorMessage = null) => {
      if (typeof onComplete === 'function') {
        onComplete(downloadId, errorMessage);
      }
    };

    try {
      if (typeof chrome !== 'undefined' && chrome.downloads?.download) {
        chrome.downloads.download(downloadOptions, (downloadId) => {
          complete(downloadId, chrome.runtime.lastError?.message || null);
        });
        return;
      }

      chrome.runtime.sendMessage({ action: 'angelDownloadUrl', options: downloadOptions }, (response) => {
        const errorMessage = chrome.runtime.lastError?.message ||
          (!response?.success ? response?.error || 'Download failed' : null);
        complete(response?.downloadId || null, errorMessage);
      });
    } catch (err) {
      log('Download error:', err);
      complete(null, err?.message || 'Download failed');
    }
  }

  function isBlobUrl(url) {
    return typeof url === 'string' && url.startsWith('blob:');
  }

  function isHttpUrl(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url);
  }

  function getPreferredVideoDownloadUrl(videoInfo) {
    if (!videoInfo) return null;

    const candidates = [videoInfo.downloadUrl, videoInfo.url]
      .filter(url => typeof url === 'string' && url.length > 0);

    for (const candidate of candidates) {
      if (isHttpUrl(candidate) && !isBlobUrl(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  function isInstagramMediaUrl(url) {
    if (!isHttpUrl(url)) return false;
    try {
      const { hostname } = new URL(url);
      return hostname === 'instagram.com' ||
        hostname.endsWith('.instagram.com') ||
        hostname.includes('cdninstagram.com') ||
        hostname.includes('fbcdn.net');
    } catch (e) {
      return false;
    }
  }

  function getDownloadHeaders(url) {
    if (!isInstagramMediaUrl(url)) return [];

    // chrome.downloads.download already sends cookies for the destination host.
    // Passing Origin/Referer here causes the request to be rejected because those
    // headers are not settable through the downloads API.
    return [];
  }

  function triggerBlobDownload(blob, filename) {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  }

  async function downloadViaFetchedBlob(url, filename) {
    const fetchOptions = isHttpUrl(url)
      ? { credentials: 'include', referrer: window.location.href }
      : {};
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(`Media fetch failed (${response.status})`);
    }

    if (response.type === 'opaque') {
      throw new Error('Media fetch returned an unreadable response');
    }

    const blob = await response.blob();
    if (!blob || blob.size === 0) {
      throw new Error('Media fetch returned an empty file');
    }

    triggerBlobDownload(blob, filename);
  }

  function downloadViaChrome(url, filename, options = {}) {
    return new Promise((resolve) => {
      const headers = getDownloadHeaders(url);
      const downloadOptions = {
        ...options,
        url,
        filename
      };

      if (headers.length > 0) {
        downloadOptions.headers = headers;
      }

      startDownload(downloadOptions, (downloadId, errorMessage) => {
        resolve({ downloadId, errorMessage });
      });
    });
  }

  async function downloadMediaFile(url, filename, options = {}) {
    const preferBrowserDownload = !!options.saveAs && !isBlobUrl(url);

    if (!preferBrowserDownload && (isBlobUrl(url) || isInstagramMediaUrl(url))) {
      try {
        await downloadViaFetchedBlob(url, filename);
        return { success: true, method: 'blob' };
      } catch (err) {
        log('Fetched blob download failed:', err);
        if (isBlobUrl(url)) {
          return { success: false, error: err?.message || 'Blob download failed' };
        }
      }
    }

    const result = await downloadViaChrome(url, filename, options);
    if (result.errorMessage && preferBrowserDownload && isInstagramMediaUrl(url)) {
      try {
        await downloadViaFetchedBlob(url, filename);
        return { success: true, method: 'blob-fallback' };
      } catch (err) {
        log('Browser download fallback failed:', err);
      }
    }

    return result.errorMessage
      ? { success: false, error: result.errorMessage }
      : { success: true, method: 'chrome', downloadId: result.downloadId };
  }

  async function downloadFileAsBlob(url, filename, options = {}) {
    try {
      const result = await downloadMediaFile(url, filename, options);
      if (!result.success) {
        log('Download failed:', result.error);
      }
      return result.success;
    } catch (err) {
      log('Download error:', err);
      return false;
    }
  }

  async function downloadVideo(mediaInfo) {
    const video = mediaInfo.video;
    if (!video) {
      showToast('No video found', '⚠️');
      return;
    }

    const currentSrc = video.currentSrc || video.src;
    if (!currentSrc) {
      showToast('No video source available', '⚠️');
      return;
    }

    showToast('Finding best quality...', '⬇️');

    let downloadUrl = null;
    let qualityLabel = null;
    const shortcode = mediaInfo.shortcode || getCurrentShortcode(mediaInfo.container);

    const localShortcodeHD = getLocalHDForShortcode(shortcode);
    const localShortcodeUrl = getPreferredVideoDownloadUrl(localShortcodeHD);
    if (localShortcodeUrl) {
      downloadUrl = localShortcodeUrl;
      qualityLabel = `${localShortcodeHD.width || video.videoWidth || '?'}×${localShortcodeHD.height || video.videoHeight || '?'}`;
      log('Download: Using shortcode-matched HD URL', qualityLabel);
    }

    const hdInfo = !downloadUrl && !isBlobUrl(currentSrc) ? findHDInfo(currentSrc) : null;
    const interceptorDownloadUrl = getPreferredVideoDownloadUrl(hdInfo);
    if (hdInfo && interceptorDownloadUrl) {
      downloadUrl = interceptorDownloadUrl;
      qualityLabel = `${hdInfo.width || video.videoWidth || '?'}×${hdInfo.height || video.videoHeight || '?'}`;
      log('Download: Using HD interceptor URL', qualityLabel);
    }

    if (!downloadUrl && isHttpUrl(video._hdUrl) && !isBlobUrl(video._hdUrl)) {
      downloadUrl = video._hdUrl;
      const q = GlobalState.currentVideoQuality;
      qualityLabel = q ? `${q.width}×${q.height}` : 'HD';
      log('Download: Using stored HD URL from video element');
    }

    if (!downloadUrl || isBlobUrl(downloadUrl)) {
      const requestedHD = await requestHDInfoFromPage(currentSrc, shortcode, 5000);
      const requestedHDUrl = getPreferredVideoDownloadUrl(requestedHD);
      if (requestedHDUrl) {
        downloadUrl = requestedHDUrl;
        qualityLabel = `${requestedHD.width || video.videoWidth || '?'}×${requestedHD.height || video.videoHeight || '?'}`;
        log('Download: Using page-context HD response', qualityLabel);
      }
    }

    if (!downloadUrl && isHttpUrl(currentSrc) && !isBlobUrl(currentSrc)) {
      downloadUrl = currentSrc;
      const w = video.videoWidth || '?';
      const h = video.videoHeight || '?';
      qualityLabel = `${w}×${h}`;
      log('Download: Using current video source as fallback');
    }

    if (!downloadUrl) {
      // Last resort: use the most recently intercepted HD URL from the page world
      try {
        const latestHD = window.__angel_hd?.getLatestHD?.();
        if (latestHD?.url && isHttpUrl(latestHD.url) && !isBlobUrl(latestHD.url) && Date.now() - latestHD.timestamp < 60000) {
          downloadUrl = latestHD.url;
          qualityLabel = latestHD.width ? `${latestHD.width}×${latestHD.height}` : 'HD';
          log('Download: Using latest intercepted HD URL as last resort');
        }
      } catch (e) { /* page-world may be unavailable */ }
    }

    if (!downloadUrl) {
      showToast('Could not find a stable video URL. Try again.', '⚠️');
      return;
    }

    const fileShortcode = shortcode || `reel_${Date.now()}`;
    const filename = buildDownloadFilename({
      ...mediaInfo,
      type: 'video',
      shortcode: fileShortcode
    }, {
      type: 'video',
      parentType: mediaInfo.parentType,
      index: mediaInfo.carouselIndex,
      quality: qualityLabel,
      url: downloadUrl,
      extension: getFileExtensionFromUrl(downloadUrl, 'mp4')
    });

    await downloadVideoFile(downloadUrl, filename, qualityLabel);
  }

  async function downloadVideoFile(url, filename, qualityLabel) {
    showToast(`Preparing ${qualityLabel}...`, '⬇️');

    const result = await downloadMediaFile(url, filename, {
      conflictAction: 'overwrite',
      saveAs: GlobalState.downloadSaveAs
    });
    if (!result.success) {
      log('Download failed:', result.error);
      showToast('Download failed. Try again.', '⚠️');
    } else {
      showToast(`Download started (${qualityLabel})`, '✅');
    }
  }

  function downloadImage(mediaInfo) {
    const img = mediaInfo.img;
    if (!img) {
      showToast('No image found', '⚠️');
      return;
    }

    const best = getBestImageUrl(img);
    if (!best || !best.url) {
      showToast('Could not find image URL', '⚠️');
      return;
    }

    const shortcode = mediaInfo.shortcode || getCurrentShortcode(mediaInfo.container) || `photo_${Date.now()}`;
    const qualityLabel = best.width > 0 ? `${best.width}px` : 'original';
    const filename = buildDownloadFilename({
      ...mediaInfo,
      type: 'image',
      shortcode
    }, {
      type: 'image',
      parentType: mediaInfo.parentType,
      index: mediaInfo.carouselIndex,
      quality: qualityLabel,
      url: best.url,
      extension: getFileExtensionFromUrl(best.url, 'jpg')
    });

    downloadImageFile(best.url, filename, best.width);
  }

  async function downloadImageFile(url, filename, width) {
    const qualityLabel = width > 0 ? `${width}px` : 'original';
    showToast(`Preparing ${qualityLabel}...`, '⬇️');

    const result = await downloadMediaFile(url, filename, { saveAs: GlobalState.downloadSaveAs });
    if (!result.success) {
      log('Download failed:', result.error);
      showToast('Download failed', '⚠️');
    } else {
      showToast(`Download started (${qualityLabel})`, '✅');
    }
  }

  function getMediaElementForDownloadButton(mediaInfo) {
    if (!mediaInfo) return null;
    if (mediaInfo.video && mediaInfo.video.isConnected) return mediaInfo.video;
    if (mediaInfo.img && mediaInfo.img.isConnected) return mediaInfo.img;
    if (mediaInfo.container?.isConnected) {
      return getBestVisibleMediaInContainer(mediaInfo.container);
    }
    return null;
  }

  function hasInlineDownloadButtonForMedia(mediaInfo) {
    if (!mediaInfo?.container) return false;

    return Array.from(document.querySelectorAll('.angel-inline-download-slot')).some(slot => {
      const slotContainer = slot._angelContainer;
      return slotContainer === mediaInfo.container ||
        (slotContainer?.contains?.(mediaInfo.container)) ||
        mediaInfo.container.contains?.(slotContainer);
    });
  }

  function setupMediaDownloadButtons() {
    const existingBtn = document.getElementById('angel-hover-download-btn');
    if (existingBtn) existingBtn.remove();

    if (GlobalState.mediaDownloadHandlers) {
      document.removeEventListener('mouseover', GlobalState.mediaDownloadHandlers.mouseover);
      document.removeEventListener('mouseout', GlobalState.mediaDownloadHandlers.mouseout);
      document.removeEventListener('contextmenu', GlobalState.mediaDownloadHandlers.contextmenu, true);
      GlobalState.mediaDownloadHandlers = null;
    }

    // Floating hover button disabled — inline buttons handle all downloads
    return;

    const btn = document.createElement('button');
    btn.id = 'angel-hover-download-btn';
    btn.innerHTML = `${CONFIG.ICONS.DOWNLOAD}`;
    btn.title = 'Download with ANGEL (.)';
    btn.style.cssText = `
      display: none;
      position: fixed;
      z-index: 999999;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.96);
      color: rgb(38, 38, 38);
      border: 1px solid rgba(219, 219, 219, 0.9);
      cursor: pointer;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(10px);
      transition: background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
      pointer-events: auto;
    `;
    btn.onmouseenter = () => {
      btn.style.background = 'rgba(255, 255, 255, 1)';
      btn.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.18)';
      btn.style.transform = 'scale(1.04)';
    };
    btn.onmouseleave = () => {
      btn.style.background = 'rgba(255, 255, 255, 0.96)';
      btn.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.15)';
      btn.style.transform = 'scale(1)';
    };
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerDownload(btn._mediaInfo || null);
    };
    document.body.appendChild(btn);

    const positionButtonForMedia = (mediaInfo) => {
      const mediaElement = getMediaElementForDownloadButton(mediaInfo);
      if (!mediaElement) return false;

      const rect = mediaElement.getBoundingClientRect();
      btn._mediaInfo = mediaInfo;
      btn.style.display = 'flex';
      btn.style.top = `${Math.max(12, rect.top + 10)}px`;
      btn.style.right = `${Math.max(12, window.innerWidth - rect.right + 10)}px`;
      return true;
    };

    const refreshPinnedButton = () => {
      const detectedMediaInfo = detectCurrentMedia();
      const mediaInfo = detectedMediaInfo?.type && detectedMediaInfo.type !== 'unknown'
        ? detectedMediaInfo
        : btn._lastPinnedMediaInfo;
      const hasMatchingInlineButton = hasInlineDownloadButtonForMedia(mediaInfo);
      const shouldPin = !hasMatchingInlineButton &&
        mediaInfo?.type && mediaInfo.type !== 'unknown' &&
        mediaInfo.surface !== MEDIA_SURFACES.REEL;

      if (!shouldPin) {
        btn.dataset.pinned = 'false';
        btn._lastPinnedMediaInfo = null;
        if (btn.dataset.mode !== 'hover') {
          btn.style.display = 'none';
          btn.dataset.mode = 'hidden';
        }
        return;
      }

      if (positionButtonForMedia(mediaInfo)) {
        btn._lastPinnedMediaInfo = mediaInfo;
        btn.dataset.pinned = 'true';
        btn.dataset.mode = 'pinned';
      }
    };

    GlobalState.refreshMediaDownloadButton = refreshPinnedButton;

    let hoverTimeout;
    const handleMouseover = (e) => {
      const point = { x: e.clientX, y: e.clientY };
      const mediaInfo = detectMediaFromInteraction(e.target, point);
      const target = getMediaElementForDownloadButton(mediaInfo);

      if (target && mediaInfo?.type && mediaInfo.type !== 'unknown') {
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
          const rect = target.getBoundingClientRect();
          btn.dataset.mode = 'hover';
          btn.dataset.pinned = 'false';
          btn._mediaInfo = mediaInfo;
          btn.style.display = 'flex';
          btn.style.top = `${Math.max(12, rect.top + 10)}px`;
          btn.style.right = `${Math.max(12, window.innerWidth - rect.right + 10)}px`;
        }, 300);
      } else {
        clearTimeout(hoverTimeout);
        if (btn.dataset.pinned === 'true') {
          refreshPinnedButton();
        } else {
          btn.style.display = 'none';
          btn.dataset.mode = 'hidden';
        }
      }
    };

    const handleMouseout = (e) => {
      const target = getClosestMediaElement(e.target);
      const relatedMedia = getClosestMediaElement(e.relatedTarget);

      if (target && !relatedMedia && !e.relatedTarget?.closest?.('#angel-hover-download-btn')) {
        if (btn.dataset.pinned === 'true') {
          refreshPinnedButton();
        } else {
          btn.style.display = 'none';
          btn.dataset.mode = 'hidden';
        }
      }
    };

    const handleContextmenu = (e) => {
      const mediaInfo = detectMediaFromInteraction(e.target, { x: e.clientX, y: e.clientY });
      if (!mediaInfo?.type || mediaInfo.type === 'unknown') return;

      GlobalState.contextDownloadMediaInfo = mediaInfo;
      GlobalState.contextDownloadMediaAt = Date.now();
    };

    document.addEventListener('mouseover', handleMouseover);
    document.addEventListener('mouseout', handleMouseout);
    document.addEventListener('contextmenu', handleContextmenu, true);

    refreshPinnedButton();

    GlobalState.mediaDownloadHandlers = {
      mouseover: handleMouseover,
      mouseout: handleMouseout,
      contextmenu: handleContextmenu
    };
  }

  function isVisibleUiElement(el) {
    if (!el || !el.isConnected) return false;
    if (el.closest?.('#angel-overlay, #angel-backdrop, #angel-ctrl, #angel-hover-download-btn')) return false;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function getActionElementLabel(el) {
    if (!el) return '';

    const labels = [
      el.getAttribute?.('aria-label'),
      el.getAttribute?.('title')
    ];

    const descendants = Array.from(el.querySelectorAll?.('[aria-label], [title]') || []).slice(0, 6);
    for (const node of descendants) {
      labels.push(node.getAttribute('aria-label'));
      labels.push(node.getAttribute('title'));
    }

    return labels.filter(Boolean).join(' ').toLowerCase();
  }

  function getActionKind(el) {
    const label = getActionElementLabel(el);
    for (const [action, patterns] of Object.entries(ACTION_LABEL_PATTERNS)) {
      if (patterns.some(pattern => pattern.test(label))) {
        return action;
      }
    }
    return null;
  }

  function isInlineActionItem(el) {
    if (!isVisibleUiElement(el)) return false;
    if (el.classList?.contains('angel-inline-download-slot')) return false;
    if (el.matches?.('button, a, [role="button"]')) return true;
    return !!el.querySelector?.('button, a, [role="button"], svg, [aria-label]');
  }

  function findActionReferenceInContainer(container, preferredActions = ['share', 'comment', 'like', 'save']) {
    if (!container) return null;

    const nodes = Array.from(container.querySelectorAll('[aria-label], [title], button, a, [role="button"]'));
    const candidates = [];
    const seen = new Set();

    for (const node of nodes) {
      const clickable = node.matches?.('button, a, [role="button"]')
        ? node
        : node.closest?.('button, a, [role="button"]') || node;

      if (!clickable || seen.has(clickable) || !isVisibleUiElement(clickable)) continue;
      if (clickable.closest?.('.angel-inline-download-slot')) continue;

      seen.add(clickable);
      const action = getActionKind(clickable);
      if (action) {
        candidates.push({ action, element: clickable });
      }
    }

    for (const action of preferredActions) {
      const match = candidates.find(candidate => candidate.action === action);
      if (match) return match;
    }

    return candidates[0] || null;
  }

  function findInlineMountFromActionElement(element, options = {}) {
    const minSiblings = options.minSiblings ?? 2;
    let current = element?.closest?.('button, a, [role="button"]') || element;

    for (let depth = 0; depth < 8 && current?.parentElement; depth++) {
      const parent = current.parentElement;
      const siblingItems = Array.from(parent.children).filter(isInlineActionItem);
      if (siblingItems.length >= minSiblings && siblingItems.length <= 8 && (siblingItems.length > 1 || depth > 0)) {
        return { mount: parent, anchorItem: current };
      }
      current = parent;
    }

    return current?.parentElement ? { mount: current.parentElement, anchorItem: current } : null;
  }

  function getInlineActionSearchRoots(container) {
    if (!container) return [];

    const roots = [];
    const seen = new Set();
    let current = container;

    for (let depth = 0; depth < 8 && current; depth++, current = current.parentElement) {
      if (current.nodeType !== Node.ELEMENT_NODE || seen.has(current)) continue;
      seen.add(current);
      roots.push(current);

      if (current.matches?.('main, main[role="main"], body')) {
        break;
      }
    }

    return roots;
  }

  function getInlineDownloadTitle(surface) {
    switch (surface) {
      case MEDIA_SURFACES.STORY:
        return 'Download story with ANGEL';
      case MEDIA_SURFACES.HIGHLIGHT:
        return 'Download highlight with ANGEL';
      case MEDIA_SURFACES.REEL:
        return 'Download reel with ANGEL';
      case MEDIA_SURFACES.POST:
        return 'Download post with ANGEL';
      default:
        return 'Download with ANGEL';
    }
  }

  function resolveInlineDownloadTarget() {
    const mediaInfo = detectCurrentMedia();
    if (!mediaInfo?.type || mediaInfo.type === 'unknown' || !mediaInfo.container) return null;

    const surface = mediaInfo.surface || getMediaSurface(mediaInfo.container);

    if (surface === MEDIA_SURFACES.STORY || surface === MEDIA_SURFACES.HIGHLIGHT) {
      const storyRoot = mediaInfo.container.closest?.('section, [role="presentation"]') || mediaInfo.container;
      const storyAction = findActionReferenceInContainer(storyRoot, ['menu', 'share', 'comment', 'like', 'save']) ||
        findActionReferenceInContainer(mediaInfo.container, ['menu', 'share', 'comment', 'like', 'save']);
      const fallbackCircle = storyRoot.querySelector('svg circle') || mediaInfo.container.querySelector('svg circle');
      const actionElement = storyAction?.element || fallbackCircle;
      if (!actionElement) return null;

      const mountInfo = findInlineMountFromActionElement(actionElement, { minSiblings: 1 });
      if (!mountInfo?.mount) return null;

      return {
        mount: mountInfo.mount,
        referenceElement: mountInfo.anchorItem || actionElement,
        mediaInfo,
        surface
      };
    }

    if (surface === MEDIA_SURFACES.REEL) {
      const reelButtons = findReelActionButtons();
      const reelReference = reelButtons.save || reelButtons.share || reelButtons.comment || reelButtons.like;
      if (reelReference) {
        const mountInfo = findInlineMountFromActionElement(reelReference, { minSiblings: 2 });
        if (mountInfo?.mount) {
          return {
            mount: mountInfo.mount,
            referenceElement: mountInfo.anchorItem || reelReference,
            mediaInfo,
            surface
          };
        }
      }
    }

    let actionReference = null;
    for (const searchRoot of getInlineActionSearchRoots(mediaInfo.container)) {
      actionReference = findActionReferenceInContainer(searchRoot, ['share', 'comment', 'like', 'save']);
      if (actionReference?.element) break;
    }

    if (!actionReference?.element) return null;

    const mountInfo = findInlineMountFromActionElement(actionReference.element, { minSiblings: 2 });
    if (!mountInfo?.mount) return null;

    return {
      mount: mountInfo.mount,
      referenceElement: mountInfo.anchorItem || actionReference.element,
      mediaInfo,
      surface
    };
  }

  function createInlineDownloadButton(targetInfo) {
    const slot = document.createElement('div');
    slot.className = 'angel-inline-download-slot';
    slot.dataset.angelSurface = targetInfo.surface || MEDIA_SURFACES.MEDIA;
    slot._angelContainer = targetInfo.mediaInfo.container;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'angel-inline-download-btn';
    button.innerHTML = CONFIG.ICONS.DOWNLOAD;
    button.title = getInlineDownloadTitle(targetInfo.surface);
    button.setAttribute('aria-label', button.title);
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const container = slot._angelContainer && slot._angelContainer.isConnected
        ? slot._angelContainer
        : findPostContainer();
      const mediaInfo = container
        ? buildMediaInfo(container, getBestVisibleMediaInContainer(container))
        : detectCurrentMedia();

      triggerDownload(mediaInfo?.type && mediaInfo.type !== 'unknown' ? mediaInfo : targetInfo.mediaInfo);
    });

    slot.appendChild(button);
    return slot;
  }

  function getInlineDownloadSyncSignature() {
    const video = GlobalState.currentVideo;
    const src = video?.currentSrc || video?.src || GlobalState.currentVideoSrc || '';
    const slotCount = document.querySelectorAll('.angel-inline-download-slot').length;
    return `${window.location.pathname}|${src}|${slotCount}`;
  }

  function syncInlineDownloadButtons(force = false) {
    const now = Date.now();
    const signature = getInlineDownloadSyncSignature();
    const cache = GlobalState.inlineDownloadSyncCache;

    if (!force &&
      cache.signature === signature &&
      cache.mount?.isConnected &&
      now - cache.at < 500) {
      return;
    }

    const targetInfo = resolveInlineDownloadTarget();
    const inlineButtons = Array.from(document.querySelectorAll('.angel-inline-download-slot'));

    if (!targetInfo?.mount) {
      inlineButtons.forEach(node => node.remove());
      GlobalState.refreshMediaDownloadButton?.();
      GlobalState.inlineDownloadSyncCache = { signature, at: now, mount: null };
      return;
    }

    inlineButtons.forEach(node => {
      if (node.parentElement !== targetInfo.mount) {
        node.remove();
      }
    });

    const existing = Array.from(targetInfo.mount.children).find(
      child => child.classList?.contains('angel-inline-download-slot')
    );

    if (existing) {
      existing._angelContainer = targetInfo.mediaInfo.container;
      existing.dataset.angelSurface = targetInfo.surface || MEDIA_SURFACES.MEDIA;
      const button = existing.querySelector('.angel-inline-download-btn');
      if (button) {
        const title = getInlineDownloadTitle(targetInfo.surface);
        button.title = title;
        button.setAttribute('aria-label', title);
      }
      GlobalState.refreshMediaDownloadButton?.();
      GlobalState.inlineDownloadSyncCache = { signature, at: now, mount: targetInfo.mount };
      return;
    }

    const slot = createInlineDownloadButton(targetInfo);
    if (targetInfo.referenceElement?.parentElement === targetInfo.mount) {
      targetInfo.referenceElement.insertAdjacentElement('afterend', slot);
    } else {
      targetInfo.mount.appendChild(slot);
    }

    GlobalState.refreshMediaDownloadButton?.();
    GlobalState.inlineDownloadSyncCache = { signature, at: now, mount: targetInfo.mount };
  }

  function getCurrentShortcode(container = null) {
    const containerShortcode = getShortcodeForContainer(container);
    if (containerShortcode) return containerShortcode;

    return getPathMediaIdentifier();
  }

  function getShortcodeForContainer(container) {
    if (!container) return null;

    const link = container.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"]');
    const href = link?.getAttribute('href') || '';
    const match = href.match(/\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/);
    if (match?.[1]) return match[1];

    if (isStoryPage() || isHighlightPage()) {
      return getPathMediaIdentifier();
    }

    return null;
  }

  function isLiked() {
    const buttons = findReelActionButtons();
    if (buttons.like) {
      const svg = buttons.like.querySelector('svg') || buttons.like;
      const label = svg.getAttribute('aria-label') || '';
      return label.toLowerCase().includes('unlike');
    }
    return false;
  }

  function isSaved() {
    const buttons = findReelActionButtons();
    if (buttons.save) {
      const svg = buttons.save.querySelector('svg') || buttons.save;
      const label = svg.getAttribute('aria-label') || '';
      return label.toLowerCase().includes('remove');
    }
    return false;
  }


  function resetAll() {
    log('Resetting all transforms');

    // Store video reference before reset
    const video = GlobalState.currentVideo;

    // Deactivate overlay first
    deactivateOverlay();

    // Reset state
    GlobalState.reset();

    // Exit fullscreen if active
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
    }

    // Clear any remaining transforms on video
    if (video) {
      video.style.transform = '';
      video.style.transformOrigin = '';
    }

    showToast('Reset', '↺');
    updateControlPanel();
  }

  // ============================================
  // REEL NAVIGATION
  // ============================================

  function navigateReel(direction) {
    log('Navigating reel:', direction);

    const prevVideo = GlobalState.currentVideo;
    const prevSrc = GlobalState.currentVideoSrc;
    const prevRect = prevVideo?.getBoundingClientRect?.();
    const shouldRestoreOverlay = GlobalState.isOverlayActive && GlobalState.enhancedModeActive;
    const LOCK_FALLBACK_MS = 2800;
    const scrollTarget = getScrollContainer();
    const getScrollTop = () => {
      if (!scrollTarget || scrollTarget === document.documentElement || scrollTarget === document.body) {
        return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      }
      return scrollTarget.scrollTop || 0;
    };
    const startScrollTop = getScrollTop();

    // Let Instagram's native reel container own the visual scroll. Keeping our
    // lifted fixed-position video on top makes arrow navigation feel like it
    // freezes, then snaps.
    GlobalState.reelNavigationInProgress = true;
    if (shouldRestoreOverlay) {
      deactivateOverlay({ resumePlayback: false });
      GlobalState.activeVideoCache = { video: null, at: 0, path: '', width: 0, height: 0 };
    }

    clearTimeout(GlobalState.scrollNavTimeout);
    GlobalState.scrollNavTimeout = setTimeout(() => {
      GlobalState.scrollNavTimeout = null;
      GlobalState.reelNavigationInProgress = false;
      const moved = Math.abs(getScrollTop() - startScrollTop) > window.innerHeight * 0.25;
      if (!moved && shouldRestoreOverlay && GlobalState.enhancedModeActive && !GlobalState.isOverlayActive) {
        applyTransforms();
      }
    }, LOCK_FALLBACK_MS);

    const scrollByAmount = direction === 'next' ? window.innerHeight : -window.innerHeight;
    const scrollOptions = { top: scrollByAmount, behavior: 'smooth' };
    if (scrollTarget?.scrollBy) {
      scrollTarget.scrollBy(scrollOptions);
    } else {
      window.scrollBy(scrollOptions);
    }

    setTimeout(() => {
      if (Math.abs(getScrollTop() - startScrollTop) < 8) {
        document.documentElement.scrollBy(scrollOptions);
        window.scrollBy(scrollOptions);
      }
    }, 180);

    const overlayEl = GlobalState.overlay;

    let attempts = 0;
    const MAX_ATTEMPTS = 24; // 24 × 120ms = 2.88s max

    function finishNavigation(video) {
      clearTimeout(GlobalState.scrollNavTimeout);
      GlobalState.scrollNavTimeout = null;
      GlobalState.reelNavigationInProgress = true;
      clearHDInteractionSuppression(video);
      try {
        handleVideoChange(video);
      } finally {
        GlobalState.reelNavigationInProgress = false;
      }
    }

    function pickNewVideo() {
      attempts++;

      const scrollMoved = Math.abs(getScrollTop() - startScrollTop) > window.innerHeight * 0.25;
      const activeVideo = findActiveVideo(true);
      const activeSrc = activeVideo ? (activeVideo.currentSrc || activeVideo.src || '') : '';
      const activeRect = activeVideo?.getBoundingClientRect?.();
      const activeNearCenter = activeRect
        ? Math.abs(activeRect.top + activeRect.height / 2 - window.innerHeight / 2) < window.innerHeight * 0.32
        : false;
      if (
        activeVideo &&
        activeSrc &&
        activeNearCenter &&
        (activeVideo !== prevVideo || (activeSrc !== prevSrc && scrollMoved))
      ) {
        finishNavigation(activeVideo);
        return;
      }

      const candidates = Array.from(document.querySelectorAll('video')).filter(v => {
        if (overlayEl && overlayEl.contains(v)) return false;
        if (v.classList.contains('ir-overlay-video')) return false;
        const src = v.currentSrc || v.src || '';
        if (!src) return false;
        if (v === prevVideo && (!scrollMoved || src === prevSrc)) return false;
        const rect = v.getBoundingClientRect();
        if (rect.width <= 50 || rect.height <= 50) return false;
        if (prevRect && !scrollMoved) {
          const delta = (rect.top + rect.height / 2) - (prevRect.top + prevRect.height / 2);
          if (direction === 'next' && delta <= 20) return false;
          if (direction === 'prev' && delta >= -20) return false;
        }
        return rect.bottom > 0 && rect.top < window.innerHeight;
      });

      if (candidates.length > 0) {
        const centerY = window.innerHeight / 2;
        candidates.sort((a, b) => {
          const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
          return Math.abs(ra.top + ra.height / 2 - centerY) -
                 Math.abs(rb.top + rb.height / 2 - centerY);
        });
        finishNavigation(candidates[0]);
        return;
      }

      if (attempts < MAX_ATTEMPTS) {
        setTimeout(pickNewVideo, 120);
      } else {
        log('navigateReel: no new video found after', MAX_ATTEMPTS, 'attempts');
        clearTimeout(GlobalState.scrollNavTimeout);
        GlobalState.scrollNavTimeout = null;
        GlobalState.reelNavigationInProgress = false;
        const moved = Math.abs(getScrollTop() - startScrollTop) > window.innerHeight * 0.25;
        if (!moved && shouldRestoreOverlay && GlobalState.enhancedModeActive && !GlobalState.isOverlayActive) {
          applyTransforms();
        }
      }
    }

    setTimeout(pickNewVideo, 100);
  }

  // ============================================
  // CONTROL PANEL UI
  // ============================================



  function createControlPanel() {
    const existing = document.getElementById(CONFIG.SELECTORS.CONTROL_PANEL);
    if (existing) return existing;

    const panel = document.createElement('div');
    panel.id = CONFIG.SELECTORS.CONTROL_PANEL;
    panel.innerHTML = `
      <div class="ir-handle">
        <div class="ir-brand">
          <div class="ir-logo">
            ${CONFIG.ICONS.LOGO}
          </div>
          <span class="ir-name">ANGEL</span>
        </div>
        <div class="ir-handle-btns">
          <button class="ir-btn-icon" data-action="reset" data-tooltip="Reset View" data-keys="Esc">
             ${CONFIG.ICONS.RESET}
          </button>
          <button class="ir-btn-icon" data-action="minimize" data-tooltip="Minimize">
            ${CONFIG.ICONS.MINIMIZE}
          </button>
        </div>
      </div>
      
      <div class="ir-content">
        <!-- Playback Controls -->
        <div class="ir-group ir-group-flat">
          <div class="ir-progress-row">
            <div class="ir-progress-container">
              <div class="ir-progress-track">
                <div class="ir-progress-buffered"></div>
                <div class="ir-progress-played"></div>
              </div>
              <input type="range" class="ir-range ir-progress-range" data-action="progress-range" min="0" max="1000" value="0" step="1">
            </div>
            <div class="ir-time-row">
              <span class="ir-time-current" data-display="current-time">0:00</span>
              <span class="ir-time-sep">/</span>
              <span class="ir-time-duration" data-display="duration">0:00</span>
            </div>
          </div>
          <div class="ir-row">
            <button class="ir-btn secondary" data-action="seek-back" data-tooltip="-5s" data-keys="←">
              ${CONFIG.ICONS.REWIND}
            </button>
            <button class="ir-btn ir-btn-play" data-action="play-pause" data-tooltip="Play/Pause" data-keys="Space">
              <span data-display="play-icon">${CONFIG.ICONS.PLAY}</span>
            </button>
            <button class="ir-btn secondary" data-action="seek-forward" data-tooltip="+5s" data-keys="→">
              ${CONFIG.ICONS.FORWARD}
            </button>
          </div>
        </div>
        
        <!-- Volume Controls -->
        <div class="ir-group">
          <div class="ir-slider-row">
            <button class="ir-btn-ghost" data-action="mute" data-tooltip="Mute" data-keys="M">
              <span data-display="mute-icon">${CONFIG.ICONS.VOLUME_HIGH}</span>
            </button>
            <div class="ir-slider-wrapper">
               <input type="range" class="ir-range ir-volume-range" data-action="volume-range" min="0" max="100" value="100">
            </div>
            <span class="ir-range-value" data-display="volume-val">100</span>
          </div>
        </div>
        
        <!-- Playback Speed & Zoom (Combined Row) -->
        <div class="ir-group">
          <div class="ir-slider-row">
            <span class="ir-label-small">SPEED</span>
            <div class="ir-slider-wrapper">
               <input type="range" class="ir-range ir-speed-range" data-action="speed-range" min="25" max="200" value="100" step="25">
            </div>
            <span class="ir-range-value speed-changed" data-display="speed-val">1.0x</span>
          </div>
          <div class="ir-slider-row">
            <span class="ir-label-small">ZOOM</span>
            <div class="ir-slider-wrapper">
               <input type="range" class="ir-range" data-action="zoom-range" min="50" max="300" value="100">
            </div>
            <span class="ir-range-value" data-display="zoom">100%</span>
          </div>
        </div>
        
        <!-- View Controls (HD, Rotate) -->
        <div class="ir-group">
          <div class="ir-row">
            <button class="ir-btn secondary ir-btn-hd" data-action="toggle-hd" data-tooltip="HD Mode" data-keys="H" style="flex: 0 0 auto; padding: 0 14px;">
              <span data-display="hd-icon">${CONFIG.ICONS.HD}</span>
            </button>
            <div class="ir-quality-badge" data-display="quality-badge">SD</div>
            <div class="ir-control-group" style="flex: 1;">
              <button class="ir-btn" data-action="rotate-ccw" data-tooltip="Rotate CCW" data-keys="L">
                ${CONFIG.ICONS.ROTATE_CCW}
              </button>
              <div class="ir-badge-box" data-display="rotation">0°</div>
              <button class="ir-btn" data-action="rotate-cw" data-tooltip="Rotate CW" data-keys="R">
                ${CONFIG.ICONS.ROTATE_CW}
              </button>
            </div>
          </div>
        </div>
        
        <!-- Aspect Ratio -->
        <div class="ir-group">
          <div class="ir-aspect-pills">
            ${Object.entries(CONFIG.ASPECT_RATIOS).map(([key, cfg]) =>
      `<button class="ir-aspect-pill${key === 'original' ? ' active' : ''}" data-action="aspect" data-ratio="${key}" data-tooltip="${cfg.label}" data-keys="A">${cfg.label}</button>`
    ).join('')}
          </div>
        </div>
        
        <!-- View Modes -->
        <div class="ir-group">
          <div class="ir-row">
            <button class="ir-btn ir-btn-mode" data-action="theater" data-tooltip="Theater Mode" data-keys="T">
              ${CONFIG.ICONS.THEATER}
            </button>
            <button class="ir-btn ir-btn-mode" data-action="fullscreen" data-tooltip="Fullscreen" data-keys="F">
               ${CONFIG.ICONS.FULLSCREEN}
            </button>
          </div>
        </div>
        
        <!-- Social Actions -->
        <div class="ir-group">
          <div class="ir-social-grid">
            <button class="ir-btn ir-btn-social ir-btn-like" data-action="like" data-tooltip="Like" data-keys="X">
              <span data-display="like-icon">${CONFIG.ICONS.LIKE}</span>
            </button>
            <button class="ir-btn ir-btn-social ir-btn-save" data-action="save" data-tooltip="Save" data-keys="S">
              <span data-display="save-icon">${CONFIG.ICONS.SAVE}</span>
            </button>
            <button class="ir-btn ir-btn-social ir-btn-download" data-action="download" data-tooltip="Download" data-keys=".">
              <span data-display="download-icon">${CONFIG.ICONS.DOWNLOAD}</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Event handlers
    panel.addEventListener('click', handlePanelClick);

    const zoomRange = panel.querySelector('[data-action="zoom-range"]');
    zoomRange.addEventListener('input', (e) => {
      setZoom(parseInt(e.target.value, 10) / 100);
    });

    const volumeRange = panel.querySelector('[data-action="volume-range"]');
    volumeRange.addEventListener('input', (e) => {
      setVolume(parseInt(e.target.value, 10) / 100);
    });

    const speedRange = panel.querySelector('[data-action="speed-range"]');
    speedRange.addEventListener('input', (e) => {
      setPlaybackSpeed(parseInt(e.target.value, 10) / 100);
    });

    const progressRange = panel.querySelector('[data-action="progress-range"]');
    progressRange.addEventListener('input', (e) => {
      const video = GlobalState.currentVideo;
      if (video && isFinite(video.duration) && video.duration > 0) {
        video.currentTime = (parseInt(e.target.value, 10) / 1000) * video.duration;
      }
    });

    // Make draggable
    makeDraggable(panel, panel.querySelector('.ir-handle'));

    // Setup custom tooltips for all elements with data-tooltip
    setupCustomTooltips(panel);

    // Auto-hide behavior
    setupAutoHide(panel);

    // Click on minimized panel to expand
    panel.addEventListener('click', (e) => {
      if (panel.classList.contains('minimized')) {
        // Only expand if clicking on the panel itself, not buttons
        if (!e.target.closest('[data-action]')) {
          panel.classList.remove('minimized');
          // Restart hide timer
          const revealBtn = document.getElementById('angel-reveal-btn');
          if (revealBtn) revealBtn.classList.remove('visible');
        }
      }
    });

    document.body.appendChild(panel);
    GlobalState.controlPanel = panel;

    return panel;
  }

  function handlePanelClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;

    switch (action) {
      case 'rotate-cw':
        rotate(90);
        break;
      case 'rotate-ccw':
        rotate(-90);
        break;
      case 'zoom-in':
        setZoom(GlobalState.zoom + CONFIG.ZOOM.STEP);
        break;
      case 'zoom-out':
        setZoom(GlobalState.zoom - CONFIG.ZOOM.STEP);
        break;
      case 'theater':
        toggleTheaterMode();
        break;
      case 'fullscreen':
        toggleFullscreen();
        break;
      case 'reset':
        resetAll();
        break;
      case 'minimize':
        const ctrlPanel = document.getElementById(CONFIG.SELECTORS.CONTROL_PANEL);
        if (ctrlPanel) {
          const isMinimized = ctrlPanel.classList.toggle('minimized');
          // If minimized, remove auto-hide and ensure panel is visible
          if (isMinimized) {
            ctrlPanel.classList.remove('auto-hide');
            const revealBtn = document.getElementById('angel-reveal-btn');
            if (revealBtn) revealBtn.classList.remove('visible');
          }
        }
        break;
      case 'aspect':
        setAspectRatio(btn.dataset.ratio);
        break;
      case 'mute':
        toggleMute();
        break;
      case 'play-pause':
        togglePlayPause();
        break;
      case 'seek-back':
        seekVideo(-5);
        break;
      case 'seek-forward':
        seekVideo(5);
        break;
      case 'like':
        triggerLike();
        break;

      case 'save':
        triggerSave();
        break;
      case 'toggle-hd':
        toggleHDMode();
        break;
      case 'download':
        triggerDownload();
        break;
    }
  }

  function updateControlPanel() {
    const panel = document.getElementById(CONFIG.SELECTORS.CONTROL_PANEL);
    if (!panel) return;

    // Rotation display
    const rotDisplay = panel.querySelector('[data-display="rotation"]');
    if (rotDisplay) rotDisplay.textContent = `${GlobalState.rotation}°`;

    // Zoom display
    const zoomDisplay = panel.querySelector('[data-display="zoom"]');
    const zoomRange = panel.querySelector('[data-action="zoom-range"]');
    if (zoomDisplay) zoomDisplay.textContent = `${Math.round(GlobalState.zoom * 100)}%`;
    if (zoomRange) zoomRange.value = GlobalState.zoom * 100;

    // Aspect ratio buttons
    panel.querySelectorAll('.ir-aspect-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.ratio === GlobalState.aspectRatio);
    });

    // Simple Action Buttons (Theater, Fullscreen, HD) matches standard ir-btn state
    panel.querySelector('[data-action="theater"]')?.classList.toggle('active', GlobalState.isTheaterMode);
    panel.querySelector('[data-action="fullscreen"]')?.classList.toggle('active', GlobalState.isFullscreen);

    // HD Toggle state
    const hdToggle = panel.querySelector('[data-action="toggle-hd"]');
    if (hdToggle) {
      hdToggle.classList.toggle('active', GlobalState.hdMode);
    }

    // Quality Indicator Badge
    const qualityBadge = panel.querySelector('[data-display="quality-badge"]');
    if (qualityBadge) {
      const qualityLabel = getSimpleQualityLabel();
      qualityBadge.textContent = qualityLabel;
      qualityBadge.title = `Current Quality: ${getQualityLabel()}`;

      // Add loading class
      qualityBadge.classList.toggle('loading', GlobalState.hdLoading);

      // Color coding based on quality
      qualityBadge.classList.remove('quality-4k', 'quality-hd', 'quality-sd');
      if (qualityLabel.includes('4K') || qualityLabel.includes('1440p')) {
        qualityBadge.classList.add('quality-4k');
      } else if (qualityLabel.includes('1080p') || qualityLabel.includes('720p') || qualityLabel === 'HD') {
        qualityBadge.classList.add('quality-hd');
      } else {
        qualityBadge.classList.add('quality-sd');
      }
    }

    // Audio controls
    const video = GlobalState.currentVideo;
    if (video) {
      // Volume slider
      const volumeRange = panel.querySelector('[data-action="volume-range"]');
      const volumeVal = panel.querySelector('[data-display="volume-val"]');
      if (volumeRange) {
        volumeRange.value = video.muted ? 0 : video.volume * 100;
        if (volumeVal) volumeVal.textContent = Math.round(volumeRange.value);
      }

      // Mute icon
      const muteIcon = panel.querySelector('[data-display="mute-icon"]');
      if (muteIcon) {
        if (video.muted || video.volume === 0) {
          muteIcon.innerHTML = CONFIG.ICONS.VOLUME_MUTE;
        } else if (video.volume < 0.5) {
          muteIcon.innerHTML = CONFIG.ICONS.VOLUME_LOW;
        } else {
          muteIcon.innerHTML = CONFIG.ICONS.VOLUME_HIGH;
        }
      }

      // Play/pause icon
      const playIcon = panel.querySelector('[data-display="play-icon"]');
      if (playIcon) {
        playIcon.innerHTML = video.paused ? CONFIG.ICONS.PLAY : CONFIG.ICONS.PAUSE;
      }

      // Playback speed
      const speedRange = panel.querySelector('[data-action="speed-range"]');
      const speedVal = panel.querySelector('[data-display="speed-val"]');
      if (speedRange) {
        const currentSpeed = video.playbackRate;
        speedRange.value = currentSpeed * 100;
        if (speedVal) {
          const speedText = currentSpeed.toFixed(2).replace(/\.?0+$/, '') + 'x';
          speedVal.textContent = speedText;
          // Highlight if speed is different from normal
          speedVal.classList.toggle('speed-changed', currentSpeed !== 1.0);
        }
      }

      // Progress bar and time display
      const progressRange = panel.querySelector('[data-action="progress-range"]');
      const currentTimeEl = panel.querySelector('[data-display="current-time"]');
      const durationEl = panel.querySelector('[data-display="duration"]');
      if (progressRange && isFinite(video.duration) && video.duration > 0) {
        // Only update range when user is not dragging
        if (document.activeElement !== progressRange) {
          progressRange.value = Math.round((video.currentTime / video.duration) * 1000);
        }
        if (currentTimeEl) currentTimeEl.textContent = formatVideoTime(video.currentTime);
        if (durationEl) durationEl.textContent = formatVideoTime(video.duration);

        // Update progress track visuals
        const played = panel.querySelector('.ir-progress-played');
        const buffered = panel.querySelector('.ir-progress-buffered');
        const progress = (video.currentTime / video.duration) * 100;
        if (played) played.style.width = `${progress}%`;
        if (buffered && video.buffered.length > 0) {
          const bufferedEnd = video.buffered.end(video.buffered.length - 1);
          buffered.style.width = `${(bufferedEnd / video.duration) * 100}%`;
        }
      }
    }

    // Social button states — single DOM scan shared by both like and save
    const likeIcon = panel.querySelector('[data-display="like-icon"]');
    const saveIcon = panel.querySelector('[data-display="save-icon"]');
    const likeBtn = panel.querySelector('.ir-btn-like');
    const saveBtn = panel.querySelector('.ir-btn-save');

    if ((likeIcon && likeBtn) || (saveIcon && saveBtn)) {
      const socialButtons = findReelActionButtons();
      if (likeIcon && likeBtn) {
        const userLiked = getLikeState(socialButtons);
        likeIcon.innerHTML = userLiked ? CONFIG.ICONS.LIKE_ACTIVE : CONFIG.ICONS.LIKE;
        likeBtn.classList.toggle('active', !!userLiked);
      }
      if (saveIcon && saveBtn) {
        const userSaved = getSaveState(socialButtons);
        saveIcon.innerHTML = userSaved ? CONFIG.ICONS.SAVE_ACTIVE : CONFIG.ICONS.SAVE;
        saveBtn.classList.toggle('active', !!userSaved);
      }
    }
  }

  function updatePanelVisibility() {
    const panel = document.getElementById(CONFIG.SELECTORS.CONTROL_PANEL);
    // Show panel on Reels page even if video not yet detected (fixes loading issues)
    const shouldShow = isReelsPage();

    if (shouldShow && !panel) {
      try {
        // Show skeleton loader while creating panel
        showControlPanelSkeleton();

        // Create actual panel after short delay
        setTimeout(() => {
          try {
            createControlPanel();
            hideControlPanelSkeleton();
          } catch (e) {
            log('Error creating control panel:', e);
            hideControlPanelSkeleton();
            // Retry once after a delay
            setTimeout(() => {
              try {
                if (!document.getElementById(CONFIG.SELECTORS.CONTROL_PANEL)) {
                  createControlPanel();
                }
              } catch (retryErr) {
                log('Retry error creating control panel:', retryErr);
              }
            }, 500);
          }
        }, 100);
      } catch (e) {
        log('Error in updatePanelVisibility:', e);
      }
    } else if (panel) {
      panel.style.display = shouldShow ? '' : 'none';
    }
  }

  function showControlPanelSkeleton() {
    let skeleton = document.getElementById('angel-ctrl-skeleton');
    if (skeleton) return;

    skeleton = document.createElement('div');
    skeleton.id = 'angel-ctrl-skeleton';
    skeleton.className = 'ir-skeleton';
    skeleton.innerHTML = `
      <div class="ir-skeleton-header"></div>
      <div class="ir-skeleton-content">
        <div class="ir-skeleton-row"></div>
        <div class="ir-skeleton-row"></div>
        <div class="ir-skeleton-row"></div>
      </div>
    `;
    document.body.appendChild(skeleton);
  }

  function hideControlPanelSkeleton() {
    const skeleton = document.getElementById('angel-ctrl-skeleton');
    if (skeleton) {
      skeleton.remove();
    }
  }

  // Setup beautiful custom tooltips
  function setupCustomTooltips(panel) {
    // Create tooltip element if not exists
    let tooltip = document.getElementById('ir-global-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'ir-global-tooltip';
      tooltip.className = 'ir-tooltip';
      tooltip.innerHTML = '<div class="ir-tooltip-content"><span class="ir-tooltip-text"></span><kbd class="ir-tooltip-keys"></kbd></div>';
      tooltip.style.position = 'fixed';
      tooltip.style.zIndex = '100050';
      tooltip.style.pointerEvents = 'none';
      tooltip.style.opacity = '0';
      tooltip.style.transition = 'opacity 0.1s ease';
      document.body.appendChild(tooltip);
    }

    const tooltipText = tooltip.querySelector('.ir-tooltip-text');
    const tooltipKeys = tooltip.querySelector('.ir-tooltip-keys');

    // Find all elements with data-tooltip
    const elements = panel.querySelectorAll('[data-tooltip]');
    elements.forEach(el => {
      el.addEventListener('mouseenter', (e) => {
        const text = el.dataset.tooltip;
        const keys = el.dataset.keys;
        if (!text) return;

        tooltipText.textContent = text;
        if (keys) {
          tooltipKeys.textContent = keys;
          tooltipKeys.style.display = 'inline';
        } else {
          tooltipKeys.style.display = 'none';
        }

        const rect = el.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        // Position above the element, centered
        const top = rect.top - 38;
        let left = rect.left + (rect.width / 2);

        // Constrain to viewport
        tooltip.style.opacity = '1';
        const tooltipWidth = tooltip.offsetWidth || 120;
        left = Math.max(10, Math.min(left - (tooltipWidth / 2), window.innerWidth - tooltipWidth - 10));

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
      });

      el.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
      });
    });
  }

  function setupAutoHide(panel) {
    const HIDE_DELAY = CONFIG.UI_HIDE_DELAY || 3000;

    // Create or reuse the floating reveal button
    let revealBtn = document.getElementById('angel-reveal-btn');
    if (!revealBtn) {
      revealBtn = document.createElement('button');
      revealBtn.id = 'angel-reveal-btn';
      revealBtn.className = 'angel-reveal-btn';
      revealBtn.innerHTML = '✦';
      document.body.appendChild(revealBtn);
    }

    // Create edge hover zone for easier reveal
    let edgeZone = document.getElementById('ir-edge-zone');
    if (!edgeZone) {
      edgeZone = document.createElement('div');
      edgeZone.id = 'ir-edge-zone';
      edgeZone.className = 'ir-edge-zone';
      document.body.appendChild(edgeZone);
    }

    const clearHideTimer = () => {
      if (panel._hideTimer) {
        clearTimeout(panel._hideTimer);
        panel._hideTimer = null;
      }
    };

    const showPanel = () => {
      panel.classList.remove('auto-hide');
      revealBtn.classList.remove('visible');
      clearHideTimer();
    };

    const hidePanel = () => {
      // Don't hide if minimized
      if (panel.classList.contains('minimized')) {
        return;
      }
      panel.classList.add('auto-hide');
      revealBtn.classList.add('visible');
    };

    const startHideTimer = () => {
      clearHideTimer();

      // Don't hide if panel is minimized or currently hovered
      if (panel.classList.contains('minimized') ||
          panel.matches(':hover') ||
          document.getElementById('angel-shortcuts-list')?.style.display === 'grid') {
        return;
      }

      panel._hideTimer = setTimeout(hidePanel, HIDE_DELAY);
    };

    // Click reveal button to show panel
    revealBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showPanel();
      // Don't restart timer immediately - let user interact
      setTimeout(() => startHideTimer(), 100);
    });

    // Hover edge zone to reveal
    edgeZone.addEventListener('mouseenter', () => {
      if (panel.classList.contains('auto-hide')) {
        showPanel();
      }
    });

    // Panel mouse events
    panel.addEventListener('mouseenter', showPanel);
    panel.addEventListener('mouseleave', startHideTimer);

    // Initial hide timer
    startHideTimer();
  }

  // Clamp an absolutely-positioned element so it stays fully within the viewport.
  function clampToViewport(element) {
    const rect = element.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8; // px gap from edges

    let left = parseInt(element.style.left) || rect.left;
    let top = parseInt(element.style.top) || rect.top;

    left = Math.min(Math.max(left, margin), vw - rect.width - margin);
    top  = Math.min(Math.max(top,  margin), vh - rect.height - margin);

    element.style.left  = `${left}px`;
    element.style.top   = `${top}px`;
    element.style.right  = 'auto';
    element.style.bottom = 'auto';
  }

  function makeDraggable(element, handle) {
    let isDragging = false;
    let startX, startY, initX, initY;

    handle.style.cursor = 'grab';

    const onMouseDown = (e) => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      isDragging = true;
      handle.style.cursor = 'grabbing';
      element.style.transition = 'none';

      const rect = element.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;

      const computed = window.getComputedStyle(element);
      initX = parseInt(computed.left) || rect.left;
      initY = parseInt(computed.top) || rect.top;

      if (computed.right !== 'auto' && computed.left === 'auto') {
        initX = rect.left;
      }
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      element.style.left = `${initX + dx}px`;
      element.style.top = `${initY + dy}px`;
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      handle.style.cursor = 'grab';
      element.style.transition = '';
      // Snap back if drag moved panel partially off-screen
      clampToViewport(element);
      // Persist the new position
      const left = parseInt(element.style.left) || 0;
      const top  = parseInt(element.style.top)  || 0;
      Settings.savePanelPosition(left, top);
    };

    handle.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // ============================================
  // KEYBOARD HANDLING
  // ============================================

  function handleKeydown(e) {
    // Ignore when typing in inputs
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) {
      return;
    }

    const key = e.key.toLowerCase();
    let handled = true;

    // Let Instagram handle arrow left/right (for seeking)
    if (key === 'arrowleft' || key === 'arrowright') {
      return;
    }

    // Special handling for up/down arrows in overlay mode
    if ((key === 'arrowup' || key === 'arrowdown') &&
        (GlobalState.isOverlayActive || (GlobalState.enhancedModeActive && GlobalState.scrollNavTimeout))) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      // Debounce: ignore key-repeat events until the previous navigation settles
      if (GlobalState.scrollNavTimeout) return;
      navigateReel(key === 'arrowdown' ? 'next' : 'prev');
      return;
    }

    // Like shortcut (X)
    if (key === 'x') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation(); // Prevent any other handlers

      // Use requestAnimationFrame to ensure we're not in the middle of a scroll
      // This prevents the weird scroll behavior when pressing like shortcut
      requestAnimationFrame(() => {
        // Double-check we have the right video before liking
        const currentVideo = findActiveVideo();
        if (currentVideo && currentVideo !== GlobalState.currentVideo) {
          log('Like shortcut: syncing to visible video first');
          handleVideoChange(currentVideo);
        }

        // Small delay to let any pending scroll settle
        setTimeout(() => {
          triggerLike();
        }, 50);
      });
      return;
    }

    // Hold-to-speed shortcuts ([ for slow, ] for fast)
    if (key === CONFIG.KEYBOARD.SPEED_SLOW || key === CONFIG.KEYBOARD.SPEED_FAST) {
      e.preventDefault();
      e.stopPropagation();

      // Only activate on first keydown (prevent repeat events)
      if (!GlobalState.isHoldingSpeedKey) {
        GlobalState.isHoldingSpeedKey = true;
        GlobalState.previousSpeed = GlobalState.playbackSpeed;

        const targetSpeed = key === CONFIG.KEYBOARD.SPEED_SLOW
          ? CONFIG.PLAYBACK_SPEED.HOLD_SLOW
          : CONFIG.PLAYBACK_SPEED.HOLD_FAST;

        setPlaybackSpeed(targetSpeed, true);
      }
      return;
    }

    // Handle custom shortcuts
    switch (key) {
      case CONFIG.KEYBOARD.ROTATE_CW:
        rotate(90);
        break;
      case CONFIG.KEYBOARD.ROTATE_CCW:
        rotate(-90);
        break;
      case CONFIG.KEYBOARD.FULLSCREEN:
        toggleFullscreen();
        break;
      case CONFIG.KEYBOARD.THEATER:
        toggleTheaterMode();
        break;
      case CONFIG.KEYBOARD.ZOOM_IN:
        setZoom(GlobalState.zoom + CONFIG.ZOOM.STEP);
        break;
      case CONFIG.KEYBOARD.ZOOM_OUT:
        setZoom(GlobalState.zoom - CONFIG.ZOOM.STEP);
        break;
      case CONFIG.KEYBOARD.ASPECT_CYCLE:
        cycleAspectRatio();
        break;
      case CONFIG.KEYBOARD.MUTE:
        toggleMute();
        break;
      case ' ':  // Space bar for play/pause
        togglePlayPause();
        break;
      case 'escape':
        resetAll();
        break;
      case CONFIG.KEYBOARD.HD_TOGGLE:
        toggleHDMode();
        break;
      case CONFIG.KEYBOARD.SAVE:
        triggerSave();
        break;
      case CONFIG.KEYBOARD.DOWNLOAD:
        if (!isDownloadShortcut(e)) {
          handled = false;
          break;
        }
        triggerDownload();
        break;
      default:
        handled = false;
    }

    if (handled) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      // Control panel stays hidden - keyboard shortcuts should be discrete
    }
  }

  function isDownloadShortcut(e) {
    const modifier = CONFIG.KEYBOARD.DOWNLOAD_MODIFIER;
    if (!modifier) return true;
    if (modifier === true || modifier === 'primary') return e.metaKey || e.ctrlKey;
    if (modifier === 'shift') return e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey;
    if (modifier === 'alt') return e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey;
    return false;
  }

  function handleKeyup(e) {
    // Ignore when typing in inputs
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) {
      return;
    }

    const key = e.key.toLowerCase();

    // Release hold-to-speed keys ([ and ])
    if ((key === CONFIG.KEYBOARD.SPEED_SLOW || key === CONFIG.KEYBOARD.SPEED_FAST) && GlobalState.isHoldingSpeedKey) {
      e.preventDefault();
      e.stopPropagation();

      GlobalState.isHoldingSpeedKey = false;
      setPlaybackSpeed(GlobalState.previousSpeed, false);
      return;
    }
  }

  // ============================================
  // WHEEL/SCROLL HANDLING
  // ============================================

  function handleWheel(e) {
    // Shift + scroll = zoom
    if (e.shiftKey && GlobalState.currentVideo) {
      e.preventDefault();
      setZoom(GlobalState.zoom + (e.deltaY > 0 ? -CONFIG.ZOOM.STEP : CONFIG.ZOOM.STEP));
      return;
    }

    // In overlay mode, scroll navigates reels
    if (GlobalState.isOverlayActive || (GlobalState.enhancedModeActive && GlobalState.scrollNavTimeout)) {
      e.preventDefault();
      e.stopPropagation();

      // Debounce navigation
      if (GlobalState.scrollNavTimeout) return;

      navigateReel(e.deltaY > 0 ? 'next' : 'prev');
    }
  }

  // ============================================
  // OBSERVERS
  // ============================================

  function setupObservers() {
    if (!document.__angel_like_hd_pause__) {
      document.addEventListener('click', (event) => {
        if (isInstagramLikeTarget(event.target)) {
          const activeVideo = findActiveVideo(true) || GlobalState.currentVideo;
          pauseHDRestoration(4500, 'native like click', activeVideo);
        }
      }, true);
      document.addEventListener('dblclick', (event) => {
        if (event.target?.closest?.('article, [role="button"], section')) {
          const activeVideo = findActiveVideo(true) || GlobalState.currentVideo;
          if (activeVideo) {
            pauseHDRestoration(4500, 'native double-tap like', activeVideo);
          }
        }
      }, true);
      document.__angel_like_hd_pause__ = true;
    }

    // Debounced video detection
    const detectVideo = debounce(() => {
      const video = findActiveVideo(true);
      if (video) {
        handleVideoChange(video);
      }
      updatePanelVisibility();
      syncInlineDownloadButtons(true);
    }, CONFIG.VIDEO_DETECT_DEBOUNCE);

    // Optimized Mutation observer with specific filters to reduce overhead
    try {
      GlobalState.mutationObserver = new MutationObserver((mutations) => {
        // Filter mutations to only video-relevant changes
        const hasRelevantChange = mutations.some(mutation => {
          if (mutation.target?.closest?.('.angel-inline-download-slot')) {
            return false;
          }

          // Check if mutation affects video elements
          if (mutation.type === 'childList') {
            const hasVideo = Array.from(mutation.addedNodes).some(node =>
              node.nodeName === 'VIDEO' ||
              node.nodeName === 'IMG' ||
              (node.querySelector && node.querySelector('video, img'))
            );
            if (hasVideo) return true;
          }
          // Check for media attribute changes on visible media elements
          if (mutation.type === 'attributes' && (mutation.target.nodeName === 'VIDEO' || mutation.target.nodeName === 'IMG')) {
            return ['src', 'srcset', 'style'].includes(mutation.attributeName);
          }
          return false;
        });

        if (hasRelevantChange) {
          detectVideo();
        }
      });

      // Observe with more specific configuration
      const targetNode = document.querySelector('main[role="main"]') || document.body;
      GlobalState.mutationObserver.observe(targetNode, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'srcset', 'style'], // Only watch these attributes
        attributeOldValue: false // Don't store old values (saves memory)
      });
    } catch (e) {
      log('Error setting up optimized MutationObserver, using fallback:', e);
      // Fallback to basic observer
      GlobalState.mutationObserver = new MutationObserver(detectVideo);
      GlobalState.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    // Listen for navigation
    window.addEventListener('popstate', detectVideo);

    // Intercept history API — guard against double-patching on re-init
    if (!history.pushState.__angel_patched__) {
      const originalPushState = history.pushState;
      history.pushState = function (...args) {
        originalPushState.apply(this, args);
        detectVideo();
      };
      history.pushState.__angel_patched__ = true;
    }

    if (!history.replaceState.__angel_patched__) {
      const originalReplaceState = history.replaceState;
      history.replaceState = function (...args) {
        originalReplaceState.apply(this, args);
        detectVideo();
      };
      history.replaceState.__angel_patched__ = true;
    }

    // Window resize
    try {
      GlobalState.resizeObserver = new ResizeObserver(() => {
        const viewportChanged =
          GlobalState.lastViewport.width !== window.innerWidth ||
          GlobalState.lastViewport.height !== window.innerHeight;

        if (viewportChanged) {
          GlobalState.lastViewport.width = window.innerWidth;
          GlobalState.lastViewport.height = window.innerHeight;

          // Keep control panel inside the new viewport bounds
          const panel = document.getElementById(CONFIG.SELECTORS.CONTROL_PANEL);
          if (panel && panel.style.left) {
            clampToViewport(panel);
          }
        }

        if (GlobalState.isOverlayActive) {
          applyTransforms();
        } else if (GlobalState.currentVideo) {
          // Only refresh baseline when viewport truly changes.
          if (viewportChanged) {
            captureVideoDimensions(GlobalState.currentVideo, true);
          }
          if (GlobalState.hdMode) {
            enforceDimensionsIfNeeded(GlobalState.currentVideo);
          }
        }
      });
      GlobalState.resizeObserver.observe(document.body);
    } catch (e) {
      log('Error setting up ResizeObserver:', e);
    }

    // IntersectionObserver for viewport-aware processing (performance optimization)
    // Only process HD videos when they're actually visible
    try {
      GlobalState.intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            const video = entry.target;
            if (entry.isIntersecting && video === GlobalState.currentVideo) {
              // Video is in viewport and is the current video
              if (GlobalState.hdMode && !video._hdApplied) {
                // Lazy load HD video only when visible
                log('Video entered viewport, attempting HD upgrade');
                applyHDToVideo(video);
              }
            }
          });
        },
        {
          root: null, // viewport
          rootMargin: '50px', // Start loading slightly before video enters viewport
          threshold: 0.1 // Trigger when 10% visible
        }
      );
    } catch (e) {
      log('Error setting up IntersectionObserver:', e);
    }

    // Optimized scroll listener with throttling for better performance
    const scrollContainer = getScrollContainer();
    const scrollHandler = throttle(() => {
      try {
        // Only check for video changes when not in overlay mode
        if (!GlobalState.isOverlayActive) {
          const video = findActiveVideo();
          if (video && video !== GlobalState.currentVideo) {
            // Track performance metrics
            GlobalState.performanceMetrics.videoDetections++;
            GlobalState.performanceMetrics.lastDetectionTime = Date.now();
            handleVideoChange(video);
            syncInlineDownloadButtons(true);
          }
        }
      } catch (e) {
        log('Error in scroll handler:', e);
      }
    }, 200); // Throttle to max once per 200ms

    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', scrollHandler, { passive: true });
      // Store reference for cleanup
      GlobalState._scrollHandler = scrollHandler;
      GlobalState._scrollContainer = scrollContainer;
    }
  }

  // ============================================
  // FULLSCREEN CHANGE
  // ============================================

  document.addEventListener('fullscreenchange', () => {
    GlobalState.isFullscreen = !!document.fullscreenElement;
    updateControlPanel();
  });

  // ============================================
  // CLEANUP
  // ============================================

  function cleanup() {
    log('Cleaning up...');

    try {
      // Reset transforms
      if (typeof resetAll === 'function') {
        resetAll();
      }
    } catch (e) {
      log('Error resetting transforms:', e);
    }

    try {
      // Remove elements
      GlobalState.backdrop?.remove();
      GlobalState.overlay?.remove();
      GlobalState.controlPanel?.remove();
      document.getElementById('ir-exit-hint')?.remove();
      document.getElementById(CONFIG.SELECTORS.TOAST)?.remove();
      document.getElementById('angel-hover-download-btn')?.remove();
      document.querySelectorAll('.angel-inline-download-slot').forEach(node => node.remove());
    } catch (e) {
      log('Error removing elements:', e);
    }

    try {
      // Disconnect all observers
      GlobalState.mutationObserver?.disconnect();
      GlobalState.resizeObserver?.disconnect();
      GlobalState.intersectionObserver?.disconnect();

      // Remove scroll listener
      if (GlobalState._scrollContainer && GlobalState._scrollHandler) {
        try {
          GlobalState._scrollContainer.removeEventListener('scroll', GlobalState._scrollHandler);
        } catch (e) {
          log('Error removing scroll listener:', e);
        }
      }

      if (GlobalState.mediaDownloadHandlers) {
        document.removeEventListener('mouseover', GlobalState.mediaDownloadHandlers.mouseover);
        document.removeEventListener('mouseout', GlobalState.mediaDownloadHandlers.mouseout);
        document.removeEventListener('contextmenu', GlobalState.mediaDownloadHandlers.contextmenu, true);
        GlobalState.mediaDownloadHandlers = null;
      }

      GlobalState.refreshMediaDownloadButton = null;
      GlobalState.activeVideoCache = { video: null, at: 0, path: '', width: 0, height: 0 };
      GlobalState.inlineDownloadSyncCache = { signature: '', at: 0, mount: null };

      // Clean up video event listeners
      if (GlobalState.currentVideo) {
        const video = GlobalState.currentVideo;
        if (video._ir_muteListener) {
          video.removeEventListener('seeked', video._ir_muteListener);
          video.removeEventListener('play', video._ir_muteListener);
          video.removeEventListener('playing', video._ir_muteListener);
          delete video._ir_muteListener;
        }
        if (video._dimensionCheckInterval) {
          clearInterval(video._dimensionCheckInterval);
          delete video._dimensionCheckInterval;
        }
        if (video._dimensionResizeObserver) {
          video._dimensionResizeObserver.disconnect();
          delete video._dimensionResizeObserver;
        }
        if (video._hdQualityCheckInterval) {
          clearInterval(video._hdQualityCheckInterval);
          delete video._hdQualityCheckInterval;
        }
        if (video._timeUpdateHDHandler) {
          video.removeEventListener('timeupdate', video._timeUpdateHDHandler);
          delete video._timeUpdateHDHandler;
        }
        if (video._srcObserver) {
          video._srcObserver.disconnect();
          delete video._srcObserver;
        }
      }
    } catch (e) {
      log('Error disconnecting observers:', e);
    }

    try {
      // Reset body class
      if (document.body) {
        document.body.classList.remove('ir-overlay-active');
      }
    } catch (e) {
      log('Error removing body class:', e);
    }

    log('Cleanup complete');
  }

  // Export cleanup function globally for health check
  window.__ANGEL_CLEANUP__ = cleanup;

  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('pagehide', cleanup);

  // Extension context check
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'cleanup') {
        cleanup();
        sendResponse({ success: true });
      } else if (message.action === 'downloadContextMedia') {
        const contextMediaIsFresh = GlobalState.contextDownloadMediaInfo &&
          Date.now() - (GlobalState.contextDownloadMediaAt || 0) < 30000;
        const mediaInfo = contextMediaIsFresh ? GlobalState.contextDownloadMediaInfo : detectCurrentMedia();

        if (!mediaInfo?.type || mediaInfo.type === 'unknown') {
          sendResponse({ success: false, error: 'No media found' });
          return;
        }

        triggerDownload(mediaInfo);
        sendResponse({ success: true });
      } else if (message.action === 'getPerformanceMetrics') {
        sendResponse({
          success: true,
          metrics: GlobalState.performanceMetrics,
          currentVideo: !!GlobalState.currentVideo,
          isOverlayActive: GlobalState.isOverlayActive,
          observers: {
            mutation: !!GlobalState.mutationObserver,
            resize: !!GlobalState.resizeObserver,
            intersection: !!GlobalState.intersectionObserver
          }
        });
      }
    });
  }

  // Expose performance metrics for debugging
  window.__ANGEL_PERFORMANCE__ = () => {
    const metrics = GlobalState.performanceMetrics;
    const now = Date.now();
    const timeSinceLastDetection = metrics.lastDetectionTime ?
      ((now - metrics.lastDetectionTime) / 1000).toFixed(1) + 's' : 'never';

    console.log('=== ANGEL Performance Metrics ===');
    console.log('Video Detections:', metrics.videoDetections);
    console.log('HD Attempts:', metrics.hdAttempts);
    console.log('HD Successes:', metrics.hdSuccesses);
    console.log('HD Success Rate:',
      metrics.hdAttempts > 0 ?
        ((metrics.hdSuccesses / metrics.hdAttempts) * 100).toFixed(1) + '%' :
        'N/A');
    console.log('Time Since Last Detection:', timeSinceLastDetection);
    console.log('Current Video:', !!GlobalState.currentVideo);
    console.log('Overlay Active:', GlobalState.isOverlayActive);
    console.log('Observers Active:', {
      mutation: !!GlobalState.mutationObserver,
      resize: !!GlobalState.resizeObserver,
      intersection: !!GlobalState.intersectionObserver,
      scroll: !!GlobalState._scrollHandler
    });
    console.log('================================');

    return metrics;
  };

  // ============================================
  // INITIALIZATION
  // ============================================

  function init() {
    log(`v${CONFIG.VERSION} initializing...`);

    // Restore persisted user preferences (async, non-blocking)
    Settings.load();

    try {
      // Add event listeners with error boundaries
      try {
        document.addEventListener('keydown', handleKeydown, true);
        document.addEventListener('keyup', handleKeyup, true);
        document.addEventListener('wheel', handleWheel, { passive: false });
      } catch (e) {
        log('Error adding event listeners:', e);
      }

      // Setup observers with error handling
      try {
        setupObservers();
      } catch (e) {
        log('Error setting up observers:', e);
      }

      // Setup HD video interception with fallback
      try {
        injectHDInterceptor();
        setupHDVideoListeners();
      } catch (e) {
        log('Error setting up HD interception (non-critical):', e);
        // Continue even if HD fails
      }

      // Initial video detection with retry
      try {
        const video = findActiveVideo();
        if (video) {
          GlobalState.currentVideo = video;
          GlobalState.currentVideoSrc = video.currentSrc || video.src;
        } else {
          // Retry after a delay if no video found
          setTimeout(() => {
            try {
              const retryVideo = findActiveVideo();
              if (retryVideo) {
                GlobalState.currentVideo = retryVideo;
                GlobalState.currentVideoSrc = retryVideo.currentSrc || retryVideo.src;
                log('Video found on retry');
              }
            } catch (e) {
              log('Error in retry video detection:', e);
            }
          }, 1000);
        }
      } catch (e) {
        log('Error in initial video detection:', e);
      }

      // Create UI if on reels page with retry logic for reliability
      try {
        updatePanelVisibility();

        // Setup hover download button
        try {
          setupMediaDownloadButtons();
          syncInlineDownloadButtons(true);
        } catch (e) {
          log('Error setting up media download buttons:', e);
        }

        // Retry panel creation if it didn't appear (reliability fix)
        setTimeout(() => {
          if (isReelsPage() && !document.getElementById(CONFIG.SELECTORS.CONTROL_PANEL)) {
            log('Panel not created on first attempt, retrying...');
            updatePanelVisibility();
          }
        }, 1000);

        // Second retry with longer delay for slow page loads
        setTimeout(() => {
          if (isReelsPage() && !document.getElementById(CONFIG.SELECTORS.CONTROL_PANEL)) {
            log('Panel still missing, final retry...');
            updatePanelVisibility();
          }
        }, 3000);
      } catch (e) {
        log('Error updating panel visibility:', e);
        // Try one more time after a delay
        setTimeout(() => {
          try {
            updatePanelVisibility();
          } catch (retryErr) {
            log('Retry failed:', retryErr);
          }
        }, 500);
      }

      log('Ready!');
    } catch (e) {
      log('Critical error during initialization:', e);
      // Try to show error to user
      try {
        showToast('ANGEL: Initialization error. Please reload page.', '⚠️');
      } catch (toastErr) {
        console.error('[ANGEL] Failed to show error toast:', toastErr);
      }
    }
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
