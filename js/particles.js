/**
 * ParticleEngine - Zero-Allocation Struct-of-Arrays (SoA) Canvas Particle Engine
 * 
 * Hardware Target: AMD Ryzen AI 7 350 + Radeon 860M (RDNA 3.5 UMA)
 * Principles:
 *  - Float32Array contiguous linear memory layout for cache-line prefetching.
 *  - Zero heap allocation (no new Object(), no push(), no splice()) during update & render.
 *  - DPR strictly clamped to 1.0 for fill-rate protection on 1600p/2.5K displays.
 *  - Batched single-path draw calls (one ctx.stroke() / ctx.fill() per layer).
 *  - Ring-buffer ripple pools for droplet surface splash mechanics.
 */
(function(global) {
  'use strict';

  var cfgMaxPrecip = (global.LOCAL_WALLY_CONFIG && typeof global.LOCAL_WALLY_CONFIG.maxPrecipitationParticles === 'number')
    ? global.LOCAL_WALLY_CONFIG.maxPrecipitationParticles
    : 1800;
  var MAX_PRECIP = Math.max(100, Math.min(5000, cfgMaxPrecip));
  var MAX_SPLASHES = 120;
  var MAX_STARS = 0; // Disabled: unnecessary blinking stars removed from wallpaper UI

  var COLOR_STAR = 'rgba(255, 255, 255, 0.85)';
  var COLOR_SNOW = 'rgba(255, 255, 255, 0.82)';
  var COLOR_STORM_RAIN = 'rgba(215, 235, 255, 0.65)';
  var COLOR_RAIN = 'rgba(225, 240, 255, 0.45)';
  var COLOR_SPLASH = 'rgba(220, 238, 255, 0.35)';
  var COLOR_LIGHTNING = '#ebf5ff';

  var sin = Math.sin;
  var cos = Math.cos;
  var random = Math.random;
  var TWO_PI = Math.PI * 2;

  /**
   * Hardware GPU Profiler querying WEBGL_debug_renderer_info.
   * Classifies hardware into:
   *  - iGPU / UMA (AMD Radeon 800M/700M/600M, Intel Iris Xe/Arc integrated, Qualcomm Adreno, Apple Silicon) -> Clamps DPR to 1.0 to protect shared memory bandwidth and fill rate.
   *  - dGPU (NVIDIA GeForce/RTX/GTX, AMD Radeon RX, Intel Arc dGPU) -> Adaptive DPR min(DPR, 1.5) for supersampled fidelity on dedicated VRAM.
   */
  ParticleEngine.detectGpuProfile = function() {
    var profile = {
      rawRenderer: '',
      cleanRenderer: 'Universal 2D',
      vendor: 'Unknown',
      tier: 'iGPU',
      isDiscrete: false,
      dpr: 1.0
    };

    try {
      var probeCanvas = document.createElement('canvas');
      var gl = probeCanvas.getContext('webgl') || probeCanvas.getContext('experimental-webgl');
      if (gl) {
        var debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          var unmaskedVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
          var unmaskedRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';

          profile.vendor = unmaskedVendor;
          profile.rawRenderer = unmaskedRenderer;
          profile.cleanRenderer = unmaskedRenderer;

          // Strip ANGLE wrapper and driver noise for human-readable diagnostics
          var match = unmaskedRenderer.match(/ANGLE\s*\([^,]+,\s*([^,]+?)(?:\s+Direct3D|\s+vulkan|\s+opengl|\))/i);
          if (match && match[1]) {
            profile.cleanRenderer = match[1].trim();
          }

          var r = unmaskedRenderer.toLowerCase();

          // 1. Identify Discrete GPUs (dGPU)
          var isNvidia = /geforce|rtx|gtx|quadro|titan|tesla/i.test(r);
          var isAmdDiscrete = /radeon\s+(?:rx|vii|hd\s+[789]\d{3})/i.test(r) || (/radeon\s+pro\b/i.test(r) && !/[678]\d{2}m/i.test(r));
          var isIntelDiscrete = /arc\s+(?:a|b|d|pro)\s*\d{2,3}/i.test(r);

          // 2. Identify Integrated GPUs (iGPU / UMA)
          var isAmdIgpu = /(?:radeon\s+[678]\d{2}m|radeon\(tm\)\s+graphics|amd\s+custom\s+gpu|vega)/i.test(r);
          var isIntelIgpu = /(?:iris|uhd|hd\s+graphics|intel\(r\)\s+arc\(tm\)\s+graphics)/i.test(r);
          var isArmIgpu = /adreno|mali|apple|powervr/i.test(r);

          if ((isNvidia || isAmdDiscrete || isIntelDiscrete) && !isAmdIgpu) {
            profile.tier = 'dGPU';
            profile.isDiscrete = true;
            var rawDpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
            profile.dpr = Math.min(rawDpr, 1.5);
          } else {
            profile.tier = 'iGPU';
            profile.isDiscrete = false;
            profile.dpr = 1.0;
          }
        }

        var loseContext = gl.getExtension('WEBGL_lose_context');
        if (loseContext) {
          loseContext.loseContext();
        }
      }
    } catch (e) {
      console.warn('[ParticleEngine] GPU profiling error, defaulting to iGPU:', e);
      profile.tier = 'iGPU';
      profile.dpr = 1.0;
    }

    return profile;
  };

  function ParticleEngine(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d', {
      alpha: true,
      desynchronized: true,
      willReadFrequently: false
    }) || canvasElement.getContext('2d');

    // Hardware-adaptive GPU profiling
    this.gpuProfile = ParticleEngine.detectGpuProfile();
    this.dpr = this.gpuProfile.dpr;

    this.width = 1920;
    this.height = 1080;

    // Density multiplier from Lively settings
    this.densityMultiplier = 1.0;

    // Operational mode
    this.mode = 'CLEAR'; // 'CLEAR', 'RAIN', 'DRIZZLE', 'SNOW', 'THUNDERSTORM'
    this.showStars = false;
    this.windSpeed = 10.0; // km/h
    this.windFactor = 0.5;

    // Thunderstorm lightning state
    this.lightningAlpha = 0.0;
    this.nextLightningTime = 0;

    // Pre-allocated Struct-of-Arrays for Precipitation
    this.pX = new Float32Array(MAX_PRECIP);
    this.pY = new Float32Array(MAX_PRECIP);
    this.pVx = new Float32Array(MAX_PRECIP);
    this.pVy = new Float32Array(MAX_PRECIP);
    this.pSize = new Float32Array(MAX_PRECIP);
    this.pAlpha = new Float32Array(MAX_PRECIP);
    this.pAux = new Float32Array(MAX_PRECIP); // Snow phase oscillation or rain length
    this.activePrecipCount = 0;

    // Pre-allocated Ring-Buffer for Surface Splashes
    this.sX = new Float32Array(MAX_SPLASHES);
    this.sY = new Float32Array(MAX_SPLASHES);
    this.sRadius = new Float32Array(MAX_SPLASHES);
    this.sMaxRadius = new Float32Array(MAX_SPLASHES);
    this.sAlpha = new Float32Array(MAX_SPLASHES);
    this.sGrowth = new Float32Array(MAX_SPLASHES);
    this.sActive = new Uint8Array(MAX_SPLASHES);
    this.splashRingIndex = 0;

    // Pre-allocated Struct-of-Arrays for Starfield
    this.stX = new Float32Array(MAX_STARS);
    this.stY = new Float32Array(MAX_STARS);
    this.stSize = new Float32Array(MAX_STARS);
    this.stBaseAlpha = new Float32Array(MAX_STARS);
    this.stPhase = new Float32Array(MAX_STARS);
    this.stSpeed = new Float32Array(MAX_STARS);
    this.activeStarCount = 0;

    this.initPools();
    this.resize();
  }

  ParticleEngine.prototype.initPools = function() {
    var i;
    // Initialize stars uniformly
    for (i = 0; i < MAX_STARS; i++) {
      this.stX[i] = random() * this.width;
      this.stY[i] = random() * (this.height * 0.75); // Upper three quarters
      this.stSize[i] = 0.6 + random() * 1.4;
      this.stBaseAlpha[i] = 0.2 + random() * 0.7;
      this.stPhase[i] = random() * TWO_PI;
      this.stSpeed[i] = 0.02 + random() * 0.04;
    }
    this.activeStarCount = MAX_STARS;

    // Initialize precipitation slots
    for (i = 0; i < MAX_PRECIP; i++) {
      this.resetPrecipParticle(i, true);
    }
  };

  ParticleEngine.prototype.resetPrecipParticle = function(i, randomizeY) {
    var w = this.width;
    var h = this.height;

    this.pX[i] = random() * (w + 200) - 100;
    this.pY[i] = randomizeY ? (random() * h) : (-20 - random() * 60);

    if (this.mode === 'SNOW') {
      // Gentle snow flake
      this.pVx[i] = (random() - 0.5) * 0.6 + (this.windFactor * 0.4);
      this.pVy[i] = 0.8 + random() * 1.6;
      this.pSize[i] = 1.2 + random() * 2.8;
      this.pAlpha[i] = 0.4 + random() * 0.55;
      this.pAux[i] = random() * TWO_PI; // Sinusoidal sway
    } else {
      // Rain / Drizzle streak
      var isHeavy = (this.mode === 'THUNDERSTORM' || this.mode === 'RAIN');
      var speedMultiplier = isHeavy ? 1.0 : 0.6;
      this.pVx[i] = (this.windFactor * 3.5) + (random() - 0.5) * 0.5;
      this.pVy[i] = (16.0 + random() * 12.0) * speedMultiplier;
      this.pSize[i] = 8.0 + random() * 14.0; // Streak length
      this.pAlpha[i] = 0.25 + random() * 0.4;
      this.pAux[i] = 0.0;
    }
  };

  ParticleEngine.prototype.triggerSplash = function(x, y) {
    var idx = this.splashRingIndex;
    this.splashRingIndex = (this.splashRingIndex + 1) % MAX_SPLASHES;

    this.sX[idx] = x;
    this.sY[idx] = y;
    this.sRadius[idx] = 1.0;
    this.sMaxRadius[idx] = 3.0 + random() * 5.0;
    this.sAlpha[idx] = 0.45;
    this.sGrowth[idx] = 0.35 + random() * 0.3;
    this.sActive[idx] = 1;
  };

  ParticleEngine.prototype.resize = function() {
    var w = window.innerWidth || 1920;
    var h = window.innerHeight || 1080;

    // Adaptive DPR (1.0 on iGPU / UMA to protect fill-rate; up to 1.5 on dGPU)
    this.dpr = (this.gpuProfile && typeof this.gpuProfile.dpr === 'number') ? this.gpuProfile.dpr : 1.0;
    this.width = w;
    this.height = h;

    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);

    if (this.ctx) {
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    // Rescale star positions to fit screen bounds
    for (var i = 0; i < MAX_STARS; i++) {
      this.stX[i] = random() * w;
      this.stY[i] = random() * (h * 0.75);
    }
  };

  ParticleEngine.prototype.setWeather = function(category, windSpeedKm, isDay, sunAltitude) {
    var oldMode = this.mode;
    var oldWind = this.windSpeed;

    this.mode = category || 'CLEAR';
    this.windSpeed = windSpeedKm != null ? windSpeedKm : 10;
    // Calculate normalized horizontal wind drift
    this.windFactor = (this.windSpeed / 50.0);
    if (this.windFactor > 1.8) this.windFactor = 1.8;

    // Starfield disabled: blinking stars removed from wallpaper UI
    this.showStars = false;

    // Active particle count based on weather severity and user multiplier
    var baseCount = 0;
    if (this.mode === 'THUNDERSTORM') {
      baseCount = 1400;
    } else if (this.mode === 'RAIN') {
      baseCount = 1000;
    } else if (this.mode === 'DRIZZLE') {
      baseCount = 450;
    } else if (this.mode === 'SNOW') {
      baseCount = 650;
    } else {
      baseCount = 0;
    }

    var targetCount = Math.floor(baseCount * this.densityMultiplier);
    if (targetCount > MAX_PRECIP) targetCount = MAX_PRECIP;
    this.activePrecipCount = targetCount;

    // Reconfigure active particle velocities and physics on mode/wind transition
    var modeChanged = (this.mode !== oldMode);
    var windChanged = Math.abs(this.windSpeed - oldWind) > 1.5;

    if (modeChanged || windChanged) {
      var isHeavy = (this.mode === 'THUNDERSTORM' || this.mode === 'RAIN');
      var speedMultiplier = isHeavy ? 1.0 : 0.6;
      for (var i = 0; i < this.activePrecipCount; i++) {
        if (modeChanged) {
          if (this.mode === 'SNOW') {
            this.pVx[i] = (random() - 0.5) * 0.6 + (this.windFactor * 0.4);
            this.pVy[i] = 0.8 + random() * 1.6;
            this.pSize[i] = 1.2 + random() * 2.8;
            this.pAlpha[i] = 0.4 + random() * 0.55;
            this.pAux[i] = random() * TWO_PI;
          } else {
            this.pVx[i] = (this.windFactor * 3.5) + (random() - 0.5) * 0.5;
            this.pVy[i] = (16.0 + random() * 12.0) * speedMultiplier;
            this.pSize[i] = 8.0 + random() * 14.0;
            this.pAlpha[i] = 0.25 + random() * 0.4;
            this.pAux[i] = 0.0;
          }
        } else if (windChanged) {
          if (this.mode === 'SNOW') {
            this.pVx[i] = (random() - 0.5) * 0.6 + (this.windFactor * 0.4);
          } else {
            this.pVx[i] = (this.windFactor * 3.5) + (random() - 0.5) * 0.5;
          }
        }
      }
    }
  };

  ParticleEngine.prototype.update = function(dt) {
    // Safety clamp delta time to avoid frame skips
    var step = dt > 0.06 ? 0.06 : (dt < 0.001 ? 0.016 : dt);
    var timeScale = step * 60.0;
    var w = this.width;
    var h = this.height;
    var groundY = h * 0.94; // Surface splash horizon

    var i;

    // 1. Update Starfield
    if (this.showStars) {
      for (i = 0; i < this.activeStarCount; i++) {
        this.stPhase[i] += this.stSpeed[i] * timeScale;
        if (this.stPhase[i] > TWO_PI) {
          this.stPhase[i] -= TWO_PI;
        }
      }
    }

    // 2. Update Precipitation Particles
    var count = this.activePrecipCount;
    var isSnow = (this.mode === 'SNOW');

    for (i = 0; i < count; i++) {
      if (isSnow) {
        // Snow wobble logic
        this.pAux[i] += 0.03 * timeScale;
        var wobble = sin(this.pAux[i]) * 0.8;
        this.pX[i] += (this.pVx[i] + wobble) * timeScale;
        this.pY[i] += this.pVy[i] * timeScale;

        // Wrap around
        if (this.pY[i] > h + 10) {
          this.pY[i] = -10;
          this.pX[i] = random() * (w + 100) - 50;
        }
      } else {
        // Rain streak logic
        this.pX[i] += this.pVx[i] * timeScale;
        this.pY[i] += this.pVy[i] * timeScale;

        // Ground splash trigger
        if (this.pY[i] >= groundY && this.pY[i] <= h) {
          if (random() < 0.18) {
            this.triggerSplash(this.pX[i], this.pY[i]);
          }
        }

        // Reset particle on bottom exit
        if (this.pY[i] > h + 20) {
          this.pY[i] = -20;
          this.pX[i] = random() * (w + 200) - 100;
        }
      }

      // Horizontal wrapping
      if (this.pX[i] > w + 100) {
        this.pX[i] = -50;
      } else if (this.pX[i] < -100) {
        this.pX[i] = w + 50;
      }
    }

    // 3. Update Splashes
    for (i = 0; i < MAX_SPLASHES; i++) {
      if (this.sActive[i] === 1) {
        this.sRadius[i] += this.sGrowth[i] * timeScale;
        this.sAlpha[i] -= 0.025 * timeScale;

        if (this.sAlpha[i] <= 0 || this.sRadius[i] >= this.sMaxRadius[i]) {
          this.sActive[i] = 0;
        }
      }
    }

    // 4. Update Thunderstorm Lightning
    if (this.mode === 'THUNDERSTORM') {
      var now = performance.now();
      if (now > this.nextLightningTime) {
        this.lightningAlpha = 0.55 + random() * 0.35;
        this.nextLightningTime = now + 4000 + random() * 9000;
      }
      if (this.lightningAlpha > 0) {
        this.lightningAlpha -= 0.04 * timeScale;
        if (this.lightningAlpha < 0) this.lightningAlpha = 0;
      }
    } else {
      this.lightningAlpha = 0.0;
    }
  };

  ParticleEngine.prototype.render = function() {
    var ctx = this.ctx;
    var w = this.width;
    var h = this.height;

    // Fast clear
    ctx.clearRect(0, 0, w, h);

    var i;

    // 1. Draw Starfield (Single Batched Fill)
    if (this.showStars) {
      ctx.fillStyle = COLOR_STAR;
      ctx.beginPath();
      for (i = 0; i < this.activeStarCount; i++) {
        var a = this.stBaseAlpha[i] * (0.4 + 0.6 * sin(this.stPhase[i]));
        if (a > 0.15) {
          var sx = this.stX[i];
          var sy = this.stY[i];
          var sr = this.stSize[i];
          ctx.moveTo(sx + sr, sy);
          ctx.arc(sx, sy, sr, 0, TWO_PI);
        }
      }
      ctx.fill();
    }

    // 2. Draw Precipitation
    var count = this.activePrecipCount;
    if (count > 0) {
      if (this.mode === 'SNOW') {
        // Single Batched Arc Path for Snow
        ctx.fillStyle = COLOR_SNOW;
        ctx.beginPath();
        for (i = 0; i < count; i++) {
          var px = this.pX[i];
          var py = this.pY[i];
          var pr = this.pSize[i];
          ctx.moveTo(px + pr, py);
          ctx.arc(px, py, pr, 0, TWO_PI);
        }
        ctx.fill();
      } else {
        // Single Batched Stroke Path for Rain
        ctx.beginPath();
        for (i = 0; i < count; i++) {
          var rx = this.pX[i];
          var ry = this.pY[i];
          var len = this.pSize[i];
          var vx = this.pVx[i];
          var vy = this.pVy[i];

          // Compute angle streak
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx + vx * 0.7, ry + len);
        }
        ctx.strokeStyle = this.mode === 'THUNDERSTORM' ? COLOR_STORM_RAIN : COLOR_RAIN;
        ctx.lineWidth = 1.3;
        ctx.stroke();

        // 3. Draw Splashes (Single Batched Stroke Path)
        ctx.beginPath();
        var hasSplashes = false;
        for (i = 0; i < MAX_SPLASHES; i++) {
          if (this.sActive[i] === 1) {
            hasSplashes = true;
            var spx = this.sX[i];
            var spy = this.sY[i];
            var spr = this.sRadius[i];
            // Render ripple as wide flat ellipse with disconnected subpaths
            ctx.moveTo(spx + spr * 2.0, spy);
            ctx.ellipse(spx, spy, spr * 2.0, spr * 0.6, 0, 0, TWO_PI);
          }
        }
        if (hasSplashes) {
          ctx.strokeStyle = COLOR_SPLASH;
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
      }
    }

    // 4. Render Lightning Flash Overlay (Zero allocations via globalAlpha & static constant)
    if (this.lightningAlpha > 0.01) {
      ctx.globalAlpha = this.lightningAlpha;
      ctx.fillStyle = COLOR_LIGHTNING;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1.0;
    }
  };

  global.ParticleEngine = ParticleEngine;
})(typeof window !== 'undefined' ? window : this);
