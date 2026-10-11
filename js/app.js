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

  /**
   * ==============================================================================
   * 1. MediaVisualizerEngine
   * Universal Windows Media SMTC Canvas & 60 FPS Visualizer Engine
   * ==============================================================================
   */
  function MediaVisualizerEngine(options) {
    options = options || {};
    this.dom = {
      card: options.card,
      art: options.art,
      title: options.title,
      artist: options.artist,
      badge: options.badge,
      canvas: options.canvas
    };

    this.enabled = options.enabled !== false;
    this.ctx = this.dom.canvas ? this.dom.canvas.getContext('2d', { alpha: true, desynchronized: true }) : null;
    this.isLightTheme = false;

    // Zero-allocation typed buffers
    this.bandCount = 32;
    this.rawSpectrum = new Float32Array(32);
    this.dampedSpectrum = new Float32Array(32);
    this.synthBuffer = new Float32Array(128);

    // Precalculate 32 logarithmic psychoacoustic frequency bands across 128 input bins
    this.bandRanges = new Int32Array(64);
    var alpha = 0.08;
    var A = 128 / (Math.exp(alpha * 32) - 1);
    var prev = 0;
    for (var i = 0; i < 32; i++) {
      var startBin = prev;
      var endBin = (i === 31) ? 128 : Math.min(128, Math.max(startBin + 1, Math.round(A * (Math.exp(alpha * (i + 1)) - 1))));
      prev = endBin;
      this.bandRanges[i * 2] = startBin;
      this.bandRanges[i * 2 + 1] = endBin;
    }

    // Zero-CPU Silence Sleep state
    this.silenceFrames = 0;
    this.isSleeping = false;

    // Demo / Preview Mode state
    this.demoMode = 0; // 0: Normal / SMTC, 1: Synthwave, 2: Lo-Fi, 3: Ambient
    this.demoTracks = [
      { title: 'Resonance', artist: 'HOME (Synthwave)', badge: 'DEMO' },
      { title: 'Coffee Breath', artist: 'Sofia Mills (Lo-Fi)', badge: 'DEMO' },
      { title: 'Weightless', artist: 'Marconi Union (Ambient)', badge: 'DEMO' }
    ];

    this.defaultArt = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 24 24' fill='none' stroke='%2338bdf8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='3'/></svg>";
    this.initGradient();
  }

  MediaVisualizerEngine.BAR_RADII = Object.freeze([2, 2, 0, 0]);

  MediaVisualizerEngine.prototype.initGradient = function() {
    if (!this.ctx || !this.dom.canvas) return;
    var h = this.dom.canvas.height;
    this.gradient = this.ctx.createLinearGradient(0, h, 0, 0);
    if (this.isLightTheme) {
      this.gradient.addColorStop(0, '#0284c7');
      this.gradient.addColorStop(1, '#7c3aed');
    } else {
      this.gradient.addColorStop(0, '#38bdf8');
      this.gradient.addColorStop(1, '#a78bfa');
    }
  };

  MediaVisualizerEngine.prototype.setTheme = function(theme) {
    this.isLightTheme = (theme === 'light');
    this.initGradient();
  };

  MediaVisualizerEngine.prototype.resize = function() {
    if (!this.dom.canvas) return;
    var wrap = this.dom.canvas.parentElement;
    if (wrap && wrap.clientWidth > 0) {
      var targetW = wrap.clientWidth - 8;
      if (targetW > 60 && Math.abs(this.dom.canvas.width - targetW) > 2) {
        this.dom.canvas.width = targetW;
        this.initGradient();
      }
    }
  };

  MediaVisualizerEngine.prototype.processAudioData = function(audioArray) {
    if (!this.enabled || !audioArray) return;

    var totalEnergy = 0;
    for (var i = 0; i < 32; i++) {
      var s = this.bandRanges[i * 2];
      var e = this.bandRanges[i * 2 + 1];
      var sum = 0;
      var count = e - s;
      for (var b = s; b < e; b++) {
        var sample = (typeof audioArray[b] === 'number' && Number.isFinite(audioArray[b])) ? audioArray[b] : 0;
        sum += sample;
      }
      var avg = count > 0 ? (sum / count) : 0;
      var eq = 1.0 + (i / 31) * 0.75;
      var val = Math.min(1.0, avg * eq);
      this.rawSpectrum[i] = val;
      totalEnergy += val;
    }

    if (totalEnergy < 0.005) {
      this.silenceFrames++;
      if (this.silenceFrames > 90 && !this.isSleeping) {
      this.sleep();
    }
  } else {
    this.silenceFrames = 0;
    if (this.isSleeping) {
      this.wake();
    }
  }
};

MediaVisualizerEngine.prototype.render = function(dt) {
  if (!this.enabled || !this.ctx || !this.dom.canvas) return;

  if (this.demoMode > 0) {
    this.synthesizeDemoAudio();
  }

  if (this.isSleeping) return;

  // Ballistics: attack 0.65, decay 0.88
  var activeEnergy = 0;
  for (var i = 0; i < 32; i++) {
    var raw = this.rawSpectrum[i];
    var cur = this.dampedSpectrum[i];
    if (raw > cur) {
      cur = cur + (raw - cur) * 0.65;
    } else {
      cur = cur * 0.88;
    }
    if (cur < 0.002) cur = 0;
    this.dampedSpectrum[i] = cur;
    activeEnergy += cur;
  }

  // If energy is silent, count silence frames and enter deep sleep after 90 frames (~1.5s)
  if (activeEnergy < 0.005) {
    this.silenceFrames++;
    if (this.silenceFrames > 90) {
      this.sleep();
      return;
    }
  } else {
    this.silenceFrames = 0;
  }

  var w = this.dom.canvas.width;
  var h = this.dom.canvas.height;
  this.ctx.clearRect(0, 0, w, h);

  this.ctx.fillStyle = this.gradient;
  this.ctx.beginPath();
  var usableW = Math.max(200, w - 4);
  var step = usableW / 32;
  var gap = Math.max(1.5, step * 0.28);
  var barWidth = Math.max(2, step - gap);
  var startX = 2.0 + (usableW - (32 * step)) / 2;

  for (var j = 0; j < 32; j++) {
    var val = this.dampedSpectrum[j];
    var barH = Math.max(1.8, val * (h - 4));
    var x = startX + j * step;
    var y = h - barH;
    if (typeof this.ctx.roundRect === 'function') {
      this.ctx.roundRect(x, y, barWidth, barH, MediaVisualizerEngine.BAR_RADII);
    } else {
      this.ctx.rect(x, y, barWidth, barH);
    }
  }
  this.ctx.fill();
};

MediaVisualizerEngine.prototype.setEnabled = function(enabled) {
  this.enabled = !!enabled;
  if (!this.enabled) {
    this.sleep();
  } else {
    this.wake();
  }
};

MediaVisualizerEngine.prototype.sleep = function() {
  this.isSleeping = true;
  if (this.ctx && this.dom.canvas) {
    this.ctx.clearRect(0, 0, this.dom.canvas.width, this.dom.canvas.height);
  }
};

MediaVisualizerEngine.prototype.wake = function() {
  this.isSleeping = false;
  this.silenceFrames = 0;
};

  MediaVisualizerEngine.prototype.synthesizeDemoAudio = function() {
    var now = performance.now() * 0.001;
    var tempo = this.demoMode === 1 ? 4.2 : (this.demoMode === 2 ? 2.8 : 1.4);
    var kick = Math.pow(Math.max(0, Math.sin(now * tempo)), 6);
    var snare = Math.pow(Math.max(0, Math.cos(now * (tempo * 0.5))), 8);

    for (var b = 0; b < 128; b++) {
      var norm = b / 128;
      var val = 0;
      if (b < 12) {
        val = kick * 0.85 + Math.sin(now * 3 + b) * 0.12;
      } else if (b < 45) {
        val = (Math.sin(now * 5 + b * 0.25) * 0.5 + 0.5) * 0.55 + snare * 0.25;
      } else {
        val = (Math.sin(now * 10 + b * 0.4) * 0.5 + 0.5) * 0.35 * (1 - norm);
      }
      this.synthBuffer[b] = Math.max(0, Math.min(1.0, val));
    }
    this.processAudioData(this.synthBuffer);
  };

  MediaVisualizerEngine.prototype.cycleDemoTrack = function() {
    this.demoMode = (this.demoMode + 1) % (this.demoTracks.length + 1);
    if (this.demoMode === 0) {
      if (this.dom.badge) this.dom.badge.textContent = 'SMTC';
      if (this.dom.title) {
        this.dom.title.textContent = 'No Media Playing';
        this.dom.title.title = 'No Media Playing';
      }
      if (this.dom.artist) {
        this.dom.artist.textContent = 'Windows SMTC Idle';
        this.dom.artist.title = 'Windows SMTC Idle';
      }
      if (this.dom.art) this.dom.art.src = this.defaultArt;
      this.rawSpectrum.fill(0);
      this.dampedSpectrum.fill(0);
      this.sleep();
      console.log('[MediaVisualizerEngine] Demo mode disabled');
    } else {
      var track = this.demoTracks[this.demoMode - 1];
      if (this.dom.badge) this.dom.badge.textContent = track.badge;
      if (this.dom.title) {
        this.dom.title.textContent = track.title;
        this.dom.title.title = track.title;
      }
      if (this.dom.artist) {
        this.dom.artist.textContent = track.artist;
        this.dom.artist.title = track.artist;
      }
      if (this.dom.art) this.dom.art.src = this.defaultArt;
      this.wake();
      console.log('[MediaVisualizerEngine] Demo mode enabled: ' + track.title);
    }
  };

  MediaVisualizerEngine.prototype.handleTrackUpdate = function(data) {
    if (this.demoMode > 0) return;

    if (!data) {
      if (this.dom.title) {
        this.dom.title.textContent = 'No Media Playing';
        this.dom.title.title = 'No Media Playing';
      }
      if (this.dom.artist) {
        this.dom.artist.textContent = 'Windows SMTC Idle';
        this.dom.artist.title = 'Windows SMTC Idle';
      }
      if (this.dom.art) this.dom.art.src = this.defaultArt;
      if (this.dom.badge) this.dom.badge.textContent = 'SMTC';
      return;
    }

    var title = data.Title || data.title || '';
    var artist = data.Artist || data.artist || '';
    var albumArt = data.AlbumArt || data.albumArt || data.Thumbnail || '';

    if (title) {
      if (this.dom.title) {
        this.dom.title.textContent = title;
        this.dom.title.title = title;
      }
      if (this.dom.artist) {
        this.dom.artist.textContent = artist || 'Unknown Artist';
        this.dom.artist.title = artist || 'Unknown Artist';
      }
      if (this.dom.badge) this.dom.badge.textContent = 'SMTC';

      if (albumArt && albumArt.length > 20) {
        var src = albumArt;
        if (!src.startsWith('data:') && !src.startsWith('http') && !src.startsWith('file:')) {
          src = 'data:image/jpeg;base64,' + src;
        }
        if (this.dom.art) this.dom.art.src = src;
      } else {
        if (this.dom.art) this.dom.art.src = this.defaultArt;
      }
    } else {
      if (this.dom.title) {
        this.dom.title.textContent = 'No Media Playing';
        this.dom.title.title = 'No Media Playing';
      }
      if (this.dom.artist) {
        this.dom.artist.textContent = 'Windows SMTC Idle';
        this.dom.artist.title = 'Windows SMTC Idle';
      }
      if (this.dom.art) this.dom.art.src = this.defaultArt;
      if (this.dom.badge) this.dom.badge.textContent = 'SMTC';
    }
  };

  /**
   * ==============================================================================
   * 2. PomodoroEngine
   * Performant Pomodoro Countdown HUD State Machine & Radial Canvas Renderer
   * ==============================================================================
   */
  function PomodoroEngine(options) {
    options = options || {};
    this.dom = {
      card: options.card,
      canvas: options.canvas,
      time: options.time,
      modeLabel: options.modeLabel,
      btnToggle: options.btnToggle,
      btnReset: options.btnReset,
      pillFocus: options.pillFocus,
      pillBreak: options.pillBreak
    };

    this.focusMinutes = options.focusMinutes || 25;
    this.breakMinutes = options.breakMinutes || 5;
    this.longBreakMinutes = options.longBreakMinutes || 15;

    this.mode = 'focus';
    this.isRunning = false;
    this.totalSeconds = this.focusMinutes * 60;
    this.remainingSeconds = this.totalSeconds;
    this.completedFocusSessions = 0;
    this.timerId = null;
    this.isLightTheme = false;

    this.ctx = this.dom.canvas ? this.dom.canvas.getContext('2d') : null;

    this.bindEvents();
    this.render();
  }

  PomodoroEngine.prototype.bindEvents = function() {
    var self = this;
    if (this.dom.btnToggle && typeof this.dom.btnToggle.addEventListener === 'function') {
      this.dom.btnToggle.addEventListener('click', function() {
        self.toggle();
      });
    }
    if (this.dom.btnReset && typeof this.dom.btnReset.addEventListener === 'function') {
      this.dom.btnReset.addEventListener('click', function() {
        self.reset();
      });
    }
    if (this.dom.pillFocus && typeof this.dom.pillFocus.addEventListener === 'function') {
      this.dom.pillFocus.addEventListener('click', function() {
        self.setMode('focus');
      });
    }
    if (this.dom.pillBreak && typeof this.dom.pillBreak.addEventListener === 'function') {
      this.dom.pillBreak.addEventListener('click', function() {
        self.setMode('break');
      });
    }
  };

  PomodoroEngine.prototype.setDurations = function(focusM, breakM, longBreakM) {
    if (typeof focusM === 'number') this.focusMinutes = Math.max(1, Math.min(60, focusM));
    if (typeof breakM === 'number') this.breakMinutes = Math.max(1, Math.min(30, breakM));
    if (typeof longBreakM === 'number') this.longBreakMinutes = Math.max(1, Math.min(60, longBreakM));

    if (!this.isRunning) {
      this.reset();
    }
  };

  PomodoroEngine.prototype.setMode = function(newMode) {
    this.mode = newMode;
    if (newMode === 'focus') {
      this.totalSeconds = this.focusMinutes * 60;
      if (this.dom.modeLabel) {
        this.dom.modeLabel.textContent = 'Focus';
        if (this.dom.modeLabel.classList) this.dom.modeLabel.classList.remove('is-break');
      }
      if (this.dom.pillFocus && this.dom.pillFocus.classList) this.dom.pillFocus.classList.add('is-active');
      if (this.dom.pillBreak && this.dom.pillBreak.classList) this.dom.pillBreak.classList.remove('is-active');
    } else if (newMode === 'break') {
      this.totalSeconds = this.breakMinutes * 60;
      if (this.dom.modeLabel) {
        this.dom.modeLabel.textContent = 'Short Break';
        if (this.dom.modeLabel.classList) this.dom.modeLabel.classList.add('is-break');
      }
      if (this.dom.pillFocus && this.dom.pillFocus.classList) this.dom.pillFocus.classList.remove('is-active');
      if (this.dom.pillBreak && this.dom.pillBreak.classList) this.dom.pillBreak.classList.add('is-active');
    } else if (newMode === 'longBreak') {
      this.totalSeconds = this.longBreakMinutes * 60;
      if (this.dom.modeLabel) {
        this.dom.modeLabel.textContent = 'Long Break';
        if (this.dom.modeLabel.classList) this.dom.modeLabel.classList.add('is-break');
      }
      if (this.dom.pillFocus && this.dom.pillFocus.classList) this.dom.pillFocus.classList.remove('is-active');
      if (this.dom.pillBreak && this.dom.pillBreak.classList) this.dom.pillBreak.classList.add('is-active');
    }
    this.remainingSeconds = this.totalSeconds;
    this.pause();
    this.render();
  };

  PomodoroEngine.prototype.toggle = function() {
    if (this.isRunning) {
      this.pause();
    } else {
      this.start();
    }
  };

  PomodoroEngine.prototype.start = function() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.targetEndTime = Date.now() + (this.remainingSeconds * 1000);
    if (this.dom.btnToggle) {
      this.dom.btnToggle.textContent = 'Pause';
      if (this.dom.btnToggle.classList) this.dom.btnToggle.classList.add('is-running');
    }
    var self = this;
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(function() {
      self.tick();
    }, 1000);
    this.render();
  };

  PomodoroEngine.prototype.pause = function() {
    if (this.isRunning && this.targetEndTime) {
      this.remainingSeconds = Math.max(0, Math.ceil((this.targetEndTime - Date.now()) / 1000));
    }
    this.isRunning = false;
    this.targetEndTime = null;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.dom.btnToggle) {
      this.dom.btnToggle.textContent = 'Start';
      if (this.dom.btnToggle.classList) this.dom.btnToggle.classList.remove('is-running');
    }
  };

  PomodoroEngine.prototype.sleepTicker = function() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  };

  PomodoroEngine.prototype.resumeTicker = function() {
    if (this.isRunning && this.targetEndTime) {
      var self = this;
      if (this.timerId) clearInterval(this.timerId);
      this.timerId = setInterval(function() {
        self.tick();
      }, 1000);
      this.tick();
    }
  };

  PomodoroEngine.prototype.reset = function() {
    this.pause();
    if (this.mode === 'focus') {
      this.totalSeconds = this.focusMinutes * 60;
    } else if (this.mode === 'break') {
      this.totalSeconds = this.breakMinutes * 60;
    } else {
      this.totalSeconds = this.longBreakMinutes * 60;
    }
    this.remainingSeconds = this.totalSeconds;
    this.render();
  };

  PomodoroEngine.prototype.tick = function() {
    if (!this.isRunning || !this.targetEndTime) return;
    var now = Date.now();
    this.remainingSeconds = Math.max(0, Math.ceil((this.targetEndTime - now) / 1000));
    this.render();

    if (this.remainingSeconds <= 0) {
      this.onComplete();
    }
  };

  PomodoroEngine.prototype.onComplete = function() {
    this.pause();
    if (this.dom.card) {
      this.dom.card.style.transform = 'scale(1.02)';
      var self = this;
      setTimeout(function() {
        if (self.dom.card) self.dom.card.style.transform = '';
      }, 400);
    }

    if (this.mode === 'focus') {
      this.completedFocusSessions++;
      if (this.completedFocusSessions % 4 === 0) {
        this.setMode('longBreak');
      } else {
        this.setMode('break');
      }
    } else {
      this.setMode('focus');
    }
  };

  PomodoroEngine.prototype.render = function() {
    var m = Math.floor(this.remainingSeconds / 60);
    var s = this.remainingSeconds % 60;
    var mStr = m < 10 ? '0' + m : '' + m;
    var sStr = s < 10 ? '0' + s : '' + s;
    if (this.dom.time) {
      this.dom.time.textContent = mStr + ':' + sStr;
    }

    if (!this.ctx || !this.dom.canvas) return;
    var ctx = this.ctx;
    var cx = 44;
    var cy = 44;
    var r = 36;
    var lineWidth = 4.5;

    ctx.clearRect(0, 0, 88, 88);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = this.isLightTheme ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)';
    ctx.stroke();

    if (this.totalSeconds > 0) {
      var progress = this.remainingSeconds / this.totalSeconds;
      if (progress > 0) {
        ctx.beginPath();
        var startAngle = -Math.PI / 2;
        var endAngle = -Math.PI / 2 + (progress * 2 * Math.PI);
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';

        var grad = ctx.createLinearGradient(10, 10, 78, 78);
        if (this.mode === 'focus') {
          grad.addColorStop(0, '#10b981');
          grad.addColorStop(1, '#38bdf8');
        } else {
          grad.addColorStop(0, '#fbbf24');
          grad.addColorStop(1, '#f43f5e');
        }
        ctx.strokeStyle = grad;
        ctx.stroke();
      }
    }
  };

  PomodoroEngine.prototype.setTheme = function(theme) {
    this.isLightTheme = (theme === 'light');
    this.render();
  };

  /**
   * ==============================================================================
   * 3. SolarLightingEngine
   * macOS-Style Dynamic Solar Lighting & Directional Shadow Engine
   * ==============================================================================
   */
  function SolarLightingEngine(options) {
    options = options || {};
    this.enabled = options.enabled !== false;
    this.lastAltitude = null;
    this.lastAzimuth = null;
    this.isReset = false;
  }

  SolarLightingEngine.prototype.setEnabled = function(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) {
      if (!this.isReset) {
        this.resetStyles();
      }
    } else {
      this.isReset = false;
    }
  };

  SolarLightingEngine.prototype.update = function(now, lat, lng) {
    if (!this.enabled || !global.SunCalc) {
      if (!this.isReset) {
        this.resetStyles();
      }
      return;
    }
    this.isReset = false;

    try {
      now = now || new Date();
      var pos = global.SunCalc.getPosition(now, lat, lng);
      var alpha = pos.altitude;
      var theta = pos.azimuth;

      if (typeof alpha !== 'number' || isNaN(alpha) || typeof theta !== 'number' || isNaN(theta)) {
        return;
      }

      this.lastAltitude = alpha;
      this.lastAzimuth = theta;

      // 1. Normalized Screen Coordinates (X, Y) for the Sun
      // X = 50 + 42 * sin(theta)%, Y = 50 - 42 * sin(alpha)% (mapped smoothly into visible viewport bounds)
      var sinAlpha = Math.sin(alpha);
      var sinTheta = Math.sin(theta);
      var rawSunX = 50 + 42 * sinTheta;
      var rawSunY = 50 - 42 * sinAlpha;
      var sunX = Math.max(5, Math.min(95, rawSunX));
      var sunY = Math.max(5, Math.min(95, rawSunY));

      // 2. Solar Bloom Color Temperature, Opacity, and Size
      var bloomInner = 'rgba(254, 240, 138, 0.45)';
      var bloomOuter = 'transparent';
      var bloomOpacity = 0;
      var bloomSize = '65vmax';

      // 3. Diurnal Atmospheric Ambient Wash
      var ambientBg = 'transparent';
      var ambientOpacity = 0;
      var ambientBlend = 'soft-light';

      if (alpha > 0) {
        // Daytime / Sunrise / Sunset
        if (alpha <= 0.10) {
          // Sunrise / Sunset (alpha <= 0.10): Warm rich amber/rose bloom
          bloomInner = 'rgba(251, 146, 60, 0.65)';
          bloomOuter = 'rgba(244, 63, 94, 0.0)';
          // Sunset / Dusk: violet-crimson ambient tint
          ambientBg = 'radial-gradient(circle at ' + sunX.toFixed(1) + '% ' + sunY.toFixed(1) + '%, rgba(194, 65, 12, 0.28) 0%, rgba(136, 19, 55, 0.18) 100%)';
          ambientOpacity = 0.90;
          ambientBlend = 'soft-light';
        } else if (alpha <= 0.25) {
          // Golden Hour (0.10 < alpha <= 0.25): Radiant warm gold
          bloomInner = 'rgba(253, 224, 71, 0.55)';
          bloomOuter = 'transparent';
          // Golden Hour: soft amber gradient tint
          ambientBg = 'radial-gradient(circle at ' + sunX.toFixed(1) + '% ' + sunY.toFixed(1) + '%, rgba(245, 158, 11, 0.22) 0%, rgba(217, 119, 6, 0.10) 100%)';
          ambientOpacity = 0.85;
          ambientBlend = 'soft-light';
        } else {
          // High Noon (alpha > 0.25): Radiant white-cerulean daylight
          bloomInner = 'rgba(254, 240, 138, 0.45)';
          bloomOuter = 'transparent';
          ambientBg = 'rgba(254, 243, 199, 0.08)';
          ambientOpacity = 0.20;
          ambientBlend = 'soft-light';
        }
        // Bloom opacity scales with solar elevation: min(1.0, max(0.15, sin(alpha) * 1.2))
        bloomOpacity = Math.min(1.0, Math.max(0.15, sinAlpha * 1.2));
      } else if (alpha >= -0.10) {
        // Twilight (-0.10 <= alpha <= 0.0): cobalt indigo wash
        bloomInner = 'rgba(251, 146, 60, 0.35)';
        bloomOuter = 'rgba(244, 63, 94, 0.0)';
        bloomOpacity = Math.max(0, 0.15 * (1 + alpha / 0.10));
        ambientBg = 'linear-gradient(180deg, rgba(30, 27, 75, 0.35) 0%, rgba(15, 23, 42, 0.45) 100%)';
        ambientOpacity = 0.95;
        ambientBlend = 'soft-light';
      } else {
        // Deep Night (alpha < -0.10): Solar bloom fades to 0 opacity
        bloomOpacity = 0;
        // Deep Night: deep obsidian/slate wash with mix-blend-mode: multiply (rgba(2, 6, 23, 0.55))
        // Ambient wash deepens the wallpaper shadows while maintaining legibility
        ambientBg = 'linear-gradient(180deg, rgba(2, 6, 23, 0.55) 0%, rgba(15, 23, 42, 0.65) 100%)';
        ambientOpacity = 1.0;
        ambientBlend = 'multiply';
      }

      // 4. Directional Shadow Vectors
      var d = Math.max(6, Math.min(28, 20 * (1 - sinAlpha)));
      var dx = -Math.sin(theta) * d;
      var dy = Math.cos(theta) * d;
      var blur = Math.max(16, d * 1.8);
      var shadowOpacity = (alpha < 0) ? 0.60 : 0.45;
      var cardShadow = Math.round(dx) + 'px ' + Math.round(dy) + 'px ' + Math.round(blur) + 'px -6px rgba(0, 0, 0, ' + shadowOpacity.toFixed(2) + '), 0 20px 40px -10px rgba(0, 0, 0, 0.52)';

      // 5. Chromatic Grading Filter
      var filterStr = '';
      if (alpha > 0.20) {
        filterStr = 'brightness(1.02) contrast(1.02) saturate(1.05)';
      } else if (alpha >= 0.0) {
        filterStr = 'brightness(0.96) contrast(1.06) saturate(1.35) sepia(0.22) hue-rotate(-12deg)';
      } else if (alpha >= -0.15) {
        filterStr = 'brightness(0.82) contrast(1.10) saturate(1.15) hue-rotate(15deg)';
      } else {
        filterStr = 'brightness(0.66) contrast(1.15) saturate(0.85) hue-rotate(185deg)';
      }

      // 6. Directional Sky Vignette Shifting
      var focalX = 50 + 20 * Math.sin(theta);
      var focalY = 50 - 20 * Math.cos(theta);
      var vignetteStr = 'radial-gradient(circle at ' + focalX.toFixed(1) + '% ' + focalY.toFixed(1) + '%, transparent 35%, rgba(2, 6, 23, 0.48) 100%), linear-gradient(180deg, rgba(2, 6, 23, 0.2) 0%, transparent 40%, rgba(2, 6, 23, 0.5) 100%)';

      var elevDeg = alpha * (180 / Math.PI);

      var style = document.documentElement.style;
      // Procedural Solar Overlay CSS Custom Properties
      style.setProperty('--solar-bloom-x', sunX.toFixed(1) + '%');
      style.setProperty('--solar-bloom-y', sunY.toFixed(1) + '%');
      style.setProperty('--solar-bloom-opacity', bloomOpacity.toFixed(2));
      style.setProperty('--solar-bloom-size', bloomSize);
      style.setProperty('--solar-bloom-inner', bloomInner);
      style.setProperty('--solar-bloom-outer', bloomOuter);
      style.setProperty('--solar-ambient-wash-bg', ambientBg);
      style.setProperty('--solar-ambient-wash-opacity', ambientOpacity.toFixed(2));
      style.setProperty('--solar-ambient-wash-blend', ambientBlend);

      // Dynamic Card Elevation & Wallpaper Grading
      style.setProperty('--dynamic-card-shadow', cardShadow);
      style.setProperty('--dynamic-wallpaper-filter', filterStr);
      style.setProperty('--dynamic-vignette-gradient', vignetteStr);
      style.setProperty('--dynamic-solar-elevation', elevDeg.toFixed(1) + 'deg');

      var washEl = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('solar-ambient-wash') : null;
      if (washEl && washEl.style) {
        washEl.style.mixBlendMode = ambientBlend;
      }
    } catch (err) {
      console.warn('[SolarLightingEngine] Error updating lighting vectors:', err);
    }
  };

  SolarLightingEngine.prototype.resetStyles = function() {
    this.isReset = true;
    var style = document.documentElement.style;
    style.setProperty('--dynamic-wallpaper-filter', 'none');
    style.setProperty('--dynamic-card-shadow', '0 20px 40px -10px rgba(0, 0, 0, 0.52)');
    style.setProperty('--dynamic-vignette-gradient', 'radial-gradient(circle at center, transparent 40%, rgba(2, 6, 23, 0.45) 100%), linear-gradient(180deg, rgba(2, 6, 23, 0.2) 0%, transparent 40%, rgba(2, 6, 23, 0.5) 100%)');
    style.setProperty('--dynamic-solar-elevation', '0deg');
    style.setProperty('--solar-bloom-x', '50%');
    style.setProperty('--solar-bloom-y', '50%');
    style.setProperty('--solar-bloom-opacity', '0');
    style.setProperty('--solar-bloom-size', '65vmax');
    style.setProperty('--solar-bloom-inner', 'rgba(254, 240, 138, 0.45)');
    style.setProperty('--solar-bloom-outer', 'transparent');
    style.setProperty('--solar-ambient-wash-bg', 'transparent');
    style.setProperty('--solar-ambient-wash-opacity', '0');
    style.setProperty('--solar-ambient-wash-blend', 'soft-light');

    var washEl = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('solar-ambient-wash') : null;
    if (washEl && washEl.style) {
      washEl.style.mixBlendMode = 'soft-light';
    }
  };

  /**
   * ==============================================================================
   * 4. SvgSparklineEngine
   * Zero-Allocation 40-Point Vector SVG Sparkline Engine
   * ==============================================================================
   * Generates smooth Catmull-Rom cubic Bezier curves across sliding-window
   * Float32Array ring buffers with pre-calculated coordinate mappings and
   * zero garbage collection overhead.
   */
  function SvgSparklineEngine(options) {
    options = options || {};
    this.pointsCount = 40;
    this.width = options.width || 80;
    this.height = options.height || 20;
    this.dx = this.width / (this.pointsCount - 1); // 80 / 39 = 2.051282...

    // Pre-allocated static x coordinates for 40 points
    this.staticX = new Float32Array(this.pointsCount);
    this.staticCp1X = new Float32Array(this.pointsCount - 1);
    this.staticCp2X = new Float32Array(this.pointsCount - 1);

    for (var i = 0; i < this.pointsCount; i++) {
      this.staticX[i] = i * this.dx;
    }
    for (var j = 0; j < this.pointsCount - 1; j++) {
      if (j === 0) {
        this.staticCp1X[j] = this.staticX[0] + this.dx / 6;
      } else {
        this.staticCp1X[j] = this.staticX[j] + this.dx / 3;
      }
      if (j === this.pointsCount - 2) {
        this.staticCp2X[j] = this.staticX[this.pointsCount - 1] - this.dx / 6;
      } else {
        this.staticCp2X[j] = this.staticX[j + 1] - this.dx / 3;
      }
    }

    this.yCoords = new Float32Array(this.pointsCount);
    this.tracks = {};
  }

  SvgSparklineEngine.prototype.register = function(id, svgEl, config) {
    var track = {
      id: id,
      svg: svgEl,
      linePath: null,
      areaPath: null,
      max: (config && config.max) || 100,
      dynamicMax: (config && config.dynamicMax) || false,
      accent: (config && config.accent) || '#38bdf8'
    };

    if (svgEl) {
      if (svgEl.querySelector) {
        track.areaPath = svgEl.querySelector('.spark-area');
        track.linePath = svgEl.querySelector('.spark-line');
      }
      if (!track.linePath && svgEl.getElementsByTagName) {
        var paths = svgEl.getElementsByTagName('path');
        if (paths.length >= 2) {
          track.areaPath = paths[0];
          track.linePath = paths[1];
        }
      }
    }

    this.tracks[id] = track;
    return track;
  };

  SvgSparklineEngine.prototype.generatePaths = function(buffer, maxVal) {
    var N = this.pointsCount;
    var max = typeof maxVal === 'number' && maxVal > 0 ? maxVal : 100;

    for (var i = 0; i < N; i++) {
      var v = (buffer && typeof buffer[i] === 'number' && Number.isFinite(buffer[i])) ? buffer[i] : 0;
      var norm = (max > 0) ? (v / max) : 0;
      if (!Number.isFinite(norm) || norm < 0) norm = 0;
      else if (norm > 1) norm = 1;
      this.yCoords[i] = 18 - norm * 16;
    }

    var curveD = '';
    for (var j = 0; j < N - 1; j++) {
      var p0y = (j === 0) ? this.yCoords[0] : this.yCoords[j - 1];
      var p1y = this.yCoords[j];
      var p2y = this.yCoords[j + 1];
      var p3y = (j >= N - 2) ? this.yCoords[N - 1] : this.yCoords[j + 2];

      var cp1y = (j === 0) ? (p1y + (p2y - p1y) / 6) : (p1y + (p2y - p0y) / 6);
      var cp2y = (j >= N - 2) ? (p2y - (p2y - p1y) / 6) : (p2y - (p3y - p1y) / 6);

      if (!Number.isFinite(cp1y)) cp1y = 18;
      if (!Number.isFinite(cp2y)) cp2y = 18;
      if (cp1y < 1.5) cp1y = 1.5; else if (cp1y > 18.5) cp1y = 18.5;
      if (cp2y < 1.5) cp2y = 1.5; else if (cp2y > 18.5) cp2y = 18.5;

      curveD += ' C ' + this.staticCp1X[j].toFixed(1) + ',' + cp1y.toFixed(1) + ' ' +
                this.staticCp2X[j].toFixed(1) + ',' + cp2y.toFixed(1) + ' ' +
                this.staticX[j + 1].toFixed(1) + ',' + p2y.toFixed(1);
    }

    var y0 = this.yCoords[0].toFixed(1);
    var lineD = 'M 0,' + y0 + curveD;
    var areaD = 'M 0,18 L 0,' + y0 + curveD + ' L 80,18 Z';

    return { lineD: lineD, areaD: areaD };
  };

  SvgSparklineEngine.prototype.render = function(id, buffer, customMax) {
    var track = this.tracks[id];
    var max = customMax;
    if (!max) {
      if (track && track.dynamicMax) {
        var peak = 0;
        for (var k = 0; k < buffer.length; k++) {
          if (buffer[k] > peak) peak = buffer[k];
        }
        max = Math.max(track.max, peak * 1.15);
      } else {
        max = (track && track.max) || 100;
      }
    }

    var paths = this.generatePaths(buffer, max);

    if (track) {
      if (track.linePath && typeof track.linePath.setAttribute === 'function') {
        track.linePath.setAttribute('d', paths.lineD);
      }
      if (track.areaPath && typeof track.areaPath.setAttribute === 'function') {
        track.areaPath.setAttribute('d', paths.areaD);
      }
    }

    return paths;
  };

  /**
   * ==============================================================================
   * 5. SvgForecastChartEngine
   * Google-Style Space-Efficient Multi-Tab SVG Forecast Chart Engine
   * ==============================================================================
   * Features:
   *  - Zero-reflow layout containment (contain: layout paint;)
   *  - Catmull-Rom cubic Bezier vector curves across 24-hour forecast telemetry
   *  - 5 switchable metric modes: Temperature, Precipitation, Wind, Humidity, AQI
   *  - Zero GC allocation: pre-allocates and mutates SVG element pools
   */
  function SvgForecastChartEngine(options) {
    options = options || {};
    this.dom = {
      card: options.card,
      tabBar: options.tabBar,
      tabs: options.tabs || [],
      svg: options.svg,
      linePath: options.linePath,
      areaPath: options.areaPath,
      pointsGroup: options.pointsGroup,
      xAxisGroup: options.xAxisGroup
    };

    this.tempUnit = options.tempUnit || 'C';
    this.activeTab = options.defaultTab || 'temp';
    if (this.activeTab === 'Feels Like') this.activeTab = 'feels_like';
    this.points = [];

    // Pre-allocated DOM element caches
    this.dotPool = [];
    this.valLabelPool = [];
    this.timeLabelPool = [];

    // Pre-allocated typed coordinate buffers (zero GC allocations per frame/render)
    this.xs = new Float32Array(32);
    this.ys = new Float32Array(32);

    this.colorMap = {
      temp: { stroke: '#f59e0b', fill: 'url(#forecast-grad-temp)', dot: '#fbbf24' },
      feels_like: { stroke: '#fb923c', fill: 'url(#forecast-grad-feels)', dot: '#fb923c' },
      precip: { stroke: '#38bdf8', fill: 'url(#forecast-grad-precip)', dot: '#38bdf8' },
      wind: { stroke: '#34d399', fill: 'url(#forecast-grad-wind)', dot: '#34d399' },
      humidity: { stroke: '#a78bfa', fill: 'url(#forecast-grad-humidity)', dot: '#c084fc' },
      aqi: { stroke: '#10b981', fill: 'url(#forecast-grad-aqi)', dot: '#10b981' }
    };

    this.init();
  }

  SvgForecastChartEngine.prototype.init = function() {
    var self = this;
    if (this.dom.tabs && this.dom.tabs.length) {
      for (var i = 0; i < this.dom.tabs.length; i++) {
        var btn = this.dom.tabs[i];
        var tab = btn.getAttribute('data-tab') || 'temp';
        var isActive = (tab === this.activeTab);
        btn.setAttribute('tabindex', isActive ? '0' : '-1');
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');

        (function(index, tabBtn) {
          tabBtn.addEventListener('click', function() {
            var targetTab = tabBtn.getAttribute('data-tab') || 'temp';
            self.setTab(targetTab);
          });

          tabBtn.addEventListener('keydown', function(e) {
            var count = self.dom.tabs.length;
            var newIndex = -1;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              if (e.preventDefault) e.preventDefault();
              newIndex = (index + 1) % count;
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              if (e.preventDefault) e.preventDefault();
              newIndex = (index - 1 + count) % count;
            } else if (e.key === 'Home') {
              if (e.preventDefault) e.preventDefault();
              newIndex = 0;
            } else if (e.key === 'End') {
              if (e.preventDefault) e.preventDefault();
              newIndex = count - 1;
            }
            if (newIndex >= 0 && newIndex !== index) {
              var nextBtn = self.dom.tabs[newIndex];
              var targetTab = nextBtn.getAttribute('data-tab') || 'temp';
              self.setTab(targetTab);
              if (typeof nextBtn.focus === 'function') {
                nextBtn.focus();
              }
            }
          });
        })(i, btn);
      }
    }
  };

  SvgForecastChartEngine.prototype.setTab = function(tabName) {
    if (!tabName) return;
    this.activeTab = tabName;
    if (this.dom.tabs && this.dom.tabs.length) {
      for (var i = 0; i < this.dom.tabs.length; i++) {
        var btn = this.dom.tabs[i];
        var isThis = (btn.getAttribute('data-tab') === tabName);
        if (isThis) {
          btn.classList.add('is-active');
          btn.setAttribute('aria-selected', 'true');
          btn.setAttribute('tabindex', '0');
        } else {
          btn.classList.remove('is-active');
          btn.setAttribute('aria-selected', 'false');
          btn.setAttribute('tabindex', '-1');
        }
      }
    }
    this.render();
  };

  SvgForecastChartEngine.prototype.setTempUnit = function(unit) {
    this.tempUnit = (unit === 'F') ? 'F' : 'C';
    this.render();
  };

  SvgForecastChartEngine.prototype.setForecast = function(points) {
    this.points = Array.isArray(points) ? points : [];
    this.render();
  };

  SvgForecastChartEngine.prototype.ensureElementPool = function(count) {
    var svgNS = 'http://www.w3.org/2000/svg';
    if (!this.dom.pointsGroup || !this.dom.xAxisGroup) return;

    // Dots
    while (this.dotPool.length < count) {
      var dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('r', '3');
      dot.setAttribute('class', 'forecast-dot');
      this.dom.pointsGroup.appendChild(dot);
      this.dotPool.push(dot);
    }
    // Value labels
    while (this.valLabelPool.length < count) {
      var valText = document.createElementNS(svgNS, 'text');
      valText.setAttribute('class', 'forecast-val-label');
      this.dom.pointsGroup.appendChild(valText);
      this.valLabelPool.push(valText);
    }
    // Time labels
    while (this.timeLabelPool.length < count) {
      var timeText = document.createElementNS(svgNS, 'text');
      timeText.setAttribute('class', 'forecast-time-label');
      this.dom.xAxisGroup.appendChild(timeText);
      this.timeLabelPool.push(timeText);
    }

    // Toggle visibility for pool items beyond count
    for (var i = 0; i < this.dotPool.length; i++) {
      var vis = (i < count) ? 'visible' : 'hidden';
      this.dotPool[i].style.visibility = vis;
      this.valLabelPool[i].style.visibility = vis;
      this.timeLabelPool[i].style.visibility = vis;
    }
  };

  SvgForecastChartEngine.prototype.computeBounds = function(tab) {
    var pts = this.points || [];
    var minVal = Infinity;
    var maxVal = -Infinity;
    var isF = (this.tempUnit === 'F');

    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (!p) continue;
      var v = NaN;
      if (tab === 'temp') v = isF ? p.tempF : p.tempC;
      else if (tab === 'feels_like') v = isF ? p.apparentF : p.apparentC;
      else if (tab === 'precip') v = p.precipProb != null ? p.precipProb : 0;
      else if (tab === 'wind') v = isF ? p.windSpeedMph : p.windSpeedKm;
      else if (tab === 'humidity') v = p.humidity != null ? p.humidity : 50;
      else if (tab === 'aqi') v = p.aqi != null ? p.aqi : 20;

      if (typeof v !== 'number' || !Number.isFinite(v)) {
        continue;
      }

      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }

    if (!Number.isFinite(minVal) || !Number.isFinite(maxVal) || minVal === Infinity || maxVal === -Infinity) {
      return { min: 0, max: 100 };
    }

    if (tab === 'temp' || tab === 'feels_like') {
      var range = Math.max(2, maxVal - minVal);
      return {
        min: minVal - range * 0.25,
        max: maxVal + range * 0.25
      };
    } else if (tab === 'precip') {
      return {
        min: 0,
        max: Math.max(50, Math.min(100, Math.max(10, maxVal * 1.25)))
      };
    } else if (tab === 'wind') {
      return {
        min: 0,
        max: Math.max(15, maxVal * 1.25)
      };
    } else if (tab === 'humidity') {
      return {
        min: Math.max(0, minVal - 12),
        max: Math.min(100, maxVal + 12)
      };
    } else if (tab === 'aqi') {
      return {
        min: 0,
        max: Math.max(40, maxVal * 1.25)
      };
    }
    return { min: 0, max: 100 };
  };

  SvgForecastChartEngine.prototype.render = function() {
    if (!this.dom.svg || !this.points || !this.points.length) return;

    var pts = this.points;
    var N = pts.length;
    this.ensureElementPool(N);

    var tab = this.activeTab || 'temp';
    var bounds = this.computeBounds(tab);
    var minB = bounds.min;
    var maxB = bounds.max;
    var range = (maxB - minB) || 1;

    // Coordinate system: viewBox="0 0 520 120"
    var xStart = 26;
    var xEnd = 494;
    var dx = (N > 1) ? ((xEnd - xStart) / (N - 1)) : 0;
    var yTop = 26;
    var yBottom = 88;
    var yBase = 95;
    var isF = (this.tempUnit === 'F');

    if (N > this.xs.length) {
      this.xs = new Float32Array(N);
      this.ys = new Float32Array(N);
    }
    var xs = this.xs;
    var ys = this.ys;
    var colors = this.colorMap[tab] || this.colorMap.temp;

    for (var i = 0; i < N; i++) {
      var p = pts[i] || {};
      var v = 0;
      var label = '';
      if (tab === 'temp') {
        v = isF ? p.tempF : p.tempC;
        if (typeof v !== 'number' || !Number.isFinite(v)) v = minB;
        label = Math.round(v) + '°';
      } else if (tab === 'feels_like') {
        v = isF ? p.apparentF : p.apparentC;
        if (typeof v !== 'number' || !Number.isFinite(v)) v = minB;
        label = Math.round(v) + '°';
      } else if (tab === 'precip') {
        v = p.precipProb != null ? p.precipProb : 0;
        if (typeof v !== 'number' || !Number.isFinite(v)) v = 0;
        label = Math.round(v) + '%';
      } else if (tab === 'wind') {
        v = isF ? p.windSpeedMph : p.windSpeedKm;
        if (typeof v !== 'number' || !Number.isFinite(v)) v = 0;
        label = Math.round(v) + (isF ? ' mph' : ' km/h');
      } else if (tab === 'humidity') {
        v = p.humidity != null ? p.humidity : 50;
        if (typeof v !== 'number' || !Number.isFinite(v)) v = 50;
        label = Math.round(v) + '%';
      } else if (tab === 'aqi') {
        v = p.aqi != null ? p.aqi : 20;
        if (typeof v !== 'number' || !Number.isFinite(v)) v = 20;
        label = 'AQI ' + Math.round(v);
      }

      var norm = (range > 0) ? Math.max(0, Math.min(1, (v - minB) / range)) : 0.5;
      if (!Number.isFinite(norm)) norm = 0.5;
      var xVal = xStart + i * dx;
      var yVal = yBottom - norm * (yBottom - yTop);
      xs[i] = Number.isFinite(xVal) ? xVal : xStart;
      ys[i] = Number.isFinite(yVal) ? yVal : yBottom;

      var dotColor = colors.dot;
      if (tab === 'aqi' && p.aqiColor) {
        dotColor = p.aqiColor;
      }

      // Update dot
      var dot = this.dotPool[i];
      if (dot) {
        dot.setAttribute('cx', xs[i].toFixed(1));
        dot.setAttribute('cy', ys[i].toFixed(1));
        dot.setAttribute('fill', dotColor);
      }

      // Update val text
      var valEl = this.valLabelPool[i];
      if (valEl) {
        valEl.setAttribute('x', xs[i].toFixed(1));
        valEl.setAttribute('y', (ys[i] - 7).toFixed(1));
        valEl.textContent = label;
      }

      // Update time text
      var timeEl = this.timeLabelPool[i];
      if (timeEl) {
        timeEl.setAttribute('x', xs[i].toFixed(1));
        timeEl.setAttribute('y', '112');
        timeEl.textContent = p.label || p.time || '';
      }
    }

    // Catmull-Rom cubic Bezier path generation
    var curveD = '';
    for (var j = 0; j < N - 1; j++) {
      var p0x = (j === 0) ? xs[0] : xs[j - 1];
      var p0y = (j === 0) ? ys[0] : ys[j - 1];
      var p1x = xs[j];
      var p1y = ys[j];
      var p2x = xs[j + 1];
      var p2y = ys[j + 1];
      var p3x = (j >= N - 2) ? xs[N - 1] : xs[j + 2];
      var p3y = (j >= N - 2) ? ys[N - 1] : ys[j + 2];

      var cp1x = (j === 0) ? (p1x + (p2x - p1x) / 6) : (p1x + (p2x - p0x) / 6);
      var cp1y = (j === 0) ? (p1y + (p2y - p1y) / 6) : (p1y + (p2y - p0y) / 6);
      var cp2x = (j >= N - 2) ? (p2x - (p2x - p1x) / 6) : (p2x - (p3x - p1x) / 6);
      var cp2y = (j >= N - 2) ? (p2y - (p2y - p1y) / 6) : (p2y - (p3y - p1y) / 6);

      if (!Number.isFinite(cp1x)) cp1x = p1x;
      if (!Number.isFinite(cp1y)) cp1y = p1y;
      if (!Number.isFinite(cp2x)) cp2x = p2x;
      if (!Number.isFinite(cp2y)) cp2y = p2y;

      if (cp1y < yTop - 4) cp1y = yTop - 4; else if (cp1y > yBottom + 4) cp1y = yBottom + 4;
      if (cp2y < yTop - 4) cp2y = yTop - 4; else if (cp2y > yBottom + 4) cp2y = yBottom + 4;

      curveD += ' C ' + cp1x.toFixed(1) + ',' + cp1y.toFixed(1) + ' ' +
                cp2x.toFixed(1) + ',' + cp2y.toFixed(1) + ' ' +
                p2x.toFixed(1) + ',' + p2y.toFixed(1);
    }

    var x0 = xs[0].toFixed(1);
    var y0 = ys[0].toFixed(1);
    var xLast = xs[N - 1].toFixed(1);
    var lineD = 'M ' + x0 + ',' + y0 + curveD;
    var areaD = 'M ' + x0 + ',' + yBase + ' L ' + x0 + ',' + y0 + curveD + ' L ' + xLast + ',' + yBase + ' Z';

    if (this.dom.linePath) {
      this.dom.linePath.setAttribute('d', lineD);
      this.dom.linePath.setAttribute('stroke', colors.stroke);
    }
    if (this.dom.areaPath) {
      this.dom.areaPath.setAttribute('d', areaD);
      this.dom.areaPath.setAttribute('fill', colors.fill);
    }
  };

  global.SvgForecastChartEngine = SvgForecastChartEngine;

  var App = {
    // Engine references
    particles: null,
    sky: null,
    mediaVisualizer: null,
    pomodoro: null,
    solarLighting: null,
    sparklineEngine: null,
    forecastChart: null,

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
    pendingSnapshot: null,
    syncPending: false,
    syncPendingForce: false,

    // Text-Track Unicode Sparkline Characters (8 levels - fallback legacy)
    SPARK_BLOCKS: [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'],

    // Hardware Telemetry Ring Buffers (40 samples each via Float32Array for zero-allocation charts)
    hwCpuHistory: new Float32Array(40),
    hwGpuHistory: new Float32Array(40),
    hwRamHistory: new Float32Array(40),
    hwDiskHistory: new Float32Array(40),
    hwNetDownHistory: new Float32Array(40),
    hwNetUpHistory: new Float32Array(40),

    lastHwUpdate: 0,
    lastFallbackHwTick: 0,
    hwFallbackTimer: null,
    simulatedCpuLoad: 24,
    simulatedGpuLoad: 16,
    simulatedRamUsed: 14.2,
    simulatedRamTotal: 32.0,
    simulatedDiskPct: 28,
    simulatedNetDown: 14500, // in Kbps (~14.5 Mbps)
    simulatedNetUp: 3200,   // in Kbps (~3.2 Mbps)

    // Laptop Battery Telemetry Guard & State
    hasPhysicalBattery: false,
    batteryCorroborated: false,
    batteryManager: null,
    lastBatteryPct: 100,
    lastBatteryCharging: false,

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

    // Feature Customization Component Toggles
    showNewsFeed: true,
    showHardwareMonitor: true,
    showNetworkUsage: true,
    showBatteryInfo: true,
    showCelestial: true,
    showAqi: true,
    showEnvironmentalMetrics: true,
    showForecastChart: true,
    showPomodoro: true,
    showMediaPlayer: true,
    showMediaFocusDock: true,

    // DOM Elements Cache
    dom: {},

    init: function() {
      console.log('[App] Initializing Local Wally HUD...');
      this.cacheDom();
      this.restoreCachedWallpaper();
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

      // Feature customization component toggles
      this.setShowNewsFeed(typeof cfg.showNewsFeed !== 'undefined' ? cfg.showNewsFeed : true);
      this.setShowHardwareMonitor(typeof cfg.showHardwareMonitor !== 'undefined' ? cfg.showHardwareMonitor : true);
      this.setShowNetworkUsage(typeof cfg.showNetworkUsage !== 'undefined' ? cfg.showNetworkUsage : true);
      this.setShowBatteryInfo(typeof cfg.showBatteryInfo !== 'undefined' ? cfg.showBatteryInfo : true);
      this.setShowCelestial(typeof cfg.showCelestial !== 'undefined' ? cfg.showCelestial : true);
      this.setShowAqi(typeof cfg.showAqi !== 'undefined' ? cfg.showAqi : true);
      this.setShowEnvironmentalMetrics(typeof cfg.showEnvironmentalMetrics !== 'undefined' ? cfg.showEnvironmentalMetrics : true);
      this.setShowForecastChart(typeof cfg.showForecastChart !== 'undefined' ? cfg.showForecastChart : true);
      this.setShowPomodoro(typeof cfg.showPomodoro !== 'undefined' ? cfg.showPomodoro : true);
      this.setShowMediaPlayer(typeof cfg.showMediaPlayer !== 'undefined' ? cfg.showMediaPlayer : true);

      if (cfg.defaultForecastTab && this.forecastChart) {
        this.forecastChart.setTab(cfg.defaultForecastTab);
      }

      if (typeof cfg.showMediaFocusDock !== 'undefined') {
        this.setShowMediaFocusDock(cfg.showMediaFocusDock);
      } else {
        this.setShowMediaFocusDock(true);
      }

      this.updateLayoutAutoResize();

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
        hudColPrimary: document.querySelector('.bento-col-primary'),
        hudColSecondary: document.querySelector('.bento-col-secondary'),
        hudClock: document.getElementById('hud-clock'),
        hudDate: document.getElementById('hud-date'),
        hudLocationText: document.getElementById('hud-location-text'),
        hudTempVal: document.getElementById('hud-temp-val'),
        hudTempUnit: document.getElementById('hud-temp-unit'),
        hudCondition: document.getElementById('hud-condition'),
        hudFeelsLike: document.getElementById('hud-feels-like'),
        hudTempHigh: document.getElementById('hud-temp-high'),
        hudTempLow: document.getElementById('hud-temp-low'),
        hudMetricsRow: document.getElementById('hud-metrics-row'),
        metricHumidity: document.getElementById('metric-humidity'),
        metricWind: document.getElementById('metric-wind'),
        metricPrecip: document.getElementById('metric-precip'),
        hudEphemerisCard: document.getElementById('hud-ephemeris-card'),
        ephemerisSunrise: document.getElementById('ephemeris-sunrise'),
        ephemerisNoon: document.getElementById('ephemeris-noon'),
        ephemerisSunset: document.getElementById('ephemeris-sunset'),
        ephemerisMoonGlyph: document.getElementById('ephemeris-moon-glyph'),
        ephemerisMoonPhase: document.getElementById('ephemeris-moon-phase'),
        ephemerisMoonIllum: document.getElementById('ephemeris-moon-illum'),
        hudAqiCard: document.getElementById('hud-aqi-card'),
        hudAqiBadge: document.getElementById('hud-aqi-badge'),
        hudAqiCategory: document.getElementById('hud-aqi-category'),
        hudAqiFill: document.getElementById('hud-aqi-fill'),
        hudPm25: document.getElementById('hud-pm25'),
        hudPm10: document.getElementById('hud-pm10'),

        // Google-Style Multi-Tab SVG Forecast Chart DOM Nodes
        hudForecastCard: document.getElementById('hud-forecast-card'),
        forecastTabBar: (document.querySelector && document.querySelector('.forecast-tab-bar')) || null,
        forecastTabs: (document.querySelectorAll) ? document.querySelectorAll('.forecast-tab') : [],
        forecastChartContainer: document.getElementById('forecast-chart-container'),
        forecastSvg: document.getElementById('forecast-svg'),
        forecastLine: document.getElementById('forecast-line'),
        forecastArea: document.getElementById('forecast-area'),
        forecastPoints: document.getElementById('forecast-points'),
        forecastXAxis: document.getElementById('forecast-x-axis'),

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
        hudHwBlock: document.getElementById('hud-hw-block'),
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

        // Network Bandwidth DOM Nodes
        hwNetDownRow: document.getElementById('hw-net-down-row'),
        hwNetDownName: document.getElementById('hw-net-down-name'),
        hwNetDownSpark: document.getElementById('hw-net-down-spark'),
        hwNetDownVal: document.getElementById('hw-net-down-val'),
        hwNetDownBar: document.getElementById('hw-net-down-bar'),
        hwNetUpRow: document.getElementById('hw-net-up-row'),
        hwNetUpName: document.getElementById('hw-net-up-name'),
        hwNetUpSpark: document.getElementById('hw-net-up-spark'),
        hwNetUpVal: document.getElementById('hw-net-up-val'),
        hwNetUpBar: document.getElementById('hw-net-up-bar'),

        // Laptop Battery DOM Nodes
        hwBatteryRow: document.getElementById('hw-battery-row'),
        hwBatteryStatus: document.getElementById('hw-battery-status'),
        hwBatteryIcon: document.getElementById('hw-battery-icon'),
        hwBatteryVal: document.getElementById('hw-battery-val'),
        hwBatteryBar: document.getElementById('hw-battery-bar'),

        // Regional News DOM Nodes
        hudNewsBlock: document.getElementById('hud-news-block'),
        hudNewsLink: document.getElementById('hud-news-link'),
        hudNewsHeadline: document.getElementById('hud-news-headline'),
        hudNewsSource: document.getElementById('hud-news-source'),
        hudNewsDots: document.getElementById('hud-news-dots'),

        // Companion Media & Focus Bento Dock DOM Nodes
        dockMediaFocus: document.getElementById('dock-media-focus'),
        pomodoroCard: document.getElementById('pomodoro-card'),
        pomodoroCanvas: document.getElementById('pomodoro-canvas'),
        pomodoroTime: document.getElementById('pomodoro-time'),
        pomoModeLabel: document.getElementById('pomo-mode-label'),
        pomoBtnToggle: document.getElementById('pomo-btn-toggle'),
        pomoBtnReset: document.getElementById('pomo-btn-reset'),
        pomoPillFocus: document.getElementById('pomo-pill-focus'),
        pomoPillBreak: document.getElementById('pomo-pill-break'),

        mediaCard: document.getElementById('media-card'),
        mediaArt: document.getElementById('media-art'),
        mediaTitle: document.getElementById('media-title'),
        mediaArtist: document.getElementById('media-artist'),
        mediaSourceBadge: document.getElementById('media-source-badge'),
        audioVisualizerCanvas: document.getElementById('audio-visualizer-canvas'),

        // Procedural Solar Lighting Overlay DOM Nodes
        solarLightingOverlay: document.getElementById('solar-lighting-overlay'),
        solarLightBloom: document.getElementById('solar-light-bloom'),
        solarAmbientWash: document.getElementById('solar-ambient-wash')
      };
    },

    restoreCachedWallpaper: function() {
      try {
        var cachedUrl = null;
        var cachedPhotographer = null;
        var cachedPhotographerUrl = null;

        if (typeof localStorage !== 'undefined') {
          cachedUrl = localStorage.getItem('local_wally_cached_bg_url');
          cachedPhotographer = localStorage.getItem('local_wally_cached_bg_photographer');
          cachedPhotographerUrl = localStorage.getItem('local_wally_cached_bg_photographer_url');
        }

        // Secondary fallback to LIVELY_HUD_SNAPSHOT if specific key is not yet populated
        if (!cachedUrl && global.CacheManager) {
          var snapshot = global.CacheManager.getAny();
          if (snapshot && snapshot.background && snapshot.background.url) {
            cachedUrl = snapshot.background.url;
            cachedPhotographer = snapshot.background.photographer;
            cachedPhotographerUrl = snapshot.background.photographerUrl;
          }
        }

        if (cachedUrl && this.dom.bgA) {
          this.dom.bgA.style.backgroundImage = 'url("' + cachedUrl + '")';
          this.lastBgUrl = cachedUrl;
          if (this.dom.unsplashCredit && cachedPhotographer) {
            this.dom.unsplashCredit.textContent = 'Photo by ' + cachedPhotographer;
            if (cachedPhotographerUrl) {
              this.dom.unsplashCredit.href = cachedPhotographerUrl;
            }
          }
          console.log('[App] Restored cached wallpaper instantly on boot (no pop-in)');
        }
      } catch (err) {
        console.warn('[App] Could not restore cached wallpaper on boot:', err);
      }
    },

    initEngines: function() {
      if (global.ParticleEngine && this.dom.particleCanvas) {
        this.particles = new global.ParticleEngine(this.dom.particleCanvas);
      }
      if (global.SkyEngine && this.dom.skyBackdrop) {
        this.sky = new global.SkyEngine(this.dom.skyBackdrop, this.dom.celestialContainer);
      }

      var SparkCtor = (typeof SvgSparklineEngine === 'function') ? SvgSparklineEngine : global.SvgSparklineEngine;
      if (SparkCtor) {
        this.sparklineEngine = new SparkCtor();
        this.sparklineEngine.register('cpu', this.dom.hwCpuSpark, { max: 100, accent: '#38bdf8' });
        this.sparklineEngine.register('gpu', this.dom.hwGpuSpark, { max: 100, accent: '#34d399' });
        this.sparklineEngine.register('ram', this.dom.hwRamSpark, { max: 100, accent: '#a78bfa' });
        this.sparklineEngine.register('disk', this.dom.hwDiskSpark, { max: 100, accent: '#fbbf24' });
        this.sparklineEngine.register('netDown', this.dom.hwNetDownSpark, { max: 1000, dynamicMax: true, accent: '#38bdf8' });
        this.sparklineEngine.register('netUp', this.dom.hwNetUpSpark, { max: 500, dynamicMax: true, accent: '#fb7185' });
      }

      var ForecastCtor = (typeof SvgForecastChartEngine === 'function') ? SvgForecastChartEngine : global.SvgForecastChartEngine;
      if (ForecastCtor && this.dom.forecastSvg) {
        var cfgInit = (global.LOCAL_WALLY_CONFIG) || {};
        this.forecastChart = new ForecastCtor({
          card: this.dom.hudForecastCard,
          tabBar: this.dom.forecastTabBar,
          tabs: this.dom.forecastTabs,
          svg: this.dom.forecastSvg,
          linePath: this.dom.forecastLine,
          areaPath: this.dom.forecastArea,
          pointsGroup: this.dom.forecastPoints,
          xAxisGroup: this.dom.forecastXAxis,
          tempUnit: this.tempUnit,
          defaultTab: cfgInit.defaultForecastTab || 'temp'
        });
      }

      this.initBatteryMonitor();

      var cfg = (global.LOCAL_WALLY_CONFIG) || {};

      if (this.dom.audioVisualizerCanvas) {
        this.mediaVisualizer = new MediaVisualizerEngine({
          card: this.dom.mediaCard,
          art: this.dom.mediaArt,
          title: this.dom.mediaTitle,
          artist: this.dom.mediaArtist,
          badge: this.dom.mediaSourceBadge,
          canvas: this.dom.audioVisualizerCanvas,
          enabled: cfg.enableAudioVisualizer !== false
        });
      }

      if (this.dom.pomodoroCanvas) {
        this.pomodoro = new PomodoroEngine({
          card: this.dom.pomodoroCard,
          canvas: this.dom.pomodoroCanvas,
          time: this.dom.pomodoroTime,
          modeLabel: this.dom.pomoModeLabel,
          btnToggle: this.dom.pomoBtnToggle,
          btnReset: this.dom.pomoBtnReset,
          pillFocus: this.dom.pomoPillFocus,
          pillBreak: this.dom.pomoPillBreak,
          focusMinutes: cfg.pomodoroFocusMinutes || 25,
          breakMinutes: cfg.pomodoroBreakMinutes || 5,
          longBreakMinutes: cfg.pomodoroLongBreakMinutes || 15
        });
      }

      this.solarLighting = new SolarLightingEngine({
        enabled: cfg.enableDynamicSolarLighting !== false
      });
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
        self.updateLayoutAutoResize();
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
        } else if (e.key === 'm' || e.key === 'M') {
          if (self.mediaVisualizer) self.mediaVisualizer.cycleDemoTrack();
        } else if (e.key === 'p' || e.key === 'P') {
          if (self.pomodoro) self.pomodoro.toggle();
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
          if (self.pomodoro) self.pomodoro.sleepTicker();
          if (self.mediaVisualizer) self.mediaVisualizer.sleep();
        } else {
          self.startLoop();
          if (self.pendingSnapshot) {
            var snap = self.pendingSnapshot;
            self.pendingSnapshot = null;
            self.renderAll(snap);
          }
          if (self.pomodoro && self.showPomodoro) self.pomodoro.resumeTicker();
          if (self.mediaVisualizer && (self.mediaVisualizer.demoMode > 0 || self.showMediaPlayer)) {
            self.mediaVisualizer.wake();
          }
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
          case 'showMediaFocusDock':
            self.setShowMediaFocusDock(val === true || val === 1 || val === 'true');
            break;
          case 'showNewsFeed':
            self.setShowNewsFeed(val === true || val === 1 || val === 'true');
            break;
          case 'showHardwareMonitor':
            self.setShowHardwareMonitor(val === true || val === 1 || val === 'true');
            break;
          case 'showNetworkUsage':
            self.setShowNetworkUsage(val === true || val === 1 || val === 'true');
            break;
          case 'showBatteryInfo':
            self.setShowBatteryInfo(val === true || val === 1 || val === 'true');
            break;
          case 'showCelestial':
            self.setShowCelestial(val === true || val === 1 || val === 'true');
            break;
          case 'showAqi':
            self.setShowAqi(val === true || val === 1 || val === 'true');
            break;
          case 'showEnvironmentalMetrics':
            self.setShowEnvironmentalMetrics(val === true || val === 1 || val === 'true');
            break;
          case 'weatherProvider':
            var wProviders = ['open-meteo', 'met-norway', 'openweathermap'];
            var wpVal = (typeof val === 'number') ? (wProviders[val] || 'open-meteo') : val;
            if (global.ApiService) global.ApiService.weatherProvider = wpVal;
            self.loadAtmosphere(true);
            break;
          case 'openweathermapApiKey':
            if (global.ApiService) global.ApiService.openweathermapApiKey = val;
            if (global.ApiService && global.ApiService.weatherProvider === 'openweathermap') {
              self.loadAtmosphere(true);
            }
            break;
          case 'aqiProvider':
            var aProviders = ['open-meteo', 'waqi'];
            var apVal = (typeof val === 'number') ? (aProviders[val] || 'open-meteo') : val;
            if (global.ApiService) global.ApiService.aqiProvider = apVal;
            self.loadAtmosphere(true);
            break;
          case 'waqiApiKey':
            if (global.ApiService) global.ApiService.waqiApiKey = val;
            if (global.ApiService && global.ApiService.aqiProvider === 'waqi') {
              self.loadAtmosphere(true);
            }
            break;
          case 'showForecastChart':
            self.setShowForecastChart(val === true || val === 1 || val === 'true');
            break;
          case 'defaultForecastTab':
            var tabs = ['temp', 'feels_like', 'precip', 'wind', 'humidity', 'aqi'];
            var tabVal = (typeof val === 'number') ? (tabs[val] || 'temp') : (val === 'Feels Like' ? 'feels_like' : val);
            if (self.forecastChart) self.forecastChart.setTab(tabVal);
            break;
          case 'showPomodoro':
            self.setShowPomodoro(val === true || val === 1 || val === 'true');
            break;
          case 'showMediaPlayer':
            self.setShowMediaPlayer(val === true || val === 1 || val === 'true');
            break;
          case 'pomodoroFocusMinutes':
            if (self.pomodoro) self.pomodoro.setDurations(typeof val === 'number' ? val : parseInt(val, 10), null, null);
            break;
          case 'pomodoroBreakMinutes':
            if (self.pomodoro) self.pomodoro.setDurations(null, typeof val === 'number' ? val : parseInt(val, 10), null);
            break;
          case 'enableAudioVisualizer':
            if (self.mediaVisualizer) self.mediaVisualizer.setEnabled(!!val);
            break;
          case 'enableDynamicSolarLighting':
            if (self.solarLighting) {
              self.solarLighting.setEnabled(!!val);
              self.updateClock();
            }
            break;
        }
      });

      // Real-time Hardware System Information telemetry
      global.LivelyBridge.onSystemInfo(function(hwData) {
        self.handleSystemInfo(hwData);
      });

      // Windows SMTC Current Track telemetry
      global.LivelyBridge.onCurrentTrack(function(track) {
        if (self.isPlaybackPaused) return;
        if (self.mediaVisualizer) {
          self.mediaVisualizer.handleTrackUpdate(track);
        }
      });

      // Real-time Audio Spectrum telemetry (128 normalized float bins)
      global.LivelyBridge.onAudioData(function(audioArray) {
        if (self.isPlaybackPaused) return;
        if (self.mediaVisualizer) {
          self.mediaVisualizer.processAudioData(audioArray);
        }
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

      if (this.dom.dockMediaFocus) {
        this.dom.dockMediaFocus.classList.remove('top-right', 'top-left', 'bottom-right', 'bottom-left');
        this.dom.dockMediaFocus.classList.add(targetClass);
      }

      if (this.contrastMode === 'auto' && this.lastLoadedImage) {
        this.adaptContrastToBackground(this.lastLoadedImage);
      }

      this.updateLayoutAutoResize();
    },

    setShowNewsFeed: function(show) {
      this.showNewsFeed = !!show;
      if (this.dom.hudNewsBlock) {
        if (this.showNewsFeed) {
          this.dom.hudNewsBlock.classList.remove('is-hidden');
          if (!this.newsTimer && !this.isPlaybackPaused && this.newsItems && this.newsItems.length > 1) {
            var rotSec = (global.LOCAL_WALLY_CONFIG && typeof global.LOCAL_WALLY_CONFIG.newsRotateIntervalSeconds === 'number')
              ? Math.max(3, global.LOCAL_WALLY_CONFIG.newsRotateIntervalSeconds)
              : 7;
            this.newsTimer = setInterval(this.rotateNews.bind(this), rotSec * 1000);
          }
        } else {
          this.dom.hudNewsBlock.classList.add('is-hidden');
          if (this.newsTimer) {
            clearInterval(this.newsTimer);
            this.newsTimer = null;
          }
        }
      }
      this.updateLayoutAutoResize();
    },

    setShowHardwareMonitor: function(show) {
      this.showHardwareMonitor = !!show;
      if (this.dom.hudHwBlock) {
        if (this.showHardwareMonitor) {
          this.dom.hudHwBlock.classList.remove('is-hidden');
          if (!this.hwFallbackTimer && !this.isPlaybackPaused) {
            this.executeHwFallbackTick();
            this.hwFallbackTimer = setInterval(this.checkHwFallback.bind(this), 2000);
          }
        } else {
          this.dom.hudHwBlock.classList.add('is-hidden');
          if (this.hwFallbackTimer) {
            clearInterval(this.hwFallbackTimer);
            this.hwFallbackTimer = null;
          }
        }
      }
      this.updateLayoutAutoResize();
    },

    setShowNetworkUsage: function(show) {
      this.showNetworkUsage = !!show;
      if (this.dom.hwNetDownRow) {
        if (this.showNetworkUsage) {
          this.dom.hwNetDownRow.classList.remove('is-hidden');
          if (this.dom.hwNetDownRow.style && this.dom.hwNetDownRow.style.setProperty) {
            this.dom.hwNetDownRow.style.setProperty('display', 'flex');
          } else if (this.dom.hwNetDownRow.style) {
            this.dom.hwNetDownRow.style.display = 'flex';
          }
        } else {
          this.dom.hwNetDownRow.classList.add('is-hidden');
          if (this.dom.hwNetDownRow.style && this.dom.hwNetDownRow.style.setProperty) {
            this.dom.hwNetDownRow.style.setProperty('display', 'none', 'important');
          } else if (this.dom.hwNetDownRow.style) {
            this.dom.hwNetDownRow.style.display = 'none';
          }
        }
      }
      if (this.dom.hwNetUpRow) {
        if (this.showNetworkUsage) {
          this.dom.hwNetUpRow.classList.remove('is-hidden');
          if (this.dom.hwNetUpRow.style && this.dom.hwNetUpRow.style.setProperty) {
            this.dom.hwNetUpRow.style.setProperty('display', 'flex');
          } else if (this.dom.hwNetUpRow.style) {
            this.dom.hwNetUpRow.style.display = 'flex';
          }
        } else {
          this.dom.hwNetUpRow.classList.add('is-hidden');
          if (this.dom.hwNetUpRow.style && this.dom.hwNetUpRow.style.setProperty) {
            this.dom.hwNetUpRow.style.setProperty('display', 'none', 'important');
          } else if (this.dom.hwNetUpRow.style) {
            this.dom.hwNetUpRow.style.display = 'none';
          }
        }
      }
      this.updateLayoutAutoResize();
    },

    setShowBatteryInfo: function(show) {
      this.showBatteryInfo = !!show;
      if (this.showBatteryInfo && this.hasPhysicalBattery) {
        if (this.batteryManager) {
          this.syncBatteryState(this.batteryManager);
        } else {
          this.showBatteryRow(this.lastBatteryPct || 100, this.lastBatteryCharging || false, 'Battery');
        }
      } else {
        this.hideBatteryRow();
      }
      this.updateLayoutAutoResize();
    },

    setShowCelestial: function(show) {
      this.showCelestial = !!show;
      if (this.dom.hudEphemerisCard) {
        if (this.showCelestial) {
          this.dom.hudEphemerisCard.classList.remove('is-hidden');
        } else {
          this.dom.hudEphemerisCard.classList.add('is-hidden');
        }
      }
      this.updateLayoutAutoResize();
    },

    setShowAqi: function(show) {
      this.showAqi = !!show;
      if (this.dom.hudAqiCard) {
        if (this.showAqi) {
          this.dom.hudAqiCard.classList.remove('is-hidden');
        } else {
          this.dom.hudAqiCard.classList.add('is-hidden');
        }
      }
      this.updateLayoutAutoResize();
    },

    setShowEnvironmentalMetrics: function(show) {
      this.showEnvironmentalMetrics = !!show;
      if (this.dom.hudMetricsRow) {
        if (this.showEnvironmentalMetrics) {
          this.dom.hudMetricsRow.classList.remove('is-hidden');
        } else {
          this.dom.hudMetricsRow.classList.add('is-hidden');
        }
      }
      this.updateLayoutAutoResize();
    },

    setShowForecastChart: function(show) {
      this.showForecastChart = !!show;
      if (this.dom.hudForecastCard) {
        if (this.showForecastChart) {
          this.dom.hudForecastCard.classList.remove('is-hidden');
          if (this.forecastChart) this.forecastChart.render();
        } else {
          this.dom.hudForecastCard.classList.add('is-hidden');
        }
      }
      this.updateLayoutAutoResize();
    },

    setShowPomodoro: function(show) {
      this.showPomodoro = !!show;
      if (this.dom.pomodoroCard) {
        if (this.showPomodoro) {
          this.dom.pomodoroCard.classList.remove('is-hidden');
          if (this.pomodoro && this.pomodoro.isRunning && !this.isPlaybackPaused) {
            this.pomodoro.resumeTicker();
          }
        } else {
          this.dom.pomodoroCard.classList.add('is-hidden');
          if (this.pomodoro) {
            this.pomodoro.sleepTicker();
          }
        }
      }
      this.updateLayoutAutoResize();
    },

    setShowMediaPlayer: function(show) {
      this.showMediaPlayer = !!show;
      if (this.dom.mediaCard) {
        if (this.showMediaPlayer) {
          this.dom.mediaCard.classList.remove('is-hidden');
          if (this.mediaVisualizer && !this.isPlaybackPaused) {
            this.mediaVisualizer.wake();
          }
        } else {
          this.dom.mediaCard.classList.add('is-hidden');
          if (this.mediaVisualizer) {
            this.mediaVisualizer.sleep();
          }
        }
      }
      this.updateLayoutAutoResize();
    },

    setShowMediaFocusDock: function(show) {
      this.showMediaFocusDock = !!show;
      if (!this.showMediaFocusDock) {
        if (this.mediaVisualizer) this.mediaVisualizer.sleep();
        if (this.pomodoro) this.pomodoro.sleepTicker();
      } else {
        if (this.mediaVisualizer && this.showMediaPlayer && !this.isPlaybackPaused) {
          this.mediaVisualizer.wake();
        }
        if (this.pomodoro && this.showPomodoro && this.pomodoro.isRunning && !this.isPlaybackPaused) {
          this.pomodoro.resumeTicker();
        }
      }
      this.updateLayoutAutoResize();
    },

    updateLayoutAutoResize: function() {
      var hwVisible = this.showHardwareMonitor;
      var newsVisible = this.showNewsFeed;

      // Secondary column auto-resizing
      if (this.dom.hudColSecondary) {
        if (!hwVisible && !newsVisible) {
          this.dom.hudColSecondary.style.display = 'none';
          if (this.dom.hud) this.dom.hud.classList.add('hud-single-col');
        } else {
          this.dom.hudColSecondary.style.display = '';
          if (this.dom.hud) this.dom.hud.classList.remove('hud-single-col');

          // Helper classes for single-item expansion in secondary col
          if (this.dom.hudHwBlock) {
            if (hwVisible && !newsVisible) {
              this.dom.hudHwBlock.classList.add('flex-expand');
            } else {
              this.dom.hudHwBlock.classList.remove('flex-expand');
            }
          }
          if (this.dom.hudNewsBlock) {
            if (newsVisible && !hwVisible) {
              this.dom.hudNewsBlock.classList.add('flex-expand');
            } else {
              this.dom.hudNewsBlock.classList.remove('flex-expand');
            }
          }
        }
      }

      // Companion dock auto-resizing
      if (this.dom.dockMediaFocus) {
        var pomoVisible = this.showPomodoro;
        var mediaVisible = this.showMediaPlayer;
        var dockEnabled = (this.showMediaFocusDock !== false);

        if (!dockEnabled || (!pomoVisible && !mediaVisible)) {
          this.dom.dockMediaFocus.classList.add('is-hidden');
        } else {
          this.dom.dockMediaFocus.classList.remove('is-hidden');

          // Check single-card solo state
          if (this.dom.pomodoroCard) {
            if (pomoVisible && !mediaVisible) {
              this.dom.pomodoroCard.classList.add('is-solo');
            } else {
              this.dom.pomodoroCard.classList.remove('is-solo');
            }
          }
          if (this.dom.mediaCard) {
            if (mediaVisible && !pomoVisible) {
              this.dom.mediaCard.classList.add('is-solo');
            } else {
              this.dom.mediaCard.classList.remove('is-solo');
            }
          }

          if (this.mediaVisualizer && mediaVisible) {
            this.mediaVisualizer.resize();
          }
        }

        // Dynamically compute companion dock vertical positioning offset
        if (this.dom.hud) {
          var hudHeight = this.dom.hud.offsetHeight || 395;
          var dockHeight = (this.dom.dockMediaFocus && this.dom.dockMediaFocus.offsetHeight) || 124;
          var offsetGap = 14;
          var vh = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 1080;
          var topOffsetNum = 32 + hudHeight + offsetGap;
          if (topOffsetNum + dockHeight > vh - 10) {
            topOffsetNum = Math.max(16, vh - 10 - dockHeight);
          }
          var topOffset = topOffsetNum + 'px';
          var bottomOffset = (32 + hudHeight + offsetGap) + 'px';
          document.documentElement.style.setProperty('--dock-top', topOffset);
          document.documentElement.style.setProperty('--dock-bottom', bottomOffset);
        }
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
      this.currentTheme = theme === 'light' ? 'light' : 'dark';
      var isLight = (this.currentTheme === 'light');

      if (this.dom.hud) {
        if (isLight) this.dom.hud.classList.add('theme-light');
        else this.dom.hud.classList.remove('theme-light');
      }

      if (this.dom.dockMediaFocus) {
        if (isLight) this.dom.dockMediaFocus.classList.add('theme-light');
        else this.dom.dockMediaFocus.classList.remove('theme-light');
      }

      if (this.pomodoro) {
        this.pomodoro.setTheme(this.currentTheme);
      }
      if (this.mediaVisualizer) {
        this.mediaVisualizer.setTheme(this.currentTheme);
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
      if (this.forecastChart) {
        this.forecastChart.setTempUnit(this.tempUnit);
      }
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
      if (global.ApiService && typeof global.ApiService.generateSyntheticForecast === 'function') {
        var simHourly = global.ApiService.generateSyntheticForecast(simWeather, this.state.aqi);
        this.state.hourlyForecast = simHourly;
        this.renderForecast(simHourly);
      }
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

      // Continuously refresh celestial ephemeris, sky gradient, and dynamic solar lighting (every 15s)
      var elapsedCelestial = now.getTime() - this.lastCelestialUpdate;
      if (elapsedCelestial >= 15000 || !this.lastCelestialUpdate) {
        this.renderCelestial();
        this.updateSky();
        if (this.solarLighting) {
          var defaultLoc = (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.defaultLocation) || {};
          var lat = typeof defaultLoc.latitude === 'number' ? defaultLoc.latitude : 35.6762;
          var lng = typeof defaultLoc.longitude === 'number' ? defaultLoc.longitude : 139.6503;
          if (this.state && this.state.location) {
            if (typeof this.state.location.latitude === 'number') lat = this.state.location.latitude;
            if (typeof this.state.location.longitude === 'number') lng = this.state.location.longitude;
          }
          this.solarLighting.update(now, lat, lng);
        }
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

      // Prevent concurrent race condition and thrashing by queuing pending sync
      if (this.isSyncing) {
        this.syncPending = true;
        if (forceRefresh) this.syncPendingForce = true;
        console.log('[App] Atmosphere sync already in progress, queued pending sync.');
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
        if (self.syncPending) {
          var pendingForce = !!self.syncPendingForce;
          self.syncPending = false;
          self.syncPendingForce = false;
          self.loadAtmosphere(pendingForce);
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
          if (self.isPlaybackPaused) {
            self.pendingSnapshot = snapshot;
          } else {
            self.renderAll(snapshot);
          }
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
            if (self.isPlaybackPaused) {
              self.pendingSnapshot = self.state;
            } else {
              self.renderAll(self.state);
            }
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
      this.renderForecast(snapshot.hourlyForecast || (snapshot.weather && snapshot.weather.hourlyForecast));
      this.renderCelestial();
      this.updateBackground(snapshot.background);
      this.updateAtmosphereEngines(snapshot);
    },

    renderForecast: function(hourly) {
      if (!this.forecastChart) return;
      if (Array.isArray(hourly) && hourly.length > 0) {
        this.forecastChart.setForecast(hourly);
      } else if (this.state && this.state.weather && Array.isArray(this.state.weather.hourlyForecast)) {
        this.forecastChart.setForecast(this.state.weather.hourlyForecast);
      }
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
      var temp = isF
        ? (Number.isFinite(w.tempF) ? Math.round(w.tempF) : '--')
        : (Number.isFinite(w.tempC) ? Math.round(w.tempC) : '--');
      var apparent = isF
        ? (Number.isFinite(w.apparentF) ? Math.round(w.apparentF) : '--')
        : (Number.isFinite(w.apparentC) ? Math.round(w.apparentC) : '--');
      var high = isF
        ? (Number.isFinite(w.tempMaxF) ? Math.round(w.tempMaxF) : '--')
        : (Number.isFinite(w.tempMaxC) ? Math.round(w.tempMaxC) : '--');
      var low = isF
        ? (Number.isFinite(w.tempMinF) ? Math.round(w.tempMinF) : '--')
        : (Number.isFinite(w.tempMinC) ? Math.round(w.tempMinC) : '--');

      if (this.dom.hudTempVal) this.dom.hudTempVal.textContent = temp;
      if (this.dom.hudTempUnit) this.dom.hudTempUnit.textContent = isF ? '°F' : '°C';
      if (this.dom.hudCondition) this.dom.hudCondition.textContent = w.conditionText || 'Fair';
      if (this.dom.hudFeelsLike) this.dom.hudFeelsLike.textContent = (apparent !== '--') ? ('Feels like ' + apparent + '°') : 'Feels like --';
      if (this.dom.hudTempHigh) this.dom.hudTempHigh.textContent = (high !== '--') ? (high + '°') : '--';
      if (this.dom.hudTempLow) this.dom.hudTempLow.textContent = (low !== '--') ? (low + '°') : '--';

      if (this.dom.metricHumidity) {
        this.dom.metricHumidity.textContent = Number.isFinite(w.humidity) ? (Math.round(w.humidity) + '%') : '--';
      }
      if (this.dom.metricWind) {
        if (isF) {
          this.dom.metricWind.textContent = Number.isFinite(w.windSpeedMph) ? (w.windSpeedMph + ' mph') : '--';
        } else {
          this.dom.metricWind.textContent = Number.isFinite(w.windSpeedKm) ? (w.windSpeedKm + ' km/h') : '--';
        }
      }
      if (this.dom.metricPrecip) {
        this.dom.metricPrecip.textContent = Number.isFinite(w.precipitationMm) ? ((w.precipitationMm || 0.0).toFixed(1) + ' mm') : '--';
      }
    },

    renderAqi: function(aqi) {
      if (!aqi) return;

      var isAvailable = aqi.available !== false && aqi.europeanAqi != null && Number.isFinite(aqi.europeanAqi);
      var unit = aqi.pollutantUnit || 'µg/m³';

      if (this.dom.hudAqiBadge) {
        this.dom.hudAqiBadge.style.background = isAvailable ? (aqi.color || '#10b981') : '#64748b';
      }
      if (this.dom.hudAqiCategory) {
        this.dom.hudAqiCategory.textContent = isAvailable
          ? ((aqi.category || 'Good') + ' (' + aqi.europeanAqi + ')')
          : (aqi.category || 'Unavailable');
      }
      if (this.dom.hudAqiFill) {
        // European AQI 0 to 100 mapped to %
        var pct = isAvailable ? Math.min(100, Math.max(5, (aqi.europeanAqi / 80) * 100)) : 0;
        this.dom.hudAqiFill.style.width = pct + '%';
      }
      if (this.dom.hudPm25) {
        var pm25Val = aqi.pm2_5 != null ? aqi.pm2_5 : aqi.pm25;
        this.dom.hudPm25.textContent = (pm25Val != null && Number.isFinite(pm25Val)) ? (pm25Val + ' ' + unit) : '--';
      }
      if (this.dom.hudPm10) {
        var pm10Val = aqi.pm10;
        this.dom.hudPm10.textContent = (pm10Val != null && Number.isFinite(pm10Val)) ? (pm10Val + ' ' + unit) : '--';
      }
    },

    formatNetworkBandwidth: function(valKbps) {
      if (typeof valKbps !== 'number' || isNaN(valKbps) || valKbps <= 0) {
        return '0 Kbps';
      }
      if (valKbps < 1000) {
        return Math.round(valKbps) + ' Kbps';
      } else if (valKbps < 1000000) {
        return (valKbps / 1000).toFixed(1) + ' Mbps';
      } else {
        return (valKbps / 1000000).toFixed(2) + ' Gbps';
      }
    },

    initBatteryMonitor: function() {
      var self = this;
      if (typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function') {
        try {
          navigator.getBattery().then(function(battery) {
            self.batteryManager = battery;
            var isDesktopDummy = (battery.level === 1.0 && battery.charging === true &&
                                  battery.chargingTime === 0 && battery.dischargingTime === Infinity);

            if (!isDesktopDummy || battery.level < 1.0 || battery.charging === false) {
              self.hasPhysicalBattery = true;
              self.batteryCorroborated = true;
            }

            self.syncBatteryState(battery);

            battery.addEventListener('levelchange', function() {
              self.hasPhysicalBattery = true;
              self.batteryCorroborated = true;
              self.syncBatteryState(battery);
            });
            battery.addEventListener('chargingchange', function() {
              self.hasPhysicalBattery = true;
              self.batteryCorroborated = true;
              self.syncBatteryState(battery);
            });
            battery.addEventListener('chargingtimechange', function() {
              self.syncBatteryState(battery);
            });
            battery.addEventListener('dischargingtimechange', function() {
              self.syncBatteryState(battery);
            });
          }).catch(function() {
            self.hasPhysicalBattery = false;
            self.hideBatteryRow();
          });
        } catch (e) {
          self.hasPhysicalBattery = false;
          self.hideBatteryRow();
        }
      } else {
        self.hasPhysicalBattery = false;
        self.hideBatteryRow();
      }
    },

    syncBatteryState: function(battery) {
      if (!battery) return;
      var level = typeof battery.level === 'number' ? battery.level : 1.0;
      var charging = !!battery.charging;
      var chargingTime = typeof battery.chargingTime === 'number' ? battery.chargingTime : 0;
      var dischargingTime = typeof battery.dischargingTime === 'number' ? battery.dischargingTime : Infinity;

      var isDesktopDummy = (level === 1.0 && charging === true && chargingTime === 0 && dischargingTime === Infinity);
      if (isDesktopDummy && !this.batteryCorroborated) {
        this.hasPhysicalBattery = false;
        this.hideBatteryRow();
        return;
      }

      this.hasPhysicalBattery = true;
      this.batteryCorroborated = true;

      if (!this.showBatteryInfo) {
        this.hideBatteryRow();
        return;
      }

      var pct = Math.max(0, Math.min(100, Math.round(level * 100)));
      this.lastBatteryPct = pct;
      this.lastBatteryCharging = charging;

      var statusText = battery.statusText || (charging ? '⚡ Charging' : 'On Battery');
      if (charging && chargingTime > 0 && isFinite(chargingTime)) {
        var cMins = Math.round(chargingTime / 60);
        var cHrs = Math.floor(cMins / 60);
        var cRem = cMins % 60;
        statusText += ' (' + (cHrs > 0 ? cHrs + 'h ' : '') + cRem + 'm)';
      } else if (!charging && dischargingTime > 0 && isFinite(dischargingTime)) {
        var dMins = Math.round(dischargingTime / 60);
        var dHrs = Math.floor(dMins / 60);
        var dRem = dMins % 60;
        statusText += ' (' + (dHrs > 0 ? dHrs + 'h ' : '') + dRem + 'm)';
      }

      this.showBatteryRow(pct, charging, statusText);
    },

    showBatteryRow: function(pct, isCharging, statusText) {
      if (!this.showBatteryInfo || !this.hasPhysicalBattery) {
        this.hideBatteryRow();
        return;
      }

      if (this.dom.hwBatteryRow) {
        this.dom.hwBatteryRow.classList.remove('is-hidden');
        if (this.dom.hwBatteryRow.style && this.dom.hwBatteryRow.style.setProperty) {
          this.dom.hwBatteryRow.style.setProperty('display', 'flex', 'important');
        } else if (this.dom.hwBatteryRow.style) {
          this.dom.hwBatteryRow.style.display = 'flex';
        }
      }
      if (this.dom.hwBatteryVal) {
        this.dom.hwBatteryVal.textContent = pct + '%';
      }
      if (this.dom.hwBatteryStatus) {
        this.dom.hwBatteryStatus.textContent = statusText;
      }
      if (this.dom.hwBatteryIcon) {
        this.dom.hwBatteryIcon.textContent = isCharging ? '⚡' : '🔋';
        this.dom.hwBatteryIcon.className = isCharging ? 'hw-battery-badge is-charging' : 'hw-battery-badge';
      }
      if (this.dom.hwBatteryBar) {
        this.dom.hwBatteryBar.style.width = pct + '%';
        this.dom.hwBatteryBar.className = 'hw-bar-fill hw-battery-fill' +
          (isCharging ? ' is-charging' : (pct <= 15 ? ' is-low' : (pct <= 30 ? ' is-medium' : '')));
      }
    },

    hideBatteryRow: function() {
      if (this.dom.hwBatteryRow) {
        this.dom.hwBatteryRow.classList.add('is-hidden');
        if (this.dom.hwBatteryRow.style && this.dom.hwBatteryRow.style.setProperty) {
          this.dom.hwBatteryRow.style.setProperty('display', 'none', 'important');
        } else if (this.dom.hwBatteryRow.style) {
          this.dom.hwBatteryRow.style.display = 'none';
        }
      }
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
      if (!data || this.isPlaybackPaused || !this.showHardwareMonitor) return;
      this.lastHwUpdate = Date.now();

      // CPU load and name
      var cpuVal = (typeof data.CurrentCpu === 'number' && Number.isFinite(data.CurrentCpu)) ? Math.round(data.CurrentCpu) : 0;
      cpuVal = Math.max(0, Math.min(100, cpuVal));
      var cpuName = data.NameCpu || 'Processor';
      this.pushHwHistory(this.hwCpuHistory, cpuVal);

      if (this.dom.hwCpuVal) this.dom.hwCpuVal.textContent = cpuVal + '%';
      if (this.dom.hwCpuBar) this.dom.hwCpuBar.style.width = cpuVal + '%';
      if (this.sparklineEngine) this.sparklineEngine.render('cpu', this.hwCpuHistory);
      if (this.dom.hwCpuSpark && this.dom.hwCpuSpark.tagName !== 'svg' && this.dom.hwCpuSpark.tagName !== 'SVG') {
        this.dom.hwCpuSpark.textContent = this.getSparklineString(this.hwCpuHistory);
      }
      if (this.dom.hwCpuName) this.dom.hwCpuName.textContent = cpuName;

      // GPU 3D load and name
      var gpuVal = (typeof data.CurrentGpu3D === 'number' && Number.isFinite(data.CurrentGpu3D)) ? Math.round(data.CurrentGpu3D) : 0;
      gpuVal = Math.max(0, Math.min(100, gpuVal));
      var gpuName = data.NameGpu || 'Graphics 3D';
      this.pushHwHistory(this.hwGpuHistory, gpuVal);

      if (this.dom.hwGpuVal) this.dom.hwGpuVal.textContent = gpuVal + '%';
      if (this.dom.hwGpuBar) this.dom.hwGpuBar.style.width = gpuVal + '%';
      if (this.sparklineEngine) this.sparklineEngine.render('gpu', this.hwGpuHistory);
      if (this.dom.hwGpuSpark && this.dom.hwGpuSpark.tagName !== 'svg' && this.dom.hwGpuSpark.tagName !== 'SVG') {
        this.dom.hwGpuSpark.textContent = this.getSparklineString(this.hwGpuHistory);
      }
      if (this.dom.hwGpuName) this.dom.hwGpuName.textContent = gpuName;

      // RAM usage
      var totalRamMb = (typeof data.TotalRam === 'number' && Number.isFinite(data.TotalRam) && data.TotalRam > 0) ? data.TotalRam : 0;
      var freeRamMb = (typeof data.CurrentRamAvail === 'number' && Number.isFinite(data.CurrentRamAvail) && data.CurrentRamAvail >= 0) ? data.CurrentRamAvail : 0;
      var usedRamMb = totalRamMb > freeRamMb ? (totalRamMb - freeRamMb) : 0;
      var ramPct = totalRamMb > 0 ? Math.round((usedRamMb / totalRamMb) * 100) : 0;
      ramPct = Number.isFinite(ramPct) ? Math.max(0, Math.min(100, ramPct)) : 0;
      var usedGb = (usedRamMb / 1024).toFixed(1);
      var totalGb = (totalRamMb / 1024).toFixed(1);

      this.pushHwHistory(this.hwRamHistory, ramPct);
      if (this.dom.hwRamVal) this.dom.hwRamVal.textContent = ramPct + '%';
      if (this.dom.hwRamBar) this.dom.hwRamBar.style.width = ramPct + '%';
      if (this.sparklineEngine) this.sparklineEngine.render('ram', this.hwRamHistory);
      if (this.dom.hwRamSpark && this.dom.hwRamSpark.tagName !== 'svg' && this.dom.hwRamSpark.tagName !== 'SVG') {
        this.dom.hwRamSpark.textContent = this.getSparklineString(this.hwRamHistory);
      }
      if (this.dom.hwRamDetail) {
        this.dom.hwRamDetail.textContent = totalRamMb > 0 ? (usedGb + ' / ' + totalGb + ' GB') : 'Physical RAM';
      }

      // Disk / Storage
      var diskVal = (typeof data.CurrentDisk === 'number' && Number.isFinite(data.CurrentDisk)) ? Math.round(data.CurrentDisk) : null;
      if (diskVal === null && typeof data.DiskUsage === 'number' && Number.isFinite(data.DiskUsage)) {
        diskVal = Math.round(data.DiskUsage);
      }
      if (diskVal !== null) {
        diskVal = Math.max(0, Math.min(100, diskVal));
        this.pushHwHistory(this.hwDiskHistory, diskVal);
        if (this.dom.hwDiskVal) this.dom.hwDiskVal.textContent = diskVal + '%';
        if (this.dom.hwDiskBar) this.dom.hwDiskBar.style.width = diskVal + '%';
        if (this.sparklineEngine) this.sparklineEngine.render('disk', this.hwDiskHistory);
        if (this.dom.hwDiskSpark && this.dom.hwDiskSpark.tagName !== 'svg' && this.dom.hwDiskSpark.tagName !== 'SVG') {
          this.dom.hwDiskSpark.textContent = this.getSparklineString(this.hwDiskHistory);
        }
        if (this.dom.hwDiskDetail) this.dom.hwDiskDetail.textContent = 'Drive C:';
      } else {
        this.updateDiskEstimate();
      }

      // Network Down & Network Up Telemetry
      var rawDown = (typeof data.CurrentNetDown === 'number' && Number.isFinite(data.CurrentNetDown)) ? data.CurrentNetDown :
                    ((typeof data.NetDown === 'number' && Number.isFinite(data.NetDown)) ? data.NetDown :
                    ((typeof data.NetworkDown === 'number' && Number.isFinite(data.NetworkDown)) ? data.NetworkDown :
                    ((typeof data.CurrentNetworkDown === 'number' && Number.isFinite(data.CurrentNetworkDown)) ? data.CurrentNetworkDown : null)));

      var rawUp = (typeof data.CurrentNetUp === 'number' && Number.isFinite(data.CurrentNetUp)) ? data.CurrentNetUp :
                  ((typeof data.NetUp === 'number' && Number.isFinite(data.NetUp)) ? data.NetUp :
                  ((typeof data.NetworkUp === 'number' && Number.isFinite(data.NetworkUp)) ? data.NetworkUp :
                  ((typeof data.CurrentNetworkUp === 'number' && Number.isFinite(data.CurrentNetworkUp)) ? data.CurrentNetworkUp : null)));

      if (rawDown !== null) {
        var downKbps = (data.NameNetCard || rawDown > 1000000) ? Math.round((rawDown * 8) / 1000) : rawDown;
        downKbps = Math.max(0, downKbps);
        this.pushHwHistory(this.hwNetDownHistory, downKbps);

        if (this.dom.hwNetDownVal) this.dom.hwNetDownVal.textContent = this.formatNetworkBandwidth(downKbps);
        if (this.dom.hwNetDownBar) {
          var downPct = Math.min(100, Math.max(2, Math.round((downKbps / 50000) * 100)));
          this.dom.hwNetDownBar.style.width = downPct + '%';
        }
        if (this.sparklineEngine) this.sparklineEngine.render('netDown', this.hwNetDownHistory);
      }

      if (rawUp !== null) {
        var upKbps = (data.NameNetCard || rawUp > 1000000) ? Math.round((rawUp * 8) / 1000) : rawUp;
        upKbps = Math.max(0, upKbps);
        this.pushHwHistory(this.hwNetUpHistory, upKbps);

        if (this.dom.hwNetUpVal) this.dom.hwNetUpVal.textContent = this.formatNetworkBandwidth(upKbps);
        if (this.dom.hwNetUpBar) {
          var upPct = Math.min(100, Math.max(2, Math.round((upKbps / 15000) * 100)));
          this.dom.hwNetUpBar.style.width = upPct + '%';
        }
        if (this.sparklineEngine) this.sparklineEngine.render('netUp', this.hwNetUpHistory);
      }

      if (data.NameNetCard) {
        if (this.dom.hwNetDownName) this.dom.hwNetDownName.textContent = data.NameNetCard;
        if (this.dom.hwNetUpName) this.dom.hwNetUpName.textContent = data.NameNetCard;
      }

      // Laptop Battery Telemetry from Lively host
      var batteryPct = typeof data.BatteryPercent === 'number' ? data.BatteryPercent :
                       (typeof data.BatteryLevel === 'number' ? (data.BatteryLevel <= 1.0 ? Math.round(data.BatteryLevel * 100) : Math.round(data.BatteryLevel)) : null);
      if (batteryPct !== null && batteryPct >= 0 && batteryPct <= 100) {
        var isCharging = data.BatteryStatus === 'Charging' || data.BatteryStatus === 1 || data.BatteryCharging === true;
        var statusStr = typeof data.BatteryStatus === 'string' ? data.BatteryStatus : (isCharging ? '⚡ Charging' : 'On Battery');
        this.syncBatteryState({
          level: batteryPct / 100,
          charging: isCharging,
          statusText: statusStr
        });
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
            if (self.sparklineEngine) self.sparklineEngine.render('disk', self.hwDiskHistory);
            if (self.dom.hwDiskSpark && self.dom.hwDiskSpark.tagName !== 'svg' && self.dom.hwDiskSpark.tagName !== 'SVG') {
              self.dom.hwDiskSpark.textContent = self.getSparklineString(self.hwDiskHistory);
            }
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
      if (this.sparklineEngine) this.sparklineEngine.render('disk', this.hwDiskHistory);
      if (this.dom.hwDiskSpark && this.dom.hwDiskSpark.tagName !== 'svg' && this.dom.hwDiskSpark.tagName !== 'SVG') {
        this.dom.hwDiskSpark.textContent = this.getSparklineString(this.hwDiskHistory);
      }
      if (this.dom.hwDiskDetail) this.dom.hwDiskDetail.textContent = 'System NVMe';
    },

    checkHwFallback: function() {
      if (this.isPlaybackPaused || !this.showHardwareMonitor) return;
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
      if (this.isPlaybackPaused || !this.showHardwareMonitor) return;
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

      // Network Bandwidth fallback simulation
      var netDownDelta = (Math.random() - 0.49) * 2500;
      this.simulatedNetDown = Math.max(120, Math.min(85000, Math.round(this.simulatedNetDown + netDownDelta)));

      var netUpDelta = (Math.random() - 0.5) * 800;
      this.simulatedNetUp = Math.max(45, Math.min(18000, Math.round(this.simulatedNetUp + netUpDelta)));

      this.pushHwHistory(this.hwCpuHistory, this.simulatedCpuLoad);
      this.pushHwHistory(this.hwGpuHistory, this.simulatedGpuLoad);
      this.pushHwHistory(this.hwRamHistory, ramPct);
      this.pushHwHistory(this.hwDiskHistory, this.simulatedDiskPct);
      this.pushHwHistory(this.hwNetDownHistory, this.simulatedNetDown);
      this.pushHwHistory(this.hwNetUpHistory, this.simulatedNetUp);

      if (this.dom.hwCpuVal) this.dom.hwCpuVal.textContent = this.simulatedCpuLoad + '%';
      if (this.dom.hwCpuBar) this.dom.hwCpuBar.style.width = this.simulatedCpuLoad + '%';
      if (this.dom.hwCpuName) this.dom.hwCpuName.textContent = 'Processor';

      if (this.dom.hwGpuVal) this.dom.hwGpuVal.textContent = this.simulatedGpuLoad + '%';
      if (this.dom.hwGpuBar) this.dom.hwGpuBar.style.width = this.simulatedGpuLoad + '%';
      if (this.dom.hwGpuName) this.dom.hwGpuName.textContent = 'Graphics 3D';

      if (this.dom.hwRamVal) this.dom.hwRamVal.textContent = ramPct + '%';
      if (this.dom.hwRamBar) this.dom.hwRamBar.style.width = ramPct + '%';
      if (this.dom.hwRamDetail) {
        this.dom.hwRamDetail.textContent = this.simulatedRamUsed + ' / ' + this.simulatedRamTotal + ' GB';
      }

      if (this.dom.hwDiskVal) this.dom.hwDiskVal.textContent = this.simulatedDiskPct + '%';
      if (this.dom.hwDiskBar) this.dom.hwDiskBar.style.width = this.simulatedDiskPct + '%';
      if (this.dom.hwDiskDetail) this.dom.hwDiskDetail.textContent = 'Drive C:';

      // Network Down & Up DOM Updates
      var netDownFormatted = this.formatNetworkBandwidth(this.simulatedNetDown);
      var netUpFormatted = this.formatNetworkBandwidth(this.simulatedNetUp);
      if (this.dom.hwNetDownVal) this.dom.hwNetDownVal.textContent = netDownFormatted;
      if (this.dom.hwNetUpVal) this.dom.hwNetUpVal.textContent = netUpFormatted;
      if (this.dom.hwNetDownName) this.dom.hwNetDownName.textContent = 'Download';
      if (this.dom.hwNetUpName) this.dom.hwNetUpName.textContent = 'Upload';

      if (this.dom.hwNetDownBar) {
        var downPct = Math.min(100, Math.max(2, Math.round((this.simulatedNetDown / 50000) * 100)));
        this.dom.hwNetDownBar.style.width = downPct + '%';
      }
      if (this.dom.hwNetUpBar) {
        var upPct = Math.min(100, Math.max(2, Math.round((this.simulatedNetUp / 15000) * 100)));
        this.dom.hwNetUpBar.style.width = upPct + '%';
      }

      // Hardware-Accelerated Vector SVG Sparkline Renders
      if (this.sparklineEngine) {
        this.sparklineEngine.render('cpu', this.hwCpuHistory);
        this.sparklineEngine.render('gpu', this.hwGpuHistory);
        this.sparklineEngine.render('ram', this.hwRamHistory);
        this.sparklineEngine.render('disk', this.hwDiskHistory);
        this.sparklineEngine.render('netDown', this.hwNetDownHistory);
        this.sparklineEngine.render('netUp', this.hwNetUpHistory);
      }

      // Fallback text sparkline updates if non-SVG elements present
      if (this.dom.hwCpuSpark && this.dom.hwCpuSpark.tagName !== 'svg' && this.dom.hwCpuSpark.tagName !== 'SVG') {
        this.dom.hwCpuSpark.textContent = this.getSparklineString(this.hwCpuHistory);
      }
      if (this.dom.hwGpuSpark && this.dom.hwGpuSpark.tagName !== 'svg' && this.dom.hwGpuSpark.tagName !== 'SVG') {
        this.dom.hwGpuSpark.textContent = this.getSparklineString(this.hwGpuHistory);
      }
      if (this.dom.hwRamSpark && this.dom.hwRamSpark.tagName !== 'svg' && this.dom.hwRamSpark.tagName !== 'SVG') {
        this.dom.hwRamSpark.textContent = this.getSparklineString(this.hwRamHistory);
      }
      if (this.dom.hwDiskSpark && this.dom.hwDiskSpark.tagName !== 'svg' && this.dom.hwDiskSpark.tagName !== 'SVG') {
        this.dom.hwDiskSpark.textContent = this.getSparklineString(this.hwDiskHistory);
      }

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
      if (!this.isPlaybackPaused && this.showNewsFeed && this.newsItems && this.newsItems.length > 1) {
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

        // Persist wallpaper URL and photographer credit to eliminate startup blank pop-in
        try {
          if (incomingUrl && typeof localStorage !== 'undefined') {
            localStorage.setItem('local_wally_cached_bg_url', incomingUrl);
            if (bg && bg.photographer) {
              localStorage.setItem('local_wally_cached_bg_photographer', bg.photographer);
            }
            if (bg && bg.photographerUrl) {
              localStorage.setItem('local_wally_cached_bg_photographer_url', bg.photographerUrl);
            }
          }
        } catch (e) {}
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
      if (!this.hwFallbackTimer && this.showHardwareMonitor) {
        this.executeHwFallbackTick();
        this.hwFallbackTimer = setInterval(this.checkHwFallback.bind(this), 2000);
      }
      var rotSec = (global.LOCAL_WALLY_CONFIG && typeof global.LOCAL_WALLY_CONFIG.newsRotateIntervalSeconds === 'number')
        ? Math.max(3, global.LOCAL_WALLY_CONFIG.newsRotateIntervalSeconds)
        : 7;
      if (!this.newsTimer && this.showNewsFeed && this.newsItems && this.newsItems.length > 1) {
        this.newsTimer = setInterval(this.rotateNews.bind(this), rotSec * 1000);
      }
      if (!this.syncInterval) {
        this.syncInterval = setInterval(this.checkAndSync.bind(this), 60000);
      }
      if (this.pomodoro && this.showPomodoro) {
        this.pomodoro.resumeTicker();
      }
      if (this.pendingSnapshot) {
        var snap = this.pendingSnapshot;
        this.pendingSnapshot = null;
        this.renderAll(snap);
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
      if (this.pomodoro) {
        this.pomodoro.sleepTicker();
      }
      if (this.mediaVisualizer) {
        this.mediaVisualizer.sleep();
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

      // 1.5. Render 60 FPS Audio Visualizer
      if (this.mediaVisualizer) {
        this.mediaVisualizer.render(dt);
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

      // Next frame with zero-allocation pre-bound callback
      if (!this._boundLoop) {
        this._boundLoop = this.loop.bind(this);
      }
      this.animationFrameId = requestAnimationFrame(this._boundLoop);
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

  global.SvgSparklineEngine = SvgSparklineEngine;
  global.MediaVisualizerEngine = MediaVisualizerEngine;
  global.PomodoroEngine = PomodoroEngine;
  global.SolarLightingEngine = SolarLightingEngine;
  global.App = App;
})(typeof window !== 'undefined' ? window : this);
