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
    contrastMode: 'auto',

    // --------------------------------------------------------------------------
    // 14. MEDIA & FOCUS DOCK COMPANION HUD
    // --------------------------------------------------------------------------
    // Toggles the companion Bento Dock beneath the main weather HUD containing
    // the Pomodoro Focus Timer and Windows SMTC Media Player.
    // Default: true | Options: true, false
    showMediaFocusDock: true,

    // --------------------------------------------------------------------------
    // 15. POMODORO FOCUS DURATION (MINUTES)
    // --------------------------------------------------------------------------
    // Length in minutes for deep work focus sessions.
    // Default: 25 | Valid Range: 1 to 60 minutes
    pomodoroFocusMinutes: 25,

    // --------------------------------------------------------------------------
    // 16. POMODORO SHORT BREAK DURATION (MINUTES)
    // --------------------------------------------------------------------------
    // Length in minutes for short rest breaks between focus sessions.
    // Default: 5 | Valid Range: 1 to 30 minutes
    pomodoroBreakMinutes: 5,

    // --------------------------------------------------------------------------
    // 17. POMODORO LONG BREAK DURATION (MINUTES)
    // --------------------------------------------------------------------------
    // Length in minutes for extended rest breaks after 4 completed focus cycles.
    // Default: 15 | Valid Range: 1 to 60 minutes
    pomodoroLongBreakMinutes: 15,

    // --------------------------------------------------------------------------
    // 18. 60 FPS AUDIO SPECTRUM VISUALIZER
    // --------------------------------------------------------------------------
    // Renders real-time 32-band audio FFT telemetry onto the media card canvas.
    // Automatically enters zero-overhead 0% CPU sleep mode when audio is silent.
    // Default: true | Options: true, false
    enableAudioVisualizer: true,

    // --------------------------------------------------------------------------
    // 19. MACOS-STYLE DYNAMIC SOLAR LIGHTING & DIRECTIONAL SHADOWS
    // --------------------------------------------------------------------------
    // Computes celestial solar vector angles using SunCalc and dynamically updates
    // background chromatic filters, directional card drop shadows, and vignette angles.
    // Evaluated once per minute with smooth 3-second CSS transitions for 0% per-frame CPU.
    // Default: true | Options: true, false
    enableDynamicSolarLighting: true,

    // --------------------------------------------------------------------------
    // 20. REGIONAL NEWS DISPATCH BLOCK DISPLAY
    // --------------------------------------------------------------------------
    // Toggles the regional Google News RSS block in the secondary column.
    // When false, the news carousel timer is halted (0% CPU) and the hardware
    // monitor expands to occupy the secondary Bento column.
    // Default: true | Options: true, false
    showNewsFeed: true,

    // --------------------------------------------------------------------------
    // 21. HARDWARE SYSTEM TELEMETRY MONITOR DISPLAY
    // --------------------------------------------------------------------------
    // Toggles the CPU, GPU, RAM, and Disk hardware monitor block in the secondary column.
    // When false, the hardware simulation/poll timer is halted (0% CPU) and the news
    // dispatch block expands to occupy the secondary Bento column.
    // If BOTH showNewsFeed and showHardwareMonitor are false, the entire secondary
    // column collapses and the HUD transforms into a sleek single-column layout (~290px).
    // Default: true | Options: true, false
    showHardwareMonitor: true,

    // --------------------------------------------------------------------------
    // 22. SOLAR & LUNAR CELESTIAL EPHEMERIS CARD DISPLAY
    // --------------------------------------------------------------------------
    // Toggles the astronomical ephemeris card displaying Sunrise, Solar Noon, Sunset,
    // and live Moon phase glyph with illumination percentage.
    // Default: true | Options: true, false
    showCelestial: true,

    // --------------------------------------------------------------------------
    // 23. AIR QUALITY INDEX (AQI) CARD DISPLAY
    // --------------------------------------------------------------------------
    // Toggles the European Air Quality Index (AQI) telemetry card with colored
    // category dot, progress bar, and PM2.5 / PM10 particulate readings.
    // Default: true | Options: true, false
    showAqi: true,

    // --------------------------------------------------------------------------
    // 24. ENVIRONMENTAL METRICS 3-CARD ROW DISPLAY
    // --------------------------------------------------------------------------
    // Toggles the 3-column environmental metrics row displaying Relative Humidity (%),
    // Surface Wind Speed (km/h), and Precipitation accumulation (mm).
    // Default: true | Options: true, false
    showEnvironmentalMetrics: true,

    // --------------------------------------------------------------------------
    // 25. POMODORO FOCUS TIMER CARD DISPLAY
    // --------------------------------------------------------------------------
    // Toggles the interactive Pomodoro Focus Timer card in the companion Bento Dock.
    // When false, the Pomodoro interval ticker enters deep sleep (0% CPU) and the
    // Media Player card expands to occupy 100% of the companion dock width.
    // Default: true | Options: true, false
    showPomodoro: true,

    // --------------------------------------------------------------------------
    // 26. WINDOWS SMTC MEDIA PLAYER & VISUALIZER CARD DISPLAY
    // --------------------------------------------------------------------------
    // Toggles the Windows SMTC media player and 60 FPS audio visualizer card.
    // When false, the visualizer enters deep sleep (0% CPU/GPU) and the Pomodoro
    // Focus Timer expands to occupy 100% of the companion dock width.
    // If BOTH showPomodoro and showMediaPlayer are false, the entire companion dock
    // is cleanly hidden from view.
    // Default: true | Options: true, false
    showMediaPlayer: true
  };
})(typeof window !== 'undefined' ? window : this);
