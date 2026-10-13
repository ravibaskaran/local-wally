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
7. **Hardware Telemetry HUD & SVG Sparklines**: Direct host telemetry hook via Lively `--system-information` (`livelySystemInformation`), rendering rolling CPU, GPU 3D, RAM (used/total & %), storage, and network throughput charts with zero-allocation hardware-accelerated SVG vector sparklines (`<svg viewBox="0 0 80 20">`) and an automatic fallback simulator when previewed outside Lively.
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
| Layer 2: [ParticleEngine]   -> SoA Canvas 2D Precipitation (Rain, Snow, Splashes) |
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
| `js/app.js` | Central Orchestrator | State Machine | 60 FPS `requestAnimationFrame` loop, Bento Grid DOM updates, hardware SVG sparklines, news carousel, ephemeris syncing, config parameter binding. |

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
     * **Deep Night** ($\alpha < -0.10\text{ rad}$): Soft moonlit wash (`rgba(2, 6, 23, 0.20)` to `rgba(15, 23, 42, 0.25)`) with `mix-blend-mode: soft-light`, soft celestial lunar bloom (`rgba(219, 234, 254, 0.22)`), and high-clarity wallpaper grading (`brightness(0.86) contrast(1.02)`) to ensure the underlying wallpaper remains illuminated, clear, and visible at night.

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

### 24.4 Post-Audit Defect Verification & Runtime Resilience Fixes
Following independent regression testing across simulated and live WebView2 environments, six residual correctness and lifecycle defects were identified, reproduced with failing test cases in `scratch/test_post_audit_verification.js`, and patched:
1. **Background Regional News UI Dispatch**: Resolved a regression where `ApiService.fetchAtmosphere` attempted to dispatch settled background news via `global.app` instead of `global.App`. Switched to `global.App || global.app` and added pause-state buffering (`pendingNews`) to ensure news updates never drop and never manipulate the DOM while parked.
2. **LivelyBridge Idempotency Guard**: Added a boolean `initialized` guard in `LivelyBridge.init()` to ensure duplicate calls do not attach duplicate `visibilitychange` listeners to `document`.
3. **Symmetric Viewport Clamping for Bottom Dock Offset**: Extended viewport height clamping from `--dock-top` to `--dock-bottom`. When HUD is configured in `bottom-right` or `bottom-left` modes on short viewports (1280×720), the companion dock's bottom offset is clamped to `Math.max(16, vh - 10 - dockHeight)` so it never clips off the top edge of the screen.
4. **Clean SVG Forecast Path & Pool Reset on Empty Data**: Hardened `SvgForecastChartEngine.prototype.render()` to reset SVG path `d=""` attributes and call `ensureElementPool(0)` when `points = []`, preventing ghost vector lines from persisting across forecast clearances.
5. **Visualizer Spectrum Zeroing on Sleep**: Updated `MediaVisualizerEngine.prototype.sleep()` to zero out all 32 bands in `rawSpectrum` and `dampedSpectrum` Float32Arrays, eliminating residual bar height flashes when the visualizer wakes up.
6. **Paused SMTC Media Track Metadata Recovery**: Buffered Windows SMTC `livelyCurrentTrack` payloads received during host pause into `pendingTrack`. Upon unpausing, the buffered track is dispatched to `MediaVisualizerEngine.handleTrackUpdate()`, ensuring media cards never remain out-of-sync after returning from a maximized application.
7. **Canonical Cache Snapshot Regression Testing**: Corrected `test_audit_hardening.js` to assert against the active `LIVELY_HUD_SNAPSHOT` localStorage key rather than obsolete historical key strings.

---

## 25. v0.6.3 Space-Efficient HUD Layout, High-Legibility SVG Vectors & Responsive Architecture

Local Wally v0.6.3 addresses desktop ergonomics, typography hierarchy, and panel whitespace across multi-resolution Windows 11 displays (720p through 4K):

### 25.1 Weather Header & Temperature Proximity Lockup
- **Problem**: `.hud-temp-block` utilized `justify-content: space-between` inside a ~282px column, pushing the temperature number to the left and condition details to the far right. This created an awkward >110px empty void in the center, visually severing closely-coupled weather metrics.
- **Architecture Fix**: Converted `.hud-temp-block` to an integrated flex lockup (`display: flex; align-items: center; justify-content: flex-start; gap: 16px;`). `.hud-condition-meta` is left-aligned (`align-items: flex-start; text-align: left;`) immediately adjacent to the 3.1rem tabular temperature value. Long condition strings wrap naturally (`line-height: 1.2; white-space: normal;`) without truncating or overflowing.

### 25.2 High-Legibility SVG Forecast Chart & Tab Vector Scaling
- **Problem**: The SVG chart's coordinate space (`viewBox="0 0 520 120"`) rendered inside a ~270px wide container (`~0.52x` horizontal scale), reducing 10px value labels and 9px time labels to ~5px physical height. Tab labels like "Precipitation" crammed into 45px slots and truncated.
- **Architecture Fix**:
  - **Concise Tab Tokens**: Button text in `index.html` was shortened to high-density tokens (`Temp`, `Feels`, `Precip`, `Wind`, `Humidity`, `AQI`) with full descriptive `title` attributes, allowing tab font size to scale up to `0.72rem` (11.5px) with `font-weight: 600`.
  - **Scaled SVG Typography**: SVG value labels (`.forecast-val-label`) scaled to 16px font size with 3px high-contrast stroke outlines (`rgba(0, 0, 0, 0.75)` in dark theme, `rgba(255, 255, 255, 0.95)` in light theme). Time labels (`.forecast-time-label`) scaled to 14px with 2.5px stroke outline.
  - **Headroom Expansion**: Chart container height expanded from 96px to 104px, with value label baseline at `y = ys[i] - 8` and time label baseline at `y = 114`, preventing vector collisions.

### 25.3 Content-Fitting Regional Dispatch with Dynamic Pagination
- **Problem**: `#hud-news-block` and `.hud-news-body` specified `flex-grow: 1; justify-content: space-between;`, forcing the panel to expand to match Column 1 height even when showing only 1 headline. This left a >70px blank glass void above the footer dots.
- **Architecture Fix**: Removed artificial `flex-grow: 1;` so `#hud-news-block` derives its height from content. Expanded headline line clamp to 3 lines (`-webkit-line-clamp: 3; line-clamp: 3; font-size: 0.74rem; line-height: 1.35;`). Updated `renderNews()` and `displayNewsItem()` in `js/app.js` to dynamically hide pagination dots when news items $\le 1$ or unavailable, show matching active dots for multi-item feeds, and render a dedicated empty state message.

### 25.4 Balanced Hardware Telemetry Proportions
- **Problem**: Hardware telemetry rows (`.hw-row`) were excessively compressed (`padding: 2.5px 6px; gap: 2px;`) to fit alongside the artificially stretched news card.
- **Architecture Fix**: Relaxed row padding to `4px 7px` and gap to `3px` (with `gap: 4px` on `.hw-metrics-container`). This provides comfortable breathing room for CPU, GPU 3D, RAM, Disk, and Network sparklines, balancing the vertical proportions of Column 1 and Column 2 naturally.

### 25.5 Multi-Viewport Responsiveness & Verification
- Verified across standard 720p (`1280×720`), 1080p (`1920×1080`), 1440p (`2560×1440`), and 4K (`3840×2160`) viewports via headless Chromium/Edge rasterization. Panels remain within viewport bounds with zero clipping, zero overlaps, and 100% desktop icon clearance.

---

## 26. v0.6.4 Regional News Architecture, Offline Moon Astronomy & Contextual Telemetry Drawer

Local Wally v0.6.4 introduces proxy-free regional news ingestion via GDELT DOC 2.0, complete offline lunar ephemeris calculations, an interactive zero-allocation telemetry drawer, expanded 9-position spatial layout control, and media player host identity detection:

### 26.1 GDELT DOC 2.0 API Integration & Multi-Source Fallback Chain
- **Direct Web API Querying**: Replaces CORS proxy dependencies with direct client-side requests to `https://api.gdeltproject.org/api/v2/doc/doc` via WebView2.
- **Safe Query Formatting (`URLSearchParams`)**: Constructs structured queries (`query=(City OR Alias) sourcecountry:CountryCode`, `mode=artlist`, `format=json`, `timespan=2d`, `maxrecords=25`, `sort=datedesc`). Incorporates geographical aliases (e.g. Bengaluru / Bangalore, Mumbai / Bombay) and encodes all parameters safely.
- **Data Normalization & Link Security**: Sanitizes incoming article titles by decoding HTML entities (`&amp;`, `&quot;`, `&#39;`, `&lt;`, `&gt;`), enforces protocol validation (`/^https?:\/\//i`) to reject unsafe URL schemes (`javascript:`, `data:`), and deduplicates syndicated stories by title prefix and canonical URL.
- **Resilient Fallback Hierarchy**: Queries GDELT with country filtering first, falls back to city-only GDELT query, then seamlessly cascades to Google News RSS via CORS proxies, and finally to curated offline news items.

### 26.2 Bundled SunCalc Offline Moon Ephemeris, Cultural Full Moons & Meteor Showers
- **Parabolic Interpolation (`SunCalc.getMoonTimes`)**: Bundles standard offline lunar event algorithms using 2-hour coordinate sampling and parabolic root finding (`roots = 1` or `2`). Accurately calculates local `rise` and `set` Date objects without network dependencies.
- **Polar & Missing Event Detection**: Detects astronomical circumstances where the Moon does not cross the horizon in a solar day (moon day length ~24h 50m) or at extreme latitudes, flagging `alwaysUp` ("Up 24h") or `alwaysDown` ("Down 24h") without throwing or producing `NaN`.
- **Day vs. Night Row Toggling**: Dynamically alternates between the Daytime row (`Sunrise | Solar Noon | Sunset`) and Nighttime row (`Moonrise | Moon Phase | Moonset`) based on solar altitude and sunrise/sunset boundaries.
- **Cultural Full Moons & Astronomical Observances**: Displays universal Western full moon names by month (e.g., Harvest Moon, Wolf Moon) and cultural Vedic Purnima observances (e.g., Sharad Purnima, Guru Purnima) with clear tradition attribution. Integrates an annual transit calendar of major meteor showers (Perseids, Geminids, Orionids, Lyrids, etc.) displaying active dates and peak timing.

### 26.3 Layer 3.8 Contextual Telemetry Detail Drawer (`#hud-card-detail`)
- **Zero-Allocation Interactive Surface**: Clicking or pressing <kbd>Enter</kbd> / <kbd>Space</kbd> on any card (Weather, Forecast, Regional News, AQI, Hardware, Battery, Ephemeris, Media Player, Pomodoro) slides open a reusable acrylic glass modal drawer.
- **Grounded Telemetry Inspection**:
  - *Weather*: Explains current conditions, feels-like temperature, humidity, wind direction/speed, surface precipitation accumulation, mean sea-level pressure, and active provider.
  - *Forecast*: Displays the active metric, prediction horizon (+24h), and an 8-interval table of upcoming predictions.
  - *Regional News*: Displays full article headlines, publisher domains, publication ages, and direct publisher outbound links (`target="_blank" rel="noopener noreferrer"`).
  - *Air Quality*: Shows AQI value, status category, individual pollutant concentrations (PM2.5, PM10, NO₂, O₃), and standard environmental health context.
  - *Hardware Telemetry*: Breaks down CPU, GPU 3D, RAM, Disk, and Network ingress/egress alongside Lively IPC telemetry sampling rates.
  - *Battery Subsystem*: Shows charge percentage, AC power connection state, and laptop power management profiles.
  - *Ephemeris*: Full solar/lunar metrics, illumination percentage, lunar age in days (synodic cycle), waxing/waning status, Western full moon name, Vedic observance, and meteor shower peaks.
  - *Media & Audio*: Displays track title, artist, audio visualizer state, and source application badge.
  - *Pomodoro*: Displays session mode, time remaining, interval configuration, and keyboard controls.
- **Accessibility & Dismissal**: Fully accessible via roving focus, <kbd>Esc</kbd> key listener, and outside-click dismissal. Does not perform hover fetches or per-frame allocations.

### 26.4 9-Position Spatial Layout Grid & Dynamic Companion Dock Offsets
- **Flexible Grid Alignment**: Extends `setHudPosition` to support 9 screen positions: `top-right`, `top-left`, `bottom-right`, `bottom-left`, `middle-right`, `middle-left`, `middle-top`, `middle-bottom`, and `center`.
- **Dock Collision Prevention**: Symmetrically binds `#dock-media-focus` to matching positions with viewport clamping (`--dock-top` and `--dock-bottom`), ensuring companion cards never overlap primary HUD cards or clip display viewports across 720p through 4K displays.
- **Lively Schema Synchronization**: Updates `LivelyProperties.json` and `config.js` with all 9 options.

### 26.5 Windows SMTC Host Media Identity & AUMID Specification
- **Media Source Parsing**: Parses `Source` and `AppId` properties from Windows System Media Transport Controls (`livelyCurrentTrack`) to label players (Spotify, Apple Music, Edge, Chrome, etc.), with neutral `SMTC` fallback when omitted.

---

## 27. v0.7 Targeted Hardening, Correctness & Performance Architecture

### 27.1 Zero-Allocation Scope & Lifecycle Contract
- **Continuous 60 FPS Hot Loop**: The strict zero-heap-allocation guarantee (`0 new Object()`, `0 Array.push()`, `0 Array.splice()`) applies to continuous per-frame rendering:
  - `ParticleEngine`: Struct-of-Arrays (SoA) pre-allocated Float32Array buffers (`pX`, `pY`, `pVx`, `pVy`, `pSize`, `pAlpha`, `pAux`, `sX`, `sY`, `sRadius`, etc.) and ring-buffer splashes.
  - `MediaVisualizerEngine`: Pre-allocated typed arrays (`rawSpectrum`, `dampedSpectrum`, `bandRanges`) and frozen immutable radii constant (`MediaVisualizerEngine.BAR_RADII = Object.freeze([2, 2, 0, 0])`).
  - `PomodoroEngine`: Static trigonometric canvas arc rendering without intermediate allocations.
- **Throttled Discrete Cycles**: Higher-level operations perform small, bounded allocations during scheduled discrete passes:
  - 15-minute background weather/AQI/news JSON parsing and caching.
  - Throttled 1000ms clock ephemeris updates and 2000ms hardware telemetry ticks.
  - User-invoked card detail modal opening and theme changes.

### 27.2 Canonical HUD Geometry
- **Dimensions**: `#hud` enforces `width: 580px; min-height: 395px; height: auto; max-height: calc(100vh - 48px);`.
- **Secondary Column Collapse**: When both Regional News and Hardware Monitor are hidden, `#hud` collapses from 580px to a single-column layout (`~290px`).
- **Compact Viewport Adaptations**: Under `@media (max-height: 600px)` and `@media (max-height: 420px)`, typography scales progressively (`1.4rem` / `1.2rem` clock, `2.0rem` / `1.7rem` temp), padding tightens, and `#dock-media-focus` splits horizontally to opposite display edges when `vh < 600px` to prevent vertical collisions across all 9 HUD positions.

### 27.3 Data Integrity & Lifecycle Hardening
- **Stale News Cache Merging**: When background news promises settle, articles are merged into the live cached snapshot (`currentCached.news = newsArticles`) without overwriting newer weather data.
- **Grounded Air Quality Telemetry**: European AQI never invents fallback readings (no synthetic `20`, `22`, or `Good`). Missing readings propagate as `null` and `Unavailable`, and charts render neutral `--` points.
- **Credential Redaction**: `ApiService.fetchWithTimeout` sanitizes error logs and timeout rejections, stripping query strings (`?[redacted]`) so OWM appids and WAQI tokens never leak into diagnostics.
- **Strict Cache Isolation**: `CacheManager.get` rejects untagged legacy cache entries when specific weather or AQI providers are requested.
- **Browser-Honest MET Norway Routing**: Because browser WebView2 sandboxes cannot send mandatory custom User-Agent headers, `WeatherAdapter['met-norway']` routes cleanly to Open-Meteo with honest diagnostic logging, and unsupported options are removed from the Lively dropdown.
- **Occluded Audio Visualizer Sleep**: `onAudioData` is gated when the companion dock or media player is hidden, preventing silent background wakeups, and disabling the visualizer clears canvas frames cleanly.
- **Hidden Document Initialization**: `App.init` checks `document.hidden` and `LivelyBridge.isPaused` on startup, preventing animation loop startup until the wallpaper becomes visible.
- **Safe Particle Transitions**: Mode changes smoothly lerp velocity and size parameters over a 0.5s transition window without object allocation, and newly activated slots initialize with proper snow parameters on density increases.
- **Static Scene RAF Parking**: The `requestAnimationFrame` loop completely parks (0% CPU/GPU) when scene is static (no active precipitation, splashes, or audio), waking immediately on audio packets or weather changes, and capping at 60 FPS.
- **Coalesced Resizing**: Window resize events coalesce via RAF, skip unchanged canvas backing-store resets, and debounce offscreen contrast pixel sampling by 150ms.
- **Atomic Release Packaging**: `package_release.js` creates a failure-safe `.bak` archive with automatic rollback if replacement fails, preserving existing distribution archives.
- **Accessible Detail Drawer**: Modal traps keyboard focus (Tab / Shift+Tab), closes on Escape, and restores focus to triggering cards.

---

## 28. v0.7.1 Hover Tooltip Restoration, Clean Moon Badge & Hardware Efficiency

### 28.1 Restored Mouse Hover Tooltips Across All HUD Cards
- **Problem**: When HUD cards were wrapped with `.hud-card-interactive` and `tabindex="0"` for the accessible detail drawer, static and dynamic native browser `title` tooltips were absent, depriving users of quick hover glances without clicking.
- **Implementation**:
  - Restored descriptive static `title` attributes in `index.html` across all 9 primary and companion card elements (`#hud-weather-card`, `#hud-metrics-row`, `#hud-forecast-card`, `#hud-ephemeris-card`, `#hud-aqi-card`, `#hud-hw-block`, `#hud-news-block`, `#pomodoro-card`, and `#media-card`).
  - Implemented dynamic DOM `.title` binding on telemetry updates across `App.renderWeather`, `App.renderAqi`, `App.renderCelestial`, `App.handleSystemInfo`, `App.displayNewsItem`, `MediaVisualizerEngine.handleTrackUpdate`, and `PomodoroEngine.render`.
  - Added SVG `<title>` child elements and `title` attributes to all forecast dots and values in `SvgForecastChartEngine.prototype.render`.
  - Zero heap allocation overhead: updates reuse existing DOM string concatenations during discrete throttled updates without impacting the 60 FPS continuous animation loop.

### 28.2 Clean Moon Ephemeris Badge & Artifact Removal
- **Problem**: In `css/style.css`, `.moon-badge` had explicit `border: 1px solid var(--card-border); background: var(--card-bg); border-radius: 8px;`. During New Moon phases, the dark glyph `🌑` caused the empty badge container to look like a clickable button or an isolated horizontal line artifact right above the celestial divider.
- **Implementation**:
  - Redesigned `.moon-badge` to be completely borderless, transparent, and shadowless (`background: transparent; border: none; padding: 2px 4px; box-shadow: none;`). Removed hover background color overrides.
  - Added `#hud-ephemeris-moon` container ID and dynamically toggled `.is-hidden` during nocturnal hours in `App.renderCelestial` (with `.hud-ephemeris-moon.is-hidden { display: none !important; }`), eliminating visual duplication with the dedicated night ephemeris row.

### 28.3 Starfield Buffer Purge & ParticleEngine Hardware Optimization
- **Problem**: Following the elimination of synthetic twinkling stars in v0.6.6, `js/particles.js` retained 6 unused `Float32Array` buffers (`stX`, `stY`, `stSize`, `stBaseAlpha`, `stPhase`, `stSpeed`) and empty iteration loops in `initPools`, `resize`, `update`, and `render`.
- **Implementation**:
  - Purged all 6 unused typed arrays and removed dead loops in `js/particles.js`, freeing memory buffers on integrated GPUs (iGPUs).
  - Maintained backward-compatible properties (`this.activeStarCount = 0`, `this.showStars = false`) so external callers and host properties continue operating cleanly.
  - Preserved 0% CPU/GPU parked animation loop behavior during clear/fair weather conditions.

---

## 29. v0.7.2 Dynamic Day/Night Cards, Ephemeris Precision & Progressive Disclosure

### 29.1 Astronomical Solar Altitude Day/Night State Detection
- **Physical Detection**: Eliminated dependencies on fixed clock hours or stale/mismatched API cache flags (`weather.isDay`) by deriving daytime and nighttime states from physical solar altitude via bundled SunCalc:
  $$\text{altitude} > -0.01454\text{ rad} \quad (\approx -0.833^\circ)$$
  representing the standard astronomical solar upper limb refraction threshold at the horizon.
- **Location & Timezone Grounding**: Calculations execute using the user's selected or geolocated coordinates (`latitude`, `longitude`) and format using explicit IANA timezone identifiers (`Intl.DateTimeFormat(..., { timeZone })`) with cached formatter lookups to avoid instantiation overhead.
- **Polar & Solstice Resilience**: Seamlessly handles high-latitude polar day (midnight sun, where sunset is undefined) and polar night (where sunrise is undefined), displaying clear fallback states (`Polar Day` / `Polar Night`) instead of invalid timestamp representations.

### 29.2 Dynamic Daytime 3-Card Ephemeris Presentation
Replaces the fixed `Sunrise / Noon / Sunset` text row with three responsive, glanceable acrylic cards:
1. **Rain Outlook (`#ephemeris-day-rain`)**:
   - Inspects the upcoming 6-hour hourly precipitation probability and accumulation horizon.
   - Highlights the earliest imminent rain time (e.g., `Rain ~15:00`) and peak probability percentage (`65%`).
   - Displays clear dry-sky confirmation (`No Rain Expected` / `Dry next 6h`) when conditions are clear, or `Unavailable` when forecast telemetry is absent.
2. **Feels-Like Peak (`#ephemeris-day-peak`)**:
   - Computes the maximum apparent ("feels like") temperature from the current hour through local midnight.
   - Displays the peak value with degree symbol (e.g., `28°`) and local occurrence time (`at 15:00`).
   - Gracefully reports `--` / `Unavailable` when forecast data is missing rather than falsifying current temperature.
3. **Daylight Left / Golden Hour (`#ephemeris-day-sun`)**:
   - Tracks morning and evening golden hour windows and remaining solar daylight until local sunset.
   - Displays dynamic countdown timers (e.g., `4h 12m left` or active golden hour indicator).
   - Reports `All Day` during polar day and `None` during polar night.

### 29.3 Dynamic Nighttime 3-Card Ephemeris Presentation
Replaces the fixed moon row with three nocturnal cards:
1. **Next Golden Hour (`#ephemeris-night-golden`)**:
   - Computes the next local morning golden hour window following sunset.
   - Shows local start time and countdown (e.g., `in 8h 24m` / `06:12 - 06:48`).
2. **Moon Phase & Visibility Outlook (`#ephemeris-night-moon`)**:
   - Renders astronomical phase glyph (🌑 to 🌘) and localized human-readable phase name (e.g., `Waxing Crescent`).
   - Displays illuminated fraction percentage (`14%`) and synodic waxing/waning direction.
   - Derives whether the moon is currently above the local horizon via `SunCalc.getMoonPosition(now, lat, lng).altitude > 0`.
   - Incorporates forecast cloud cover as an explicitly labeled visibility factor (e.g., `Visible · Clear Skies` or `Hidden · Overcast`).
3. **Next Sky Event (`#ephemeris-night-event`)**:
   - Evaluates the nearest upcoming celestial transit among astronomical dawn, sunrise, moonset, or moonrise.
   - Automatically prevents duplicate reporting with Card 1 (Golden Hour) by selecting the next distinct transit.
   - Includes bundled high-precision 2026 NASA astronomical calendar events (Orionids, Geminids, Perseids, Solstices, Equinoxes).

### 29.4 Progressive Disclosure Floating Hover Popover (`#hud-hover-popover`)
- **Acrylic Floating Surface**: A unified floating acrylic popover element positioned directly before closing `</body>` tags, featuring 12px backdrop blur, hardware-accelerated transitions, and high-contrast glass typography.
- **Contextual Intelligence**: Progressive disclosure across 22 HUD and companion dock elements (weather, metrics, day/night cards, AQI, hardware sparklines, battery, news, Pomodoro, and media player).
- **Viewport Clamping**: Dynamic coordinate clamping enforces minimum 8px margins from all viewport boundaries, preventing screen clipping across multi-monitor setups and 720p through 4K displays.
- **Accessibility & Focus Integration**: Dual pointer hover (`pointerenter` / `pointerleave`) and keyboard focus (`focusin` / `focusout`) listeners; dynamically binds `aria-describedby="hud-hover-popover"` to focused controls; dismisses immediately on <kbd>Escape</kbd>.
- **Zero Network Egress**: Popover content is constructed entirely from existing client-side cache and telemetry state—zero background fetches on cursor motion.

### 29.5 Interactive Live News Dots
- **Accessible Controls**: Converted static pagination indicators into accessible `<button class="news-dot" type="button" role="tab" aria-selected="..." data-idx="...">` elements within a `role="tablist"` container.
- **Metadata Hover Preview**: Hovering over any dot immediately reveals the story publisher domain and relative publication age (`2h ago`) within the floating hover popover.
- **Instant Story Selection**: Clicking or pressing <kbd>Enter</kbd> / <kbd>Space</kbd> on a dot immediately selects and transitions to that story, resetting the automatic 7-second rotation timer to avoid jarring mid-read slide changes.

---

## 30. v0.7.3 Audit Hardening, Lifecycle Integrity & Telemetry Precision

### 30.1 Delegated News Listener & Invalidation Lifecycle
- **Delegated Container Listener**: Bound a single idempotent click handler to `#hud-news-dots` (`this.dom.hudNewsDots`), resolving active dots via `e.target.closest('.news-dot')`. Eliminates cumulative event listener accumulation across periodic GDELT news renders.
- **Timer Invalidation**: Enhanced `clearNewsTimers()` to cancel both `this.newsTimer` and `this.newsTransitionTimer`, while removing `.is-fading`. Invoked synchronously upon manual dot selection (`selectNewsStory(idx)`), preventing delayed (~300ms) carousel transition callbacks from overriding manual selections.
- **Accessible Navigation**: Implemented roving `tabindex="0"` on the active story dot and `tabindex="-1"` on inactive dots, with comprehensive keyboard directional navigation (`ArrowRight`, `ArrowLeft`, `ArrowDown`, `ArrowUp`, `Home`, `End`).

### 30.2 Authoritative Physical Solar Altitude Day/Night Threshold
- **Physical Derivation**: Solar altitude evaluated via SunCalc against the physical threshold:
  $$\text{altitude} > -0.01454\text{ rad}$$
  Physical altitude is authoritative; weather provider `isDay` flags are never permitted to override valid solar calculations.
- **Polar Symmetry**: Standardized polar day and polar night classifications to the identical `-0.01454` rad threshold, avoiding conflicting horizon boundaries.
- **Isolated Timezone Context**: Implemented `getTimezoneContext()`, caching `Intl.DateTimeFormat` instances across runtime cycles. Gracefully returns `null` for missing or invalid timezones rather than falling back to host machine time.

### 30.3 Zero-Fabrication Forecast Telemetry & Boundary Filtering
- **Preserved Nulls**: Purged synthetic linear interpolation padding in `js/api.js` (`normalizeForecastPoints`). Empty or partial provider responses return true data points with missing measurements preserved as `null`.
- **Chart Resilience**: `SvgForecastChartEngine` formats missing values as `'--'` without inflating bounding box scales.
- **Horizon Constraints**:
  - Daytime Card 1 (Rain Outlook) filters points strictly within the upcoming 6-hour window ($[\text{now} - 30\text{m}, \text{now} + 6\text{h}]$).
  - Daytime Card 2 (Feels-Like Peak) strictly scopes search to the current local calendar date (`todayKey`), preventing tomorrow's peak temperature from leaking into today's card.

### 30.4 Chronological Sky Events & Night Outlook Resilience
- **Chronological Sorting**: Night Sky Event card aggregates valid candidate celestial transits (astronomical dawn, sunrise, moonset, moonrise), strictly sorting candidates chronologically (`.sort((a,b) => a.time - b.time)`). The earliest upcoming transit is selected, avoiding duplicates with the Golden Hour card.
- **Honest Cloud Outlook**: Moon Visibility Outlook reports `"Conditions unavailable"` when weather conditions are absent, never fabricating `"Clear sky"`.

### 30.5 Viewport-Safe Floating Hover Popover & Accessibility
- **Containment & Scroll**: Added `.hud-hover-popover { max-height: calc(100vh - 16px); overflow-y: auto; box-sizing: border-box; word-break: break-word; }` to protect multi-monitor, high-DPI, and compact laptop viewports.
- **Edge Clamping**: Clamps popover rendering coordinates to maintain an 8px boundary buffer from viewport edges.
- **Expanded Focus Targets**: Added container targets `#hud-hw-block` and `#hud-metrics-row` with `tabindex="0"` and rich contextual popover content (`hw-block`, `metrics`). Immediate dismissal supported via <kbd>Escape</kbd>.

### 30.6 Single RAF Owner Pattern & Complete Background Parking
- **Single RAF Owner**: Reset `this.animationFrameId = null` at the start of `loop()`, ensuring clean ownership. Canceled pending RAF before scheduling in `startLoop()`.
- **Zero-Load Parking**: `stopLoop()` halts `clockInterval`, `hwFallbackTimer`, `syncInterval`, and news timers, ensuring true 0% CPU and 0% GPU load during Lively Wallpaper sleep/game modes.
- **Early Lively Lifecycle Hook**: Added early `global.livelyWallpaperPlaybackChanged` fallback in `js/lively.js` prior to `init()`, and reconciled initial document visibility (`document.hidden`).

---

## 31. v0.8 Multi-Source Wallpaper Providers & Localized News Architecture

### 31.1 Multi-Provider Wallpaper Architecture
- **Supported Providers**:
  - **Unsplash** (Default): Keyless high-resolution curated CDN fallbacks + optional developer API key.
  - **Wallhaven**: Keyed landscape wallpaper search (`https://wallhaven.cc/api/v1/search`), filtered to general/SFW landscape ratios (`16x9,16x10,21x9`) and native resolution thresholds.
  - **Pexels**: Keyed landscape photography via official REST API (`https://api.pexels.com/v1/search`) with `Authorization` header.
  - **Pixabay**: Keyed horizontal landscape photography via official API (`https://pixabay.com/api/`).
  - **Rotate Configured Sources**: Cycles through configured (keyed) providers in stable round-robin order (`Unsplash → Wallhaven → Pexels → Pixabay`). Persists cursor to `localStorage`, advances after every attempt to prevent broken provider traps, and bounds to at most 1 primary request + at most 1 Unsplash fallback.
- **Aspect Ratio Closeness & Candidate Ranking**:
  - Computes target screen aspect ratio from device resolution ($W / H$).
  - Evaluates candidates by aspect ratio difference $|(W_c / H_c) - (W / H)|$, resolution sufficiency ($W_c \ge 0.75W, H_c \ge 0.75H$), and filters against recent history.
- **Bounded Recent Wallpaper History**:
  - Maintains a strict 80-item recent ID/URL history (`local_wally_recent_wallpapers` in `localStorage`) to prevent repeats during rotation.
- **Weather Condition Mapping**:
  - Maps real-time weather categories to landscape search terms (`Clear` $\to$ clear sky / night sky, `Cloudy/Overcast` $\to$ cloudy, `Rain/Drizzle` $\to$ rainy, `Snow` $\to$ snowy, `Fog/Mist` $\to$ misty, `Storm/Thunderstorm` $\to$ stormy, unknown $\to$ neutral nature landscape). Never transmits GPS coordinates to image services.
- **Credential Redaction & Privacy**:
  - API keys are never written to source files or logged. Query-based provider keys (Pixabay) are automatically scrubbed via `sanitizeUrl()` before logging or error rejection.

### 31.2 Localized News Providers & 15-Minute Cache Firewall
- **Supported News Providers**:
  - **Google News** (Default & Fallback): GDELT DOC 2.0 direct publisher news with Google News RSS fallback.
  - **NewsAPI**: Keyed headlines via `/v2/everything` with `X-Api-Key` header, local city & country disambiguation, and safe `https:` link validation. Client-side CORS/426 restrictions on developer tiers automatically fall back once to Google News.
  - **Currents News**: Keyed global news search via `/v1/search` with Bearer auth, keyword targeting, and ISO-2 lowercase country filtering.
  - **Rotation Mode**: If $\ge 1$ keyed provider is configured or rotation is explicitly selected, cycles between Google News and configured sources during refresh cycles.
- **15-Minute Cache Firewall**:
  - Enforces `15 * 60 * 1000` ms cache lifetime in `localStorage` (`LIVELY_HUD_NEWS_SNAPSHOT`).
  - Reloads, UI renders, hovers, story clicks, and property updates are strictly prevented from bypassing the firewall.
  - In-flight request de-duplication (`_activeNewsPromise`) guarantees zero parallel duplicate requests.
- **Dynamic Semantic Card Labeling**:
  - News card title (`#hud-news-title`), source label, and accessibility attributes update dynamically based on the active provider (`Google News`, `NewsAPI`, `Currents News`).
  - Fallback articles are labeled `Google News`, preserving honest provider status.
  - Direct publisher links are validated and prioritized over aggregator wrapper URLs.

---

## 32. Production Code Audit & Performance Architecture (v0.8.1)

### 32.1 Security & Protocol Hardening
- **Strict HTTPS Protocol Enforcement**: All external links (`#hud-news-link`, `#unsplash-credit`) are validated with `/^https:\/\//i`. Insecure `http://` links default safely to secure URLs with `target="_blank"` and `rel="noopener noreferrer"`.
- **Credential & Token Sanitization**: Network timeout rejections (`ApiService.fetchWithTimeout`) redact query parameters (`safeUrl = url.split('?')[0]`), guaranteeing API tokens never leak to console logs or telemetry envelopes.
- **HTML Injection Defense**: All floating popover titles (`showHoverPopover`) are sanitized with `App.escapeHtml(content.title)` prior to DOM injection.
- **Preloader Callback Cleanup**: Preload image instances in `updateBackground` explicitly detach `onload = null` and `onerror = null` to prevent memory leaks and dangling closure references.

### 32.2 Zero-Allocation Render Loop & Memory Architecture
- **In-Memory Cache Age Tracking**: `CacheManager` caches envelope timestamps in memory (`this._cachedTimestamp`), eliminating `localStorage.getItem` reads and `JSON.parse` object allocations during 1-second clock updates.
- **Sparkline Path Attribute Caching**: `SvgSparklineEngine` caches `_lastLineD` and `_lastAreaD` strings, skipping redundant DOM mutations during identical telemetry samples and pre-calculating horizontal coordinates without `.toFixed()` allocations.
- **Ephemeris Deduplication**: Solar and lunar ephemeris (`SunCalc.getPosition`, `SunCalc.getMoonPosition`, `SunCalc.getMoonIllumination`) are computed once per update cycle in `App.updateClock` and shared directly with `SkyEngine` and `SolarLightingEngine`.
- **Pre-Parsed Celestial Palette Vectors**: Color constants in `SkyEngine` are pre-converted to numeric RGB vectors on script initialization, eliminating string parsing and regex operations during continuous 60 FPS lerp evaluations.

### 32.3 Compositor & Process Parking (True 0.0% CPU)
- **Lifecycle Animation Suspension**: `App.startLoop()` and `stopLoop()` dynamically toggle `.is-paused` on `document.body`. This binds to `.is-paused * { animation-play-state: paused !important; }` in CSS, ensuring that infinite CSS keyframe animations (such as charging pulses) suspend completely when the wallpaper sleeps.
- **High-Refresh Display Calibration**: The frame-skip threshold is calibrated to `14.5ms`, guaranteeing smooth 60 FPS pacing without dropping frames on 120Hz, 144Hz, or 240Hz monitors.
- **Zero-Asset Audio Synthesis**: The Pomodoro timer synthesizes a dual-tone audio chime (587.33 Hz → 880 Hz) using the browser's native Web Audio API (`AudioContext`), delivering clean completion cues without bundling external audio assets.

## 33. Consolidated Audit Fixes, Timezone Correctness & Render-Loop Integrity (v0.8.2)

### 33.1 Render-Loop & Lifecycle Integrity
- **Single RAF Chain Invariant**: The final re-arm in `App.startLoop()` is delegated to the guarded `App.wakeAnimationLoop()` instead of a bare `requestAnimationFrame`, so the pending-snapshot drain (which wakes the loop through `renderAll → updateAtmosphereEngines → wakeAnimationLoop`) can no longer produce a second parallel frame chain. `stopLoop()` therefore cancels the one true chain, and the active animation path performs exactly one `loop()` invocation per vsync.
- **Boot Visibility Reconciliation**: `LivelyBridge.init()` re-reads `document.hidden` and calls `updatePlaybackState()` immediately after attaching the `visibilitychange` listener, closing the window in which a hidden→visible transition before init would leave stale pause state and permanently park the loop, timers, clock, and sync.

### 33.2 Timezone-Aware Forecast Horizons
- **Absolute Adapter Timestamps**: All three weather adapters (Open-Meteo, MET Norway, OpenWeatherMap) attach epoch-millisecond `timestamp` fields to every normalized forecast point. Open-Meteo resolves its `timezone=auto` location-local naive strings (`2026-10-12T14:00`) without host dependence: `Date.UTC(components) − utc_offset_seconds`. Explicit-offset/`Z` strings parse directly; unresolvable strings emit `null` so downstream fallbacks run.
- **Offset-Bearing Fallback Contract**: The Rain Outlook and Feels-Like Peak horizon filters (`renderCelestial`) consult `pt.timestamp` first, then `pt.isoTime` only when it carries an explicit offset or `Z` (precompiled `App.isoTimeHasOffsetRe`), and finally the legacy `HH:00` host-local last resort. Cached snapshots from any provider therefore never mis-date points across midnight or timezone boundaries.

### 33.3 Security & Data Integrity Hardening
- **Drawer Escaping Completion**: All provider-sourced interpolations in the weather detail drawer (humidity, surface wind, precipitation, barometric pressure) pass through the local `esc()` escaper, matching the condition-text and wind-direction fields.
- **Honest AQI Normalization**: The three AQI normalizer sites (Open-Meteo `european_aqi`, WAQI wrapped `data.aqi`, WAQI direct-object with finite-value preference) return the canonical `available: false` / `category: 'Unavailable'` envelope on degenerate success payloads instead of fabricating index values.
- **CSS URL Interpolation Hardening**: Both wallpaper ingest points (`restoreCachedWallpaper`, `updateBackground`) strip quote/backslash/control characters from URLs before composing `url("...")` background images.
- **News Attach Rejection Guard**: The background news-settle chain in `ApiService.fetchAtmosphere` carries a `.catch` warn handler, preventing unhandled promise rejections.

### 33.4 Rendering & Interaction Refinements
- **Reflow-Free Auto-Resize**: `updateLayoutAutoResize` pre-captures the media visualizer wrap width (steady-state gated) before style/class writes; `MediaVisualizerEngine.resize()` consumes the cached sample, eliminating the per-invocation read-after-write layout invalidation.
- **Wall-Clock Silence Sleep**: The visualizer tracks silence as a `performance.now()` window in a single counting site and enters deep sleep at 1.5 s of continuous silence, removing the double frame counting (host push + render) that fired at ~0.75 s.
- **Astronomical Dawn Event Card**: The Next Sky Event candidate prefers `nightEnd` (−18°) per §29.3/§30.4 with `isNaN` guards against SunCalc's Invalid Date at circumpolar latitudes, mirrored in the tomorrow-fallback path.
- **Open-Drawer Freshness**: `renderAll` re-renders an open detail drawer through `renderCardDetailContent` while preserving `hudDetailBody.scrollTop`, guarded by a warn-level catch.
- **Warm-Path Write Guards**: Pomodoro time/title and diagnostics counters (cache TTL, sync status, FPS, frametime, particles, GPU profile) route through `App.setDomText` or inline `!==` dirty checks. `prefers-reduced-motion: reduce` disables the charging pulse animation.

### 33.5 Verification & Change Footprint
- 6/6 regression suites at 100% (v081, v08-providers, v073, v072, v071, v07-targeted); `node --check` clean across all 22 JavaScript files; git whitespace clean.
- Change footprint: 4 files, +197/−42 (`js/app.js`, `js/api.js`, `js/lively.js`, `css/style.css`).
- Integrated-GPU guidance unchanged: lowering `glassBlurPx` remains the single largest GPU-bandwidth saving, as the glassmorphic backdrop blur composites over the live particle canvas each frame.


## 34. News Engine Integrity, Timezone-Correct Forecasts & Render Pacing (v0.8.3)

### 34.1 News Request Isolation & Quota Firewall
- **Request-Identity Binding**: `ApiService.fetchNews` computes a normalized identity for every request — `{location query, country, selected provider/mode}` (`provider|query` or `rotate|eligible-set|query`). A `_newsLatestIdentity` supersede check makes a delayed response resolve empty for any request whose identity has been superseded: superseded results can never write the response cache, mutate visible news, or restore a captured pending snapshot. The documented fixed-mode provider-match permissiveness is preserved.
- **Bounded In-Flight Deduplication**: Equivalent concurrent requests share one in-flight promise in an identity-keyed map, cleaned on settle; overflow past 16 entries evicts only the single oldest identity (insertion order tracked), so live dedupe entries survive and a repeat call for a retained identity never double-fires the network.
- **Per-Provider Quota Firewall (§31.2 hardened)**: ≥15 minutes between network attempts per actual keyed provider, enforced before any request fires. Nothing bypasses it — settings property updates, reloads, and global refresh all route through the same gate (the legacy force parameter was removed at both call boundaries). Attempts — including failures — are marked before firing, so a failing provider cannot produce a retry storm. Timing combines monotonic in-session `performance.now()` with a persisted epoch stamp; backward clock jumps are respected (up to 24 h skew) and absurdly future-dated stamps are treated as corrupt and reset once. The response cache (query/provider-aware, TTL-gated) remains logically separate from quota eligibility; cache reads never consume quota.
- **Rotate-Ready Selection**: In rotate mode, a cooldown-locked cursor provider no longer stalls rotation for the whole window — the attempt selects the first cooldown-ready eligible provider; when every eligible provider is locked the request stays blocked (the firewall itself is never bypassed).
- **Honest Terminal States (no fabrication)**: The synthetic-headlines fallback with real-publisher attribution is deleted from production paths. Terminal failure serves matching real cached stories (stale-marked, displayed as "Cached") or an explicit empty/unavailable state. The offline mock bundle ships an empty news array rather than invented headlines.
- **Publication Timestamp Normalization**: Provider timestamps normalize to validated `publishedMs` — GDELT compact UTC (`20261012T093000Z`), RSS zone-bearing RFC-822 `pubDate` (now parsed), NewsAPI/Currents offset-bearing ISO. Zoneless date-only strings are never interpreted through the host timezone (a bare `YYYY-MM-DD` even superficially resembles an offset-bearing string; a time component is required before zone checks). Stamps >24 h in the future are treated as unknown metadata. Article age is computed at display time (`App.formatNewsAge`); stale cache hits render "Cached".

### 34.2 Timezone-Correct Forecast Presentation & Analytics
- **Unixtime + IANA Presentation (LW10)**: Open-Meteo weather and air-quality requests use `timeformat=unixtime`; epoch seconds convert to absolute ms instants (`ApiService.toEpochMs`) and hour/time labels format through cached per-timezone `Intl.DateTimeFormat` hour formatters (`ApiService.formatTzHour`, `24→0` normalization). DST transitions display correctly — the US 2026 spring-forward day shows 00,01,03,04,05 for the 05Z–09Z instants. The v0.8.2 offset-aware ISO parse path is retained as a fallback so old cached payloads keep working; AQI↔forecast matching aligns by absolute instants (±30 min) with the legacy string-prefix path as fallback.
- **Local-Calendar Remaining-Day Window (LW02, §29.2)**: The Feels-Like Peak selection replaces the whole-hour boundary search and fixed 24 h arithmetic with per-point local calendar-date keys computed via one cached `tz+'_YMD'` formatter, from the current interval onward (`hPtMs + 3600000 <= now` excludes ended intervals — a past morning peak cannot win). Correct for +5:30/+5:45 offsets and 23/25-hour DST days; no tomorrow leak. Without a valid timezone the card reports `Unavailable / No forecast timezone` — never silently host-local. Undated points (non-finite timestamps) never participate in rain or peak analytics (LW03).
- **Full-Resolution Analytics (LW08)**: All three adapters emit `hourlyAnalytics` — every available hourly measurement with absolute timestamps, nulls preserved — alongside the 8-point chart projection, which is display-only and sampled from the current interval forward (all-past fixtures clamp to the first row). `renderCelestial` prefers the analytics list; old/partial snapshots degrade safely to the reduced chart list, backfilled at both cache-read paths. The cache schema addition is additive and backward compatible.
- **Honest Chart Gaps (LW09)**: `SvgForecastChartEngine.render` tracks metric validity in a `Uint8Array` mask; SVG paths are built per contiguous valid run (missing points never bridge the curve, substitute the bounds minimum, or act as spline control points), area fills close independently per run, missing-value dots and value labels hide, and an all-null series renders the unavailable state. Valid zero/negative values plot as real values; element pooling and finite-coordinate checks preserved.

### 34.3 Render Pacing, Compositor & Drawer Interaction
- **Remainder-Preserving Frame Pacing (LW07)**: `App.loop` maintains a 60 Hz `_paceDeadline` accumulator — render when `currentTime >= deadline − 1ms`, then `deadline += 1000/60` with a catch-up clamp if behind. The previous `elapsed < 14.5` + reset logic discarded fractional remainder each frame (144 Hz → ~48 fps, 165 Hz → ~55 fps); deterministic scheduler simulations now average ~60 renders/second at 60/120/144/165/240 Hz. Physics/visualizers receive the actual elapsed time since the previous rendered frame (never a fixed step or the pacing remainder), clamped at 250 ms; pacing state resets on wake/resume; exactly one pending RAF and demand-driven parking are preserved.
- **ScaleX Telemetry Fills (LW17)**: CPU/GPU/RAM/disk/network/battery fills keep a fixed full width and animate `transform: scaleX(clampedFraction)` (`transform-origin: left`) via `App.setBarFill`, with a detached-receiver fallback in `handleSystemInfo`; inline width writers removed from markup. The multicolor AQI gradient intentionally retains width semantics (color meaning). Reduced motion disables the transition.
- **Discrete Positioning + FLIP Dock Moves**: HUD and dock transitions no longer interpolate `width`/`top`/`bottom`; final geometry applies discretely. `setHudPosition` captures the dock's pre-move rect and animates only the inverse translation back to zero (transform-only `element.animate`, 260 ms, feature-detected), cancels the prior FLIP before starting a new one, and skips entirely under `prefers-reduced-motion`.
- **Generation-Guarded Wallpaper Loads (LW11)**: `updateBackground` bumps a generation counter per candidate; `onload`/`onerror` no-op when superseded — obsolete completions cannot touch buffers, credits, contrast state, `lastLoadedImage`, or the persisted boot image; a failed newest candidate keeps the visible image. Double buffering and pause behavior unchanged; no ImageBitmap/worker decoding added.
- **Drawer Focus Preservation (LW01)**: `renderCardDetailContent` computes a cheap content signature and skips DOM replacement when unchanged; on replacement it captures whether focus is inside the drawer and the focused story's `data-news-index`, restores focus without scrolling (`focus({preventScroll:true})`), and falls back to the drawer's close control — never the page background. Modal focus containment, Escape behavior, and the open-drawer scroll-preserving refresh (§33.4) are preserved.

### 34.4 Storage Independence & Clock Resilience
- **Stale-First Boot (LW12)**: `loadAtmosphere` paints a validated provider-matching stale snapshot (via `CacheManager.getAny`) before awaiting the network, marked `fromCache`/`isStalePaint`. While shown, the existing sync-status element renders "Cached"; the state clears automatically when a current-generation snapshot replaces `this.state`. Rendering never rewrites the envelope timestamp or extends freshness.
- **Memory-Source-of-Truth Cache (LW16)**: `CacheManager` publishes the in-memory envelope before best-effort persistence; `get`/`isExpired`/`getAgeMs` serve from memory with a one-shot storage warm-up and memoized absence (clock ticks never re-read absent/corrupt storage). `update()` mutates data while preserving the original timestamp — attaching late news no longer extends atmosphere freshness. A once-bound `storage` listener reconciles relevant external writes (snapshot and TTL keys). Persistence failure surfaces via `isPersisted()` as a "· RAM only" suffix on the existing diagnostics label — never as a network failure.
- **Clock-Jump Recovery & Rotation Resilience**: Negative elapsed celestial time (backward wall-clock jump) triggers an immediate ephemeris refresh with no new timers (LW13). Wallpaper/news rotation cursors and recent-wallpaper history are memory-first — updated before best-effort persistence, bounded at 80, loaded-validated, and modulo-normalized against eligible provider counts at use (LW14).
- **Timeout Guard (LW18)**: `fetchWithTimeout` accepts only finite positive numeric delays; anything else falls back to the 5 s default — eliminating the non-numeric-delay path identified as the root cause of the long-standing `TimeoutNaNWarning` in the v0.7 harness.

### 34.5 Verification, Footprint & Explicit Measurement Limits
- 8 suites green: the six regression suites (v081, v08-providers, v073, v072, v071, v07-targeted), the new v0.8.3 suite at 62/62 (deterministic 60/120/144/165/240 Hz pacing simulations, DST-day timezone cases for Asia/Kolkata, Asia/Kathmandu, and America/New_York on both 2026 transition days, and news identity/quota race scenarios), and the audit-hardening suite at 22/22. `node --check` clean across all 23 JavaScript files; git whitespace clean.
- Change footprint: 5 files, +1207/−509 (`js/app.js`, `js/api.js`, `js/cache.js`, `css/style.css`, `index.html`).
- **Explicit measurement limits**: No on-device CPU, GPU, or GC measurements were taken in this pass. The pilot gates defined for later phases — adaptive render quality and WebGL2 instanced particles — are acceptance thresholds (e.g. a measured ≥20% render-time reduction on target hardware), not claimed results; they remain unexecuted because on-target WebView2 profiling was not available. WebGPU, WASM SIMD, Blob workers, OffscreenCanvas, and SharedArrayBuffer remain rejected-for-now absent a measured bottleneck. All performance statements in this section are source-derived (code-path analysis and deterministic simulation), not instrumented measurements. Deferred investigations: CSP meta policy validation against Lively's file loading/injected callbacks, multi-instance storage sharing semantics, and DPI-change recompute behavior.

## 35. Keyed-First News Default, 5-Minute Auto Refresh & HUD Polish (v0.8.4)

### 35.1 Provider Selection & Live-Probe Diagnosis
- The v0.8.3 news default was hard-locked to the Google News chain; configured NewsAPI/Currents keys were consulted only in rotate mode or on explicit selection. A live desktop install with all keys configured still degraded to "Regional dispatch unavailable".
- Live probes at decision time: GDELT DOC 2.0 returned HTTP 429 (rate-limited), `api.allorigins.win/raw` timed out at 30 s, and `corsproxy.io` returned HTTP 401 (it now requires allowlisted origins). The chain's three legs were independently confirmed non-functional; the GDELT skip guard for placeholder locality names (`'Local'`, `'Metropolitan'`) made the failure terminal in many installs.
- Resolution: an **"Auto (API keys first)"** provider mode (dropdown item 0, default) resolves Currents → NewsAPI → Google News when keys exist. Rationale is CORS transport reality in WebView2: Currents sends open CORS headers and works from null/localhost origins; NewsAPI's free plan blocks browser-origined preflight of its `X-Api-Key` header, so it is tried second; a keyless install keeps the Google News chain. Request identity is built from the RESOLVED provider, so cache, in-flight dedup, and the quota firewall see a stable key per resolved provider.

### 35.2 Tiered Quota Firewall & 5-Minute Automatic Cadence
- The per-provider cooldown is now tiered: keyed providers (NewsAPI, Currents) keep the unbypassable 15-minute window; the keyless Google News chain (GDELT + public RSS gateways) runs a 5-minute window. Nothing added in v0.8.4 bypasses the firewall — attempts are still marked before firing, failures still count, timing is still monotonic and persisted, and there is still no force path.
- `NEWS_CACHE_TTL_MS` dropped to 5 minutes so a tick that lands outside the provider cooldown reaches the network instead of serving a still-fresh envelope; when a keyed provider is inside its 15-minute window, the blocked path serves honestly stale-marked cached stories (no network attempt is marked).
- A dedicated `newsFetchTimer` (300000 ms) drives news independently of the atmosphere cycle: created on start (feed-enabled, not paused), cleared on park/stop and feed-disable, re-created on late enable with an immediate pause-gated fetch. Idempotent across park/resume and enable/disable toggles.
- The manual refresh control is gone: footer button, DOM binding, click handler, spin state, and the `R` keyboard shortcut removed; the footer keeps only the sync indicator. Setting toggles that legitimately refresh atmosphere on change are untouched (the firewall still gates all news network attempts internally).

### 35.3 Google News Chain Hardening
- Unusable locality names (empty, `'Local'`, `'Metropolitan'`, the `'Local Area'` placeholder) skip both the GDELT query and the meaningless geo-feed proxy attempt, landing directly on the national feed.
- The national fallback feed is country-aware (`gl`/`ceid` built from the resolved country code, `hl=en`) instead of hardcoded US — keyless users outside the US receive their own regional edition.
- A third public CORS gateway (`api.codetabs.com/v1/proxy`) sits between the primary and fallback proxies, first-success-wins with 5 s per leg; overridable via the new `middleCorsProxy` config knob. Worst-case RSS-leg latency is now ~15 s per feed (~37 s full chain) — accepted for the keyless path only, since keyed providers bypass proxies entirely.

### 35.4 HUD Layout, Metric-Card Alignment & 12-Hour Clock
- The secondary Bento column top-stacks (`justify-content: flex-start`), and `#hud-hw-block` absorbs the column's spare height in every visibility combination (flex column + space-between + relaxed metric rows) — the reported large whitespace gap between hardware telemetry and the news card is replaced by balanced telemetry rows and a bottom-anchored news card; the hw/news divider survives only while the news card is visible (`:has(#hud-news-block:not(.is-hidden))`).
- Environmental metric cards (Humidity/Wind/Precip) are left-justified (`align-items: flex-start`, `text-align: left`, relaxed padding).
- The top clock renders a 12-hour AM/PM presentation via the cached timezone formatter in `formatToParts` mode (`hour12: true`, en-US guarantees a `dayPeriod` part; midnight = 12 AM, noon = 12 PM) with a correct manual 12-hour fallback; no consumer parses the clock text, so the suffix is presentation-only.

### 35.5 Migration, Footprint & Verification
- **Dropdown migration**: the new "Auto" item shifts previously stored numeric selections by one (old 1/2/3 = NewsAPI/Currents/Rotate now read as Google News/NewsAPI/Currents). Default-index installs upgrade transparently to Auto. Explicit re-selection restores prior intent; documented in README and release notes.
- Change footprint: 6 files (`LivelyProperties.json`, `config.js`, `js/api.js`, `js/app.js`, `index.html`, `css/style.css`). Scratch-only suite change: `test_v073_audit_fixes.js` gained `URLSearchParams` in its vm sandbox (mirrors the v0.6.4 precedent; required after the boot path began exercising the real GDELT query builder).
- Verification: all 7 suites green (v0.8.3 suite 62/62 including the CORS-aware failover case, providers/v0.8.1/v0.7.3/v0.7.2/v0.7.1/hardening at 100%), `node --check` clean on touched files, `git diff --check` clean. Fresh-context adversarial review: SHIP-WITH-NITS, zero MAJOR findings (cityUsable placeholder coverage, pause-gated late-enable fetch, index-migration documentation, `R` shortcut removal, `middleCorsProxy` knob — all fixed; ~15 s worst-case keyless latency accepted). Known-open baseline failures unchanged (not gates).

## 36. Hard Keyed-News Quota Guarantee & GDELT Reliability Verdict (v0.8.5)

### 36.1 Hard-coded keyed cooldown
- The keyed-provider cooldown is pinned in code as `NEWS_QUOTA_COOLDOWN_KEYED_MS` (15 minutes) with the explicit rule that it must never become a settings knob: 15-minute spacing yields at most 96 network calls/day per keyed provider, under the NewsAPI (~100/day) and Currents (200/day) free ceilings. The unbounded `NEWS_QUOTA_COOLDOWN_MS` name is retained as a deprecated alias with the same value so older scratch suites keep resolving it.
- No behavioral change versus v0.8.4: the 5-minute newsFetchTimer cadence, 5-minute cache TTL, and keyless 5-minute window are unchanged; ticks landing inside a keyed window serve honestly stale-marked cached stories and mark no network attempt.

### 36.2 GDELT reliability verdict
- Two independent live probes on separate days both returned HTTP 429 from a datacenter vantage; a residential WebView2 IP may fare better but cannot be assumed. Verdict: GDELT cannot be a dependable primary anywhere.
- GDELT is retained only as the keyless first leg of the Google News fallback chain — proxy-free direct JSON when it succeeds, at most ~7 s of cost when it 429s before the RSS gateway chain continues (and in Auto mode with keys it is a last-ditch fallback behind the keyed primary). Removal can be reconsidered only if a keyless-only install is observed failing on GDELT 429s chronically.

### 36.3 Verification & release
- Re-run battery: all 7 suites green, `node --check` clean; footprint limited to `js/api.js` constants/comment + documentation (README, this section, release notes). Re-packaged, tagged `v0.8.5`, GitHub release synced.

## 37. Settings Backup & Restore (v0.8.6)

### 37.1 Format Decision: Plain JSON, Not Zip
- A settings payload is a few KB of text; zip compression saves nothing meaningful while a zero-build runtime would need ~150 lines of hand-rolled CRC32 + stored-entry zip writer/reader with no libraries to lean on. Export is therefore a single `local-wally-settings-YYYYMMDD-HHMMSS.json` (native Blob download), importable in any editor for manual inspection or tweak.

### 37.2 Payload Model
- `meta`: `product: 'local-wally-hud'`, `format: 1`, `includesApiKeys: true` (explicit, by user requirement), ISO `exportedAt`.
- `livelyProperties`: the current values of every tracked Lively property from `LivelyBridge.properties`, filtered to the 36-name whitelist that mirrors the property dispatcher (`App.SETTINGS_PROPNAMES`).
- `localStorage`: every app-owned storage entry (`LIVELY_HUD_*`, `local_wally_*` prefixes) — cache snapshots, news quota state, rotation cursors, recent wallpapers, cached wallpaper credit. Foreign keys are excluded from export and ignored on import.

### 37.3 UI Surface & Interaction
- The diagnostic panel (`D`) gains a Backup & Restore block (Export / Import buttons, hidden file input, status line). The panel is now interactive only while open (`pointer-events: auto` on `.is-active`) — it normally floats over the wallpaper corner, so click capture while open is harmless; closed state remains click-through.
- Import: file picker → `_parseSettingsExport` guards (product, format 1, ≤2 MB, section shapes) → `_applySettingsPayload` → status line → `location.reload()` for a clean boot.
- Property application prefers the Lively host round-trip (`livelyPropertyValueChanged` — the host persists each change and re-delivers through the listener, so Lively's own settings model stays authoritative); outside the host (browser preview, tests) values replay through `LivelyBridge.emitProperty`.

### 37.4 Safety Model
- Values pass through the existing dispatcher/setters, which already coerce and clamp; import does not invent a second validation layer beyond: name whitelist (unknown names dropped), URL-embedded key charset check (Unsplash/Wallhaven/Pixabay keys land in query parameters — `[^A-Za-z0-9._~-]` or >190 chars is skipped), and the storage prefix filter.
- The export contains API keys in cleartext — documented; users treat it like a password vault export.
- No path in backup/restore can bypass the news quota firewall: applying properties re-enters the normal dispatcher, whose network eligibility always flows through the firewall (LW06 invariant unchanged).

### 37.5 Verification
- New scratch suite `test_v086_backup.js`: payload shape (whitelist + storage filter), parse guards, apply semantics (whitelist/emitter replay/charset skip/storage filter/honest counts), and a machine-to-machine round trip. Full 7-suite battery re-run green; `node --check` clean; scratch file SHA-256 reported in release notes.

## 38. Location Cascade: Manual Control & Dialog-Free Auto Detection (v0.8.7)

### 38.1 Resolution Order (js/api.js, single choke point `getLocation()`)
1. **Manual override** (localStorage `LIVELY_HUD_LOCATION_MANUAL`, record `{entry:{type:'name'-or-'coords'}, resolved}`): wins over everything; geocoded ONCE via the keyless CORS-open Open-Meteo geocoding API and cached (boots instant, offline-safe); coordinate entries additionally reverse-geocoded once via the keyless BigDataCloud client API. A manual entry that cannot resolve logs a warning and falls through to silent auto — never a rejected pipeline.
2. **Persisted auto location** (localStorage `LIVELY_HUD_LOCATION_AUTO`): instant paint; a silent background re-detect adopts REAL city/country changes via `onLocationChanged` → App re-syncs with `loadAtmosphere(true)`.
3. **Silent detection** (`_runLocationDetect`): HTML5 geolocation ONLY when `navigator.permissions.query({name:'geolocation'})` reports `state === 'granted'` — a query never prompts; `prompt`/`denied`/missing-API (and query rejections) skip instantly to the keyless IP lookup (`ipapi.co`), then `config.defaultLocation`.

### 38.2 No-Dialog Guarantee & Persistence Rationale
- The v0.7+ chain called `getCurrentPosition` unconditionally on every boot — the source of permission prompts on the wallpaper (Windows/WebView2 consent). v0.8.7 removes the ask entirely: GPS is consulted only where the OS already granted it (silent), IP lookup needs no permission, and persistence removes detection from warm boots altogether. The one function boundary makes the future Lively-native path (`--area-weather`, marked NOT READY upstream in the official wiki) a drop-in when it matures.
- Adoption gate: background candidates qualify only with `source === 'ip'|'gps'` AND a non-placeholder city (`Local Area`/`Manual Area`/`Metropolitan` excluded) — coordinate jitter never flips the town and offline config-defaults never overwrite real persisted cities (outage defaults persist for instant paint and self-heal on the first successful later detect).

### 38.3 Manual Location UX (diagnostic panel, `D`)
- **Location** section: status line (current source + place), a combobox input, an absolutely-positioned listbox of Open-Meteo suggestions (`City, Region — Country`), keyboard navigation (ArrowUp/Down/Enter/Escape), mousedown selection, blur/outside-click close, `aria-expanded` managed. Typing raw `lat, lon` (range-validated) applies on Enter without suggestions.
- Choosing a suggestion passes ITS coordinates into the record (no re-geocode re-ranking surprises). `Use automatic` clears the record and re-syncs. No LivelyProperties entry was added — the localStorage record is the single source of truth and is carried by backup/restore automatically.

### 38.4 News-Chain Honesty for City-less Pins
- The regional-news `cityUsable` guard now also excludes `Manual Area`; coordinate pins without a resolvable city skip GDELT and geo-RSS entirely and use the country edition — or the world edition (`news.google.com/rss?hl=en`) when no country is known — instead of fabricated or wrong-region headlines.

### 38.5 Verification
- New scratch suite `test_v087_location.js` (9 sections: manual precedence, coords/city/invalid paths + rejections, prompt-state zero-GPS, granted-state silent GPS, persisted-instant boots + adoption + jitter immunity, cache-miss recovery + broken-manual fallthrough, outage-default persistence/non-adoption, broken Permissions API, backup prefix sanity). Full 9-suite battery green, clean exits, `node --check` clean. Fresh-context adversarial diff review verdict FIX-FIRST → all findings applied (source-quality adoption gate; no forged `'US'` region on coordinate pins; suggestion-click coordinate passthrough; corrupt-record self-heal; broken-manual pipeline fall-through; aria/polish nits); scratch SHA-256 in release notes.

## 39. Customize-Panel Buttons, Popover Linger Guard, Right-Aligned Conditions, Night Wallpaper Queries (v0.8.8)

### 39.1 Discoverability: Backup Buttons in the Lively Customize Panel
- Lively's property schema (schemas/livelyPropertiesSchema.json, core-separation) supports `type: "button"` (fires a property event with the label value) and `type: "label"`. LivelyProperties v0.8.8 adds `settingsExport`/`settingsImport` button controls + a `settingsHelp` label pointing at the D panel; App dispatches the two new cases — export calls `exportSettings()`; import programmatically opens the existing hidden file picker. Backup/restore state semantics live ONLY in the D panel (buttons are actions, not settings — excluded from `SETTINGS_PROPNAMES`/export payload by design).
- Note: Lively's Customize widgets are host-rendered — custom dropdowns/autocomplete are impossible there; the Location section stays in the HUD panel by design (documented).

### 39.2 Hover Popover Linger Guard (app.js)
- Root cause: wallpapers covered by other windows receive NO mouse events from the compositor — `mouseleave` for the popover anchor never fires, so a popover opened just before a window came up lingers indefinitely (visible in the user screenshot while the mouse was in the browser).
- Guard: on popover open, arm a 1.5s interval checker with two clocks — `page idle >10s` (WebView covered or mouse elsewhere: hide) and `anchor idle >12s` (movement exists elsewhere on the desktop but never returned to the anchor: hide). Any document mousemove updates the page clock; movement inside the anchor/popover bounds resets both (deliberate reading keeps the popover). Hide clears the interval. Existing pause-path dismissal (playback pause hides popovers) is untouched.

### 39.3 Condition Meta Right-Justified (style.css)
- `.hud-temp-block` uses `justify-content: space-between`; `.hud-condition-meta` flips to `align-items: flex-end` + `text-align: right` — the conditions column hugs the weather card's right edge (user request; supersedes the earlier left-internal alignment for this block).

### 39.4 Wallpaper Queries Day/Night-Aware Across All Categories (api.js)
- `mapWeatherToQuery`: previously only Clear had a distinct night query — after dark, cloudy/rain/snow/fog/storm and the default still searched the SAME daytime terms, surfacing daylight scenes at night (user screenshot: green day field at 20:58). Now every category (11 cases, incl. UNKNOWN → default) carries a `night ` prefix when `isDay` is false; custom keywords still pass through untouched. Verified distinct day/night queries per category in the suite.

### 39.5 Verification
- New scratch suite `test_v088_hud_polish.js` (button schema + wiring, linger-guard rules A–D, right-justify CSS, full day/night query table, custom-keyword passthrough). Full 10-suite battery green with clean exits; `node --check` clean; LivelyProperties.json validated. Scratch SHA-256 in release notes.

## 40. News Cascade, Story-Image Card, Telemetry Density, Key Links (v0.8.9)

### 40.1 Region Ladder + Tier Memory (api.js)
- Evidence: the user's live report showed `Arsikere, India` (a small town) yielding zero city-keyword stories on the keyed providers, then the (dead-infrastructure) keyless chain, then the retired "Regional dispatch unavailable" string.
- Adapter-level ladders (one quota attempt each): **Currents** tiers = keywords City+CC → `/latest?country=CC` → `/latest` (world); **NewsAPI** tiers = `everything?q=City CC` → `top-headlines?country=CC`. Each adapter normalizes through `_normalizeCurrentsPayload` / `_normalizeNewsapiPayload` (https-only links, https-only images).
- `_newsVariantTier` remembers the deepest successful tier per `provider|city|country`; later calls run that tier directly (steady-state = one network call per 15-min keyed window — under every free ceiling). A remembered tier that goes stale re-walks the full ladder once before failing.

### 40.2 Cross-Provider Ladder (fetchNews, api.js)
- On primary exhaustion the request walks **every other eligible provider, keyed first, Google News chain last** — each leg inside its own quota window (attempt marked before firing; cooldown-locked legs skipped without marking or network). Cache writes follow the DELIVERING provider; identity isolation (LW04) and the memory-first cache (#16) are untouched. Terminal state stays honest: stale-marked real stories or empty.

### 40.3 Story-Image Card (app.js + css/style.css)
- `applyStoryBackground(imageUrl)`: only https image URLs accepted; decoded off-DOM via `new Image()` and applied **only on success** (no broken-image flash); `null` clears. The card adds `has-story-image` — CSS: `.hud-news-bg` layer (cover, opacity .42, 600ms fade), a `::after` fixed scrim (rgba(9,12,20) .52→.84 gradient), content rows raised to z-index 2 with text-shadow — legibility guaranteed by the scrim regardless of image brightness. Imageless providers (GDELT/RSS) keep the classic card.

### 40.4 Wording Retired + Telemetry Density + Key Links
- All "Regional (News) Dispatch" phrasing and the old error string are gone (app.js, index.html `Live Dispatch` → `Now`, drawer = "News Feed", boot placeholders "Fetching the latest headlines...").
- `.hw-row` gap 3→2, padding 4→3; expanded metrics gap 8→5 — more room for the news card.
- D panel gains a **Get API Keys** grid (Currents/NewsAPI/Unsplash/Pexels/Pixabay/Wallhaven, `target="_blank"` + `noopener noreferrer`). Lively's Customize labels are plain host-rendered text — clickable links live in the D panel by design.

### 40.5 Verification
- New scratch suite `test_v089_news_cascade.js`: ladder widening + protocol-safe image mapping + tier memory (asserts the exhausted city tier is never re-tried), exact cross-provider order (keyed before keyless), per-leg attempt marking, honest terminal state, static rebrand/CSS/keys checks. Full 10-suite battery green with clean exits; `node --check` clean. Scratch SHA-256 in release notes.
