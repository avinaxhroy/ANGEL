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

  // Update status when popup opens
  document.addEventListener('DOMContentLoaded', updateStatus);
})();
