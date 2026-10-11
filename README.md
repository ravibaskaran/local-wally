# Local Wally HUD

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%2011%20%7C%20Lively%20Wallpaper-0078d4.svg)](#)
[![Performance](https://img.shields.io/badge/Performance-60%20FPS%20%7C%20Quiescent%20Parked%20Lifecycle-success.svg)](#)
[![Zero API Keys](https://img.shields.io/badge/API%20Keys-Zero%20Config%20Required-brightgreen.svg)](#)

> **Hardware-Accelerated Ambient Weather Wallpaper & Live Bento HUD for Windows 11 & Lively Wallpaper**

Local Wally HUD is a production-grade, hyper-optimized ambient desktop wallpaper built for the Windows 11 Chromium WebView2 runtime inside [Lively Wallpaper](https://rocksdanister.github.io/lively/). It combines real-time celestial ephemeris calculations, atmospheric telemetry (WMO weather and European Air Quality Index), contextual resolution-matched photography, live system hardware monitoring, regional news dispatches, and a zero-allocation procedural precipitation particle simulation into a unified, desktop-friendly interface.

---

## 🌟 Why Local Wally Was Created

Traditional live wallpapers are notorious resource hogs: heavy video playback loops, unconstrained WebViews, and unthrottled JavaScript timers that chew 5–15% CPU, trigger laptop battery drain, and cause micro-stutter during gaming.

**Local Wally was engineered from the silicon up to solve this:**
1. **Zero Garbage Collection (GC) Pressure**: The 60 FPS animation loop achieves zero per-frame heap allocations during particle physics simulation and audio spectrum rendering through contiguous TypedArrays structured as a **Struct-of-Arrays (SoA)**, frozen geometry constants, and ring-buffer recycling.
2. **Quiescent Host Lifecycle Parking**: Seamless integration with Lively Wallpaper's native IPC halts the animation loop (`cancelAnimationFrame`), suspends background tickers, and sleeps the visualizer/Pomodoro canvas whenever occluded, minimized, or when running full-screen games (~0% CPU).
3. **Desktop-Friendly Side-by-Side Bento Grid**: The HUD is positioned on the right half of widescreen displays (1080p, 1440p, 1600p, 4K), keeping traditional Windows desktop icons on the left 100% unobstructed with zero vertical scrolling.
4. **Zero-Key Zero-Config Out-of-the-Box**: Works instantaneously without requiring developer API keys or accounts.

---

## 🚀 Key Features

### 🎵 Universal Windows Media Canvas & 60 FPS Visualizer
- **Native Windows SMTC Integration**: Leverages Lively's native `livelyCurrentTrack(data)` interface to extract track titles, artist metadata, and Base64 album art across Spotify, YouTube Music, Apple Music, Amazon Music, Gaana, or active browser tabs.
- **Real-Time 32-Band Psychoacoustic Spectrum**: Consumes Lively's 60 FPS `livelyAudioListener(audioArray)` 128-bin FFT stream, mapped to 32 logarithmic bands ($A \cdot (e^{\alpha \cdot i} - 1)$) with smooth ballistic decay (0.65 attack, 0.88 decay) and dual-tone gradients.
- **Zero-Overhead Silence Sleeping**: Continuously monitors audio energy $\sum A_k$. If silent ($< 0.005$) for $\ge 90$ frames (~1.5s), the visualizer enters deep sleep, halts rendering, clears the canvas, and uses **0.0% CPU/GPU** until audio resumes.
- **Demo / Preview Mode**: Press <kbd>M</kbd> in any browser to cycle through mock demo tracks (Synthwave, Lo-Fi, Ambient) with a procedurally generated audio spectrum.

### ⏱️ Performant Pomodoro Countdown HUD
- **Canvas 2D Radial Arc Countdown**: Renders smooth countdown arcs via hardware-accelerated Canvas 2D vectors (`ctx.arc()`) with rounded caps and mode-based gradients (Emerald $\to$ Sky Blue for Focus; Warm Gold $\to$ Rose for Breaks).
- **Drift-Free Wall-Clock Precision**: Uses timestamp calculations (`Date.now()`) to eliminate timer drift caused by JavaScript interval jitter or CPU throttling.
- **Lively Lifecycle Aware**: When applications are maximized or the wallpaper is backgrounded, ticking is safely suspended (0 CPU wakeups) and seamlessly recalculates remaining time upon returning to the desktop.
- **Interactive Background Controls**: Toggle Start/Pause (<kbd>P</kbd> or click), Reset, and switch modes (25m Focus, 5m Short Break, 15m Long Break) without reloading or losing state.

### ☀️ Procedural Solar Lighting Blended On Top of Unsplash & Directional Shadows
- **Layer 1.5 Composited Procedural Lighting**: Real-time atmospheric lighting engine composited directly atop active Unsplash landscape photography without needing gigabytes of static video or pre-rendered frames:
  - **Directional Solar Corona (`#solar-light-bloom`)**: High-intensity radial sunlight flare and atmospheric corona computed at normalized solar coordinates $(X, Y)$ using `mix-blend-mode: screen`. Transitions smoothly across Sunrise/Sunset amber/rose (`rgba(251, 146, 60, 0.65)` to `rgba(244, 63, 94, 0.0)`), Golden Hour radiant warm gold (`rgba(253, 224, 71, 0.55)`), and High Noon white-cerulean daylight (`rgba(254, 240, 138, 0.45)`).
  - **Diurnal Atmospheric Ambient Wash (`#solar-ambient-wash`)**: Full-screen chromatic wash adapting to diurnal solar phase—Golden Hour soft amber (`rgba(245, 158, 11, 0.22)`), Sunset/Dusk violet-crimson (`rgba(194, 65, 12, 0.28)`), Twilight cobalt indigo (`rgba(30, 27, 75, 0.35)`), and Deep Night obsidian/slate (`rgba(2, 6, 23, 0.55)`) with `mix-blend-mode: multiply` to deepen landscape shadows while preserving UI legibility.
- **Zero-Pop-In Startup Wallpaper Restore**: Immediately restores cached wallpaper URLs and photographer credits from `localStorage` on `App.init()`, eliminating initial startup flash, blank desktop screens, and raw backdrop pop-in on boot.
- **Astronomical Solar Vector Projection**: Computes real-time solar altitude ($\alpha$) and azimuth ($\theta$) angles continuously via `SunCalc` ($X = 50 + 42\sin\theta\%$, $Y = 50 - 42\sin\alpha\%$).
- **Directional Shadow Projection**: Casts realistic solar drop shadows ($\Delta x = -\sin(\theta) \cdot d$, $\Delta y = \cos(\theta) \cdot d$) beneath all Bento cards that shift naturally throughout the day.
- **Zero Frame-Drop GPU Compositing**: Visual changes are executed with a GPU-composited 3-second cubic-bezier transition, guaranteeing **0.0% idle CPU overhead** during lighting and color shifts.

### 🪟 Wallpaper-Adaptive Glassmorphism Contrast Engine
Incoming wallpapers vary dramatically in tonal range—from dark starry nights to high-key midday skies or snowy horizons.
- **Geometric Bounding-Box Sampling**: Samples the exact region of the wallpaper positioned behind the HUD using an offscreen downscaled $24 \times 16$ canvas.
- **ITU-R BT.709 Perceived Luminance**: Computes perceived luminance ($Y = 0.2126R + 0.7152G + 0.0722B$).
- **Dynamic Contrast Switching**: When $Y > 0.52$ (bright backgrounds), the HUD smoothly transitions to **Light Glass Theme** with high-contrast deep slate typography (`#0f172a`), maintaining complete legibility. On dark backgrounds ($Y \le 0.52$), it defaults to dark acrylic with crisp white typography.
- **Zero Animation Overhead**: Sampling executes only once per wallpaper swap (every 15 minutes) or on repositioning—never in the render loop.

### ⚡ Universal Hardware Strategy (iGPU vs. dGPU)
- **Automatic GPU Introspection**: Queries `WEBGL_debug_renderer_info` at startup.
- **iGPU / UMA Protection**: On integrated GPUs (AMD Radeon 800M/700M/600M, Intel Iris Xe/Arc, Qualcomm Adreno), clamps Device Pixel Ratio (DPR) to `1.0` to conserve shared LPDDR5X memory bandwidth and fill rate.
- **dGPU Supersampling**: On discrete GPUs (NVIDIA GeForce/RTX, AMD Radeon RX), dynamically scales up to `1.5` DPR for high-fidelity supersampling on dedicated VRAM.

### 📐 Dynamic 1:1 Pixel Native Resolution Matching
Automatically derives the display's native physical resolution (`screen.width * dpr`, `screen.height * dpr`) and requests resolution-tailored wallpaper imagery (`&w=${width}&h=${height}&fit=crop&q=85`), eliminating texture scaling blur and unnecessary GPU memory consumption.

### 🌦️ Multi-Provider Atmospheric Telemetry & Adapters
- **Pluggable Multi-Provider Weather Engine**: Switch seamlessly between:
  - **Open-Meteo (`open-meteo`)** - Default, keyless, high-precision global models.
  - **MET Norway / Yr.no (`met-norway`)** - Keyless European model with strict User-Agent headers and CORS fallbacks.
  - **OpenWeatherMap (`openweathermap`)** - Supports OpenWeatherMap One Call 3.0 (1,000 free calls/day tier) with automatic fallback to 2.5 5-day/3-hour forecast and keyless Open-Meteo on missing or invalid keys.
- **Multi-Provider Air Quality Engine**:
  - **Open-Meteo AQI (`open-meteo`)** - Keyless European AQI & PM2.5/PM10 timeseries.
  - **WAQI / AQICN (`waqi`)** - Metropolitan ground-station sensors with automatic US EPA-to-European AQI index conversion.
- **Zero-Config Geolocation & Stream-Guarded Timeouts**: HTML5 GPS with a 4s timeout $\to$ silent IP geolocation fallback $\to$ offline astronomical default. All network calls enforce stream-aware `AbortController` timeouts covering full response body consumption to prevent hanging.
- **SunCalc Ephemeris**: Real-time solar altitudes (Sunrise, Solar Noon, Sunset) and lunar phase calculation with moon glyphs (🌑 to 🌘) and exact illumination percentages.

### 📊 Google-Style Space-Efficient Multi-Tab SVG Forecast Chart HUD
- **Zero-Reflow Layout Containment**: Strict `contain: layout paint;` containment guarantees that forecast updates and tab toggling never trigger layout reflows across the Bento grid.
- **8-Sample Chronological Projection Across 24h Horizon**: Atmospheric timeseries (24 hours) are normalized and chronologically downsampled into 8 discrete forecast points (+0h to +21h at 3-hour increments) to fit the compact SVG viewBox without label collision.
- **Keyboard Navigation & Roving Tabindex**: Tabs implement full keyboard accessibility (<kbd>←</kbd> / <kbd>→</kbd> / <kbd>Home</kbd> / <kbd>End</kbd>) with roving `tabindex="0"` on the active tab and `:focus-visible` styling.
- **6 Switchable Telemetry Tabs**:
  - 🌡️ **Temperature (`temp`)**: Amber gradient curve with high/low bounds padding.
  - 🔥 **Feels Like (`feels_like`)**: Warm coral gradient curve tracking apparent temperature telemetry.
  - 🌧️ **Precipitation (`precip`)**: Sky blue probability curve (0–100%).
  - 💨 **Wind Speed (`wind`)**: Emerald wind velocity trajectory in km/h or mph.
  - 💧 **Humidity (`humidity`)**: Purple relative humidity curve (0–100%).
  - 🍃 **Air Quality (`aqi`)**: Color-coded categorical risk points (Good, Fair, Moderate, Poor, Very Poor).
- **Catmull-Rom Cubic Bezier Splines & Defensive Normalization**: Smooth vector paths rendered in an inline `<svg viewBox="0 0 520 120">` with pre-render finite value sanitization (enforcing safe numbers while preserving valid zero and negative values) and clamped control points preventing clipping.
- **Pre-Allocated Element Pool & Typed Buffers**: Dots, labels, and axes are pre-allocated in SVG object pools, while coordinates reuse contiguous `Float32Array` buffers on `SvgForecastChartEngine`, eliminating per-render DOM rebuilds.

### 💻 Host Hardware Telemetry & High-Fidelity SVG Sparklines
- **Minimalist Hardware-Accelerated SVG Sparklines**: Replaces unicode text-track sparklines with crisp 1.5px anti-aliased inline vector paths (`<svg viewBox="0 0 80 20">`) featuring smooth cubic Bezier / Catmull-Rom interpolation across a 40-point ring buffer (`Float32Array(40)`) and subtle vertical gradient area fills. Operates at **0.0% noticeable CPU overhead** with zero memory allocations during rendering.
- **Dual-Channel Network Bandwidth Telemetry**: Separate live telemetry rows for **Net Down** and **Net Up** with automatic human-relatable unit scaling (`< 1000 Kbps` $\to$ `X Kbps`, `< 1000 Mbps` $\to$ `X.X Mbps`, `≥ 1000 Mbps` $\to$ `X.XX Gbps`) and dedicated vector sparklines.
- **Physical Laptop Battery Telemetry Guard**: Real-time battery status monitoring (percentage, multi-tier charging progress bar, charging pulse badge ⚡/🔋). Includes an intelligent **Desktop PC Filter** that detects desktop Chromium WebView2 dummy battery profiles (`level === 1.0, charging === true, dischargingTime === Infinity`) and completely hides the row (`display: none !important;`) on desktop systems without wasting HUD space.
- **Lively Telemetry Integration**: Binds natively to Lively's `--system-information` IPC stream (`livelySystemInformation(data)`) for CPU, GPU 3D, RAM (used/total & %), Disk NVMe, and network adapter throughput, with an automatic organic fallback simulator when previewed outside Lively.

### 📰 Proximity-Targeted Regional News Feed
- Ingests regional Google News RSS feeds via native browser XML `DOMParser()` and timeout-guarded CORS gateways.
- Extracts top 5 clean headlines, cached inside the 15-minute firewall, smoothly rotated every 7 seconds with CSS opacity transitions.

---

## 📦 Installation & Setup

### Method 1: 1-Click Drag-and-Drop Install via `local-wally.zip` (Fastest)

1. **Download the Release**: Download `local-wally.zip` from the [Latest GitHub Release](https://github.com/ravibaskaran/local-wally/releases).
2. **Drag & Drop**: Open Lively Wallpaper and drag `local-wally.zip` straight into the Lively window.
3. **Done!** Lively Wallpaper natively extracts, validates, and adds **Local Wally HUD** to your library. Click it to set as active.

---

### Method 2: Manual Folder Install

1. **Clone or Download**:
   ```bash
   git clone https://github.com/ravibaskaran/local-wally.git
   ```
2. **Add to Lively Wallpaper**:
   - In Lively, click **Add Wallpaper** (`+`).
   - Click **Browse** and select the `local-wally` directory (or drag the folder into Lively).
   - Click **OK** to add to your library.
3. **Customize via Lively Settings**:
   - Right-click the wallpaper in Lively and choose **Customise Wallpaper**:
     - **HUD Position**: Top Right (default), Top Left, Bottom Right, Bottom Left.
     - **Weather Provider**: Open-Meteo (default, keyless), MET Norway (keyless), OpenWeatherMap (keyed).
     - **OpenWeatherMap API Key**: Optional API key for OpenWeatherMap integration.
     - **Air Quality Provider**: Open-Meteo (default, European AQI), WAQI (World Air Quality Index, keyed).
     - **WAQI API Key / Token**: Optional token for WAQI integration.
     - **Show 24-Hour Forecast Chart**: Toggles the Google-style multi-tab SVG forecast chart HUD.
     - **Default Forecast Tab**: Temperature, Feels Like, Precipitation, Wind, Humidity, or Air Quality.
     - **Show Regional News Feed**: Toggles the regional Google News RSS block.
     - **Show Hardware Monitor**: Toggles CPU/GPU/RAM/Disk telemetry monitor.
     - **Show Network Bandwidth (Upload/Download)**: Toggles live network telemetry rows.
     - **Show Laptop Battery Telemetry**: Toggles battery status row (auto-hidden on desktop PCs).
     - **Show Solar & Lunar Ephemeris**: Toggles astronomical SunCalc ephemeris card.
     - **Show Air Quality Index (AQI)**: Toggles European AQI card.
     - **Show Environmental Metrics**: Toggles humidity/wind/precip row.
     - **Show Media & Focus Dock**: Toggles the companion Bento Dock.
     - **Show Pomodoro Focus Timer**: Toggles Pomodoro Focus Timer in companion dock.
     - **Show Media Player & Visualizer**: Toggles Windows SMTC media player card.
     - **Pomodoro Focus Duration**: 5 to 60 minutes (default: 25).
     - **Pomodoro Break Duration**: 1 to 15 minutes (default: 5).
     - **Enable Audio Visualizer**: 60 FPS 32-band spectrum toggle.
     - **Dynamic Solar Lighting & Shadows**: macOS-style celestial vector lighting.
     - **Glass Blur**: 0px to 40px (default: 14px).
     - **Particle Density Multiplier**: 0.2x to 2.0x.
     - **Temperature Unit**: Celsius (°C) or Fahrenheit (°F).
     - **Data Refresh Interval**: 5 to 30 minutes (default: 15 minutes).
     - **Glass Contrast Theme**: Auto (Wallpaper-Adaptive), Dark Glass, Light Glass.

---

### Method 3: Standalone Browser Preview

You can preview and test Local Wally in any modern Chromium browser (Microsoft Edge, Google Chrome, Brave):

1. Open a terminal in the project directory:
   ```bash
   node serve.js
   ```
2. Open your browser to:
   ```
   http://localhost:8080/
   ```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|:---:|---|
| <kbd>P</kbd> | Toggle Pomodoro Focus Timer **Start / Pause** without reloading. |
| <kbd>M</kbd> | Cycle mock demo media tracks (**Synthwave $\to$ Lo-Fi $\to$ Ambient $\to$ Idle SMTC**) in browser preview. |
| <kbd>D</kbd> | Toggle real-time Diagnostics Overlay (GPU tier, FPS, frametime, particle count, cache TTL, contrast mode). |
| <kbd>C</kbd> | Cycle Glass Contrast Mode (`Auto (Adaptive)` $\to$ `Dark` $\to$ `Light`). |
| <kbd>R</kbd> | Force immediate atmosphere & wallpaper synchronization (bypasses 15-minute cache). |
| <kbd>T</kbd> | Toggle temperature units between Celsius (°C) and Fahrenheit (°F). |

---

## ⚙️ External Configuration (`config.js`)

For advanced users or portable deployments without Lively, all key parameters are exposed in `config.js` with human-readable comments on every line:

```javascript
window.LOCAL_WALLY_CONFIG = {
  refreshIntervalMinutes: 15,          // 5 to 30 minutes
  hudPosition: 'top-right',             // 'top-right', 'top-left', 'bottom-right', 'bottom-left'
  glassBlurPx: 14,                      // 0 to 40 px
  glassSaturationPct: 190,              // 100% to 250%
  tempUnit: 'C',                        // 'C' or 'F'
  newsRotateIntervalSeconds: 7,         // 3 to 60 seconds
  hwUpdateIntervalSeconds: 10,          // 1 to 60 seconds
  unsplashApiKey: '',                   // Optional user API key
  maxPrecipitationParticles: 1800,      // 200 to 3500 particles
  contrastMode: 'auto',                 // 'auto', 'dark', 'light'
  showNewsFeed: true,                   // Toggles Regional Google News RSS block
  showHardwareMonitor: true,            // Toggles CPU/GPU/RAM/Disk hardware monitor
  showNetworkUsage: true,               // Toggles upload & download network bandwidth rows
  showBatteryInfo: true,                // Toggles laptop battery telemetry (auto-hidden on desktop PCs)
  showCelestial: true,                  // Toggles SunCalc Solar & Lunar Ephemeris card
  showAqi: true,                        // Toggles European Air Quality Index (AQI) card
  showEnvironmentalMetrics: true,       // Toggles Humidity/Wind/Precip 3-card row
  weatherProvider: 'open-meteo',        // 'open-meteo', 'met-norway', 'openweathermap'
  openweathermapApiKey: '',             // Optional API key for OpenWeatherMap
  aqiProvider: 'open-meteo',            // 'open-meteo', 'waqi'
  waqiApiKey: '',                       // Optional API token for WAQI (AQICN)
  showForecastChart: true,              // Toggles 24-hour SVG forecast chart HUD
  defaultForecastTab: 'temp',           // 'temp', 'feels_like', 'precip', 'wind', 'humidity', 'aqi'
  showMediaFocusDock: true,             // Companion Bento Dock toggle
  showPomodoro: true,                   // Toggles Pomodoro Focus Timer card
  showMediaPlayer: true,                // Toggles Windows SMTC Media Player card
  pomodoroFocusMinutes: 25,             // 1 to 60 minutes
  pomodoroBreakMinutes: 5,              // 1 to 30 minutes
  pomodoroLongBreakMinutes: 15,         // 1 to 60 minutes
  enableAudioVisualizer: true,          // 60 FPS 32-band spectrum
  enableDynamicSolarLighting: true,     // macOS-style solar shadows
  defaultLocation: {                    // Offline fallback coordinates
    city: 'Tokyo',
    country: 'Japan',
    latitude: 35.6762,
    longitude: 139.6503
  }
};
```

---

## 📁 Project Architecture

```
local-wally/
├── config.js              # External human-readable configuration parameters
├── index.html             # Decoupled 5-layer DOM hierarchy & 2-column Bento Grid
├── LivelyInfo.json        # Lively Wallpaper manifest (--system-information enabled)
├── LivelyProperties.json  # Lively host customization schema
├── LICENSE                # MIT License
├── README.md              # Documentation & user guide
├── serve.js               # Lightweight local development HTTP preview server
├── thumbnail.jpg          # High-resolution Lively library preview thumbnail
├── css/
│   └── style.css          # Windows 11 Acrylic styling, adaptive contrast CSS tokens
└── js/
    ├── api.js             # Geolocation, Open-Meteo, Unsplash, Google News RSS ingestion
    ├── app.js             # Central orchestrator, 60 FPS loop, contrast engine, sparklines
    ├── cache.js           # 15-minute LocalStorage caching firewall & offline mock data
    ├── lively.js          # Host IPC bridge (playback parking, property listeners)
    ├── particles.js       # Zero-allocation Struct-of-Arrays (SoA) particle simulation
    ├── sky.js             # Dynamic celestial gradient & Sun/Moon placement
    └── suncalc.js         # Offline solar/lunar ephemeris math library
```

---

## 🛡️ v0.6.2 Production Audit Hardening & Defect Verification

Local Wally v0.6.2 incorporates comprehensive lifecycle, data correctness, UI layout, and tooling fixes validated across a 22-test audit regression suite (`scratch/test_audit_hardening.js`) and a 6-test post-audit verification suite (`scratch/test_post_audit_verification.js`):
- **Disentangled Lifecycle**: Host pause and document visibility state are decoupled; visibility changes cannot prematurely wake playback when paused by Lively. Added an idempotency guard on `LivelyBridge.init()`.
- **Suppressed Paused Telemetry & Recovery**: SMTC and audio callbacks ignore events during pause; late-arriving atmosphere updates are deferred in `pendingSnapshot`, settled background news is buffered in `pendingNews`, and SMTC track updates are buffered in `pendingTrack` for clean resumption upon unpause.
- **Deep Engine Sleep**: Canvas contexts are cleared when disabled or sleeping to prevent frozen frames; Pomodoro tickers pause when hidden; audio visualizer zeroes its 32-band spectrum on sleep to eliminate wake flashes.
- **Eliminated Visualizer Heap Allocation**: Visualizer bar corners reuse a frozen class constant (`MediaVisualizerEngine.BAR_RADII`), eliminating ~1,920 allocations/sec.
- **Smooth Particle Transitions**: Weather category and wind changes smoothly reconfigure existing particle velocities and phases without pop-in.
- **Throttled Solar Cadence**: Solar lighting updates are throttled to 15s with state guards preventing redundant style updates when disabled.
- **Timestamp-Joined AQI Forecast**: AQI forecast samples are chronologically matched across midnight rather than indexing by clock hour.
- **Accurate OWM Timeseries**: 3-hour forecast chunks from OpenWeatherMap 2.5 sample with `step = 1` (+21h horizon).
- **Honest Outages & Accurate Units**: Air quality outages report `Unavailable` without fabricating data; WAQI station indices retain their `AQI` unit.
- **Strict Number Validation**: System telemetry and weather metrics reject `NaN`, `Infinity`, and `-Infinity`.
- **Symmetric Responsive Layout**: Dynamically clamps both `--dock-top` and `--dock-bottom` offsets with media query adaptations to eliminate vertical clipping at 720p/768p viewports regardless of HUD anchor position.
- **Keyboard Accessible Tabs & Path Reset**: Forecast tabs feature roving `tabindex`, arrow key navigation, and focus outlines; empty forecasts reset SVG paths and pool visibility.
- **Hardened Preview Server & Packaging**: Host header checks, private file blocking, credential masking in logs, and atomic release packaging.

---

## 🛠️ System Requirements

- **Operating System**: Windows 10 (Build 19041+) or Windows 11 (64-bit).
- **Host Application**: [Lively Wallpaper](https://rocksdanister.github.io/lively/) v2.0 or higher.
- **Hardware Target**: Modern CPUs with Integrated GPUs (AMD Radeon 800M/700M/600M, Intel Iris Xe/Arc) or Discrete GPUs (NVIDIA GeForce/RTX, AMD Radeon RX).
- **RAM**: Minimal footprint (< 60 MB browser process).

---

## 📄 License

This project is open-source software licensed under the [MIT License](LICENSE).

Copyright (c) 2026 [Ravi Baskaran](https://github.com/ravibaskaran).
