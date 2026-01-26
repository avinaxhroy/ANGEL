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

  // Prevent double initialization
  if (window.__ANGEL_INITIALIZED__) {
    console.log('[ANGEL] Already initialized, skipping...');
    return;
  }
  window.__ANGEL_INITIALIZED__ = true;

  // ============================================
  // CONFIGURATION
  // ============================================
  const CONFIG = {
    VERSION: '3.0.0',

    ASPECT_RATIOS: {
      'original': { label: 'Original', icon: '○', value: null },
      '9:16': { label: '9:16', icon: '▯', value: 9 / 16 },
      '16:9': { label: '16:9', icon: '▭', value: 16 / 9 },
      '4:3': { label: '4:3', icon: '□', value: 4 / 3 },
      '1:1': { label: '1:1', icon: '■', value: 1 },
      'fit': { label: 'Fit', icon: '⊡', value: 'fit' },
      'fill': { label: 'Fill', icon: '⧈', value: 'fill' },
      'stretch': { label: 'Stretch', icon: '↔', value: 'stretch' }
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
      HD_TOGGLE: 'h'
    },

    ZOOM: {
      MIN: 0.5,
      MAX: 3.0,
      STEP: 0.1
    },

    UI_HIDE_DELAY: 3000,
    SCROLL_NAV_DEBOUNCE: 400,
    VIDEO_DETECT_DEBOUNCE: 100,

    SELECTORS: {
      CONTROL_PANEL: 'angel-ctrl',
      TOAST: 'angel-toast',
      OVERLAY: 'angel-overlay',
      BACKDROP: 'angel-backdrop'
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

    // HD Video settings
    hdMode: true, // HD mode enabled by default
    hdVideoMap: new Map(), // Maps video URL keys to HD URLs
    currentVideoQuality: null, // { width, height } of current video
    hdAppliedToCurrentVideo: false, // Whether HD was applied to current video

    // Computed
    aspectKeys: Object.keys(CONFIG.ASPECT_RATIOS),

    // Reset transforms only (preserves audio preferences)
    reset() {
      this.rotation = 0;
      this.zoom = 1;
      this.aspectRatio = 'original';
      this.panX = 0;
      this.panY = 0;
      this.isOverlayActive = false;
      this.isTheaterMode = false;
      this.enhancedModeActive = false; // Exit enhanced mode on reset
      // Note: userMuted and userVolume intentionally NOT reset
    },

    // Full reset including audio
    fullReset() {
      this.reset();
      this.userMuted = null;
      this.userVolume = null;
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

  function isReelsPage() {
    return /instagram\.com\/(reels|reel)/.test(window.location.href);
  }

  function log(...args) {
    console.log('[ANGEL]', ...args);
  }

  // ============================================
  // TOAST NOTIFICATIONS
  // ============================================

  function showToast(message, icon = '') {
    let toast = document.getElementById(CONFIG.SELECTORS.TOAST);

    if (!toast) {
      toast = document.createElement('div');
      toast.id = CONFIG.SELECTORS.TOAST;
      document.body.appendChild(toast);
    }

    toast.innerHTML = icon ? `<span class="ir-toast-icon">${icon}</span>${message}` : message;
    toast.classList.add('visible');

    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove('visible'), 1500);
  }

  // ============================================
  // VIDEO DETECTION
  // ============================================

  function findActiveVideo() {
    const videos = Array.from(document.querySelectorAll('video'));

    // Filter to only visible videos with reasonable size
    const validVideos = videos.filter(v => {
      if (!v.offsetParent && !v.classList.contains('ir-overlay-video')) return false;
      const rect = v.getBoundingClientRect();
      return rect.width > 100 && rect.height > 100;
    });

    if (validVideos.length === 0) return null;

    // Find the video closest to viewport center
    const viewportCenterY = window.innerHeight / 2;
    let bestVideo = null;
    let bestScore = -Infinity;

    for (const video of validVideos) {
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
    }

    return bestVideo;
  }

  function getScrollContainer() {
    // Find Instagram's main scroll container
    const mainEl = document.querySelector('main[role="main"]');
    if (mainEl) {
      // Check if main itself scrolls or find a scrollable child
      let el = mainEl;
      for (let i = 0; i < 10 && el; i++) {
        const style = window.getComputedStyle(el);
        if ((style.overflowY === 'scroll' || style.overflowY === 'auto') &&
          el.scrollHeight > el.clientHeight) {
          return el;
        }
        // Check children
        for (const child of el.children) {
          const childStyle = window.getComputedStyle(child);
          if ((childStyle.overflowY === 'scroll' || childStyle.overflowY === 'auto') &&
            child.scrollHeight > child.clientHeight) {
            return child;
          }
        }
        el = el.parentElement;
      }
    }
    return document.documentElement;
  }

  // ============================================
  // OVERLAY MANAGEMENT
  // ============================================

  function createBackdrop() {
    if (GlobalState.backdrop) return GlobalState.backdrop;

    const backdrop = document.createElement('div');
    backdrop.id = CONFIG.SELECTORS.BACKDROP;
    backdrop.className = 'ir-backdrop';
    backdrop.onclick = (e) => {
      if (e.target === backdrop) {
        resetAll();
      }
    };

    document.body.appendChild(backdrop);
    GlobalState.backdrop = backdrop;
    return backdrop;
  }

  function createOverlay() {
    if (GlobalState.overlay) return GlobalState.overlay;

    const overlay = document.createElement('div');
    overlay.id = CONFIG.SELECTORS.OVERLAY;
    overlay.className = 'ir-overlay';

    document.body.appendChild(overlay);
    GlobalState.overlay = overlay;
    return overlay;
  }

  function activateOverlay() {
    if (GlobalState.isOverlayActive) return;

    const video = GlobalState.currentVideo;
    if (!video) return;

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

    // Ensure video keeps playing
    if (video.paused) {
      video.play().catch(() => { });
    }

    // Show exit hint
    showExitHint();
  }

  function deactivateOverlay() {
    if (!GlobalState.isOverlayActive) return;

    const video = GlobalState.currentVideo;
    log('Deactivating overlay mode');

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
    const video = GlobalState.currentVideo;
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
    const videoW = video.videoWidth || video.offsetWidth || 360;
    const videoH = video.videoHeight || video.offsetHeight || 640;

    const transformParts = [];
    let width = 'auto';
    let height = 'auto';
    let objectFit = 'contain';

    // Rotation check - if 90° or 270°, we need to swap effective dimensions
    const isRotated90 = GlobalState.rotation === 90 || GlobalState.rotation === 270;
    const effectiveVw = isRotated90 ? vh : vw;
    const effectiveVh = isRotated90 ? vw : vh;

    // Calculate scale factors
    const fitScale = Math.min(effectiveVw / videoW, effectiveVh / videoH);
    const fillScale = Math.max(effectiveVw / videoW, effectiveVh / videoH);

    // Determine base scale based on aspect ratio mode
    let scaleX = 1;
    let scaleY = 1;
    const aspectConfig = CONFIG.ASPECT_RATIOS[GlobalState.aspectRatio];

    if (GlobalState.isOverlayActive) {
      // In overlay mode, we need to size the video to fit/fill screen
      switch (aspectConfig.value) {
        case 'fit':
        case null: // 'original' in overlay = fit
          scaleX = scaleY = fitScale * 0.92; // Leave some margin
          break;
        case 'fill':
          scaleX = scaleY = fillScale;
          break;
        case 'stretch':
          scaleX = effectiveVw / videoW * 0.95;
          scaleY = effectiveVh / videoH * 0.95;
          break;
        default:
          // Specific aspect ratio - fit within that ratio
          if (typeof aspectConfig.value === 'number') {
            const targetRatio = aspectConfig.value;
            // Calculate dimensions that fit target ratio within screen
            let targetW, targetH;
            if (effectiveVw / effectiveVh > targetRatio) {
              // Screen is wider than target ratio
              targetH = effectiveVh * 0.9;
              targetW = targetH * targetRatio;
            } else {
              // Screen is taller than target ratio
              targetW = effectiveVw * 0.9;
              targetH = targetW / targetRatio;
            }
            scaleX = targetW / videoW;
            scaleY = targetH / videoH;
          } else {
            scaleX = scaleY = fitScale * 0.92;
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

      // Clean up references
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

    // Setup observer to detect when Instagram changes the video source back
    setupVideoSourceObserver(newVideo);

    if (GlobalState.hdMode) {
      // Delay to allow video to load and HD data to be received
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
    GlobalState.isTheaterMode = !GlobalState.isTheaterMode;
    applyTransforms();
    showToast(GlobalState.isTheaterMode ? 'Theater Mode' : 'Normal Mode', '🎬');
    updateControlPanel();
  }

  async function toggleFullscreen() {
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
  }

  // ============================================
  // AUDIO & PLAYBACK CONTROLS
  // ============================================

  function toggleMute() {
    const video = GlobalState.currentVideo;
    if (!video) return;

    video.muted = !video.muted;
    GlobalState.userMuted = video.muted; // Save preference
    showToast(video.muted ? 'Muted' : 'Unmuted', video.muted ? '🔇' : '🔊');
    updateControlPanel();
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

    // Store original dimensions for dimension preservation
    video._originalDimensions = {
      width: video.offsetWidth,
      height: video.offsetHeight
    };

    // Create a MutationObserver to watch for src attribute changes
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
          const newSrc = video.src || video.currentSrc;
          const hdUrl = video._hdUrl;

          // If we have an HD URL stored and the src changed to something different
          if (hdUrl && newSrc && newSrc !== hdUrl && GlobalState.hdMode) {
            log('Instagram reverted video source, re-applying HD...');

            // Reset HD flag and re-apply
            video._hdApplied = false;

            // Small delay to let Instagram's change complete
            setTimeout(() => {
              applyHDToVideo(video);
            }, 50);
          }
        }
      }
    });

    observer.observe(video, {
      attributes: true,
      attributeFilter: ['src']
    });

    video._srcObserver = observer;

    // Also listen for loadeddata events to re-check dimensions
    video.addEventListener('loadeddata', () => {
      if (video._originalDimensions && GlobalState.hdMode) {
        // Re-apply dimension lock if needed
        const current = { width: video.offsetWidth, height: video.offsetHeight };
        const original = video._originalDimensions;

        if (current.width !== original.width || current.height !== original.height) {
          video.style.width = original.width + 'px';
          video.style.height = original.height + 'px';
          video.style.minWidth = original.width + 'px';
          video.style.minHeight = original.height + 'px';
        }
      }
    });
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
   * Find HD info for a video - tries multiple strategies
   */
  function findHDInfo(videoUrl) {
    // Strategy 1: Query the injected script's API if available
    if (window.__instamutate_hd && window.__instamutate_hd.getHDForUrl) {
      const hdInfo = window.__instamutate_hd.getHDForUrl(videoUrl);
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
    if (window.__instamutate_hd && window.__instamutate_hd.getLatestHD) {
      const latest = window.__instamutate_hd.getLatestHD();
      if (latest && latest.url) {
        // Only use latest if it was recent (within 5 seconds)
        if (Date.now() - latest.timestamp < 5000) {
          log('Using latest HD video');
          return latest;
        }
      }
    }

    return null;
  }

  /**
   * Attempt to apply HD source to a video element
   */
  function applyHDToVideo(video) {
    if (!video || !GlobalState.hdMode) return false;

    const currentSrc = video.currentSrc || video.src;
    if (!currentSrc) return false;

    // Don't re-apply if already applied
    if (video._hdApplied) return false;

    // Find HD info using multiple strategies
    const hdInfo = findHDInfo(currentSrc);

    if (!hdInfo || !hdInfo.url) {
      log('No HD found for video, retrying in 500ms...');
      // Retry later - HD data might not have arrived yet
      setTimeout(() => {
        if (!video._hdApplied && GlobalState.hdMode) {
          applyHDToVideo(video);
        }
      }, 500);
      return false;
    }

    // Check if we're already at HD quality
    if (currentSrc === hdInfo.url) {
      video._hdApplied = true;
      GlobalState.currentVideoQuality = { width: hdInfo.width, height: hdInfo.height };
      GlobalState.hdAppliedToCurrentVideo = true;
      updateControlPanel();
      return true;
    }

    // Store current playback state
    const wasPlaying = !video.paused;
    const currentTime = video.currentTime;
    const wasMuted = video.muted;
    const volume = video.volume;

    // Preserve original video dimensions to prevent layout shift
    const originalWidth = video.offsetWidth;
    const originalHeight = video.offsetHeight;
    const computedStyle = window.getComputedStyle(video);
    const originalObjectFit = computedStyle.objectFit;

    log('Upgrading to HD:', hdInfo.width + 'x' + hdInfo.height);

    // Lock dimensions before source change
    video.style.width = originalWidth + 'px';
    video.style.height = originalHeight + 'px';
    video.style.minWidth = originalWidth + 'px';
    video.style.minHeight = originalHeight + 'px';
    video.style.objectFit = originalObjectFit || 'contain';

    // Replace source and store HD URL for reversion detection
    video.src = hdInfo.url;
    video._hdApplied = true;
    video._hdUrl = hdInfo.url; // Store for observer to detect if Instagram reverts

    // Restore state when loaded
    video.addEventListener('loadeddata', function onLoaded() {
      video.currentTime = currentTime;
      video.muted = wasMuted;
      video.volume = volume;
      if (wasPlaying) {
        video.play().catch(() => { });
      }

      // Keep dimensions locked to prevent any further resizing
      // Instagram handles its own responsive sizing, so we maintain what we set
      video.removeEventListener('loadeddata', onLoaded);
    }, { once: true });

    GlobalState.currentVideoQuality = { width: hdInfo.width, height: hdInfo.height };
    GlobalState.hdAppliedToCurrentVideo = true;
    showToast(`HD ${hdInfo.width}×${hdInfo.height}`, '📺');
    updateControlPanel();

    return true;
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
    if (!GlobalState.hdMode) {
      return 'Auto';
    }

    // Try to get quality from current video metadata
    const video = GlobalState.currentVideo;
    if (video && video.videoHeight) {
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
      if (q.height >= 2160) return '4K';
      if (q.height >= 1440) return '1440p';
      if (q.height >= 1080) return '1080p';
      if (q.height >= 720) return '720p';
      if (q.height >= 480) return '480p';
      return q.height + 'p';
    }

    // Check if interceptor has any videos
    if (window.__instamutate_hd && window.__instamutate_hd.getStats) {
      const stats = window.__instamutate_hd.getStats();
      if (stats.totalVideos === 0) {
        return 'Waiting...';
      }
    }

    return GlobalState.hdAppliedToCurrentVideo ? 'HD' : 'Loading...';
  }

  // ============================================
  // INSTAGRAM INTERACTION (Like, Share, Comment)
  // ============================================

  function findReelActionButtons() {
    // Instagram's reel action buttons are in the main page, not in our overlay
    // So we need to search the original page content, not from video.parentElement

    // Try multiple selectors - Instagram changes these frequently
    const selectors = {
      // Like button - usually has aria-label containing "Like" or a heart SVG
      like: [
        'svg[aria-label="Like"]',
        'svg[aria-label="Unlike"]',
        '[aria-label="Like"]',
        '[aria-label="Unlike"]',
        'section svg[aria-label*="ike"]',
        'main svg[aria-label*="ike"]'
      ],
      // Comment button
      comment: [
        'svg[aria-label="Comment"]',
        '[aria-label="Comment"]',
        'main svg[aria-label*="omment"]'
      ],
      // Share button  
      share: [
        'svg[aria-label="Share"]',
        'svg[aria-label="Share Post"]',
        'svg[aria-label="Send"]',
        '[aria-label="Share"]',
        'main svg[aria-label*="hare"]'
      ],
      // Save button
      save: [
        'svg[aria-label="Save"]',
        'svg[aria-label="Remove"]',
        '[aria-label="Save"]',
        'main svg[aria-label*="ave"]'
      ]
    };

    const buttons = {};

    // Search in Instagram's main content area (not our overlay)
    const searchAreas = [
      document.querySelector('main[role="main"]'),
      document.querySelector('section'),
      document.body
    ].filter(Boolean);

    for (const searchArea of searchAreas) {
      for (const [action, selectorList] of Object.entries(selectors)) {
        if (buttons[action]) continue;

        for (const selector of selectorList) {
          const el = searchArea.querySelector(selector);
          if (el) {
            // Find the clickable parent (button or div with role=button)
            let clickable = el;
            for (let j = 0; j < 5 && clickable; j++) {
              if (clickable.tagName === 'BUTTON' ||
                clickable.getAttribute('role') === 'button' ||
                clickable.onclick ||
                clickable.hasAttribute('tabindex')) {
                buttons[action] = clickable;
                break;
              }
              clickable = clickable.parentElement;
            }
            if (!buttons[action]) {
              buttons[action] = el.closest('button') || el.closest('[role="button"]') || el;
            }
            break;
          }
        }
      }
    }

    // Log what we found for debugging
    if (Object.keys(buttons).length > 0) {
      log('Found buttons:', Object.keys(buttons));
    }

    return buttons;
  }

  function triggerLike() {
    const buttons = findReelActionButtons();
    if (buttons.like) {
      log('Clicking like button');
      buttons.like.click();

      // Check if it's now "liked" based on aria-label
      setTimeout(() => {
        const svg = buttons.like.querySelector('svg') || buttons.like;
        const label = svg.getAttribute('aria-label') || '';
        const isLiked = label.toLowerCase().includes('unlike');
        showToast(isLiked ? 'Liked!' : 'Unliked', isLiked ? '❤️' : '🤍');
        updateControlPanel();
      }, 100);
    } else {
      showToast('Like button not found', '⚠️');
      log('Could not find like button');
    }
  }

  function triggerShare() {
    const buttons = findReelActionButtons();
    if (buttons.share) {
      log('Clicking share button');
      buttons.share.click();
      showToast('Share menu opened', '📤');
    } else {
      // Try to copy the current URL as fallback
      const url = window.location.href;
      navigator.clipboard.writeText(url).then(() => {
        showToast('Link copied!', '📋');
      }).catch(() => {
        showToast('Share button not found', '⚠️');
      });
    }
  }

  function triggerComment() {
    const buttons = findReelActionButtons();
    if (buttons.comment) {
      log('Clicking comment button');
      buttons.comment.click();
      showToast('Comments', '💬');
    } else {
      showToast('Comment button not found', '⚠️');
    }
  }

  function triggerSave() {
    const buttons = findReelActionButtons();
    if (buttons.save) {
      log('Clicking save button');
      buttons.save.click();

      setTimeout(() => {
        const svg = buttons.save.querySelector('svg') || buttons.save;
        const label = svg.getAttribute('aria-label') || '';
        const isSaved = label.toLowerCase().includes('remove');
        showToast(isSaved ? 'Saved!' : 'Unsaved', isSaved ? '🔖' : '📑');
        updateControlPanel();
      }, 100);
    } else {
      showToast('Save button not found', '⚠️');
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
          <span class="ir-logo">⟳</span>
          <span class="ir-name">ANGEL</span>
        </div>
        <div class="ir-handle-btns">
          <button class="ir-btn-mini" data-action="minimize" title="Minimize">▾</button>
        </div>
      </div>
      
      <div class="ir-content">
        <!-- Playback Controls -->
        <div class="ir-group ir-playback-group">
          <div class="ir-row ir-playback-row">
            <button class="ir-btn ir-btn-action" data-action="seek-back" title="-5 seconds">⏪</button>
            <button class="ir-btn ir-btn-action ir-btn-play" data-action="play-pause" title="Play/Pause">
              <span data-display="play-icon">▶</span>
            </button>
            <button class="ir-btn ir-btn-action" data-action="seek-forward" title="+5 seconds">⏩</button>
          </div>
        </div>
        
        <!-- Volume Controls -->
        <div class="ir-group">
          <label>Volume <kbd>M</kbd></label>
          <div class="ir-row">
            <button class="ir-btn ir-btn-action" data-action="mute" title="Mute/Unmute">
              <span data-display="mute-icon">🔊</span>
            </button>
            <input type="range" class="ir-range ir-volume-range" data-action="volume-range" min="0" max="100" value="100">
          </div>
        </div>
        
        <!-- HD Quality Controls -->
        <div class="ir-group">
          <label>Quality <kbd>H</kbd></label>
          <div class="ir-row">
            <button class="ir-btn ir-btn-action ir-hd-toggle" data-action="toggle-hd" title="Toggle HD Mode">
              <span data-display="hd-icon">📺</span>
            </button>
            <div class="ir-indicator ir-quality-indicator" data-display="quality">Auto</div>
          </div>
        </div>
        
        <!-- Rotation Controls -->
        <div class="ir-group">
          <label>Rotation <kbd>R</kbd> <kbd>L</kbd></label>
          <div class="ir-row">
            <button class="ir-btn ir-btn-action" data-action="rotate-ccw" title="Rotate Left (L)">↶</button>
            <div class="ir-indicator" data-display="rotation">0°</div>
            <button class="ir-btn ir-btn-action" data-action="rotate-cw" title="Rotate Right (R)">↷</button>
          </div>
        </div>
        
        <!-- Aspect Ratio -->
        <div class="ir-group">
          <label>Aspect Ratio <kbd>A</kbd></label>
          <div class="ir-aspect-row">
            ${Object.entries(CONFIG.ASPECT_RATIOS).map(([key, config]) =>
      `<button class="ir-aspect" data-action="aspect" data-ratio="${key}" title="${config.label}">${config.icon}</button>`
    ).join('')}
          </div>
        </div>
        
        <!-- Zoom Controls -->
        <div class="ir-group">
          <label>Zoom <kbd>+</kbd> <kbd>-</kbd></label>
          <div class="ir-row">
            <button class="ir-btn ir-btn-action ir-btn-sm" data-action="zoom-out">−</button>
            <input type="range" class="ir-range" data-action="zoom-range" min="50" max="300" value="100">
            <button class="ir-btn ir-btn-action ir-btn-sm" data-action="zoom-in">+</button>
          </div>
          <div class="ir-zoom-label" data-display="zoom">100%</div>
        </div>
        
        <!-- Mode Buttons -->
        <div class="ir-group ir-modes-group">
          <button class="ir-mode" data-action="theater">
            <span class="ir-mode-icon">🎬</span>
            <span class="ir-mode-label">Theater</span>
            <kbd>T</kbd>
          </button>
          <button class="ir-mode" data-action="fullscreen">
            <span class="ir-mode-icon">⛶</span>
            <span class="ir-mode-label">Fullscreen</span>
            <kbd>F</kbd>
          </button>
        </div>
        
        <!-- Social Actions -->
        <div class="ir-group">
          <label>Actions</label>
          <div class="ir-row ir-social-row">
            <button class="ir-btn ir-btn-social ir-btn-like" data-action="like" title="Like (${navigator.platform.includes('Mac') ? '⌘' : '⊞ Win'})">
              <span data-display="like-icon">🤍</span>
              <kbd class="ir-like-kbd">${navigator.platform.includes('Mac') ? '⌘' : '⊞'}</kbd>
            </button>
            <button class="ir-btn ir-btn-social" data-action="comment" title="Comment">
              💬
            </button>
            <button class="ir-btn ir-btn-social" data-action="share" title="Share">
              📤
            </button>
            <button class="ir-btn ir-btn-social ir-btn-save" data-action="save" title="Save">
              <span data-display="save-icon">🔖</span>
            </button>
          </div>
        </div>
        
        <button class="ir-reset" data-action="reset">↺ Reset</button>
      </div>
      
      <div class="ir-collapsed-hint">
        <span>R L T F A M</span>
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
      case 'share':
        triggerShare();
        break;
      case 'comment':
        triggerComment();
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

    // Mode buttons
    panel.querySelector('[data-action="theater"]')?.classList.toggle('active', GlobalState.isTheaterMode);
    panel.querySelector('[data-action="fullscreen"]')?.classList.toggle('active', GlobalState.isFullscreen);

    // Audio controls
    const video = GlobalState.currentVideo;
    if (video) {
      // Volume slider
      const volumeRange = panel.querySelector('[data-action="volume-range"]');
      if (volumeRange) {
        volumeRange.value = video.muted ? 0 : video.volume * 100;
      }

      // Mute icon
      const muteIcon = panel.querySelector('[data-display="mute-icon"]');
      if (muteIcon) {
        if (video.muted || video.volume === 0) {
          muteIcon.textContent = '🔇';
        } else if (video.volume < 0.5) {
          muteIcon.textContent = '🔉';
        } else {
          muteIcon.textContent = '🔊';
        }
      }

      // Play/pause icon
      const playIcon = panel.querySelector('[data-display="play-icon"]');
      if (playIcon) {
        playIcon.textContent = video.paused ? '▶' : '⏸';
      }
    }

    // Social button states (check Instagram's button state)
    // These are expensive so we do them less frequently
    const likeIcon = panel.querySelector('[data-display="like-icon"]');
    const saveIcon = panel.querySelector('[data-display="save-icon"]');

    if (likeIcon) {
      likeIcon.textContent = isLiked() ? '❤️' : '🤍';
    }
    if (saveIcon) {
      saveIcon.textContent = isSaved() ? '✅' : '🔖';
    }

    // HD Quality controls
    const hdToggle = panel.querySelector('[data-action="toggle-hd"]');
    const hdIcon = panel.querySelector('[data-display="hd-icon"]');
    const qualityIndicator = panel.querySelector('[data-display="quality"]');

    if (hdToggle) {
      hdToggle.classList.toggle('active', GlobalState.hdMode);
    }
    if (hdIcon) {
      hdIcon.textContent = GlobalState.hdMode ? '📺' : '📱';
    }
    if (qualityIndicator) {
      qualityIndicator.textContent = getQualityLabel();
      qualityIndicator.classList.toggle('ir-hd-active', GlobalState.hdAppliedToCurrentVideo);
    }
  }

  function updatePanelVisibility() {
    const panel = document.getElementById(CONFIG.SELECTORS.CONTROL_PANEL);
    const shouldShow = isReelsPage() && findActiveVideo();

    if (shouldShow && !panel) {
      createControlPanel();
    } else if (panel) {
      panel.style.display = shouldShow ? '' : 'none';
    }
  }

  function setupAutoHide(panel) {
    const resetTimer = () => {
      clearTimeout(GlobalState.hideTimer);
      panel.classList.remove('auto-hide');
      GlobalState.hideTimer = setTimeout(() => {
        if (!panel.matches(':hover')) {
          panel.classList.add('auto-hide');
        }
      }, CONFIG.UI_HIDE_DELAY);
    };

    panel.addEventListener('mouseenter', () => {
      clearTimeout(GlobalState.hideTimer);
      panel.classList.remove('auto-hide');
    });
    panel.addEventListener('mouseleave', resetTimer);

    resetTimer();
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

    // Command/Meta key for like (⌘ on Mac, Windows key on Windows)
    if (key === 'meta') {
      e.preventDefault();
      e.stopPropagation();
      triggerLike();
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
      default:
        handled = false;
    }

    if (handled) {
      e.preventDefault();
      e.stopPropagation();

      // Show controls briefly
      const panel = document.getElementById(CONFIG.SELECTORS.CONTROL_PANEL);
      if (panel) {
        panel.classList.remove('auto-hide');
        clearTimeout(GlobalState.hideTimer);
        GlobalState.hideTimer = setTimeout(() => panel.classList.add('auto-hide'), CONFIG.UI_HIDE_DELAY);
      }
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

    // Mutation observer for DOM changes
    GlobalState.mutationObserver = new MutationObserver(detectVideo);
    GlobalState.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

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
    GlobalState.resizeObserver = new ResizeObserver(() => {
      if (GlobalState.isOverlayActive) {
        applyTransforms();
      }
    });
    GlobalState.resizeObserver.observe(document.body);

    // Scroll listener for video detection
    const scrollContainer = getScrollContainer();
    scrollContainer.addEventListener('scroll', debounce(() => {
      if (!GlobalState.isOverlayActive) {
        const video = findActiveVideo();
        if (video && video !== GlobalState.currentVideo) {
          handleVideoChange(video);
        }
      }
    }, 150), { passive: true });
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

    // Reset transforms
    resetAll();

    // Remove elements
    GlobalState.backdrop?.remove();
    GlobalState.overlay?.remove();
    GlobalState.controlPanel?.remove();
    document.getElementById('ir-exit-hint')?.remove();
    document.getElementById(CONFIG.SELECTORS.TOAST)?.remove();

    // Disconnect observers
    GlobalState.mutationObserver?.disconnect();
    GlobalState.resizeObserver?.disconnect();

    // Reset body class
    document.body.classList.remove('ir-overlay-active');

    log('Cleanup complete');
  }

  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('pagehide', cleanup);

  // Extension context check
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'cleanup') {
        cleanup();
        sendResponse({ success: true });
      }
    });
  }

  window.__instamutate_cleanup = cleanup;

  // ============================================
  // INITIALIZATION
  // ============================================

  function init() {
    log(`v${CONFIG.VERSION} initializing...`);

    // Add event listeners
    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('wheel', handleWheel, { passive: false });

    // Setup observers
    setupObservers();

    // Setup HD video interception
    injectHDInterceptor();
    setupHDVideoListeners();

    // Initial video detection
    const video = findActiveVideo();
    if (video) {
      GlobalState.currentVideo = video;
      GlobalState.currentVideoSrc = video.currentSrc || video.src;
    }

    // Create UI if on reels page
    updatePanelVisibility();

    log('Ready!');
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
