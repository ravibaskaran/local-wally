/**
 * App - Main Orchestrator & State Coordinator
 * 
 * Target: Windows 11 Chromium WebView2 (AMD Ryzen AI 7 350 + Radeon 860M)
 * Responsibilities:
 *  - Orchestrates lifecycle between Lively Engine, CacheManager, ApiService,
 *    ParticleEngine, SunCalc Ephemeris, and SkyEngine.
 *  - Enforces zero allocations during the 60 FPS animation loop.
 *  - Manages double-buffered background cross-fades.
 *  - Updates DOM with high performance, avoiding layout thrashing.
 */
(function(global) {
  'use strict';

  var App = {
    // Engine references
    particles: null,
    sky: null,

    // State
    state: null,
    tempUnit: (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.tempUnit === 'F') ? 'F' : 'C',
    currentBgBuffer: 'a',
    lastBgUrl: '',
    lastLoadedImage: null,
    contrastMode: (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.contrastMode) || 'auto',
    currentTheme: 'dark',
    simulationMode: 0, // 0: Live, 1: Clear Day, 2: Rain, 3: Snow, 4: Starry Night
    lastCelestialUpdate: 0,
    isPlaybackPaused: false,
    isSyncing: false,

    // Text-Track Unicode Sparkline Characters (8 levels)
    SPARK_BLOCKS: [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'],

    // Hardware Telemetry Ring Buffers (8 samples each for zero-allocation charts)
    hwCpuHistory: [0, 0, 0, 0, 0, 0, 0, 0],
    hwGpuHistory: [0, 0, 0, 0, 0, 0, 0, 0],
    hwRamHistory: [0, 0, 0, 0, 0, 0, 0, 0],
    hwDiskHistory: [0, 0, 0, 0, 0, 0, 0, 0],
    lastHwUpdate: 0,
    lastFallbackHwTick: 0,
    hwFallbackTimer: null,
    simulatedCpuLoad: 24,
    simulatedGpuLoad: 16,
    simulatedRamUsed: 14.2,
    simulatedRamTotal: 32.0,
    simulatedDiskPct: 28,

    // Regional News Feed Rotation State
    newsItems: [],
    currentNewsIdx: 0,
    newsTimer: null,

    // Animation Loop State
    animationFrameId: null,
    isRunning: false,
    lastFrameTime: 0,
    fps: 60,
    frameCount: 0,
    fpsTimer: 0,
    showDiagnostics: false,

    // Timers
    clockInterval: null,
    syncInterval: null,

    // DOM Elements Cache
    dom: {},

    init: function() {
      console.log('[App] Initializing Local Wally HUD...');
      this.cacheDom();
      this.initEngines();
      this.applyInitialConfig();
      this.updateGpuDiagnostics();
      this.bindEvents();
      this.bindLively();

      // Render initial celestial ephemeris & clock
      this.renderCelestial();
      this.updateClock();

      // Initial hardware telemetry baseline
      this.executeHwFallbackTick();

      // Initial data load
      this.loadAtmosphere(false);

      // Start 60 FPS render loop & active timers
      this.startLoop();
    },

    applyInitialConfig: function() {
      var cfg = (global.LOCAL_WALLY_CONFIG) || {};
      var pos = cfg.hudPosition || 'top-right';
      this.setHudPosition(pos);

      var blur = typeof cfg.glassBlurPx === 'number' ? cfg.glassBlurPx : 14;
      this.setGlassBlur(blur);

      var sat = typeof cfg.glassSaturationPct === 'number' ? cfg.glassSaturationPct : 190;
      this.setGlassSaturation(sat);

      var cm = cfg.contrastMode || 'auto';
      this.setContrastMode(cm);

      if (typeof cfg.refreshIntervalMinutes === 'number' && global.CacheManager) {
        global.CacheManager.setTtlMinutes(cfg.refreshIntervalMinutes);
      }
    },

    cacheDom: function() {
      this.dom = {
        viewport: document.getElementById('viewport'),
        skyBackdrop: document.getElementById('sky-backdrop'),
        celestialContainer: document.getElementById('celestial-container'),
        bgA: document.getElementById('bg-a'),
        bgB: document.getElementById('bg-b'),
        particleCanvas: document.getElementById('particle-canvas'),
        hud: document.getElementById('hud'),
        hudClock: document.getElementById('hud-clock'),
        hudDate: document.getElementById('hud-date'),
        hudLocationText: document.getElementById('hud-location-text'),
        hudTempVal: document.getElementById('hud-temp-val'),
        hudTempUnit: document.getElementById('hud-temp-unit'),
        hudCondition: document.getElementById('hud-condition'),
        hudFeelsLike: document.getElementById('hud-feels-like'),
        hudTempHigh: document.getElementById('hud-temp-high'),
        hudTempLow: document.getElementById('hud-temp-low'),
        metricHumidity: document.getElementById('metric-humidity'),
        metricWind: document.getElementById('metric-wind'),
        metricPrecip: document.getElementById('metric-precip'),
        ephemerisSunrise: document.getElementById('ephemeris-sunrise'),
        ephemerisNoon: document.getElementById('ephemeris-noon'),
        ephemerisSunset: document.getElementById('ephemeris-sunset'),
        ephemerisMoonGlyph: document.getElementById('ephemeris-moon-glyph'),
        ephemerisMoonPhase: document.getElementById('ephemeris-moon-phase'),
        ephemerisMoonIllum: document.getElementById('ephemeris-moon-illum'),
        hudAqiBadge: document.getElementById('hud-aqi-badge'),
        hudAqiCategory: document.getElementById('hud-aqi-category'),
        hudAqiFill: document.getElementById('hud-aqi-fill'),
        hudPm25: document.getElementById('hud-pm25'),
        hudPm10: document.getElementById('hud-pm10'),
        syncDot: document.getElementById('sync-dot'),
        syncStatus: document.getElementById('sync-status'),
        btnRefresh: document.getElementById('btn-refresh'),
        unsplashCredit: document.getElementById('unsplash-credit'),
        diagPanel: document.getElementById('diagnostic-panel'),
        diagGpu: document.getElementById('diag-gpu'),
        diagTheme: document.getElementById('diag-theme'),
        diagFps: document.getElementById('diag-fps'),
        diagFrametime: document.getElementById('diag-frametime'),
        diagParticles: document.getElementById('diag-particles'),
        diagCacheTtl: document.getElementById('diag-cache-ttl'),

        // Hardware Monitor DOM Nodes
        hudHwBadge: document.getElementById('hud-hw-badge'),
        hwCpuName: document.getElementById('hw-cpu-name'),
        hwCpuSpark: document.getElementById('hw-cpu-spark'),
        hwCpuVal: document.getElementById('hw-cpu-val'),
        hwCpuBar: document.getElementById('hw-cpu-bar'),
        hwGpuName: document.getElementById('hw-gpu-name'),
        hwGpuSpark: document.getElementById('hw-gpu-spark'),
        hwGpuVal: document.getElementById('hw-gpu-val'),
        hwGpuBar: document.getElementById('hw-gpu-bar'),
        hwRamDetail: document.getElementById('hw-ram-detail'),
        hwRamSpark: document.getElementById('hw-ram-spark'),
        hwRamVal: document.getElementById('hw-ram-val'),
        hwRamBar: document.getElementById('hw-ram-bar'),
        hwDiskDetail: document.getElementById('hw-disk-detail'),
        hwDiskSpark: document.getElementById('hw-disk-spark'),
        hwDiskVal: document.getElementById('hw-disk-val'),
        hwDiskBar: document.getElementById('hw-disk-bar'),

        // Regional News DOM Nodes
        hudNewsLink: document.getElementById('hud-news-link'),
        hudNewsHeadline: document.getElementById('hud-news-headline'),
        hudNewsSource: document.getElementById('hud-news-source'),
        hudNewsDots: document.getElementById('hud-news-dots')
      };
    },

    initEngines: function() {
      if (global.ParticleEngine && this.dom.particleCanvas) {
        this.particles = new global.ParticleEngine(this.dom.particleCanvas);
      }
      if (global.SkyEngine && this.dom.skyBackdrop) {
        this.sky = new global.SkyEngine(this.dom.skyBackdrop, this.dom.celestialContainer);
      }
    },

    bindEvents: function() {
      var self = this;

      // Handle window resize
      window.addEventListener('resize', function() {
        if (self.particles) self.particles.resize();
        self.updateSky();
        self.updateGpuDiagnostics();
        if (self.contrastMode === 'auto' && self.lastLoadedImage) {
          self.adaptContrastToBackground(self.lastLoadedImage);
        }
      });

      // Refresh button click
      if (this.dom.btnRefresh) {
        this.dom.btnRefresh.addEventListener('click', function() {
          self.loadAtmosphere(true);
        });
      }

      // Keyboard shortcuts
      window.addEventListener('keydown', function(e) {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;

        if (e.key === 'd' || e.key === 'D') {
          self.toggleDiagnostics();
        } else if (e.key === 'r' || e.key === 'R') {
          self.loadAtmosphere(true);
        } else if (e.key === 't' || e.key === 'T') {
          self.toggleTempUnit();
        } else if (e.key === 'c' || e.key === 'C') {
          self.cycleContrastMode();
        }
      });
    },

    bindLively: function() {
      var self = this;
      if (!global.LivelyBridge) return;

      global.LivelyBridge.init();

      // Lifecycle pause / resume
      global.LivelyBridge.onPlaybackChange(function(isPaused) {
        self.isPlaybackPaused = !!isPaused;
        if (isPaused) {
          self.stopLoop();
        } else {
          self.startLoop();
        }
      });

      // Property listeners from Lively Settings
      global.LivelyBridge.onPropertyChange(function(name, val) {
        switch (name) {
          case 'hudPosition':
            self.setHudPosition(val);
            break;
          case 'glassBlur':
            self.setGlassBlur(val);
            break;
          case 'particleDensity':
            self.setParticleDensity(val);
            break;
          case 'tempUnit':
            self.setTempUnit(val === 1 || val === 'Fahrenheit (°F)' ? 'F' : 'C');
            break;
          case 'refreshInterval':
            self.setRefreshInterval(val);
            break;
          case 'unsplashApiKey':
            if (global.ApiService) global.ApiService.unsplashApiKey = val;
            self.loadAtmosphere(true);
            break;
          case 'weatherSimulation':
            self.setSimulationMode(val);
            break;
          case 'contrastMode':
            var cmVal = typeof val === 'number' ? (['auto', 'dark', 'light'][val] || 'auto') : val;
            self.setContrastMode(cmVal);
            break;
        }
      });

      // Real-time Hardware System Information telemetry
      global.LivelyBridge.onSystemInfo(function(hwData) {
        self.handleSystemInfo(hwData);
      });
    },

    setHudPosition: function(pos) {
      if (!this.dom.hud) return;
      this.dom.hud.classList.remove('top-right', 'top-left', 'bottom-right', 'bottom-left');

      var classMap = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];
      var targetClass = 'top-right';

      if (typeof pos === 'number' && classMap[pos]) {
        targetClass = classMap[pos];
      } else if (typeof pos === 'string') {
        var lower = pos.toLowerCase();
        if (lower.indexOf('left') !== -1 && lower.indexOf('top') !== -1) targetClass = 'top-left';
        else if (lower.indexOf('left') !== -1 && lower.indexOf('bottom') !== -1) targetClass = 'bottom-left';
        else if (lower.indexOf('right') !== -1 && lower.indexOf('bottom') !== -1) targetClass = 'bottom-right';
        else targetClass = 'top-right';
      }

      this.dom.hud.classList.add(targetClass);

      if (this.contrastMode === 'auto' && this.lastLoadedImage) {
        this.adaptContrastToBackground(this.lastLoadedImage);
      }
    },

    setGlassBlur: function(px) {
      var blurVal = (typeof px === 'number' ? px : parseFloat(px)) || 14;
      document.documentElement.style.setProperty('--glass-blur', blurVal + 'px');
    },

    setGlassSaturation: function(pct) {
      var satVal = (typeof pct === 'number' ? pct : parseFloat(pct)) || 190;
      document.documentElement.style.setProperty('--glass-saturation', satVal + '%');
    },

    setContrastMode: function(mode) {
      var m = (typeof mode === 'string' ? mode.toLowerCase() : 'auto');
      if (m !== 'dark' && m !== 'light') m = 'auto';
      this.contrastMode = m;
      console.log('[App] Contrast mode set to: ' + m);
      if (m === 'auto') {
        if (this.lastLoadedImage) {
          this.adaptContrastToBackground(this.lastLoadedImage);
        } else {
          this.setHudTheme('dark');
        }
      } else {
        this.setHudTheme(m);
      }
      this.updateThemeDiagnostics();
    },

    cycleContrastMode: function() {
      var modes = ['auto', 'dark', 'light'];
      var nextIdx = (modes.indexOf(this.contrastMode) + 1) % modes.length;
      this.setContrastMode(modes[nextIdx]);
    },

    setHudTheme: function(theme) {
      if (!this.dom.hud) return;
      this.currentTheme = theme === 'light' ? 'light' : 'dark';
      if (this.currentTheme === 'light') {
        this.dom.hud.classList.add('theme-light');
      } else {
        this.dom.hud.classList.remove('theme-light');
      }
      this.updateThemeDiagnostics();
    },

    updateThemeDiagnostics: function() {
      if (!this.dom.diagTheme) return;
      var label = this.contrastMode === 'auto'
        ? ('Auto (' + (this.currentTheme === 'light' ? 'Light' : 'Dark') + ')')
        : (this.contrastMode === 'light' ? 'Manual (Light)' : 'Manual (Dark)');
      this.dom.diagTheme.textContent = label;
    },

    adaptContrastToBackground: function(img) {
      if (this.contrastMode !== 'auto') {
        this.setHudTheme(this.contrastMode);
        return;
      }
      if (!img || !this.dom.hud) return;
      if (!img.complete || (img.naturalWidth === 0 && img.width === 0)) return;

      try {
        var hudRect = this.dom.hud.getBoundingClientRect();
        var vw = window.innerWidth || document.documentElement.clientWidth;
        var vh = window.innerHeight || document.documentElement.clientHeight;
        var iw = img.naturalWidth || img.width;
        var ih = img.naturalHeight || img.height;

        if (iw <= 0 || ih <= 0 || vw <= 0 || vh <= 0) return;

        // Calculate background-size: cover mapping (matches .bg-layer in style.css)
        var scale = Math.max(vw / iw, vh / ih);
        var renderedW = iw * scale;
        var renderedH = ih * scale;
        var offsetX = (vw - renderedW) / 2;
        var offsetY = (vh - renderedH) / 2;

        // Map HUD client rectangle to source image coordinates
        var srcX = Math.max(0, Math.min(iw, (hudRect.left - offsetX) / scale));
        var srcY = Math.max(0, Math.min(ih, (hudRect.top - offsetY) / scale));
        var srcW = Math.max(1, Math.min(iw - srcX, hudRect.width / scale));
        var srcH = Math.max(1, Math.min(ih - srcY, hudRect.height / scale));

        // Sample into offscreen canvas (24x16 downscale)
        var sampleCanvas = document.createElement('canvas');
        sampleCanvas.width = 24;
        sampleCanvas.height = 16;
        var ctx = sampleCanvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, 24, 16);
        var imgData = ctx.getImageData(0, 0, 24, 16).data;

        var totalLuminance = 0;
        var pixelCount = 24 * 16;
        for (var i = 0; i < imgData.length; i += 4) {
          var r = imgData[i] / 255;
          var g = imgData[i + 1] / 255;
          var b = imgData[i + 2] / 255;
          // Standard ITU-R BT.709 perceived luminance formula
          var lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          totalLuminance += lum;
        }

        var avgLuminance = totalLuminance / pixelCount;
        console.log('[App] Sampled HUD background luminance: ' + avgLuminance.toFixed(3));

        // If average luminance > 0.52, switch to light glass theme with dark high-contrast typography
        if (avgLuminance > 0.52) {
          this.setHudTheme('light');
        } else {
          this.setHudTheme('dark');
        }
      } catch (err) {
        // Fallback if canvas is tainted by CORS or offscreen fails
        console.warn('[App] Offscreen luminance sampling security fallback:', err.message);
        if (this.state && this.state.weather) {
          var isDay = this.state.weather.isDay;
          var cat = this.state.weather.category;
          if (isDay && cat === 'SNOW') {
            this.setHudTheme('light');
            return;
          }
        }
        this.setHudTheme('dark');
      }
    },

    setParticleDensity: function(multiplier) {
      var mult = typeof multiplier === 'number' ? multiplier : parseFloat(multiplier) || 1.0;
      if (this.particles) {
        this.particles.densityMultiplier = mult;
        if (this.state && this.state.weather) {
          var sunAlt = this.sky ? this.sky.lastAltitude : null;
          this.particles.setWeather(this.state.weather.category, this.state.weather.windSpeedKm, this.state.weather.isDay, sunAlt);
        }
      }
    },

    setTempUnit: function(unit) {
      this.tempUnit = unit === 'F' ? 'F' : 'C';
      if (this.state) {
        this.renderWeather(this.state.weather);
      }
    },

    toggleTempUnit: function() {
      this.setTempUnit(this.tempUnit === 'C' ? 'F' : 'C');
    },

    setRefreshInterval: function(minutes) {
      if (!global.CacheManager) return;
      var m = global.CacheManager.setTtlMinutes(minutes);
      console.log('[App] Refresh interval set to ' + m + ' minutes');
      this.updateClock();
      this.checkAndSync();
    },

    setSimulationMode: function(mode) {
      var idx = typeof mode === 'number' ? mode : parseInt(mode, 10);
      if (isNaN(idx)) idx = 0;
      this.simulationMode = idx;
      console.log('[App] Simulation mode set to:', idx);

      if (idx === 0) {
        // Return to live
        this.loadAtmosphere(false);
      } else {
        this.applySimulation(idx);
      }
    },

    applySimulation: function(mode) {
      var simWeather = {};
      var now = new Date();

      if (mode === 1) { // Clear Day
        simWeather = {
          tempC: 25.0, tempF: 77.0, apparentC: 24.5, apparentF: 76.1,
          tempMaxC: 28.0, tempMinC: 18.0, tempMaxF: 82.4, tempMinF: 64.4,
          wmoCode: 0, conditionText: 'Clear Sky', category: 'CLEAR',
          humidity: 45, windSpeedKm: 8.0, windSpeedMph: 5.0,
          precipitationMm: 0.0, isDay: 1
        };
      } else if (mode === 2) { // Rain & Storm
        simWeather = {
          tempC: 15.0, tempF: 59.0, apparentC: 13.5, apparentF: 56.3,
          tempMaxC: 17.0, tempMinC: 12.0, tempMaxF: 62.6, tempMinF: 53.6,
          wmoCode: 95, conditionText: 'Thunderstorm', category: 'THUNDERSTORM',
          humidity: 92, windSpeedKm: 28.0, windSpeedMph: 17.4,
          precipitationMm: 14.5, isDay: 1
        };
      } else if (mode === 3) { // Snow
        simWeather = {
          tempC: -2.0, tempF: 28.4, apparentC: -6.0, apparentF: 21.2,
          tempMaxC: 1.0, tempMinC: -5.0, tempMaxF: 33.8, tempMinF: 23.0,
          wmoCode: 73, conditionText: 'Moderate Snow Fall', category: 'SNOW',
          humidity: 84, windSpeedKm: 14.0, windSpeedMph: 8.7,
          precipitationMm: 4.2, isDay: 1
        };
      } else if (mode === 4) { // Starry Night
        simWeather = {
          tempC: 12.0, tempF: 53.6, apparentC: 11.0, apparentF: 51.8,
          tempMaxC: 19.0, tempMinC: 9.0, tempMaxF: 66.2, tempMinF: 48.2,
          wmoCode: 0, conditionText: 'Clear Night', category: 'CLEAR',
          humidity: 60, windSpeedKm: 6.0, windSpeedMph: 3.7,
          precipitationMm: 0.0, isDay: 0
        };
      }

      if (!this.state) {
        this.state = global.CacheManager.getMockData();
      }
      this.state.weather = simWeather;
      this.renderWeather(simWeather);
      this.updateAtmosphereEngines(this.state);
      if (this.contrastMode === 'auto') {
        this.adaptContrastToBackground(this.lastLoadedImage);
      }
    },

    updateGpuDiagnostics: function() {
      if (!this.dom.diagGpu) return;
      if (this.particles && this.particles.gpuProfile) {
        var prof = this.particles.gpuProfile;
        this.dom.diagGpu.textContent = prof.cleanRenderer + ' (' + prof.tier + ', DPR ' + prof.dpr.toFixed(1) + ')';
      } else {
        this.dom.diagGpu.textContent = 'Universal 2D (DPR 1.0)';
      }
    },

    toggleDiagnostics: function() {
      this.showDiagnostics = !this.showDiagnostics;
      if (this.dom.diagPanel) {
        if (this.showDiagnostics) {
          this.dom.diagPanel.classList.add('is-active');
          this.updateGpuDiagnostics();
          this.updateThemeDiagnostics();
        } else {
          this.dom.diagPanel.classList.remove('is-active');
        }
      }
    },

    updateClock: function() {
      if (this.isPlaybackPaused) return;
      var now = new Date();
      var hours = now.getHours();
      var minutes = now.getMinutes();
      var hStr = hours < 10 ? '0' + hours : '' + hours;
      var mStr = minutes < 10 ? '0' + minutes : '' + minutes;

      if (this.dom.hudClock) {
        this.dom.hudClock.textContent = hStr + ':' + mStr;
      }

      if (this.dom.hudDate) {
        var options = { weekday: 'long', month: 'short', day: 'numeric' };
        this.dom.hudDate.textContent = now.toLocaleDateString('en-US', options);
      }

      // Update remaining cache TTL in diagnostics and footer
      if (global.CacheManager) {
        var remainingMs = global.CacheManager.getRemainingTtlMs();
        var remSec = Math.floor(remainingMs / 1000);
        var remM = Math.floor(remSec / 60);
        var remS = remSec % 60;
        var sStr = remS < 10 ? '0' + remS : '' + remS;

        if (this.dom.diagCacheTtl) {
          this.dom.diagCacheTtl.textContent = remM + 'm ' + sStr + 's';
        }

        if (this.dom.syncStatus) {
          if (this.simulationMode > 0) {
            this.dom.syncStatus.textContent = 'Sim Mode';
          } else if (remainingMs > 0) {
            this.dom.syncStatus.textContent = 'Sync in ' + remM + 'm';
          } else {
            this.dom.syncStatus.textContent = 'Syncing...';
          }
        }
      }

      // Continuously refresh celestial ephemeris and sky gradient (every 15s)
      var elapsedCelestial = now.getTime() - this.lastCelestialUpdate;
      if (elapsedCelestial >= 15000 || !this.lastCelestialUpdate) {
        this.renderCelestial();
        this.updateSky();
        this.lastCelestialUpdate = now.getTime();
      }
    },

    renderCelestial: function() {
      if (!global.SunCalc) return;

      var now = new Date();
      var defaultLoc = (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.defaultLocation) || {};
      var lat = typeof defaultLoc.latitude === 'number' ? defaultLoc.latitude : 35.6762;
      var lng = typeof defaultLoc.longitude === 'number' ? defaultLoc.longitude : 139.6503;
      if (this.state && this.state.location) {
        if (typeof this.state.location.latitude === 'number') lat = this.state.location.latitude;
        if (typeof this.state.location.longitude === 'number') lng = this.state.location.longitude;
      }

      function formatTime(d) {
        if (!d || isNaN(d.getTime())) return null;
        var h = d.getHours();
        var m = d.getMinutes();
        return (h < 10 ? '0' + h : '' + h) + ':' + (m < 10 ? '0' + m : '' + m);
      }

      // 1. Solar Ephemeris (Sunrise, Solar Noon, Sunset)
      try {
        var sunTimes = global.SunCalc.getTimes(now, lat, lng);
        var sunriseStr = formatTime(sunTimes.sunrise);
        var sunsetStr = formatTime(sunTimes.sunset);
        var noonStr = formatTime(sunTimes.solarNoon);

        // Handle polar daylight/night edge cases gracefully
        if (!sunriseStr || !sunsetStr) {
          var noonPos = global.SunCalc.getPosition(sunTimes.solarNoon || now, lat, lng);
          if (noonPos && noonPos.altitude > 0) {
            sunriseStr = sunriseStr || 'Polar Day';
            sunsetStr = sunsetStr || '24h Sun';
          } else {
            sunriseStr = sunriseStr || 'Polar Night';
            sunsetStr = sunsetStr || 'No Rise';
          }
        }

        if (this.dom.ephemerisSunrise) this.dom.ephemerisSunrise.textContent = sunriseStr || '--:--';
        if (this.dom.ephemerisNoon) this.dom.ephemerisNoon.textContent = noonStr || '--:--';
        if (this.dom.ephemerisSunset) this.dom.ephemerisSunset.textContent = sunsetStr || '--:--';
      } catch (e) {
        console.warn('[App] Error computing solar ephemeris:', e);
      }

      // 2. Lunar Ephemeris (Moon Phase name, Moon glyph, Illumination percentage)
      try {
        var moonIllum = global.SunCalc.getMoonIllumination(now);
        var fraction = moonIllum.fraction || 0;
        var phase = moonIllum.phase || 0; // 0.0 to 1.0

        var phaseIndex = Math.round(phase * 8) % 8;
        var moonPhases = [
          { name: 'New Moon', glyph: '🌑' },
          { name: 'Waxing Crescent', glyph: '🌒' },
          { name: 'First Quarter', glyph: '🌓' },
          { name: 'Waxing Gibbous', glyph: '🌔' },
          { name: 'Full Moon', glyph: '🌕' },
          { name: 'Waning Gibbous', glyph: '🌖' },
          { name: 'Last Quarter', glyph: '🌗' },
          { name: 'Waning Crescent', glyph: '🌘' }
        ];

        var activePhase = moonPhases[phaseIndex] || moonPhases[0];
        var illumPct = Math.round(fraction * 100) + '%';

        if (this.dom.ephemerisMoonGlyph) this.dom.ephemerisMoonGlyph.textContent = activePhase.glyph;
        if (this.dom.ephemerisMoonPhase) this.dom.ephemerisMoonPhase.textContent = activePhase.name;
        if (this.dom.ephemerisMoonIllum) this.dom.ephemerisMoonIllum.textContent = illumPct;
      } catch (e) {
        console.warn('[App] Error computing lunar ephemeris:', e);
      }
    },

    checkAndSync: function() {
      if (this.isPlaybackPaused || this.simulationMode > 0) return;
      if (global.CacheManager && global.CacheManager.isExpired()) {
        console.log('[App] Cache expired (' + global.CacheManager.getTtlMinutes() + 'm). Executing synchronized sync...');
        this.loadAtmosphere(false);
      }
    },

    loadAtmosphere: function(forceRefresh) {
      var self = this;
      if (this.isPlaybackPaused && !forceRefresh) return;
      if (this.simulationMode > 0 && !forceRefresh) return;

      // Prevent concurrent race condition and thrashing
      if (this.isSyncing) {
        console.log('[App] Atmosphere sync already in progress, ignoring duplicate request.');
        return;
      }
      this.isSyncing = true;

      if (this.dom.btnRefresh) {
        this.dom.btnRefresh.classList.add('is-spinning');
      }

      var finishSync = function() {
        self.isSyncing = false;
        if (self.dom.btnRefresh) {
          self.dom.btnRefresh.classList.remove('is-spinning');
        }
      };

      if (this.dom.syncDot) this.dom.syncDot.style.background = '#fbbf24'; // Amber during sync
      if (this.dom.syncStatus) this.dom.syncStatus.textContent = 'Syncing...';

      if (!global.ApiService) {
        console.warn('[App] ApiService not available');
        finishSync();
        return;
      }

      global.ApiService.fetchAtmosphere(forceRefresh)
        .then(function(snapshot) {
          self.state = snapshot;
          self.renderAll(snapshot);
          if (self.dom.syncDot) self.dom.syncDot.style.background = '#10b981'; // Green on success
          finishSync();
        })
        .catch(function(err) {
          console.error('[App] Failed to load atmosphere:', err);
          if (self.dom.syncDot) self.dom.syncDot.style.background = '#f43f5e'; // Red on error
          if (self.dom.syncStatus) self.dom.syncStatus.textContent = 'Offline Fallback';
          // Fallback to mock data if no state exists
          if (!self.state && global.CacheManager) {
            self.state = global.CacheManager.getMockData();
            self.renderAll(self.state);
          }
          finishSync();
        });
    },

    renderAll: function(snapshot) {
      if (!snapshot) return;

      this.renderLocation(snapshot.location);
      this.renderWeather(snapshot.weather);
      this.renderAqi(snapshot.aqi);
      this.renderNews(snapshot.news);
      this.renderCelestial();
      this.updateBackground(snapshot.background);
      this.updateAtmosphereEngines(snapshot);
    },

    renderLocation: function(loc) {
      if (!loc || !this.dom.hudLocationText) return;
      var text = loc.city || 'Local Area';
      if (loc.country && loc.city && loc.country !== loc.city) {
        text += ', ' + loc.country;
      }
      this.dom.hudLocationText.textContent = text;
    },

    renderWeather: function(w) {
      if (!w) return;

      var isF = (this.tempUnit === 'F');
      var temp = isF ? Math.round(w.tempF) : Math.round(w.tempC);
      var apparent = isF ? Math.round(w.apparentF) : Math.round(w.apparentC);
      var high = isF ? Math.round(w.tempMaxF) : Math.round(w.tempMaxC);
      var low = isF ? Math.round(w.tempMinF) : Math.round(w.tempMinC);

      if (this.dom.hudTempVal) this.dom.hudTempVal.textContent = temp;
      if (this.dom.hudTempUnit) this.dom.hudTempUnit.textContent = isF ? '°F' : '°C';
      if (this.dom.hudCondition) this.dom.hudCondition.textContent = w.conditionText || 'Fair';
      if (this.dom.hudFeelsLike) this.dom.hudFeelsLike.textContent = 'Feels like ' + apparent + '°';
      if (this.dom.hudTempHigh) this.dom.hudTempHigh.textContent = high + '°';
      if (this.dom.hudTempLow) this.dom.hudTempLow.textContent = low + '°';

      if (this.dom.metricHumidity) this.dom.metricHumidity.textContent = Math.round(w.humidity) + '%';
      if (this.dom.metricWind) {
        this.dom.metricWind.textContent = isF
          ? (w.windSpeedMph + ' mph')
          : (w.windSpeedKm + ' km/h');
      }
      if (this.dom.metricPrecip) {
        this.dom.metricPrecip.textContent = (w.precipitationMm || 0.0).toFixed(1) + ' mm';
      }
    },

    renderAqi: function(aqi) {
      if (!aqi) return;

      if (this.dom.hudAqiBadge) {
        this.dom.hudAqiBadge.style.background = aqi.color || '#10b981';
      }
      if (this.dom.hudAqiCategory) {
        this.dom.hudAqiCategory.textContent = (aqi.category || 'Good') + ' (' + aqi.europeanAqi + ')';
      }
      if (this.dom.hudAqiFill) {
        // European AQI 0 to 100 mapped to %
        var pct = Math.min(100, Math.max(5, (aqi.europeanAqi / 80) * 100));
        this.dom.hudAqiFill.style.width = pct + '%';
      }
      if (this.dom.hudPm25) this.dom.hudPm25.textContent = aqi.pm2_5 != null ? aqi.pm2_5 + ' µg/m³' : '--';
      if (this.dom.hudPm10) this.dom.hudPm10.textContent = aqi.pm10 != null ? aqi.pm10 + ' µg/m³' : '--';
    },

    pushHwHistory: function(historyArr, val) {
      for (var i = 0; i < historyArr.length - 1; i++) {
        historyArr[i] = historyArr[i + 1];
      }
      historyArr[historyArr.length - 1] = val;
    },

    getSparklineString: function(historyArr) {
      var str = '';
      for (var i = 0; i < historyArr.length; i++) {
        var v = historyArr[i];
        var idx = Math.min(7, Math.max(0, Math.floor((v / 100) * 8)));
        str += this.SPARK_BLOCKS[idx];
      }
      return str;
    },

    handleSystemInfo: function(data) {
      if (!data || this.isPlaybackPaused) return;
      this.lastHwUpdate = Date.now();

      // CPU load and name
      var cpuVal = typeof data.CurrentCpu === 'number' ? Math.round(data.CurrentCpu) : 0;
      cpuVal = Math.max(0, Math.min(100, cpuVal));
      var cpuName = data.NameCpu || 'Processor';
      this.pushHwHistory(this.hwCpuHistory, cpuVal);

      if (this.dom.hwCpuVal) this.dom.hwCpuVal.textContent = cpuVal + '%';
      if (this.dom.hwCpuBar) this.dom.hwCpuBar.style.width = cpuVal + '%';
      if (this.dom.hwCpuSpark) this.dom.hwCpuSpark.textContent = this.getSparklineString(this.hwCpuHistory);
      if (this.dom.hwCpuName) this.dom.hwCpuName.textContent = cpuName;

      // GPU 3D load and name
      var gpuVal = typeof data.CurrentGpu3D === 'number' ? Math.round(data.CurrentGpu3D) : 0;
      gpuVal = Math.max(0, Math.min(100, gpuVal));
      var gpuName = data.NameGpu || 'Graphics 3D';
      this.pushHwHistory(this.hwGpuHistory, gpuVal);

      if (this.dom.hwGpuVal) this.dom.hwGpuVal.textContent = gpuVal + '%';
      if (this.dom.hwGpuBar) this.dom.hwGpuBar.style.width = gpuVal + '%';
      if (this.dom.hwGpuSpark) this.dom.hwGpuSpark.textContent = this.getSparklineString(this.hwGpuHistory);
      if (this.dom.hwGpuName) this.dom.hwGpuName.textContent = gpuName;

      // RAM usage
      var totalRamMb = typeof data.TotalRam === 'number' ? data.TotalRam : 0;
      var freeRamMb = typeof data.CurrentRamAvail === 'number' ? data.CurrentRamAvail : 0;
      var usedRamMb = totalRamMb > freeRamMb ? (totalRamMb - freeRamMb) : 0;
      var ramPct = totalRamMb > 0 ? Math.round((usedRamMb / totalRamMb) * 100) : 0;
      ramPct = Math.max(0, Math.min(100, ramPct));
      var usedGb = (usedRamMb / 1024).toFixed(1);
      var totalGb = (totalRamMb / 1024).toFixed(1);

      this.pushHwHistory(this.hwRamHistory, ramPct);
      if (this.dom.hwRamVal) this.dom.hwRamVal.textContent = ramPct + '%';
      if (this.dom.hwRamBar) this.dom.hwRamBar.style.width = ramPct + '%';
      if (this.dom.hwRamSpark) this.dom.hwRamSpark.textContent = this.getSparklineString(this.hwRamHistory);
      if (this.dom.hwRamDetail) {
        this.dom.hwRamDetail.textContent = totalRamMb > 0 ? (usedGb + ' / ' + totalGb + ' GB') : 'Physical RAM';
      }

      // Disk / Storage
      var diskVal = typeof data.CurrentDisk === 'number' ? Math.round(data.CurrentDisk) : null;
      if (diskVal === null && typeof data.DiskUsage === 'number') {
        diskVal = Math.round(data.DiskUsage);
      }
      if (diskVal !== null) {
        diskVal = Math.max(0, Math.min(100, diskVal));
        this.pushHwHistory(this.hwDiskHistory, diskVal);
        if (this.dom.hwDiskVal) this.dom.hwDiskVal.textContent = diskVal + '%';
        if (this.dom.hwDiskBar) this.dom.hwDiskBar.style.width = diskVal + '%';
        if (this.dom.hwDiskSpark) this.dom.hwDiskSpark.textContent = this.getSparklineString(this.hwDiskHistory);
        if (this.dom.hwDiskDetail) this.dom.hwDiskDetail.textContent = 'Drive C:';
      } else {
        this.updateDiskEstimate();
      }

      // Switch badge to Live
      if (this.dom.hudHwBadge) {
        this.dom.hudHwBadge.textContent = 'Live';
        this.dom.hudHwBadge.className = 'hud-hw-badge is-live';
      }
    },

    updateDiskEstimate: function() {
      var self = this;
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then(function(estimate) {
          if (estimate.quota && estimate.usage) {
            var pct = Math.max(1, Math.min(100, Math.round((estimate.usage / estimate.quota) * 100)));
            var usedGb = (estimate.usage / (1024 * 1024 * 1024)).toFixed(1);
            var quotaGb = (estimate.quota / (1024 * 1024 * 1024)).toFixed(0);
            self.pushHwHistory(self.hwDiskHistory, pct);
            if (self.dom.hwDiskVal) self.dom.hwDiskVal.textContent = pct + '%';
            if (self.dom.hwDiskBar) self.dom.hwDiskBar.style.width = pct + '%';
            if (self.dom.hwDiskSpark) self.dom.hwDiskSpark.textContent = self.getSparklineString(self.hwDiskHistory);
            if (self.dom.hwDiskDetail) self.dom.hwDiskDetail.textContent = usedGb + ' / ' + quotaGb + ' GB';
          } else {
            self.applyDefaultDiskDisplay();
          }
        }).catch(function() {
          self.applyDefaultDiskDisplay();
        });
      } else {
        this.applyDefaultDiskDisplay();
      }
    },

    applyDefaultDiskDisplay: function() {
      var pct = this.simulatedDiskPct || 28;
      this.pushHwHistory(this.hwDiskHistory, pct);
      if (this.dom.hwDiskVal) this.dom.hwDiskVal.textContent = pct + '%';
      if (this.dom.hwDiskBar) this.dom.hwDiskBar.style.width = pct + '%';
      if (this.dom.hwDiskSpark) this.dom.hwDiskSpark.textContent = this.getSparklineString(this.hwDiskHistory);
      if (this.dom.hwDiskDetail) this.dom.hwDiskDetail.textContent = 'System NVMe';
    },

    checkHwFallback: function() {
      if (this.isPlaybackPaused) return;
      var now = Date.now();
      var hwInterval = (global.LOCAL_WALLY_CONFIG && typeof global.LOCAL_WALLY_CONFIG.hwUpdateIntervalSeconds === 'number')
        ? Math.max(1, global.LOCAL_WALLY_CONFIG.hwUpdateIntervalSeconds) * 1000
        : 10000;
      // If Lively has not sent an update within configured interval
      if (now - this.lastHwUpdate > hwInterval) {
        // Auto-update via fallback ticker
        if (now - this.lastFallbackHwTick >= hwInterval) {
          this.lastFallbackHwTick = now;
          this.executeHwFallbackTick();
        }
      }
    },

    executeHwFallbackTick: function() {
      if (this.isPlaybackPaused) return;
      // Zero-allocation fallback ticker simulating realistic desktop workloads
      var cpuDelta = (Math.random() - 0.48) * 6;
      this.simulatedCpuLoad = Math.max(10, Math.min(65, Math.round(this.simulatedCpuLoad + cpuDelta)));

      var gpuDelta = (Math.random() - 0.49) * 5;
      this.simulatedGpuLoad = Math.max(5, Math.min(48, Math.round(this.simulatedGpuLoad + gpuDelta)));

      var ramDelta = (Math.random() - 0.5) * 0.4;
      this.simulatedRamUsed = Math.max(8.0, Math.min(26.0, parseFloat((this.simulatedRamUsed + ramDelta).toFixed(1))));
      var ramPct = Math.round((this.simulatedRamUsed / this.simulatedRamTotal) * 100);

      var diskDelta = (Math.random() - 0.5) * 2;
      this.simulatedDiskPct = Math.max(20, Math.min(75, Math.round(this.simulatedDiskPct + diskDelta)));

      this.pushHwHistory(this.hwCpuHistory, this.simulatedCpuLoad);
      this.pushHwHistory(this.hwGpuHistory, this.simulatedGpuLoad);
      this.pushHwHistory(this.hwRamHistory, ramPct);
      this.pushHwHistory(this.hwDiskHistory, this.simulatedDiskPct);

      if (this.dom.hwCpuVal) this.dom.hwCpuVal.textContent = this.simulatedCpuLoad + '%';
      if (this.dom.hwCpuBar) this.dom.hwCpuBar.style.width = this.simulatedCpuLoad + '%';
      if (this.dom.hwCpuSpark) this.dom.hwCpuSpark.textContent = this.getSparklineString(this.hwCpuHistory);
      if (this.dom.hwCpuName) this.dom.hwCpuName.textContent = 'Processor';

      if (this.dom.hwGpuVal) this.dom.hwGpuVal.textContent = this.simulatedGpuLoad + '%';
      if (this.dom.hwGpuBar) this.dom.hwGpuBar.style.width = this.simulatedGpuLoad + '%';
      if (this.dom.hwGpuSpark) this.dom.hwGpuSpark.textContent = this.getSparklineString(this.hwGpuHistory);
      if (this.dom.hwGpuName) this.dom.hwGpuName.textContent = 'Graphics 3D';

      if (this.dom.hwRamVal) this.dom.hwRamVal.textContent = ramPct + '%';
      if (this.dom.hwRamBar) this.dom.hwRamBar.style.width = ramPct + '%';
      if (this.dom.hwRamSpark) this.dom.hwRamSpark.textContent = this.getSparklineString(this.hwRamHistory);
      if (this.dom.hwRamDetail) {
        this.dom.hwRamDetail.textContent = this.simulatedRamUsed + ' / ' + this.simulatedRamTotal + ' GB';
      }

      if (this.dom.hwDiskVal) this.dom.hwDiskVal.textContent = this.simulatedDiskPct + '%';
      if (this.dom.hwDiskBar) this.dom.hwDiskBar.style.width = this.simulatedDiskPct + '%';
      if (this.dom.hwDiskSpark) this.dom.hwDiskSpark.textContent = this.getSparklineString(this.hwDiskHistory);
      if (this.dom.hwDiskDetail) this.dom.hwDiskDetail.textContent = 'Drive C:';

      if (this.dom.hudHwBadge) {
        this.dom.hudHwBadge.textContent = 'Standby';
        this.dom.hudHwBadge.className = 'hud-hw-badge is-standby';
      }
    },

    renderNews: function(items) {
      if (Array.isArray(items) && items.length > 0) {
        this.newsItems = items;
      } else if (!this.newsItems || this.newsItems.length === 0) {
        if (global.ApiService) {
          this.newsItems = global.ApiService.getCuratedNews('Local Area');
        }
      }

      this.currentNewsIdx = 0;
      this.displayNewsItem(0);

      // Start rotation cycle if not paused
      if (this.newsTimer) {
        clearInterval(this.newsTimer);
        this.newsTimer = null;
      }
      var rotSec = (global.LOCAL_WALLY_CONFIG && typeof global.LOCAL_WALLY_CONFIG.newsRotateIntervalSeconds === 'number')
        ? Math.max(3, global.LOCAL_WALLY_CONFIG.newsRotateIntervalSeconds)
        : 7;
      if (!this.isPlaybackPaused && this.newsItems && this.newsItems.length > 1) {
        this.newsTimer = setInterval(this.rotateNews.bind(this), rotSec * 1000);
      }
    },

    displayNewsItem: function(idx) {
      if (!this.newsItems || this.newsItems.length === 0) return;
      var item = this.newsItems[idx % this.newsItems.length];
      if (!item) return;

      if (this.dom.hudNewsHeadline) {
        this.dom.hudNewsHeadline.textContent = item.title;
      }
      if (this.dom.hudNewsSource) {
        this.dom.hudNewsSource.textContent = item.source || 'Google News';
      }
      if (this.dom.hudNewsLink) {
        var rawLink = item.link || '';
        var safeLink = (typeof rawLink === 'string' && /^https?:\/\//i.test(rawLink.trim()))
          ? rawLink.trim()
          : 'https://news.google.com';
        this.dom.hudNewsLink.href = safeLink;
      }

      if (this.dom.hudNewsDots) {
        var dots = this.dom.hudNewsDots.children;
        for (var i = 0; i < dots.length; i++) {
          if (i === (idx % this.newsItems.length)) {
            dots[i].classList.add('is-active');
          } else {
            dots[i].classList.remove('is-active');
          }
        }
      }
    },

    rotateNews: function() {
      if (this.isPlaybackPaused) return;
      var self = this;
      if (!this.newsItems || this.newsItems.length <= 1) return;

      // Smooth CSS opacity transition (0.3s)
      if (this.dom.hudNewsLink) {
        this.dom.hudNewsLink.classList.add('is-fading');
      }

      setTimeout(function() {
        if (self.isPlaybackPaused) return;
        self.currentNewsIdx = (self.currentNewsIdx + 1) % self.newsItems.length;
        self.displayNewsItem(self.currentNewsIdx);
        if (self.dom.hudNewsLink) {
          self.dom.hudNewsLink.classList.remove('is-fading');
        }
      }, 300);
    },

    updateBackground: function(bg) {
      if (!bg || !bg.url || bg.url === this.lastBgUrl) return;
      var self = this;
      var incomingUrl = bg.url;

      // Double-buffered cross-fade preloader
      var preloader = new Image();
      preloader.crossOrigin = 'anonymous';
      preloader.onload = function() {
        self.lastBgUrl = incomingUrl;
        self.lastLoadedImage = preloader;
        var activeEl = self.currentBgBuffer === 'a' ? self.dom.bgA : self.dom.bgB;
        var inactiveEl = self.currentBgBuffer === 'a' ? self.dom.bgB : self.dom.bgA;

        // Load into inactive buffer
        inactiveEl.style.backgroundImage = 'url("' + incomingUrl + '")';

        // Swap classes for seamless 1.2s cross-fade
        inactiveEl.classList.remove('is-hidden');
        inactiveEl.classList.add('is-active');
        activeEl.classList.remove('is-active');
        activeEl.classList.add('is-hidden');

        self.currentBgBuffer = self.currentBgBuffer === 'a' ? 'b' : 'a';

        // Adapt glassmorphism contrast to the newly loaded background image
        if (self.contrastMode === 'auto') {
          self.adaptContrastToBackground(preloader);
        }

        // Update photo credit
        if (self.dom.unsplashCredit) {
          self.dom.unsplashCredit.textContent = 'Photo by ' + (bg.photographer || 'Unsplash');
          self.dom.unsplashCredit.href = bg.photographerUrl || 'https://unsplash.com';
        }
      };
      preloader.onerror = function(err) {
        console.warn('[App] Failed to preload resolution-matched wallpaper:', incomingUrl, err);
      };
      preloader.src = incomingUrl;
    },

    updateAtmosphereEngines: function(snapshot) {
      var w = snapshot.weather;
      var loc = snapshot.location;

      // 1. Update Sky Gradient
      this.updateSky();

      // 2. Update Particle Engine
      if (this.particles) {
        var sunAlt = this.sky ? this.sky.lastAltitude : null;
        this.particles.setWeather(w.category, w.windSpeedKm, w.isDay, sunAlt);
      }
    },

    updateSky: function() {
      if (!this.sky || !this.state) return;
      var now = new Date();
      var loc = this.state.location || { latitude: 35.6762, longitude: 139.6503 };
      this.sky.update(now, loc.latitude, loc.longitude);
    },

    startLoop: function() {
      if (this.isPlaybackPaused) return;
      if (this.isRunning) return;
      this.isRunning = true;
      this.lastFrameTime = performance.now();
      this.fpsTimer = performance.now();
      this.frameCount = 0;

      // Cleanly restart background timers if parked
      if (!this.clockInterval) {
        this.updateClock();
        this.clockInterval = setInterval(this.updateClock.bind(this), 1000);
      }
      if (!this.hwFallbackTimer) {
        this.executeHwFallbackTick();
        this.hwFallbackTimer = setInterval(this.checkHwFallback.bind(this), 2000);
      }
      var rotSec = (global.LOCAL_WALLY_CONFIG && typeof global.LOCAL_WALLY_CONFIG.newsRotateIntervalSeconds === 'number')
        ? Math.max(3, global.LOCAL_WALLY_CONFIG.newsRotateIntervalSeconds)
        : 7;
      if (!this.newsTimer && this.newsItems && this.newsItems.length > 1) {
        this.newsTimer = setInterval(this.rotateNews.bind(this), rotSec * 1000);
      }
      if (!this.syncInterval) {
        this.syncInterval = setInterval(this.checkAndSync.bind(this), 60000);
      }

      this.loop(this.lastFrameTime);
    },

    stopLoop: function() {
      this.isRunning = false;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      if (this.clockInterval) {
        clearInterval(this.clockInterval);
        this.clockInterval = null;
      }
      if (this.hwFallbackTimer) {
        clearInterval(this.hwFallbackTimer);
        this.hwFallbackTimer = null;
      }
      if (this.newsTimer) {
        clearInterval(this.newsTimer);
        this.newsTimer = null;
      }
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
      console.log('[App] Animation loop halted (0% CPU/GPU parked)');
    },

    loop: function(currentTime) {
      if (!this.isRunning) return;

      var dt = (currentTime - this.lastFrameTime) * 0.001; // Seconds
      this.lastFrameTime = currentTime;

      // 1. Update & Render Particles (Canvas 2D SoA)
      if (this.particles) {
        this.particles.update(dt);
        this.particles.render();
      }

      // 2. FPS & Performance Diagnostics
      if (this.showDiagnostics) {
        this.frameCount++;
        if (currentTime - this.fpsTimer >= 500) {
          this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.fpsTimer));
          this.frameCount = 0;
          this.fpsTimer = currentTime;

          if (this.dom.diagFps) this.dom.diagFps.textContent = this.fps;
          if (this.dom.diagFrametime) this.dom.diagFrametime.textContent = (dt * 1000).toFixed(1) + 'ms';
          if (this.dom.diagParticles && this.particles) {
            this.dom.diagParticles.textContent = this.particles.activePrecipCount;
          }
          this.updateGpuDiagnostics();
        }
      }

      // Next frame
      var self = this;
      this.animationFrameId = requestAnimationFrame(function(time) {
        self.loop(time);
      });
    }
  };

  // Bootstrap when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      App.init();
    });
  } else {
    App.init();
  }

  global.App = App;
})(typeof window !== 'undefined' ? window : this);
