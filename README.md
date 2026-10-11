# Local Wally HUD

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%2011%20%7C%20Lively%20Wallpaper-0078d4.svg)](#)
[![Performance](https://img.shields.io/badge/Performance-60%20FPS%20%7C%200%25%20Idle%20CPU-success.svg)](#)
[![Zero API Keys](https://img.shields.io/badge/API%20Keys-Zero%20Config%20Required-brightgreen.svg)](#)

> **Hardware-Accelerated Ambient Weather Wallpaper & Live Bento HUD for Windows 11 & Lively Wallpaper**

Local Wally HUD is a production-grade, hyper-optimized ambient desktop wallpaper built for the Windows 11 Chromium WebView2 runtime inside [Lively Wallpaper](https://rocksdanister.github.io/lively/). It combines real-time celestial ephemeris calculations, atmospheric telemetry (WMO weather and European Air Quality Index), contextual resolution-matched photography, live system hardware monitoring, regional news dispatches, and a zero-allocation procedural precipitation particle simulation into a unified, desktop-friendly interface.

---

## 🌟 Why Local Wally Was Created

Traditional live wallpapers are notorious resource hogs: heavy video playback loops, unconstrained WebViews, and unthrottled JavaScript timers that chew 5–15% CPU, trigger laptop battery drain, and cause micro-stutter during gaming.

**Local Wally was engineered from the silicon up to solve this:**
1. **Zero Garbage Collection (GC) Pressure**: The 60 FPS animation loop achieves zero per-frame heap allocations through contiguous TypedArrays structured as a **Struct-of-Arrays (SoA)** and ring-buffer recycling.
2. **True 0.0% Host Lifecycle Parking**: Seamless integration with Lively Wallpaper's native IPC drops CPU and GPU utilization to absolute 0.0% whenever occluded, minimized, or when running full-screen games.
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

### ☀️ macOS-Style Dynamic Solar Lighting & Physical Shadow Engine
- **Astronomical Solar Vector Projection**: Computes real-time solar altitude ($\alpha$) and azimuth ($\theta$) angles continuously via `SunCalc`.
- **Directional Shadow Projection**: Casts realistic solar drop shadows ($\Delta x = -\sin(\theta) \cdot d$, $\Delta y = \cos(\theta) \cdot d$) beneath all Bento cards that shift naturally throughout the day.
- **4-Tier Diurnal Chromatic Landscape Grading**: Smoothly maps celestial angles to CSS Custom Properties (`--dynamic-wallpaper-filter`, `--dynamic-card-shadow`, `--dynamic-vignette-gradient`) across Daylight, Golden Hour, Twilight, and Moonlight Night.
- **Zero Frame-Drop Transitions**: Visual changes are executed with a GPU-composited 3-second cubic-bezier transition, guaranteeing zero CPU spikes during color and lighting shifts.

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

### 🌦️ Comprehensive Atmospheric & Ephemeris Telemetry
- **Zero-Config Geolocation**: HTML5 GPS with a 4s timeout $\to$ silent IP geolocation fallback $\to$ offline astronomical default.
- **Open-Meteo Weather Forecast**: Current temperature, apparent "feels like", daily high/low, WMO weather interpretation, relative humidity, wind speed, and precipitation.
- **European Air Quality Index (AQI)**: Continuous AQI level rating, chromatic status badge, gradient progress bar, and PM2.5 / PM10 density readouts.
- **SunCalc Ephemeris**: Real-time solar altitudes (Sunrise, Solar Noon, Sunset) and lunar phase calculation with moon glyphs (🌑 to 🌘) and exact illumination percentages.

### 💻 Host Hardware Telemetry HUD
- Integrates Lively's native `--system-information` IPC stream.
- Renders live CPU, GPU 3D, RAM (used/total & %), and storage usage with lightweight Unicode text-track sparklines (` ▂▃▄▅▆▇█`).
- Includes an automatic 10-second fallback ticker when previewing outside Lively.

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
     - **Show Regional News Feed**: Toggles the regional Google News RSS block.
     - **Show Hardware Monitor**: Toggles CPU/GPU/RAM/Disk telemetry monitor.
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
  showCelestial: true,                  // Toggles SunCalc Solar & Lunar Ephemeris card
  showAqi: true,                        // Toggles European Air Quality Index (AQI) card
  showEnvironmentalMetrics: true,       // Toggles Humidity/Wind/Precip 3-card row
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

## 🛠️ System Requirements

- **Operating System**: Windows 10 (Build 19041+) or Windows 11 (64-bit).
- **Host Application**: [Lively Wallpaper](https://rocksdanister.github.io/lively/) v2.0 or higher.
- **Hardware Target**: Modern CPUs with Integrated GPUs (AMD Radeon 800M/700M/600M, Intel Iris Xe/Arc) or Discrete GPUs (NVIDIA GeForce/RTX, AMD Radeon RX).
- **RAM**: Minimal footprint (< 60 MB browser process).

---

## 📄 License

This project is open-source software licensed under the [MIT License](LICENSE).

Copyright (c) 2026 [Ravi Baskaran](https://github.com/ravibaskaran).
