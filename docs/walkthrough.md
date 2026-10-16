# Local Wally HUD - Setup, Controls, and Configuration Walkthrough

This guide provides a comprehensive walkthrough for configuring, customizing, and troubleshooting **Local Wally HUD** on Windows 11 with [Lively Wallpaper](https://rocksdanister.github.io/lively/).

---

## Table of Contents
1. [First Launch and Location Cascade](#1-first-launch-and-location-cascade)
2. [Customizing Weather, Air Quality, News, and Wallpaper Providers](#2-customizing-weather-air-quality-news-and-wallpaper-providers)
3. [Interactive 24-Hour Forecast Chart](#3-interactive-24-hour-forecast-chart)
4. [Regional News Ingestion and Interactive Story Navigation](#4-regional-news-ingestion-and-interactive-story-navigation)
5. [Progressive Disclosure: Hover Popovers and Telemetry Drawer](#5-progressive-disclosure-hover-popovers-and-telemetry-drawer)
6. [Media Player, 60 FPS Sound Visualizer, and Focus Dock](#6-media-player-60-fps-sound-visualizer-and-focus-dock)
7. [Upgrading Local Wally While Preserving Settings](#7-upgrading-local-wally-while-preserving-settings)
8. [Lively Properties Reference Table](#8-lively-properties-reference-table)
9. [Advanced Configuration (config.js)](#9-advanced-configuration-configjs)
10. [Troubleshooting and Symptom-to-Action Guide](#10-troubleshooting-and-symptom-to-action-guide)

---

## 1. First Launch and Location Cascade

When Local Wally initializes, it determines your geographic coordinates through a non-blocking cascade designed to boot instantly without modal permission dialogs:

1. **Manual Location Override**: If you entered a custom city or coordinate pair in the Diagnostics panel (press <kbd>D</kbd> on your desktop) or via Lively Properties, that location is geocoded once and cached permanently. It takes precedence over automatic detection.
2. **Persisted Automatic Location**: If an automatic location was previously resolved, Local Wally paints that cached location immediately upon boot so you never see blank or placeholder screens. A silent background check detects if your laptop moved to another city and adopts changes smoothly.
3. **Silent Auto-Detection**:
   - Local Wally checks `navigator.permissions.query({ name: 'geolocation' })` with a strict 1500 ms safety timeout race. In WebView2 desktop environments where host permission prompts may hang, the query safely times out and falls back to IP geolocation.
   - If HTML5 Geolocation permission was already granted in your environment, precise coordinates are used.
   - If not already granted, Local Wally immediately uses secure, keyless IP-based geolocation (`ipapi.co`).
   - If the network is entirely offline, it falls back to the default coordinates specified in `config.js` (Tokyo, Japan).

### Setting a Manual Location
- Press <kbd>D</kbd> over the desktop to open the Diagnostics & Location Management overlay.
- Type any city name (e.g. `London`, `Seattle`, `Bangalore`) or coordinate pair (`lat, lon`).
- Select a suggested match or press <kbd>Enter</kbd>.
- To return to automatic GPS/IP detection at any time, click **Use automatic**.

---

## 2. Customizing Weather, Air Quality, News, and Wallpaper Providers

Right-click Local Wally in your Lively Wallpaper library and choose **Customise Wallpaper** to adjust provider preferences:

<p align="center">
  <img src="screenshots/05-lively-settings.png" alt="Lively Wallpaper Customise Settings modal showing provider selectors and masked API key fields" width="85%" />
</p>

### Weather Telemetry Providers
- **Open-Meteo (Keyless Default)**: High-resolution global forecast models with zero configuration and no API keys required.
- **WeatherAPI.com (Free Key)**: Provides live conditions, 72-hour hourly forecasts, and US EPA air quality data in a single network roundtrip. Requires a free API key from [weatherapi.com](https://www.weatherapi.com/). Enter your key in the **WeatherAPI.com API Key** field. If no key is entered or if the API call fails, Local Wally falls back cleanly to Open-Meteo.
- **OpenWeatherMap (Key Optional)**: Supports OpenWeatherMap One Call 3.0 or 2.5 API keys. Enter your key in the **OpenWeatherMap API Key** field. Falls back to Open-Meteo if the key is empty or returns an error.
- *Note on MET Norway*: The MET Norway / Yr.no service requires custom user-agent headers that standard browser and WebView2 environments cannot send directly; client-side requests configure cleanly through Open-Meteo.

### Air Quality Providers
- **Open-Meteo AQI (Keyless Default)**: Live European Air Quality Index (AQI) with PM2.5 and PM10 particulate tracking. No key required.
- **WAQI / AQICN (Token Optional)**: Telemetry from the World Air Quality Index project. Requires an optional personal API token entered in **WAQI API Token**.

### Wallpaper Photography Providers
- **Unsplash (Keyless Default)**: Curated high-resolution landscape photography matched to your screen resolution and current weather lighting. Requires no API key.
- **Wallhaven, Pexels, Pixabay**: Optional photography providers. If you select one of these providers, you must provide a valid API key in its corresponding field.
- **Rotate configured sources**: Cycles through enabled wallpaper sources automatically on each data refresh cycle.

### Regional News Providers
- **Auto (API keys first)**: Checks for configured keys (Currents, NewsAPI) and uses them first. If no keys are provided, it automatically uses Google News.
- **Google News**: Keyless regional RSS headlines fetched via a lightweight CORS gateway proxy. It automatically selects local headlines based on your detected city and country code.
- **NewsAPI & Currents News**: Commercial news aggregators that require personal API keys entered in their respective fields.
- **15-Minute News Quota Firewall**: All news adapters enforce an independent 15-minute rate-limit window per provider. This protects your API quota and prevents background polling thrashing.

> [!NOTE]
> All credential fields in Lively Wallpaper are masked. Local Wally works out of the box with zero API keys. If an optional keyed provider encounters an invalid key or network error, Local Wally falls back cleanly to its default keyless provider for that category (weather and air quality fall back to Open-Meteo, wallpapers fall back to Unsplash, and news falls back to Google News).

---

## 3. Interactive 24-Hour Forecast Chart

The weather card includes an inline SVG forecast chart rendered with Catmull-Rom cubic Bezier curves:

<p align="center">
  <img src="screenshots/02-forecast-chart.png" alt="Local Wally 24-hour forecast chart displaying temperature curve and metric tabs" width="60%" />
</p>

### Metric Tabs
Click any tab or use the <kbd>←</kbd> and <kbd>→</kbd> arrow keys to switch metrics:
- **Temp**: Hourly temperature in Celsius or Fahrenheit.
- **Feels**: Apparent temperature accounting for humidity and wind chill.
- **Precip**: Rain and precipitation probability from 0% to 100%.
- **Wind**: Surface wind speed trajectory in km/h or mph.
- **Humidity**: Relative atmospheric humidity levels.
- **AQI**: Color-coded European Air Quality Index forecast trajectory.

---

## 4. Regional News Ingestion and Interactive Story Navigation

The regional news dispatch keeps you informed with local and global headlines:

<p align="center">
  <img src="screenshots/04-local-news-interactions.png" alt="Regional news card displaying selected story and active navigation dot indicator" width="60%" />
</p>

- **Story Indicators**: The bottom-right corner displays pagination dots. The elongated cyan pill highlights the active headline.
- **Interactive Navigation**: Click any dot or press <kbd>Enter</kbd> / <kbd>Space</kbd> when focused to switch directly to that story. Manually selecting a story pauses the automatic rotation timer so you can read without disruption.
- **Publisher Tooltips**: Hover over any indicator dot to see the publisher name and relative publication time.
- **Reading Full Articles**: Click the headline to open the original article in your default web browser. All external links use secure `https:` destinations.

---

## 5. Progressive Disclosure: Hover Popovers and Telemetry Drawer

Local Wally implements a two-tier progressive disclosure system so you can see quick summaries at a glance or inspect complete telemetry on demand:

<p align="center">
  <img src="screenshots/03-air-quality-details.png" alt="Air quality card with progressive disclosure floating hover popover" width="60%" />
</p>

### Tier 1: Floating Hover Popovers
- Hover your mouse over (or <kbd>Tab</kbd>-focus) any of the 22 interactive HUD elements.
- A floating acrylic popover appears with secondary metrics, health advisories, moon altitude, or particulate breakdowns.
- Popovers automatically adjust position within screen boundaries so they never clip against desktop edges.
- Dismiss instantly by moving the mouse away or pressing <kbd>Esc</kbd>.

### Tier 2: Contextual Telemetry Drawer
- Click any card or press <kbd>Enter</kbd> to slide open a full-height acrylic drawer.
- Shows complete meteorological parameters, barometric pressure, wind gusts, particulate measurements, and astronomical ephemeris.
- Press <kbd>Esc</kbd> or click outside the drawer to close it.

---

## 6. Media Player, 60 FPS Sound Visualizer, and Focus Dock

The companion dock sits directly below the main HUD inside a unified `#hud-stack` flex container, ensuring a constant 14px gap across all screen heights:

<p align="center">
  <img src="screenshots/06-media-and-focus.png" alt="Media player with 32-bar audio visualizer and Pomodoro focus timer dock" width="85%" />
</p>

### Pomodoro & Focus Timer
- Four supported timing techniques:
  - **Pomodoro (25/5)**: 25 minutes of work followed by a 5-minute break.
  - **52/17 Rule**: 52 minutes of sprint focus followed by a 17-minute rest.
  - **Ultradian (90/20)**: 90 minutes of deep focus followed by a 20-minute rest.
  - **Flowtime**: Stopwatch count-up mode for open-ended focus sessions.
- Press <kbd>P</kbd> to start or pause the timer.
- Real wall-clock timestamp calculations ensure the timer never drifts or loses time when your PC is under heavy load.
- **Concentric SVG Progress Ring**: Driven by a scalable SVG progress ring with dual linear gradients (cyan for focus, emerald for breaks), optically centered at all display resolutions.

### Universal Media Player & Audio Visualizer
- Connects to Windows System Media Transport Controls (SMTC) to display track titles, artists, and album artwork from Spotify, Apple Music, YouTube Music, Tidal, or web browsers.
- Features a 32-bar audio visualizer driven by Lively's audio spectrum bridge running at 60 FPS.
- **Silence Hysteresis**: When music stops or is paused for more than 1.5 seconds, the visualizer automatically goes to sleep and clears the canvas to keep idle CPU usage at roughly 0.0%.
- In browser preview mode, press <kbd>M</kbd> to cycle through built-in demo tracks (Synthwave, Lo-Fi, Ambient).

---

## 7. Upgrading Local Wally While Preserving Settings

Lively Wallpaper maintains customized properties per wallpaper ID. Importing a release zip directly always mints a new wallpaper ID, which starts with default values. To upgrade without losing your customized settings, choose one of these three methods:

### Method 1: One-Click Updater Script (Recommended)
1. Download `upgrade-local-wally.bat` from the [Latest GitHub Release](https://github.com/ravibaskaran/local-wally/releases/latest) or from this repository's `tools/updater/` folder.
2. Double-click `upgrade-local-wally.bat`.
3. The script locates your installed Local Wally folders (supporting both desktop installer and Microsoft Store versions of Lively) and overlays the updated files in place.
4. Restart Lively Wallpaper or re-select Local Wally. All customized settings remain intact.

### Method 2: Manual ZIP Overlay
1. In Lively Wallpaper, temporarily switch to another wallpaper to release file locks.
2. Download `local-wally.zip` from the [Latest GitHub Release](https://github.com/ravibaskaran/local-wally/releases/latest).
3. Extract the contents directly into your existing Local Wally installation folder, choosing **Replace all files**:
   `%LocalAppData%\Lively Wallpaper\Library\wallpapers\<installed-folder>`
4. Switch back to Local Wally in Lively. All settings are preserved because the wallpaper storage ID was not changed.

### Method 3: Settings Export and Import
1. On your existing Local Wally wallpaper, open Lively settings (**Customise Wallpaper**) and click **Export Settings**.
2. Save the resulting JSON backup file to your computer.
3. Import the new `local-wally.zip` into Lively Wallpaper.
4. On the newly added wallpaper, click **Customise Wallpaper**, click **Import Settings**, and select your saved JSON file.

> [!WARNING]
> **Privacy Notice**: Settings backup files contain your configured API keys and custom location settings. Always keep your backup JSON file private. Never post or share an unredacted settings export in public GitHub issues or forums.

---

## 8. Lively Properties Reference Table

The following table lists every property defined in `LivelyProperties.json`:

| Setting Identifier | UI Label | Type | Default | Options / Range |
|---|---|---|---|---|
| `customLocation` | Custom Location (blank = Automatic) | textbox | `""` | City name or `lat, lon` coordinates |
| `hudPosition` | HUD Position | dropdown | `Top Right` | Top Right, Top Left, Bottom Right, Bottom Left, Middle Right, Middle Left, Middle Top, Middle Bottom, Center |
| `glassBlur` | Glass Blur (px) | slider | `14` | 0 to 40 px (step 2) |
| `particleDensity` | Particle Density Multiplier | slider | `1.0` | 0.2 to 2.0 (step 0.1) |
| `tempUnit` | Temperature Unit | dropdown | `Celsius (°C)` | Celsius (°C), Fahrenheit (°F) |
| `refreshInterval` | Data & Wallpaper Refresh Interval | slider | `15` | 5 to 30 minutes (step 1) |
| `wallpaperProvider` | Wallpaper Provider | dropdown | `Unsplash` | Unsplash, Wallhaven, Pexels, Pixabay, Rotate configured sources |
| `unsplashApiKey` | Unsplash Access Key (Optional) | textbox | `""` | Personal Unsplash API key |
| `wallhavenApiKey` | Wallhaven API Key (Optional) | textbox | `""` | Personal Wallhaven key |
| `pexelsApiKey` | Pexels API Key (Optional) | textbox | `""` | Personal Pexels key |
| `pixabayApiKey` | Pixabay API Key (Optional) | textbox | `""` | Personal Pixabay key |
| `weatherSimulation` | Simulate Weather (Debug) | dropdown | `Live Weather (Auto)` | Live Weather (Auto), Clear Day, Rain & Storm, Snow, Starry Night |
| `contrastMode` | Glass Contrast Theme | dropdown | `Auto (Wallpaper-Adaptive)` | Auto (Wallpaper-Adaptive), Dark Glass (White Text), Light Glass (Dark Text) |
| `showMediaFocusDock` | Show Media & Focus Dock | checkbox | `true` | Show or hide bottom companion dock |
| `focusTimerMode` | Focus Timer Mode | dropdown | `Pomodoro (25/5)` | Pomodoro (25/5), 52/17 Rule, Ultradian (90/20), Flowtime (Stopwatch) |
| `pomodoroFocusMinutes` | Pomodoro Focus Duration (Minutes) | slider | `25` | 5 to 60 minutes |
| `pomodoroBreakMinutes` | Pomodoro Break Duration (Minutes) | slider | `5` | 1 to 15 minutes |
| `pomodoroLongBreakMinutes` | Pomodoro Long Break Duration (Minutes) | slider | `15` | 5 to 30 minutes |
| `enableAudioVisualizer` | Enable Audio Visualizer (60 FPS) | checkbox | `true` | Toggle 32-bar visualizer animation |
| `enableDynamicSolarLighting` | Dynamic Solar Lighting & Shadows | checkbox | `true` | Toggle sun-angle lighting and card drop shadows |
| `showNewsFeed` | Show Regional News Feed | checkbox | `true` | Show or hide news card |
| `newsProvider` | News Provider | dropdown | `Auto (API keys first)` | Auto (API keys first), Google News, NewsAPI, Currents News, Rotate configured sources |
| `newsApiKey` | NewsAPI Key (Optional) | textbox | `""` | Personal NewsAPI key |
| `currentsApiKey` | Currents API Key (Optional) | textbox | `""` | Personal Currents API key |
| `showHardwareMonitor` | Show Hardware Monitor | checkbox | `true` | Show or hide CPU/GPU/RAM/Disk gauges |
| `showCelestial` | Show Solar & Lunar Ephemeris | checkbox | `true` | Show or hide dynamic day/night cards |
| `showAqi` | Show Air Quality Index (AQI) | checkbox | `true` | Show or hide AQI gauge and pollutants |
| `showEnvironmentalMetrics` | Show Environmental Metrics | checkbox | `true` | Show or hide Humidity, Clouds, and Precip row |
| `showPomodoro` | Show Pomodoro Focus Timer | checkbox | `true` | Show or hide Pomodoro timer in companion dock |
| `showMediaPlayer` | Show Media Player & Visualizer | checkbox | `true` | Show or hide media card in companion dock |
| `showNetworkUsage` | Show Network Bandwidth | checkbox | `true` | Show or hide Download / Upload speed meters |
| `showBatteryInfo` | Show Laptop Battery Telemetry | checkbox | `true` | Automatically hidden on desktop PCs without batteries |
| `weatherProvider` | Weather Telemetry Provider | dropdown | `Open-Meteo (Keyless)` | Open-Meteo (Keyless), WeatherAPI.com (Free Key), OpenWeatherMap (Key Optional) |
| `weatherapiKey` | WeatherAPI.com API Key (Optional) | textbox | `""` | Free tier WeatherAPI.com key |
| `openweathermapApiKey` | OpenWeatherMap API Key (Optional) | textbox | `""` | Personal OpenWeatherMap key |
| `aqiProvider` | Air Quality Provider | dropdown | `Open-Meteo AQI (Keyless)` | Open-Meteo AQI (Keyless), WAQI / AQICN (Token Optional) |
| `waqiApiKey` | WAQI API Token (Optional) | textbox | `""` | Personal WAQI token |
| `showForecastChart` | Show Forecast Chart | checkbox | `true` | Show or hide 24-hour SVG forecast chart |
| `defaultForecastTab` | Default Forecast Tab | dropdown | `Temperature` | Temperature, Feels Like, Precipitation, Wind, Humidity, AQI |
| `settingsExport` | Export Settings (incl. API keys) | button | - | Exports all settings to JSON file |
| `settingsImport` | Import Settings | button | - | Restores settings from JSON file |

---

<a id="9-advanced-configuration-config-js"></a>
## 9. Advanced Configuration (config.js)

When running Local Wally outside of Lively Wallpaper (such as in a local browser preview via `node serve.js`), settings can be modified in `config.js`. The schema mirrors the properties in Lively Wallpaper:

```javascript
window.LOCAL_WALLY_CONFIG = {
  refreshIntervalMinutes: 15,
  hudPosition: 'top-right',
  glassBlurPx: 14,
  glassSaturationPct: 190,
  tempUnit: 'C',
  newsRotateIntervalSeconds: 7,
  hwUpdateIntervalSeconds: 10,
  wallpaperProvider: 'unsplash',
  weatherProvider: 'open-meteo',
  weatherapiKey: '',
  openweathermapApiKey: '',
  aqiProvider: 'open-meteo',
  waqiApiKey: '',
  newsProvider: 'auto',
  newsApiKey: '',
  currentsApiKey: '',
  defaultLocation: {
    city: 'Tokyo',
    country: 'Japan',
    latitude: 35.6762,
    longitude: 139.6503
  }
};
```

---

## 10. Troubleshooting and Symptom-to-Action Guide

The following symptom-to-action table is based on verified application logic:

| Symptom | Verified Cause | Action to Take |
|---|---|---|
| **Location displays "Locating..." indefinitely** | WebView2 host geolocation permission query hung without responding | Update to the latest release (which incorporates an automatic 1500 ms IP fallback race) or press <kbd>D</kbd> and specify a manual city name. |
| **Location detected as wrong city** | IP geolocation provider resolved nearest ISP gateway rather than physical location | Press <kbd>D</kbd> on your desktop to open the Diagnostics panel, enter your desired city name or coordinates, and press <kbd>Enter</kbd>. |
| **Weather or AQI displays "--" or "Unavailable"** | Network connectivity issue or upstream provider returned incomplete payload | Check your internet connection. Local Wally never fabricates missing metrics. It will retry automatically on the next scheduled refresh interval (default 15 minutes). |
| **WeatherAPI.com or OpenWeatherMap fails** | Missing, invalid, or expired API key | Ensure your key is typed correctly in Lively Wallpaper settings. If the keyed call fails, Local Wally automatically falls back to Open-Meteo. |
| **Regional news headlines are not updating** | 15-minute news quota firewall is active, or CORS proxy is temporarily unreachable | News enforces an independent 15-minute rate limit window per provider to protect API quotas. Wait for the window to expire. If using Google News, verify your internet connection. |
| **Wallpaper or data does not update immediately** | Local Wally adheres to its configured refresh cadence (default 15 minutes) | Data refreshes automatically according to your **Data Refresh Interval** slider (5 to 30 minutes). Changing a provider setting in Lively immediately triggers a fresh sync. |
| **HUD clock or hardware meters frozen after sleep** | System entered S0 Modern Standby or deep sleep | Update to the latest release. On resume from sleep or when the network comes back online, the clock synchronizes immediately and triggers a background refresh if elapsed time exceeds 15 minutes. |
| **Visualizer or animation runs when a game is open** | Lively Wallpaper window pause event was not forwarded by host | Ensure Lively Wallpaper settings are set to **Pause** when applications are fullscreen or focused. In `LivelyInfo.json`, verify that `--pause-event true` is present in the arguments. |

---

*Need further help? Visit [GitHub Issues](https://github.com/ravibaskaran/local-wally/issues) to ask questions or submit bug reports.*
