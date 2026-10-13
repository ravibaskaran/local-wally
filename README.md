# Local Wally HUD

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%2011%20%7C%20Lively%20Wallpaper-0078d4.svg)](#)
[![Performance](https://img.shields.io/badge/Performance-60%20FPS%20%7C%20Ultra--Low%20CPU-success.svg)](#)
[![Zero API Keys](https://img.shields.io/badge/Setup-Zero%20Config%20Required-brightgreen.svg)](#)

> **A beautiful, lightweight live weather wallpaper and smart desktop dashboard for Windows 11 & Lively Wallpaper.**

Local Wally HUD turns your Windows 11 desktop into an ambient, living dashboard. It brings together live local weather, interactive 24-hour forecast charts, air quality metrics, real-time music controls with a live audio visualizer, a Pomodoro focus timer, PC hardware monitoring, and regional news headlines—all set against dynamic landscape photography that naturally changes lighting from sunrise to night.

Best of all, it is designed from the ground up to be **invisible to your computer's performance**: it parks to roughly **0% CPU when idle on the author's target hardware** (Ryzen AI / WebView2 — measured informally, not a cross-hardware guarantee), keeps battery impact low in practice, and requires **no account or API keys** to work out of the box.

---

## ✨ Why Local Wally?

Most animated wallpapers are notorious resource hogs. They run heavy video loops or unoptimized browser scripts that constantly eat 5–15% of your CPU, drain your laptop battery, and cause micro-stutter when gaming.

**Local Wally was engineered differently:**

1. **Ultra-Low Battery & CPU Usage**: Uses smart memory management and recycling buffers so it never causes background lag or stutter.
2. **Automatically Sleeps When Busy**: The moment you maximize a window, launch a game, or lock your screen, Lively Wallpaper puts Local Wally into deep sleep—dropping CPU and GPU usage to **0%**.
3. **Desktop-Friendly Layout**: Sits neatly on the right half of your screen so all your regular Windows desktop icons on the left stay 100% visible and uncluttered.
4. **Zero Setup Needed**: Works the second you install it. It finds your local weather and sunrise/sunset times automatically without requiring API keys, accounts, or credit cards.

---

## 🚀 Key Features

### 🎵 Music Player & 60 FPS Sound Visualizer
- **Works with Your Favorite Music Apps**: Shows the current song title, artist, and album artwork from Spotify, YouTube Music, Apple Music, Amazon Music, or any web browser playing audio.
- **Smooth 32-Bar Sound Spectrum**: Features a fluid, 60 FPS sound wave visualizer that dances to your music in real time.
- **Smart Silence Sleeping**: When music stops or is paused for more than 1.5 seconds, the visualizer automatically goes to sleep and clears the canvas — animation work drops to idle (≈0% CPU on the author's target hardware; not a guarantee on other systems).
- **Interactive Preview Mode**: Test it anytime in your browser by pressing <kbd>M</kbd> to cycle through built-in demo tracks (Synthwave, Lo-Fi, Ambient).

### ⏱️ Pomodoro Focus & Break Timer
- **Built-in Desktop Productivity**: Stay productive with a clean circular countdown timer right on your desktop.
- **One-Click Controls**: Click Start/Pause (or press <kbd>P</kbd>), Reset, or switch between 25-minute Focus sessions, 5-minute Short Breaks, and 15-minute Long Breaks.
- **Precise & Battery-Safe**: Uses real wall-clock timestamps so it never loses time or drifts, even if your PC is under heavy load. If you open a full-screen app, the timer pauses background animations and picks right back up when you return.

### ☀️ Realistic Day, Night & Solar Lighting
- **Multi-Source Living Landscapes**: Choose between Unsplash (keyless default), Wallhaven, Pexels, Pixabay, or automatic round-robin source rotation. High-resolution landscape photography matches your screen resolution and updates with live weather conditions, overlaid with real-time solar lighting:
  - **Sunrise & Sunset**: Warm amber and rose horizon glows.
  - **Golden Hour**: Radiant warm sunlight wash across the landscape.
  - **Midday**: Crisp daylight glow with realistic directional sunlight flares.
  - **Night**: Soft moonlit luminescence and clear, illuminated night wallpaper with gentle nocturnal ambiance.
- **Real-Time Moving Shadows**: The dashboard cards cast subtle drop shadows that shift angle and depth as the sun moves across your sky throughout the day.
- **Instant Boot (No Blank Screens)**: Remembers your last wallpaper so your desktop looks gorgeous the millisecond your PC boots up, with zero blank white flashes.

### 🪟 Smart Glass Contrast (Always Readable)
- Wallpapers change from snowy mountains to dark night forests—and your text should always stay readable.
- Local Wally automatically reads the brightness of the photo behind the dashboard:
  - On **bright wallpapers**, it smoothly shifts to a high-contrast **Light Glass Theme** with dark slate text.
  - On **dark wallpapers**, it uses a sleek **Dark Glass Theme** with crisp white text.
- This check happens only once when a wallpaper loads, ensuring zero performance impact while you work.

### ⚡ Smart Hardware Protection (Laptops vs. Gaming PCs)
- **Automatic Graphics Detection**: Identifies whether your computer is running on an integrated laptop chip (like Intel Iris/Arc or AMD Radeon graphics) or a dedicated gaming graphics card (like NVIDIA GeForce RTX).
- **Battery Saver for Laptops**: Automatically uses efficient 1:1 pixel rendering on laptops to stay cool and save battery.
- **Crisp Quality on Gaming PCs**: Delivers enhanced supersampling on powerful desktop graphics cards for razor-sharp glass borders and icons.

### 📐 1:1 Sharp Resolution Matching
- Automatically detects your exact monitor resolution (1080p, 1440p, 4K, or ultrawide) and downloads wallpaper photos tailored to your exact screen dimensions. This ensures crystal-clear backgrounds without blurry scaling or wasted graphics memory.

### 🌦️ Live Local Weather & Air Quality
- **Accurate Multi-Source Weather**: Choose between three free global weather providers:
  - **Open-Meteo** (Default): Keyless, high-precision global weather models.
  - **MET Norway / Yr.no**: European meteorological service (client-side queries route reliably via Open-Meteo).
  - **OpenWeatherMap**: Keyed integration with automatic free fallbacks.
- **Air Quality Monitoring**: Real-time European Air Quality Index (AQI) with pollutant levels (PM2.5 / PM10) via Open-Meteo or WAQI ground stations.
- **Dynamic Day & Night Ephemeris Cards**: Replaced static solar/lunar rows with three glanceable, context-adaptive cards automatically determined by physical astronomical solar altitude (`altitude > -0.01454` radians):
  - **Daytime**: (1) **Rain Outlook** (imminent precipitation window & peak probability or clear-sky status), (2) **Feels-Like Peak** (daily maximum apparent temperature & time), (3) **Daylight Left** (remaining hours to sunset or active golden hour countdown).
  - **Nighttime**: (1) **Next Golden Hour** (morning window start/end and countdown), (2) **Moon Phase & Visibility Outlook** (astronomical emoji glyph, illumination %, waxing/waning status, horizon altitude, and forecast cloud factor), (3) **Next Sky Event** (dawn, sunrise, moonset, or NASA 2026 meteor shower/solstice calendar).
- **Zero-Config Location**: Automatically finds your city via Windows location or secure IP lookup, with safe offline defaults if internet access is interrupted.

### 🔍 Progressive Disclosure Hover Popovers & Accessibility
- **Floating Acrylic Hover Cards**: Hovering or focusing any of the 22 HUD and companion dock elements displays a floating glass popover (`#hud-hover-popover`) with 12px blur, progressive disclosure telemetry, and viewport boundary clamping (prevents edge clipping).
- **Full Keyboard & Touch Accessibility**: Focus seamlessly via <kbd>Tab</kbd> with dynamic `aria-describedby` binding, or dismiss instantly with <kbd>Esc</kbd>. Zero network requests on hover.

### 📊 Space-Efficient 24-Hour Forecast Chart
- **Compact & Glare-Free**: An inline vector weather chart that shows you exactly what to expect over the next 24 hours without cluttering your desktop.
- **6 Switchable Forecast Tabs**:
  - 🌡️ **Temp**: Temperature curve with clear hourly highs and lows.
  - 🔥 **Feels**: "Feels like" apparent temperature.
  - 🌧️ **Precip**: Rain and precipitation probability (0–100%).
  - 💨 **Wind**: Wind speed trajectory in km/h or mph.
  - 💧 **Humidity**: Relative humidity percentage.
  - 🍃 **AQI**: Color-coded air quality index trajectory.
- **Easy to Read & Navigate**: Bold labels with high-contrast outlines for easy scanning at any distance. Navigate tabs with your mouse or keyboard arrow keys (<kbd>←</kbd> / <kbd>→</kbd>).

### 💻 Computer Hardware Monitor & Sparklines
- **Live System Health**: Clean live graphs showing CPU usage, GPU 3D engine load, RAM memory usage, Disk storage, and Network Download & Upload speeds.
- **Smooth Mini Graphs (Sparklines)**: Real-time 40-point history graphs that update smoothly with zero noticeable CPU usage.
- **Smart Laptop Battery Meter**: Shows battery percentage and charging state (⚡). Automatically hides itself on desktop PCs so no space is wasted.

### 📰 Multi-Source Regional News & Interactive Dots
- **Flexible News Providers**: Choose between Google News (GDELT DOC 2.0 keyless default & fallback), NewsAPI, Currents News, or automatic rotation across configured sources.
- **15-Minute Cache Firewall**: Prevents rate-limit exhaustion and battery drain with strict client-side caching and in-flight de-duplication across reloads and UI interactions.
- **Dynamic Source Labeling**: Header and accessibility tags dynamically update to reflect the active provider (`Google News`, `NewsAPI`, `Currents News`).
- **Interactive Story Dots**: Hovering any dot reveals the publisher outlet and publish age in the floating popover; clicking or keyboard-activating (<kbd>Enter</kbd> / <kbd>Space</kbd>) instantly switches stories and resets the rotation timer. Direct safe `https:` outbound links to full publisher articles in your browser.

---

## 📦 Installation Guide

### Method 1: Easy Drag-and-Drop Install (Recommended)

1. **Download the Release**: Download `local-wally.zip` from the [Latest GitHub Release](https://github.com/ravibaskaran/local-wally/releases).
2. **Drag & Drop**: Open Lively Wallpaper and drag `local-wally.zip` straight into the Lively window.
3. **Done!** Lively Wallpaper will automatically install and add **Local Wally HUD** to your library. Click it to set it as your active wallpaper.

---

### Method 2: Manual Folder Install

1. Download or clone this repository:
   ```bash
   git clone https://github.com/ravibaskaran/local-wally.git
   ```
2. Open Lively Wallpaper and click **Add Wallpaper** (`+`).
3. Click **Browse** and select the downloaded `local-wally` folder (or drag the folder directly into Lively).
4. Click **OK** to set it as your active wallpaper.

---

### Method 3: Web Browser Preview (For Testing & Customization)

You can preview and test Local Wally in any modern browser (Microsoft Edge, Google Chrome, Brave) without Lively:

1. Open a terminal in the folder and start the preview server:
   ```bash
   node serve.js
   ```
2. Open your browser to:
   ```
   http://localhost:8080/
   ```

---

## ⬆️ Upgrading Local Wally (Keep Your Settings)

Lively keeps your customized values **per wallpaper id**, so a freshly imported zip normally starts from defaults. Two ways to upgrade without re-entering anything:

### Method 1: One-Click Updater (automatic, in-place)

1. Download **`upgrade-local-wally.bat`** from the [Latest GitHub Release](https://github.com/ravibaskaran/local-wally/releases) (or from this repo's `tools/updater/` folder) and double-click it.
2. The updater downloads the newest release, finds every installed Local Wally folder (installer and Microsoft Store layouts alike), and overlays the new files **in place**.
3. Re-select your wallpaper in Lively (or restart Lively) — the new version loads with **all settings preserved** (they live in Lively's per-wallpaper SaveData, which the updater never touches).

No admin rights needed; safe to run repeatedly; it updates the old *and* any duplicate entries. If Lively is holding a file open, switch to another wallpaper and run it again.

### Method 2: Settings Backup (guaranteed fallback, also for new machines)

1. On the existing wallpaper entry: press <kbd>D</kbd> on the desktop (or **Customise → Export Settings**) and save the JSON file.
2. Import the new `local-wally.zip` into Lively (this creates a new entry).
3. On the new entry: **Customise → Import Settings** and pick the JSON file — keys, manual location, units, and preferences return.
4. Delete the old entry once satisfied.

> **Why not just remove and re-add?** Removing the old entry and importing the new zip always mints a new wallpaper id — that is why plain re-imports look like "settings were lost". Both methods above avoid that by either updating in place (Method 1) or carrying the values across (Method 2).

---

## ⚙️ Customizing Local Wally in Lively Wallpaper

Right-click the wallpaper in your Lively Wallpaper library and choose **Customise Wallpaper** to adjust any setting:

| Setting | What It Does | Default |
|---|---|---|
| **HUD Position** | Move dashboard: Top Right, Top Left, Bottom Right, Bottom Left, Middle Right, Middle Left, Middle Top, Middle Bottom, or Center | Top Right |
| **Weather Provider** | Choose between Open-Meteo (free) or OpenWeatherMap (key optional) | Open-Meteo |
| **OpenWeatherMap API Key** | Optional personal API key if using OpenWeatherMap | *(Empty)* |
| **Air Quality Provider** | Choose between Open-Meteo (free) or WAQI ground stations | Open-Meteo |
| **WAQI API Key / Token** | Optional token if using WAQI air quality | *(Empty)* |
| **Show 24-Hour Forecast Chart** | Toggle the interactive 24-hour forecast chart | On |
| **Default Forecast Tab** | Initial chart metric (Temp, Feels Like, Precip, Wind, Humidity, AQI) | Temp |
| **Show Regional News Feed** | Toggle the local news headline card | On |
| **Show Hardware Monitor** | Toggle the CPU, GPU, RAM, Disk hardware monitor | On |
| **Show Network Bandwidth** | Toggle live Download & Upload network speed rows | On |
| **Show Laptop Battery Telemetry** | Toggle battery meter (auto-hidden on desktop PCs) | On |
| **Show Solar & Lunar Ephemeris** | Toggle sunrise, solar noon, sunset, and moon phase card | On |
| **Show Air Quality Index (AQI)** | Toggle the Air Quality Index rating bar | On |
| **Show Environmental Metrics** | Toggle Humidity, Wind Speed, and Rain amount cards | On |
| **Show Media & Focus Dock** | Toggle the companion bottom dock (Music & Pomodoro) | On |
| **Show Pomodoro Focus Timer** | Toggle the Pomodoro focus timer card | On |
| **Show Media Player & Visualizer** | Toggle the Windows music player card and sound visualizer | On |
| **Pomodoro Focus Duration** | Set focus timer length (5 to 60 minutes) | 25 min |
| **Pomodoro Break Duration** | Set break timer length (1 to 15 minutes) | 5 min |
| **Pomodoro Long Break Duration** | Set extended break timer length (5 to 30 minutes) | 15 min |
| **Enable Audio Visualizer** | Toggle the 32-bar sound visualizer | On |
| **Dynamic Solar Lighting & Shadows** | Enable realistic daytime sunlight, sunset glow, and shadows | On |
| **Glass Blur** | Adjust background blur intensity (0px to 40px) | 14px |
| **Particle Density Multiplier** | Adjust rain and snow particle density (0.2x to 2.0x) | 1.0x |
| **Temperature Unit** | Switch between Celsius (°C) and Fahrenheit (°F) | Celsius (°C) |
| **Data Refresh Interval** | How often weather and wallpapers update (5 to 30 minutes) | 15 min |
| **Glass Contrast Theme** | Auto (adapts to background brightness), Dark Glass, or Light Glass | Auto |

---

## ⌨️ Keyboard Shortcuts

When using the wallpaper or previewing in a browser, you can use these quick keyboard shortcuts:

| Key | What It Does |
|:---:|---|
| <kbd>Click</kbd> / <kbd>Enter</kbd> | Click or focus any card to open its rich **Contextual Telemetry Drawer**. |
| <kbd>Esc</kbd> | Dismiss the open **Contextual Telemetry Drawer**. |
| <kbd>P</kbd> | **Start / Pause** the Pomodoro Focus Timer. |
| <kbd>M</kbd> | Cycle through demo music tracks in preview mode (**Synthwave → Lo-Fi → Ambient → Idle**). |
| <kbd>D</kbd> | Toggle the real-time **Diagnostics Overlay** (shows FPS, GPU info, memory, and cache status). |
| <kbd>C</kbd> | Switch **Glass Contrast Mode** (**Auto → Dark Glass → Light Glass**). |
| <kbd>R</kbd> | **Force Refresh** weather and wallpaper immediately (bypasses cache). |
| <kbd>T</kbd> | Toggle between **Celsius (°C)** and **Fahrenheit (°F)**. |
| <kbd>←</kbd> / <kbd>→</kbd> | Switch between **Forecast Chart Tabs** (Temp, Feels, Precip, Wind, Humidity, AQI). |

---

## 🛠️ Advanced Settings (`config.js`)

For advanced users running portable setups or testing outside Lively, all parameters can be customized directly in `config.js`:

```javascript
window.LOCAL_WALLY_CONFIG = {
  refreshIntervalMinutes: 15,          // How often data refreshes (5 to 30 mins)
  hudPosition: 'top-right',             // 9 positions: 'top-right', 'top-left', 'bottom-right', 'bottom-left', 'middle-right', 'middle-left', 'middle-top', 'middle-bottom', 'center'
  glassBlurPx: 14,                      // Glass blur radius (0 to 40 px)
  glassSaturationPct: 190,              // Glass saturation boost (100% to 250%)
  tempUnit: 'C',                        // 'C' for Celsius, 'F' for Fahrenheit
  newsRotateIntervalSeconds: 7,         // News headline rotation speed
  hwUpdateIntervalSeconds: 10,          // Hardware monitor refresh interval
  unsplashApiKey: '',                   // Optional personal Unsplash API key
  maxPrecipitationParticles: 1800,      // Max rain/snow particles (200 to 3500)
  contrastMode: 'auto',                 // 'auto', 'dark', or 'light'
  showNewsFeed: true,                   // Show/hide news headlines
  showHardwareMonitor: true,            // Show/hide CPU/GPU/RAM/Disk monitor
  showNetworkUsage: true,               // Show/hide live network speeds
  showBatteryInfo: true,                // Show/hide battery status (auto-hides on desktops)
  showCelestial: true,                  // Show/hide sunrise/sunset & moon phase
  showAqi: true,                        // Show/hide Air Quality Index
  showEnvironmentalMetrics: true,       // Show/hide Humidity, Wind, Rain cards
  weatherProvider: 'open-meteo',        // 'open-meteo', 'met-norway', or 'openweathermap'
  openweathermapApiKey: '',             // Optional OpenWeatherMap API key
  aqiProvider: 'open-meteo',            // 'open-meteo' or 'waqi'
  waqiApiKey: '',                       // Optional WAQI API token
  showForecastChart: true,              // Show/hide 24-hour forecast chart
  defaultForecastTab: 'temp',           // Initial tab: 'temp', 'feels_like', 'precip', 'wind', 'humidity', 'aqi'
  showMediaFocusDock: true,             // Show/hide bottom companion dock
  showPomodoro: true,                   // Show/hide Pomodoro timer
  showMediaPlayer: true,                // Show/hide music player card
  pomodoroFocusMinutes: 25,             // Focus duration in minutes
  pomodoroBreakMinutes: 5,              // Break duration in minutes
  pomodoroLongBreakMinutes: 15,         // Long break duration in minutes
  enableAudioVisualizer: true,          // Enable/disable 32-band visualizer
  enableDynamicSolarLighting: true,     // Enable/disable sun lighting & shadows
  defaultLocation: {                    // Offline fallback coordinates
    city: 'Tokyo',
    country: 'Japan',
    latitude: 35.6762,
    longitude: 139.6503
  }
};
```

---

## 📁 File Structure

```
local-wally/
├── config.js              # External settings file with clear comments
├── index.html             # Clean, accessible HTML layout
├── LivelyInfo.json        # Lively Wallpaper application manifest
├── LivelyProperties.json  # Lively settings menu configuration
├── LICENSE                # Open-source MIT License
├── README.md              # User guide and documentation
├── DESIGN_BLUEPRINT.md    # Detailed system architecture blueprint
├── serve.js               # Lightweight local preview web server
├── thumbnail.jpg          # Preview thumbnail for Lively Wallpaper
├── css/
│   └── style.css          # Windows 11 Acrylic styling, glassmorphism, responsive rules
└── js/
    ├── api.js             # Weather, geolocation, Unsplash, and news feeds
    ├── app.js             # Main controller, 60 FPS animation loop, hardware sparklines
    ├── cache.js           # 15-minute smart caching firewall to save battery and network
    ├── lively.js          # Lively Wallpaper communication bridge and sleep controller
    ├── particles.js       # High-efficiency rain, snow, and splash particle engine
    ├── sky.js             # Day/night sky color transitions and sun/moon positioning
    └── suncalc.js         # Offline solar and lunar position math
```

---

## 🛡️ Recent Updates & Quality Improvements

### Version 0.8.16 — Wallpaper Source Watermark Done Right
- **Provider-first labels**: the bottom-right watermark now reads simply **"Wallhaven"** (or "Pexels", "Unsplash", "Pixabay") — the providers' generic stand-in "photographers" ("Wallhaven Community", "Unsplash Artist") are suppressed; a *real* photographer still shows as `Pexels · Jane Doe`.
- **Always visible at boot**: the watermark now appears from the restored wallpaper cache **even for caches written by older builds** (the provider is derived from the image URL's hostname when no provider key is stored) — you no longer need a fresh wallpaper swap to see it.
- **Better legibility over any wallpaper**: slightly larger type, higher contrast, a stronger text shadow and a darker glass pill.
- Provider is persisted alongside the cached wallpaper so boots are instant and correctly labelled; hover still discloses the full source URL, link discipline unchanged (`https`-only, `noopener`).

### Version 0.8.15 — Stories Persist Across Sessions, Kill-Switch for Stale Popovers
- **Your news card never starts empty again**: the last-known stories are now painted **at startup from the persisted snapshot** (even when the weather cache predates them), and an empty network result falls back to the snapshot instead of blanking the card — stories show marked-stale while a fresh fetch revalidates. The snapshot rides your **settings exports**, so it survives re-installs; the one-click updater keeps it automatically (same install folder).
- **D-panel news health line** (press `D`): per provider it shows the last attempt's result, the remaining quota window and any pending region tier — the honest way to see *why* a card is empty (bad key vs empty city vs 15-minute window). The empty news card also says so itself when a regional tier is pending: "No local stories yet — regional stories arrive within 15 minutes".
- **Stale popovers die when you switch to another window**: beyond the position-aware guard, a page that does not own the focus drops any open hover popover after ~1.5s of silence — the browser-foreground case from your screenshot is gone (an actively hovering reader keeps generating mouse movement and is never interrupted).
- **Last invented `'US'` removed** from the news caller — unknown country stays unknown (world fallback), matching the v0.8.14 trust-boundary work.

### Version 0.8.14 — Production Hardening: Fail-Closed Quotas, Intent Races, Trust Boundaries
*A hardening pass from an independent audit (arrived as "v0.8.13" — renumbered because that version already shipped).*
- **Keyed-news reservations fail closed**: a reservation is granted only after the quota stamp is **durably written** — un-writable storage, absent storage, or a rejected Web Locks coordination all deny the keyed request outright (cache and keyless news keep working). The persisted quota state never contains key material.
- **Manual-location intent races closed**: every Customize delivery is a new intent *before* the identical-value short-circuit — a redelivered saved location now kills any pending older request; a stale failure can never clear a newer location; the boot re-resolution path retries the latest record instead of silently jumping to auto-detection.
- **Location trust boundaries tightened**: geocoder and pre-resolved coordinates are range-validated (`±90`/`±180`, finite) before anything is written — invalid remote results are rejected like any unresolvable name; **no invented `'US'` country remains anywhere** on the location paths (unknown country stays unknown → world news fallback).
- **Country tier memory corrected**: city tier-0 successes no longer overwrite the reusable country/world hint; new cities try their own city tier first, and an empty city tier pends the *proven country tier* for the next eligible window.
- **Settings import honesty**: storage failures are isolated per entry and reported as a **partial restore** (no full-success claim, no automatic reload over a half-restored state); host writes are now described as **submitted**, not persisted, until a restart test proves otherwise.
- **Popover: unknown pointer ≠ outside**: keyboard focus / touch / hover-without-mousemove get the bounded reading grace instead of the short expiry; park clears debounces and invalidates late image/lookup work.
- **Image-search budget enforced for real**: no key ⇒ no request and no slot consumed; each actual provider search consumes a **persisted** rolling-hour slot (six/hour, across reloads); a Pixabay empty/error falls through to Unsplash only on a fresh slot; park invalidates in-flight decorations.
- **Tier store bounded**: city hints are capped (oldest evicted), country hints preserved, corrupt persisted data recovers cleanly.
- **Claims qualified**: performance shorthand ("0% CPU", "never drains") now states it was measured informally on the author's target hardware — not a cross-hardware guarantee; the v0.8.10 host-persistence language is annotated as superseded/unverified (see its entry).

### Version 0.8.13 — One-Click Updater, Wallpaper Source Credit
- **One-click updater** (`tools/updater/upgrade-local-wally.bat`): double-click it to fetch the newest release and overlay it **in place** onto every installed Local Wally folder (installer + Store layouts) — Lively's per-wallpaper SaveData keeps your keys, manual location, and preferences untouched. The launcher re-fetches its engine from the repo each run, so the updater itself stays current; a README section documents the full upgrade story (including the settings-JSON fallback for new machines).
- **Wallpaper source credit, actually visible**: the photo attribution now sits as a small glass pill pinned to the **wallpaper's bottom-right corner** (it used to be clipped inside the HUD card), reveals itself once a photo applies, hover shows the full source URL, and the link keeps https-only + `noopener` discipline. Say goodbye to mystery wallpapers.

### Version 0.8.12 — Save-As Export, Instant Regional News, Compact Telemetry, Story Images, Fast Popover Expiry
- **Export opens a real Save-As dialog**: the File System Access picker writes your settings JSON wherever you choose (with the classic download as a graceful fallback when the host can't offer a picker — the status line always says which path ran; cancelling is reported honestly).
- **Import picker comes to the foreground**: the window is focused first and the modern picker is preferred; the hidden-input dialog remains as fallback.
- **News gets the room**: the hardware telemetry rows sit compact at natural height again — the secondary column's spare height now goes to the news card (and its backdrop image), not to metric gaps.
- **Story images for every headline**: provider images paint behind the headline (fixed dark scrim + text shadow — legible on any photo); headlines *without* a provider image get a topical placeholder found via your own Pixabay/Unsplash key from the headline keywords — capped at 6 searches/hour with a bounded headline→image cache, and no keys means no fetch, never an error.
- **Manual cities get instant regional news**: a new country-level tier memory means once *any* city in a country has proven a working news tier, a newly entered city in that country starts there directly — Bengaluru returns India headlines on the first attempt (the 15-minute quota window still binds every request).
- **Empty news card explains itself**: if the keyless Google News source is selected while API keys are configured, the empty state adds a one-line tip pointing at "Auto (API keys first)".
- **Hover popovers now expire in seconds**: popovers sit behind a position-aware guard — 3 s after the cursor was last seen away from the card, at most 8 s even if the cursor was last on it, plus instant closes on document mouseleave / window blur. The covered-window lingering is gone.

### Version 0.8.11 — Audit Corrections: Location Intent, News Quota Boundary, Honest Restore
- **Manual-location intents are generation-guarded**: every Customize delivery, D-panel apply, and clear is a fresh intent; late geocodes can never resurrect an abandoned entry, clear a newer location, or fire stale refreshes. An unresolvable *latest* name clears the override and falls back to Auto with an explicit message instead of silently showing a stale place.
- **News quota boundary hardened to the actual request**: every keyed HTTP GET now reserves its own 15-minute window at the request boundary (previously one reservation could cover a multi-GET ladder). On empty/failure, the next region tier pends for the next eligible window — discovery across tiers spans windows by design — while other eligible providers can still answer in the same attempt. **≤96 keyed GETs/day per provider**; daily limits stay unreachable, and cached reads consume nothing.
- **Multi-instance reservation (feature-detected)**: when the host exposes the Web Locks API, the quota read-check-persist runs inside a shared critical section and fails closed. Whether Lively's two monitor views share one storage bucket is still to be verified on a real multi-monitor host — documented as unverified, not claimed fixed.
- **Backup honesty**: operational quota/tier state never rides exports; an import carrying stale quota stamps cannot reset a live cooldown; runtime-only imports (no host write API available) are counted separately and no longer get auto-reload-undone — with a message telling you how to persist them.
- **Location trust boundary**: restored/imported geometry is range-validated (±90 / ±180, finite numbers); coordinate pins keep their saved city/country enrichment across boots and never invent a country; placeholder labels ('Local City' / 'Local Area' / 'Metropolitan' / 'Manual Area') can never overwrite a real detected city; coordinate pins mirror as coordinates on the Customize property.
- **Alias matching**: 'Bangalore' and 'Bengaluru' both short-circuit with one geocode, and the alias now travels inside backups.
- **Tooltip lifecycle**: parking closes hover popovers and clears their linger interval; re-arming while paused is inert; repeated park/resume adds no listeners.
- **Import key validation corrected**: the URL-embedded key list now matches the actual request builders (OpenWeatherMap / WAQI / Pixabay — Unsplash/Wallhaven moved to header auth); non-string and oversized key values are rejected at the boundary; blank stays valid.
- **Canvas documentation truth pass**: constructor order, `desynchronized`/`willReadFrequently` as hints, and compositor claims corrected — no guaranteed DWM bypass or GPU-only residency is claimed anymore.
- **Deferred (honestly, not silently)**: on-target performance pilots (blur cost, story-image churn, the WebGL2 ≥20% render-time gate) need the real WebView2 host and are specified in the blueprint; the CSP candidate policy awaits host validation.

### Version 0.8.10 — Manual Location in the Customize Panel
- **Custom Location is now the first control in Lively's Customize settings**: right-click the wallpaper → **Customize Wallpaper** → type your city into **"Custom Location (blank = Automatic)"** — e.g. `Bangalore` (aliases welcome), a precise name, or raw `12.97, 77.59`. Blank = automatic detection. The entry geocodes once (keyless), persists, and overrides auto-detection everywhere — permanently until cleared.
- **Why**: IP-based auto-detection can pin a city a district away (an ISP exchange city — your report: auto said *Arsikere*, you're in Bangalore). The property-based override fixes that at the source, rides the backup/restore across machines, and its re-delivery is short-circuited (an identical value never re-geocodes).
- The two surfaces stay in sync: picking a city in the `D` panel's autocomplete updates the same Customize field (via the host), and "Use automatic"/blanking the field restores detection.
- Hardening bonus: when localStorage is unavailable, the manual record now survives in memory for the session (matching the cursor/history resilience rule) instead of silently vanishing.
- **Note (superseded in v0.8.14)**: the "publishes back via the host" language above describes a write API that is *feature-detected, not part of Lively's documented web interface*. Until a real restart test on the host confirms persistence, treat Customize-field updates from the D panel as **submitted — persistence unverified**. The localStorage record named above remains the source of truth either way.

### Version 0.8.9 — News That Always Fills, Story-Image Card, Tightened Telemetry, Key Links
- **News reliability (the "Regional dispatch unavailable" fix)**: your report showed the card dead on *Arsikere, India* — a small town where city-keyword searches legitimately return **zero results** on NewsAPI/Currents, after which the app fell to the (mostly dead) keyless chain. New behavior: a **region ladder** widens city keywords → **country top stories** → a world pass, per provider — and the deepest working tier is *remembered* so later attempts cost exactly one call. If a provider comes up empty, the app hands to the **other keyed provider before** ever touching the keyless chain. Every leg stays inside the quota firewall.
- **News card with story image**: headlines with images (Currents/NewsAPI supply them) now paint a background picture behind a **fixed dark scrim + text-shadow** — the card text is legible regardless of image brightness; images load off-DOM and only appear on success (no broken-image flash); imageless stories render the classic card.
- **Honest, calmer wording**: "Regional dispatch unavailable" is retired everywhere — the empty card now says *"No stories right now — new stories arrive automatically"*; drawer titled "News Feed".
- **Tightened telemetry**: hardware rows are denser (row padding/gaps reduced) so the news card gets more room.
- **Get API Keys, one click away**: press **`D`** → **Get API Keys** block with direct links to every provider (Currents, NewsAPI, Unsplash, Pexels, Pixabay, Wallhaven). Lively's own Customize panel renders labels as plain text only — clickable links live in the D panel by design; the Customize panel keeps the two backup buttons and this hint.

### Version 0.8.8 — Customize-Panel Backup Buttons, Popover Guard, Right-Aligned Conditions, Night Wallpapers
- **Export/Import now visible in Lively's Customize settings**: the app's settings panel (right-click wallpaper → Customize Wallpaper) gains **"Export Settings (incl. API keys)"** / **"Import Settings"** buttons plus a help label — the same engine as before, now discoverable where you already are. Manual location with city autocomplete and backup status remain in the HUD diagnostics panel (**`D`** over the desktop — Lively's host-rendered panel can't host custom dropdowns).
- **Hover popover can no longer outlive the mouse**: when another window covers the wallpaper, the WebView receives no mouse events — `mouseleave` never fires and popovers (e.g. Network Bandwidth) lingered visibly while you worked elsewhere (report + screenshot). A linger guard now closes any popover when the page sees no mouse activity for ~10 s (or the anchor is untouched ~12 s); movement inside the anchor keeps it for deliberate readers.
- **Atmospheric condition info sits on the card's right edge** (right-justified column, per request).
- **Wallpaper vibe now follows the clock in EVERY weather**: previously only Clear had a night query — after dark every category (cloudy/rain/snow/storm/fog/default) fetches `night …` variants, so no more bright daylight fields at 20:58 (verified: all 11 category cases map to distinct day/night queries).

### Version 0.8.7 — Manual Location Control & Dialog-Free Auto Location
- **Manual location (customization)**: press **`D`** → **Location** → type a city (autocomplete after 3+ characters — e.g. typing `BEN` offers *Bengaluru, Karnataka — India* rows you pick from, keyboard-navigable) **or** raw `lat, lon`. Manual entry overrides automatic detection entirely; it's geocoded once via the keyless Open-Meteo geocoder (coordinates + timezone included), cached so boots stay instant and offline-safe, and the HUD re-syncs (weather, news, ephemeris) immediately. "Use automatic" clears the override.
- **Dialog-free automatic location**: the wallpaper **never raises a geolocation permission dialog**. Resolution order: manual entry → your last detected location (persisted across sessions and boots — instant paint, no detection wait) → silent detection, where HTML5 GPS is consulted **only if its permission is already granted** (a state query, never a prompt) and the keyless IP lookup carries everything else, then the config fallback.
- **Persistence & adoption**: first detection persists your location; every boot paints instantly from the record while a silent background re-detect adopts **real city changes** (travel, moved desktop) and re-syncs — coordinate jitter never flips your town, and offline/config-default results can never overwrite a real persisted city.
- **Cross-machine ready**: both location records ride the v0.8.6 backup/restore (`LIVELY_HUD_LOCATION_*` keys) — export/import carries your location choice along with keys.
- **Honest edges**: a city-less coordinate pin skips GDELT/local-news guessing and falls back to country or world news; a manual name that won't geocode falls back to automatic detection with an explanatory status line in the D panel.
- **Verification**: new location suite (9 test sections — manual precedence, coords/city/invalid paths, prompt-state gating, granted GPS, persistence/adoption/jitter immunity, outage defaults, broken-Permissions fallback, backup prefixes) + full 9-suite battery green; `node --check` clean; adversarial FIX-FIRST review applied (adoption source-quality gate, no forged `'US'` region for coordinate pins, suggestion-click coordinates honored, corrupt-record self-heal, pipeline fall-through for broken manual entries) — none outstanding.

### Version 0.8.6 — Settings Backup & Restore (Export/Import with Keys)
- **One-click settings backup**: open the diagnostic panel (**`D`**) and use **Export settings** — Local Wally downloads a single portable `local-wally-settings-YYYYMMDD-HHMMSS.json` containing *every* user-tunable Lively property **including API keys** (Wallhaven/Pexels/Unsplash/Pixabay/NewsAPI/Currents/WAQI/OpenWeatherMap) plus all app-owned browser-storage entries.
- **Cross-machine import**: on another machine, open `D` → **Import settings** → pick the file. Whitelisted properties are re-applied through the Lively host (persisted by Lively itself), app storage entries are restored, and the HUD reloads. News keys, provider modes, visibility toggles, HUD position, units, pomodoro durations — everything moves with you.
- **Format choice**: plain JSON (no zip) — a settings payload is a few KB of text, so compression saved nothing but would have required hand-rolling an archive reader/writer in a zero-build runtime. JSON is also readable/editable in any editor when you need it.
- **Safety rails**: import validates the payload (product/format/size/shape), applies **only** whitelisted property names, charset-checks keys that get embedded in request URLs, and restores **only** app-owned storage keys (`LIVELY_HUD_*`, `local_wally_*`), never foreign entries. The exported file contains credentials in cleartext — keep it safe (treat it like your password vault export).
- **Verification**: new backup suite (`test_v086_backup.js`, 4 sections: payload shape, parse guards, apply semantics, cross-machine round trip) + full 7-suite battery green; `node --check` clean. Scratch-only file — SHA-256 in release notes.

### Version 0.8.5 — Hard Keyed-News Quota Guarantee & GDELT Reliability Verdict
- **Currents/NewsAPI refresh is hard-coded at 15 minutes** (`NEWS_QUOTA_COOLDOWN_KEYED_MS` in code — deliberately not a settings knob): at most **96 network calls/day per keyed provider**, safely under every known free-tier ceiling (NewsAPI ≈ 100/day, Currents 200/day). The 5-minute automatic cadence is unchanged; between keyed windows the card keeps honestly-marked cached stories and marks no network attempt. A user-facing knob would invite 5-minute polling and burned keys, so none will be added.
- **GDELT reliability verdict** (live-probed on two separate days, HTTP 429 both times): GDELT's rate limiting is aggressive and it cannot be a dependable primary anywhere — including keyless installs. It is retained only as the keyless first leg of the Google News fallback chain (proxy-free direct JSON when it succeeds; when it 429s the chain continues to the RSS gateways, costing at most ~7 s). With API keys configured and Auto mode on, GDELT is essentially irrelevant to your news.
- **Verification**: 7 suites green re-run (62/62, 18/18, rest 100%), `node --check` clean, release re-packaged and GitHub release synced.

### Version 0.8.4 — Keyed-First News Default, 5-Minute Auto Refresh & HUD Polish
- **News source reliability**:
  - The Google News chain was fully broken in the wild (live-probed: GDELT 429 rate-limited, `api.allorigins.win` timing out, `corsproxy.io` returning 401 to non-allowlisted origins) while the provider default stayed hard-locked to it — configured NewsAPI/Currents keys were never consulted unless explicitly selected.
  - New **"Auto (API keys first)"** default resolves Currents → NewsAPI → Google News when keys are configured (Currents is CORS-open from WebView2; NewsAPI's free plan blocks browser preflight, so it is tried second). Keyless installs keep the Google News chain.
  - Google News chain re-armed: unusable locality names (empty, `Local`, `Metropolitan`, `Local Area`) skip the doomed GDELT/geo legs and go straight to a country-aware Google News RSS edition (previously hardcoded US); a third public gateway (`api.codetabs.com`) was added between the primary and fallback proxies, overridable via the new `middleCorsProxy` config knob.
- **Automatic 5-minute news refresh**:
  - News now refreshes on a dedicated 5-minute cadence independent of the 15-minute atmosphere cycle (pause-aware, feed-hidden-aware, idempotent across park/resume and enable/disable).
  - The manual refresh button (and its hidden `R` keyboard shortcut) is removed — no manual refresh control remains in the UI.
  - Tiered quota firewall preserved: keyed providers keep the unbypassable **15-minute** cooldown (NewsAPI free tier ≈ 100 calls/day; 5-minute polling would exhaust it in ~8 hours), while the keyless Google News chain refreshes on a true 5-minute window. Response cache TTL lowered to 5 minutes; between keyed windows the card keeps honestly-marked cached stories.
- **HUD layout & polish**:
  - The large whitespace gap between the hardware telemetry and the news card is gone: the secondary column top-stacks (`flex-start`) and the hardware monitor absorbs spare column height in every visibility combination, distributing slack across its metric rows instead of pooling one lump gap; the divider survives only while the news card sits below.
  - Environmental metric cards (Humidity/Wind/Precip) are left-justified for a cleaner, more elegant read.
  - The top clock now displays **AM/PM** (12-hour) with the timezone-aware formatter (`formatToParts`) and a correct manual fallback.
- **Migration note**: the News Provider dropdown gained an "Auto" item at index 0, which shifts previously stored selections by one — if you had explicitly selected a provider before v0.8.4, re-select it once. The default index 0 upgrades transparently to Auto.
- **Verification**: 7 suites green (v0.8.3 suite 62/62, providers suite 100%, v0.8.1 100%, v0.7.3/v0.7.2/v0.7.1/hardening 100%), `node --check` clean, fresh-context adversarial review SHIP-WITH-NITS with zero major findings (5 nits fixed). One test-suite sandbox gained `URLSearchParams` (scratch-only change, SHA-256 reported in release notes).

### Version 0.8.3 — News Engine Integrity, Timezone-Correct Forecasts & Render Pacing
- **News Engine Integrity**:
  - Every news request is bound to its identity (location query, country, provider/mode): a delayed response can never overwrite another query's cache, visible news, or pending snapshot; equivalent concurrent requests dedupe into one bounded in-flight map.
  - Unbypassable per-provider 15-minute quota firewall — settings updates, reloads, and global refresh cannot skip it; failed attempts count; rotate mode falls through to the first cooldown-ready provider instead of stalling.
  - Removed the fabricated-headlines fallback with real-publisher attribution: the terminal state is matching real cached stories (visibly "Cached") or an honest unavailable state. Publication timestamps normalized per provider with a future-guard; article age computed at display time.
- **Timezone & Forecast Correctness**:
  - Open-Meteo now uses `timeformat=unixtime` with labels formatted in the location's IANA timezone — DST transitions display correctly (spring-forward skips 02:00); old ISO payloads remain supported.
  - Feels-Like Peak selects the remaining day by LOCAL calendar date in the location's timezone (correct for +5:30/+5:45 offsets and 23/25-hour DST days), from the current interval onward; unknown timezone reports Unavailable instead of borrowing the host's.
  - Undated forecast points are rejected from rain/peak analytics; analytics use full-resolution hourly data (the 8-point chart is display-only) so peaks the 3-hourly sampling skipped are detected; charts render honest gaps instead of faking a minimum; AQI aligned by absolute instants.
- **Rendering & Interaction**:
  - 60 FPS pacing on high-refresh displays via a remainder-preserving accumulator (144 Hz previously ~48 fps, 165 Hz ~55 fps — now ~60 renders/second in deterministic simulation); physics dt is the actual time since the last rendered frame; single-RAF-chain and parking invariants preserved.
  - Telemetry bars animate `transform: scaleX()` on a fixed width instead of `width`; HUD/dock position changes are discrete with a transform-only FLIP move (reduced motion = immediate); wallpaper loads are generation-guarded so an older image can never overwrite a newer one.
  - Open drawers preserve focus (focused story restored without scroll jump, close-button fallback) and scroll on refresh; a validated stale snapshot paints immediately at boot marked "Cached" before network revalidation.
- **Robustness**:
  - Backward clock jumps trigger celestial refresh; rotation cursors/recent history work without localStorage (memory-first, bounded); the cache is memory-source-of-truth so failing storage no longer causes refetch loops (persistence failure shows "· RAM only" in diagnostics); fetch timeouts reject non-numeric delays (long-standing test warning eliminated).
- **Deferred with reasons**: adaptive-quality and WebGL2 instanced-particle pilots require on-target WebView2 measurements (gates defined, unexecuted); WebGPU/WASM SIMD/workers/OffscreenCanvas rejected without a measured bottleneck; CSP policy deferred pending validation against Lively's loading model.
- **Verification**: 8 suites green (6 regression suites, new v0.8.3 suite 62/62, audit-hardening 22/22), `node --check` clean across all 23 JS files, 5-file footprint (+1207/−509).

### Version 0.8.2 — Consolidated Audit Fixes, Timezone Correctness & Render-Loop Integrity
- **Stability & Correctness**:
  - Restored the single-RAF-chain invariant: resuming with a queued snapshot no longer arms a duplicate animation loop (`App.startLoop()` re-arms via the guarded `wakeAnimationLoop()`), eliminating double per-vsync work during active animation.
  - Timezone-correct 6-hour Rain Outlook and Feels-Like Peak horizons: all three weather adapters emit absolute forecast `timestamp`s; Open-Meteo resolves location-local naive strings via `utc_offset_seconds` → `Date.UTC`, and the cached-snapshot fallback only trusts offset-bearing ISO strings — fixing wrong/missing rain windows after midnight and for remote timezones.
- **Security & Robustness**:
  - Completed HTML escaping in the weather detail drawer (4 provider-sourced fields) and hardened CSS `url("...")` interpolation at both wallpaper ingest points.
  - Fixed a boot visibility race that could permanently park the wallpaper if the window transitioned hidden→visible before bridge init.
  - AQI no longer fabricates a value on degenerate success payloads — all 3 normalizer sites report `Unavailable` without a usable measurement.
  - Next Sky Event now uses astronomical dawn (`nightEnd`) per blueprint §29.3/§30.4, with circumpolar Invalid-Date guards (also in the tomorrow fallback).
- **Performance & Rendering**:
  - Eliminated a forced reflow in the auto-resize layout path (wrap width captured before style writes); audio visualizer silence sleep now honors the documented 1.5 s wall-clock (previously ~0.75 s from double frame counting).
  - Dirty-check guards on warm-path DOM text updates (Pomodoro, diagnostics); `prefers-reduced-motion` now disables the charging pulse.
- **Quality of Life**:
  - Revived the numeric provider `isDay` fallback; open detail drawers refresh on sync with scroll preserved; unhandled-rejection guard on the news attach chain.
- **Verification**: 6/6 regression suites at 100%, `node --check` clean across all 22 JS files, 4-file footprint (+197/−42).

### Version 0.8.1 — Comprehensive Production Code Audit & Performance Hardening
- **Security & Protocol Enforcement**:
  - Enforced strict `https://` protocol checks across all external news and photo links (`a#hud-news-link`, `a#unsplash-credit`), falling back to trusted secure defaults and enforcing `target="_blank"` and `rel="noopener noreferrer"`.
  - Redacted query parameters and authentication credentials in network timeout rejections (`ApiService.fetchWithTimeout`), preventing token leakage in error logs.
  - Sanitized background image preloader errors and neutralized dangling callbacks (`onload = null`, `onerror = null`).
  - Added HTML escaping (`App.escapeHtml`) to floating popover titles (`showHoverPopover`) against potential script injection.
- **Ephemeris & Unit Precision**:
  - Resolved temperature unit evaluation in Feels-Like Peak and Atmospheric Popover (`this.tempUnit === 'F'`), restoring accurate Fahrenheit rendering.
  - Night Card 3 (Next Sky Event) checks tomorrow's dawn/sunrise when all of today's transits have elapsed.
  - Added robust timezone fallbacks (`HH:MM` 24h local) and guarded SunCalc coordinates against `NaN`.
- **UI Data Binding & Drawer Repairs**:
  - Restored telemetry in Weather Detail Drawer by binding to canonical normalized properties (`tempF`/`tempC`, `apparentF`/`apparentC`, `precipitationMm`).
  - Corrected Forecast Drawer metrics mapping across tabs (`temp`, `feels_like`, `precip`, `wind`, `humidity`, `aqi`).
  - Repaired News Drawer article links to read `nItem.link` with HTTPS validation.
- **Performance & Resource Optimization**:
  - **Zero-Storage-Churn Clock**: `CacheManager` caches snapshot timestamps in memory, eliminating redundant `localStorage.getItem` and `JSON.parse` operations every 1,000ms.
  - **True 0.0% CPU When Parked**: Dynamically toggles `.is-paused` class on `<body>` when the wallpaper sleeps, suspending all CSS keyframe animations (`animation-play-state: paused !important`).
  - **SVG Sparkline Attribute Caching**: `SvgSparklineEngine` caches path attributes (`_lastLineD`, `_lastAreaD`), pre-calculates X-coordinates, and eliminates per-segment `.toFixed(1)` string allocations.
  - **Deduplicated Astronomical Ephemeris**: Centralized SunCalc calculations in `App.updateClock`, sharing coordinates across sky and solar shaders to eliminate redundant trigonometric math.
  - **Sky Color Lerp Optimization**: Pre-parsed celestial color palettes into numeric RGB vectors, eliminating string parsing and regex operations in 60 FPS lerp loops.
  - **Hardware Frame Pacing**: Calibrated frame skip threshold to `14.5ms` to lock at smooth 60 FPS on high-refresh 120Hz/144Hz monitors.
- **Enhanced Subsystems**:
  - **Web Audio Pomodoro Chime**: Added synthesized dual-tone bell (587.33 Hz → 880 Hz) and desktop notification on interval completion without adding external audio files.
  - **Dynamic Audio Spectrum**: Broadened audio visualizer band mapping to adapt across input buffer sizes and prevent stalling on vocal/acoustic tracks.
  - **Idempotent Bindings**: Guarded window and Lively event listeners against duplicate registration.

### Version 0.8 — Multi-Source Wallpaper Providers & Localized News Engines
- **Multi-Source Wallpaper Engine**: Support for multiple wallpaper providers selectable via Lively Settings or `config.js`:
  - **Unsplash** (Default): Keyless high-resolution curated CDN fallbacks or custom developer API key.
  - **Wallhaven**: Keyed landscape wallpapers (`https://wallhaven.cc/api/v1/search`) filtered to SFW landscapes and resolution thresholds.
  - **Pexels**: Keyed landscape photography via official REST API (`https://api.pexels.com/v1/search`).
  - **Pixabay**: Keyed horizontal landscape photography via official API (`https://pixabay.com/api/`).
  - **Rotate Configured Sources**: Automatically rotates through configured/keyed providers in stable round-robin order (`Unsplash → Wallhaven → Pexels → Pixabay`), with persistent cursor tracking, bounded recent history (max 80 images), and single Unsplash fallback.
- **Aspect Ratio Closeness & Candidate Ranking**: Evaluates candidates by aspect ratio closeness to the native display viewport, adequate resolution, and non-recent status.
- **Contextual Weather Query Mapping**: Maps live weather conditions (`Clear`, `Cloudy`, `Rain`, `Snow`, `Fog`, `Storm`) directly to landscape queries without transmitting coordinates to image services.
- **Multi-Provider Regional News**:
  - **Google News** (Default & Fallback): GDELT DOC 2.0 direct publisher news with Google News RSS fallback.
  - **NewsAPI**: Keyed headlines via `/v2/everything` with city/country disambiguation and safe `https:` link validation.
  - **Currents News**: Keyed global news search via `/v1/search` with ISO-2 lowercase country filtering.
  - **Automatic News Rotation**: Cycles among Google News and configured keyed providers on each refresh cycle.
- **15-Minute News Cache Firewall**: Enforces a strict 15-minute client-side cache firewall surviving reloads, preventing redundant requests on property changes, and de-duplicating in-flight requests.
- **Dynamic Semantic Card Labeling**: News card header (`#hud-news-title`), source attribution, and accessibility labels update dynamically to reflect the active provider (`Google News`, `NewsAPI`, `Currents News`).

### Version 0.7.3 — Audit Hardening, Ephemeris Precision & Popover Safety
- **News Listener Delegation & Invalidation Lifecycle**: Replaced per-render listener attachment with a single delegated event listener on the `#hud-news-dots` container. Invalides and clears both rotation and transition timeouts (`clearNewsTimers()`) on manual dot clicks, preventing stale ~300ms transition callbacks from overriding user selections. Implemented roving `tabindex` and full arrow key navigation across news tabs.
- **Authoritative Physical Day/Night Calculation**: Fixed solar day vs. night classification to strictly derive from physical solar altitude (`altitude > -0.01454` radians) without letting weather provider flags override local astronomical calculations. Standardized polar day/night evaluation to the same physical threshold and eliminated machine timezone fallback leakage by using cached IANA formatters.
- **Honest Forecast Telemetry (Zero Fabrication)**: Removed synthetic forecast point interpolation from API adapters; missing weather points and measurements are preserved honestly as `null` and displayed as `--` without inflating chart bounds. Daytime Rain Outlook strictly scopes to the upcoming 6-hour window, and Feels-Like Peak filters strictly to today's local date.
- **Chronological Sky Events & Clean Moon Outlook**: Night Sky Event card gathers candidate astronomical transits (dawn, sunrise, moonset, moonrise) and sorts them chronologically to guarantee the nearest upcoming celestial event is highlighted without duplicating the golden hour card. Moon Visibility Outlook reports "Conditions unavailable" when condition feeds are missing instead of assuming clear skies.
- **Viewport-Safe Hover Popovers**: Added overflow scrolling (`max-height: calc(100vh - 16px)`, `overflow-y: auto`) and viewport edge clamping to prevent hover popover clipping across multi-monitor or compact displays. Added container focus targets and rich popovers for the Hardware Block and Metrics Row with immediate <kbd>Escape</kbd> dismissal.
- **Single RAF Owner & Clean Background Parking**: Unified requestAnimationFrame ownership so animation frames cannot leak or double-schedule across play/pause cycles. All auxiliary intervals (clock, fallback, sync, news) halt cleanly when the wallpaper is parked, maintaining true 0% CPU/GPU load. Lively bridge initializes paused when document starts hidden.

### Version 0.7.2 — Dynamic Day/Night Cards, Ephemeris Precision & Progressive Disclosure
- **Dynamic 3-Card Daytime & Nighttime Ephemeris**: Replaced fixed static solar/lunar rows with three glanceable, context-adaptive cards automatically determined by physical astronomical solar altitude (`altitude > -0.01454` rad) rather than fixed clock hours or stale API cache flags:
  - **Daytime**: Rain Outlook (6h window, peak rain time & probability), Feels-Like Peak (daily max apparent temperature & occurrence time), and Daylight Left / Golden Hour countdown.
  - **Nighttime**: Next Morning Golden Hour countdown, Moon Phase & Visibility Outlook (astronomical emoji, illumination %, waxing/waning, altitude, and forecast cloud factor), and Next Sky Event (dawn, sunrise, moonset, or NASA 2026 meteor shower/solstice calendar).
- **Progressive Disclosure Floating Hover Popover (`#hud-hover-popover`)**: Hovering or focusing any of the 22 HUD and companion dock elements displays a dedicated acrylic popover with 12px blur, progressive disclosure telemetry, viewport boundary clamping (prevents off-screen clipping), and full keyboard/touch support (<kbd>Tab</kbd> navigation, <kbd>Esc</kbd> dismissal). Zero network requests on hover.
- **Interactive Live News Dots**: Upgraded news pagination dots to accessible `<button class="news-dot" type="button" role="tab">` controls within a `role="tablist"` container. Hovering any dot previews the publisher and relative article age; clicking or pressing <kbd>Enter</kbd> / <kbd>Space</kbd> immediately transitions to that story and resets the rotation timer.
- **Polar Resilience & Timezone Alignment**: Formats all solar and lunar instants using explicit IANA timezone identifiers with cached formatters, handling polar day (midnight sun) and polar night without invalid date representations.

### Version 0.7.1 — Hover Tooltip Restoration, Clean Moon Ephemeris & Hardware Efficiency
- **Restored Mouse Hover Tooltips Across All Cards**: Restored native hover tooltips across all 9 HUD & companion cards (`#hud-weather-card`, `#hud-metrics-row`, `#hud-forecast-card`, `#hud-ephemeris-card`, `#hud-aqi-card`, `#hud-hw-block`, `#hud-news-block`, `#pomodoro-card`, and `#media-card`) with rich static labels in HTML and zero-allocation dynamic DOM `.title` attribute updates on incoming telemetry.
- **Interactive SVG Forecast Tooltips**: Hourly forecast data points and value labels now feature descriptive SVG `<title>` elements and tooltips detailing time, metric values, and units for instant cursor inspection.
- **Eliminated Moon Badge Artifact & Horizontal Line**: Redesigned `.moon-badge` to be transparent, borderless, and shadowless, completely removing the horizontal box outline and button appearance artifact during New Moon phases. Added automatic suppression during nighttime to eliminate duplication with the active night ephemeris row.
- **Zero-Allocation ParticleEngine Optimization**: Completely purged 6 unused `Float32Array` buffers (`stX`, `stY`, `stSize`, `stBaseAlpha`, `stPhase`, `stSpeed`) and dead loop passes from `js/particles.js`, reducing heap allocations and maximizing memory efficiency on integrated GPUs.
- **Production Audit & NFR Compliance**: Validated full adherence to `DESIGN_BLUEPRINT.md` functional and non-functional requirements: verified zero GC allocations during 60 FPS animation loop execution, zero-overhead parked state (0% CPU/GPU), and 100% test pass rate across all 8 regression suites.

### Version 0.7 — Targeted Hardening, Lifecycle & Performance
- **Static Scene RAF Parking & 60 FPS Cap**: The 60 FPS animation loop halts completely (0% CPU/GPU load) when the scene is static (no active precipitation, splashes, or audio), waking immediately on music or weather events, and strictly caps frame rates at 60 FPS.
- **Data Integrity & Stale News Isolation**: Delayed regional news responses merge into active snapshots without overwriting newer weather data. Missing air quality data is never fabricated (strictly displays `--` / `Unavailable`).
- **Privacy & Security Protection**: All API keys, tokens, and query parameters are automatically redacted (`?[redacted]`) from error logs and timeout rejections.
- **Occluded Audio Visualizer Sleep**: Sound spectrum processing sleeps immediately when the companion dock or media player is hidden, eliminating wasted CPU cycles.
- **Responsive Viewport Collision Clearance**: Prevents HUD and media dock collisions on compact laptop displays (< 600px height) across all 9 HUD positions with responsive media queries.
- **Smooth Particle Dynamics**: Precipitation transitions smoothly lerp velocity and sizing without garbage collection pauses, and newly activated particle slots initialize cleanly on snow density increases.
- **Coalesced Resizing & Backing-Store Protection**: Window resizing coalesces via requestAnimationFrame, debounces contrast sampling, and avoids unnecessary canvas backing store allocations.
- **Accessible Detail Drawer**: Modal dialog traps keyboard focus (Tab / Shift+Tab), dismisses cleanly on Escape, and returns focus to the triggering card.
- **Failure-Safe Release Packaging**: Release packager uses atomic backup (`.bak`) and automatic rollback to prevent corrupted archive distributions.

### Version 0.6.6 — Night Wallpaper Illumination & Clean Presentation
- **Night Wallpaper Illumination**: Re-engineered the deep night solar lighting profile to keep background wallpaper photography bright, clear, and visible after dark. Replaced shadow-crushing `multiply` blending with non-destructive `soft-light` (opacity `0.40`), raised night wallpaper baseline brightness to `0.86`, normalized contrast to `1.02`, and eliminated unnatural 185° color hue distortion.
- **Moonlit Celestial Bloom**: Added a soft silvery-blue celestial bloom (`rgba(219, 234, 254, 0.22)` at opacity `0.18`) delivering gentle natural night luminescence across the sky and scene.
- **Synthetic Starfield Elimination**: Completely removed artificial twinkling star canvas dots from the wallpaper UI, saving CPU and GPU canvas draw calls on every 60 FPS animation frame while keeping weather precipitation (rain, snow, splashes) fully active.
- **Nocturnal Vignette Tuning**: Widened the clear central aperture to 55% and reduced edge vignette darkening from `0.48` to `0.22` during nocturnal hours to maintain center and midtone illumination.

### Version 0.6.4 — GDELT News, Moon Ephemeris & Contextual HUD Details
- **Location-Based Regional News (GDELT DOC 2.0)**: Direct, keyless, and proxy-free regional news ingestion using the GDELT DOC 2.0 API. Formulates location queries with city alias matching, cleans and deduplicates stories, and opens direct publisher articles instead of aggregator redirects, with graceful fallback to Google News RSS.
- **Astronomy & Offline Moon Ephemeris**: Replaced static nighttime displays with an active Day/Night celestial ephemeris row. Daytime showcases Sunrise, Solar Noon, and Sunset; Nighttime dynamically displays Moonrise, Moon Phase, and Moonset computed entirely offline via bundled `SunCalc.getMoonTimes`. Includes lunar cycle age, illumination percentage, traditional Western full moon names (Harvest Moon, Wolf Moon), cultural Vedic Purnima names, and active meteor shower trackers.
- **Contextual Card Detail Drawer**: Click or press <kbd>Enter</kbd> on any card (Weather, Forecast, Regional News, Air Quality, Hardware, Battery, Ephemeris, Music Player, Pomodoro) to slide open an accessible acrylic glass telemetry drawer showing rich grounded metrics. Dismiss instantly with <kbd>Esc</kbd> or click outside. Zero per-frame memory allocation or hover fetching.
- **9 Flexible HUD Positions**: Added Middle Right, Middle Left, Middle Top, Middle Bottom, and Center Screen options across Lively Properties, `config.js`, and CSS layout engines without dock collisions.
- **Media Player Identity**: Intelligently identifies media player applications (Spotify, Apple Music, Edge, Chrome, etc.) from Windows SMTC sessions with neutral fallback, documenting host requirements for Windows AppUserModelId (AUMID) forwarding.

### Version 0.6.3 — Layout & Readability Refinements
- **Compact Temperature Grouping**: Replaced the wide gap between the temperature and condition details with an integrated, cohesive weather header. Current temperature, condition description, "feels like", and high/low values now sit side-by-side naturally.
- **High-Legibility Forecast Chart**: Upgraded forecast tab buttons with clear, concise labels (`Temp`, `Feels`, `Precip`, `Wind`, `Humidity`, `AQI`) and larger typography. Enhanced SVG chart value and time labels with crisp stroke outlines for effortless reading across 720p, 1080p, 1440p, and 4K displays.
- **Adaptive News Panel**: The Regional News Dispatch panel now sizes itself to fit its content naturally without reserving empty space. Supports up to 3 lines of headlines and dynamically shows pagination dots only when multiple stories are present.
- **Balanced Hardware Telemetry**: Relaxed row padding and spacing across CPU, GPU, RAM, Disk, and Network monitors to give them comfortable breathing room.

### Version 0.6.2 — Reliability & Hardening Updates
- **Smart Pause & Resume**: Local Wally strictly respects when Lively pauses wallpaper playback (such as during gaming), never waking prematurely and resuming cleanly with fresh data upon return.
- **True Deep Sleep**: Canvas drawing operations and audio visualizers completely park themselves and clear memory when sleeping or disabled, preventing frozen frames.
- **Accurate Time Alignments**: Fixed 24-hour forecast alignment across timezones and midnight transitions, and preserved honest outage reporting without fabricating data.
- **Defensive Number Protection**: All system telemetry and weather feeds strictly reject invalid numbers (`NaN` or `Infinity`) before rendering.
- **Responsive Screen Adaptation**: Dynamically adjusts offsets so the dashboard never clips or overflows on compact displays (like 720p or 768p laptop screens).

---

## 💻 System Requirements

- **Operating System**: Windows 10 (Build 19041+) or Windows 11 (64-bit).
- **Wallpaper Host**: [Lively Wallpaper](https://rocksdanister.github.io/lively/) v2.0 or newer.
- **Hardware**: Works smoothly on any modern PC with integrated graphics (Intel Iris Xe / Arc, AMD Radeon) or dedicated gaming graphics (NVIDIA GeForce, AMD Radeon RX).
- **Memory Footprint**: Extremely light (< 60 MB RAM).

---

## 📄 License

Local Wally HUD is open-source software licensed under the [MIT License](LICENSE).

Copyright (c) 2026 [Ravi Baskaran](https://github.com/ravibaskaran).
