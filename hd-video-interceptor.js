/**
 * ANGEL HD Video Interceptor v5
 *
 * Injected into page context to intercept ALL network traffic and proactively
 * fetch highest-quality video URLs from Instagram's internal APIs.
 *
 * Improvements in v5 (inspired by parth-dl multi-layer extraction):
 * - Active API fetching via i.instagram.com/api/v1/media/{id}/info/ with correct headers
 * - Shortcode → media_id conversion (same algorithm Instagram uses)
 * - Hook __additionalDataLoaded to capture data before it's processed
 * - Scan window._sharedData / __initialData on page load
 * - Instagram video type-field scoring (type 101 = 1080p, 102 = 720p, 103 = 480p)
 * - Carousel media traversal for multi-video posts
 * - Broader URL pattern matching (timeline, feed, stories, xdt_api)
 * - XHR readystatechange fallback in addition to load event
 * - Lower quality threshold to prevent filtering valid HD content
 * - O(1) hash-based URL matching for instant lookups
 * - Bitrate-aware quality scoring (not just resolution)
 * - LRU cache with TTL for better memory management
 * - Deep object traversal with circular reference detection
 */

(function () {
    'use strict';

    // Prevent double initialization with health check
    if (window.__ANGEL_HD_INTERCEPTOR__) {
        if (typeof window.__angel_hd !== 'undefined' && window.__angel_hd.getStats) {
            return;
        } else {
            // Cancel any leftover intervals from the previous instance
            if (window.__angel_hd?._intervals) {
                window.__angel_hd._intervals.forEach(id => clearInterval(id));
            }
        }
    }
    window.__ANGEL_HD_INTERCEPTOR__ = true;

    const DEBUG = false; // Set true only for local debugging; never commit true to production
    const log = (...args) => DEBUG && console.log('[ANGEL-HD]', ...args);

    // Configuration
    const CONFIG = {
        MAX_CACHE_SIZE: 200,
        CACHE_TTL: 15 * 60 * 1000,  // 15 minutes
        MIN_HD_WIDTH: 540,           // Lowered: catch 540p+ (Instagram often serves 720 as "HD")
        SEARCH_DEPTH: 14,            // Deep enough for IG payloads without walking entire app state
        MAX_RESPONSE_TEXT_BYTES: 3_000_000,
        MAX_VIDEO_RESULTS: 40,
        MAX_ARRAY_ITEMS_PER_LEVEL: 80,
        MAX_OBJECT_KEYS_PER_LEVEL: 140,
        QUALITY_SCORE_THRESHOLD: 0.3 // Much lower: don't filter out valid HD videos
    };

    // Instagram API headers (do NOT include Origin/Referer — causes rejection)
    const IG_API_HEADERS = {
        'X-IG-App-ID': '936619743392459',
        'X-ASBD-ID': '198387',
        'X-IG-WWW-Claim': '0',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9'
    };

    // Store for HD video URLs with multiple lookup keys and LRU cache
    const hdVideoStore = {
        byId: new Map(),        // media_id -> HD info
        byUrl: new Map(),       // URL fragment -> HD info
        byHash: new Map(),      // URL hash -> HD info (O(1) lookup)
        allVideos: [],          // All found HD videos with timestamps
        accessLog: new Map(),   // URL key -> last access time for LRU
        fetchAttempted: new Set(), // media_ids already fetched from API (avoid duplicates)
        pendingFetches: new Set()  // media_ids currently being fetched
    };

    const VIDEO_DATA_KEYS = new Set([
        'items',
        'item',
        'media',
        'medias',
        'reels',
        'reel',
        'clips',
        'clip',
        'edges',
        'edge_media_to_caption',
        'node',
        'shortcode_media',
        'xdt_shortcode_media',
        'video_versions',
        'video_dash_manifest',
        'carousel_media',
        'data',
        'user',
        'owner'
    ]);

    function getUrlString(input) {
        try {
            const url = input?.url || input || '';
            return typeof url === 'string' ? url : url.toString();
        } catch (e) {
            return '';
        }
    }

    function isRelevantInstagramVideoRequest(urlString) {
        if (!urlString) return false;

        try {
            const url = new URL(urlString, window.location.origin);
            const host = url.hostname;
            if (!/(\.|^)instagram\.com$/.test(host)) return false;

            const path = url.pathname.toLowerCase();
            const query = url.search.toLowerCase();

            if (path.includes('/graphql') || path.includes('/xdt_api/')) return true;
            if (path.includes('/api/v1/media/')) return true;
            if (path.includes('/api/v1/clips/') || path.includes('/api/v1/feed/reels')) return true;
            if (path.includes('/api/v1/feed/user/') && query.includes('reel')) return true;
            if (path.includes('/api/v1/stories/') || path.includes('/api/v1/highlights/')) return true;

            // Keep broad discovery only when the request itself advertises video-ish data.
            return query.includes('video') || query.includes('clips') || query.includes('reels');
        } catch (e) {
            return /\/graphql|\/xdt_api\/|\/api\/v1\/media\/.*\/info|\/api\/v1\/clips\/|\/api\/v1\/stories\/|video|reels|clips/i.test(urlString);
        }
    }

    function hasJsonResponseHeaders(response) {
        try {
            const contentType = response.headers?.get?.('content-type') || '';
            return !contentType || /json|javascript|text\/plain/i.test(contentType);
        } catch (e) {
            return true;
        }
    }

    function isResponseTooLarge(response) {
        try {
            const contentLength = Number(response.headers?.get?.('content-length') || 0);
            return contentLength > CONFIG.MAX_RESPONSE_TEXT_BYTES;
        } catch (e) {
            return false;
        }
    }

    function shouldScanKey(key) {
        if (!key) return true;
        if (key === 'extensions' || key === 'errors' || key === '__typename') return false;
        if (VIDEO_DATA_KEYS.has(key)) return true;
        return /video|media|reel|clip|story|carousel|shortcode|dash|item|node|edge/i.test(key);
    }

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
     * Convert Instagram shortcode to media_id (same algorithm Instagram uses).
     * Shortcode is the Base64-like identifier in reel/p URLs: /reel/ABC123xyz/
     * Inspired by: https://github.com/parthmax2/parth-dl
     */
    function shortcodeToMediaId(shortcode) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        try {
            let mediaId = BigInt(0);
            for (const char of shortcode) {
                const idx = alphabet.indexOf(char);
                if (idx === -1) return null;
                mediaId = mediaId * BigInt(64) + BigInt(idx);
            }
            return mediaId.toString();
        } catch (e) {
            // Fallback for environments without BigInt
            let mediaId = 0;
            for (const char of shortcode) {
                mediaId = mediaId * 64 + alphabet.indexOf(char);
            }
            return String(mediaId);
        }
    }

    /**
     * Extract shortcode from current page URL.
     * Handles /reel/CODE/, /p/CODE/, /reels/CODE/ patterns.
     */
    function getCurrentShortcode() {
        const path = window.location.pathname;
        const match = path.match(/\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/);
        if (!match) return null;
        const code = match[1];
        // Instagram shortcodes are at most 11 characters; reject anything abnormal
        // to prevent unbounded BigInt iteration on adversarial input.
        if (code.length > 11) return null;
        return code;
    }

    /**
     * Actively fetch HD info from Instagram's internal media API.
     * Uses the same App-ID header that Instagram's own web app uses.
     * Rate-limited: skips media_ids that were already fetched.
     */
    async function fetchHDFromMediaId(mediaId) {
        if (!mediaId) return;
        const idStr = String(mediaId);

        if (hdVideoStore.fetchAttempted.has(idStr)) return;
        if (hdVideoStore.pendingFetches.has(idStr)) return;
        if (hdVideoStore.byId.has(idStr)) return; // Already cached

        hdVideoStore.pendingFetches.add(idStr);

        try {
            const apiUrl = `https://i.instagram.com/api/v1/media/${idStr}/info/`;
            log('Proactively fetching HD for media:', idStr);

            const response = await originalFetch(apiUrl, {
                method: 'GET',
                headers: IG_API_HEADERS,
                credentials: 'include'
            });

            hdVideoStore.fetchAttempted.add(idStr);

            if (!response.ok) {
                log('API fetch failed for media:', idStr, 'status:', response.status);
                return;
            }

            const data = await response.json();
            const videoItems = findVideoData(data);

            if (videoItems.length > 0) {
                log('Active API fetch found', videoItems.length, 'video(s) for media:', idStr);
                processVideoData(videoItems);
            } else {
                log('Active API fetch: no video data in response for media:', idStr);
            }
        } catch (e) {
            log('Active API fetch error for media:', idStr, '-', e.message);
        } finally {
            hdVideoStore.pendingFetches.delete(idStr);
        }
    }

    /**
     * Trigger proactive HD fetch for the current reel page.
     * Converts shortcode → media_id and fetches from API if not already cached.
     */
    function proactiveHDFetch() {
        try {
            const shortcode = getCurrentShortcode();
            if (!shortcode) return;

            const mediaId = shortcodeToMediaId(shortcode);
            if (mediaId && !hdVideoStore.byId.has(mediaId)) {
                log('Proactive fetch triggered for shortcode:', shortcode, '→ media_id:', mediaId);
                fetchHDFromMediaId(mediaId);
            }
        } catch (e) {
            log('Proactive fetch error:', e.message);
        }
    }

    /**
     * Scan page-embedded Instagram JSON data for video URLs.
     * Instagram embeds data into window._sharedData, __initialData, etc.
     */
    function scanPageForEmbeddedData() {
        const candidates = [
            () => window._sharedData,
            () => window.__initialData,
            () => window.__additionalData,
            () => window.__bootData
        ];

        for (const getter of candidates) {
            try {
                const data = getter();
                if (data && typeof data === 'object') {
                    const items = findVideoData(data);
                    if (items.length > 0) {
                        log('Found', items.length, 'video(s) in page-embedded data');
                        processVideoData(items);
                    }
                }
            } catch (e) {
                // Some accessors may throw - silently continue
            }
        }
    }

    /**
     * Traverse React fiber tree on a video element looking for Instagram CDN URLs.
     * Works without any API call — reads data already in React's in-memory state.
     */
    function extractFromReactFiber(videoEl) {
        if (!videoEl) return null;
        try {
            const fiberKey = Object.keys(videoEl).find(k =>
                k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
            );
            if (!fiberKey) return null;

            const visited = new WeakSet();

            function isInstagramCdnUrl(v) {
                return typeof v === 'string' &&
                    v.startsWith('https://') &&
                    (v.includes('cdninstagram.com') || v.includes('fbcdn.net'));
            }

            function searchObject(obj, depth) {
                if (!obj || typeof obj !== 'object' || depth > 6) return null;
                if (visited.has(obj)) return null;
                visited.add(obj);

                if (Array.isArray(obj)) {
                    // Sort by resolution desc so we pick highest-quality version
                    const urls = obj
                        .filter(item => item && typeof item === 'object' && isInstagramCdnUrl(item.url))
                        .sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)));
                    if (urls.length > 0) return { url: urls[0].url, width: urls[0].width, height: urls[0].height };
                    for (const item of obj) {
                        const found = searchObject(item, depth + 1);
                        if (found) return found;
                    }
                    return null;
                }

                // Check well-known string fields first (fast path)
                const stringFields = ['video_url', 'videoUrl', 'videoSrc', 'clipsSrc', 'originalSrc', 'src'];
                for (const f of stringFields) {
                    if (isInstagramCdnUrl(obj[f])) return { url: obj[f] };
                }

                // Check well-known array fields (video_versions style)
                const arrayFields = ['video_versions', 'videoVersions', 'sources', 'bitrates'];
                for (const f of arrayFields) {
                    if (Array.isArray(obj[f])) {
                        const found = searchObject(obj[f], depth + 1);
                        if (found) return found;
                    }
                }

                return null;
            }

            let fiber = videoEl[fiberKey];
            for (let i = 0; i < 60 && fiber; i++) {
                try {
                    const props = fiber.memoizedProps;
                    if (props && typeof props === 'object') {
                        const found = searchObject(props, 0);
                        if (found) {
                            log('ReactFiber found CDN URL at fiber depth', i);
                            return found;
                        }
                    }
                } catch (e) { /* deliberately swallow per-fiber errors */ }
                fiber = fiber.return;
            }
        } catch (e) {
            log('extractFromReactFiber error:', e.message);
        }
        return null;
    }

    /**
     * Scan all <video> elements on the page for a playable Instagram CDN URL
     * via React fiber traversal. Returns first match found.
     */
    function tryReactFiberExtractionForPage() {
        try {
            const videos = document.querySelectorAll('video');
            for (const video of videos) {
                const result = extractFromReactFiber(video);
                if (result?.url) return result;
            }
        } catch (e) {
            log('tryReactFiberExtractionForPage error:', e.message);
        }
        return null;
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
            if (results.length >= CONFIG.MAX_VIDEO_RESULTS) return results;
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

            // v5: Handle carousel_media (multi-video posts)
            if (Array.isArray(obj.carousel_media) && obj.carousel_media.length > 0) {
                try {
                    for (const item of obj.carousel_media) {
                        if (item && Array.isArray(item.video_versions) && item.video_versions.length > 0) {
                            const itemMediaId = item.id || item.pk || null;
                            const hasHD = item.video_versions.some(v => (v.width || 0) >= CONFIG.MIN_HD_WIDTH);
                            if (hasHD) {
                                results.push({
                                    versions: item.video_versions,
                                    dashManifest: item.video_dash_manifest || null,
                                    mediaId: itemMediaId,
                                    code: item.code || null,
                                    duration: item.video_duration || null
                                });
                            }
                        }
                    }
                } catch (e) {
                    log('Error processing carousel_media:', e);
                }
            }

            // Recurse into arrays and objects
            try {
                if (Array.isArray(obj)) {
                    const limit = Math.min(obj.length, CONFIG.MAX_ARRAY_ITEMS_PER_LEVEL);
                    for (let i = 0; i < limit && results.length < CONFIG.MAX_VIDEO_RESULTS; i++) {
                        try {
                            findVideoData(obj[i], results, depth + 1, visited);
                        } catch (e) {
                            // Continue processing other items
                        }
                    }
                } else {
                    const keys = Object.keys(obj);
                    const priorityKeys = keys.filter(shouldScanKey);
                    const usePriorityKeys = priorityKeys.length > 0;
                    const scanKeys = usePriorityKeys ? priorityKeys : keys;
                    const limit = Math.min(scanKeys.length, CONFIG.MAX_OBJECT_KEYS_PER_LEVEL);
                    for (let i = 0; i < limit && results.length < CONFIG.MAX_VIDEO_RESULTS; i++) {
                        const key = scanKeys[i];
                        try {
                            if (obj.hasOwnProperty(key) && (usePriorityKeys ? shouldScanKey(key) : key !== 'extensions' && key !== 'errors')) {
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
     * Calculate quality score for a video based on multiple factors.
     * v5: Adds Instagram API type-field scoring (type 101 = highest quality).
     */
    function calculateQualityScore(version) {
        const width = version.width || 0;
        const height = version.height || 0;
        const resolution = width * height;

        // Normalize resolution (1080p = 1.0, 4K = ~4.0)
        const resolutionScore = Math.min(resolution / (1920 * 1080), 4.0);

        // Extract bitrate from URL patterns (e.g., "5000k" or "_br5000_")
        let bitrateScore = 0;
        if (version.url) {
            const bitrateMatch = version.url.match(/(?:_br|\/)([0-9]+)k/i) ||
                version.url.match(/[\/_](\d{4,})(?:[\/_.]|$)/);
            if (bitrateMatch) {
                const bitrate = parseInt(bitrateMatch[1], 10);
                bitrateScore = Math.min(bitrate / 5000, 1.5);
            }
        }

        // Bandwidth from DASH manifest if available
        if (version.bandwidth) {
            const bwMbps = version.bandwidth / (1024 * 1024);
            bitrateScore = Math.max(bitrateScore, Math.min(bwMbps / 5, 1.5));
        }

        // v5: Instagram API type field (101 = 1080p best, 102 = 720p, 103 = 480p lowest)
        // This is the most reliable quality indicator when available
        let typeScore = 0;
        if (version.type !== undefined) {
            if (version.type === 101) typeScore = 1.0;      // Highest quality (1080p)
            else if (version.type === 102) typeScore = 0.6; // Medium quality (720p)
            else if (version.type === 3)   typeScore = 0.4; // Alternate format
            else if (version.type === 103) typeScore = 0.2; // Lowest quality (480p)
        }

        // URL-based quality hints
        let urlScore = 0;
        if (version.url) {
            const url = version.url.toLowerCase();
            if (url.includes('1080p') || url.includes('fhd')) urlScore = 0.5;
            if (url.includes('4k') || url.includes('uhd')) urlScore = 1.0;
            if (url.includes('720p')) urlScore = 0.3;
            if (url.includes('scontent')) urlScore += 0.1; // scontent CDN = higher quality
            if (!url.includes('preview') && !url.includes('thumb')) urlScore += 0.1;
        }

        // If type field is present, use it as primary (50%), else resolution-dominant
        if (typeScore > 0) {
            return (typeScore * 0.5) + (resolutionScore * 0.3) + (bitrateScore * 0.1) + (urlScore * 0.1);
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
     * Parse DASH manifest for highest quality with codec awareness.
     * v5: Handles relative BaseURL by resolving against current page origin.
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

                // v5: Resolve relative BaseURL against current origin
                let resolvedUrl = baseUrl.textContent.trim();
                if (resolvedUrl && !resolvedUrl.startsWith('http') && !resolvedUrl.startsWith('//')) {
                    try { resolvedUrl = new URL(resolvedUrl, window.location.origin).href; } catch (e) {}
                }

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
                        url: resolvedUrl,
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
            downloadUrl: hdInfo.downloadUrl || hdInfo.url,
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
            const versionVideo = getHighestQuality(item.versions);
            let hdVideo = versionVideo;

            if (hdVideo) {
                hdVideo.source = 'versions';
                hdVideo.downloadUrl = hdVideo.url;
            }

            // Check DASH manifest for potentially higher quality
            if (item.dashManifest) {
                const dashVideo = parseDASHManifest(item.dashManifest);
                if (dashVideo) {
                    // Compare quality scores if available
                    const dashScore = dashVideo.qualityScore || calculateQualityScore(dashVideo);
                    const versionsScore = hdVideo ? (hdVideo.qualityScore || calculateQualityScore(hdVideo)) : 0;

                    if (dashScore > versionsScore) {
                        hdVideo = {
                            ...dashVideo,
                            downloadUrl: versionVideo?.url || dashVideo.url
                        };
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

                    if (!hdVideo.downloadUrl) {
                        hdVideo.downloadUrl = versionVideo?.url || allVersionUrls[0] || hdVideo.url;
                    }

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
            const urlString = getUrlString(args[0]);

            if (isRelevantInstagramVideoRequest(urlString) && hasJsonResponseHeaders(response) && !isResponseTooLarge(response)) {
                try {
                    const clone = response.clone();

                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Response parsing timeout')), 2500)
                    );

                    Promise.race([clone.text(), timeoutPromise])
                        .then(text => {
                            try {
                                if (!text || text.length > CONFIG.MAX_RESPONSE_TEXT_BYTES) return;
                                const trimmed = text.trim();
                                if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return;

                                const data = JSON.parse(trimmed);
                                const videoItems = findVideoData(data);

                                if (videoItems.length > 0) {
                                    log('Fetch intercepted', videoItems.length, 'videos from:', urlString.substring(0, 60));
                                    processVideoData(videoItems);
                                }

                                // v5: If we see a media_id in the response but no video,
                                // proactively fetch its HD version from the API
                                if (videoItems.length === 0 && data) {
                                    const mediaIdHint = extractFirstMediaId(data);
                                    if (mediaIdHint) fetchHDFromMediaId(mediaIdHint);
                                }
                            } catch (parseError) {
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
     * Intercept XMLHttpRequest with improved error handling.
     * v5: Also listen on readystatechange for partial responses.
     */
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        try {
            this._angelUrl = url;
        } catch (e) {}
        return originalXHROpen.apply(this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.send = function (...args) {
        const xhrHandler = function () {
            try {
                if (this.readyState !== 4) return; // Only process completed responses
                const url = this._angelUrl || '';

                if (isRelevantInstagramVideoRequest(url) && this.responseText && this.responseText.length <= CONFIG.MAX_RESPONSE_TEXT_BYTES) {
                    try {
                        const trimmed = this.responseText.trim();
                        if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return;

                        const data = JSON.parse(trimmed);
                        const videoItems = findVideoData(data);

                        if (videoItems.length > 0) {
                            log('XHR intercepted', videoItems.length, 'videos');
                            processVideoData(videoItems);
                        } else {
                            // v5: Proactive fetch if we see a media_id but no video
                            const mediaIdHint = extractFirstMediaId(data);
                            if (mediaIdHint) fetchHDFromMediaId(mediaIdHint);
                        }
                    } catch (parseError) {
                        if (DEBUG) log('XHR JSON parse error (non-critical):', parseError.message);
                    }
                }
            } catch (e) {
                if (DEBUG) log('XHR intercept error (non-critical):', e.message);
            }
        };

        try {
            // Use readystatechange as it fires earlier than 'load'
            this.addEventListener('readystatechange', xhrHandler);
        } catch (e) {
            log('Error adding XHR event listener:', e);
        }

        return originalXHRSend.apply(this, args);
    };

    /**
     * v5: Extract first plausible media_id from a parsed JSON object.
     * Used for proactive API fetch when video_versions is absent.
     */
    function extractFirstMediaId(obj, depth = 0, visited = new WeakSet()) {
        if (!obj || typeof obj !== 'object' || depth > 8) return null;
        if (visited.has(obj)) return null;
        visited.add(obj);

        // Direct fields
        const direct = obj.pk || obj.media_id || obj.media_pk;
        if (direct && /^\d{8,}$/.test(String(direct))) return String(direct);

        if (Array.isArray(obj)) {
            for (const item of obj) {
                const id = extractFirstMediaId(item, depth + 1, visited);
                if (id) return id;
            }
        } else {
            for (const key of Object.keys(obj)) {
                if (key === 'extensions' || key === 'errors') continue;
                const id = extractFirstMediaId(obj[key], depth + 1, visited);
                if (id) return id;
            }
        }
        return null;
    }

    /**
     * Hook window.__additionalDataLoaded — Instagram calls this function
     * to pass media data that has been loaded asynchronously.
     * By overriding it we capture reel data before Instagram processes it.
     */
    (function hookAdditionalDataLoaded() {
        try {
            const originalFn = window.__additionalDataLoaded;
            Object.defineProperty(window, '__additionalDataLoaded', {
                configurable: true,
                set(fn) {
                    // Instagram sometimes sets this AFTER our script runs
                    const wrapped = function (key, data) {
                        try {
                            if (data && typeof data === 'object') {
                                const items = findVideoData(data);
                                if (items.length > 0) {
                                    log('Captured', items.length, 'video(s) from __additionalDataLoaded');
                                    processVideoData(items);
                                }
                            }
                        } catch (e) {}
                        return fn.apply(this, arguments);
                    };
                    Object.defineProperty(window, '__additionalDataLoaded', {
                        configurable: true,
                        writable: true,
                        value: wrapped
                    });
                },
                get() { return undefined; }
            });

            // Also wrap if it already exists
            if (typeof originalFn === 'function') {
                window.__additionalDataLoaded = function (key, data) {
                    try {
                        if (data && typeof data === 'object') {
                            const items = findVideoData(data);
                            if (items.length > 0) {
                                log('Captured', items.length, 'video(s) from existing __additionalDataLoaded');
                                processVideoData(items);
                            }
                        }
                    } catch (e) {}
                    return originalFn.apply(this, arguments);
                };
            }
        } catch (e) {
            log('Could not hook __additionalDataLoaded:', e.message);
        }
    })();

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

        // v5: Trigger proactive API fetch for a specific shortcode
        requestHDForShortcode: function (shortcode) {
            try {
                if (!shortcode) return false;
                const mediaId = shortcodeToMediaId(shortcode);
                if (mediaId) {
                    fetchHDFromMediaId(mediaId);
                    return true;
                }
            } catch (e) {
                log('requestHDForShortcode error:', e);
            }
            return false;
        },

        // v5: Trigger proactive API fetch for current URL shortcode
        fetchCurrentPageHD: function () {
            proactiveHDFetch();
        },

        // Prefetch HD for upcoming videos
        prefetchForVideos: function (videoUrls) {
            if (!Array.isArray(videoUrls)) return;

            let prefetched = 0;
            for (const url of videoUrls.slice(0, 3)) { // Limit to 3
                const urlHash = hashUrl(url);
                if (urlHash && !hdVideoStore.byHash.has(urlHash)) {
                    // Extract media ID from CDN URL (Instagram embeds it as 10+ digit numeric segment)
                    const numMatch = url.match(/\/(\d{10,})(?:_|\.|\/)/);
                    if (numMatch) {
                        const mediaId = numMatch[1];
                        if (!hdVideoStore.byId.has(mediaId) && !hdVideoStore.fetchAttempted.has(mediaId)) {
                            log('Prefetching HD for media:', mediaId);
                            fetchHDFromMediaId(mediaId);
                            prefetched++;
                        }
                    }
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

    function findHDForRequest(videoUrl, shortcode) {
        try {
            if (shortcode) {
                const mediaId = shortcodeToMediaId(shortcode);
                const byId = mediaId ? hdVideoStore.byId.get(mediaId) : null;
                if (byId?.url) return byId;

                for (let i = hdVideoStore.allVideos.length - 1; i >= 0; i--) {
                    const item = hdVideoStore.allVideos[i];
                    if (item?.url && item.code === shortcode) return item;
                }
            }

            if (videoUrl) {
                const byUrl = window.__angel_hd.getHDForUrl(videoUrl);
                if (byUrl?.url) return byUrl;
            }

            const currentShortcode = getCurrentShortcode();
            if (currentShortcode && (!shortcode || shortcode === currentShortcode)) {
                const mediaId = shortcodeToMediaId(currentShortcode);
                const byCurrentId = mediaId ? hdVideoStore.byId.get(mediaId) : null;
                if (byCurrentId?.url) return byCurrentId;
            }

            const latest = window.__angel_hd.getLatestHD();
            if (latest?.url && Date.now() - latest.timestamp < 30000) return latest;
        } catch (e) {
            log('findHDForRequest error:', e);
        }

        return null;
    }

    window.addEventListener('angel-hd-request', (event) => {
        try {
            const detail = event.detail || {};
            const requestId = detail.requestId;
            if (!requestId) return;

            const shortcode = detail.shortcode || getCurrentShortcode();
            let hdInfo = findHDForRequest(detail.videoUrl, shortcode);

            // Fallback: try reading the URL directly from React's in-memory state
            if (!hdInfo?.url) {
                const fiberResult = tryReactFiberExtractionForPage();
                if (fiberResult?.url) {
                    log('angel-hd-request: ReactFiber provided URL, storing');
                    hdInfo = { url: fiberResult.url, width: fiberResult.width, height: fiberResult.height, timestamp: Date.now(), source: 'fiber' };
                    // Emit as angel-hd-video so content.js caches it too
                    window.dispatchEvent(new CustomEvent('angel-hd-video', { detail: hdInfo }));
                }
            }

            if (!hdInfo?.url && shortcode) {
                window.__angel_hd.requestHDForShortcode(shortcode);
            }

            window.dispatchEvent(new CustomEvent('angel-hd-response', {
                detail: {
                    requestId,
                    hdInfo: hdInfo || null
                }
            }));
        } catch (e) {
            log('angel-hd-request error:', e);
        }
    });

    log('HD Video Interceptor v5 initialized (proactive API + __additionalDataLoaded hook)');

    // Scan page for embedded video data at startup
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            scanPageForEmbeddedData();
            proactiveHDFetch();
        });
    } else {
        // Page already loaded
        scanPageForEmbeddedData();
        proactiveHDFetch();
    }

    // Re-run proactive fetch on SPA navigation — use history API hooks instead of
    // a 500ms poll so navigation is detected instantly with zero idle overhead.
    (function hookNavigation() {
        const _push = history.pushState;
        history.pushState = function (...args) {
            _push.apply(this, args);
            setTimeout(proactiveHDFetch, 100);
        };
        const _replace = history.replaceState;
        history.replaceState = function (...args) {
            _replace.apply(this, args);
            setTimeout(proactiveHDFetch, 100);
        };
        window.addEventListener('popstate', () => setTimeout(proactiveHDFetch, 100));
    })();

    // Store interval handles so they can be cancelled on re-init
    const _intervals = [];

    if (DEBUG) {
        _intervals.push(setInterval(() => {
            const stats = window.__angel_hd.getStats();
            if (stats.totalVideos > 0) {
                log('Stats:', stats);
                const qualityDist = hdVideoStore.allVideos.map(v =>
                    `${v.width}x${v.height} (${(v.qualityScore || 0).toFixed(2)})`
                );
                if (qualityDist.length <= 5) {
                    log('Quality distribution:', qualityDist);
                }
            }
        }, 10000));
    }

    _intervals.push(setInterval(cleanExpiredCache, 60000));

    // Expose handles so cleanup can cancel them on re-init
    window.__angel_hd._intervals = _intervals;
})();
