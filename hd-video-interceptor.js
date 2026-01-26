/**
 * ANGEL HD Video Interceptor v2
 * 
 * This script is injected into the page context to intercept fetch() requests
 * and extract high-quality video URLs from Instagram's GraphQL responses.
 * 
 * Strategy: Store all HD video URLs and match by various identifiers
 */

(function () {
    'use strict';

    // Prevent double initialization
    if (window.__ANGEL_HD_INTERCEPTOR__) return;
    window.__ANGEL_HD_INTERCEPTOR__ = true;

    const DEBUG = true; // Enable for debugging
    const log = (...args) => DEBUG && console.log('[ANGEL-HD]', ...args);

    // Store for HD video URLs with multiple lookup keys
    const hdVideoStore = {
        byId: new Map(),      // media_id -> HD info
        byUrl: new Map(),     // URL fragment -> HD info
        allVideos: []         // All found HD videos for fallback matching
    };

    /**
     * Recursively search an object for video data
     * Instagram uses various field names for video URLs
     */
    function findVideoData(obj, results = [], depth = 0) {
        if (!obj || typeof obj !== 'object' || depth > 15) return results;

        // Check for video_versions (most common)
        if (Array.isArray(obj.video_versions) && obj.video_versions.length > 0) {
            const mediaId = obj.id || obj.pk || obj.media_id || null;
            results.push({
                versions: obj.video_versions,
                dashManifest: obj.video_dash_manifest || null,
                mediaId: mediaId,
                code: obj.code || null
            });
            log('Found video_versions for media:', mediaId);
        }

        // Also check for direct video_url field
        if (obj.video_url && typeof obj.video_url === 'string') {
            const mediaId = obj.id || obj.pk || obj.media_id || null;
            results.push({
                versions: [{
                    url: obj.video_url,
                    width: obj.original_width || obj.video_width || 1080,
                    height: obj.original_height || obj.video_height || 1920
                }],
                dashManifest: null,
                mediaId: mediaId,
                code: obj.code || null
            });
            log('Found direct video_url for media:', mediaId);
        }

        // Recurse into arrays and objects
        if (Array.isArray(obj)) {
            for (const item of obj) {
                findVideoData(item, results, depth + 1);
            }
        } else {
            for (const key in obj) {
                if (obj.hasOwnProperty(key) && key !== 'extensions' && key !== 'errors') {
                    findVideoData(obj[key], results, depth + 1);
                }
            }
        }

        return results;
    }

    /**
     * Get highest quality from video_versions array
     */
    function getHighestQuality(versions) {
        if (!Array.isArray(versions) || versions.length === 0) return null;

        const sorted = [...versions].sort((a, b) => {
            const aRes = (a.width || 0) * (a.height || 0);
            const bRes = (b.width || 0) * (b.height || 0);
            return bRes - aRes;
        });

        return sorted[0];
    }

    /**
     * Parse DASH manifest for highest quality
     */
    function parseDASHManifest(manifestXml) {
        if (!manifestXml || typeof manifestXml !== 'string') return null;

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(manifestXml, 'text/xml');
            const representations = doc.querySelectorAll('Representation');

            let best = null;
            let bestRes = 0;

            for (const rep of representations) {
                const width = parseInt(rep.getAttribute('width') || '0', 10);
                const height = parseInt(rep.getAttribute('height') || '0', 10);
                const baseUrl = rep.querySelector('BaseURL');

                if (!baseUrl) continue;

                const resolution = width * height;
                if (resolution > bestRes) {
                    bestRes = resolution;
                    best = {
                        url: baseUrl.textContent,
                        width,
                        height,
                        source: 'dash'
                    };
                }
            }

            return best;
        } catch (e) {
            log('DASH parse error:', e);
            return null;
        }
    }

    /**
     * Extract URL fragment for matching (works with Instagram CDN URLs)
     */
    function extractUrlKey(url) {
        if (!url) return null;

        try {
            // Instagram video URLs have patterns like:
            // https://scontent.cdninstagram.com/v/t50.2886-16/123456789_987654321_n.mp4?...
            // The key part is usually in the path before the query string

            const urlObj = new URL(url);
            const path = urlObj.pathname;

            // Try to extract the video filename
            const segments = path.split('/').filter(s => s.length > 0);
            const lastSegment = segments[segments.length - 1];

            if (lastSegment) {
                // Remove extension and return
                return lastSegment.split('.')[0];
            }

            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Store HD video info with multiple keys for matching
     */
    function storeHDVideo(hdInfo, mediaId, code, allVersionUrls) {
        const hdData = {
            url: hdInfo.url,
            width: hdInfo.width,
            height: hdInfo.height,
            source: hdInfo.source || 'versions',
            mediaId: mediaId,
            code: code,
            timestamp: Date.now()
        };

        // Store by media ID
        if (mediaId) {
            hdVideoStore.byId.set(String(mediaId), hdData);
            log('Stored HD by ID:', mediaId, hdInfo.width + 'x' + hdInfo.height);
        }

        // Store by URL key (from HD URL)
        const hdUrlKey = extractUrlKey(hdInfo.url);
        if (hdUrlKey) {
            hdVideoStore.byUrl.set(hdUrlKey, hdData);
        }

        // Also map all version URLs to this HD version
        for (const versionUrl of allVersionUrls) {
            const versionKey = extractUrlKey(versionUrl);
            if (versionKey && versionKey !== hdUrlKey) {
                hdVideoStore.byUrl.set(versionKey, hdData);
            }
        }

        // Add to all videos list
        hdVideoStore.allVideos.push(hdData);

        // Keep only recent videos (last 50)
        if (hdVideoStore.allVideos.length > 50) {
            hdVideoStore.allVideos.shift();
        }

        // Emit event for content script
        window.dispatchEvent(new CustomEvent('angel-hd-video', {
            detail: hdData
        }));
    }

    /**
     * Process found video data
     */
    function processVideoData(videoItems) {
        log('Processing', videoItems.length, 'video items');

        for (const item of videoItems) {
            // Get highest quality from versions
            let hdVideo = getHighestQuality(item.versions);

            if (hdVideo) {
                hdVideo.source = 'versions';
            }

            // Check DASH manifest for potentially higher quality
            if (item.dashManifest) {
                const dashVideo = parseDASHManifest(item.dashManifest);
                if (dashVideo) {
                    const dashRes = dashVideo.width * dashVideo.height;
                    const versionsRes = hdVideo ? (hdVideo.width || 0) * (hdVideo.height || 0) : 0;

                    if (dashRes > versionsRes) {
                        hdVideo = dashVideo;
                        log('Using DASH manifest (higher quality):', dashVideo.width + 'x' + dashVideo.height);
                    }
                }
            }

            if (hdVideo && hdVideo.url) {
                // Collect all version URLs for mapping
                const allVersionUrls = item.versions
                    .filter(v => v.url)
                    .map(v => v.url);

                storeHDVideo(hdVideo, item.mediaId, item.code, allVersionUrls);
            }
        }
    }

    /**
     * Intercept fetch() to capture GraphQL responses with video data
     */
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);

        try {
            const url = args[0]?.url || args[0] || '';
            const urlString = typeof url === 'string' ? url : url.toString();

            // Check for any API request that might contain video data
            const isRelevant = urlString.includes('/graphql') ||
                urlString.includes('/api/v1/') ||
                urlString.includes('clips') ||
                urlString.includes('reels') ||
                urlString.includes('media');

            if (isRelevant) {
                const clone = response.clone();

                clone.text().then(text => {
                    try {
                        const data = JSON.parse(text);
                        const videoItems = findVideoData(data);

                        if (videoItems.length > 0) {
                            log('Fetch intercepted', videoItems.length, 'videos from:', urlString.substring(0, 60));
                            processVideoData(videoItems);
                        }
                    } catch (e) {
                        // Not JSON - ignore
                    }
                }).catch(() => { });
            }
        } catch (e) {
            log('Fetch intercept error:', e);
        }

        return response;
    };

    /**
     * Intercept XMLHttpRequest
     */
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this._angelUrl = url;
        return originalXHROpen.apply(this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.send = function (...args) {
        this.addEventListener('load', function () {
            try {
                const url = this._angelUrl || '';
                const isRelevant = url.includes('/graphql') ||
                    url.includes('/api/v1/') ||
                    url.includes('clips') ||
                    url.includes('reels') ||
                    url.includes('media');

                if (isRelevant) {
                    const data = JSON.parse(this.responseText);
                    const videoItems = findVideoData(data);

                    if (videoItems.length > 0) {
                        log('XHR intercepted', videoItems.length, 'videos');
                        processVideoData(videoItems);
                    }
                }
            } catch (e) {
                // Ignore errors
            }
        });

        return originalXHRSend.apply(this, args);
    };

    /**
     * Expose API for content script
     */
    window.__angel_hd = {
        store: hdVideoStore,

        // Get HD info for a given video URL
        getHDForUrl: function (videoUrl) {
            const key = extractUrlKey(videoUrl);
            if (key && hdVideoStore.byUrl.has(key)) {
                return hdVideoStore.byUrl.get(key);
            }
            return null;
        },

        // Get most recent HD video
        getLatestHD: function () {
            if (hdVideoStore.allVideos.length === 0) return null;
            return hdVideoStore.allVideos[hdVideoStore.allVideos.length - 1];
        },

        // Get stats
        getStats: function () {
            return {
                byIdCount: hdVideoStore.byId.size,
                byUrlCount: hdVideoStore.byUrl.size,
                totalVideos: hdVideoStore.allVideos.length
            };
        }
    };

    log('HD Video Interceptor v2 initialized');

    // Log stats periodically for debugging
    if (DEBUG) {
        setInterval(() => {
            const stats = window.__angel_hd.getStats();
            if (stats.totalVideos > 0) {
                log('Stats:', stats);
            }
        }, 5000);
    }
})();
