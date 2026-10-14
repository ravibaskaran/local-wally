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
    // Default: 'top-right' | Options: 'top-right', 'top-left', 'bottom-right', 'bottom-left', 'middle-right', 'middle-left', 'middle-top', 'middle-bottom', 'center'
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
    // 8. WALLPAPER PROVIDER & ACCESS KEYS
    // --------------------------------------------------------------------------
    // Provider used for background wallpaper photography.
    // Default: 'unsplash' | Options: 'unsplash', 'wallhaven', 'pexels', 'pixabay', 'rotate'
    wallpaperProvider: 'unsplash',

    // Custom Unsplash API Access Key for unlimited live contextual landscape photo queries.
    // Default: '' (When empty, high-res curated CDN photography is utilized with zero API keys)
    unsplashApiKey: '',

    // Custom Wallhaven API Key (optional/blank by default)
    wallhavenApiKey: '',

    // Custom Pexels API Key (optional/blank by default)
    pexelsApiKey: '',

    // Custom Pixabay API Key (optional/blank by default)
    pixabayApiKey: '',

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
    // MIDDLE CORS GATEWAY PROXY
    // --------------------------------------------------------------------------
    // Second proxy tried between the primary and fallback gateways before the
    // Google News RSS chain gives up (v0.8.4). Comment out or override here to
    // swap gateways without touching js/api.js.
    // Default: 'https://api.codetabs.com/v1/proxy?quest='
    middleCorsProxy: 'https://api.codetabs.com/v1/proxy?quest=',

    // --------------------------------------------------------------------------
    // 11. FALLBACK CORS GATEWAY PROXY
    // --------------------------------------------------------------------------
    // Secondary fallback proxy endpoint utilized if the primary proxy experiences a timeout or error.
    // Default: 'https://corsproxy.io/?'
    fallbackCorsProxy: 'https://corsproxy.io/?',

    // --------------------------------------------------------------------------
    // 12. DEFAULT GEOGRAPHIC COORDINATES & LOCATION
    // --------------------------------------------------------------------------
    // Default location fallback used when HTML5 GPS and IP geolocation are unavailable or offline.
    // Default: Tokyo, Japan (latitude: 35.6762, longitude: 139.6503)
    defaultLocation: {
      city: 'Tokyo',
      country: 'Japan',
      countryCode: 'JP',
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
    // 14b. PRODUCTIVITY FOCUS TIMER MODE
    // --------------------------------------------------------------------------
    // Default focus timer methodology:
    // 'pomodoro': Classic 25m Focus / 5m Break (with long break every 4 cycles)
    // 'fiftytwo': 52/17 Rule (52m Focus / 17m Rest)
    // 'ultradian': Ultradian Rhythm (90m Peak Focus / 20m Renewal Break)
    // 'flowtime': Flowtime Stopwatch (Count-up deep work with proportional break)
    // Default: 'pomodoro' | Options: 'pomodoro', 'fiftytwo', 'ultradian', 'flowtime'
    focusTimerMode: 'pomodoro',

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
    // 20. REGIONAL NEWS DISPATCH BLOCK DISPLAY & PROVIDER
    // --------------------------------------------------------------------------
    // Toggles the regional news block in the secondary column.
    // When false, the news carousel timer is halted (0% CPU) and the hardware
    // monitor expands to occupy the secondary Bento column.
    // Default: true | Options: true, false
    showNewsFeed: true,

    // Regional News Provider
    // Default: 'auto' | Options: 'auto' (API keys first: Currents -> NewsAPI -> Google News),
    // 'google-news', 'newsapi', 'currents', 'rotate'
    newsProvider: 'auto',

    // Custom NewsAPI key (optional/blank by default)
    newsApiKey: '',

    // Custom Currents News API key (optional/blank by default)
    currentsApiKey: '',

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
    showMediaPlayer: true,

    // --------------------------------------------------------------------------
    // 27. NETWORK BANDWIDTH USAGE TELEMETRY DISPLAY (NET DOWN & NET UP)
    // --------------------------------------------------------------------------
    // Toggles the Download and Upload network bandwidth rows in the hardware monitor.
    // Includes auto-scaling human-relatable units (Kbps, Mbps, Gbps) and 40-point SVG sparklines.
    // Default: true | Options: true, false
    showNetworkUsage: true,

    // --------------------------------------------------------------------------
    // 28. LAPTOP BATTERY TELEMETRY DISPLAY
    // --------------------------------------------------------------------------
    // Toggles the laptop battery telemetry row (percentage, charging state, remaining time).
    // Automatically guarded: completely hidden on desktop PCs without battery hardware (0% DOM footprint).
    // Default: true | Options: true, false
    showBatteryInfo: true,

    // --------------------------------------------------------------------------
    // 29. WEATHER TELEMETRY PROVIDER
    // --------------------------------------------------------------------------
    // Provider used for atmospheric weather readings and hourly forecasts.
    // Default: 'open-meteo' | Options: 'open-meteo', 'met-norway', 'openweathermap'
    weatherProvider: 'open-meteo',

    // --------------------------------------------------------------------------
    // 30. OPENWEATHERMAP API KEY (OPTIONAL)
    // --------------------------------------------------------------------------
    // Custom OpenWeatherMap 2.5/3.0 API key for when 'openweathermap' provider is selected.
    // Default: '' (Falls back gracefully to Open-Meteo when empty or invalid)
    openweathermapApiKey: '',

    // --------------------------------------------------------------------------
    // 31. AIR QUALITY INDEX (AQI) PROVIDER
    // --------------------------------------------------------------------------
    // Provider used for air quality telemetry and particulate forecasts.
    // Default: 'open-meteo' | Options: 'open-meteo', 'waqi'
    aqiProvider: 'open-meteo',

    // --------------------------------------------------------------------------
    // 32. WAQI / AQICN API TOKEN (OPTIONAL)
    // --------------------------------------------------------------------------
    // Custom WAQI API token for when 'waqi' provider is selected.
    // Default: '' (Free tier demo token is used when empty)
    waqiApiKey: '',

    // --------------------------------------------------------------------------
    // 33. GOOGLE-STYLE MULTI-TAB SVG FORECAST CHART DISPLAY
    // --------------------------------------------------------------------------
    // Toggles the Google-style multi-tab SVG forecast chart HUD in the primary column.
    // Features zero-reflow layout containment (contain: layout paint;) and Catmull-Rom cubic Bezier curves.
    // Default: true | Options: true, false
    showForecastChart: true,

    // --------------------------------------------------------------------------
    // 34. DEFAULT FORECAST TAB SELECTION
    // --------------------------------------------------------------------------
    // Active metric tab displayed upon wallpaper initialization.
    // Default: 'temp' | Options: 'temp', 'feels_like', 'precip', 'wind', 'humidity', 'aqi'
    defaultForecastTab: 'temp',

    // --------------------------------------------------------------------------
    // 35. CUSTOM LOCATION OVERRIDE (OPTIONAL)
    // --------------------------------------------------------------------------
    // Custom city name or "lat, lon" coordinates overriding IP/GPS detection.
    // Default: '' (Uses automatic IP/GPS detection)
    customLocation: '',

    // --------------------------------------------------------------------------
    // 36. PARTICLE DENSITY MULTIPLIER
    // --------------------------------------------------------------------------
    // Multiplier for rain/snow particle density.
    // Default: 1.0 | Valid Range: 0.1 to 3.0
    particleDensity: 1.0,

    // --------------------------------------------------------------------------
    // 37. WEATHER SIMULATION MODE (TESTING ONLY)
    // --------------------------------------------------------------------------
    // Forces specific particle/sky rendering for testing.
    // 0 = Off (Live Weather), 1 = Rain, 2 = Snow, 3 = Thunderstorm, 4 = Clear
    weatherSimulation: 0
  };
})(typeof window !== 'undefined' ? window : this);
