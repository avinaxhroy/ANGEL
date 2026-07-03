/**
 * ANGEL - Background Service Worker
 * Handles context menus and download operations
 */

const FORBIDDEN_DOWNLOAD_HEADERS = new Set(['origin', 'referer', 'cookie']);

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'angel-download-instagram-media',
      title: 'Download this Instagram media with ANGEL',
      contexts: ['all'],
      documentUrlPatterns: ['https://www.instagram.com/*']
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenus();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'angel-download-instagram-media' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'downloadContextMedia' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[ANGEL] Context media download failed:', chrome.runtime.lastError.message);
      } else if (!response?.success) {
        console.warn('[ANGEL] Context media download failed:', response?.error || 'No media found');
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action !== 'angelDownloadUrl') return false;

  const options = message.options || {};
  if (!options.url || typeof options.url !== 'string') {
    sendResponse({ success: false, error: 'Missing download URL' });
    return false;
  }

  const downloadOptions = {
    url: options.url,
    filename: options.filename,
    conflictAction: options.conflictAction || 'uniquify',
    saveAs: !!options.saveAs
  };

  if (Array.isArray(options.headers) && options.headers.length > 0) {
    downloadOptions.headers = options.headers
      .filter(header => header && typeof header.name === 'string' && typeof header.value === 'string')
      .map(header => ({ name: header.name, value: header.value }))
      .filter(header => !FORBIDDEN_DOWNLOAD_HEADERS.has(header.name.toLowerCase()));

    if (downloadOptions.headers.length === 0) {
      delete downloadOptions.headers;
    }
  }

  chrome.downloads.download(downloadOptions, (downloadId) => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }
    sendResponse({ success: true, downloadId });
  });

  return true;
});
