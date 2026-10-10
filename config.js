/**
 * ==============================================================================
 * LOCAL WALLY HUD - HUMAN-READABLE EXTERNAL CONFIGURATION
 * ==============================================================================
 * This configuration file is loaded into the browser/WebView2 window before all
 * other scripts. You can freely edit any setting below using any text editor.
 * Changes take effect upon saving and refreshing wallpaper / restarting Lively.
 * ==============================================================================
 */

(function(global) {
  'use strict';

  global.LOCAL_WALLY_CONFIG = {
    // --------------------------------------------------------------------------
    // 1. DATA CACHE & WALLPAPER REFRESH INTERVAL
    // --------------------------------------------------------------------------
    // Frequency (in minutes) for fetching live weather, air quality, news, and wallpaper.
    // Default: 15 | Valid Range: 5 to 30 minutes (enforced by CacheManager firewall)
    refreshIntervalMinutes: 15,

    // --------------------------------------------------------------------------
    // 2. HUD SCREEN POSITION & DESKTOP ICON AVOIDANCE
    // --------------------------------------------------------------------------
    // Position of the Bento HUD on your desktop display.
    // Default: 'top-right' | Options: 'top-right', 'top-left', 'bottom-right', 'bottom-left'
    // 'top-right' keeps Windows desktop icons on the left 100% unobstructed.
    hudPosition: 'top-right',

    // --------------------------------------------------------------------------
    // 3. FROSTED GLASS ACRYLIC BLUR (PX)
    // --------------------------------------------------------------------------
    // Background backdrop blur radius in pixels for the Windows 11 Acrylic / Mica glass.
    // Default: 14 | Valid Range: 0 (clear) to 40 (ultra-soft frosted)
    glassBlurPx: 14,

    // --------------------------------------------------------------------------
    // 4. FROSTED GLASS SATURATION VIBRANCY (%)
    // --------------------------------------------------------------------------
    // Color saturation boost percentage for the glass backdrop filter.
    // Default: 190 | Valid Range: 100% (natural) to 250% (deep vivid vibrancy)
    glassSaturationPct: 190,

    // --------------------------------------------------------------------------
    // 5. TEMPERATURE UNIT DISPLAY
    // --------------------------------------------------------------------------
    // Unit system for temperature telemetry in the Bento HUD.
    // Default: 'C' | Options: 'C' (Celsius) or 'F' (Fahrenheit)
    tempUnit: 'C',

    // --------------------------------------------------------------------------
    // 6. REGIONAL NEWS TICKER ROTATION CADENCE
    // --------------------------------------------------------------------------
    // Interval (in seconds) between automatic rotating carousel transitions for news headlines.
    // Default: 7 | Valid Range: 3 to 60 seconds
    newsRotateIntervalSeconds: 7,

    // --------------------------------------------------------------------------
    // 7. HARDWARE TELEMETRY UPDATE CADENCE
    // --------------------------------------------------------------------------
    // Frequency (in seconds) for hardware fallback simulation updates (CPU/GPU/RAM/Disk).
    // Default: 10 | Valid Range: 1 to 60 seconds
    hwUpdateIntervalSeconds: 10,

    // --------------------------------------------------------------------------
    // 8. UNSPLASH DEVELOPER API ACCESS KEY (OPTIONAL)
    // --------------------------------------------------------------------------
    // Custom Unsplash API Access Key for unlimited live contextual landscape photo queries.
    // Default: '' (When empty, high-res curated CDN photography is utilized with zero API keys)
    unsplashApiKey: '',

    // --------------------------------------------------------------------------
    // 9. MAXIMUM PROCEDURAL PRECIPITATION PARTICLES
    // --------------------------------------------------------------------------
    // Upper memory pool limit for rain/snow particles in the Canvas 2D particle engine.
    // Default: 1800 | Valid Range: 200 (low-spec) to 3500 (high-end GPU)
    maxPrecipitationParticles: 1800,

    // --------------------------------------------------------------------------
    // 10. PRIMARY CORS GATEWAY PROXY
    // --------------------------------------------------------------------------
    // Primary proxy endpoint used to bypass cross-origin restrictions for Google News RSS.
    // Default: 'https://api.allorigins.win/raw?url='
    primaryCorsProxy: 'https://api.allorigins.win/raw?url=',

    // --------------------------------------------------------------------------
    // 11. FALLBACK CORS GATEWAY PROXY
    // --------------------------------------------------------------------------
    // Secondary fallback proxy endpoint utilized if the primary proxy experiences a timeout or error.
    // Default: 'https://corsproxy.io/?url='
    fallbackCorsProxy: 'https://corsproxy.io/?url=',

    // --------------------------------------------------------------------------
    // 12. DEFAULT GEOGRAPHIC COORDINATES & LOCATION
    // --------------------------------------------------------------------------
    // Default location fallback used when HTML5 GPS and IP geolocation are unavailable or offline.
    // Default: Tokyo, Japan (latitude: 35.6762, longitude: 139.6503)
    defaultLocation: {
      city: 'Tokyo',
      country: 'Japan',
      latitude: 35.6762,
      longitude: 139.6503
    },

    // --------------------------------------------------------------------------
    // 13. WALLPAPER-ADAPTIVE CONTRAST & THEME
    // --------------------------------------------------------------------------
    // Dynamic wallpaper contrast detection for the Bento HUD layout.
    // 'auto': Dynamically samples image luminance directly behind the HUD and
    //         switches to high-contrast dark typography and frosted white acrylic
    //         when on bright/white backgrounds (e.g. snow, high-key skies).
    // 'dark': Locks to dark acrylic glass with crisp white typography.
    // 'light': Locks to frosted white acrylic glass with dark slate typography.
    // Default: 'auto' | Options: 'auto', 'dark', 'light'
    contrastMode: 'auto'
  };
})(typeof window !== 'undefined' ? window : this);
