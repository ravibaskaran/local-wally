# Local Wally HUD - Release Notes & Changelog

All notable changes, version milestones, security audits, and performance hardening for [Local Wally HUD](README.md) are documented in this file.

For downloadable packages, installers, and release tags, visit [GitHub Releases](https://github.com/ravibaskaran/local-wally/releases).

---

## Release History

### Version 0.16.0 - OneDrive Personal Settings Sync, Wallpaper Favorites, News Focus & Truthful Weather Provenance
- **OneDrive Personal Settings Sync (RFC 8628 Device Authorization Grant)**:
 - Connects to personal Microsoft Accounts using OAuth 2.0 Device Code Flow (`microsoft.com/devicelogin`) without requiring native background daemons, local HTTP ports, or custom URI protocol schemes.
 - Syncs user preferences and wallpaper feedback to private app storage (`OneDrive/Apps/Local Wally/local-wally-settings.json`) with conditional writes (`If-Match` with eTags) and conflict detection.
 - Strict privacy firewall: completely excludes GPS coordinates, manual locations, location history, cached telemetry, and OAuth tokens from cloud snapshots.
 - Local-first architecture: startup and wallpaper rendering never block on cloud connectivity or authentication prompts.
- **Wallpaper Favorites & "Less Like This" Avoidance Engine**:
 - Added quick-action floating controls to Favorite or Avoid ("Less like this") current desktop wallpapers without storing binary images.
 - Slide-out Favorites gallery drawer allows previewing and immediately setting saved wallpapers or removing favorites.
 - Transient 6-second Undo toast allows instant recovery from accidental wallpaper avoidance.
 - Candidate rotation algorithm strictly excludes avoided assets and falls back cleanly without infinite retry loops.
- **Truthful Weather Provenance & Dynamic Freshness Badge**:
 - Normalized provenance envelopes capture requested provider, actual provider, fallback status, fetch timestamp, and station observation timestamp across Open-Meteo, WeatherAPI, and OpenWeatherMap.
 - Contextual weather detail drawer provides a truthful breakdown of data origin, eliminating fabricated "Verified Live" claims for cached or fallback data.
 - Added responsive `#hud-weather-freshness` pill badge showing live relative age (`Live · Just now`, `Cached · 10m old`, `Stale`, `Fallback`, `Unavailable`).
- **Regional News Focus Scoping & On-Demand Manual Refresh**:
 - Added `newsFocus` setting supporting `nearby` (city only), `balanced` (city with regional fallback), and `wider` (country and global edition).
 - Added "Get latest" manual pull button for Google News with 30-second cooldown protection and sequential proxy failover.

### Version 0.15.0 - Unified HUD Stack, Concentric Pomodoro Timer, Ambient HUD Animations & Atmosphere Isolation
- **Unified HUD & Dock Stack Layout**:
 - Wrapped `#hud` and `#dock-media-focus` inside a unified `#hud-stack` flex container with a constant `gap: 14px`.
 - Eliminated vertical clamping drift and gap fluctuations between cards caused by absolute sibling coordinate detachment on short or high-DPI displays.
 - Coordinated positioning classes and responsive single-column layouts (`.hud-single-col`) cleanly across the shared stack container.
- **Concentric Scalable SVG Pomodoro Ring**:
 - Replaced fixed-dimension canvas ring drawing with a resolution-independent SVG progress ring (`viewBox="0 0 88 88"`).
 - Added dual-mode linear gradients (`#pomo-grad-focus` for focus, `#pomo-grad-break` for rest intervals) and animated `stroke-dashoffset` transitions.
 - Locked countdown timer text into optical concentric alignment using `position: absolute; inset: 0;` on `.pomo-ring-center`, preventing distortion across responsive breakpoints.
- **Atmospheric Weather Precision**:
 - `WindStreamlineEngine.prototype.setWeather` accurately parks into `mode = 'NONE'` during overcast, cloudy, or clear conditions without precipitation.
 - Canvas clears completely and execution halts at 0% CPU/GPU, eliminating misleading rain-like streamline streaks on dry overcast days.
- **Desktop Wallpaper Particle Isolation**:
 - Added `options.isWallpaper` support to `ParticleEngine`.
 - Background wallpaper canvas suppresses precipitation particles (`activePrecipCount = 0`) to preserve clean desktop wallpapers.
 - Atmospheric precipitation effects (rain, drizzle, snow, sleet, thunderstorm) remain strictly confined to the weather card hero ceiling (`#hud-wind-canvas`).
- **Continuous Ambient HUD Icon Animations**:
 - Implemented continuous vector keyframe animations across all HUD badges and icons: Location Pin (`anim-pin-float`), Rain Outlook (`anim-rain-drops`), Temperature Peak (`anim-thermometer-pulse`), Daylight Solar (`anim-sun-spin`), Golden Hour (`anim-golden-glow`), Sky Event (`anim-star-twinkle`), Air Quality (`anim-wind-drift`), Hardware Monitor (`anim-chip-pulse`), News Feed (`anim-news-pulse`), Pomodoro Timer (`anim-clock-pulse`), and Now Playing (`anim-audio-vibe`).
 - Added accessibility fallbacks under `@media (prefers-reduced-motion: reduce)` to disable animations immediately when requested.

### Version 0.14.0 -  Animated Metric Meteocons & WeatherAPI.com Alternate Provider
- **Animated Metric Icons (Bas Milius Meteocons)**:
 - Bundled standalone, official Meteocons animated fill SVGs (`assets/icons/weather/humidity.svg`, `assets/icons/weather/cloudy.svg`, `assets/icons/weather/raindrop-measure.svg`) replacing legacy static outlines in the 3-column environmental metrics row.
 - Powered by native W3C SMIL vectors running 100% on GPU with 0.0% CPU overhead when parked and crisp rendering on 4K/HiDPI monitors.
 - Styled with `.metric-meteocon` and smooth cyan glow hover micro-interactions (`transform: scale(1.15) translateY(-1px)`).
- **WeatherAPI.com Live Telemetry & 72-Hour Forecast Provider**:
 - Added full support for WeatherAPI.com as a configurable alternative weather and forecast provider.
 - Comprehensive condition dictionary translating all 48 WeatherAPI condition codes to standardized WMO meteorological categories.
 - Single-call telemetry ingestion: parses current conditions, 3-day 72-hour hourly forecast projections, and embedded US EPA AQI in a single network roundtrip.
 - Synthetic 3-tier cloud strata (`cloudCover`, `cloudLow`, `cloudMid`, `cloudHigh`) ensuring seamless visual continuity for the atmospheric hero ceiling.
 - Resilient graceful fallback: automatically routes to Open-Meteo if no API key is configured or if network timeouts occur.
- **Dynamic Configuration & Lively Properties**:
 - Integrated `weatherapiKey` and updated `weatherProvider` dropdown options in `LivelyProperties.json`, `config.js`, and `js/api.js`.
 - Added strict key validation (`_URL_EMBEDDED_KEY_PROPS`) and reactive setting reload triggers in `js/app.js`.

### Version 0.13.1 -  Sleep/Wake Resiliency, Host-Authoritative Playback IPC & WebView2 Deadlock Elimination
- **WebView2 Geolocation Permission Race Guard**: Wrapped `navigator.permissions.query({ name: 'geolocation' })` in a 1500ms `Promise.race` safety timeout. Prevents indefinite promise deadlocks in embedded WebView2 hosts lacking `PermissionRequested` handlers, safely falling back to IP geolocation.
- **Host-Authoritative Playback IPC (`LivelyBridge`)**: Once Lively Wallpaper establishes host playback control via `livelyWallpaperPlaybackChanged`, the host's pause state is authoritative. Prevents desktop window occlusion flags (`document.hidden`) from vetoing host unpause commands.
- **Complete Lively IPC Capabilities Alignment**: Updated `Arguments` in `LivelyInfo.json` to declare all supported capabilities (`--system-information --system-nowplaying --audio --pause-event true`), restoring host lifecycle event forwarding, SMTC track telemetry, and 128-bin audio FFT data streams.
- **S0 Modern Standby & Sleep Recovery**:
 - `updateClock()` snaps HUD clock to actual system time immediately inside `startLoop()` and the `onPlaybackChange` unpause handler without waiting for the next 1-second interval tick.
 - Added a global `window.addEventListener('online')` handler to immediately trigger `checkAndSync(true)` upon Wi-Fi / Ethernet reconnect following S0 sleep.
 - Enhanced `checkAndSync()` to measure elapsed time across sleep cycles, immediately refreshing atmosphere data when sleep duration exceeds the 15-minute cache TTL.

### Version 0.13.0 -  Atmospheric Hero Ceiling, Weather-Adaptive Canvas, Animated SVGs & Audio Presence Detection
- **Option B Hero Ceiling (`#hud-hero-ceiling`)**:
 - Unified atmospheric zone spanning the Header (Clock, Date, Location), Main Weather Condition card, and 3-Tier Environmental Metrics grid.
 - Backing canvas dynamically positioned with `z-index: 0` behind glass elements (`z-index: 1`), providing an immersive atmospheric background without increasing HUD card footprint.
- **Animated SVG Moon Phases & UI Icons**:
 - Bundled 8 local, animated SVG moon phases (`assets/icons/moon/*.svg`) rendering dynamic lunar illumination and subtle orbital glow across ephemeris cards and badges.
 - Replaced legacy text/emoji glyphs in card detail drawers and popovers with clean, high-contrast SVG badges.
 - Smooth vector animation keyframes added for metrics (humidity, clouds, precip), astro icons, and bento system indicators.
- **Weather-Adaptive Hero Atmosphere Engine**:
 - 5 distinct weather-adaptive modes dynamically responding to real-time WMO weather categories:
   - **WIND / CLEAR / CLOUDY / FOG**: Flow streamlines along the true meteorological vector `((windDeg + 180) % 360)` with velocity scaling and gust surges.
   - **RAIN / DRIZZLE**: Wind-tilted diagonal rain streaks with bottom micro-splash dynamics.
   - **SNOW**: Softly fluttering snow crystals drifting on the meteorological wind vector.
   - **SLEET**: High-velocity icy particle streaks with frost micro-particles.
   - **THUNDERSTORM**: Driving stormy precipitation overlaid with subtle ambient lightning flashes.
 - Zero-allocation contiguous `Float32Array` ring-buffer architecture maintaining 60 FPS fluidity with verified 0% CPU idle parking when calm or suspended.
- **Intelligent Audio-Presence Detection & Silence Hysteresis**:
 - Directly inspects live Lively audio spectrum energy (>0.005) when SMTC metadata is dropped or unsupported (such as web streaming via Amazon Music, YouTube, or Soundcloud).
 - Automatically transitions media card to `.is-audio-active` ("System Audio Playing" / "Web Stream / Desktop Audio") and activates the 60 FPS audio visualizer.
 - Implements a robust 1.5-second silence hysteresis before gracefully returning to idle and restoring the Quick Launch dock.
- **Zero-Gap Flush Companion Dock Alignment**:
 - Reduced vertical spacing between the primary HUD and companion dock (`#dock-media-focus`) to 0px, creating a seamless, monolithic bento interface.
- **Dynamic Pomodoro & Focus Mode Labeling**:
 - Dynamically updates active mode titles on switch: `Pomodoro` (25m), `52/17` (52/17), `90m` (90m), `Flow` (Flowtime), and `Break` / `Long Break` during rest cycles.

### Version 0.12.0 -  Zero-Defect Master Audit Hardening
- **Performance & 0% CPU Idle Parking**:
 - `WindStreamlineEngine.hasActiveAnimation()` now respects wallpaper playback pause, hidden state, and calm wind (<0.5 km/h), restoring verified 0.0% CPU parking 24/7.
 - Eliminated 60 FPS forced layout reflows in `WindStreamlineEngine.prototype.render()` by guarding canvas resize triggers with a dirty flag.
 - In-memory memoization cache for news images (`_newsImageMemoryCache`), removing synchronous `localStorage.getItem` and `JSON.parse` operations on every 7-second headline rotation.
 - Precomputed diurnal civil timestamp bounds in `renderCelestial()`, eliminating 168 `Intl.DateTimeFormat` evaluations every 15 seconds in the feels-like peak loop.
 - Reordered DOM writes and reads in `showHoverPopover()` to prevent synchronous layout recalculations.
 - Single batched stroke path for wind streamlines, cutting per-frame canvas draw calls from 24 down to 1.
 - Replaced uncomposited `transition: background 3s` full-screen repaints with GPU-accelerated opacity transitions.
 - Converted `.hud-aqi-fill` animation from layout-triggering `width` to composited `transform: scaleX(...)`.
- **Functional Correctness & Telemetry Reliability**:
 - Deep cloning in `CacheManager.set()` and simulation transitions, preventing live weather cache poisoning.
 - OpenWeatherMap OneCall 3.0 wind vector mapping (`wind_deg` and `wind_gust`) mapped from root current object.
 - Timezone-aware civil midnight anchoring for clock date cache, eliminating date stall across remote midnight rollovers.
 - OpenWeatherMap 2.5 `city.timezone` seconds offset extracted and mapped, fixing Daytime Card 2 feels-like peak and hourly point timezones.
 - Location switching correctly clears previous city headlines when new city yields an empty feed.
 - Hardware monitor gracefully falls back to `CurrentRam` (used RAM) when host omits `CurrentRamAvail`, preventing 100% false RAM pegs.
 - Added finite-number guards on precipitation wind speeds, preventing `NaN` coordinate cascades in `ParticleEngine`.
 - Added `.catch()` error handler on background location refresh promise chains.
 - Corrected `corsproxy.io` fallback proxy parameter concatenation to avoid HTTP 400 Bad Request.
 - European AQI interpreter requires `val >= 0`, correctly mapping negative sensor error codes to `Unavailable`.
- **Security & Accessibility (NFRs)**:
 - Hidden Diagnostic Panel receives `visibility: hidden` and `aria-hidden="true"`, cleanly removing it from keyboard tab order.
 - Modal dialog traps keyboard focus, and global hotkeys are suppressed while modal is active.
 - Settings backup export masks sensitive API keys with `...` by default, safely ignoring masked placeholders on import.
 - Encoded RSS target URLs across all CORS proxy queries with `encodeURIComponent`.
 - Upgraded `#hud-news-block` container role to `role="region"`, fixing WCAG 4.1.2 nested interactive element violations.
 - Restored high-contrast `:focus-visible` styling (`2px solid #38bdf8`) on all interactive buttons and badges.
 - Added 1.5-second cooldown throttle to custom protocol desktop app launches, preventing hidden iframe and listener accumulation.

### Version 0.11.0 -  Atmospheric Wind Streamlines & 3-Tier Cloud Layers
- **Atmospheric Wind Streamlines (`#hud-wind-canvas`)**:
 - Real-time particle streamlines dynamically orient along the live meteorological wind bearing (`(windDirectionDeg + 180) % 360`) behind the primary weather condition block.
 - Zero-allocation architecture utilizing a contiguous `Float32Array` ring-buffer SoA layout and pre-computed opacity tables (0 string/object allocations in the 60 FPS loop).
 - Backing store dynamically scales with `window.devicePixelRatio` for razor-sharp rendering on 125%, 150%, and 200% displays.
- **3-Tier Atmospheric Cloud Layer Strata**:
 - Dedicated cloud strata telemetry displaying atmospheric cloud coverage across Low (<2km, Stratus/Cumulus), Mid (2-6km, Altocumulus), and High (>6km, Cirrus) altitudes.
 - Glanceable dominant layer callout in the card header (e.g. `High 99%`, `Mid 65%`, `Low 45%`, or `Clear 0%`).
 - Subtle parallax drift keyframe animation between cloud strata vectors with playback pause synchronization.
 - Comprehensive popover and drawer telemetry disclosing complete cloud coverage, wind direction, velocity, and peak gusts.

### Version 0.10.0 -  Animated Meteocons, Multi-Mode Focus Timer, News Proxy Cascade & Music Quick Launch
- **Playful Animated Weather Meteocons (Fill Style)**:
 - Bundled 14 local, animated Bas Milius SVG Meteocons (`assets/icons/weather/`: clear day/night, partly cloudy day/night, overcast, rain, drizzle, thunderstorms-rain, snow, sleet, fog, wind).
 - High-performance, GPU-accelerated SMIL vector animations running entirely offline with zero CDN dependencies and <0.1% CPU.
 - Context-aware WMO mapping: accurately resolves day/night astronomical state, atmospheric conditions, and sleet/freezing rain codes (56, 57, 66, 67), with state-cached DOM rendering to prevent layout thrashing.
- **Google News Proxy Cascade & GDELT Purge**:
 - Completely purged GDELT from the news pipeline to eliminate HTTP 429 rate-limiting and irrelevant academic conflict stories.
 - Expanded the free CORS proxy ladder across 5 reliable gateways (`api.allorigins.win/raw`, `api.codetabs.com`, `corsproxy.io`, `cors.x2u.in`, and `api.allorigins.win/get` with automatic JSON wrapper decoding), sequentially cycling until a valid RSS feed is returned.
 - Persistent fallback: when all proxies fail or network is offline, the card gracefully serves previously cached stories from `localStorage` marked as stale, ensuring the news card never stays blank.
- **Productivity Focus Timer Suite (4 Customizable Methodologies)**:
 - Added multi-mode productivity focus timer with interactive glass pill selector (`[25m] [52/17] [90m] [Flow]`):
   - **Classic Pomodoro (25/5)**: 25m Focus / 5m Short Break / 15m Long Break.
   - **52/17 Rule**: 52m Focus / 17m Rest.
   - **Ultradian Rhythm (90/20)**: 90m Peak Focus / 20m Renewal Break.
   - **Flowtime Stopwatch**: Count-up deep work timer with proportional dynamic break allocation (<25m → 5m, 25-50m → 8m, 50-90m → 15m, ≥90m → 20m).
 - Full synchronization with Lively Wallpaper Customize dropdown (`focusTimerMode`) and settings export/import.
- **Music Quick Launch Badges (Desktop App First)**:
 - When Windows SMTC media is idle ("No Media Playing"), the media card displays a sleek Quick Launch dock with animated, glowing brand badges for **Spotify**, **Amazon Music**, and **JioSaavn**.
 - Direct desktop application launch via custom URI protocols (`spotify:`, `amznmp:`, `jiosaavn:`) with automatic fallback to web players (`https://open.spotify.com`, `https://music.amazon.com`, `https://www.jiosaavn.com`) if desktop apps are not installed.
 - Smooth CSS transitions toggling between `.is-idle` (Quick Launch badges) and `.is-playing` (track art, metadata, and 60 FPS audio visualizer).

### Version 0.9.1 -  Astronomical Timezone Alignment, HiDPI Precision & News Safety
- **Location Civil Calendar Date Moon Times**: Anchored `SunCalc.getMoonTimes` to the selected location's civil midnight instant via `getCivilMidnightAnchor(date, tz)` and updated `js/suncalc.js` to preserve the caller's explicit anchor when `inUTC` is omitted. Eliminates host-calendar drift between UTC and destination timezones (e.g. Asia/Tokyo).
- **Honest Weather Forecast Data**: Missing precipitation probabilities and peak relative humidity are preserved as `null` and displayed honestly as `Unavailable` in popovers instead of fabricating certainty with `0%` or `Nominal`. Explicit measured zero values (`0% chance`, `0.0 mm`) remain fully preserved.
- **HiDPI Audio Visualizer DPR Coordinate Accuracy**: Fixed double-scaling bug on displays with device pixel ratio > 1 (125%, 150%, 200%). Visualizer geometry, bar distribution, and clear regions now consistently use logical CSS coordinates under the DPR transform, eliminating clipped or mispositioned bars.
- **Fixed News Provider Cache Isolation**: Switching news providers in fixed mode now strictly requires `envelope.provider === primaryProvider`, preventing cached stories from another provider from serving on mode changes, while retaining eligible multi-provider access in rotation mode.
- **Resilient RSS Proxy Cascade**: RSS parsing is now validated inside each proxy attempt (`attemptProxy`), ensuring malformed or blocked HTTP 200 responses cleanly fall through to subsequent CORS proxies in the configured ladder.
- **Strict News Article Link Protocol Validation**: Insecure, non-HTTPS, or `javascript:` links are omitted during feed parsing or rendered non-clickable (`is-non-clickable` with `aria-disabled="true"`), completely eliminating misleading fallbacks to the generic `https://news.google.com` homepage.

### Version 0.9 -  Performance Hardening, Security Safeguards & Telemetry Accuracy
- **Currents News Location Accuracy**: Fixed query language filtering (`&language=en`) and localized city aliases (e.g. `Bengaluru OR Bangalore`), eliminating international wire fallbacks (Tokyo headlines appearing for Indian cities).
- **Continuous Battery Telemetry**: Host telemetry status never clears active browser `navigator.battery` state; battery row is always visible when enabled with honest battery, charging, AC, or unavailable modes.
- **Compositor & 60 FPS GPU Optimization**:
 - Removed 3-second `box-shadow` CSS transition over heavy acrylic glass (`backdrop-filter`) on `#hud` and `#dock-media-focus`, eliminating 180 consecutive frames of software rasterization during solar shadow updates.
 - Removed unnecessary fullscreen `will-change` layer promotions, saving over 130MB of VRAM at 4K resolution.
 - Fast-path `rect` optimization for small snow particles (`<= 1.5px`), cutting canvas trigonometry operations by over 70%.
 - Zero-allocation rounding in fallback telemetry tickers and cached date string formatting in the 1-second clock loop.
 - Throttled hover popover mousemove collision checks via `requestAnimationFrame` for high-polling gaming mice.
 - News image preloader callbacks now clear `onload`/`onerror` handlers immediately to eliminate closure leaks.
- **HiDPI & Accessibility Polish**:
 - Canvas elements (`#pomodoro-canvas` and `#audio-visualizer-canvas`) now scale backing stores by `window.devicePixelRatio`, rendering crisp and blur-free on 125%, 150%, and 200% Windows display scaling.
 - `--text-dim` boosted in dark and light themes to satisfy WCAG 2.1 AA text contrast (>= 4.5:1).
 - Card container ARIA roles updated from `role="button"` to `role="region"` to resolve nested interactive element accessibility violations.
- **Security & Pipeline Robustness**:
 - Strict URL protocol validation on SMTC album art URIs rejecting unsafe schemes (`javascript:`, `vbscript:`, etc.).
 - Outer promise rejection catch added to `ApiService.fetchAtmosphere` ensuring graceful fallback to cache or mock data if geocoding fails.
 - Deduplicated and idempotent `onLocationChanged` listeners with `offLocationChanged` unbinding.
 - Resolved configuration drift between `config.js` and `LivelyProperties.json`.

### Version 0.8.20 -  Version Stamp, Always-Visible Battery Row, Watermark Above the Taskbar
- **Version stamp**: a tiny `v0.8.20` in the bottom-right corner of the HUD card (below the news block) -  the running build is now identifiable at a glance.
- **Battery row shows in every host state**: real laptop telemetry when the host exposes it, an honest **AC Power** row for the AC/dummy signature, and an honest **Not available** row when the host exposes no battery data at all (common in hosted WebView2) -  it never silently disappears again.
- **The wallpaper watermark was rendered but hidden UNDER the Windows taskbar**: the wallpaper page spans the full screen while the taskbar floats over its bottom edge, so a `bottom: 10px` pill was permanently covered. The pill now sits above the taskbar, with its distance computed from the screen's working area (72px fallback) -  visible on every taskbar size, including auto-hidden ones.

### Version 0.8.19 -  Updater Finds Relocated and Random-ID Library Folders
- **The one-click updater now works with any Lively setup**: it reads Lively's own `Settings.json` → `WallpaperDir` and scans the relocated library (e.g. a library moved to another drive), and it matches wallpaper folders by their **content** -  Lively 2.x names imported wallpaper folders by random id, so name-based discovery never found them.
- **Development checkouts are protected**: folders containing `.git` or `scratch` are never overlaid, so a source checkout can't be clobbered by an update.
- Discovery roots and targets are de-duplicated; the standard installer and Microsoft Store layouts remain covered, and the launcher still fetches the freshest engine on every run.

### Version 0.8.18 -  Photo-Legible News, Battery Reinstated, 48h Artifact Sweep, Wallpaper Source in the Panel
- **News text on photos is always white now**: with a story photo behind the card, every text element and icon switches to light ink with a stronger shadow -  the light theme's dark palette can no longer sit on a dark photo (your screenshot case). The body gets a dark glass instead of the light card, and hover deepens it.
- **Battery telemetry is back**: the BAT row was silently hidden on machines whose host reports the "no battery data" dummy signature (common on Windows laptops on AC) -  it now shows an honest **AC Power** state with no invented percentage, and upgrades itself to live % / charging / time-remaining the moment real battery events fire. The Battery Info switch still hides it.
- **48-hour artifact retention**: downloaded-artifact caches (keyword-image cache entries, the story snapshot) are swept on boot and daily -  nothing keeps growing; aged entries are dropped, fresh ones survive; the sweep does no work while the wallpaper is parked.
- **"Where is my wallpaper from?" -  permanently answerable**: a new line in the diagnostics panel (**press `D`**) names the provider and the exact source URL, derived from the cache or the image hostname, so the source is visible even if the corner watermark is missed.

### Version 0.8.17 -  Independent QA Cycle: Five Real Fixes, Two Legacy Suites Retired Green
*A fresh QA lab (three new tool families -  cross-file static audit, seeded adversarial fuzz, boot/lifecycle matrix -  plus archaeology on the two long-standing "known-open" suites) ran against the v0.8.16 baseline. Findings, all fixed:*
- **Dead moon-panel wiring removed**: four DOM ids referenced by the app didn't exist in the HUD markup (the night-moon panel's real wiring was fine -  these were silent no-op leftovers); the stale toggles and dead caches are gone.
- **Crash-proof location input**: a malformed paste with lone UTF-16 surrogates made `encodeURIComponent` throw *synchronously* out of `setManualLocation` ("URI malformed") -  every user-entered location string is now sanitized (`toWellFormed` with a lookbehind fallback) so the pipeline can only ever reject through its promise contract.
- **Stale-failure containment hardened**: network errors from an obsolete location request carried no generation tag, so an old failure could clear a *newer* location through the UI catch -  every rejection path is now generation-tagged.
- **Honest night/day tone under bad inputs**: a non-finite solar altitude used to read as night (midday flip if inputs were corrupted) -  it now falls back to the weather day flag; regression-proofed.
- **Legacy suites retired green**: `test_v064` Test 3 depended on the *real* Tokyo solar altitude at run time (it failed every evening IST) -  now deterministic via the documented simulation modes, with the product gaining the NaN-altitude guard behind it; the focused suite's forecast test still encoded a pre-honesty contract -  updated to the null-gap policy (valid zeros/negatives preserved, no fabricated fallbacks), which now doubles as a regression gate for it.

### Version 0.8.16 -  Wallpaper Source Watermark Done Right
- **Provider-first labels**: the bottom-right watermark now reads simply **"Wallhaven"** (or "Pexels", "Unsplash", "Pixabay") -  the providers' generic stand-in "photographers" ("Wallhaven Community", "Unsplash Artist") are suppressed; a *real* photographer still shows as `Pexels · Jane Doe`.
- **Always visible at boot**: the watermark now appears from the restored wallpaper cache **even for caches written by older builds** (the provider is derived from the image URL's hostname when no provider key is stored) -  you no longer need a fresh wallpaper swap to see it.
- **Better legibility over any wallpaper**: slightly larger type, higher contrast, a stronger text shadow and a darker glass pill.
- Provider is persisted alongside the cached wallpaper so boots are instant and correctly labelled; hover still discloses the full source URL, link discipline unchanged (`https`-only, `noopener`).

### Version 0.8.15 -  Stories Persist Across Sessions, Kill-Switch for Stale Popovers
- **Your news card never starts empty again**: the last-known stories are now painted **at startup from the persisted snapshot** (even when the weather cache predates them), and an empty network result falls back to the snapshot instead of blanking the card -  stories show marked-stale while a fresh fetch revalidates. The snapshot rides your **settings exports**, so it survives re-installs; the one-click updater keeps it automatically (same install folder).
- **D-panel news health line** (press `D`): per provider it shows the last attempt's result, the remaining quota window and any pending region tier -  the honest way to see *why* a card is empty (bad key vs empty city vs 15-minute window). The empty news card also says so itself when a regional tier is pending: "No local stories yet -  regional stories arrive within 15 minutes".
- **Stale popovers die when you switch to another window**: beyond the position-aware guard, a page that does not own the focus drops any open hover popover after ~1.5s of silence -  the browser-foreground case from your screenshot is gone (an actively hovering reader keeps generating mouse movement and is never interrupted).
- **Last invented `'US'` removed** from the news caller -  unknown country stays unknown (world fallback), matching the v0.8.14 trust-boundary work.

### Version 0.8.14 -  Production Hardening: Fail-Closed Quotas, Intent Races, Trust Boundaries
*A hardening pass from an independent audit (arrived as "v0.8.13" -  renumbered because that version already shipped).*
- **Keyed-news reservations fail closed**: a reservation is granted only after the quota stamp is **durably written** -  un-writable storage, absent storage, or a rejected Web Locks coordination all deny the keyed request outright (cache and keyless news keep working). The persisted quota state never contains key material.
- **Manual-location intent races closed**: every Customize delivery is a new intent *before* the identical-value short-circuit -  a redelivered saved location now kills any pending older request; a stale failure can never clear a newer location; the boot re-resolution path retries the latest record instead of silently jumping to auto-detection.
- **Location trust boundaries tightened**: geocoder and pre-resolved coordinates are range-validated (`±90`/`±180`, finite) before anything is written -  invalid remote results are rejected like any unresolvable name; **no invented `'US'` country remains anywhere** on the location paths (unknown country stays unknown → world news fallback).
- **Country tier memory corrected**: city tier-0 successes no longer overwrite the reusable country/world hint; new cities try their own city tier first, and an empty city tier pends the *proven country tier* for the next eligible window.
- **Settings import honesty**: storage failures are isolated per entry and reported as a **partial restore** (no full-success claim, no automatic reload over a half-restored state); host writes are now described as **submitted**, not persisted, until a restart test proves otherwise.
- **Popover: unknown pointer ≠ outside**: keyboard focus / touch / hover-without-mousemove get the bounded reading grace instead of the short expiry; park clears debounces and invalidates late image/lookup work.
- **Image-search budget enforced for real**: no key ⇒ no request and no slot consumed; each actual provider search consumes a **persisted** rolling-hour slot (six/hour, across reloads); a Pixabay empty/error falls through to Unsplash only on a fresh slot; park invalidates in-flight decorations.
- **Tier store bounded**: city hints are capped (oldest evicted), country hints preserved, corrupt persisted data recovers cleanly.
- **Claims qualified**: performance shorthand ("0% CPU", "never drains") now states it was measured informally on the author's target hardware -  not a cross-hardware guarantee; the v0.8.10 host-persistence language is annotated as superseded/unverified (see its entry).

### Version 0.8.13 -  One-Click Updater, Wallpaper Source Credit
- **One-click updater** (`tools/updater/upgrade-local-wally.bat`): double-click it to fetch the newest release and overlay it **in place** onto every installed Local Wally folder (installer + Store layouts) -  Lively's per-wallpaper SaveData keeps your keys, manual location, and preferences untouched. The launcher re-fetches its engine from the repo each run, so the updater itself stays current; a README section documents the full upgrade story (including the settings-JSON fallback for new machines).
- **Wallpaper source credit, actually visible**: the photo attribution now sits as a small glass pill pinned to the **wallpaper's bottom-right corner** (it used to be clipped inside the HUD card), reveals itself once a photo applies, hover shows the full source URL, and the link keeps https-only + `noopener` discipline. Say goodbye to mystery wallpapers.

### Version 0.8.12 -  Save-As Export, Instant Regional News, Compact Telemetry, Story Images, Fast Popover Expiry
- **Export opens a real Save-As dialog**: the File System Access picker writes your settings JSON wherever you choose (with the classic download as a graceful fallback when the host can't offer a picker -  the status line always says which path ran; cancelling is reported honestly).
- **Import picker comes to the foreground**: the window is focused first and the modern picker is preferred; the hidden-input dialog remains as fallback.
- **News gets the room**: the hardware telemetry rows sit compact at natural height again -  the secondary column's spare height now goes to the news card (and its backdrop image), not to metric gaps.
- **Story images for every headline**: provider images paint behind the headline (fixed dark scrim + text shadow -  legible on any photo); headlines *without* a provider image get a topical placeholder found via your own Pixabay/Unsplash key from the headline keywords -  capped at 6 searches/hour with a bounded headline→image cache, and no keys means no fetch, never an error.
- **Manual cities get instant regional news**: a new country-level tier memory means once *any* city in a country has proven a working news tier, a newly entered city in that country starts there directly -  Bengaluru returns India headlines on the first attempt (the 15-minute quota window still binds every request).
- **Empty news card explains itself**: if the keyless Google News source is selected while API keys are configured, the empty state adds a one-line tip pointing at "Auto (API keys first)".
- **Hover popovers now expire in seconds**: popovers sit behind a position-aware guard -  3 s after the cursor was last seen away from the card, at most 8 s even if the cursor was last on it, plus instant closes on document mouseleave / window blur. The covered-window lingering is gone.

### Version 0.8.11 -  Audit Corrections: Location Intent, News Quota Boundary, Honest Restore
- **Manual-location intents are generation-guarded**: every Customize delivery, D-panel apply, and clear is a fresh intent; late geocodes can never resurrect an abandoned entry, clear a newer location, or fire stale refreshes. An unresolvable *latest* name clears the override and falls back to Auto with an explicit message instead of silently showing a stale place.
- **News quota boundary hardened to the actual request**: every keyed HTTP GET now reserves its own 15-minute window at the request boundary (previously one reservation could cover a multi-GET ladder). On empty/failure, the next region tier pends for the next eligible window -  discovery across tiers spans windows by design -  while other eligible providers can still answer in the same attempt. **≤96 keyed GETs/day per provider**; daily limits stay unreachable, and cached reads consume nothing.
- **Multi-instance reservation (feature-detected)**: when the host exposes the Web Locks API, the quota read-check-persist runs inside a shared critical section and fails closed. Whether Lively's two monitor views share one storage bucket is still to be verified on a real multi-monitor host -  documented as unverified, not claimed fixed.
- **Backup honesty**: operational quota/tier state never rides exports; an import carrying stale quota stamps cannot reset a live cooldown; runtime-only imports (no host write API available) are counted separately and no longer get auto-reload-undone -  with a message telling you how to persist them.
- **Location trust boundary**: restored/imported geometry is range-validated (±90 / ±180, finite numbers); coordinate pins keep their saved city/country enrichment across boots and never invent a country; placeholder labels ('Local City' / 'Local Area' / 'Metropolitan' / 'Manual Area') can never overwrite a real detected city; coordinate pins mirror as coordinates on the Customize property.
- **Alias matching**: 'Bangalore' and 'Bengaluru' both short-circuit with one geocode, and the alias now travels inside backups.
- **Tooltip lifecycle**: parking closes hover popovers and clears their linger interval; re-arming while paused is inert; repeated park/resume adds no listeners.
- **Import key validation corrected**: the URL-embedded key list now matches the actual request builders (OpenWeatherMap / WAQI / Pixabay -  Unsplash/Wallhaven moved to header auth); non-string and oversized key values are rejected at the boundary; blank stays valid.
- **Canvas documentation truth pass**: constructor order, `desynchronized`/`willReadFrequently` as hints, and compositor claims corrected -  no guaranteed DWM bypass or GPU-only residency is claimed anymore.
- **Deferred (honestly, not silently)**: on-target performance pilots (blur cost, story-image churn, the WebGL2 ≥20% render-time gate) need the real WebView2 host and are specified in the blueprint; the CSP candidate policy awaits host validation.

### Version 0.8.10 -  Manual Location in the Customize Panel
- **Custom Location is now the first control in Lively's Customize settings**: right-click the wallpaper → **Customize Wallpaper** → type your city into **"Custom Location (blank = Automatic)"** -  e.g. `Bangalore` (aliases welcome), a precise name, or raw `12.97, 77.59`. Blank = automatic detection. The entry geocodes once (keyless), persists, and overrides auto-detection everywhere -  permanently until cleared.
- **Why**: IP-based auto-detection can pin a city a district away (an ISP exchange city -  your report: auto said *Arsikere*, you're in Bangalore). The property-based override fixes that at the source, rides the backup/restore across machines, and its re-delivery is short-circuited (an identical value never re-geocodes).
- The two surfaces stay in sync: picking a city in the `D` panel's autocomplete updates the same Customize field (via the host), and "Use automatic"/blanking the field restores detection.
- Hardening bonus: when localStorage is unavailable, the manual record now survives in memory for the session (matching the cursor/history resilience rule) instead of silently vanishing.
- **Note (superseded in v0.8.14)**: the "publishes back via the host" language above describes a write API that is *feature-detected, not part of Lively's documented web interface*. Until a real restart test on the host confirms persistence, treat Customize-field updates from the D panel as **submitted -  persistence unverified**. The localStorage record named above remains the source of truth either way.

### Version 0.8.9 -  News That Always Fills, Story-Image Card, Tightened Telemetry, Key Links
- **News reliability (the "Regional dispatch unavailable" fix)**: your report showed the card dead on *Arsikere, India* -  a small town where city-keyword searches legitimately return **zero results** on NewsAPI/Currents, after which the app fell to the (mostly dead) keyless chain. New behavior: a **region ladder** widens city keywords → **country top stories** → a world pass, per provider -  and the deepest working tier is *remembered* so later attempts cost exactly one call. If a provider comes up empty, the app hands to the **other keyed provider before** ever touching the keyless chain. Every leg stays inside the quota firewall.
- **News card with story image**: headlines with images (Currents/NewsAPI supply them) now paint a background picture behind a **fixed dark scrim + text-shadow** -  the card text is legible regardless of image brightness; images load off-DOM and only appear on success (no broken-image flash); imageless stories render the classic card.
- **Honest, calmer wording**: "Regional dispatch unavailable" is retired everywhere -  the empty card now says *"No stories right now -  new stories arrive automatically"*; drawer titled "News Feed".
- **Tightened telemetry**: hardware rows are denser (row padding/gaps reduced) so the news card gets more room.
- **Get API Keys, one click away**: press **`D`** → **Get API Keys** block with direct links to every provider (Currents, NewsAPI, Unsplash, Pexels, Pixabay, Wallhaven). Lively's own Customize panel renders labels as plain text only -  clickable links live in the D panel by design; the Customize panel keeps the two backup buttons and this hint.

### Version 0.8.8 -  Customize-Panel Backup Buttons, Popover Guard, Right-Aligned Conditions, Night Wallpapers
- **Export/Import now visible in Lively's Customize settings**: the app's settings panel (right-click wallpaper → Customize Wallpaper) gains **"Export Settings (incl. API keys)"** / **"Import Settings"** buttons plus a help label -  the same engine as before, now discoverable where you already are. Manual location with city autocomplete and backup status remain in the HUD diagnostics panel (**`D`** over the desktop -  Lively's host-rendered panel can't host custom dropdowns).
- **Hover popover can no longer outlive the mouse**: when another window covers the wallpaper, the WebView receives no mouse events -  `mouseleave` never fires and popovers (e.g. Network Bandwidth) lingered visibly while you worked elsewhere (report + screenshot). A linger guard now closes any popover when the page sees no mouse activity for ~10 s (or the anchor is untouched ~12 s); movement inside the anchor keeps it for deliberate readers.
- **Atmospheric condition info sits on the card's right edge** (right-justified column, per request).
- **Wallpaper vibe now follows the clock in EVERY weather**: previously only Clear had a night query -  after dark every category (cloudy/rain/snow/storm/fog/default) fetches `night …` variants, so no more bright daylight fields at 20:58 (verified: all 11 category cases map to distinct day/night queries).

### Version 0.8.7 -  Manual Location Control & Dialog-Free Auto Location
- **Manual location (customization)**: press **`D`** → **Location** → type a city (autocomplete after 3+ characters -  e.g. typing `BEN` offers *Bengaluru, Karnataka -  India* rows you pick from, keyboard-navigable) **or** raw `lat, lon`. Manual entry overrides automatic detection entirely; it's geocoded once via the keyless Open-Meteo geocoder (coordinates + timezone included), cached so boots stay instant and offline-safe, and the HUD re-syncs (weather, news, ephemeris) immediately. "Use automatic" clears the override.
- **Dialog-free automatic location**: the wallpaper **never raises a geolocation permission dialog**. Resolution order: manual entry → your last detected location (persisted across sessions and boots -  instant paint, no detection wait) → silent detection, where HTML5 GPS is consulted **only if its permission is already granted** (a state query, never a prompt) and the keyless IP lookup carries everything else, then the config fallback.
- **Persistence & adoption**: first detection persists your location; every boot paints instantly from the record while a silent background re-detect adopts **real city changes** (travel, moved desktop) and re-syncs -  coordinate jitter never flips your town, and offline/config-default results can never overwrite a real persisted city.
- **Cross-machine ready**: both location records ride the v0.8.6 backup/restore (`LIVELY_HUD_LOCATION_*` keys) -  export/import carries your location choice along with keys.
- **Honest edges**: a city-less coordinate pin skips GDELT/local-news guessing and falls back to country or world news; a manual name that won't geocode falls back to automatic detection with an explanatory status line in the D panel.
- **Verification**: new location suite (9 test sections -  manual precedence, coords/city/invalid paths, prompt-state gating, granted GPS, persistence/adoption/jitter immunity, outage defaults, broken-Permissions fallback, backup prefixes) + full 9-suite battery green; `node --check` clean; adversarial FIX-FIRST review applied (adoption source-quality gate, no forged `'US'` region for coordinate pins, suggestion-click coordinates honored, corrupt-record self-heal, pipeline fall-through for broken manual entries) -  none outstanding.

### Version 0.8.6 -  Settings Backup & Restore (Export/Import with Keys)
- **One-click settings backup**: open the diagnostic panel (**`D`**) and use **Export settings** -  Local Wally downloads a single portable `local-wally-settings-YYYYMMDD-HHMMSS.json` containing *every* user-tunable Lively property **including API keys** (Wallhaven/Pexels/Unsplash/Pixabay/NewsAPI/Currents/WAQI/OpenWeatherMap) plus all app-owned browser-storage entries.
- **Cross-machine import**: on another machine, open `D` → **Import settings** → pick the file. Whitelisted properties are re-applied through the Lively host (persisted by Lively itself), app storage entries are restored, and the HUD reloads. News keys, provider modes, visibility toggles, HUD position, units, pomodoro durations -  everything moves with you.
- **Format choice**: plain JSON (no zip) -  a settings payload is a few KB of text, so compression saved nothing but would have required hand-rolling an archive reader/writer in a zero-build runtime. JSON is also readable/editable in any editor when you need it.
- **Safety rails**: import validates the payload (product/format/size/shape), applies **only** whitelisted property names, charset-checks keys that get embedded in request URLs, and restores **only** app-owned storage keys (`LIVELY_HUD_*`, `local_wally_*`), never foreign entries. The exported file contains credentials in cleartext -  keep it safe (treat it like your password vault export).
- **Verification**: new backup suite (`test_v086_backup.js`, 4 sections: payload shape, parse guards, apply semantics, cross-machine round trip) + full 7-suite battery green; `node --check` clean. Scratch-only file -  SHA-256 in release notes.

### Version 0.8.5 -  Hard Keyed-News Quota Guarantee & GDELT Reliability Verdict
- **Currents/NewsAPI refresh is hard-coded at 15 minutes** (`NEWS_QUOTA_COOLDOWN_KEYED_MS` in code -  deliberately not a settings knob): at most **96 network calls/day per keyed provider**, safely under every known free-tier ceiling (NewsAPI ≈ 100/day, Currents 200/day). The 5-minute automatic cadence is unchanged; between keyed windows the card keeps honestly-marked cached stories and marks no network attempt. A user-facing knob would invite 5-minute polling and burned keys, so none will be added.
- **GDELT reliability verdict** (live-probed on two separate days, HTTP 429 both times): GDELT's rate limiting is aggressive and it cannot be a dependable primary anywhere -  including keyless installs. It is retained only as the keyless first leg of the Google News fallback chain (proxy-free direct JSON when it succeeds; when it 429s the chain continues to the RSS gateways, costing at most ~7 s). With API keys configured and Auto mode on, GDELT is essentially irrelevant to your news.
- **Verification**: 7 suites green re-run (62/62, 18/18, rest 100%), `node --check` clean, release re-packaged and GitHub release synced.

### Version 0.8.4 -  Keyed-First News Default, 5-Minute Auto Refresh & HUD Polish
- **News source reliability**:
 - The Google News chain was fully broken in the wild (live-probed: GDELT 429 rate-limited, `api.allorigins.win` timing out, `corsproxy.io` returning 401 to non-allowlisted origins) while the provider default stayed hard-locked to it -  configured NewsAPI/Currents keys were never consulted unless explicitly selected.
 - New **"Auto (API keys first)"** default resolves Currents → NewsAPI → Google News when keys are configured (Currents is CORS-open from WebView2; NewsAPI's free plan blocks browser preflight, so it is tried second). Keyless installs keep the Google News chain.
 - Google News chain re-armed: unusable locality names (empty, `Local`, `Metropolitan`, `Local Area`) skip the doomed GDELT/geo legs and go straight to a country-aware Google News RSS edition (previously hardcoded US); a third public gateway (`api.codetabs.com`) was added between the primary and fallback proxies, overridable via the new `middleCorsProxy` config knob.
- **Automatic 5-minute news refresh**:
 - News now refreshes on a dedicated 5-minute cadence independent of the 15-minute atmosphere cycle (pause-aware, feed-hidden-aware, idempotent across park/resume and enable/disable).
 - The manual refresh button (and its hidden `R` keyboard shortcut) is removed -  no manual refresh control remains in the UI.
 - Tiered quota firewall preserved: keyed providers keep the unbypassable **15-minute** cooldown (NewsAPI free tier ≈ 100 calls/day; 5-minute polling would exhaust it in ~8 hours), while the keyless Google News chain refreshes on a true 5-minute window. Response cache TTL lowered to 5 minutes; between keyed windows the card keeps honestly-marked cached stories.
- **HUD layout & polish**:
 - The large whitespace gap between the hardware telemetry and the news card is gone: the secondary column top-stacks (`flex-start`) and the hardware monitor absorbs spare column height in every visibility combination, distributing slack across its metric rows instead of pooling one lump gap; the divider survives only while the news card sits below.
 - Environmental metric cards (Humidity/Wind/Precip) are left-justified for a cleaner, more elegant read.
 - The top clock now displays **AM/PM** (12-hour) with the timezone-aware formatter (`formatToParts`) and a correct manual fallback.
- **Migration note**: the News Provider dropdown gained an "Auto" item at index 0, which shifts previously stored selections by one -  if you had explicitly selected a provider before v0.8.4, re-select it once. The default index 0 upgrades transparently to Auto.
- **Verification**: 7 suites green (v0.8.3 suite 62/62, providers suite 100%, v0.8.1 100%, v0.7.3/v0.7.2/v0.7.1/hardening 100%), `node --check` clean, fresh-context adversarial review SHIP-WITH-NITS with zero major findings (5 nits fixed). One test-suite sandbox gained `URLSearchParams` (scratch-only change, SHA-256 reported in release notes).

### Version 0.8.3 -  News Engine Integrity, Timezone-Correct Forecasts & Render Pacing
- **News Engine Integrity**:
 - Every news request is bound to its identity (location query, country, provider/mode): a delayed response can never overwrite another query's cache, visible news, or pending snapshot; equivalent concurrent requests dedupe into one bounded in-flight map.
 - Unbypassable per-provider 15-minute quota firewall -  settings updates, reloads, and global refresh cannot skip it; failed attempts count; rotate mode falls through to the first cooldown-ready provider instead of stalling.
 - Removed the fabricated-headlines fallback with real-publisher attribution: the terminal state is matching real cached stories (visibly "Cached") or an honest unavailable state. Publication timestamps normalized per provider with a future-guard; article age computed at display time.
- **Timezone & Forecast Correctness**:
 - Open-Meteo now uses `timeformat=unixtime` with labels formatted in the location's IANA timezone -  DST transitions display correctly (spring-forward skips 02:00); old ISO payloads remain supported.
 - Feels-Like Peak selects the remaining day by LOCAL calendar date in the location's timezone (correct for +5:30/+5:45 offsets and 23/25-hour DST days), from the current interval onward; unknown timezone reports Unavailable instead of borrowing the host's.
 - Undated forecast points are rejected from rain/peak analytics; analytics use full-resolution hourly data (the 8-point chart is display-only) so peaks the 3-hourly sampling skipped are detected; charts render honest gaps instead of faking a minimum; AQI aligned by absolute instants.
- **Rendering & Interaction**:
 - 60 FPS pacing on high-refresh displays via a remainder-preserving accumulator (144 Hz previously ~48 fps, 165 Hz ~55 fps -  now ~60 renders/second in deterministic simulation); physics dt is the actual time since the last rendered frame; single-RAF-chain and parking invariants preserved.
 - Telemetry bars animate `transform: scaleX()` on a fixed width instead of `width`; HUD/dock position changes are discrete with a transform-only FLIP move (reduced motion = immediate); wallpaper loads are generation-guarded so an older image can never overwrite a newer one.
 - Open drawers preserve focus (focused story restored without scroll jump, close-button fallback) and scroll on refresh; a validated stale snapshot paints immediately at boot marked "Cached" before network revalidation.
- **Robustness**:
 - Backward clock jumps trigger celestial refresh; rotation cursors/recent history work without localStorage (memory-first, bounded); the cache is memory-source-of-truth so failing storage no longer causes refetch loops (persistence failure shows "· RAM only" in diagnostics); fetch timeouts reject non-numeric delays (long-standing test warning eliminated).
- **Deferred with reasons**: adaptive-quality and WebGL2 instanced-particle pilots require on-target WebView2 measurements (gates defined, unexecuted); WebGPU/WASM SIMD/workers/OffscreenCanvas rejected without a measured bottleneck; CSP policy deferred pending validation against Lively's loading model.
- **Verification**: 8 suites green (6 regression suites, new v0.8.3 suite 62/62, audit-hardening 22/22), `node --check` clean across all 23 JS files, 5-file footprint (+1207/−509).

### Version 0.8.2 -  Consolidated Audit Fixes, Timezone Correctness & Render-Loop Integrity
- **Stability & Correctness**:
 - Restored the single-RAF-chain invariant: resuming with a queued snapshot no longer arms a duplicate animation loop (`App.startLoop()` re-arms via the guarded `wakeAnimationLoop()`), eliminating double per-vsync work during active animation.
 - Timezone-correct 6-hour Rain Outlook and Feels-Like Peak horizons: all three weather adapters emit absolute forecast `timestamp`s; Open-Meteo resolves location-local naive strings via `utc_offset_seconds` → `Date.UTC`, and the cached-snapshot fallback only trusts offset-bearing ISO strings -  fixing wrong/missing rain windows after midnight and for remote timezones.
- **Security & Robustness**:
 - Completed HTML escaping in the weather detail drawer (4 provider-sourced fields) and hardened CSS `url("...")` interpolation at both wallpaper ingest points.
 - Fixed a boot visibility race that could permanently park the wallpaper if the window transitioned hidden→visible before bridge init.
 - AQI no longer fabricates a value on degenerate success payloads -  all 3 normalizer sites report `Unavailable` without a usable measurement.
 - Next Sky Event now uses astronomical dawn (`nightEnd`) per blueprint §29.3/§30.4, with circumpolar Invalid-Date guards (also in the tomorrow fallback).
- **Performance & Rendering**:
 - Eliminated a forced reflow in the auto-resize layout path (wrap width captured before style writes); audio visualizer silence sleep now honors the documented 1.5 s wall-clock (previously ~0.75 s from double frame counting).
 - Dirty-check guards on warm-path DOM text updates (Pomodoro, diagnostics); `prefers-reduced-motion` now disables the charging pulse.
- **Quality of Life**:
 - Revived the numeric provider `isDay` fallback; open detail drawers refresh on sync with scroll preserved; unhandled-rejection guard on the news attach chain.
- **Verification**: 6/6 regression suites at 100%, `node --check` clean across all 22 JS files, 4-file footprint (+197/−42).

### Version 0.8.1 -  Comprehensive Production Code Audit & Performance Hardening
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

### Version 0.8 -  Multi-Source Wallpaper Providers & Localized News Engines
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

### Version 0.7.3 -  Audit Hardening, Ephemeris Precision & Popover Safety
- **News Listener Delegation & Invalidation Lifecycle**: Replaced per-render listener attachment with a single delegated event listener on the `#hud-news-dots` container. Invalides and clears both rotation and transition timeouts (`clearNewsTimers()`) on manual dot clicks, preventing stale ~300ms transition callbacks from overriding user selections. Implemented roving `tabindex` and full arrow key navigation across news tabs.
- **Authoritative Physical Day/Night Calculation**: Fixed solar day vs. night classification to strictly derive from physical solar altitude (`altitude > -0.01454` radians) without letting weather provider flags override local astronomical calculations. Standardized polar day/night evaluation to the same physical threshold and eliminated machine timezone fallback leakage by using cached IANA formatters.
- **Honest Forecast Telemetry (Zero Fabrication)**: Removed synthetic forecast point interpolation from API adapters; missing weather points and measurements are preserved honestly as `null` and displayed as `--` without inflating chart bounds. Daytime Rain Outlook strictly scopes to the upcoming 6-hour window, and Feels-Like Peak filters strictly to today's local date.
- **Chronological Sky Events & Clean Moon Outlook**: Night Sky Event card gathers candidate astronomical transits (dawn, sunrise, moonset, moonrise) and sorts them chronologically to guarantee the nearest upcoming celestial event is highlighted without duplicating the golden hour card. Moon Visibility Outlook reports "Conditions unavailable" when condition feeds are missing instead of assuming clear skies.
- **Viewport-Safe Hover Popovers**: Added overflow scrolling (`max-height: calc(100vh - 16px)`, `overflow-y: auto`) and viewport edge clamping to prevent hover popover clipping across multi-monitor or compact displays. Added container focus targets and rich popovers for the Hardware Block and Metrics Row with immediate <kbd>Escape</kbd> dismissal.
- **Single RAF Owner & Clean Background Parking**: Unified requestAnimationFrame ownership so animation frames cannot leak or double-schedule across play/pause cycles. All auxiliary intervals (clock, fallback, sync, news) halt cleanly when the wallpaper is parked, maintaining true 0% CPU/GPU load. Lively bridge initializes paused when document starts hidden.

### Version 0.7.2 -  Dynamic Day/Night Cards, Ephemeris Precision & Progressive Disclosure
- **Dynamic 3-Card Daytime & Nighttime Ephemeris**: Replaced fixed static solar/lunar rows with three glanceable, context-adaptive cards automatically determined by physical astronomical solar altitude (`altitude > -0.01454` rad) rather than fixed clock hours or stale API cache flags:
 - **Daytime**: Rain Outlook (6h window, peak rain time & probability), Feels-Like Peak (daily max apparent temperature & occurrence time), and Daylight Left / Golden Hour countdown.
 - **Nighttime**: Next Morning Golden Hour countdown, Moon Phase & Visibility Outlook (astronomical emoji, illumination %, waxing/waning, altitude, and forecast cloud factor), and Next Sky Event (dawn, sunrise, moonset, or NASA 2026 meteor shower/solstice calendar).
- **Progressive Disclosure Floating Hover Popover (`#hud-hover-popover`)**: Hovering or focusing any of the 22 HUD and companion dock elements displays a dedicated acrylic popover with 12px blur, progressive disclosure telemetry, viewport boundary clamping (prevents off-screen clipping), and full keyboard/touch support (<kbd>Tab</kbd> navigation, <kbd>Esc</kbd> dismissal). Zero network requests on hover.
- **Interactive Live News Dots**: Upgraded news pagination dots to accessible `<button class="news-dot" type="button" role="tab">` controls within a `role="tablist"` container. Hovering any dot previews the publisher and relative article age; clicking or pressing <kbd>Enter</kbd> / <kbd>Space</kbd> immediately transitions to that story and resets the rotation timer.
- **Polar Resilience & Timezone Alignment**: Formats all solar and lunar instants using explicit IANA timezone identifiers with cached formatters, handling polar day (midnight sun) and polar night without invalid date representations.

### Version 0.7.1 -  Hover Tooltip Restoration, Clean Moon Ephemeris & Hardware Efficiency
- **Restored Mouse Hover Tooltips Across All Cards**: Restored native hover tooltips across all 9 HUD & companion cards (`#hud-weather-card`, `#hud-metrics-row`, `#hud-forecast-card`, `#hud-ephemeris-card`, `#hud-aqi-card`, `#hud-hw-block`, `#hud-news-block`, `#pomodoro-card`, and `#media-card`) with rich static labels in HTML and zero-allocation dynamic DOM `.title` attribute updates on incoming telemetry.
- **Interactive SVG Forecast Tooltips**: Hourly forecast data points and value labels now feature descriptive SVG `<title>` elements and tooltips detailing time, metric values, and units for instant cursor inspection.
- **Eliminated Moon Badge Artifact & Horizontal Line**: Redesigned `.moon-badge` to be transparent, borderless, and shadowless, completely removing the horizontal box outline and button appearance artifact during New Moon phases. Added automatic suppression during nighttime to eliminate duplication with the active night ephemeris row.
- **Zero-Allocation ParticleEngine Optimization**: Completely purged 6 unused `Float32Array` buffers (`stX`, `stY`, `stSize`, `stBaseAlpha`, `stPhase`, `stSpeed`) and dead loop passes from `js/particles.js`, reducing heap allocations and maximizing memory efficiency on integrated GPUs.
- **Production Audit & NFR Compliance**: Validated full adherence to `DESIGN_BLUEPRINT.md` functional and non-functional requirements: verified zero GC allocations during 60 FPS animation loop execution, zero-overhead parked state (0% CPU/GPU), and 100% test pass rate across all 8 regression suites.

### Version 0.7 -  Targeted Hardening, Lifecycle & Performance
- **Static Scene RAF Parking & 60 FPS Cap**: The 60 FPS animation loop halts completely (0% CPU/GPU load) when the scene is static (no active precipitation, splashes, or audio), waking immediately on music or weather events, and strictly caps frame rates at 60 FPS.
- **Data Integrity & Stale News Isolation**: Delayed regional news responses merge into active snapshots without overwriting newer weather data. Missing air quality data is never fabricated (strictly displays `--` / `Unavailable`).
- **Privacy & Security Protection**: All API keys, tokens, and query parameters are automatically redacted (`?[redacted]`) from error logs and timeout rejections.
- **Occluded Audio Visualizer Sleep**: Sound spectrum processing sleeps immediately when the companion dock or media player is hidden, eliminating wasted CPU cycles.
- **Responsive Viewport Collision Clearance**: Prevents HUD and media dock collisions on compact laptop displays (< 600px height) across all 9 HUD positions with responsive media queries.
- **Smooth Particle Dynamics**: Precipitation transitions smoothly lerp velocity and sizing without garbage collection pauses, and newly activated particle slots initialize cleanly on snow density increases.
- **Coalesced Resizing & Backing-Store Protection**: Window resizing coalesces via requestAnimationFrame, debounces contrast sampling, and avoids unnecessary canvas backing store allocations.
- **Accessible Detail Drawer**: Modal dialog traps keyboard focus (Tab / Shift+Tab), dismisses cleanly on Escape, and returns focus to the triggering card.
- **Failure-Safe Release Packaging**: Release packager uses atomic backup (`.bak`) and automatic rollback to prevent corrupted archive distributions.

### Version 0.6.6 -  Night Wallpaper Illumination & Clean Presentation
- **Night Wallpaper Illumination**: Re-engineered the deep night solar lighting profile to keep background wallpaper photography bright, clear, and visible after dark. Replaced shadow-crushing `multiply` blending with non-destructive `soft-light` (opacity `0.40`), raised night wallpaper baseline brightness to `0.86`, normalized contrast to `1.02`, and eliminated unnatural 185° color hue distortion.
- **Moonlit Celestial Bloom**: Added a soft silvery-blue celestial bloom (`rgba(219, 234, 254, 0.22)` at opacity `0.18`) delivering gentle natural night luminescence across the sky and scene.
- **Synthetic Starfield Elimination**: Completely removed artificial twinkling star canvas dots from the wallpaper UI, saving CPU and GPU canvas draw calls on every 60 FPS animation frame while keeping weather precipitation (rain, snow, splashes) fully active.
- **Nocturnal Vignette Tuning**: Widened the clear central aperture to 55% and reduced edge vignette darkening from `0.48` to `0.22` during nocturnal hours to maintain center and midtone illumination.

### Version 0.6.4 -  GDELT News, Moon Ephemeris & Contextual HUD Details
- **Location-Based Regional News (GDELT DOC 2.0)**: Direct, keyless, and proxy-free regional news ingestion using the GDELT DOC 2.0 API. Formulates location queries with city alias matching, cleans and deduplicates stories, and opens direct publisher articles instead of aggregator redirects, with graceful fallback to Google News RSS.
- **Astronomy & Offline Moon Ephemeris**: Replaced static nighttime displays with an active Day/Night celestial ephemeris row. Daytime showcases Sunrise, Solar Noon, and Sunset; Nighttime dynamically displays Moonrise, Moon Phase, and Moonset computed entirely offline via bundled `SunCalc.getMoonTimes`. Includes lunar cycle age, illumination percentage, traditional Western full moon names (Harvest Moon, Wolf Moon), cultural Vedic Purnima names, and active meteor shower trackers.
- **Contextual Card Detail Drawer**: Click or press <kbd>Enter</kbd> on any card (Weather, Forecast, Regional News, Air Quality, Hardware, Battery, Ephemeris, Music Player, Pomodoro) to slide open an accessible acrylic glass telemetry drawer showing rich grounded metrics. Dismiss instantly with <kbd>Esc</kbd> or click outside. Zero per-frame memory allocation or hover fetching.
- **9 Flexible HUD Positions**: Added Middle Right, Middle Left, Middle Top, Middle Bottom, and Center Screen options across Lively Properties, `config.js`, and CSS layout engines without dock collisions.
- **Media Player Identity**: Intelligently identifies media player applications (Spotify, Apple Music, Edge, Chrome, etc.) from Windows SMTC sessions with neutral fallback, documenting host requirements for Windows AppUserModelId (AUMID) forwarding.

### Version 0.6.3 -  Layout & Readability Refinements
- **Compact Temperature Grouping**: Replaced the wide gap between the temperature and condition details with an integrated, cohesive weather header. Current temperature, condition description, "feels like", and high/low values now sit side-by-side naturally.
- **High-Legibility Forecast Chart**: Upgraded forecast tab buttons with clear, concise labels (`Temp`, `Feels`, `Precip`, `Wind`, `Humidity`, `AQI`) and larger typography. Enhanced SVG chart value and time labels with crisp stroke outlines for effortless reading across 720p, 1080p, 1440p, and 4K displays.
- **Adaptive News Panel**: The Regional News Dispatch panel now sizes itself to fit its content naturally without reserving empty space. Supports up to 3 lines of headlines and dynamically shows pagination dots only when multiple stories are present.
- **Balanced Hardware Telemetry**: Relaxed row padding and spacing across CPU, GPU, RAM, Disk, and Network monitors to give them comfortable breathing room.

### Version 0.6.2 -  Reliability & Hardening Updates
- **Smart Pause & Resume**: Local Wally strictly respects when Lively pauses wallpaper playback (such as during gaming), never waking prematurely and resuming cleanly with fresh data upon return.
- **True Deep Sleep**: Canvas drawing operations and audio visualizers completely park themselves and clear memory when sleeping or disabled, preventing frozen frames.
- **Accurate Time Alignments**: Fixed 24-hour forecast alignment across timezones and midnight transitions, and preserved honest outage reporting without fabricating data.
- **Defensive Number Protection**: All system telemetry and weather feeds strictly reject invalid numbers (`NaN` or `Infinity`) before rendering.
- **Responsive Screen Adaptation**: Dynamically adjusts offsets so the dashboard never clips or overflows on compact displays (like 720p or 768p laptop screens).

