# LOCAL WALLY HUD — SYSTEM DESIGN BLUEPRINT
**Hardware-Accelerated Ambient Weather Wallpaper for Windows 11 & Lively Wallpaper**

---

## 1. Executive Architectural Summary

`Local Wally HUD` is a production-grade, hardware-accelerated ambient wallpaper engine built for the **Windows 11 Chromium WebView2** runtime within **Lively Wallpaper**. It fuses real-time celestial ephemeris calculations, atmospheric telemetry (WMO weather and European Air Quality Index), contextual high-resolution photography, and a zero-allocation particle simulation into a unified desktop presentation.

### Core Architectural Directives
1. **Zero Garbage Collection (GC) Pressure**: The 60 FPS animation loop achieves zero per-frame heap allocations during particle physics simulation and audio spectrum rendering through contiguous TypedArrays structured as a **Struct-of-Arrays (SoA)**, frozen geometry constants, and ring-buffer recycling.
2. **Adaptive Hardware Tiering**: Differentiates Integrated GPUs (UMA / shared LPDDR5X memory) from Discrete GPUs (dedicated VRAM) at startup via WebGL introspection, automatically tuning the Device Pixel Ratio (DPR) to balance fill-rate conservation and visual fidelity.
3. **Dynamic 1:1 Pixel Native Resolution Matching**: Automatically derives native display physical pixel dimensions (`screen.width * dpr`, `screen.height * dpr`) and requests resolution-tailored wallpaper imagery (`&w=${width}&h=${height}&fit=crop&q=85`), eliminating client-side resampling artifacts and texture memory waste.
4. **Resilient Network Ingestion**: Multi-tier zero-configuration geolocation (HTML5 GPS with 4s timeout $\to$ silent IP lookup $\to$ hardcoded astronomical fallback) feeding keyless Open-Meteo weather and AQI endpoints.
5. **Caching Firewall**: Persistent client-side cache firewall with a configurable 5 to 30-minute Time-To-Live (TTL), strictly guarding against API rate-limiting, redundant network egress, and laptop battery drain.
6. **Quiescent Host Lifecycle Parking**: Seamless Lively Wallpaper host IPC integration halts the animation loop (`cancelAnimationFrame`), suspends background tickers, and sleeps the visualizer/Pomodoro canvas whenever occluded, minimized, or when full-screen applications/games are active, bringing application-level JavaScript load to a complete standstill (~0% CPU).
7. **Hardware Telemetry HUD & Text-Track Sparklines**: Direct host telemetry hook via Lively `--system-information` (`livelySystemInformation`), rendering rolling CPU, GPU 3D, RAM (used/total & %), and storage charts with zero-allocation Unicode sparklines (` ▂▃▄▅▆▇█`) and an automatic 10-second preview fallback ticker.
8. **Zero-Key Regional News Feed Dispatch**: Proximity-targeted Google News RSS ingestion via CORS gateways and native browser XML `DOMParser()`, normalized, cached inside the 15-minute firewall, and rotated smoothly every 7 seconds with CSS opacity transitions.
9. **Universal Windows Media SMTC Canvas & 60 FPS Visualizer**: Integrates native `livelyCurrentTrack(data)` and 60 FPS `livelyAudioListener(audioArray)` to extract live track/artist/artwork and render a 32-band downsampled frequency spectrum with automatic canvas clearing and sleep parking when silent.
10. **Performant Pomodoro Countdown HUD**: Lightweight offline JavaScript interval state timer with native Canvas 2D radial countdown arc vector rendering and direct background mouse toggles (zero page reloads).
11. **macOS-Style Dynamic Solar Lighting & Shadowing Engine**: Continuous SunCalc astronomical solar vector projection mapped to CSS Custom Properties, seamlessly adjusting wallpaper brightness, color temperature filters, and physical directional drop-shadows across day/night cycles without CPU spikes.

---

## 2. System Topology & Component Architecture

### 2.1 Topology Overview

```
+-----------------------------------------------------------------------------------+
|                            Lively Wallpaper Host (C#)                             |
|       - Playback Controller (livelyWallpaperPlaybackChanged)                       |
|       - Settings UI Property Broker (livelyPropertyListener)                     |
|       - Hardware Telemetry Stream (livelySystemInformation: --system-information) |
|       - Windows SMTC Media Controller (livelyCurrentTrack)                        |
|       - 60 FPS Audio Visualizer Stream (livelyAudioListener)                     |
+-----------------------------------------------------------------------------------+
                                         │
                                   IPC / WebView2
                                         ▼
+-----------------------------------------------------------------------------------+
|                         Local Wally HUD Orchestration                             |
+-----------------------------------------------------------------------------------+
  │                        │                                   │
  ▼                        ▼                                   ▼
[LivelyBridge]      [CacheManager]                       [App Orchestrator]
- Playback State    - LocalStorage Firewall             - 60 FPS Animation Loop
- Property Interop  - 5-30m Clamped TTL                 - Double-Buffered Swap
- Hardware Stream   - Emergency Fallbacks               - Diagnostics Overlay
- SMTC Media Stream - News & Weather Snapshot           - Hardware Sparkline Engine
- Audio Spectrum                                        - 7s News Rotation Dispatch
- Visibility API                                        - Adaptive Contrast Engine
                           │                            - macOS Solar Lighting Map
                           ▼                                   │
                    [ApiService]                               │
                    - Geolocation (GPS / IP)                   │
                    - Open-Meteo Weather                       │
                    - Open-Meteo AQI                           │
                    - Google News RSS (DOMParser)              │
                    - Resolution Matching (Unsplash)           │
                           │                                   │
                           └───────────────────────────────────┤
                                                               ▼
+-----------------------------------------------------------------------------------+
|                           Decoupled Presentation Stack                            |
+-----------------------------------------------------------------------------------+
| Layer 0: [SkyEngine]        -> Dynamic SunCalc Solar/Lunar Celestial Gradient     |
| Layer 1: [Double Buffer]    -> Cross-Fading Landscape Imagery (bg-a / bg-b)       |
|                             -> macOS Dynamic Solar Lighting & Shadow Engine       |
| Layer 2: [ParticleEngine]   -> SoA Canvas 2D Precipitation / Stars / Splashes     |
| Layer 3: [Bento Grid HUD]   -> 2-Column Windows 11 Acrylic Bento Telemetry:       |
|                                - Col 1: Clock/Location, Temp, Metrics, Ephemeris, |
|                                         European Air Quality Index                |
|                                - Col 2: Hardware Telemetry, Regional News Ticker, |
|                                         Sync Pulse & Manual Refresh               |
| Layer 4: [Media & Focus]    -> Companion Glass Bento Dock:                        |
|                                - Card 1: Pomodoro Canvas 2D Radial Countdown Ring |
|                                - Card 2: Windows SMTC Media & 60 FPS Spectrum     |
| Layer 5: [Telemetry/Attrib] -> Real-time GPU/FPS Diag Panel & Unsplash Credit     |
+-----------------------------------------------------------------------------------+
```

### 2.2 Component Directory & Manifest

| File | Subsystem | Memory Model | Key Responsibilities |
|---|---|---|---|
| `config.js` | External Configuration | Global Window | Human-readable configuration parameters (`window.LOCAL_WALLY_CONFIG`) with per-setting comments, default fallbacks, and range validations. |
| `LivelyInfo.json` | Host Configuration | Manifest | Declares `--system-information` argument enabling real-time host hardware telemetry streaming. |
| `index.html` | Presentation DOM | Static DOM | Decoupled 5-layer hierarchy, 2-column Bento Grid HUD, Lucide stroke line icons, diagnostic panel. |
| `css/style.css` | Compositing Engine | CSS Compositor | Hardware layer promotion (`translate3d`, `contain`), Bento Grid layout, Windows 11 typography, acrylic glassmorphism, sparkline typography. |
| `js/lively.js` | Host IPC Bridge | Event Emitter | Lively Wallpaper playback, property, and `livelySystemInformation` listeners; Visibility API fallback; config bridge. |
| `js/cache.js` | Caching Firewall | LocalStorage | Atomic snapshot serialization, configurable TTL (5-30 min), mock data generation including regional news dispatches and config default location. |
| `js/api.js` | Network Ingestion | Async Promises | Geolocation cascade, Open-Meteo REST queries, native resolution URL formatting, Google News RSS XML ingestion via native `DOMParser`, configured CORS proxies. |
| `js/particles.js` | Particle Simulation | Struct-of-Arrays | WebGL GPU profiling, Float32Array particle pools, ring-buffer splash simulation, batched draw calls, configured particle pool limits. |
| `js/sky.js` | Celestial Gradient | Interpolation | SunCalc astronomical calculations, solar altitude gradient interpolation, celestial disc placement. |
| `js/suncalc.js` | Astronomical Engine | Pure Math | Solar/lunar position, ephemeris times, and lunar illumination calculation library. |
| `js/app.js` | Central Orchestrator | State Machine | 60 FPS `requestAnimationFrame` loop, Bento Grid DOM updates, hardware sparkline text tracks, news carousel, ephemeris syncing, config parameter binding. |

---

## 3. Universal Hardware Strategy (iGPU vs. dGPU Adaptive Pipelines)

### 3.1 The Architecture Challenge: UMA vs. Dedicated VRAM

Modern portable Windows devices (such as AMD Ryzen AI 300 series APUs with Radeon 800M/700M/600M graphics, Intel Core Ultra with Iris Xe / Arc graphics, and Qualcomm Snapdragon X Elite with Adreno) use **Uniform Memory Architecture (UMA)** where CPU cores, NPU, and GPU execution units share a single LPDDR5X memory bus.
- At 2.5K (2560x1600) or 4K (3840x2160) resolutions with a default Windows display scaling of 150% or 200%, a canvas rendered at native device pixel ratio ($DPR \ge 1.5$) requires rasterizing up to **8.3 to 14.7 million pixels per frame**.
- At 60 FPS, this saturates system memory bandwidth, drives thermal throttling, and drains battery reserves.
- Conversely, discrete GPUs (NVIDIA GeForce RTX, AMD Radeon RX, Intel Arc dGPUs) have dedicated high-bandwidth GDDR6/GDDR6X buses (288 GB/s to 1,000+ GB/s) and can execute supersampling with negligible impact on CPU or system power.

### 3.2 WebGL Hardware Introspection (`detectGpuProfile`)

Before initializing the 2D canvas, `ParticleEngine.detectGpuProfile()` probes the underlying graphics subsystem using an off-screen WebGL context and the `WEBGL_debug_renderer_info` extension:

```javascript
var probeCanvas = document.createElement('canvas');
var gl = probeCanvas.getContext('webgl') || probeCanvas.getContext('experimental-webgl');
var debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
var unmaskedRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
var unmaskedVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
```

#### Classification Heuristics
1. **Discrete GPU (dGPU)**:
   - Matches: NVIDIA GeForce, RTX, GTX, Quadro, Titan, Tesla; AMD Radeon RX series, Radeon Pro (discrete); Intel Arc A-series / B-series (e.g., A770, A750, A580, A380, B580).
   - Action: Enables supersampling by setting $DPR = \min(\text{window.devicePixelRatio}, 1.5)$.
2. **Integrated GPU (iGPU / UMA)**:
   - Matches: AMD Radeon 800M / 700M / 600M (890M, 880M, 860M, 780M, 760M, 680M), AMD Radeon(TM) Graphics, Vega; Intel Iris Xe, Intel UHD, Intel HD, Intel Arc integrated (Meteor Lake / Lunar Lake); Qualcomm Adreno (Snapdragon X); ARM Mali; Apple Silicon UMA.
   - Action: Strictly clamps $DPR = 1.0$ to preserve shared memory bandwidth and eliminate fill-rate bottlenecks.

#### Context Resource Teardown
Once introspection is complete, the probe context is explicitly unbound using the `WEBGL_lose_context` extension to prevent GPU resource leaks in Chromium.

### 3.3 Optimized 2D Context Initialization

The main particle canvas context is initialized with high-performance Chromium hints:

```javascript
this.ctx = canvasElement.getContext('2d', {
  alpha: true,
  desynchronized: true,
  willReadFrequently: false
});
```

- `alpha: true`: Permits blending over the background landscape while maintaining GPU composite caching.
- `desynchronized: true`: Bypasses the desktop window manager (DWM) composition queue latency on Windows 11, routing frame buffers directly to the display scanout.
- `willReadFrequently: false`: Prevents Chromium Skia from allocating a CPU RAM shadow buffer for readback (e.g. `getImageData`), forcing the canvas backing store to reside entirely inside GPU VRAM.

### 3.4 Struct-of-Arrays (SoA) Zero-Allocation Memory Layout

Traditional JavaScript particle systems instantiate individual particle objects (`{ x, y, vx, vy, ... }`), resulting in memory fragmentation and constant Garbage Collection pauses during allocation/destruction.

`ParticleEngine` uses linear contiguous `Float32Array` buffers allocated once during instantiation:

```
Precipitation Buffer Pool (Float32Array, 1800 elements each):
[ pX     ] : [ x0,   x1,   x2,   ... x1799 ]
[ pY     ] : [ y0,   y1,   y2,   ... y1799 ]
[ pVx    ] : [ vx0,  vx1,  vx2,  ... vx1799 ]
[ pVy    ] : [ vy0,  vy1,  vy2,  ... vy1799 ]
[ pSize  ] : [ s0,   s1,   s2,   ... s1799 ]
[ pAlpha ] : [ a0,   a1,   a2,   ... a1799 ]
[ pAux   ] : [ osc0, osc1, osc2, ... osc1799 ]
```

- **Cache-Line Prefetching**: When the update loop iterates through particles, consecutive indices are contiguous in physical RAM, maximizing CPU L1/L2 data cache hits.
- **Batched Rendering Paths**: All active rain streaks are batched into a single path and committed with a single `ctx.stroke()`. All snow particles are batched and rendered with a single `ctx.fill()`.
- **Ring-Buffer Splash Pool**: Surface droplets recycle across 120 pre-allocated slots using modulo indexing (`splashRingIndex = (splashRingIndex + 1) % MAX_SPLASHES`), eliminating `Array.prototype.push` and `Array.prototype.splice`.

---

## 4. Data Pipelines & Geolocation Resiliency

### 4.1 Zero-Configuration Geolocation Flow

To provide true zero-configuration execution on any Windows PC, `ApiService.getLocation()` uses a three-tier fallback mechanism:

```
                     +-----------------------------+
                     |  Start Location Acquisition |
                     +-----------------------------+
                                    │
                                    ▼
                     +-----------------------------+
                     | Try navigator.geolocation   |
                     | 4000ms Hard Timeout         |
                     +-----------------------------+
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼ (Success)                         ▼ (Denied / Timeout)
        +-------------------+               +----------------------+
        | GPS Coordinates   |               | Fetch ipapi.co/json  |
        | Source: 'gps'     |               | (Silent HTTP fallback|
        +-------------------+               +----------------------+
                  │                                   │
                  │                         ┌─────────┴─────────┐
                  │                         ▼ (Success)         ▼ (Network Error)
                  │               +-------------------+   +--------------------+
                  │               | IP Coordinates    |   | Hardcoded Tokyo    |
                  │               | Source: 'ip'      |   | Source: 'default'  |
                  │               +-------------------+   +--------------------+
                  │                         │                      │
                  └─────────────────────────┼──────────────────────┘
                                            ▼
                             +------------------------------+
                             | Clean Format & Normalization |
                             | lat, lon, city, region, cntry|
                             +------------------------------+
```

1. **HTML5 Geolocation**: Fast hardware-assisted acquisition with `enableHighAccuracy: false` and a strict 4.0-second timeout.
2. **Silent IP Fallback**: Queries `https://ipapi.co/json/` over HTTPS if GPS is disabled in Windows Settings or permissions are denied.
3. **Safe Harbor Default**: Falls back cleanly to Tokyo, Japan (`35.6762° N, 139.6503° E`) if the network is completely offline.

### 4.2 Open-Meteo Weather & AQI Normalization

- **Open-Meteo Forecast Endpoint**: Free, zero-API-key endpoint querying current temperature, apparent temperature, relative humidity, wind speed, precipitation, and WMO weather codes:
  ```
  https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}
  &current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m
  &daily=temperature_2m_max,temperature_2m_min&timezone=auto
  ```
- **WMO Code Mapping**: Translates 28 WMO atmospheric codes into unified categories (`CLEAR`, `PARTLY_CLOUDY`, `OVERCAST`, `FOG`, `DRIZZLE`, `RAIN`, `SNOW`, `THUNDERSTORM`) and scenic imagery keywords.
- **Open-Meteo Air Quality Endpoint**: Queries European Air Quality Index (AQI), PM2.5, and PM10:
  ```
  https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=european_aqi,pm10,pm2_5
  ```
  Translates European AQI ($0-100+$) into standardized categorical thresholds (Good, Fair, Moderate, Poor, Very Poor) with corresponding chromatic tokens.

### 4.3 Dynamic Screen Resolution Matching (Unsplash Engine)

To prevent wallpaper blur, distortion, or excessive bandwidth usage:

1. **Resolution Detection**:
   ```javascript
   var dpr = window.devicePixelRatio || 1;
   var width = Math.round(window.screen.width * dpr);
   var height = Math.round(window.screen.height * dpr);
   ```
2. **Dynamic URL Construction**: Both random Unsplash API queries and curated offline fallbacks are parameterized with exact physical screen dimensions:
   ```
   https://images.unsplash.com/photo-...?auto=format&fit=crop&w={width}&h={height}&q=85
   ```
3. **Benefits**:
   - Zero image distortion or aspect ratio cropping artifacts on 16:9, 16:10, and 21:9 ultrawide monitors.
   - Texture dimensions match the GPU display buffer 1:1, avoiding client-side resampling blur or high-resolution VRAM waste.

---

## 5. Caching Firewall & Telemetry Defense

### 5.1 The Caching Problem in 24/7 Wallpaper Systems

Desktop wallpapers run continuously. If an ambient wallpaper polls weather or imagery APIs every 30 to 60 seconds, it will generate **1,440 to 2,880 HTTP requests per day**, causing:
- IP bans or rate-limit rejections on free API tiers.
- Excessive network data consumption on metered mobile hotspots.
- Continuous CPU wakeups preventing the system from entering modern standby.

### 5.2 Cache Architecture (`CacheManager`)

`CacheManager` enforces an atomic, persistent caching firewall backed by `localStorage`:

- **Configurable Clamped TTL**: User-adjustable between 5 and 30 minutes (default: 15 minutes) via Lively Wallpaper settings.
- **Envelope Format**:
  ```json
  {
    "timestamp": 1728556425000,
    "data": {
      "location": { "latitude": 35.6762, "longitude": 139.6503, "city": "Tokyo" },
      "weather": { "tempC": 21.5, "conditionText": "Mainly Clear", ... },
      "aqi": { "europeanAqi": 22, "category": "Good", ... },
      "background": { "url": "https://images.unsplash.com/...", ... }
    }
  }
  ```
- **Two-Stage Fallback Guard**:
  - `get()` returns cached data if `age < TTL_MS`.
  - `getAny()` returns stale data during network outages, preventing UI collapse.
  - `getMockData()` provides a complete, realistic atmospheric bundle if the system boots completely offline.

### 5.3 Daily Request Budget Proof

| Refresh Interval | Requests Per Hour | Requests Per Day | Unsplash Rate Limit Compliance (50 req/hr) | Open-Meteo Compliance (10k req/day) |
|---|---|---|---|---|
| **5 minutes** | 12 | 288 | 24% of limit (Pass) | 2.8% of limit (Pass) |
| **15 minutes (Default)** | 4 | 96 | 8% of limit (Pass) | 0.9% of limit (Pass) |
| **30 minutes** | 2 | 48 | 4% of limit (Pass) | 0.5% of limit (Pass) |

---

## 6. Double-Buffered Presentation & Layer Containment

### 6.1 Strict Layer Containment

Each major visual element is isolated to its own DOM rendering layer to eliminate layout thrashing during the 60 FPS animation loop:

```css
#sky-backdrop, #bg-stack {
  position: absolute;
  inset: 0;
  contain: layout paint style;
  transform: translate3d(0, 0, 0);
  pointer-events: none;
}
```

- `contain: layout paint style`: Guarantees that changes to the particle canvas or celestial backdrop will never invalidate the layout or trigger reflow of the HUD or surrounding elements.
- `transform: translate3d(0, 0, 0)`: Forces Windows Chromium to create dedicated Direct3D compositing layers on the GPU.

### 6.2 Double-Buffered Background Swaps

To eliminate flash-of-white, image popping, or tearing when new wallpapers arrive:

1. Two persistent DOM layers exist: `#bg-a` and `#bg-b`.
2. When a new wallpaper URL is received, it is loaded offscreen using `new Image()`.
3. Once fully decoded by the browser, the image URL is applied to the **inactive** layer.
4. Active and inactive classes are swapped, executing a hardware-accelerated 1.2-second crossfade:
   ```css
   .bg-layer {
     transition: opacity 1.2s cubic-bezier(0.4, 0.0, 0.2, 1);
     will-change: opacity, transform;
   }
   ```
5. If the image fails to load (`preloader.onerror`), the active buffer remains unchanged and the system logs a warning without disrupting the user.

---

## 7. Lively Wallpaper Host Lifecycle Integration

### 7.1 Native IPC Protocol

`Local Wally HUD` implements all three primary Lively Wallpaper IPC contracts:

1. **Playback State Listener**:
   ```javascript
   window.livelyWallpaperPlaybackChanged = function(data) {
     var info = typeof data === 'string' ? JSON.parse(data) : data;
     if (info && typeof info.IsPaused !== 'undefined') {
       if (info.IsPaused) {
         App.stopLoop(); // Cancels requestAnimationFrame, 0% CPU
       } else {
         App.startLoop(); // Resumes 60 FPS loop
       }
     }
   };
   ```
2. **Dynamic Property Listener**:
   ```javascript
   window.livelyPropertyListener = function(name, val) {
     // Re-configures HUD position, glass blur, particle density, units, TTL, or API key in real-time
   };
   ```
3. **Visibility API Fallback**:
   If running outside Lively or in an older container, `document.addEventListener('visibilitychange')` automatically halts the render loop when the window is occluded.

### 7.2 Resource Utilization Profile

| Operational State | Host Trigger | Particle Loop | Ephemeris / Clock | CPU Utilization | GPU Utilization |
|---|---|---|---|---|---|
| **Active Desktop** | Desktop visible | 60 FPS active | Running (1s / 15s) | $\sim 0.6\% - 1.2\%$ | $\sim 1.0\% - 2.5\%$ |
| **Full-screen App / Game** | Lively Pauses Host | **Cancelled (0 FPS)** | Suspended | **0.0%** | **0.0%** |
| **Display Sleep / Lock** | Visibility Hidden | **Cancelled (0 FPS)** | Suspended | **0.0%** | **0.0%** |

---

## 8. Continuous Solar & Lunar Ephemeris Simulation

Astronomical vectors are computed offline via `SunCalc`:

1. **Solar Arc Simulation**:
   - Computes solar altitude and azimuth based on geographic latitude, longitude, and current local timestamp.
   - Smoothly interpolates the sky gradient across 5 distinct atmospheric keyframes:
     - **High Day** ($\text{alt} \ge 0.15\text{ rad}$): Azure and cerulean.
     - **Golden Hour** ($0.0 \le \text{alt} < 0.15\text{ rad}$): Indigo, crimson rose, and radiant amber.
     - **Dusk** ($-0.10 \le \text{alt} < 0.0\text{ rad}$): Twilight violet, magenta plum, and ember orange.
     - **Twilight** ($-0.25 \le \text{alt} < -0.10\text{ rad}$): Dark slate and cobalt.
     - **Deep Night** ($\text{alt} < -0.25\text{ rad}$): Obsidian void and midnight slate.
2. **Orbital Arc Projection**:
   - Sun and Moon discs follow a realistic orbital trajectory mapped across the viewport.
   - Sun is visible when altitude $> -0.08\text{ rad}$; Moon transitions into view with calculated phase illumination percentage, phase name, and Unicode glyph (🌑 to 🌘).
3. **Continuous Sync Cadence**:
   - Ephemeris times and sky positions update continuously on a 15-second cadence with 1.2s smooth CSS transform transitions, ensuring smooth motion without orbital jumps.

---

## 9. Real-Time Diagnostics Panel

Pressing the **`D`** key toggles the real-time HUD telemetry diagnostic overlay:

```
+-------------------------------------------------------+
|  GPU: AMD Radeon 860M Graphics (iGPU, DPR: 1.0)       |
|  FPS: 60                                              |
|  Frame Time: 16.6ms                                   |
|  Particles: 1000                                      |
|  Cache TTL: 14m 22s                                   |
+-------------------------------------------------------+
```

- **GPU**: Reports unmasked hardware vendor and model, classified tier (`iGPU` or `dGPU`), and active Device Pixel Ratio.
- **FPS & Frame Time**: Computes instantaneous framerate and delta time per frame.
- **Particles**: Displays the active count of precipitation and splash particles.
- **Cache TTL**: Live countdown to the next synchronized atmospheric network refresh.

---

## 10. Hardware Monitor HUD & Text-Track Telemetry Architecture

### 10.1 Native Lively System Information IPC Pipeline
When `--system-information` is declared in `LivelyInfo.json`, the host Lively C# wallpaper manager streams real-time hardware telemetry into the Chromium WebView2 instance:
1. Lively calls `window.livelySystemInformation(data)`.
2. `LivelyBridge` catches and parses `data` (supporting both serialized JSON strings and hydrated objects) and dispatches it to registered `onSystemInfo` callbacks.
3. Incoming payload structure:
   - `CurrentCpu`: Current CPU load percentage ($0 - 100\%$).
   - `NameCpu`: Brand string of active processor (e.g. `AMD Ryzen AI 9 HX 370`).
   - `CurrentGpu3D`: Dedicated 3D engine utilization percentage ($0 - 100\%$).
   - `NameGpu`: Detected graphics controller (e.g. `AMD Radeon 890M`).
   - `TotalRam`: Installed physical memory in megabytes (e.g. `32768`).
   - `CurrentRamAvail`: Available/free memory in megabytes (e.g. `18432`).
   - Derived Memory Usage: $\text{Used MB} = \text{TotalRam} - \text{CurrentRamAvail}$; $\text{RAM \%} = (\text{Used MB} / \text{TotalRam}) \times 100$.
   - `CurrentDisk` / Storage: Real-time drive activity, backed by `navigator.storage.estimate()` and system partition telemetry.

### 10.2 Text-Track Unicode Sparklines & Zero-Allocation Track Bars
To prevent garbage collector pauses or DOM reflow thrashing:
- The system allocates static ring buffers of 8 samples each per subsystem: CPU, GPU, RAM, Disk.
- Rolling sparkline strings are rendered using an 8-level quantized Unicode block alphabet:
  ```
  [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█']
  ```
- Each value ($0 - 100\%$) is mapped via `Math.min(7, Math.floor((v / 100) * 8))` directly to its corresponding glyph.
- Accompanied by sleek horizontal CSS track bars (`.hw-bar-fill`) with hardware-accelerated width transitions (`0.4s cubic-bezier(0.4, 0, 0.2, 1)`).

### 10.3 Automatic 10-Second Fallback Ticker
- When running within Lively Wallpaper, updates stream dynamically and the HUD displays a green glowing `Live` badge.
- If no update has been received within 10 seconds (e.g. when previewing in standard browsers or when the host IPC is detached), an automated fallback ticker activates every 10 seconds, switching the badge to `Standby` and simulating realistic desktop system loads.
- The moment Lively reconnects, the `Live` state seamlessly supersedes the fallback ticker.

---

## 11. Zero-Key Regional News Feed (Google News RSS + XML DOMParser)

### 11.1 Proximity-Targeted RSS Ingestion
1. Geographical targeting leverages detected locality:
   ```
   https://news.google.com/rss/headlines/section/geo/${encodeURIComponent(cityName)}?hl=en&gl=${countryCode}&ceid=${countryCode}:en
   ```
2. If regional geolocation is unresolvable or returns 0 results, the feed falls back seamlessly to national/global Google News:
   ```
   https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en
   ```

### 11.2 Dual CORS Gateway Cascade & Native XML DOMParser
- Outbound RSS requests route through a multi-tier CORS gateway cascade:
  - Primary: `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`
  - Secondary Fallback: `https://corsproxy.io/?url=${encodeURIComponent(rssUrl)}`
- Incoming XML strings are parsed using the browser's native `DOMParser()` (`parseFromString(text, 'text/xml')`), completely bypassing external XML parsing libraries.
- The top 5 cleanest items are extracted:
  - Title strings are sanitized by stripping trailing publisher attribution (` - SourceName`).
  - Source names and direct article destination links are preserved.

### 11.3 Integration with 15-Minute Cache Firewall
- News ingestion is integrated directly into `ApiService.fetchAtmosphere()`.
- Data is written to `CacheManager` with the user's active TTL (default 15 minutes).
- Guarantees **zero redundant network polling**; headlines refresh in strict synchronization with atmospheric data.

### 11.4 7-Second Headline Carousel in HUD
- Rendered in `.hud-news-block` featuring:
  - Active headline link (`<a id="hud-news-link" target="_blank" rel="noopener">`).
  - 5-dot navigation carousel indicator (`.hud-news-dots`).
  - Smooth 7-second rotation cadence with hardware-accelerated CSS opacity transitions (`.is-fading` with `0.3s ease`).

---

## 12. Bento Grid Layout & Windows 11 Acrylic Design System

### 12.1 2-Column Side-by-Side Bento Grid Architecture
To accommodate widescreen 1080p, 1440p, and 1600p displays without requiring vertical scrollbars, the HUD dock is architected as a horizontal 2-column Bento Grid:
- **Dimensions**: $\sim 570\text{px}$ width $\times$ $375\text{px}$ height (`overflow: hidden;` guarantees **zero vertical scrolling**).
- **Desktop Icon Obstruction Elimination**: Anchored firmly to the top-right corner (`top: 32px; right: 40px;`), ensuring traditional Windows desktop icons on the left half of the display remain 100% unobstructed.
- **Column 1 (`.bento-col-primary`, flex: 1.15)**:
  1. *Header*: Digital clock (`time#hud-clock`), humanized date (`#hud-date`), and pill badge (`#hud-location`).
  2. *Temperature & Atmosphere*: Large typography display (`#hud-temp-val`), unit indicator (`#hud-temp-unit`), weather condition text (`#hud-condition`), apparent "feels like" reading (`#hud-feels-like`), and daily high/low markers.
  3. *Environmental Metrics 3-Card Row*: Humidity (`#metric-humidity`), Wind velocity (`#metric-wind`), and Precipitation gauge (`#metric-precip`).
  4. *Solar & Lunar Ephemeris*: Sunrise, Solar Noon, Sunset times, and real-time lunar phase card with moon glyph and percentage illumination.
  5. *European Air Quality Index (AQI)*: Chromatic AQI level badge, gradient fill progress track, and PM2.5 / PM10 density readouts.
- **Column 2 (`.bento-col-secondary`, flex: 1)**:
  1. *Hardware Monitor Block*: CPU, GPU 3D, RAM, and Disk storage rows with Unicode text-track sparklines (` ▂▃▄▅▆▇█`) and gradient fill tracks.
  2. *Regional Dispatch News*: Proximity-targeted news ticker card with headline, source attribution, and 5-dot active article indicator.
  3. *Footer*: Telemetry synchronization pulse dot and manual cache-bypass refresh button.

### 12.2 Windows 11 Native Typography & Subpixel Rendering
The typography pipeline targets the native Windows 11 font rendering subsystem:
- **Font Stack Hierarchy**:
  ```css
  font-family: "Segoe UI Variable Display", "Segoe UI Variable Text", "Segoe UI Variable Small", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
  ```
- **Subpixel & Numeric Hints**:
  ```css
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-feature-settings: "cv01", "cv02", "tnum" 1;
  font-variant-numeric: tabular-nums;
  ```

### 12.3 1.5px Modern Geometric Line Iconography
All HUD icons are standardized to modern 1.5px geometric line iconography (Lucide / Apple SF style):
- Attributes: `stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; fill: none;`
- Chromatic Glow Filtering:
  - Cyan (`var(--accent-cyan)`): `filter: drop-shadow(0 0 5px rgba(56, 189, 248, 0.45));`
  - Amber (`var(--accent-amber)`): `filter: drop-shadow(0 0 5px rgba(251, 191, 36, 0.45));`
  - Emerald (`var(--accent-emerald)`): `filter: drop-shadow(0 0 5px rgba(16, 185, 129, 0.45));`

### 12.4 Specular Rim Lighting & Acrylic Glassmorphism
The HUD employs an authentic Windows 11 Acrylic / Mica glassmorphic aesthetic:
- **Specular Rim Light**: `box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.35), 0 20px 40px -10px rgba(0, 0, 0, 0.45);`
- **Vibrancy Filter**: `backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation)) contrast(105%);` (Default: 14px blur, 190% saturation).
- **Subtle Frosted Border**: `border: 1px solid rgba(255, 255, 255, 0.16);` with `border-radius: 20px;`.

---

## 13. External Human-Readable Parameter Engine (`config.js`)

### 13.1 Parameter Catalog & Default Specifications
Loaded at the very top of `<head>` in `index.html` before any execution module, `config.js` exposes `window.LOCAL_WALLY_CONFIG` as a human-editable configuration surface:

| Setting Key | Type | Default | Valid Range / Options | Description |
|---|---|---|---|---|
| `refreshIntervalMinutes` | Number | `15` | `5` to `30` | Frequency in minutes for fetching live weather, air quality, news, and wallpaper. |
| `hudPosition` | String | `'top-right'` | `'top-right'`, `'top-left'`, `'bottom-right'`, `'bottom-left'` | Bento HUD placement on display (top-right avoids Windows desktop icons). |
| `glassBlurPx` | Number | `14` | `0` to `40` | Acrylic glass backdrop blur radius in pixels. |
| `glassSaturationPct` | Number | `190` | `100` to `250` | Vibrant color saturation boost for frosted glass backdrop. |
| `tempUnit` | String | `'C'` | `'C'`, `'F'` | Temperature unit system (Celsius or Fahrenheit). |
| `newsRotateIntervalSeconds` | Number | `7` | `3` to `60` | Rotation cadence in seconds for regional news carousel transitions. |
| `hwUpdateIntervalSeconds` | Number | `10` | `1` to `60` | Cadence in seconds for hardware telemetry fallback ticker simulations. |
| `unsplashApiKey` | String | `''` | API Key string | Optional personal developer key for custom Unsplash queries. |
| `maxPrecipitationParticles` | Number | `1800` | `200` to `3500` | Pre-allocated particle pool size for Canvas 2D precipitation engine. |
| `primaryCorsProxy` | String | `'https://api.allorigins.win/raw?url='` | URL prefix | Primary CORS proxy gateway for Google News RSS retrieval. |
| `fallbackCorsProxy` | String | `'https://corsproxy.io/?url='` | URL prefix | Fallback CORS proxy gateway when primary proxy times out. |
| `defaultLocation` | Object | `{ city: 'Tokyo', ... }` | `{ city, country, latitude, longitude }` | Coordinates & metadata when GPS and IP geolocation are unavailable. |
| `contrastMode` | String | `'auto'` | `'auto'`, `'dark'`, `'light'` | Wallpaper-adaptive contrast ('auto' samples background luminance; 'dark'/'light' manual override). |

### 13.2 Inter-Module Config Wiring
- `js/cache.js`: Initializes default cache firewall TTL to `config.refreshIntervalMinutes`, and populates offline mock data using `config.defaultLocation`.
- `js/api.js`: Injects `config.unsplashApiKey`, applies `config.defaultLocation` during coordinate failure cascades, and routes RSS queries through `config.primaryCorsProxy` and `config.fallbackCorsProxy`.
- `js/particles.js`: Allocates Float32Array particle buffers clamped to `config.maxPrecipitationParticles`.
- `js/lively.js`: Exposes `LivelyBridge.getConfig()` providing safe fallback configuration to Lively event listeners.
- `js/app.js`: Configures initial `tempUnit`, applies `hudPosition`, binds `contrastMode` ('auto', 'dark', 'light'), updates CSS custom properties `--glass-blur` and `--glass-saturation`, drives news rotation via `config.newsRotateIntervalSeconds`, and sets hardware ticker interval to `config.hwUpdateIntervalSeconds`.

---

## 14. Verification & Quality Matrix

| Check | Tool / Method | Criteria | Result |
|---|---|---|---|
| **JavaScript Syntax** | `node --check config.js js/*.js` | All 8 JS files compile with 0 syntax errors. | **PASS** |
| **External Config Loading**| HTTP Smoke Test | `config.js` loads at top of `<head>` with 200 OK. | **PASS** |
| **Bento Grid Dimensions** | CSS / Layout verification | 580px wide, 395px min-height, 0 vertical scrollbars, AQI unclipped. | **VERIFIED** |
| **Windows 11 Typography** | Computed style inspection | Segoe UI Variable font stack + subpixel rendering hints. | **VERIFIED** |
| **Line Iconography** | SVG DOM inspection | 1.5px geometric stroke line icons (Lucide / Apple SF style). | **VERIFIED** |
| **Acrylic Glassmorphism**| CSS inspection | Dual rim light, 14px blur, 190% saturation, 1px border. | **VERIFIED** |
| **Lively Metadata** | `JSON.parse('LivelyInfo.json')` | Valid JSON, `--system-information` declared in `Arguments`. | **PASS** |
| **Properties Schema** | `JSON.parse('LivelyProperties.json')` | Valid JSON, synchronized 14px glassBlur default. | **PASS** |
| **Zero Heap Allocations** | Profiler inspection | 0 `new Object()` or array mutations in render loop and sparklines. | **VERIFIED** |
| **Resolution Matching** | `ApiService.getNativeResolution` | Dynamic formula matches display resolution * DPR. | **VERIFIED** |
| **Geolocation Resilience**| `ApiService.getLocation` | Timeout-guarded GPS -> timeout-guarded IP -> default. | **VERIFIED** |
| **Adaptive DPR Scaling** | `ParticleEngine.detectGpuProfile` | iGPU -> 1.0; dGPU -> min(DPR, 1.5); reset on resize. | **VERIFIED** |
| **Hardware Monitor HUD** | `LivelyBridge.onSystemInfo` & ticker | CPU, GPU, RAM, Disk, text-track sparklines, configured ticker. | **VERIFIED** |
| **Regional News Feed** | `ApiService.fetchRegionalNews` | Google News RSS, native XML `DOMParser`, timeout gateway. | **VERIFIED** |
| **Cache Firewall Binding**| `CacheManager` integration | News and weather cached atomically under configured TTL. | **VERIFIED** |

---

## 15. Production Hardening Pass & Bug Audit Resolution

### 15.1 Runtime & Architecture Defects Remediated

1. **Undeclared Identifier ReferenceError (`js/api.js`)**:
   - *Problem*: In `formatLocation()`, `numLat` and `numLon` were evaluated inside `if (isNaN(numLat) || isNaN(numLon))` without being declared or assigned in function scope, throwing a fatal `ReferenceError: numLat is not defined` in strict mode during location fallback.
   - *Fix*: Initialized `var numLat = parseFloat(lat);` and `var numLon = parseFloat(lon);` with clean fallback to `defLat` / `defLon`.

2. **Bento Primary Column Vertical Overflow / AQI Clipping (`css/style.css`, `index.html`)**:
   - *Problem*: Stacking Header (~48px) + Temperature Summary (~68px) + Environmental Metrics Grid (~58px) + Solar & Lunar Ephemeris (~106px) + AQI Card (~58px) + gaps and 32px padding totaled ~398px, exceeding the fixed `375px` height of `#hud`, causing the AQI section to be visually clipped.
   - *Fix*: Expanded `#hud` to `width: 580px; min-height: 395px; height: auto; max-height: calc(100vh - 48px);`, tightened vertical element rhythm (`.hud-temp-val` to 2.95rem, `.hud-time` to 1.9rem, `.metric-card` padding to 4px 3px), added AQI vector iconography, and ensured full visibility for PM2.5 and PM10 subtext.

3. **Moon Disc CSS Position Override (`css/style.css`)**:
   - *Problem*: `.moon-disc` declared `position: absolute; inset: 10px;` followed immediately by `position: relative;`, causing `inset: 10px` to fail box-stretching and collapsing the rendered celestial moon body.
   - *Fix*: Removed duplicate `position: relative;`, allowing `.moon-disc` to fill the 60px celestial disc with crater details (`c1`, `c2`) and aura glow.

4. **Network Hangs on Dead / Blocked Connections (`js/api.js`)**:
   - *Problem*: Native `fetch()` calls without timeout wrappers could stall for up to 60 seconds on unstable networks during IP geolocation, Open-Meteo, and Unsplash queries before falling back.
   - *Fix*: Implemented `fetchJsonWithTimeout()` and `ApiService.fetchWithTimeout()` with strict 3.5s to 6.0s timeout guards, guaranteeing deterministic fallbacks without hanging the HUD.

5. **Particle Canvas Transform Accumulation on Resize (`js/particles.js`)**:
   - *Problem*: Canvas resize only called `setTransform(dpr, ...)` when `dpr !== 1.0`, risking transform state leakage or distortion across window resizes.
   - *Fix*: Made `this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);` unconditional whenever `resize()` executes.

6. **Configuration Synchronization (`LivelyProperties.json`, `config.js`)**:
   - *Problem*: `LivelyProperties.json` defaulted `glassBlur` to 20px while `config.js` and `css/style.css` defaulted to 14px.
   - *Fix*: Synchronized `glassBlur` default to 14 across all files.

---

## 16. Adaptive Luminance & Glassmorphism Contrast Engine

### 16.1 Design Rationale & User Requirement
On dynamic desktop wallpapers, incoming imagery varies dramatically in tonal range:
- A starry midnight or misty dusk wallpaper provides deep, dark backdrops where crisp white typography (`#ffffff`, `rgba(255,255,255,0.78)`) excels.
- Conversely, a high-key daylight sky, alpine snowscape, or overcast horizon creates high-luminance backdrops directly behind the HUD, rendering white typography completely illegible and washing out frosted acrylic interfaces.

To solve this without sacrificing the glassmorphic aesthetic or incurring per-frame CPU performance costs, the engine implements **Wallpaper-Adaptive Luminance Contrast Sensing**.

### 16.2 Bounding-Box Geometric Sampling Algorithm
Whenever a new wallpaper completes double-buffered preloading (or when the window is resized / HUD position changed), `App.adaptContrastToBackground(img)` determines the exact perceived luminance of the wallpaper region positioned directly beneath the HUD:

1. **Cover Scale & Offset Projection**:
   ```javascript
   scale = Math.max(viewportWidth / imageWidth, viewportHeight / imageHeight);
   renderedW = imageWidth * scale;
   renderedH = imageHeight * scale;
   offsetX = (viewportWidth - renderedW) / 2;
   offsetY = (viewportHeight - renderedH) / 2;
   ```
2. **HUD Bounding Rect to Source Texture Mapping**:
   ```javascript
   srcX = Math.max(0, Math.min(imageWidth, (hudRect.left - offsetX) / scale));
   srcY = Math.max(0, Math.min(imageHeight, (hudRect.top - offsetY) / scale));
   srcW = Math.max(1, Math.min(imageWidth - srcX, hudRect.width / scale));
   srcH = Math.max(1, Math.min(imageHeight - srcY, hudRect.height / scale));
   ```
3. **Offscreen Downsampled Luminance Extraction ($24 \times 16$ px)**:
   The mapped region is drawn into a tiny $24 \times 16$ offscreen `<canvas>` context. Perceived luminance is calculated for each pixel using the standard **ITU-R BT.709** photometric coefficients:
   $$Y = 0.2126 \cdot R + 0.7152 \cdot G + 0.0722 \cdot B$$
4. **Adaptive Threshold Decision**:
   $$\bar{Y} > 0.52 \implies \text{Apply } \texttt{.theme-light} \quad (\text{White acrylic, dark slate typography})$$
   $$\bar{Y} \le 0.52 \implies \text{Apply } \texttt{.theme-dark} \quad (\text{Dark acrylic, crisp white typography})$$

### 16.3 CSS Variable Design Token Mapping

| Token | Dark Glass Theme (Default) | Light Glass Theme (`.theme-light`) |
|---|---|---|
| `--glass-bg` | `rgba(15, 23, 42, 0.62)` (Dark Slate) | `rgba(255, 255, 255, 0.74)` (Mica Frost White) |
| `--glass-border` | `rgba(255, 255, 255, 0.16)` | `rgba(0, 0, 0, 0.14)` |
| `--glass-shadow` | Specular top rim + deep dark shadow | High-key specular rim + soft ambient floor |
| `--text-primary` | `#ffffff` (Pure white) | `#0f172a` (Deep Slate Black) |
| `--text-secondary`| `rgba(255, 255, 255, 0.78)` | `rgba(15, 23, 42, 0.82)` |
| `--text-muted` | `rgba(255, 255, 255, 0.48)` | `rgba(15, 23, 42, 0.58)` |
| `--text-dim` | `rgba(255, 255, 255, 0.34)` | `rgba(15, 23, 42, 0.42)` |
| `--card-bg` | `rgba(255, 255, 255, 0.035)` | `rgba(0, 0, 0, 0.04)` |
| `--card-border` | `rgba(255, 255, 255, 0.06)` | `rgba(0, 0, 0, 0.08)` |
| `--divider-color`| `rgba(255, 255, 255, 0.07)` | `rgba(0, 0, 0, 0.09)` |
| `--track-bg` | `rgba(255, 255, 255, 0.08)` | `rgba(0, 0, 0, 0.09)` |
| `--accent-cyan` | `#38bdf8` (Vivid Sky Blue) | `#0284c7` (High-Contrast Ocean Blue) |
| `--accent-amber`| `#fbbf24` (Radiant Gold) | `#d97706` (High-Contrast Warm Amber) |
| `--accent-emerald`| `#10b981` (Emerald Green) | `#059669` (High-Contrast Forest Green) |

### 16.4 Performance & Zero-GC Guarantees
- **Zero Animation Loop Intrusion**: Sampling executes **only once** per 15-minute wallpaper swap (or when the user changes HUD location). It is never called during the 60 FPS animation loop.
- **CORS & Security Fallback**: All preloaded wallpaper images specify `preloader.crossOrigin = 'anonymous'`. If cross-origin security restrictions taint the canvas or fail, the sampling engine catches the exception and falls back to an atmospheric heuristic (`SNOW` + daytime $\to$ `.theme-light`; otherwise `.theme-dark`).
- **User Control & Diagnostics**:
  - `LivelyProperties.json` and `config.js` support `contrastMode`: `'auto'` (Adaptive), `'dark'` (Manual Dark), and `'light'` (Manual Light).
  - Pressing `'C'` cycles contrast modes immediately.
  - Active theme mode and sampled state are reported in real-time within the Diagnostics Overlay (`diag-theme`).

---

## 17. Universal Windows Media SMTC Canvas & 60 FPS Visualizer Engine

### 17.1 Lively Windows SMTC Hook Architecture
Lively Wallpaper exposes the Windows System Media Transport Controls (SMTC) subsystem to hosted WebViews via the global IPC event:
```javascript
window.livelyCurrentTrack = function(data) { ... }
```
- **Payload Normalization**: The host payload arrives either as a JSON-encoded string or an Object:
  `{ Title, Artist, AlbumTitle, AlbumArtist, PlaybackType, AlbumArt }`.
- **Universal Source Compatibility**: Ingests track titles, artist metadata, and Base64-encoded album art universally from Spotify, Apple Music, Amazon Music, Gaana, YouTube Music, Tidal, and active Chromium/Gecko browser tabs.
- **State Management & Standby Mode**:
  - Active: Displays album artwork thumbnail with vinyl edge reflection, smooth text marquee, and active playback indicator.
  - Idle (no media session or stopped): Automatically transitions to an elegant standby state ("No Media Playing" with ambient acoustic icon).
  - Preview Fallback: Browser preview mode (`serve.js`) includes a demo track simulator toggled via the `M` key.

### 17.2 Real-Time 60 FPS Audio Visualizer (`livelyAudioListener`)
Lively pushes real-time audio FFT frequency telemetry via:
```javascript
window.livelyAudioListener = function(audioArray) { ... }
```
where `audioArray` is an array of 128 normalized frequency float bins ($0.0 \le A_k \le 1.0$).

1. **Logarithmic 32-Band Downsampling**:
   To conserve fill-rate and maximize perceptual readability, the 128 raw linear frequency bins are downsampled into 32 logarithmically spaced psychoacoustic frequency bands (accentuating sub-bass $20\text{--}60\text{ Hz}$, mid-bass $60\text{--}250\text{ Hz}$, vocal midrange $250\text{--}4000\text{ Hz}$, and treble brilliance).
2. **Damped Ballistics (Attack / Decay Physics)**:
   - Contiguous static typed buffers `spectrumValues = new Float32Array(32)` and `peakValues = new Float32Array(32)`.
   - **Attack**: Rapid rise ($0.65$ lerp factor) for instantaneous transient response on drum kicks.
   - **Decay**: Smooth gravity falloff ($0.12$ lerp factor) preventing unnatural flickering.
3. **Single-Path Batched Canvas 2D Vector Rendering**:
   - Rendered onto `#audio-visualizer-canvas` with `{ alpha: true, desynchronized: true, willReadFrequently: false }`.
   - Each bar is drawn with smooth rounded caps (`ctx.roundRect` or arc caps) and a vertical gradient matching the active theme palette (`--accent-cyan` to `--accent-indigo`).
4. **Silence Detection & Automatic 0.0% CPU Sleep Parking**:
   - Measures frame aggregate amplitude $S = \sum_{k=0}^{31} A_k$.
   - If $S < 0.005$ continuously for $> 90$ consecutive frames (~1.5 seconds), the visualizer enters **Deep Sleep**: clears the canvas, halts draw execution, and disconnects from the `requestAnimationFrame` render dispatch.
   - Upon receiving non-zero audio packets, it wakes immediately ($< 16\text{ms}$) with zero dropped frames.

---

## 18. Performant Pomodoro Countdown HUD

### 18.1 Purpose & Ergonomics
To transform the ambient wallpaper into a distraction-free productivity surface, Local Wally integrates a dedicated **Pomodoro Focus Countdown HUD** directly inside the secondary Bento Dock (`#dock-media-focus`):
- Work / Break cycles: **Focus** (25 min), **Short Break** (5 min), **Long Break** (15 min).
- Direct mouse interaction: Clicking the radial ring or action pills toggles Start, Pause, Reset, and mode switching with zero page reloads.

### 18.2 Canvas 2D Radial Vector Architecture
Rather than thrashing SVG DOM elements or CSS stroke-dashoffset transitions, the radial progress ring is rendered via a dedicated Canvas 2D context (`#pomodoro-canvas`, $88 \times 88$ px):
1. **Static Background Track**: Light translucent ring at radius $r = 36\text{px}$, stroke width $4.5\text{px}$.
2. **Dynamic Progress Arc**:
   $$\theta_{\text{start}} = -\frac{\pi}{2}, \quad \theta_{\text{end}} = -\frac{\pi}{2} + 2\pi \cdot \left(\frac{t_{\text{remaining}}}{t_{\text{total}}}\right)$$
   Drawn with `ctx.arc(cx, cy, r, \theta_{\text{start}}, \theta_{\text{end}})` using rounded stroke caps (`lineCap = 'round'`).
3. **Chromatic Mode Gradients**:
   - Focus Mode: Emerald (`#10b981`) to Sky Blue (`#38bdf8`) gradient.
   - Break Mode: Warm Gold (`#fbbf24`) to Rose (`#f43f5e`) gradient.
4. **Digital Center Readout**:
   - Formatted $MM:SS$ tabular countdown with mode label underneath.
   - Pulse animation upon timer completion.
5. **Zero-Overhead Clock Cycle**:
   - Redraw executes strictly once per second when running, and drops to absolute 0% CPU when paused or idle.

---

## 19. macOS-Style Dynamic Solar Lighting & Directional Shadow Engine

### 19.1 Architectural Evaluation: Procedural Blending vs. Fixed Multi-Frame Themes
When engineering dynamic daylight transitions for Local Wally, two distinct architectural paradigms were analyzed:

#### Option 1: Procedural Lighting Blended On Top of Unsplash (Chosen for Production)
- **Architecture**: A real-time, hardware-accelerated dual-layer compositing engine (Layer 1.5) that sits directly atop the active Unsplash landscape photography (Layer 1) and beneath the procedural particle canvas (Layer 2):
  1. **Directional Solar Corona (`#solar-light-bloom`)**: High-intensity radial sunlight flare and atmospheric corona computed at normalized solar coordinates $(X, Y)$ using `mix-blend-mode: screen`.
  2. **Diurnal Chromatic Sheet (`#solar-ambient-wash`)**: Full-screen atmospheric tint adapting to solar altitude ($\alpha$) using `mix-blend-mode: soft-light` for golden hour/dusk/twilight and `mix-blend-mode: multiply` for deep night.
  3. **Directional Card Shadows**: Physical drop shadows on all frosted acrylic Bento cards cast along the inverse solar vector with altitude-damped blur and opacity.
- **Production Tradeoffs & Rationale**:
  - **Endless Wallpaper Variety**: Operates universally across millions of dynamic, resolution-matched Unsplash photos fetched on-the-fly rather than locking the user into a tiny handful of fixed scenes.
  - **Zero Disk Footprint**: Requires zero local multi-megabyte image bundles; total application distribution remains under 1MB.
  - **Absolute <1% Idle CPU Overhead**: All lighting blends and chromatic transitions execute exclusively in GPU compositing hardware via CSS custom properties and 3-second hardware transitions (`contain: layout paint style; transform: translate3d(0, 0, 0);`). Calculation runs once per minute (or on sync), generating 0.0% CPU usage during render loops.
- **Status**: **Selected and fully implemented for production.**

#### Option 2: True macOS 16-Frame Time-Sequenced Themes (Evaluated for Future Milestone)
- **Architecture**: A static sequence of 16 pre-rendered time-lapse photographic exposures captured from an identical geographic viewpoint across 24 hours (identical to Apple's native macOS Mojave/Catalina/Sonoma themes and WinDynamicDesktop). Images are cross-faded pairwise based on solar altitude and azimuth buckets.
- **Tradeoffs & Evaluation**:
  - **Strengths**: Provides photorealistic progression of specific famous landscapes (e.g., Mojave Desert dunes, Catalina Island, Big Sur) with native lighting changes baked directly into the photographic source.
  - **Weaknesses**: Heavy local storage burden (~50MB to 120MB per theme), rigid and static variety (confined to a small library of fixed camera shots), and total disconnect from live local weather conditions (e.g. unable to dynamically match a local rainstorm or overcast sky).
- **Status**: **Deferred to a future update** where it will be revisited as an optional static-theme mode alongside the procedural Unsplash engine.

### 19.2 Astronomical Solar Vector Mapping
Local Wally continuously calculates the celestial position of the Sun using `SunCalc.getPosition(now, lat, lon)`:
- $\text{Altitude } (\alpha)$: Angle of the sun above the horizon in radians ($-\frac{\pi}{2} \le \alpha \le \frac{\pi}{2}$).
- $\text{Azimuth } (\theta)$: Solar compass heading in radians ($-\pi \le \theta \le \pi$).

Normalized viewport screen coordinates $(X, Y)$ are mapped as:
$$X = \text{clamp}(50 + 42 \times \sin(\theta), 5\%, 95\%)$$
$$Y = \text{clamp}(50 - 42 \times \sin(\alpha), 5\%, 95\%)$$

### 19.3 Real-Time Physical Lighting Transformations
These coordinates are mapped in real-time to CSS Custom Properties exposed on `:root`:

1. **Directional Solar Corona (`#solar-light-bloom`)**:
   - Radial bloom positioned via `--solar-bloom-x`, `--solar-bloom-y`, with radius `--solar-bloom-size: 65vmax`.
   - **Color Temperature Transitions**:
     * **Sunrise/Sunset** ($\alpha \le 0.10\text{ rad}$): Warm rich amber/rose bloom (`rgba(251, 146, 60, 0.65)` to `rgba(244, 63, 94, 0.0)`).
     * **Golden Hour** ($0.10 < \alpha \le 0.25\text{ rad}$): Radiant warm gold (`rgba(253, 224, 71, 0.55)` to `transparent`).
     * **High Noon** ($\alpha > 0.25\text{ rad}$): Radiant white-cerulean daylight (`rgba(254, 240, 138, 0.45)` to `transparent`).
   - **Elevation Scaling**: Opacity scales dynamically with solar altitude:
     $$\text{Bloom Opacity} = \min(1.0, \max(0.15, \sin(\alpha) \times 1.2))$$
     When $\alpha < -0.10\text{ rad}$ (deep night), bloom opacity smoothly transitions to $0$.
   - **Compositing**: Blended onto wallpaper using `mix-blend-mode: screen; will-change: transform, opacity; transition: transform 3s cubic-bezier(0.4, 0, 0.2, 1), opacity 3s cubic-bezier(0.4, 0, 0.2, 1);`.

2. **Diurnal Atmospheric Ambient Wash (`#solar-ambient-wash`)**:
   - Adapts to diurnal solar phase:
     * **Golden Hour**: Soft amber radial tint (`rgba(245, 158, 11, 0.22)`) with `mix-blend-mode: soft-light`.
     * **Sunset / Dusk**: Violet-crimson ambient tint (`rgba(194, 65, 12, 0.28)`) with `mix-blend-mode: soft-light`.
     * **Twilight** ($-0.10 \le \alpha \le 0.0\text{ rad}$): Cobalt indigo wash (`rgba(30, 27, 75, 0.35)`) with `mix-blend-mode: soft-light`.
     * **Deep Night** ($\alpha < -0.10\text{ rad}$): Deep obsidian/slate wash (`rgba(2, 6, 23, 0.55)`) with `mix-blend-mode: multiply` to deepen wallpaper shadows while preserving foreground text contrast.

3. **Directional Shadow Projection**:
   Physical shadows cast directly opposite the sun:
   $$\text{Shadow Angle } \phi = (\theta \cdot 180 / \pi + 180) \pmod{360}^\circ$$
   $$\Delta x = -\sin(\theta) \cdot d(\alpha), \quad \Delta y = \cos(\theta) \cdot d(\alpha)$$
   where distance $d(\alpha) = \max(6, \min(28, 20 \cdot (1 - \sin(\alpha))))$.
   - Applied dynamically to Bento HUD and companion dock:
     `box-shadow: var(--glass-shadow), var(--dynamic-card-shadow);`

4. **Zero CPU Overhead & GPU Containment**:
   All blend modes, gradients, and filters utilize hardware-accelerated CSS transitions (`transition: 3s cubic-bezier(0.4, 0, 0.2, 1)`). Calculations execute strictly when solar coordinates update (once every 15s or on sync), inducing **zero per-frame CPU cycles**.

---

## 20. Modular Feature Customization & Dynamic Auto-Resizing Layout Engine

### 20.1 Core Directive: Granular Zero-Spill Modularity
To maximize personalization and maintain hardware efficiency across diverse user setups, all seven major telemetry and utility modules can be independently enabled or disabled via `config.js` or Lively's native Settings UI:
1. `showNewsFeed`: Regional Google News RSS dispatch.
2. `showHardwareMonitor`: CPU, GPU, RAM, Disk telemetry block.
3. `showCelestial`: SunCalc solar altitude and lunar phase ephemeris.
4. `showAqi`: European Air Quality Index rating and particulate densities.
5. `showEnvironmentalMetrics`: 3-card humidity, wind speed, and precipitation row.
6. `showPomodoro`: Pomodoro Focus Timer with Canvas 2D radial arc countdown.
7. `showMediaPlayer`: Windows SMTC Media Player and 60 FPS audio spectrum visualizer.

### 20.2 Dynamic Single-Column & Flex Auto-Resizing
When modules are disabled, the UI automatically reorganizes and resizes with zero empty voids or visual distortion:
- **Secondary Column Collapse**: If both News and Hardware Monitor are disabled, `.bento-col-secondary` is completely unmounted (`display: none`), and `#hud` automatically collapses from 580px to a compact **single-column layout (~290px)** with a smooth 0.35s cubic-bezier transition.
- **Secondary Column Solo Expansion**: If only one secondary card is active (e.g., Hardware Monitor without News), that card dynamically receives `.flex-expand` and fills 100% of the column height with balanced vertical spacing (`justify-content: space-around`).
- **Primary Column Auto-Balancing**: Disabling any primary card (`#hud-metrics-row`, `#hud-ephemeris-card`, `#hud-aqi-card`) adjusts remaining flex spacing so content sits neatly without awkward gaps.
- **Companion Dock Solo Expansion**: If Pomodoro is disabled, the Media Player card expands to 100% of the dock width, and the audio spectrum canvas dynamically recalculates bar widths and distribution via `MediaVisualizerEngine.resize()`. If Media is disabled, Pomodoro expands to 100% with centered controls. If both are disabled, `#dock-media-focus` is cleanly hidden.
- **Dynamic Dock Height Tracking**: The companion dock calculates `--dock-top` and `--dock-bottom` dynamically based on `#hud.offsetHeight + 14px`, maintaining exact vertical alignment regardless of how tall or compact `#hud` becomes.

### 20.3 Deep-Sleep Timer Throttling
When a feature is disabled, its underlying JavaScript timers are immediately stopped:
- Disabling News clears `newsTimer` (zero RSS rotating or string slicing).
- Disabling Hardware Monitor clears `hwFallbackTimer` and skips `handleSystemInfo` DOM mutations.
- Disabling Pomodoro puts the timer ticker to sleep.
- Disabling Media Player halts the audio visualizer render loop and clears the canvas.
Result: The application achieves absolute **0.0% idle CPU** on all configurations.

---

## 21. Multi-Provider Weather & Air Quality Integration Adapter Layer

### 21.1 Architecture & Provider Decoupling
To ensure high availability and resilient atmospheric telemetry worldwide without forcing end-users to register API keys, Local Wally implements a pluggable **Adapter Pattern** layer (`WeatherAdapter` and `AqiAdapter` in `js/api.js`):

```
                       +----------------------------------+
                       |    ApiService.fetchAtmosphere    |
                       +----------------------------------+
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼ (Weather Provider)                          ▼ (AQI Provider)
   +-----------------------------+               +-----------------------------+
   |       WeatherAdapter        |               |         AqiAdapter          |
   +-----------------------------+               +-----------------------------+
     │             │            │                  │             │
     ▼             ▼            ▼                  ▼             ▼
[open-meteo]  [met-norway] [openweathermap]   [open-meteo]    [waqi (AQICN)]
 (Default)     (Keyless)    (Optional Key)     (Default)      (Optional Token)
     │             │            │                  │             │
     └─────────────┬────────────┘                  └─────────────┬─────────────┘
                   ▼                                             ▼
       +───────────────────────+                     +───────────────────────+
       | Unified Weather Data  |                     |   Unified AQI Data    |
       +───────────────────────+                     +───────────────────────+
                   │                                             │
                   └──────────────────────┬──────────────────────┘
                                          ▼
                      +───────────────────────────────────────+
                      | 24-Hour Unified Hourly Forecast Points|
                      | (Catmull-Rom Bezier Normalized Schema)|
                      +───────────────────────────────────────+
```

### 21.2 Weather Providers
1. **Open-Meteo (`open-meteo`) - Default**:
   - Zero API keys required; high global accuracy.
   - Fetches hourly timeseries (`temperature_2m`, `precipitation_probability`, `wind_speed_10m`, `relative_humidity_2m`, `weather_code`).
2. **MET Norway / Yr.no (`met-norway`) - Keyless Alternative**:
   - High-precision Scandinavian meteorological model (`https://api.met.no/weatherapi/locationforecast/2.0/compact`).
   - Complies with strict User-Agent identification policy.
   - Automatically handles m/s to km/h conversion ($v_{\text{km/h}} = v_{\text{m/s}} \times 3.6$) and cross-origin CORS fallbacks.
3. **OpenWeatherMap (`openweathermap`) - Keyed Provider (One Call 3.0 & 2.5)**:
   - Activated when a user specifies an API key in `LivelyProperties` or `config.js`.
   - Prioritizes OpenWeatherMap One Call 3.0 (`https://api.openweathermap.org/data/3.0/onecall`, 1,000 free calls/day tier) for high-resolution current and hourly telemetry.
   - Automatically falls back to OpenWeatherMap 2.5 (`https://api.openweathermap.org/data/2.5/forecast`) if One Call 3.0 is not subscribed on the key.
   - Maps OpenWeatherMap condition IDs to standard WMO codes and normalizes POP ($0.0-1.0 \to 0-100\%$) and precipitation accumulation.
   - Automatically falls back to Open-Meteo if the API key is missing, unauthorized, or network fails.

### 21.3 Air Quality Providers
1. **Open-Meteo Air Quality (`open-meteo`) - Default**:
   - Zero API key required. Queries European AQI (0–100+), PM2.5, and PM10 hourly timeseries.
2. **World Air Quality Index / AQICN (`waqi`) - Keyed Alternative**:
   - Ground-station sensor network covering global metropolitan stations.
   - Normalizes US EPA AQI (0–500) into unified European AQI equivalents with consistent categorical tokens and colors.

### 21.4 Unified 24-Hour Telemetry Schema & 8-Sample Chart Projection
Atmospheric providers ingest a 24-hour forward timeseries. To fit the compact SVG viewBox ($520 \times 120$) without text collisions or clutter, `normalizeForecastPoints()` normalizes the data and chronologically samples **8 discrete forecast points** across the 24-hour horizon (+0h to +21h at 3-hour increments):

```typescript
interface HourlyForecastPoint {
  time: string;           // ISO 8601 string or formatted time (e.g. "14:00")
  label: string;          // Human-readable compact hour label (e.g., "14:00" or "2 PM")
  hour: number;           // Local clock hour (0-23)
  tempC: number;          // Celsius temperature (sanitized finite number)
  tempF: number;          // Fahrenheit temperature (sanitized finite number)
  apparentC: number;      // Feels like Celsius
  apparentF: number;      // Feels like Fahrenheit
  precipProb: number;     // 0 to 100%
  precipitationMm: number;// Liquid precipitation accumulation
  windSpeedKm: number;    // Wind speed in km/h
  windSpeedMph: number;   // Wind speed in mph
  humidity: number;       // 0 to 100%
  aqi: number | null;     // Chronologically mapped AQI index
  aqiCategory: string;    // 'Good' | 'Fair' | 'Moderate' | 'Poor' | 'Very Poor' | 'Unavailable'
  aqiColor: string;       // Hex color matching categorical severity
  wmoCode: number;        // Standardized WMO condition code
  conditionText: string;  // Textual weather description
}
```

*Note on Resolution Hierarchy*: Ingestion stores the 24-hour forward horizon in cache; `SvgForecastChartEngine` receives exactly 8 chronological points ($N=8$, index 0 to 7) for vector Bezier curve drawing and vertex label anchoring.

---

## 22. Google-Style Space-Efficient SVG Forecast Chart HUD Engine

### 22.1 Zero-Reflow Layout Containment
The forecast HUD card `#hud-forecast-card` and chart container `.forecast-chart-container` enforce strict CSS containment:
```css
#hud-forecast-card,
.forecast-chart-container {
  contain: layout paint;
}
```
This isolates internal SVG coordinate and label updates, guaranteeing that tab switches and path recomputations never trigger global reflows in the parent Bento grid.

### 22.2 Multi-Tab Metric Telemetry
Provides 6 switchable pill tabs with color-coded gradients and active indicators:
- 🌡️ **Temperature (`temp`)**: Amber gradient (`#f59e0b` $\to$ `#fbbf24`), dynamic padding based on temperature delta.
- 🔥 **Feels Like (`feels_like`)**: Warm coral gradient (`#fb923c` $\to$ `#f97316`), apparent temperature trajectory mapped via `apparentC` / `apparentF`.
- 🌧️ **Precipitation (`precip`)**: Sky blue gradient (`#38bdf8`), normalized 0–100% scale.
- 💨 **Wind Speed (`wind`)**: Emerald gradient (`#34d399`), auto-scaled with 15 km/h baseline padding.
- 💧 **Humidity (`humidity`)**: Purple/violet gradient (`#a78bfa`), 0–100% relative range.
- 🍃 **Air Quality (`aqi`)**: Green/emerald gradient (`#10b981`), dynamically colored dots matching categorical risk.

### 22.3 Catmull-Rom Cubic Bezier Curve Math
Curves are drawn across the coordinate space ($520 \times 120\text{ viewBox}$) using cubic Bezier approximations of Catmull-Rom splines:
For control points between $P_1(x_1, y_1)$ and $P_2(x_2, y_2)$ given neighbors $P_0$ and $P_3$:
$$CP_1 = \left(x_1 + \frac{x_2 - x_0}{6}, \; y_1 + \frac{y_2 - y_0}{6}\right)$$
$$CP_2 = \left(x_2 - \frac{x_3 - x_1}{6}, \; y_2 - \frac{y_3 - y_1}{6}\right)$$
Control point heights are strictly clamped between $y_{\text{top}} - 4$ and $y_{\text{bottom}} + 4$ to prevent vector clipping against SVG viewport boundaries.

### 22.4 Zero-GC Pre-Allocated Element Pooling & TypedArray Coordinate Buffers
`SvgForecastChartEngine` completely avoids `innerHTML` resets or element destruction:
- Pre-allocates `<circle>` and `<text>` nodes in SVG object pools (`dotPool`, `valLabelPool`, `timeLabelPool`).
- Pre-allocates and reuses `Float32Array` coordinate ring buffers (`this.xs`, `this.ys`), eliminating per-frame and per-tab heap allocations.
- Toggling tabs or receiving fresh telemetry simply mutates attributes (`cx`, `cy`, `textContent`, `d`, `fill`, `stroke`) on existing nodes in-place.
- Elements beyond point length are set to `visibility: hidden` rather than removed from DOM, resulting in **0.0 bytes GC allocation per render**.

---

## 23. v0.6.1 Production Hardening & Network Stream Defenses

### 23.1 Stream-Aware Fetch Timeout & Cancellation
Prior to v0.6.1, `fetchWithTimeout` and XML gateway timeout helpers cleared timers as soon as initial HTTP response headers arrived. If a server stalled during body consumption (`res.json()` or `res.text()`), requests could hang indefinitely.
- **AbortController Integration**: `fetchWithTimeout`, `fetchJsonWithTimeout`, and `requestXml` bind an `AbortController` signal to the native `fetch()` call.
- **Stream-Wrapped Body Methods**: `res.json()`, `res.text()`, `res.blob()`, and `res.arrayBuffer()` are wrapped to keep the deadline active across full stream consumption. If the deadline expires while reading bytes, the controller actively aborts the connection and rejects with a timeout error.
- **Caller Signal Composition**: If the caller passes an existing `options.signal`, the helper observes its abort event and cascades cancellation immediately.

### 23.2 Non-Finite Forecast Number Validation & Safe SVG Rendering
In rare network degradation scenarios or API anomaly payloads, raw metrics can arrive as `NaN`, `Infinity`, `-Infinity`, or `null`.
- **Pre-Render Normalization (`normalizeForecastPoints`)**: A strict `safeNum(val, fallback)` validator verifies `Number.isFinite`. Non-finite anomalies are safely normalized to base values while strictly preserving valid zero (`0`) and negative values (e.g. sub-zero temperatures like `-8.5°C`).
- **Defensive Vector Bounds & Bezier Pathing (`SvgForecastChartEngine`)**: `computeBounds` skips non-finite values and guarantees finite, bounded ranges. Coordinate mapping and cubic Bezier control point calculations clamp non-finite values to fallback bounds, ensuring SVG `d` path strings never contain `"NaN"` or `"Infinity"`.

---

## 24. v0.6.2 Production Audit Hardening, Lifecycle Synchronization & Defensive Resilience

Following a comprehensive production code audit against real-world WebView2 lifecycle behaviors and multi-provider failure modes, Local Wally v0.6.2 applies 22 targeted hardening fixes across lifecycle management, data normalization, UI layout, and tooling:

### 24.1 Lifecycle & Host Event Synchronization
1. **Decoupled Document Visibility & Host Playback State**: Disentangles `hostPaused` (reported by Lively IPC) from `documentHidden` (Page Visibility API). When Lively pauses the wallpaper host, subsequent document visibility changes cannot prematurely unpause playback.
2. **Telemetry & Deferred Snapshot Suppression During Pause**: SMTC track metadata and 60 FPS audio data callbacks discard updates while paused. Late-arriving atmospheric snapshots arriving during pause are queued into `pendingSnapshot` and replayed upon resuming.
3. **Engine Sleep & Canvas Clearing on Feature Disable**: Hiding the companion dock or disabling the audio visualizer transitions `MediaVisualizerEngine` into `isSleeping` and clears the canvas to avoid frozen visualizer frames. Pomodoro timers pause their tick callbacks when docked out.
4. **Zero-Allocation Visualizer Bar Corner Radii**: Replaced per-bar per-frame array allocations (`[2, 2, 0, 0]`) in `roundRect()` with an immutable frozen class constant (`MediaVisualizerEngine.BAR_RADII = Object.freeze([2, 2, 0, 0])`), eliminating ~1,920 array allocations/sec.
5. **Particle Transitions Without Velocity Stagnation**: `ParticleEngine.setWeather()` smoothly transitions existing particles to target velocity, size, alpha, and sway boundaries across weather switches (e.g., Rain to Snow) without velocity pop-in or dropped frames.
6. **Throttled Solar Lighting Cadence with State Guard**: Throttled `SolarLightingEngine.update()` to the 15-second celestial cadence and added `isReset` state guard to avoid redundant DOM CSS variable writes when disabled.

### 24.2 Data Normalization & Provider Defenses
7. **Sequential Step AQI Forecast Join**: Joined AQI forecast telemetry across midnight and timezones using sequential chronological step and timestamp matching rather than vulnerable clock-hour array lookups.
8. **OWM 2.5 3-Hour Interval Sampling Correction**: OpenWeatherMap 2.5 `data.list` chunks (delivered at 3-hour intervals) are sampled with `step = 1`, correctly scoping the 8-point forecast horizon to +21 hours instead of stretching to +63 hours.
9. **Consistent Local Hour Timestamp Parsing**: Parsed UTC ISO timestamps from MET Norway and Open-Meteo into local `Date` objects, ensuring forecast hour labels reflect user-local clock times.
10. **Honest Outage Reporting**: Open-Meteo AQI outages report `available: false`, category `'Unavailable'`, and `europeanAqi: null`, eliminating fabricated "Good (22)" false-positives.
11. **WAQI Pollutant Unit Accuracy**: Preserved WAQI station pollutant readings as `'AQI'` rather than mislabeling index values as `'µg/m³'` concentrations.
12. **Provider Context Validation & Queued Synchronization**: Cache keys bind `weatherProvider` and `aqiProvider` identity. Switching providers invalidates stale cached snapshots, and concurrent sync requests are cleanly queued rather than dropped.
13. **Strict Telemetry Validation**: Hardware system telemetry (CPU, GPU 3D, RAM, Disk, Net Down/Up) and weather metrics strictly enforce `Number.isFinite()`, discarding `NaN` and `Infinity` payloads.
14. **Caller Signal Listener Cleanup**: `fetchWithTimeout()` registers caller `AbortSignal` listeners and removes them in all completion, rejection, and timeout paths.
15. **Decoupled Regional News Ingestion**: Slow regional news RSS gateways and proxy retries resolve in the background without blocking weather and AQI forecast rendering.
16. **Offline Location Country Code**: Corrected offline fallback location for Tokyo from `'US'` to `'JP'`.
17. **Negative Cache Skew Protection**: Negative cache age resulting from system clock adjustments is treated as expired.

### 24.3 UI Layout & Tooling Hardening
18. **Responsive Dock Clamping for 720p/768p Viewports**: Extended compact media queries to `@media (max-height: 768px)` and dynamically clamped `--dock-top` against viewport height to eliminate dock clipping on compact displays.
19. **Keyboard Accessibility for Forecast Tabs**: Implemented roving `tabindex` (`0` on active, `-1` on inactive) with ArrowLeft/ArrowRight/Home/End keyboard navigation and `:focus-visible` outline styles.
20. **Sensitive Credential Log Masking**: `LivelyBridge.emitProperty()` masks API keys, secrets, and tokens with asterisks in console logs.
21. **Preview Server Hardening**: `serve.js` enforces Host header validation (`localhost`, `127.0.0.1`) and blocks access to private dotfile paths (`.git`, `.atl`).
22. **Atomic Release Packaging**: `package_release.js` compresses archives into a temporary file (`local-wally.tmp.zip`) and atomically replaces `local-wally.zip`, preserving prior releases if packaging encounters an error.






