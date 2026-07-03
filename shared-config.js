/**
 * ANGEL Shared Configuration
 * Single source of truth for keyboard shortcuts and other constants
 * shared between the content script and the popup page.
 *
 * Loaded via manifest.json (content script) and popup.html (<script> tag).
 */

// eslint-disable-next-line no-unused-vars
var ANGEL_KEYBOARD = {
  ROTATE_CW:    'r',
  ROTATE_CCW:   'l',
  FULLSCREEN:   'f',
  THEATER:      't',
  RESET:        'escape',
  ZOOM_IN:      '=',
  ZOOM_OUT:     '-',
  ASPECT_CYCLE: 'a',
  HD_TOGGLE:    'h',
  SPEED_SLOW:   '[',
  SPEED_FAST:   ']',
  MUTE:         'm',
  SAVE:         's',
  DOWNLOAD:     '.',
  DOWNLOAD_MODIFIER: false
};

// eslint-disable-next-line no-unused-vars
var ANGEL_DOWNLOAD_SETTINGS = {
  DEFAULT_TEMPLATE: 'angel_{username}_{shortcode}_{type}_{quality}{index}',
  STORAGE_KEYS: {
    TEMPLATE: 'angel_downloadTemplate',
    CAROUSEL_INDEX: 'angel_downloadCarouselIndex',
    SAVE_AS: 'angel_downloadSaveAs'
  },
  SUPPORTED_TAGS: ['username', 'shortcode', 'type', 'quality', 'index', 'date']
};
