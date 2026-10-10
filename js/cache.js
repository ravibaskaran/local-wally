/**
 * CacheManager - Client-Side Caching Firewall
 * Enforces a configurable 5 to 30 minute TTL against localStorage.
 * Prevents redundant network egress, API rate-limiting, and battery drain.
 */
(function(global) {
  'use strict';

  var CACHE_KEY = 'LIVELY_HUD_SNAPSHOT';
  var TTL_PREF_KEY = 'LIVELY_HUD_TTL_MINUTES';
  var MIN_TTL_MINUTES = 5;
  var MAX_TTL_MINUTES = 30;
  var CONFIG_TTL = (global.LOCAL_WALLY_CONFIG && typeof global.LOCAL_WALLY_CONFIG.refreshIntervalMinutes === 'number')
    ? global.LOCAL_WALLY_CONFIG.refreshIntervalMinutes
    : 15;
  var DEFAULT_TTL_MINUTES = Math.min(MAX_TTL_MINUTES, Math.max(MIN_TTL_MINUTES, CONFIG_TTL));

  function getInitialTtlMinutes() {
    try {
      var saved = localStorage.getItem(TTL_PREF_KEY);
      if (saved != null) {
        var parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) {
          return Math.min(MAX_TTL_MINUTES, Math.max(MIN_TTL_MINUTES, parsed));
        }
      }
    } catch (e) {
      // Ignore quota/access errors
    }
    return DEFAULT_TTL_MINUTES;
  }

  var initialMinutes = getInitialTtlMinutes();

  var CacheManager = {
    TTL_MS: initialMinutes * 60 * 1000,
    ttlMinutes: initialMinutes,

    /**
     * Updates TTL interval in minutes (clamped between 5 and 30 minutes).
     * Persists user preference and dynamically updates TTL_MS.
     * @param {number} minutes
     * @returns {number} Active clamped minutes
     */
    setTtlMinutes: function(minutes) {
      var m = typeof minutes === 'number' ? minutes : parseInt(minutes, 10);
      if (isNaN(m)) m = DEFAULT_TTL_MINUTES;
      m = Math.min(MAX_TTL_MINUTES, Math.max(MIN_TTL_MINUTES, m));
      this.ttlMinutes = m;
      this.TTL_MS = m * 60 * 1000;
      try {
        localStorage.setItem(TTL_PREF_KEY, '' + m);
      } catch (e) {
        // Ignore quota/access errors
      }
      console.log('[CacheManager] TTL updated to ' + m + ' minutes (' + this.TTL_MS + ' ms)');
      return m;
    },

    /**
     * Returns active TTL in minutes
     * @returns {number}
     */
    getTtlMinutes: function() {
      return this.ttlMinutes;
    },

    /**
     * Retrieves valid cached snapshot if available and unexpired.
     * @returns {Object|null} Cached data payload or null on miss/expired
     */
    get: function() {
      try {
        var raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;

        var envelope = JSON.parse(raw);
        if (!envelope || typeof envelope.timestamp !== 'number' || !envelope.data) {
          this.clear();
          return null;
        }

        var age = Date.now() - envelope.timestamp;
        if (age < this.TTL_MS) {
          return envelope.data;
        }

        // Cache expired
        return null;
      } catch (err) {
        console.warn('[CacheManager] Error reading cache snapshot:', err);
        this.clear();
        return null;
      }
    },

    /**
     * Retrieves cached snapshot regardless of expiration (for offline emergency fallback)
     * @returns {Object|null}
     */
    getAny: function() {
      try {
        var raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        var envelope = JSON.parse(raw);
        return envelope && envelope.data ? envelope.data : null;
      } catch (e) {
        return null;
      }
    },

    /**
     * Atomically saves data payload with current timestamp
     * @param {Object} data
     * @returns {boolean} Success status
     */
    set: function(data) {
      try {
        var envelope = {
          timestamp: Date.now(),
          data: data
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(envelope));
        return true;
      } catch (err) {
        console.warn('[CacheManager] Failed to write to localStorage:', err);
        return false;
      }
    },

    /**
     * Checks if active cache has expired
     * @returns {boolean}
     */
    isExpired: function() {
      try {
        var raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return true;
        var envelope = JSON.parse(raw);
        if (!envelope || typeof envelope.timestamp !== 'number') return true;
        return (Date.now() - envelope.timestamp) >= this.TTL_MS;
      } catch (e) {
        return true;
      }
    },

    /**
     * Returns cache age in milliseconds
     * @returns {number}
     */
    getAgeMs: function() {
      try {
        var raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return Infinity;
        var envelope = JSON.parse(raw);
        return envelope && envelope.timestamp ? (Date.now() - envelope.timestamp) : Infinity;
      } catch (e) {
        return Infinity;
      }
    },

    /**
     * Returns remaining TTL in milliseconds
     * @returns {number}
     */
    getRemainingTtlMs: function() {
      var age = this.getAgeMs();
      var remaining = this.TTL_MS - age;
      return remaining > 0 ? remaining : 0;
    },

    /**
     * Clears cached snapshot
     */
    clear: function() {
      try {
        localStorage.removeItem(CACHE_KEY);
      } catch (e) {
        // Ignore quota/access errors
      }
    },

    /**
     * Realistic, curated mock data bundle for zero-network/offline launch
     * @returns {Object} Complete atmosphere state snapshot
     */
    getMockData: function() {
      var now = new Date();
      var hours = now.getHours();
      var isDay = hours >= 6 && hours < 19;

      var defaultLoc = (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.defaultLocation) || {};
      var defCity = defaultLoc.city || 'Tokyo';
      var defCountry = defaultLoc.country || 'Japan';
      var defLat = typeof defaultLoc.latitude === 'number' ? defaultLoc.latitude : 35.6762;
      var defLon = typeof defaultLoc.longitude === 'number' ? defaultLoc.longitude : 139.6503;

      return {
        timestamp: Date.now(),
        location: {
          city: defCity,
          region: 'Local Region',
          country: defCountry,
          latitude: defLat,
          longitude: defLon,
          isOffline: true
        },
        weather: {
          tempC: 21.5,
          tempF: 70.7,
          apparentC: 21.0,
          apparentF: 69.8,
          wmoCode: 1, // Mainly clear
          conditionText: 'Mainly Clear',
          humidity: 58,
          windSpeedKm: 12.4,
          windSpeedMph: 7.7,
          precipitationMm: 0.0,
          isDay: isDay ? 1 : 0,
          tempMaxC: 24.0,
          tempMinC: 16.0,
          tempMaxF: 75.2,
          tempMinF: 60.8
        },
        aqi: {
          europeanAqi: 22,
          category: 'Good',
          color: '#10b981', // Emerald green
          pm2_5: 8.4,
          pm10: 14.2
        },
        news: [
          { title: 'Global Tech & Atmospheric Science Summit Convenes', source: 'Reuters', link: 'https://news.google.com' },
          { title: 'Local Clean Energy Grid Expansion Begins Ahead of Schedule', source: 'Associated Press', link: 'https://news.google.com' },
          { title: 'High-Altitude Meteorological Sensors Reveal Seasonal Shift', source: 'Nature Weather', link: 'https://news.google.com' },
          { title: 'Regional Transport Network Modernization Nears Completion', source: 'Local Chronicle', link: 'https://news.google.com' },
          { title: 'Urban Greening Project Lowers City Temperature Index', source: 'Science Daily', link: 'https://news.google.com' }
        ],
        background: {
          url: '', // Clean fallback to celestial sky & procedural gradient
          photographer: 'Ambient Nature',
          photographerUrl: 'https://unsplash.com'
        }
      };
    }
  };

  global.CacheManager = CacheManager;
})(typeof window !== 'undefined' ? window : this);
