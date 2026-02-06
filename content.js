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
    VERSION: '3.0.0',

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

    KEYBOARD: {
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
    },

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
      RESET: '<svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>'
    }
  };

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

    // Current video reference
    currentVideo: null,
    currentVideoSrc: null,

    // Cached elements
    backdrop: null,
    overlay: null,
    controlPanel: null,

    // Timers
    hideTimer: null,
    scrollNavTimeout: null,

    // Observers
    mutationObserver: null,
    resizeObserver: null,
    intersectionObserver: null,

    // HD Video settings
    hdMode: true, // HD mode enabled by default
    hdVideoMap: new Map(), // Maps video URL keys to HD URLs
    currentVideoQuality: null, // { width, height } of current video
    hdAppliedToCurrentVideo: false, // Whether HD was applied to current video
    hdLoading: false, // Whether HD is currently loading
    preferredQuality: 'auto', // User's quality preference: 'auto', '720p', '1080p', '1440p', '4K'
    pendingHDRequests: new Map(), // v4: Track in-flight HD requests for deduplication

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
    return /instagram\.com\/(reels|reel)/.test(window.location.href);
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

  function showHDProgress(isLoading) {
    // HD notification removed - bad UX per user feedback
    // The HD loading state is still tracked via GlobalState.hdLoading
    // and the quality badge in the Control Panel is updated accordingly.
    // This function is now a no-op to maintain API compatibility.
    return;
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

      // Sanitize message to prevent XSS
      const safeMessage = String(message).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      toast.innerHTML = icon ? `<span class="ir-toast-icon">${icon}</span>${safeMessage}` : safeMessage;
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

  function findActiveVideo() {
    try {
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

      if (videos.length === 0) return null;

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

      if (validVideos.length === 0) return null;

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

      return bestVideo;
    } catch (e) {
      log('Error in findActiveVideo:', e);
      return null;
    }
  }

  function getScrollContainer() {
    try {
      // Multiple selector strategies for resilience
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

          // Check if main itself scrolls or find a scrollable child
          let el = mainEl;
          for (let i = 0; i < 10 && el; i++) {
            const style = window.getComputedStyle(el);
            if ((style.overflowY === 'scroll' || style.overflowY === 'auto') &&
              el.scrollHeight > el.clientHeight) {
              log('Found scroll container:', selector);
              return el;
            }
            // Check children
            for (const child of el.children) {
              const childStyle = window.getComputedStyle(child);
              if ((childStyle.overflowY === 'scroll' || childStyle.overflowY === 'auto') &&
                child.scrollHeight > child.clientHeight) {
                log('Found scroll container in children:', selector);
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

    // Fallback to document root
    log('Using fallback scroll container: documentElement');
    return document.documentElement;
  }

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

    // Create placeholder to maintain DOM structure
    const placeholder = document.createElement('div');
    placeholder.className = 'ir-video-placeholder';
    placeholder.style.cssText = `
      width: ${video.offsetWidth}px;
      height: ${video.offsetHeight}px;
      display: block;
    `;
    video._ir_placeholder = placeholder;
    video.parentElement.insertBefore(placeholder, video);

    // Move video to overlay
    overlay.appendChild(video);
    video.classList.add('ir-overlay-video');

    // Show backdrop and overlay
    backdrop.classList.add('active');
    overlay.classList.add('active');
    document.body.classList.add('ir-overlay-active');

    GlobalState.isOverlayActive = true;

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

  function deactivateOverlay() {
    if (!GlobalState.isOverlayActive) return;

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

      // Ensure video keeps playing
      if (video.paused) {
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

    // Manage overlay state
    if (needsOverlay && !GlobalState.isOverlayActive) {
      activateOverlay();
    } else if (!needsOverlay && GlobalState.isOverlayActive) {
      deactivateOverlay();
    }

    // Calculate transforms
    const transforms = calculateTransforms(video);

    // Apply smooth CSS transitions
    const duration = CONFIG.ANIMATIONS.TRANSFORM_DURATION;
    video.style.transition = `transform ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1), 
                              width ${CONFIG.ANIMATIONS.ASPECT_DURATION}ms ease, 
                              height ${CONFIG.ANIMATIONS.ASPECT_DURATION}ms ease, 
                              opacity ${CONFIG.ANIMATIONS.FADE_DURATION}ms ease`;

    // Apply to video
    video.style.transform = transforms.transform;
    video.style.transformOrigin = 'center center';
    video.style.width = transforms.width;
    video.style.height = transforms.height;
    video.style.objectFit = transforms.objectFit;
  }

  function calculateTransforms(video) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Get actual video dimensions (for aspect ratio calculation)
    const videoW = video.videoWidth || video.offsetWidth || 360;
    const videoH = video.videoHeight || video.offsetHeight || 640;
    const videoAspect = videoW / videoH;

    const transformParts = [];
    let width = 'auto';
    let height = 'auto';
    let objectFit = 'contain';

    // Rotation check - if 90° or 270°, we need to swap effective dimensions
    const isRotated90 = GlobalState.rotation === 90 || GlobalState.rotation === 270;
    const effectiveVw = isRotated90 ? vh : vw;
    const effectiveVh = isRotated90 ? vw : vh;

    // Determine base scale based on aspect ratio mode
    let scaleX = 1;
    let scaleY = 1;
    const aspectConfig = CONFIG.ASPECT_RATIOS[GlobalState.aspectRatio];

    if (GlobalState.isOverlayActive) {
      // TARGET-BASED SCALING (resolution-independent)
      // Calculate target display size based on screen, not source resolution
      // This ensures consistent display size regardless of 720p/1080p/1440p source

      switch (aspectConfig.value) {
        case 'fit':
        case null: // 'original' in overlay = fit to screen
          {
            // Use FIXED 9:16 aspect ratio for Instagram Reels (resolution-independent)
            // This ensures consistent display size regardless of initial vs HD dimensions
            const REEL_ASPECT = 9 / 16; // 0.5625 - standard vertical video aspect ratio

            // Target: fit to 92% of screen using fixed aspect ratio
            const targetH = effectiveVh * 0.92;
            const targetW = targetH * REEL_ASPECT;

            // If target width exceeds screen width, constrain by width instead
            if (targetW > effectiveVw * 0.92) {
              const constrainedW = effectiveVw * 0.92;
              const constrainedH = constrainedW / REEL_ASPECT;
              scaleX = constrainedW / videoW;
              scaleY = constrainedH / videoH;
            } else {
              scaleX = targetW / videoW;
              scaleY = targetH / videoH;
            }
          }
          break;
        case 'fill':
          {
            // Target: fill screen completely (may crop)
            const fillByHeight = effectiveVh / videoH;
            const fillByWidth = effectiveVw / videoW;
            scaleX = scaleY = Math.max(fillByHeight, fillByWidth);
          }
          break;
        case 'stretch':
          {
            // Target: stretch to fill screen (ignores aspect ratio)
            scaleX = effectiveVw / videoW * 0.95;
            scaleY = effectiveVh / videoH * 0.95;
          }
          break;
        default:
          // Specific aspect ratio (9:16, 16:9, etc.)
          if (typeof aspectConfig.value === 'number') {
            const targetRatio = aspectConfig.value;
            let targetW, targetH;
            if (effectiveVw / effectiveVh > targetRatio) {
              targetH = effectiveVh * 0.9;
              targetW = targetH * targetRatio;
            } else {
              targetW = effectiveVw * 0.9;
              targetH = targetW / targetRatio;
            }
            scaleX = targetW / videoW;
            scaleY = targetH / videoH;
          } else {
            // Fallback: fit to 92% of screen
            const targetH = effectiveVh * 0.92;
            const targetW = targetH * videoAspect;
            scaleX = targetW / videoW;
            scaleY = targetH / videoH;
          }
      }
    }

    // Apply zoom
    scaleX *= GlobalState.zoom;
    scaleY *= GlobalState.zoom;

    // Build transform string
    // Order matters: translate (for centering) -> rotate -> scale

    // Center the video
    transformParts.push('translate(-50%, -50%)');

    // Apply pan (relative to screen coordinates)
    if (GlobalState.panX !== 0 || GlobalState.panY !== 0) {
      transformParts[0] = `translate(calc(-50% + ${GlobalState.panX}px), calc(-50% + ${GlobalState.panY}px))`;
    }

    // Apply rotation
    if (GlobalState.rotation !== 0) {
      transformParts.push(`rotate(${GlobalState.rotation}deg)`);
    }

    // Apply scale only in overlay mode
    if (GlobalState.isOverlayActive) {
      transformParts.push(`scale(${scaleX}, ${scaleY})`);
    }

    return {
      transform: transformParts.join(' '),
      width,
      height,
      objectFit
    };
  }

  // ============================================
  // VIDEO CHANGE HANDLING
  // ============================================

  function handleVideoChange(newVideo) {
    if (!newVideo) return;
    if (newVideo === GlobalState.currentVideo) return;

    const newSrc = newVideo.currentSrc || newVideo.src;
    if (newSrc === GlobalState.currentVideoSrc) return;

    log('Video changed:', newSrc?.substring(0, 50) + '...');

    // Track performance
    GlobalState.performanceMetrics.videoDetections++;
    GlobalState.performanceMetrics.lastDetectionTime = Date.now();

    // If we were in overlay mode, we need to migrate to new video
    const wasOverlayActive = GlobalState.isOverlayActive;

    if (wasOverlayActive && GlobalState.currentVideo) {
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
    GlobalState.isOverlayActive = false; // Reset overlay state

    // Apply saved audio preferences to new video
    if (GlobalState.userMuted !== null) {
      newVideo.muted = GlobalState.userMuted;
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
          newVideo.muted = GlobalState.userMuted;
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

    // If we had transforms active, reapply to new video
    if (wasOverlayActive ||
      GlobalState.rotation !== 0 ||
      GlobalState.zoom !== 1 ||
      GlobalState.aspectRatio !== 'original' ||
      GlobalState.isTheaterMode) {
      // Small delay to let video element stabilize
      setTimeout(() => {
        applyTransforms();
      }, 50);
    }

    updateControlPanel();
  }

  // ============================================
  // ACTIONS
  // ============================================

  function rotate(degrees) {
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

  function toggleMute() {
    // Re-acquire video reference in case it changed
    let video = GlobalState.currentVideo;
    if (!video) {
      video = findActiveVideo();
      if (video) {
        GlobalState.currentVideo = video;
      } else {
        log('toggleMute: No video found');
        showToast('No video found', '⚠️');
        return;
      }
    }

    const newMutedState = !video.muted;
    video.muted = newMutedState;
    GlobalState.userMuted = newMutedState; // Save preference

    log('toggleMute:', newMutedState ? 'muted' : 'unmuted');
    showToast(newMutedState ? 'Muted' : 'Unmuted', newMutedState ? '🔇' : '🔊');
    updateControlPanel();

    // Re-apply after a short delay to combat Instagram's internal handlers
    // that might reset the mute state
    setTimeout(() => {
      if (video && GlobalState.userMuted !== null && video.muted !== GlobalState.userMuted) {
        video.muted = GlobalState.userMuted;
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

    if (newVolume > 0 && video.muted) {
      video.muted = false;
      GlobalState.userMuted = false;
    }
    if (newVolume === 0) {
      GlobalState.userMuted = true;
    }
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
      const data = event.detail;
      if (data && data.url) {
        // Store in our local map too
        if (data.mediaId) {
          GlobalState.hdVideoMap.set(String(data.mediaId), {
            url: data.url,
            width: data.width,
            height: data.height,
            source: data.source
          });
        }

        log('HD video available:', data.width + 'x' + data.height, data.source);

        // Try to apply HD to current video
        if (GlobalState.hdMode && GlobalState.currentVideo) {
          setTimeout(() => applyHDToVideo(GlobalState.currentVideo), 100);
        }
      }
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

            // Preserve dimensions immediately
            enforceDimensions(video);

            // Re-apply HD with a slightly longer delay to let Instagram's change stabilize
            setTimeout(() => {
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
                  enforceDimensions(video);
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

    // Periodic HD quality check (every 1 second) - verify we're still on HD
    // Increased frequency from 2s to 1s for faster HD restoration
    video._hdQualityCheckInterval = setInterval(() => {
      if (!GlobalState.hdMode || video !== GlobalState.currentVideo) return;

      const currentSrc = video.currentSrc || video.src;
      const hdUrl = video._hdUrl;

      // If HD was applied but source has drifted, re-apply
      if (hdUrl && currentSrc && currentSrc !== hdUrl && video._hdApplied) {
        const now = Date.now();
        if (now - video._lastHDReapplyTime >= HD_REAPPLY_COOLDOWN) {
          log('Periodic check: HD source drifted, re-applying...');
          video._hdApplied = false;
          video._lastHDReapplyTime = now;
          applyHDToVideo(video);
        }
      }
    }, 1000); // Reduced from 2000ms for faster detection

    // Periodic dimension check (every 500ms)
    video._dimensionCheckInterval = setInterval(() => {
      if (video._originalDimensions && GlobalState.hdMode) {
        enforceDimensionsIfNeeded(video);
      }
    }, 500);

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

    const rect = video.getBoundingClientRect();
    const width = Math.round(rect.width || video.offsetWidth || 0);
    const height = Math.round(rect.height || video.offsetHeight || 0);

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
    const original = video._originalDimensions || captureVideoDimensions(video);
    if (!original) return;

    // Don't enforce dimensions when in overlay mode - transforms handle sizing
    if (GlobalState.isOverlayActive || GlobalState.enhancedModeActive) return;

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
    const original = video._originalDimensions || captureVideoDimensions(video);
    if (!original) return;

    // Don't enforce dimensions when in overlay mode - transforms handle sizing
    if (GlobalState.isOverlayActive || GlobalState.enhancedModeActive) return;

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
    // Strategy 1: Query the injected script's API if available (FIXED: __angel_hd not __instamutate_hd)
    if (window.__angel_hd && window.__angel_hd.getHDForUrl) {
      const hdInfo = window.__angel_hd.getHDForUrl(videoUrl);
      if (hdInfo && hdInfo.url) {
        log('Found HD via interceptor API');
        return hdInfo;
      }
    }

    // Strategy 2: Check our local map by URL key
    const urlKey = extractUrlKey(videoUrl);
    if (urlKey) {
      for (const [key, value] of GlobalState.hdVideoMap.entries()) {
        if (extractUrlKey(value.url) === urlKey || key.includes(urlKey)) {
          log('Found HD via local map');
          return value;
        }
      }
    }

    // Strategy 3: Get the latest HD video if we have any
    if (window.__angel_hd && window.__angel_hd.getLatestHD) {
      const latest = window.__angel_hd.getLatestHD();
      if (latest && latest.url) {
        // Only use latest if it was recent (within 3 seconds for faster fallback)
        if (Date.now() - latest.timestamp < 3000) {
          log('Using latest HD video');
          return latest;
        }
      }
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
      showHDProgress(true);
      updateControlPanel();
    }

    // Find HD info using multiple strategies
    const hdInfo = findHDInfo(currentSrc);

    // v4: Use adaptive retry config
    const elapsedTime = Date.now() - video._hdAttemptStartTime;

    if (!hdInfo || !hdInfo.url) {
      // Check if we should give up (smooth fallback)
      if (video._hdRetryCount >= HD_RETRY_CONFIG.maxAttempts || elapsedTime >= HD_RETRY_CONFIG.maxWaitTime) {
        log('HD not available after retries, falling back to SD gracefully');
        video._hdApplied = true; // Mark as "attempted" to prevent further retries
        GlobalState.hdLoading = false;
        GlobalState.pendingHDRequests.delete(currentSrc); // Clean up pending
        showHDProgress(false);
        GlobalState.hdAppliedToCurrentVideo = false;
        updateControlPanel();
        // No notification for fallback - silent and smooth
        return false;
      }

      // v4: Retry with adaptive exponential backoff + jitter
      video._hdRetryCount++;
      const backoffDelay = getRetryDelay(video._hdRetryCount);
      log(`No HD found, retry ${video._hdRetryCount}/${HD_RETRY_CONFIG.maxAttempts} in ${backoffDelay}ms...`);

      setTimeout(() => {
        if (!video._hdApplied && GlobalState.hdMode && video === GlobalState.currentVideo) {
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
      showHDProgress(false);
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

    // Preserve stable video dimensions to prevent SD/HD source swaps from changing frame size.
    const originalDims = captureVideoDimensions(video) || {
      width: Math.round(video.offsetWidth || 0),
      height: Math.round(video.offsetHeight || 0)
    };
    const originalWidth = originalDims.width;
    const originalHeight = originalDims.height;
    const computedStyle = window.getComputedStyle(video);
    const originalObjectFit = computedStyle.objectFit;

    log('Upgrading to HD:', hdInfo.width + 'x' + hdInfo.height);

    // Aggressively lock dimensions before source change
    video.style.width = originalWidth + 'px';
    video.style.height = originalHeight + 'px';
    video.style.minWidth = originalWidth + 'px';
    video.style.minHeight = originalHeight + 'px';
    video.style.maxWidth = originalWidth + 'px';
    video.style.maxHeight = originalHeight + 'px';
    video.style.objectFit = originalObjectFit || 'contain';

    // Replace source and store HD URL for reversion detection
    video.src = hdInfo.url;
    video._hdApplied = true;
    video._hdUrl = hdInfo.url; // Store for observer to detect if Instagram reverts

    // Restore state when loaded
    video.addEventListener('loadeddata', function onLoaded() {
      GlobalState.hdLoading = false;
      showHDProgress(false);

      video.currentTime = currentTime;
      video.muted = wasMuted;
      video.volume = volume;
      if (wasPlaying) {
        video.play().catch(() => { });
      }

      // Re-enforce dimensions after load
      enforceDimensions(video);

      video.removeEventListener('loadeddata', onLoaded);
    }, { once: true });

    GlobalState.currentVideoQuality = { width: hdInfo.width, height: hdInfo.height };
    GlobalState.hdAppliedToCurrentVideo = true;
    GlobalState.performanceMetrics.hdSuccesses++; // Track success
    GlobalState.pendingHDRequests.delete(currentSrc); // v4: Clean up pending request

    // v4: Trigger prefetch for upcoming videos
    triggerHDPrefetch();

    // ONLY show notification when ACTUALLY UPGRADING (source changed)
    showToast(`HD ${hdInfo.width}×${hdInfo.height}`, '📺');
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
  function getQualityLabel() {
    // Show loading state
    if (GlobalState.hdLoading) {
      return '⏳ Loading...';
    }

    if (!GlobalState.hdMode) {
      return 'SD';
    }

    // Try to get quality from current video metadata (most accurate)
    const video = GlobalState.currentVideo;
    if (video && video.videoHeight && video.videoHeight > 0) {
      const height = video.videoHeight;
      const width = video.videoWidth;
      if (height >= 2160) return `4K (${width}×${height})`;
      if (height >= 1440) return `1440p (${width}×${height})`;
      if (height >= 1080) return `1080p (${width}×${height})`;
      if (height >= 720) return `720p (${width}×${height})`;
      if (height >= 480) return `480p (${width}×${height})`;
      return `${height}p (${width}×${height})`;
    }

    // Fallback to stored quality info
    const q = GlobalState.currentVideoQuality;
    if (q && q.height) {
      const width = q.width || '?';
      const height = q.height;
      if (height >= 2160) return `4K (${width}×${height})`;
      if (height >= 1440) return `1440p (${width}×${height})`;
      if (height >= 1080) return `1080p (${width}×${height})`;
      if (height >= 720) return `720p (${width}×${height})`;
      if (height >= 480) return `480p (${width}×${height})`;
      return `${height}p (${width}×${height})`;
    }

    // Check if interceptor has any videos
    if (window.__angel_hd && window.__angel_hd.getStats) {
      const stats = window.__angel_hd.getStats();
      if (stats.totalVideos === 0) {
        return 'Waiting for HD...';
      }
    }

    return GlobalState.hdAppliedToCurrentVideo ? 'HD' : 'SD';
  }

  /**
   * Get simplified quality label (just the resolution)
   */
  function getSimpleQualityLabel() {
    const video = GlobalState.currentVideo;
    if (video && video.videoHeight && video.videoHeight > 0) {
      const height = video.videoHeight;
      if (height >= 2160) return '4K';
      if (height >= 1440) return '1440p';
      if (height >= 1080) return '1080p';
      if (height >= 720) return '720p';
      if (height >= 480) return '480p';
      return height + 'p';
    }

    const q = GlobalState.currentVideoQuality;
    if (q && q.height) {
      const height = q.height;
      if (height >= 2160) return '4K';
      if (height >= 1440) return '1440p';
      if (height >= 1080) return '1080p';
      if (height >= 720) return '720p';
      if (height >= 480) return '480p';
      return height + 'p';
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

    // CRITICAL: Always get fresh video reference to avoid targeting wrong reel
    // This fixes the race condition when user likes right after scrolling
    const video = findActiveVideo();

    // Update GlobalState if we found a different video (handles scroll timing issues)
    if (video && video !== GlobalState.currentVideo) {
      log('findReelActionButtons: syncing to new video');
      handleVideoChange(video);
    }
    let reelContainer = null;

    if (video) {
      // Find the reel container (article or section containing the video)
      // Be very specific to avoid picking up other reels' containers
      reelContainer = video.closest('article') ||
        video.closest('section') ||
        video.closest('[role="presentation"]') ||
        video.closest('div[style*="height: 100%"]');

      // If no container found, try parent traversal to find a reel-like container
      if (!reelContainer) {
        let parent = video.parentElement;
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
    const videoRect = video ? video.getBoundingClientRect() : null;

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
    const currentVideo = findActiveVideo();
    if (currentVideo && currentVideo !== GlobalState.currentVideo) {
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

        // Re-check HD status after interaction
        if (GlobalState.currentVideo && GlobalState.hdMode) {
          setTimeout(() => {
            const video = GlobalState.currentVideo;
            const currentSrc = video?.currentSrc || video?.src;
            const hdSrc = video?._hdUrl;
            const needsRestore = !!video && (!video._hdApplied || (hdSrc && currentSrc && currentSrc !== hdSrc));

            if (needsRestore) {
              log('Re-checking HD after like...');
              video._hdApplied = false;
              applyHDToVideo(video);
            }
          }, 200);
        }
      }, 350); // Give Instagram time to update
    }

    if (buttons.like) {
      log('Clicking like button element');
      simulateButtonClick(buttons.like);
      verifyAndShowResult();
    } else if (buttons._doubleTapFallback) {
      // Use double-tap fallback
      log('Using double-tap fallback for like');
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
          simulateButtonClick(retryButtons.like);
          verifyAndShowResult();
        } else if (retryButtons._doubleTapFallback) {
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
    const currentVideo = findActiveVideo();
    if (currentVideo && currentVideo !== GlobalState.currentVideo) {
      log('triggerSave: syncing to new video before action');
      handleVideoChange(currentVideo);
    }

    const buttons = findReelActionButtons();
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

    const scrollContainer = getScrollContainer();
    const scrollAmount = window.innerHeight;

    scrollContainer.scrollBy({
      top: direction === 'next' ? scrollAmount : -scrollAmount,
      behavior: 'smooth'
    });

    // After scroll completes, detect new video
    setTimeout(() => {
      const newVideo = findActiveVideo();
      if (newVideo && newVideo !== GlobalState.currentVideo) {
        handleVideoChange(newVideo);
      }
    }, 500);
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
          <button class="ir-btn-icon" data-action="reset" title="Reset View (Esc)">
             ${CONFIG.ICONS.RESET}
          </button>
          <button class="ir-btn-icon" data-action="minimize" title="Minimize/Maximize">
            ${CONFIG.ICONS.MINIMIZE}
          </button>
        </div>
      </div>
      
      <div class="ir-content">
        <!-- Playback Controls -->
        <div class="ir-group ir-group-flat">
          <div class="ir-row ir-playback-row">
            <button class="ir-btn ir-btn-secondary" data-action="seek-back" title="-5 seconds (←)">
              ${CONFIG.ICONS.REWIND}
            </button>
            <button class="ir-btn ir-btn-primary ir-btn-play" data-action="play-pause" title="Play/Pause (Space)">
              <span data-display="play-icon">${CONFIG.ICONS.PLAY}</span>
            </button>
            <button class="ir-btn ir-btn-secondary" data-action="seek-forward" title="+5 seconds (→)">
              ${CONFIG.ICONS.FORWARD}
            </button>
          </div>
        </div>
        
        <!-- Volume Controls -->
        <div class="ir-group">
          <div class="ir-group-header">
            <label class="ir-label">VOLUME</label>
            <kbd class="ir-badge">M</kbd>
          </div>
          <div class="ir-slider-row">
             <button class="ir-btn-ghost" data-action="mute" title="Mute/Unmute">
              <span data-display="mute-icon">${CONFIG.ICONS.VOLUME_HIGH}</span>
            </button>
            <div class="ir-slider-wrapper">
               <input type="range" class="ir-range ir-volume-range" data-action="volume-range" min="0" max="100" value="100">
            </div>
            <span class="ir-range-value" data-display="volume-val">100</span>
          </div>
        </div>
        
        <!-- Playback Speed Controls -->
        <div class="ir-group">
          <div class="ir-group-header">
            <label class="ir-label">SPEED</label>
            <kbd class="ir-badge">[ / ]</kbd>
          </div>
          <div class="ir-slider-row">
            <span class="ir-label-small">SPEED</span>
            <div class="ir-slider-wrapper">
               <input type="range" class="ir-range ir-speed-range" data-action="speed-range" min="25" max="200" value="100" step="25">
            </div>
            <span class="ir-range-value" data-display="speed-val">1.0x</span>
          </div>
        </div>
        
        <!-- View Controls (HD, Rotate, Zoom) -->
        <div class="ir-group">
          <div class="ir-group-header">
            <label class="ir-label">VIEW</label>
          </div>
          
          <div class="ir-row">
            <!-- HD Toggle -->
             <button class="ir-btn ir-btn-secondary" data-action="toggle-hd" title="Toggle HD Mode">
              <span data-display="hd-icon">${CONFIG.ICONS.HD}</span>
              <kbd class="ir-key-badge">H</kbd>
            </button>
            
            <!-- Quality Indicator -->
            <div class="ir-quality-badge" data-display="quality-badge" title="Current Video Quality">SD</div>
            
            <!-- Rotate Group -->
            <div class="ir-control-group">
              <button class="ir-btn ir-btn-secondary" data-action="rotate-ccw" title="Rotate Left">
                ${CONFIG.ICONS.ROTATE_CCW}
                <kbd class="ir-key-badge">L</kbd>
              </button>
               <button class="ir-btn ir-btn-secondary" data-action="rotate-cw" title="Rotate Right">
                ${CONFIG.ICONS.ROTATE_CW}
                <kbd class="ir-key-badge">R</kbd>
              </button>
               <div class="ir-badge-box" data-display="rotation">0°</div>
            </div>
          </div>
          
          <!-- Zoom Slider -->
          <div class="ir-slider-row" style="margin-top: 8px;">
            <span class="ir-label-small">ZOOM</span>
            <div class="ir-slider-wrapper">
               <input type="range" class="ir-range" data-action="zoom-range" min="50" max="300" value="100">
            </div>
            <span class="ir-range-value" data-display="zoom">100%</span>
          </div>
        </div>
        
        <!-- Aspect Ratio -->
        <div class="ir-group">
          <div class="ir-group-header">
            <label class="ir-label">ASPECT RATIO</label>
            <kbd class="ir-badge">A</kbd>
          </div>
          <div class="ir-aspect-grid">
            ${Object.entries(CONFIG.ASPECT_RATIOS).filter(([_, c]) => c.type === 'geometry').map(([key, config]) =>
      `<button class="ir-aspect-pill" data-action="aspect" data-ratio="${key}" title="${config.label}">${config.label}</button>`
    ).join('')}
          </div>
           <div class="ir-aspect-grid" style="margin-top: 6px;">
            ${Object.entries(CONFIG.ASPECT_RATIOS).filter(([_, c]) => c.type === 'mode').map(([key, config]) =>
      `<button class="ir-aspect-pill" data-action="aspect" data-ratio="${key}" title="${config.label}">${config.label}</button>`
    ).join('')}
          </div>
        </div>
        
        <!-- Modes & Actions -->
        <div class="ir-group">
          <div class="ir-row gap-small">
            <button class="ir-btn ir-btn-mode" data-action="theater" title="Theater Mode">
              ${CONFIG.ICONS.THEATER}
              <kbd class="ir-key-badge">T</kbd>
            </button>
            <button class="ir-btn ir-btn-mode" data-action="fullscreen" title="Fullscreen">
               ${CONFIG.ICONS.FULLSCREEN}
               <kbd class="ir-key-badge">F</kbd>
            </button>
          </div>
        </div>
        
    <!-- Social Actions -->
        <div class="ir-group">
          <div class="ir-group-header">
            <label class="ir-label">ACTIONS</label>
          </div>
          <div class="ir-social-grid">
            <button class="ir-btn ir-btn-social ir-btn-like" data-action="like" title="Like">
              <span data-display="like-icon">${CONFIG.ICONS.LIKE}</span>
              <kbd class="ir-key-badge">X</kbd>
            </button>
            <button class="ir-btn ir-btn-social ir-btn-save" data-action="save" title="Save">
              <span data-display="save-icon">${CONFIG.ICONS.SAVE}</span>
              <kbd class="ir-key-badge">S</kbd>
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

    // Make draggable
    makeDraggable(panel, panel.querySelector('.ir-handle'));

    // Auto-hide behavior
    setupAutoHide(panel);

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
        document.getElementById(CONFIG.SELECTORS.CONTROL_PANEL)?.classList.toggle('minimized');
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
    panel.querySelectorAll('.ir-aspect').forEach(btn => {
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
    }

    // Social button states
    const likeIcon = panel.querySelector('[data-display="like-icon"]');
    const saveIcon = panel.querySelector('[data-display="save-icon"]');
    const likeBtn = panel.querySelector('.ir-btn-like');
    const saveBtn = panel.querySelector('.ir-btn-save');

    if (likeIcon && likeBtn) {
      const userLiked = isLiked();
      likeIcon.innerHTML = userLiked ? CONFIG.ICONS.LIKE_ACTIVE : CONFIG.ICONS.LIKE;
      likeBtn.classList.toggle('active', userLiked);
    }
    if (saveIcon && saveBtn) {
      const userSaved = isSaved();
      saveIcon.innerHTML = userSaved ? CONFIG.ICONS.SAVE_ACTIVE : CONFIG.ICONS.SAVE;
      saveBtn.classList.toggle('active', userSaved);
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

  function setupAutoHide(panel) {
    const HIDE_DELAY = CONFIG.UI_HIDE_DELAY || 3000;

    // Create floating reveal button
    let revealBtn = document.getElementById('angel-reveal-btn');
    if (!revealBtn) {
      revealBtn = document.createElement('button');
      revealBtn.id = 'angel-reveal-btn';
      revealBtn.className = 'angel-reveal-btn';
      revealBtn.innerHTML = '✦';
      revealBtn.title = 'Show ANGEL Panel';
      document.body.appendChild(revealBtn);
    }

    // Store the timer on the element itself to avoid conflicts
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
      panel.classList.add('auto-hide');
      revealBtn.classList.add('visible');
    };

    const startHideTimer = () => {
      clearHideTimer();

      // If panel is minimized or interacting, don't hide
      if (panel.classList.contains('minimized') ||
        document.getElementById('angel-shortcuts-list')?.style.display === 'grid' ||
        panel.matches(':hover')) {
        return;
      }

      panel._hideTimer = setTimeout(() => {
        hidePanel();
      }, HIDE_DELAY);
    };

    // Click reveal button to show panel
    revealBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showPanel();
      startHideTimer(); // Start timer again after revealing
    });

    // Event listeners for panel
    panel.addEventListener('mouseenter', () => {
      showPanel();
    });

    panel.addEventListener('mouseleave', startHideTimer);

    // Initial start
    startHideTimer();
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
    if ((key === 'arrowup' || key === 'arrowdown') && GlobalState.isOverlayActive) {
      e.preventDefault();
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
      case 'm':
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
      default:
        handled = false;
    }

    if (handled) {
      e.preventDefault();
      e.stopPropagation();
      // Control panel stays hidden - keyboard shortcuts should be discrete
    }
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
    if (GlobalState.isOverlayActive) {
      e.preventDefault();

      // Debounce navigation
      if (GlobalState.scrollNavTimeout) return;

      GlobalState.scrollNavTimeout = setTimeout(() => {
        GlobalState.scrollNavTimeout = null;
      }, CONFIG.SCROLL_NAV_DEBOUNCE);

      navigateReel(e.deltaY > 0 ? 'next' : 'prev');
    }
  }

  // ============================================
  // OBSERVERS
  // ============================================

  function setupObservers() {
    // Debounced video detection
    const detectVideo = debounce(() => {
      const video = findActiveVideo();
      if (video) {
        handleVideoChange(video);
      }
      updatePanelVisibility();
    }, CONFIG.VIDEO_DETECT_DEBOUNCE);

    // Optimized Mutation observer with specific filters to reduce overhead
    try {
      GlobalState.mutationObserver = new MutationObserver((mutations) => {
        // Filter mutations to only video-relevant changes
        const hasRelevantChange = mutations.some(mutation => {
          // Check if mutation affects video elements
          if (mutation.type === 'childList') {
            const hasVideo = Array.from(mutation.addedNodes).some(node =>
              node.nodeName === 'VIDEO' || (node.querySelector && node.querySelector('video'))
            );
            if (hasVideo) return true;
          }
          // Check for src attribute changes on video elements
          if (mutation.type === 'attributes' && mutation.target.nodeName === 'VIDEO') {
            return mutation.attributeName === 'src';
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
        attributeFilter: ['src', 'style'], // Only watch these attributes
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

    // Intercept history API
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      detectVideo();
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      detectVideo();
    };

    // Window resize
    try {
      GlobalState.resizeObserver = new ResizeObserver(() => {
        if (GlobalState.isOverlayActive) {
          applyTransforms();
        } else if (GlobalState.currentVideo) {
          // Refresh baseline size after viewport/layout changes.
          captureVideoDimensions(GlobalState.currentVideo, true);
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

  window.__instamutate_cleanup = cleanup;

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
