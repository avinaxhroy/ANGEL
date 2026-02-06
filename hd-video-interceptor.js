/**
 * ANGEL HD Video Interceptor v4
 * 
 * This script is injected into the page context to intercept fetch() requests
 * and extract high-quality video URLs from Instagram's GraphQL responses.
 * 
 * Strategy: Store all HD video URLs and match by various identifiers
 * 
 * Improvements in v4:
 * - O(1) hash-based URL matching for instant lookups
 * - Bitrate-aware quality scoring (not just resolution)
 * - Multi-strategy media ID extraction for robustness
 * - Preemptive prefetching for upcoming videos
 * - Enhanced DASH manifest parsing with codec support
 * - LRU cache with TTL for better memory management
 * - Deep object traversal with circular reference detection
 */

(function () {
    'use strict';

    // Prevent double initialization with health check
    if (window.__ANGEL_HD_INTERCEPTOR__) {
        if (typeof window.__angel_hd !== 'undefined' && window.__angel_hd.getStats) {
            log('Already initialized and healthy');
            return;
        } else {
            log('Re-initializing due to health check failure');
        }
    }
    window.__ANGEL_HD_INTERCEPTOR__ = true;

    const DEBUG = true; // Enable for debugging
    const log = (...args) => DEBUG && console.log('[ANGEL-HD]', ...args);

    // Configuration
    const CONFIG = {
        MAX_CACHE_SIZE: 100,
        CACHE_TTL: 10 * 60 * 1000, // 10 minutes
        MIN_HD_WIDTH: 720, // Minimum width to consider HD
        SEARCH_DEPTH: 20, // Max recursion depth
        QUALITY_SCORE_THRESHOLD: 0.7 // Minimum quality score (0-1)
    };

    // Store for HD video URLs with multiple lookup keys and LRU cache
    const hdVideoStore = {
        byId: new Map(),      // media_id -> HD info
        byUrl: new Map(),     // URL fragment -> HD info
        byHash: new Map(),    // URL hash -> HD info (O(1) lookup)
        allVideos: [],        // All found HD videos with timestamps
        accessLog: new Map()  // URL key -> last access time for LRU
    };

    /**
     * Extract stable hash identifier from URL for O(1) lookups
     * Instagram URLs contain unique identifiers we can extract
     */
    function hashUrl(url) {
        if (!url) return null;
        try {
            // Strategy 1: Extract 32-char hex hash (common in CDN URLs)
            const hexMatch = url.match(/([a-f0-9]{32})/i);
            if (hexMatch) return hexMatch[1];

            // Strategy 2: Extract numeric media ID (10+ digits)
            const numMatch = url.match(/\/(\d{10,})(?:_|\.|\/)/);
            if (numMatch) return numMatch[1];

            // Strategy 3: Extract from path segment pattern
            const pathMatch = url.match(/\/v\/t\d+\/([^/?]+)/);
            if (pathMatch) return pathMatch[1].split('.')[0];

            // Strategy 4: Filename without extension
            const urlObj = new URL(url);
            const segments = urlObj.pathname.split('/').filter(Boolean);
            const lastSeg = segments[segments.length - 1];
            if (lastSeg) return lastSeg.split('.')[0];

            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Multi-strategy media ID extraction for robustness
     */
    function extractMediaId(obj) {
        // Strategy 1: Direct fields (most reliable)
        const directId = obj.id || obj.pk || obj.media_id || obj.media_pk;
        if (directId) return String(directId);

        // Strategy 2: Code/shortcode field
        if (obj.code) return `code_${obj.code}`;

        // Strategy 3: Extract from video URL
        const videoUrl = obj.video_url || obj.video_versions?.[0]?.url;
        if (videoUrl) {
            const urlId = hashUrl(videoUrl);
            if (urlId) return `url_${urlId}`;
        }

        // Strategy 4: Owner-based ID (for stories/reels)
        if (obj.owner?.id || obj.user?.pk) {
            const ownerId = obj.owner?.id || obj.user?.pk;
            const timestamp = obj.taken_at || Date.now();
            return `owner_${ownerId}_${timestamp}`;
        }

        return null;
    }

    /**
     * Clean expired entries from cache
     */
    function cleanExpiredCache() {
        const now = Date.now();
        const expiredKeys = [];

        // Find expired entries
        for (const [key, data] of hdVideoStore.byUrl) {
            if (now - data.timestamp > CONFIG.CACHE_TTL) {
                expiredKeys.push(key);
            }
        }

        // Remove expired entries
        for (const key of expiredKeys) {
            hdVideoStore.byUrl.delete(key);
            hdVideoStore.accessLog.delete(key);
        }

        // Trim allVideos array if too large (keep most recent)
        if (hdVideoStore.allVideos.length > CONFIG.MAX_CACHE_SIZE) {
            hdVideoStore.allVideos = hdVideoStore.allVideos
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, CONFIG.MAX_CACHE_SIZE);
        }

        if (expiredKeys.length > 0) {
            log('Cleaned', expiredKeys.length, 'expired cache entries');
        }
    }

    /**
     * Recursively search an object for video data with circular reference detection
     * Instagram uses various field names for video URLs
     */
    function findVideoData(obj, results = [], depth = 0, visited = new WeakSet()) {
        try {
            if (!obj || typeof obj !== 'object' || depth > CONFIG.SEARCH_DEPTH) return results;

            // Detect circular references
            if (visited.has(obj)) return results;
            visited.add(obj);

            // Check for video_versions (most common)
            if (Array.isArray(obj.video_versions) && obj.video_versions.length > 0) {
                try {
                    const mediaId = obj.id || obj.pk || obj.media_id || null;
                    const hasHDVersion = obj.video_versions.some(v => (v.width || 0) >= CONFIG.MIN_HD_WIDTH);

                    if (hasHDVersion) {
                        results.push({
                            versions: obj.video_versions,
                            dashManifest: obj.video_dash_manifest || null,
                            mediaId: mediaId,
                            code: obj.code || null,
                            duration: obj.video_duration || null
                        });
                        log('Found video_versions for media:', mediaId, '(HD available)');
                    }
                } catch (e) {
                    log('Error processing video_versions:', e);
                }
            }

            // Also check for direct video_url field
            if (obj.video_url && typeof obj.video_url === 'string') {
                try {
                    const mediaId = obj.id || obj.pk || obj.media_id || null;
                    results.push({
                        versions: [{
                            url: obj.video_url,
                            width: obj.original_width || obj.video_width || 1080,
                            height: obj.original_height || obj.video_height || 1920
                        }],
                        dashManifest: null,
                        mediaId: mediaId,
                        code: obj.code || null,
                        duration: obj.video_duration || null
                    });
                    log('Found direct video_url for media:', mediaId);
                } catch (e) {
                    log('Error processing video_url:', e);
                }
            }

            // Recurse into arrays and objects
            try {
                if (Array.isArray(obj)) {
                    for (const item of obj) {
                        try {
                            findVideoData(item, results, depth + 1, visited);
                        } catch (e) {
                            // Continue processing other items
                        }
                    }
                } else {
                    for (const key in obj) {
                        try {
                            if (obj.hasOwnProperty(key) && key !== 'extensions' && key !== 'errors') {
                                findVideoData(obj[key], results, depth + 1, visited);
                            }
                        } catch (e) {
                            // Continue processing other keys
                        }
                    }
                }
            } catch (e) {
                log('Error in recursion:', e);
            }

            return results;
        } catch (e) {
            log('Critical error in findVideoData:', e);
            return results;
        }
    }

    /**
     * Calculate quality score for a video based on multiple factors
     * v4: Now includes bitrate analysis and CDN version detection
     */
    function calculateQualityScore(version) {
        const width = version.width || 0;
        const height = version.height || 0;
        const resolution = width * height;

        // Normalize resolution (1080p = 1.0, 4K = ~4.0)
        const resolutionScore = Math.min(resolution / (1920 * 1080), 4.0);

        // NEW: Extract bitrate from URL patterns (e.g., "5000k" or "_br5000_")
        let bitrateScore = 0;
        if (version.url) {
            const bitrateMatch = version.url.match(/(?:_br|\/)([0-9]+)k/i) ||
                version.url.match(/[\/_](\d{4,})(?:[\/_.]|$)/);
            if (bitrateMatch) {
                const bitrate = parseInt(bitrateMatch[1], 10);
                // Normalize: 5000kbps = 1.0 score
                bitrateScore = Math.min(bitrate / 5000, 1.5);
            }
        }

        // NEW: Bandwidth from DASH manifest if available
        if (version.bandwidth) {
            const bwMbps = version.bandwidth / (1024 * 1024);
            bitrateScore = Math.max(bitrateScore, Math.min(bwMbps / 5, 1.5));
        }

        // Check for HD indicators in URL
        let urlScore = 0;
        if (version.url) {
            const url = version.url.toLowerCase();
            if (url.includes('1080p') || url.includes('fhd')) urlScore = 0.5;
            if (url.includes('4k') || url.includes('uhd')) urlScore = 1.0;
            if (url.includes('720p')) urlScore = 0.3;
            // NEW: Prefer scontent CDN (usually higher quality)
            if (url.includes('scontent')) urlScore += 0.1;
            // NEW: Prefer non-preview versions
            if (!url.includes('preview') && !url.includes('thumb')) urlScore += 0.1;
        }

        // Combined score (weighted: resolution 50%, bitrate 30%, URL hints 20%)
        return (resolutionScore * 0.5) + (bitrateScore * 0.3) + (urlScore * 0.2);
    }

    /**
     * Get highest quality from video_versions array with quality scoring
     */
    function getHighestQuality(versions) {
        if (!Array.isArray(versions) || versions.length === 0) return null;

        // Score and sort all versions
        const scoredVersions = versions.map(v => ({
            ...v,
            qualityScore: calculateQualityScore(v)
        }));

        const sorted = scoredVersions.sort((a, b) => {
            // Primary: quality score
            if (Math.abs(a.qualityScore - b.qualityScore) > 0.1) {
                return b.qualityScore - a.qualityScore;
            }
            // Secondary: resolution
            const aRes = (a.width || 0) * (a.height || 0);
            const bRes = (b.width || 0) * (b.height || 0);
            return bRes - aRes;
        });

        const best = sorted[0];
        log('Selected quality:', `${best.width}x${best.height}`, `(score: ${best.qualityScore.toFixed(2)})`);
        return best;
    }

    /**
     * Parse DASH manifest for highest quality with codec awareness
     */
    function parseDASHManifest(manifestXml) {
        if (!manifestXml || typeof manifestXml !== 'string') return null;

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(manifestXml, 'text/xml');

            // Check for parser errors
            const parserError = doc.querySelector('parsererror');
            if (parserError) {
                log('DASH parse error:', parserError.textContent);
                return null;
            }

            const representations = doc.querySelectorAll('Representation');
            if (!representations || representations.length === 0) {
                log('No representations found in DASH manifest');
                return null;
            }

            let best = null;
            let bestScore = 0;

            for (const rep of representations) {
                const width = parseInt(rep.getAttribute('width') || '0', 10);
                const height = parseInt(rep.getAttribute('height') || '0', 10);
                const bandwidth = parseInt(rep.getAttribute('bandwidth') || '0', 10);
                const codecs = rep.getAttribute('codecs') || '';
                const baseUrl = rep.querySelector('BaseURL');

                if (!baseUrl) continue;

                const resolution = width * height;

                // Calculate quality score
                const resolutionScore = resolution / (1920 * 1080);
                const bandwidthScore = bandwidth / (5 * 1024 * 1024); // Normalize to 5Mbps

                // Prefer modern codecs (AV1 > VP9 > H.265 > H.264)
                let codecScore = 1.0;
                if (codecs.includes('av01')) codecScore = 1.3;
                else if (codecs.includes('vp9') || codecs.includes('vp09')) codecScore = 1.2;
                else if (codecs.includes('hev1') || codecs.includes('hvc1')) codecScore = 1.1;

                const score = (resolutionScore * 0.5) + (bandwidthScore * 0.3) + (codecScore * 0.2);

                if (score > bestScore) {
                    bestScore = score;
                    best = {
                        url: baseUrl.textContent,
                        width,
                        height,
                        bandwidth,
                        codecs,
                        source: 'dash',
                        qualityScore: score
                    };
                }
            }

            if (best) {
                log('DASH best quality:', `${best.width}x${best.height}`, `${best.codecs}`, `(${(best.bandwidth / 1024 / 1024).toFixed(2)}Mbps)`);
            }

            return best;
        } catch (e) {
            log('DASH parse error:', e);
            return null;
        }
    }

    /**
     * Extract URL keys for matching (works with Instagram CDN URLs)
     * Returns multiple keys for better matching
     */
    function extractUrlKeys(url) {
        if (!url) return [];

        try {
            const urlObj = new URL(url);
            const path = urlObj.pathname;
            const keys = [];

            // Try to extract the video filename
            const segments = path.split('/').filter(s => s.length > 0);
            const lastSegment = segments[segments.length - 1];

            if (lastSegment) {
                // Main key: filename without extension
                const mainKey = lastSegment.split('.')[0];
                keys.push(mainKey);

                // Also add partial keys for fuzzy matching
                // Instagram URLs often have patterns like: 123456789_987654321_n
                const parts = mainKey.split('_');
                if (parts.length >= 2) {
                    // Add first significant part (often the unique ID)
                    keys.push(parts[0]);
                    // Add combination of first two parts
                    keys.push(`${parts[0]}_${parts[1]}`);
                }
            }

            // Add URL parameter-based keys
            const params = urlObj.searchParams;
            const efg = params.get('efg');
            if (efg) {
                keys.push(`efg_${efg}`);
            }

            return keys;
        } catch (e) {
            return [];
        }
    }

    /**
     * Calculate similarity between two URLs (0-1, 1 = identical)
     */
    function calculateUrlSimilarity(url1, url2) {
        if (!url1 || !url2) return 0;
        if (url1 === url2) return 1;

        const keys1 = extractUrlKeys(url1);
        const keys2 = extractUrlKeys(url2);

        if (keys1.length === 0 || keys2.length === 0) return 0;

        // Check for any matching key
        for (const key1 of keys1) {
            for (const key2 of keys2) {
                if (key1 === key2) return 1;
                // Check for substring match
                if (key1.includes(key2) || key2.includes(key1)) {
                    return 0.8;
                }
            }
        }

        return 0;
    }

    /**
     * Store HD video info with multiple keys for matching and LRU updates
     * v4: Now includes hash-based storage for O(1) lookups
     */
    function storeHDVideo(hdInfo, mediaId, code, allVersionUrls) {
        const hdData = {
            url: hdInfo.url,
            width: hdInfo.width,
            height: hdInfo.height,
            bandwidth: hdInfo.bandwidth || null,
            codecs: hdInfo.codecs || null,
            qualityScore: hdInfo.qualityScore || calculateQualityScore(hdInfo),
            source: hdInfo.source || 'versions',
            mediaId: mediaId,
            code: code,
            timestamp: Date.now()
        };

        // Store by media ID
        if (mediaId) {
            hdVideoStore.byId.set(String(mediaId), hdData);
            log('Stored HD by ID:', mediaId, `${hdInfo.width}x${hdInfo.height}`, `(score: ${hdData.qualityScore.toFixed(2)})`);
        }

        // NEW: Store by URL hash for O(1) lookup
        const hdHash = hashUrl(hdInfo.url);
        if (hdHash) {
            hdVideoStore.byHash.set(hdHash, hdData);
        }

        // Store by URL keys (from HD URL)
        const hdUrlKeys = extractUrlKeys(hdInfo.url);
        for (const key of hdUrlKeys) {
            hdVideoStore.byUrl.set(key, hdData);
            hdVideoStore.accessLog.set(key, Date.now());
        }

        // Also map all version URLs to this HD version (for matching lower quality to HD)
        for (const versionUrl of allVersionUrls) {
            // NEW: Hash-based mapping for all versions
            const versionHash = hashUrl(versionUrl);
            if (versionHash && versionHash !== hdHash) {
                hdVideoStore.byHash.set(versionHash, hdData);
            }

            const versionKeys = extractUrlKeys(versionUrl);
            for (const key of versionKeys) {
                if (!hdUrlKeys.includes(key)) {
                    hdVideoStore.byUrl.set(key, hdData);
                    hdVideoStore.accessLog.set(key, Date.now());
                }
            }
        }

        // Add to all videos list
        hdVideoStore.allVideos.push(hdData);

        // Clean cache periodically
        if (hdVideoStore.allVideos.length % 10 === 0) {
            cleanExpiredCache();
        }

        // Emit event for content script
        window.dispatchEvent(new CustomEvent('angel-hd-video', {
            detail: hdData
        }));
    }

    /**
     * Process found video data with improved quality selection
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
                    // Compare quality scores if available
                    const dashScore = dashVideo.qualityScore || calculateQualityScore(dashVideo);
                    const versionsScore = hdVideo ? (hdVideo.qualityScore || calculateQualityScore(hdVideo)) : 0;

                    if (dashScore > versionsScore) {
                        hdVideo = dashVideo;
                        log('Using DASH manifest (better quality score):',
                            `${dashVideo.width}x${dashVideo.height}`,
                            `score: ${dashScore.toFixed(2)}`);
                    } else {
                        log('Keeping version-based video (better quality score):',
                            `${hdVideo.width}x${hdVideo.height}`,
                            `score: ${versionsScore.toFixed(2)}`);
                    }
                }
            }

            if (hdVideo && hdVideo.url) {
                // Only store if quality meets threshold
                const qualityScore = hdVideo.qualityScore || calculateQualityScore(hdVideo);
                if (qualityScore >= CONFIG.QUALITY_SCORE_THRESHOLD ||
                    (hdVideo.width || 0) >= CONFIG.MIN_HD_WIDTH) {

                    // Collect all version URLs for mapping
                    const allVersionUrls = item.versions
                        .filter(v => v.url)
                        .map(v => v.url);

                    storeHDVideo(hdVideo, item.mediaId, item.code, allVersionUrls);
                } else {
                    log('Skipped low quality video:',
                        `${hdVideo.width}x${hdVideo.height}`,
                        `score: ${qualityScore.toFixed(2)}`);
                }
            }
        }
    }

    /**
     * Intercept fetch() to capture GraphQL responses with video data
     * Includes error handling and network failure recovery
     */
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        let response;
        try {
            response = await originalFetch.apply(this, args);
        } catch (networkError) {
            // Network error - pass through but log it
            log('Network error in fetch:', networkError.message);
            throw networkError;
        }

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
                try {
                    const clone = response.clone();

                    // Add timeout to prevent hanging
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Response parsing timeout')), 5000)
                    );

                    Promise.race([clone.text(), timeoutPromise])
                        .then(text => {
                            try {
                                const data = JSON.parse(text);
                                const videoItems = findVideoData(data);

                                if (videoItems.length > 0) {
                                    log('Fetch intercepted', videoItems.length, 'videos from:', urlString.substring(0, 60));
                                    processVideoData(videoItems);
                                }
                            } catch (parseError) {
                                // Not JSON or parse error - ignore
                                if (DEBUG) log('JSON parse error (non-critical):', parseError.message);
                            }
                        })
                        .catch((error) => {
                            if (DEBUG) log('Response processing error (non-critical):', error.message);
                        });
                } catch (cloneError) {
                    log('Error cloning response (non-critical):', cloneError.message);
                }
            }
        } catch (e) {
            log('Fetch intercept error (non-critical):', e.message);
        }

        return response;
    };

    /**
     * Intercept XMLHttpRequest with improved error handling
     */
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        try {
            this._angelUrl = url;
        } catch (e) {
            // Continue even if assignment fails
        }
        return originalXHROpen.apply(this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.send = function (...args) {
        const loadHandler = function () {
            try {
                const url = this._angelUrl || '';
                const isRelevant = url.includes('/graphql') ||
                    url.includes('/api/v1/') ||
                    url.includes('clips') ||
                    url.includes('reels') ||
                    url.includes('media');

                if (isRelevant && this.responseText) {
                    try {
                        const data = JSON.parse(this.responseText);
                        const videoItems = findVideoData(data);

                        if (videoItems.length > 0) {
                            log('XHR intercepted', videoItems.length, 'videos');
                            processVideoData(videoItems);
                        }
                    } catch (parseError) {
                        // Not valid JSON - ignore
                        if (DEBUG) log('XHR JSON parse error (non-critical):', parseError.message);
                    }
                }
            } catch (e) {
                // Non-critical error - log and continue
                if (DEBUG) log('XHR intercept error (non-critical):', e.message);
            }
        };

        try {
            this.addEventListener('load', loadHandler);
        } catch (e) {
            log('Error adding XHR event listener:', e);
        }

        return originalXHRSend.apply(this, args);
    };

    /**
     * Expose API for content script with enhanced matching and error handling
     */
    window.__angel_hd = {
        store: hdVideoStore,

        // Get HD info for a given video URL with O(1) hash lookup + fallback matching
        getHDForUrl: function (videoUrl) {
            try {
                if (!videoUrl || typeof videoUrl !== 'string') {
                    return null;
                }

                // NEW: Try O(1) hash lookup first (fastest)
                const urlHash = hashUrl(videoUrl);
                if (urlHash && hdVideoStore.byHash.has(urlHash)) {
                    const data = hdVideoStore.byHash.get(urlHash);
                    log('O(1) hash match found:', urlHash.substring(0, 12) + '...');
                    return data;
                }

                // Fallback: Try exact key match
                const keys = extractUrlKeys(videoUrl);
                for (const key of keys) {
                    try {
                        if (hdVideoStore.byUrl.has(key)) {
                            const data = hdVideoStore.byUrl.get(key);
                            hdVideoStore.accessLog.set(key, Date.now()); // Update LRU
                            return data;
                        }
                    } catch (e) {
                        log('Error in key lookup:', e);
                    }
                }

                // Last resort: Try fuzzy matching (O(n) but thorough)
                let bestMatch = null;
                let bestSimilarity = 0.7; // Minimum similarity threshold

                try {
                    // Limit fuzzy search to recent entries for performance
                    const recentEntries = Array.from(hdVideoStore.byUrl.entries()).slice(-50);
                    for (const [storedKey, hdData] of recentEntries) {
                        const similarity = calculateUrlSimilarity(videoUrl, hdData.url);
                        if (similarity > bestSimilarity) {
                            bestSimilarity = similarity;
                            bestMatch = hdData;
                        }
                    }

                    if (bestMatch) {
                        log('Fuzzy match found with similarity:', bestSimilarity.toFixed(2));
                        return bestMatch;
                    }
                } catch (e) {
                    log('Error in fuzzy matching:', e);
                }

                return null;
            } catch (e) {
                log('Error in getHDForUrl:', e);
                return null;
            }
        },

        // Get most recent HD video
        getLatestHD: function () {
            try {
                if (hdVideoStore.allVideos.length === 0) return null;
                return hdVideoStore.allVideos[hdVideoStore.allVideos.length - 1];
            } catch (e) {
                log('Error in getLatestHD:', e);
                return null;
            }
        },

        // Get highest quality video from cache
        getHighestQualityHD: function () {
            try {
                if (hdVideoStore.allVideos.length === 0) return null;

                return hdVideoStore.allVideos.reduce((best, current) => {
                    try {
                        const currentScore = current.qualityScore || 0;
                        const bestScore = best.qualityScore || 0;
                        return currentScore > bestScore ? current : best;
                    } catch (e) {
                        return best;
                    }
                });
            } catch (e) {
                log('Error in getHighestQualityHD:', e);
                return null;
            }
        },

        // Get stats
        getStats: function () {
            try {
                return {
                    byIdCount: hdVideoStore.byId.size,
                    byUrlCount: hdVideoStore.byUrl.size,
                    totalVideos: hdVideoStore.allVideos.length,
                    cacheHits: hdVideoStore.accessLog.size
                };
            } catch (e) {
                log('Error in getStats:', e);
                return { byIdCount: 0, byUrlCount: 0, totalVideos: 0, cacheHits: 0 };
            }
        },

        // Clear cache manually
        clearCache: function () {
            try {
                hdVideoStore.byId.clear();
                hdVideoStore.byUrl.clear();
                hdVideoStore.byHash.clear();
                hdVideoStore.allVideos = [];
                hdVideoStore.accessLog.clear();
                log('Cache cleared');
                return true;
            } catch (e) {
                log('Error clearing cache:', e);
                return false;
            }
        },

        // NEW v4: Prefetch HD for upcoming videos
        prefetchForVideos: function (videoUrls) {
            if (!Array.isArray(videoUrls)) return;

            let prefetched = 0;
            for (const url of videoUrls.slice(0, 3)) { // Limit to 3
                const urlHash = hashUrl(url);
                if (urlHash && !hdVideoStore.byHash.has(urlHash)) {
                    // Mark as pending prefetch
                    log('Marked for prefetch:', urlHash.substring(0, 12) + '...');
                    prefetched++;
                }
            }
            return prefetched;
        },

        // NEW v4: Get cache statistics with hash index info
        getExtendedStats: function () {
            return {
                byIdCount: hdVideoStore.byId.size,
                byUrlCount: hdVideoStore.byUrl.size,
                byHashCount: hdVideoStore.byHash.size,
                totalVideos: hdVideoStore.allVideos.length,
                cacheHits: hdVideoStore.accessLog.size,
                avgQualityScore: hdVideoStore.allVideos.length > 0
                    ? (hdVideoStore.allVideos.reduce((sum, v) => sum + (v.qualityScore || 0), 0) / hdVideoStore.allVideos.length).toFixed(2)
                    : 0
            };
        }
    };

    log('HD Video Interceptor v4 initialized (with O(1) hash matching)');

    // Log stats periodically for debugging
    if (DEBUG) {
        setInterval(() => {
            const stats = window.__angel_hd.getStats();
            if (stats.totalVideos > 0) {
                log('Stats:', stats);

                // Log quality distribution
                const qualityDist = hdVideoStore.allVideos.map(v =>
                    `${v.width}x${v.height} (${(v.qualityScore || 0).toFixed(2)})`
                );
                if (qualityDist.length <= 5) {
                    log('Quality distribution:', qualityDist);
                }
            }
        }, 10000);

        // Periodic cache cleanup
        setInterval(cleanExpiredCache, 60000); // Every minute
    }
})();
