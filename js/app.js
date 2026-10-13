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

  var MOON_PHASES = Object.freeze([
    { name: 'New Moon', glyph: '🌑' },
    { name: 'Waxing Crescent', glyph: '🌒' },
    { name: 'First Quarter', glyph: '🌓' },
    { name: 'Waxing Gibbous', glyph: '🌔' },
    { name: 'Full Moon', glyph: '🌕' },
    { name: 'Waning Gibbous', glyph: '🌖' },
    { name: 'Last Quarter', glyph: '🌗' },
    { name: 'Waning Crescent', glyph: '🌘' }
  ]);

  var WESTERN_NAMES = Object.freeze([
    'Wolf Moon', 'Snow Moon', 'Worm Moon', 'Pink Moon',
    'Flower Moon', 'Strawberry Moon', 'Buck Moon', 'Sturgeon Moon',
    'Harvest Moon', 'Hunter\'s Moon', 'Beaver Moon', 'Cold Moon'
  ]);

  var VEDIC_NAMES = Object.freeze([
    'Pausha Purnima', 'Magha Purnima', 'Phalguna Purnima', 'Chaitra Purnima',
    'Vaishakha Purnima', 'Jyeshtha Purnima', 'Ashadha Purnima', 'Shravana Purnima',
    'Bhadrapada Purnima', 'Ashvina Purnima', 'Kartika Purnima', 'Margashirsha Purnima'
  ]);

  var METEOR_SHOWERS = Object.freeze([
    { name: 'Quadrantids', startM: 0, startD: 1, endM: 0, endD: 12, peak: 'Jan 3-4' },
    { name: 'Lyrids', startM: 3, startD: 14, endM: 3, endD: 30, peak: 'Apr 22-23' },
    { name: 'Eta Aquariids', startM: 3, startD: 19, endM: 4, endD: 28, peak: 'May 5-6' },
    { name: 'Delta Aquariids', startM: 6, startD: 12, endM: 7, endD: 23, peak: 'Jul 29-30' },
    { name: 'Perseids', startM: 6, startD: 17, endM: 7, endD: 24, peak: 'Aug 12-13' },
    { name: 'Orionids', startM: 9, startD: 2, endM: 10, endD: 7, peak: 'Oct 21-22' },
    { name: 'Leonids', startM: 10, startD: 6, endM: 10, endD: 30, peak: 'Nov 17-18' },
    { name: 'Geminids', startM: 11, startD: 4, endM: 11, endD: 20, peak: 'Dec 13-14' },
    { name: 'Ursids', startM: 11, startD: 17, endM: 11, endD: 26, peak: 'Dec 22-23' }
  ]);

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

    // Zero-CPU Silence Sleep state (wall-clock silence window, ms since silence began; 0 = sound)
    this.silenceSince = 0;
    this.isSleeping = false;
    // Cached media wrap width captured before layout writes (C-F02 reflow avoidance)
    this._wrapWidthSample = 0;

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

  MediaVisualizerEngine.prototype.captureWrapWidth = function() {
    if (!this.dom.canvas) return;
    var wrap = this.dom.canvas.parentElement;
    this._wrapWidthSample = (wrap && wrap.clientWidth > 0) ? wrap.clientWidth : 0;
  };

  MediaVisualizerEngine.prototype.resize = function() {
    if (!this.dom.canvas) return;
    var wrap = this.dom.canvas.parentElement;
    // Prefer a fresh pre-write sample when present so this read does not force a reflow (C-F02)
    var wrapWidth = (this._wrapWidthSample > 0) ? this._wrapWidthSample : (wrap ? wrap.clientWidth : 0);
    this._wrapWidthSample = 0;
    if (wrapWidth > 0) {
      var targetW = wrapWidth - 8;
      if (targetW > 60 && Math.abs(this.dom.canvas.width - targetW) > 2) {
        this.dom.canvas.width = targetW;
        this.initGradient();
      }
    }
  };

  MediaVisualizerEngine.prototype.processAudioData = function(audioArray) {
    if (!this.enabled || !audioArray || typeof audioArray.length !== 'number' || audioArray.length <= 0) return;

    var audioLen = audioArray.length;
    var checkLimit = Math.min(128, audioLen);

    if (this.isSleeping) {
      var hasEnergy = false;
      for (var k = 0; k < checkLimit; k++) {
        var sVal = audioArray[k];
        if (typeof sVal === 'number' && Number.isFinite(sVal) && sVal >= 0.005) {
          hasEnergy = true;
          break;
        }
      }
      if (!hasEnergy) return;
    }

    var totalEnergy = 0;
    var isStandardLen = (audioLen === 128);

    for (var i = 0; i < 32; i++) {
      var s, e;
      if (isStandardLen) {
        s = this.bandRanges[i * 2];
        e = this.bandRanges[i * 2 + 1];
      } else {
        s = Math.floor(i * audioLen / 32);
        e = Math.min(audioLen, Math.max(s + 1, Math.floor((i + 1) * audioLen / 32)));
      }
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
      if (this.silenceSince === 0) this.silenceSince = performance.now();
    } else {
      this.silenceSince = 0;
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

  // If energy is silent, track the silence window and enter deep sleep after 1.5s (C-F03)
  if (activeEnergy < 0.005) {
    if (this.silenceSince === 0) this.silenceSince = performance.now();
    if (performance.now() - this.silenceSince >= 1500) {
      this.sleep();
      return;
    }
  } else {
    this.silenceSince = 0;
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
  for (var i = 0; i < 32; i++) {
    this.rawSpectrum[i] = 0;
    this.dampedSpectrum[i] = 0;
  }
  if (this.ctx && this.dom.canvas) {
    this.ctx.clearRect(0, 0, this.dom.canvas.width, this.dom.canvas.height);
  }
};

MediaVisualizerEngine.prototype.wake = function() {
  this.isSleeping = false;
  this.silenceSince = 0;
  var appInstance = global.App || global.app;
  if (appInstance && typeof appInstance.wakeAnimationLoop === 'function') {
    appInstance.wakeAnimationLoop();
  }
};

MediaVisualizerEngine.prototype.hasActiveAnimation = function() {
  if (!this.enabled || this.isSleeping) return false;
  if (this.demoMode > 0) return true;
  for (var i = 0; i < 32; i++) {
    if (this.dampedSpectrum[i] > 0.005 || this.rawSpectrum[i] > 0.005) return true;
  }
  return false;
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
      if (this.dom.card) this.dom.card.title = 'Windows Media Player & 60 FPS Visualizer: Idle (Click to inspect track)';
      this.currentTrackData = null;
      return;
    }

    var title = data.Title || data.title || '';
    var artist = data.Artist || data.artist || '';
    var albumArt = data.AlbumArt || data.albumArt || data.Thumbnail || '';
    var rawSource = data.AppId || data.appId || data.Source || data.source || data.ProcessName || data.processName || '';
    var sourceBadge = 'SMTC';

    if (rawSource) {
      var sLow = String(rawSource).toLowerCase();
      if (sLow.indexOf('spotify') !== -1) sourceBadge = 'Spotify';
      else if (sLow.indexOf('apple') !== -1) sourceBadge = 'Apple Music';
      else if (sLow.indexOf('edge') !== -1) sourceBadge = 'Edge';
      else if (sLow.indexOf('chrome') !== -1) sourceBadge = 'Chrome';
      else if (sLow.indexOf('firefox') !== -1) sourceBadge = 'Firefox';
      else if (sLow.indexOf('vlc') !== -1) sourceBadge = 'VLC';
      else if (sLow.indexOf('music') !== -1) sourceBadge = 'Music';
      else sourceBadge = rawSource.length > 12 ? rawSource.substring(0, 10) + '..' : rawSource;
    }

    this.currentTrackSource = sourceBadge;

    if (title) {
      this.currentTrackData = {
        title: title,
        artist: artist || 'Unknown Artist',
        source: sourceBadge,
        albumArt: albumArt
      };
      if (this.dom.title) {
        this.dom.title.textContent = title;
        this.dom.title.title = title;
      }
      if (this.dom.artist) {
        this.dom.artist.textContent = artist || 'Unknown Artist';
        this.dom.artist.title = artist || 'Unknown Artist';
      }
      if (this.dom.badge) this.dom.badge.textContent = sourceBadge;
      if (this.dom.card) {
        this.dom.card.title = 'Now Playing: ' + title + (artist ? ' - ' + artist : '') + ' (' + sourceBadge + ') (Click to inspect track)';
      }

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
      this.currentTrackData = null;
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
      if (this.dom.card) this.dom.card.title = 'Windows Media Player & 60 FPS Visualizer: Idle (Click to inspect track)';
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
    this.focusGradient = null;
    this.breakGradient = null;
    this.initGradients();

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

  PomodoroEngine.prototype.playChime = function() {
    try {
      var AudioCtx = (typeof window !== 'undefined') ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AudioCtx) return;
      var ctx = new AudioCtx();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.85);
      setTimeout(function() {
        try { ctx.close(); } catch (e) {}
      }, 1000);
    } catch (e) {}
  };

  PomodoroEngine.prototype.notifyCompletion = function(title, body) {
    try {
      if (typeof Notification !== 'undefined') {
        if (Notification.permission === 'granted') {
          new Notification(title, { body: body, silent: true });
        } else if (Notification.permission === 'default' && typeof Notification.requestPermission === 'function') {
          Notification.requestPermission();
        }
      }
    } catch (e) {}
  };

  PomodoroEngine.prototype.onComplete = function() {
    this.pause();
    this.playChime();
    if (this.dom.card) {
      this.dom.card.style.transform = 'scale(1.02)';
      var self = this;
      setTimeout(function() {
        if (self.dom.card) self.dom.card.style.transform = '';
      }, 400);
    }

    if (this.mode === 'focus') {
      this.completedFocusSessions++;
      this.notifyCompletion('Focus Session Complete', 'Time for a break! Take a deep breath and stretch.');
      if (this.completedFocusSessions % 4 === 0) {
        this.setMode('longBreak');
      } else {
        this.setMode('break');
      }
    } else {
      this.notifyCompletion('Break Finished', 'Ready to focus? Start your next productive session.');
      this.setMode('focus');
    }
  };

  PomodoroEngine.prototype.render = function() {
    var m = Math.floor(this.remainingSeconds / 60);
    var s = this.remainingSeconds % 60;
    var mStr = m < 10 ? '0' + m : '' + m;
    var sStr = s < 10 ? '0' + s : '' + s;
    var timeStr = mStr + ':' + sStr;
    if (this.dom.time && this.dom.time.textContent !== timeStr) {
      this.dom.time.textContent = timeStr;
    }
    if (this.dom.card) {
      var pModeLabel = this.mode === 'focus' ? 'Focus' : this.mode === 'break' ? 'Short Break' : 'Long Break';
      var pTitle = 'Pomodoro: ' + pModeLabel + ' (' + timeStr + (this.isRunning ? ' - Running' : ' - Paused') + ') (Click to inspect focus controls)';
      if (this.dom.card.title !== pTitle) this.dom.card.title = pTitle;
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

        if (!this.focusGradient) {
          this.initGradients();
        }
        var grad = this.mode === 'focus' ? this.focusGradient : this.breakGradient;
        ctx.strokeStyle = grad || (this.mode === 'focus' ? '#10b981' : '#fbbf24');
        ctx.stroke();
      }
    }
  };

  PomodoroEngine.prototype.initGradients = function() {
    if (!this.ctx) return;
    this.focusGradient = this.ctx.createLinearGradient(10, 10, 78, 78);
    this.focusGradient.addColorStop(0, '#10b981');
    this.focusGradient.addColorStop(1, '#38bdf8');

    this.breakGradient = this.ctx.createLinearGradient(10, 10, 78, 78);
    this.breakGradient.addColorStop(0, '#fbbf24');
    this.breakGradient.addColorStop(1, '#f43f5e');
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

  SolarLightingEngine.prototype.update = function(now, lat, lng, sunPos) {
    if (!this.enabled || !global.SunCalc) {
      if (!this.isReset) {
        this.resetStyles();
      }
      return;
    }
    this.isReset = false;

    try {
      now = now || new Date();
      var pos = sunPos || global.SunCalc.getPosition(now, lat, lng);
      var alpha = pos.altitude;
      var theta = pos.azimuth;

      if (typeof alpha !== 'number' || isNaN(alpha) || typeof theta !== 'number' || isNaN(theta)) {
        return;
      }

      if (this.lastAltitude !== null && this.lastAzimuth !== null) {
        if (Math.abs(alpha - this.lastAltitude) <= 0.005 && Math.abs(theta - this.lastAzimuth) <= 0.005) {
          return;
        }
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
        // Deep Night (alpha < -0.10): Soft moonlit luminescence keeps the wallpaper visible
        bloomInner = 'rgba(219, 234, 254, 0.22)';
        bloomOuter = 'rgba(186, 230, 253, 0.0)';
        bloomOpacity = 0.18;
        bloomSize = '70vmax';
        // Night ambient wash: subtle cool slate tint using soft-light to avoid crushing shadows
        ambientBg = 'linear-gradient(180deg, rgba(2, 6, 23, 0.20) 0%, rgba(15, 23, 42, 0.25) 100%)';
        ambientOpacity = 0.40;
        ambientBlend = 'soft-light';
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
        filterStr = 'brightness(0.90) contrast(1.04) saturate(1.05) hue-rotate(8deg)';
      } else {
        // Deep Night (alpha < -0.15): Preserve natural wallpaper clarity and illumination with gentle nocturnal cooling
        filterStr = 'brightness(0.86) contrast(1.02) saturate(0.95)';
      }

      // 6. Directional Sky Vignette Shifting
      var focalX = 50 + 20 * Math.sin(theta);
      var focalY = 50 - 20 * Math.cos(theta);
      var vignetteStr = '';
      if (alpha < -0.10) {
        // Soft nocturnal vignette: wide clear center to keep wallpaper details prominent
        vignetteStr = 'radial-gradient(circle at ' + focalX.toFixed(1) + '% ' + focalY.toFixed(1) + '%, transparent 55%, rgba(2, 6, 23, 0.22) 100%), linear-gradient(180deg, rgba(2, 6, 23, 0.08) 0%, transparent 45%, rgba(2, 6, 23, 0.22) 100%)';
      } else {
        vignetteStr = 'radial-gradient(circle at ' + focalX.toFixed(1) + '% ' + focalY.toFixed(1) + '%, transparent 35%, rgba(2, 6, 23, 0.48) 100%), linear-gradient(180deg, rgba(2, 6, 23, 0.2) 0%, transparent 40%, rgba(2, 6, 23, 0.5) 100%)';
      }

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
    this.staticXStr = new Array(this.pointsCount);
    this.staticCp1XStr = new Array(this.pointsCount - 1);
    this.staticCp2XStr = new Array(this.pointsCount - 1);

    for (var i = 0; i < this.pointsCount; i++) {
      this.staticX[i] = i * this.dx;
      this.staticXStr[i] = (Math.round(this.staticX[i] * 10) / 10).toString();
    }
    for (var j = 0; j < this.pointsCount - 1; j++) {
      if (j === 0) {
        this.staticCp1X[j] = this.staticX[0] + this.dx / 6;
      } else {
        this.staticCp1X[j] = this.staticX[j] + this.dx / 3;
      }
      this.staticCp1XStr[j] = (Math.round(this.staticCp1X[j] * 10) / 10).toString();

      if (j === this.pointsCount - 2) {
        this.staticCp2X[j] = this.staticX[this.pointsCount - 1] - this.dx / 6;
      } else {
        this.staticCp2X[j] = this.staticX[j + 1] - this.dx / 3;
      }
      this.staticCp2XStr[j] = (Math.round(this.staticCp2X[j] * 10) / 10).toString();
    }

    this.yCoords = new Float32Array(this.pointsCount);
    this.curveParts = new Array(this.pointsCount - 1);
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

    var parts = this.curveParts;
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

      var rCp1y = Math.round(cp1y * 10) / 10;
      var rCp2y = Math.round(cp2y * 10) / 10;
      var rP2y = Math.round(p2y * 10) / 10;

      parts[j] = ' C ' + this.staticCp1XStr[j] + ',' + rCp1y + ' ' +
                 this.staticCp2XStr[j] + ',' + rCp2y + ' ' +
                 this.staticXStr[j + 1] + ',' + rP2y;
    }

    var curveD = parts.join('');
    var y0 = Math.round(this.yCoords[0] * 10) / 10;
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
        if (track._lastLineD !== paths.lineD) {
          track._lastLineD = paths.lineD;
          track.linePath.setAttribute('d', paths.lineD);
        }
      }
      if (track.areaPath && typeof track.areaPath.setAttribute === 'function') {
        if (track._lastAreaD !== paths.areaD) {
          track._lastAreaD = paths.areaD;
          track.areaPath.setAttribute('d', paths.areaD);
        }
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
      else if (tab === 'precip') {
        if (p.precipProb != null && Number.isFinite(p.precipProb)) v = p.precipProb;
        else continue;
      }
      else if (tab === 'wind') v = isF ? p.windSpeedMph : p.windSpeedKm;
      else if (tab === 'humidity') {
        if (p.humidity != null && Number.isFinite(p.humidity)) v = p.humidity;
        else continue;
      }
      else if (tab === 'aqi') {
        if (p.aqi != null && Number.isFinite(p.aqi)) {
          v = p.aqi;
        } else {
          continue;
        }
      }

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
    if (!this.dom.svg) return;
    if (!this.points || !this.points.length) {
      if (this.dom.linePath) this.dom.linePath.setAttribute('d', '');
      if (this.dom.areaPath) this.dom.areaPath.setAttribute('d', '');
      this.ensureElementPool(0);
      return;
    }

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
    // Metric validity is tracked separately from coordinates: missing values
    // never contribute coordinates, dots, labels, or spline control points (LW09)
    var valid = this._validBuf && this._validBuf.length >= N ? this._validBuf : (this._validBuf = new Uint8Array(Math.max(32, N)));
    var colors = this.colorMap[tab] || this.colorMap.temp;

    for (var i = 0; i < N; i++) {
      var p = pts[i] || {};
      var v = null;
      var label = '';
      if (tab === 'temp') {
        v = isF ? p.tempF : p.tempC;
        if (typeof v !== 'number' || !Number.isFinite(v)) { v = null; label = '--'; }
        else { label = Math.round(v) + '°'; }
      } else if (tab === 'feels_like') {
        v = isF ? p.apparentF : p.apparentC;
        if (typeof v !== 'number' || !Number.isFinite(v)) { v = null; label = '--'; }
        else { label = Math.round(v) + '°'; }
      } else if (tab === 'precip') {
        v = p.precipProb != null ? p.precipProb : null;
        if (typeof v !== 'number' || !Number.isFinite(v)) { v = null; label = '--'; }
        else { label = Math.round(v) + '%'; }
      } else if (tab === 'wind') {
        v = isF ? p.windSpeedMph : p.windSpeedKm;
        if (typeof v !== 'number' || !Number.isFinite(v)) { v = null; label = '--'; }
        else { label = Math.round(v) + (isF ? ' mph' : ' km/h'); }
      } else if (tab === 'humidity') {
        v = p.humidity != null ? p.humidity : null;
        if (typeof v !== 'number' || !Number.isFinite(v)) { v = null; label = '--'; }
        else { label = Math.round(v) + '%'; }
      } else if (tab === 'aqi') {
        if (p.aqi != null && Number.isFinite(p.aqi)) {
          v = p.aqi;
          label = 'AQI ' + Math.round(v);
        } else {
          v = null;
          label = '--';
        }
      }

      var dotColor = colors.dot;
      if (tab === 'aqi') {
        dotColor = (p.aqi != null && p.aqiColor) ? p.aqiColor : '#94a3b8';
      }

      if (v === null) {
        // Missing measurement: hidden dot/labels, no coordinates, never a
        // substituted minimum value
        valid[i] = 0;
        var dotHidden = this.dotPool[i];
        if (dotHidden) dotHidden.style.visibility = 'hidden';
        var valHidden = this.valLabelPool[i];
        if (valHidden) valHidden.style.visibility = 'hidden';
        continue;
      }
      valid[i] = 1;

      var norm = (range > 0) ? Math.max(0, Math.min(1, (v - minB) / range)) : 0.5;
      if (!Number.isFinite(norm)) norm = 0.5;
      var xVal = xStart + i * dx;
      var yVal = yBottom - norm * (yBottom - yTop);
      xs[i] = Number.isFinite(xVal) ? xVal : xStart;
      ys[i] = Number.isFinite(yVal) ? yVal : yBottom;

      // Update dot
      var dot = this.dotPool[i];
      var dotTooltip = (p.label || p.time || '') + ': ' + label + (tab === 'temp' ? ' Temperature' : tab === 'feels_like' ? ' Feels Like' : tab === 'precip' ? ' Precip Chance' : tab === 'wind' ? ' Wind Speed' : tab === 'humidity' ? ' Humidity' : ' Air Quality');
      if (dot) {
        dot.style.visibility = 'visible';
        dot.setAttribute('cx', xs[i].toFixed(1));
        dot.setAttribute('cy', ys[i].toFixed(1));
        dot.setAttribute('fill', dotColor);
        dot.setAttribute('title', dotTooltip);
        var titleNode = (typeof dot.getElementsByTagName === 'function')
          ? dot.getElementsByTagName('title')[0]
          : (typeof dot.querySelector === 'function' ? dot.querySelector('title') : null);
        if (!titleNode && typeof document !== 'undefined' && document.createElementNS) {
          titleNode = document.createElementNS('http://www.w3.org/2000/svg', 'title');
          if (dot.appendChild) {
            dot.appendChild(titleNode);
          }
        }
        if (titleNode) {
          titleNode.textContent = dotTooltip;
        }
      }

      // Update val text
      var valEl = this.valLabelPool[i];
      if (valEl) {
        valEl.style.visibility = 'visible';
        valEl.setAttribute('x', xs[i].toFixed(1));
        valEl.setAttribute('y', (ys[i] - 8).toFixed(1));
        valEl.textContent = label;
        valEl.setAttribute('title', dotTooltip);
      }

      // Update time text
      var timeEl = this.timeLabelPool[i];
      if (timeEl) {
        timeEl.setAttribute('x', xs[i].toFixed(1));
        timeEl.setAttribute('y', '114');
        timeEl.textContent = p.label || p.time || '';
      }
    }

    // Catmull-Rom cubic Bezier path generation over contiguous VALID runs only:
    // a missing point always produces a gap, never a bridge or a false dip,
    // and never acts as a spline control point (LW09)
    var lineD = '';
    var areaD = '';
    var runStart = -1;
    var r, j;

    function buildRunD(self, s, e) {
      var seg = '';
      for (var k = s; k < e; k++) {
        var p0x = (k === s) ? xs[k] : xs[k - 1];
        var p0y = (k === s) ? ys[k] : ys[k - 1];
        var p1x = xs[k];
        var p1y = ys[k];
        var p2x = xs[k + 1];
        var p2y = ys[k + 1];
        var p3x = (k + 2 > e) ? xs[e] : xs[k + 2];
        var p3y = (k + 2 > e) ? ys[e] : ys[k + 2];

        var cp1x = (k === s) ? (p1x + (p2x - p1x) / 6) : (p1x + (p2x - p0x) / 6);
        var cp1y = (k === s) ? (p1y + (p2y - p1y) / 6) : (p1y + (p2y - p0y) / 6);
        var cp2x = (k + 2 > e) ? (p2x - (p2x - p1x) / 6) : (p2x - (p3x - p1x) / 6);
        var cp2y = (k + 2 > e) ? (p2y - (p2y - p1y) / 6) : (p2y - (p3y - p1y) / 6);

        if (!Number.isFinite(cp1x)) cp1x = p1x;
        if (!Number.isFinite(cp1y)) cp1y = p1y;
        if (!Number.isFinite(cp2x)) cp2x = p2x;
        if (!Number.isFinite(cp2y)) cp2y = p2y;

        if (cp1y < yTop - 4) cp1y = yTop - 4; else if (cp1y > yBottom + 4) cp1y = yBottom + 4;
        if (cp2y < yTop - 4) cp2y = yTop - 4; else if (cp2y > yBottom + 4) cp2y = yBottom + 4;

        seg += ' C ' + cp1x.toFixed(1) + ',' + cp1y.toFixed(1) + ' ' +
               cp2x.toFixed(1) + ',' + cp2y.toFixed(1) + ' ' +
               p2x.toFixed(1) + ',' + p2y.toFixed(1);
      }
      var x0s = xs[s].toFixed(1);
      var y0s = ys[s].toFixed(1);
      var xEs = xs[e].toFixed(1);
      lineD += 'M ' + x0s + ',' + y0s + seg;
      // Area fill closes independently per run
      areaD += 'M ' + x0s + ',' + yBase + ' L ' + x0s + ',' + y0s + seg + ' L ' + xEs + ',' + yBase + ' Z';
    }

    for (r = 0; r <= N; r++) {
      var inRun = (r < N) && valid[r] === 1;
      if (inRun && runStart === -1) {
        runStart = r;
      } else if (!inRun && runStart !== -1) {
        buildRunD(this, runStart, r - 1);
        runStart = -1;
      }
    }

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
    pendingNews: null,
    pendingTrack: null,
    syncPending: false,
    syncPendingForce: false,

    escapeHtml: function(str) {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    // Precompiled: ISO strings carrying an explicit UTC offset or Z suffix (CORR-1).
    // Offset-naive isoTime must not be Date-parsed as host-local in horizon filters.
    isoTimeHasOffsetRe: /(?:Z|[+-]\d{2}:\d{2})$/i,

    setDomText: function(el, text) {
      if (el && el.textContent !== text) {
        el.textContent = text;
      }
    },

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
    newsTransitionTimer: null,
    _newsDotsDelegated: false,
    _tzFormatters: null,

    // Animation Loop State
    animationFrameId: null,
    isRunning: false,
    lastFrameTime: 0,
    _paceDeadline: 0,
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

    /**
     * Product version (v0.8.20). Rendered into #hud-version (bottom-right of
     * the card) so the running build is identifiable at a glance.
     */
    VERSION: '0.8.20',
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
      var docHidden = (typeof document !== 'undefined' && document.hidden) ? true : false;
      var livelyPaused = (global.LivelyBridge && global.LivelyBridge.isPaused) ? true : false;
      this.isPlaybackPaused = docHidden || livelyPaused;

      this.cacheDom();
      this.restoreCachedWallpaper();
      // Version stamp + taskbar-aware watermark placement (v0.8.20).
      if (this.dom.hudVersion) this.dom.hudVersion.textContent = 'v' + this.VERSION;
      this.positionWallpaperCredit();
      // 48-hour artifact retention (v0.8.18): sweep on boot and daily; the
      // daily tick skips while parked so a sleeping wallpaper does no work.
      this.purgeStaleArtifacts();
      var purgeSelf = this;
      this._artifactPurgeTimer = setInterval(function() {
        if (!purgeSelf.isPlaybackPaused) purgeSelf.purgeStaleArtifacts();
      }, 24 * 60 * 60 * 1000);
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

      // Reconcile playback state before starting loop
      if (global.LivelyBridge) {
        this.isPlaybackPaused = !!global.LivelyBridge.isPaused;
      }
      if (!this.isPlaybackPaused) {
        this.startLoop();
      } else {
        this.stopLoop();
        console.log('[App] Initial document hidden or Lively paused; render loop parked.');
      }
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
        hudWeatherCard: document.getElementById('hud-weather-card'),
        hudMetricsRow: document.getElementById('hud-metrics-row'),
        metricHumidity: document.getElementById('metric-humidity'),
        metricWind: document.getElementById('metric-wind'),
        metricPrecip: document.getElementById('metric-precip'),
        hudEphemerisCard: document.getElementById('hud-ephemeris-card'),
        hudEphemerisSunRow: document.getElementById('hud-ephemeris-sun-row'),
        hudEphemerisMoonRow: document.getElementById('hud-ephemeris-moon-row'),
        ephemerisDayRain: document.getElementById('ephemeris-day-rain'),
        ephemerisRainVal: document.getElementById('ephemeris-rain-val'),
        ephemerisRainSub: document.getElementById('ephemeris-rain-sub'),
        ephemerisDayPeak: document.getElementById('ephemeris-day-peak'),
        ephemerisPeakVal: document.getElementById('ephemeris-peak-val'),
        ephemerisPeakSub: document.getElementById('ephemeris-peak-sub'),
        ephemerisDaySun: document.getElementById('ephemeris-day-sun'),
        ephemerisDaylightLabel: document.getElementById('ephemeris-daylight-label'),
        ephemerisDaylightVal: document.getElementById('ephemeris-daylight-val'),
        ephemerisDaylightSub: document.getElementById('ephemeris-daylight-sub'),
        ephemerisNightGolden: document.getElementById('ephemeris-night-golden'),
        ephemerisGoldenVal: document.getElementById('ephemeris-golden-val'),
        ephemerisGoldenSub: document.getElementById('ephemeris-golden-sub'),
        ephemerisNightMoon: document.getElementById('ephemeris-night-moon'),
        ephemerisNightMoonStatus: document.getElementById('ephemeris-night-moon-status'),
        ephemerisNightEvent: document.getElementById('ephemeris-night-event'),
        ephemerisEventLabel: document.getElementById('ephemeris-event-label'),
        ephemerisEventVal: document.getElementById('ephemeris-event-val'),
        ephemerisEventSub: document.getElementById('ephemeris-event-sub'),
        ephemerisSunrise: document.getElementById('ephemeris-sunrise'),
        ephemerisNoon: document.getElementById('ephemeris-noon'),
        ephemerisSunset: document.getElementById('ephemeris-sunset'),
        ephemerisMoonrise: document.getElementById('ephemeris-moonrise'),
        ephemerisNightMoonGlyph: document.getElementById('ephemeris-night-moon-glyph'),
        ephemerisNightMoonPhase: document.getElementById('ephemeris-night-moon-phase'),
        ephemerisNightMoonIllum: document.getElementById('ephemeris-night-moon-illum'),
        ephemerisMoonset: document.getElementById('ephemeris-moonset'),
        hudHoverPopover: document.getElementById('hud-hover-popover'),
        hudAqiCard: document.getElementById('hud-aqi-card'),
        hudAqiBadge: document.getElementById('hud-aqi-badge'),
        hudAqiCategory: document.getElementById('hud-aqi-category'),
        hudAqiFill: document.getElementById('hud-aqi-fill'),
        hudPm25: document.getElementById('hud-pm25'),
        hudPm10: document.getElementById('hud-pm10'),

        // Contextual Detail Surface DOM Nodes
        hudCardDetail: document.getElementById('hud-card-detail'),
        hudDetailIcon: document.getElementById('hud-detail-icon'),
        hudDetailTitle: document.getElementById('hud-detail-title'),
        hudDetailBody: document.getElementById('hud-detail-body'),
        hudDetailClose: document.getElementById('hud-detail-close'),

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
        hudVersion: document.getElementById('hud-version'),
        unsplashCredit: document.getElementById('unsplash-credit'),
        diagPanel: document.getElementById('diagnostic-panel'),
        diagNewsStatus: document.getElementById('diag-news-status'),
        diagWallpaperStatus: document.getElementById('diag-wallpaper-status'),
        diagGpu: document.getElementById('diag-gpu'),
        diagExportBtn: document.getElementById('diag-export-settings'),
        diagImportBtn: document.getElementById('diag-import-settings'),
        diagImportFile: document.getElementById('diag-import-file'),
        diagBackupStatus: document.getElementById('diag-backup-status'),
        locManageInput: document.getElementById('location-manual-input'),
        locSuggestList: document.getElementById('location-suggest-list'),
        locStatusLabel: document.getElementById('location-status-label'),
        locAutoBtn: document.getElementById('location-use-auto'),
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
        hudNewsBg: document.getElementById('hud-news-bg'),
        hudNewsTitle: document.getElementById('hud-news-title'),
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

    /**
     * Wallpaper source watermark helpers (v0.8.16). Provider-first labels:
     * "Wallhaven · <photographer>" when a REAL photographer exists, plain
     * "Wallhaven" for the providers' generic stand-in names (Wallhaven
     * Community, Unsplash Artist, …). The provider is derivable from the URL
     * hostname too, so the watermark shows correctly at boot even for caches
     * written by older builds.
     */
    _wallpaperProviderFromUrl: function(url) {
      var u = String(url || '').toLowerCase();
      if (u.indexOf('wallhaven') !== -1) return 'Wallhaven';
      if (u.indexOf('unsplash') !== -1) return 'Unsplash';
      if (u.indexOf('pexels') !== -1) return 'Pexels';
      if (u.indexOf('pixabay') !== -1) return 'Pixabay';
      return '';
    },

    _wallpaperCreditLabel: function(providerName, photographer) {
      var provider = String(providerName || '').trim();
      var who = String(photographer || '').trim();
      var generic = /^(wallhaven community|unsplash artist|pexels creator|pixabay creator|ambient nature)$/i;
      var whoIsUseful = who && !generic.test(who) &&
        (!provider || who.toLowerCase().indexOf(provider.toLowerCase()) === -1);
      if (provider && whoIsUseful) return provider + ' · ' + who;
      if (provider) return provider;
      if (who) return who;
      return '';
    },

    _wallpaperProviderHome: function(provider) {
      var map = {
        Wallhaven: 'https://wallhaven.cc',
        Unsplash: 'https://unsplash.com',
        Pexels: 'https://www.pexels.com',
        Pixabay: 'https://pixabay.com'
      };
      return map[provider] || 'https://unsplash.com';
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
          var safeCachedUrl = String(cachedUrl || '').replace(/["\\\n\r]/g, '');
          this.dom.bgA.style.backgroundImage = 'url("' + safeCachedUrl + '")';
          if (this.dom.unsplashCredit) {
            // Always show the watermark when a wallpaper was restored —
            // provider-first, derived from cache or the URL hostname so old
            // caches (no provider key) still label correctly (v0.8.16).
            var cachedProvider = '';
            try { cachedProvider = localStorage.getItem('local_wally_cached_bg_provider') || ''; } catch (e3) { cachedProvider = ''; }
            var bootProvider = cachedProvider || this._wallpaperProviderFromUrl(cachedUrl);
            var bootLabel = this._wallpaperCreditLabel(bootProvider, cachedPhotographer);
            if (bootLabel) {
              this.dom.unsplashCredit.textContent = bootLabel;
              this.dom.unsplashCredit.classList.add('is-visible');
              this.positionWallpaperCredit();
              var bootHref = (cachedPhotographerUrl && /^https:\/\//i.test(String(cachedPhotographerUrl).trim()))
                ? String(cachedPhotographerUrl).trim()
                : this._wallpaperProviderHome(bootProvider);
              this.dom.unsplashCredit.href = bootHref;
              this.dom.unsplashCredit.setAttribute('title', 'Wallpaper source: ' + bootHref);
              this.dom.unsplashCredit.setAttribute('target', '_blank');
              this.dom.unsplashCredit.setAttribute('rel', 'noopener noreferrer');
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
      if (this._eventsBound) return;
      this._eventsBound = true;
      var self = this;

      // Handle window resize (coalesced via RAF with debounced contrast sampling)
      var resizeRaf = null;
      var contrastDebounceTimer = null;
      window.addEventListener('resize', function() {
        if (resizeRaf) cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(function() {
          resizeRaf = null;
          if (self.particles) self.particles.resize();
          self.updateSky();
          self.updateGpuDiagnostics();
          self.updateLayoutAutoResize();
          self.wakeAnimationLoop();

          if (self.contrastMode === 'auto' && self.lastLoadedImage) {
            if (contrastDebounceTimer) clearTimeout(contrastDebounceTimer);
            contrastDebounceTimer = setTimeout(function() {
              contrastDebounceTimer = null;
              if (self.contrastMode === 'auto' && self.lastLoadedImage) {
                self.adaptContrastToBackground(self.lastLoadedImage);
              }
            }, 150);
          }
        });
      });

      // Manual refresh control removed (v0.8.4): news and atmosphere update
      // automatically on their own cadences — news every 5 minutes within the
      // quota firewall, atmosphere on its cache TTL.

      // Settings Backup & Restore (v0.8.6): wired inside the diagnostic panel
      // ('D'). Export downloads all properties incl. keys + app storage as one
      // JSON file; import re-applies them through the Lively host (or the
      // bridge emitter in preview) and reloads.
      if (this.dom.diagExportBtn) {
        this.dom.diagExportBtn.addEventListener('click', function() {
          self.exportSettings();
        });
      }
      if (this.dom.diagImportBtn) {
        this.dom.diagImportBtn.addEventListener('click', function() {
          self.openImportPicker();
        });
      }
      if (this.dom.diagImportFile) {
        this.dom.diagImportFile.addEventListener('change', function() {
          var picked = self.dom.diagImportFile.files && self.dom.diagImportFile.files[0];
          self.importSettingsFile(picked);
        });
      }

      // Manual location management (v0.8.7): suggestions dropdown, keyboard
      // navigation, Enter to apply, automatic-location switch back.
      if (this.dom.locManageInput) {
        this.dom.locManageInput.addEventListener('input', function() {
          self._handleLocationInput();
        });
        this.dom.locManageInput.addEventListener('blur', function() {
          // mousedown-selection on the list fires first (preventDefault);
          // delayed hide covers outside-click closure.
          setTimeout(function() { self.hideLocationSuggestions(); }, 150);
        });
        this.dom.locManageInput.addEventListener('keydown', function(e) {
          if (e.key === 'ArrowDown') { e.preventDefault(); self.moveLocationSuggestion(1); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); self.moveLocationSuggestion(-1); }
          else if (e.key === 'Enter') {
            e.preventDefault();
            if (self._locSuggestActive >= 0 && self._locSuggestOptions[self._locSuggestActive]) {
              self.selectLocationSuggestion(self._locSuggestActive);
            } else {
              self._applyManualLocationFromInput();
            }
          } else if (e.key === 'Escape') {
            self.hideLocationSuggestions();
          }
        });
      }
      if (this.dom.locAutoBtn) {
        this.dom.locAutoBtn.addEventListener('click', function() {
          self.useAutomaticLocation();
        });
      }

      // Adopt silently-detected location changes (travel, reboot elsewhere):
      // the persisted-location boot path detects city changes in the
      // background without any prompt; refresh atmosphere for the new place.
      if (global.ApiService && global.ApiService.onLocationChanged) {
        global.ApiService.onLocationChanged(function() {
          if (self.showDiagnostics) self.updateLocationDiagnostics();
          self.loadAtmosphere(true);
        });
      }

      // Keyboard shortcuts
      window.addEventListener('keydown', function(e) {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;

        // Fix 12: Trap Tab focus inside open detail modal
        if (e.key === 'Tab' && self.isDetailOpen && self.dom.hudCardDetail) {
          var focusable = self.dom.hudCardDetail.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          if (focusable && focusable.length > 0) {
            var firstEl = focusable[0];
            var lastEl = focusable[focusable.length - 1];
            if (e.shiftKey) {
              if (document.activeElement === firstEl || !self.dom.hudCardDetail.contains(document.activeElement)) {
                e.preventDefault();
                lastEl.focus();
              }
            } else {
              if (document.activeElement === lastEl || !self.dom.hudCardDetail.contains(document.activeElement)) {
                e.preventDefault();
                firstEl.focus();
              }
            }
          }
        }

        if (e.key === 'd' || e.key === 'D') {
          self.toggleDiagnostics();
        } else if (e.key === 't' || e.key === 'T') {
          self.toggleTempUnit();
        } else if (e.key === 'c' || e.key === 'C') {
          self.cycleContrastMode();
        } else if (e.key === 'm' || e.key === 'M') {
          if (self.mediaVisualizer) self.mediaVisualizer.cycleDemoTrack();
        } else if (e.key === 'p' || e.key === 'P') {
          if (self.pomodoro) self.pomodoro.toggle();
        } else if (e.key === 'Escape' || e.key === 'Esc') {
          if (self.isHoverPopoverOpen) {
            if (e.preventDefault) e.preventDefault();
            self.hideHoverPopover();
          } else if (self.isDetailOpen) {
            if (e.preventDefault) e.preventDefault();
            self.closeCardDetail();
          }
        }
      });

      // Interactive Card Telemetry Detail Surface Triggers
      var interactiveCards = [
        { el: this.dom.hudWeatherCard, type: 'weather' },
        { el: this.dom.hudMetricsRow, type: 'weather' },
        { el: this.dom.hudForecastCard, type: 'forecast' },
        { el: this.dom.hudEphemerisCard, type: 'ephemeris' },
        { el: this.dom.hudAqiCard, type: 'aqi' },
        { el: this.dom.hudHwBlock, type: 'hardware' },
        { el: this.dom.hudNewsBlock, type: 'news' },
        { el: this.dom.pomodoroCard, type: 'pomodoro' },
        { el: this.dom.mediaCard, type: 'media' },
        { el: this.dom.hwBatteryRow, type: 'battery' }
      ];

      function attachCardListener(card) {
        if (!card.el) return;
        card.el.addEventListener('click', function(e) {
          if (e.target && (e.target.closest('button') || e.target.closest('a') || e.target.closest('.forecast-tab') || e.target.closest('.news-dot'))) {
            return;
          }
          self.openCardDetail(card.type, card.el);
        });

        card.el.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' || e.key === ' ') {
            if (e.target && (e.target.closest('button') || e.target.closest('a') || e.target.closest('.forecast-tab'))) return;
            e.preventDefault();
            self.openCardDetail(card.type, card.el);
          }
        });
      }

      for (var i = 0; i < interactiveCards.length; i++) {
        attachCardListener(interactiveCards[i]);
      }

      // Initialize floating progressive disclosure popover system
      this.initHoverPopovers();

      // Close Detail Surface Button
      if (this.dom.hudDetailClose) {
        this.dom.hudDetailClose.addEventListener('click', function(e) {
          e.stopPropagation();
          self.closeCardDetail();
        });
      }

      // Dismiss on click outside detail drawer
      document.addEventListener('click', function(e) {
        if (!self.isDetailOpen) return;
        if (self.dom.hudCardDetail && !self.dom.hudCardDetail.contains(e.target)) {
          var onCard = false;
          for (var j = 0; j < interactiveCards.length; j++) {
            if (interactiveCards[j].el && interactiveCards[j].el.contains(e.target)) {
              onCard = true;
              break;
            }
          }
          if (!onCard) {
            self.closeCardDetail();
          }
        }
      });
    },

    bindLively: function() {
      if (this._livelyBound) return;
      this._livelyBound = true;
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
          if (self.pendingNews) {
            var pNews = self.pendingNews;
            self.pendingNews = null;
            self.renderNews(pNews);
          }
          if (self.pendingTrack) {
            var pTrack = self.pendingTrack;
            self.pendingTrack = null;
            if (self.mediaVisualizer) {
              self.mediaVisualizer.handleTrackUpdate(pTrack);
            }
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
          case 'wallpaperProvider':
            var wallProviders = ['unsplash', 'wallhaven', 'pexels', 'pixabay', 'rotate'];
            var wpVal = (typeof val === 'number') ? (wallProviders[val] || 'unsplash') : (
              val === 'Wallhaven' ? 'wallhaven' :
              val === 'Pexels' ? 'pexels' :
              val === 'Pixabay' ? 'pixabay' :
              val === 'Rotate configured sources' ? 'rotate' :
              String(val).toLowerCase()
            );
            if (global.ApiService) global.ApiService.wallpaperProvider = wpVal;
            self.loadAtmosphere(true);
            break;
          case 'unsplashApiKey':
            if (global.ApiService) global.ApiService.unsplashApiKey = val;
            self.loadAtmosphere(true);
            break;
          case 'wallhavenApiKey':
            if (global.ApiService) global.ApiService.wallhavenApiKey = val;
            if (global.ApiService && (global.ApiService.wallpaperProvider === 'wallhaven' || global.ApiService.wallpaperProvider === 'rotate')) {
              self.loadAtmosphere(true);
            }
            break;
          case 'pexelsApiKey':
            if (global.ApiService) global.ApiService.pexelsApiKey = val;
            if (global.ApiService && (global.ApiService.wallpaperProvider === 'pexels' || global.ApiService.wallpaperProvider === 'rotate')) {
              self.loadAtmosphere(true);
            }
            break;
          case 'pixabayApiKey':
            if (global.ApiService) global.ApiService.pixabayApiKey = val;
            if (global.ApiService && (global.ApiService.wallpaperProvider === 'pixabay' || global.ApiService.wallpaperProvider === 'rotate')) {
              self.loadAtmosphere(true);
            }
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
          case 'newsProvider':
            var nProviders = ['auto', 'google-news', 'newsapi', 'currents', 'rotate'];
            var npVal = (typeof val === 'number') ? (nProviders[val] || 'auto') : (
              val === 'Auto (API keys first)' || val === 'auto' ? 'auto' :
              val === 'NewsAPI' ? 'newsapi' :
              val === 'Currents News' ? 'currents' :
              val === 'Rotate configured sources' ? 'rotate' :
              String(val).toLowerCase()
            );
            if (global.ApiService) global.ApiService.newsProvider = npVal;
            // Intent updates immediately, but the news quota firewall decides
            // network eligibility — property updates cannot bypass it (LW06)
            self.fetchNews();
            break;
          case 'newsApiKey':
            if (global.ApiService) global.ApiService.newsApiKey = val;
            self.fetchNews();
            break;
          case 'currentsApiKey':
            if (global.ApiService) global.ApiService.currentsApiKey = val;
            self.fetchNews();
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
          case 'pomodoroLongBreakMinutes':
            if (self.pomodoro) self.pomodoro.setDurations(null, null, typeof val === 'number' ? val : parseInt(val, 10));
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
          case 'customLocation': {
            // Manual location from the Lively Customize panel (v0.8.10):
            // blank = automatic. Re-delivered values that already match the
            // stored record short-circuit (no re-geocode churn on boot or
            // property round-trips). Every delivery is a fresh intent (R02):
            // late work from a previous value becomes a silent no-op, and an
            // unresolvable LATEST name clears the override so Auto takes over
            // with an honest message (R07).
            var locText = String(val == null ? '' : val).trim();
            var locApi = global.ApiService;
            if (locApi) {
              // EVERY delivery is a new intent (v0.8.14) — bumped BEFORE the
              // identical-value short-circuit: a redelivered saved location
              // must invalidate any pending older request so a pending B can
              // never resolve after the user visibly returned to saved A.
              locApi.beginManualIntent();
              if (!locText) {
                locApi.clearManualLocation();
                self.loadAtmosphere(true);
                break;
              }
              if (locApi.manualLocationMatches && locApi.manualLocationMatches(locText)) {
                break;
              }
              locApi.setManualLocation(locText).then(function(res) {
                if (res && res.superseded) {
                  return; // a newer intent already won (R02)
                }
                if (res && res.ok) {
                  self.setDomText(self.dom.locStatusLabel,
                    'Manual location: ' + res.location.city + (res.location.country ? ', ' + res.location.country : '') + ' — refreshing...');
                  self.loadAtmosphere(true);
                } else {
                  // R07: latest name unresolvable — Auto is active again.
                  self.setDomText(self.dom.locStatusLabel,
                    'Could not resolve "' + locText + '" — using automatic location');
                  self.loadAtmosphere(true);
                }
              }).catch(function(err) {
                // Only the LATEST intent may clear/fall back (v0.8.14): an
                // obsolete rejection (generation-tagged) is a silent no-op.
                if (err && typeof err.generation === 'number' &&
                    err.generation !== locApi._manualIntentGeneration) {
                  return;
                }
                locApi.clearManualLocation();
                self.setDomText(self.dom.locStatusLabel,
                  'Manual location failed — using automatic location');
                self.loadAtmosphere(true);
              });
            }
            break;
          }
          case 'settingsExport':
            // Customize-panel button (Lively fires a property event on click)
            self.exportSettings();
            break;
          case 'settingsImport':
            // Customize-panel button: opens the settings picker (prefers the
            // File System Access dialog with the window focused first)
            if (self.openImportPicker) {
              self.openImportPicker();
            } else if (self.dom.diagImportFile) {
              self.dom.diagImportFile.value = '';
              self.dom.diagImportFile.click();
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
        if (self.isPlaybackPaused) {
          self.pendingTrack = track;
          return;
        }
        if (self.mediaVisualizer) {
          self.mediaVisualizer.handleTrackUpdate(track);
        }
      });

      // Real-time Audio Spectrum telemetry (128 normalized float bins)
      global.LivelyBridge.onAudioData(function(audioArray) {
        if (self.isPlaybackPaused) return;
        // Fix 6: Gate audio processing when companion dock or media player is hidden
        if (!self.showMediaFocusDock || !self.showMediaPlayer) return;
        if (self.mediaVisualizer && self.mediaVisualizer.enabled) {
          self.mediaVisualizer.processAudioData(audioArray);
        }
      });
    },

    setHudPosition: function(pos) {
      if (!this.dom.hud) return;
      var allPositions = [
        'top-right', 'top-left', 'bottom-right', 'bottom-left',
        'middle-right', 'middle-left', 'middle-top', 'middle-bottom', 'center'
      ];

      // Compositor cleanup: width/top/bottom no longer interpolate — layout
      // lands discretely and only a transform-only FLIP animation eases the
      // dock's visible move back to zero (no text/control scaling)
      var dockForFlip = this.dom.dockMediaFocus;
      var oldDockRect = null;
      if (dockForFlip && typeof dockForFlip.getBoundingClientRect === 'function' &&
          typeof window !== 'undefined' && window.matchMedia &&
          !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        try {
          if (dockForFlip.offsetHeight !== 0 || dockForFlip.offsetWidth !== 0) {
            oldDockRect = dockForFlip.getBoundingClientRect();
          }
        } catch (e) {
          oldDockRect = null;
        }
      }

      for (var i = 0; i < allPositions.length; i++) {
        this.dom.hud.classList.remove(allPositions[i]);
        if (this.dom.dockMediaFocus) {
          this.dom.dockMediaFocus.classList.remove(allPositions[i]);
        }
      }

      var targetClass = 'top-right';

      if (typeof pos === 'number' && allPositions[pos]) {
        targetClass = allPositions[pos];
      } else if (typeof pos === 'string') {
        var lower = pos.toLowerCase().trim();
        if (lower === 'top-left' || lower === 'topleft') targetClass = 'top-left';
        else if (lower === 'bottom-right' || lower === 'bottomright') targetClass = 'bottom-right';
        else if (lower === 'bottom-left' || lower === 'bottomleft') targetClass = 'bottom-left';
        else if (lower === 'middle-right' || lower === 'middleright' || lower === 'center-right') targetClass = 'middle-right';
        else if (lower === 'middle-left' || lower === 'middleleft' || lower === 'center-left') targetClass = 'middle-left';
        else if (lower === 'middle-top' || lower === 'middletop' || lower === 'center-top') targetClass = 'middle-top';
        else if (lower === 'middle-bottom' || lower === 'middlebottom' || lower === 'center-bottom') targetClass = 'middle-bottom';
        else if (lower === 'center' || lower === 'middle') targetClass = 'center';
        else if (lower.indexOf('left') !== -1 && lower.indexOf('top') !== -1) targetClass = 'top-left';
        else if (lower.indexOf('left') !== -1 && lower.indexOf('bottom') !== -1) targetClass = 'bottom-left';
        else if (lower.indexOf('right') !== -1 && lower.indexOf('bottom') !== -1) targetClass = 'bottom-right';
        else targetClass = 'top-right';
      }

      this.dom.hud.classList.add(targetClass);
      if (this.dom.dockMediaFocus) {
        this.dom.dockMediaFocus.classList.add(targetClass);
      }

      // FLIP: capture the pre-move rect above, read the post-layout rect now,
      // and animate only the inverse translation back to zero (transform-only).
      // Rapid re-positioning cancels the in-flight FLIP first so animations
      // never stack (CORR-8); the handle is nulled on finish/cancel.
      if (oldDockRect && dockForFlip && typeof dockForFlip.getBoundingClientRect === 'function' &&
          typeof dockForFlip.animate === 'function') {
        try {
          if (this._dockFlipAnim && typeof this._dockFlipAnim.cancel === 'function') {
            try { this._dockFlipAnim.cancel(); } catch (eCancel) {}
          }
          this._dockFlipAnim = null;
          var newDockRect = dockForFlip.getBoundingClientRect();
          var flipDx = (oldDockRect.left || 0) - (newDockRect.left || 0);
          var flipDy = (oldDockRect.top || 0) - (newDockRect.top || 0);
          if (flipDx || flipDy) {
            var app = this;
            var flipAnim = dockForFlip.animate([
              { transform: 'translate(' + flipDx + 'px, ' + flipDy + 'px)' },
              { transform: 'translate(0px, 0px)' }
            ], {
              duration: 260,
              easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
            });
            this._dockFlipAnim = flipAnim;
            if (flipAnim && typeof flipAnim === 'object') {
              var clearHandle = function() {
                if (app._dockFlipAnim === flipAnim) app._dockFlipAnim = null;
              };
              if (typeof flipAnim.onfinish !== 'undefined' || 'onfinish' in flipAnim) {
                flipAnim.onfinish = clearHandle;
                flipAnim.oncancel = clearHandle;
              }
            }
          }
        } catch (e) {
          // Discrete placement is always correct; FLIP is purely cosmetic
        }
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
          // Late-enable: make sure the 5-minute automatic news cadence exists
          // even when the feed was disabled at boot (v0.8.4). The immediate
          // fetch stays pause-gated — no network attempts while hidden.
          if (!this.newsFetchTimer && !this.isPlaybackPaused) {
            var newsFetchTick = function() {
              if (this.isPlaybackPaused || !this.showNewsFeed) return;
              this.fetchNews();
            };
            this.newsFetchTimer = setInterval(newsFetchTick.bind(this), 300000);
            this.fetchNews();
          }
        } else {
          this.dom.hudNewsBlock.classList.add('is-hidden');
          if (this.newsTimer) {
            clearInterval(this.newsTimer);
            this.newsTimer = null;
          }
          if (this.newsFetchTimer) {
            clearInterval(this.newsFetchTimer);
            this.newsFetchTimer = null;
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
          if (this.mediaVisualizer && !this.isPlaybackPaused && this.showMediaFocusDock) {
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
      var hudHeight = (this.dom.hud && this.dom.hud.offsetHeight) || 395;
      var dockHeight = (this.dom.dockMediaFocus && this.dom.dockMediaFocus.offsetHeight) || 124;
      var hwVisible = this.showHardwareMonitor;
      var newsVisible = this.showNewsFeed;

      // C-F02: pre-measure the media wrap while the DOM is clean, but only when the dock
      // layout state is already steady (no is-hidden / is-solo transitions pending), so
      // resize() below reads a cached width instead of forcing a post-write reflow.
      if (this.mediaVisualizer && typeof this.mediaVisualizer.captureWrapWidth === 'function' &&
          this.dom.dockMediaFocus && this.dom.dockMediaFocus.classList &&
          typeof this.dom.dockMediaFocus.classList.contains === 'function') {
        var dockWillShow = (this.showMediaFocusDock !== false) && (this.showPomodoro || this.showMediaPlayer);
        var dockLayoutSteady = dockWillShow && !this.dom.dockMediaFocus.classList.contains('is-hidden');
        if (dockLayoutSteady && this.dom.mediaCard && this.dom.mediaCard.classList &&
            typeof this.dom.mediaCard.classList.contains === 'function') {
          dockLayoutSteady = this.dom.mediaCard.classList.contains('is-solo') === (!!this.showMediaPlayer && !this.showPomodoro);
        }
        if (dockLayoutSteady) {
          this.mediaVisualizer.captureWrapWidth();
        }
      }

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

        // Dynamically compute companion dock vertical positioning offset and collision avoidance
        if (this.dom.hud && this.dom.dockMediaFocus) {
          var offsetGap = 14;
          var vh = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 1080;
          var vw = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 1920;

          // Check if HUD and companion dock would collide vertically
          var isShortViewport = (vh < 600);
          var hudClass = this.dom.hud.className || '';
          var isRight = hudClass.indexOf('right') !== -1;
          var isLeft = hudClass.indexOf('left') !== -1;

          if (this.dom.dockMediaFocus.style) {
            if (isShortViewport && vw >= 700) {
              // When vertical space is insufficient (<600px), split horizontally if screen is wide enough
              if (isRight) {
                this.dom.dockMediaFocus.style.left = '20px';
                this.dom.dockMediaFocus.style.right = 'auto';
                this.dom.dockMediaFocus.style.bottom = '16px';
                this.dom.dockMediaFocus.style.top = 'auto';
              } else if (isLeft) {
                this.dom.dockMediaFocus.style.right = '20px';
                this.dom.dockMediaFocus.style.left = 'auto';
                this.dom.dockMediaFocus.style.bottom = '16px';
                this.dom.dockMediaFocus.style.top = 'auto';
              } else {
                this.dom.dockMediaFocus.style.left = '';
                this.dom.dockMediaFocus.style.right = '';
                this.dom.dockMediaFocus.style.top = '';
                this.dom.dockMediaFocus.style.bottom = '';
              }
            } else {
              // Reset inline horizontal overrides for standard viewports
              this.dom.dockMediaFocus.style.left = '';
              this.dom.dockMediaFocus.style.right = '';
              this.dom.dockMediaFocus.style.top = '';
              this.dom.dockMediaFocus.style.bottom = '';
            }
          }

          var topOffsetNum = 32 + hudHeight + offsetGap;
          var bottomOffsetNum = 32 + hudHeight + offsetGap;
          if (!isShortViewport) {
            if (topOffsetNum + dockHeight > vh - 10) {
              topOffsetNum = Math.max(16, vh - 10 - dockHeight);
            }
            if (bottomOffsetNum + dockHeight > vh - 10) {
              bottomOffsetNum = Math.max(16, vh - 10 - dockHeight);
            }
          }
          var topOffset = topOffsetNum + 'px';
          var bottomOffset = bottomOffsetNum + 'px';
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
        if (!this._sampleCanvas) {
          this._sampleCanvas = document.createElement('canvas');
          this._sampleCanvas.width = 24;
          this._sampleCanvas.height = 16;
        }
        var sampleCanvas = this._sampleCanvas;
        var ctx = sampleCanvas.getContext('2d', { willReadFrequently: true }) || sampleCanvas.getContext('2d');
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
        this.setDomText(this.dom.diagGpu, prof.cleanRenderer + ' (' + prof.tier + ', DPR ' + prof.dpr.toFixed(1) + ')');
      } else {
        this.setDomText(this.dom.diagGpu, 'Universal 2D (DPR 1.0)');
      }
    },

    toggleDiagnostics: function() {
      this.showDiagnostics = !this.showDiagnostics;
      if (this.dom.diagPanel) {
        if (this.showDiagnostics) {
          this.dom.diagPanel.classList.add('is-active');
          this.updateGpuDiagnostics();
          this.updateThemeDiagnostics();
          this.updateLocationDiagnostics();
          this.updateNewsDiagnostics();
          this.updateWallpaperDiagnostics();
        } else {
          this.dom.diagPanel.classList.remove('is-active');
          this.hideLocationSuggestions();
        }
      }
    },

    /**
     * Keep the wallpaper watermark ABOVE the Windows taskbar (v0.8.20): the
     * wallpaper page spans the full screen while the taskbar floats over its
     * bottom edge — a fixed bottom:10px pill sits permanently UNDER it and is
     * never seen. Use the screen's reserved strip (screen.height -
     * screen.availHeight); the 72px CSS floor is the no-JS fallback.
     */
    positionWallpaperCredit: function() {
      var el = this.dom && this.dom.unsplashCredit;
      if (!el || !el.style) return;
      var reserved = 0;
      try {
        if (typeof screen !== 'undefined' && screen &&
            typeof screen.height === 'number' && typeof screen.availHeight === 'number') {
          reserved = Math.max(0, screen.height - screen.availHeight);
        }
      } catch (e) {}
      el.style.bottom = Math.max(18, reserved + 12) + 'px';
    },

    /**
     * D-panel wallpaper source line (v0.8.18): always answers "where is the
     * wallpaper from?" even when the on-screen watermark is missed —
     * provider label + the exact source/URL from the cached credit.
     */
    updateWallpaperDiagnostics: function() {
      if (!this.dom.diagWallpaperStatus) return;
      try {
        var ls = global.localStorage;
        var url = ls ? (ls.getItem('local_wally_cached_bg_url') || '') : '';
        var provider = ls ? (ls.getItem('local_wally_cached_bg_provider') || '') : '';
        var photographer = ls ? (ls.getItem('local_wally_cached_bg_photographer') || '') : '';
        var photographerUrl = ls ? (ls.getItem('local_wally_cached_bg_photographer_url') || '') : '';
        if (!url) {
          this.setDomText(this.dom.diagWallpaperStatus, 'Wallpaper source: none cached yet (applies after the next wallpaper load)');
          return;
        }
        var label = (typeof this._wallpaperCreditLabel === 'function')
          ? this._wallpaperCreditLabel(provider || this._wallpaperProviderFromUrl(url), photographer)
          : (provider || 'Wallpaper');
        var source = photographerUrl || url;
        this.setDomText(this.dom.diagWallpaperStatus, 'Wallpaper source: ' + (label || 'Unknown') + ' — ' + source);
      } catch (e) {
        this.setDomText(this.dom.diagWallpaperStatus, 'Wallpaper source: unavailable');
      }
    },

    /**
     * D-panel news status (v0.8.15): per-provider last outcome, remaining
     * quota window and pending tier — the honest way to see WHY a news card
     * is empty (bad key vs empty city tier vs window pending).
     */
    updateNewsDiagnostics: function() {
      if (!this.dom.diagNewsStatus) return;
      try {
        var api = global.ApiService;
        if (!api || typeof api.newsStatusSummary !== 'function') {
          this.setDomText(this.dom.diagNewsStatus, 'News status unavailable');
          return;
        }
        var loc = (this.state && this.state.location) || {};
        this.setDomText(this.dom.diagNewsStatus,
          api.newsStatusSummary(loc.city || '', loc.countryCode || ''));
      } catch (e) {
        this.setDomText(this.dom.diagNewsStatus, 'News status error: ' + (e && e.message));
      }
    },

    // ---- Manual location management (v0.8.7, diagnostic panel) -------------

    updateLocationDiagnostics: function() {
      var self = this;
      if (!this.dom.locStatusLabel) return;
      var manual = (global.ApiService && global.ApiService._readManualRecord) ? global.ApiService._readManualRecord() : null;
      if (manual && manual.entry) {
        var label = manual.entry.type === 'coords'
          ? 'Manual location: ' + manual.entry.latitude + ', ' + manual.entry.longitude
          : 'Manual location: ' + manual.entry.name;
        this.setDomText(this.dom.locStatusLabel, label);
      } else if (global.ApiService && global.ApiService.getLocation) {
        this.setDomText(this.dom.locStatusLabel, 'Location source: Automatic (detecting...)');
        global.ApiService.getLocation().then(function(loc) {
          if (!self.showDiagnostics) return;
          this.setDomText(self.dom.locStatusLabel,
            'Location source: Automatic — ' + loc.city + (loc.country ? ', ' + loc.country : '') +
            ' (' + loc.source + ')');
        }.bind(this)).catch(function() {
          if (!self.showDiagnostics) return;
          self.setDomText(self.dom.locStatusLabel, 'Location source: Automatic — unavailable');
        });
      }
    },

    _locSuggestDebounce: null,
    _locSuggestOptions: [],
    _locSuggestActive: -1,

    renderLocationSuggestions: function(options) {
      var self = this;
      var listEl = this.dom.locSuggestList;
      var inputEl = this.dom.locManageInput;
      if (!listEl) return;
      this._locSuggestOptions = options || [];
      this._locSuggestActive = -1;
      listEl.textContent = '';
      if (!this._locSuggestOptions.length) {
        listEl.classList.remove('is-open');
        if (inputEl) inputEl.setAttribute('aria-expanded', 'false');
        return;
      }
      for (var i = 0; i < this._locSuggestOptions.length; i++) {
        var opt = this._locSuggestOptions[i];
        var item = document.createElement('div');
        item.className = 'loc-suggest-item';
        item.setAttribute('role', 'option');
        // Escaped text nodes only — no HTML construction from remote place data.
        var nameSpan = document.createElement('span');
        nameSpan.textContent = opt.name + (opt.admin1 ? ', ' + opt.admin1 : '');
        var countrySpan = document.createElement('span');
        countrySpan.className = 'loc-suggest-country';
        countrySpan.textContent = opt.country || opt.country_code || '';
        item.appendChild(nameSpan);
        item.appendChild(countrySpan);
        item.setAttribute('data-loc-idx', String(i));
        item.addEventListener('mousedown', function(e) {
          // mousedown (not click) so the input doesn't blur before selection
          e.preventDefault();
          self.selectLocationSuggestion(parseFloat(this.getAttribute('data-loc-idx')));
        });
        listEl.appendChild(item);
      }
      listEl.classList.add('is-open');
      if (inputEl) inputEl.setAttribute('aria-expanded', 'true');
    },

    hideLocationSuggestions: function() {
      // Invalidate any in-flight suggestion response (R12): clearing the
      // field, entering coordinate mode, selecting, blurring, or closing the
      // panel must stop late responses from re-opening the dropdown.
      this._locSuggestGeneration = (this._locSuggestGeneration || 0) + 1;
      if (this._locSuggestDebounce) {
        clearTimeout(this._locSuggestDebounce);
        this._locSuggestDebounce = null;
      }
      this._locSuggestOptions = [];
      this._locSuggestActive = -1;
      if (this.dom.locSuggestList) {
        this.dom.locSuggestList.textContent = '';
        this.dom.locSuggestList.classList.remove('is-open');
      }
      if (this.dom.locManageInput) {
        this.dom.locManageInput.setAttribute('aria-expanded', 'false');
      }
    },

    moveLocationSuggestion: function(delta) {
      var self = this;
      var listEl = this.dom.locSuggestList;
      if (!listEl || !this._locSuggestOptions.length) return;
      var n = this._locSuggestOptions.length;
      this._locSuggestActive = ((this._locSuggestActive + delta) % n + n) % n;
      var items = listEl.querySelectorAll ? listEl.querySelectorAll('.loc-suggest-item') : [];
      for (var i = 0; i < items.length; i++) {
        if (i === this._locSuggestActive) items[i].classList.add('is-active');
        else items[i].classList.remove('is-active');
      }
    },

    selectLocationSuggestion: function(idx) {
      var self = this;
      var opt = this._locSuggestOptions[idx];
      if (!opt || !global.ApiService) return;
      this.hideLocationSuggestions();
      var input = this.dom.locManageInput;
      if (input) input.value = opt.name + (opt.country ? ', ' + opt.country : '');
      this.setDomText(this.dom.locStatusLabel, 'Resolving "' + opt.name + '"...');
      global.ApiService.setManualLocation(opt.name, opt).then(function(res) {
        if (res && res.superseded) return; // a newer intent won (R02)
        if (!res.ok) {
          self.setDomText(self.dom.locStatusLabel, 'Manual location rejected: ' + res.error + ' — using automatic location');
          self.loadAtmosphere(true);
          return;
        }
        var resolved = res.location;
        self.setDomText(self.dom.locStatusLabel,
          'Manual location: ' + resolved.city + (resolved.country ? ', ' + resolved.country : '') + ' — refreshing...');
        self.syncCustomLocationProperty(resolved.city);
        self.loadAtmosphere(true);
      }).catch(function(err) {
        self.setDomText(self.dom.locStatusLabel, 'Manual location failed: ' + (err && err.message) + ' — using automatic location');
        if (global.ApiService && global.ApiService.clearManualLocation) global.ApiService.clearManualLocation();
        self.loadAtmosphere(true);
      });
    },

    useAutomaticLocation: function() {
      this.hideLocationSuggestions();
      var hadManual = false;
      if (global.ApiService && global.ApiService._readManualRecord) {
        hadManual = !!global.ApiService._readManualRecord();
      }
      if (global.ApiService && global.ApiService.clearManualLocation) {
        global.ApiService.clearManualLocation();
      }
      var input = this.dom.locManageInput;
      if (input) input.value = '';
      this.setDomText(this.dom.locStatusLabel, hadManual ? 'Switching back to automatic location...' : 'Already using automatic location');
      if (hadManual) {
        this.syncCustomLocationProperty('');
        this.loadAtmosphere(true);
      }
    },

    _handleLocationInput: function() {
      var self = this;
      if (this._locSuggestDebounce) {
        clearTimeout(this._locSuggestDebounce);
        this._locSuggestDebounce = null;
      }
      var input = this.dom.locManageInput;
      if (!input || !global.ApiService || typeof global.ApiService._geocodeCity !== 'function') return;
      var text = String(input.value || '').trim();
      // Every edit is a fresh suggestion generation (R12): responses from an
      // earlier query can never render — including slow/failed responses that
      // settle after the user moved on, cleared the field, or closed the panel.
      this._locSuggestGeneration = (this._locSuggestGeneration || 0) + 1;
      var gen = this._locSuggestGeneration;
      if (text.length < 3) {
        this.hideLocationSuggestions();
        return;
      }
      // Coordinates typed directly: no autocomplete needed; Enter applies.
      if (/^\s*-?\d{1,3}/.test(text) && text.indexOf(',') !== -1) {
        this.hideLocationSuggestions();
        this.setDomText(this.dom.locStatusLabel, 'Coordinates mode — press Enter to set this location');
        return;
      }
      this._locSuggestDebounce = setTimeout(function() {
        self._locSuggestDebounce = null;
        global.ApiService._geocodeCity(text, 6).then(function(list) {
          if (gen !== self._locSuggestGeneration) return; // stale response (R12)
          if (self.showDiagnostics) self.renderLocationSuggestions(list);
        }).catch(function() {
          if (gen !== self._locSuggestGeneration) return; // stale failure (R12)
          if (self.showDiagnostics) self.renderLocationSuggestions([]);
        });
      }, 350);
    },

    /**
     * Applies the raw input (city name or "lat, lon") on Enter when no
     * suggestion row is highlighted — the manual path behind the
     * autocomplete dropdown.
     */
    _applyManualLocationFromInput: function() {
      var self = this;
      var input = this.dom.locManageInput;
      if (!input || !global.ApiService) return;
      this.hideLocationSuggestions();
      var text = String(input.value || '').trim();
      if (!text) {
        this.setDomText(this.dom.locStatusLabel, 'Type a city name or "lat, lon" first');
        return;
      }
      // Re-applying the already-active entry is a no-op: no redundant geocode
      // and no redundant refresh (R02 acceptance 4).
      if (global.ApiService.manualLocationMatches && global.ApiService.manualLocationMatches(text)) {
        this.setDomText(this.dom.locStatusLabel, 'Location already active: ' + text);
        return;
      }
      this.setDomText(this.dom.locStatusLabel, 'Resolving "' + text + '"...');
      global.ApiService.setManualLocation(text).then(function(res) {
        if (res && res.superseded) return; // a newer intent won (R02)
        if (!res.ok) {
          self.setDomText(self.dom.locStatusLabel, 'Manual location rejected: ' + res.error + ' — using automatic location');
          self.loadAtmosphere(true);
          return;
        }
        var resolved = res.location;
        self.setDomText(self.dom.locStatusLabel,
          'Manual location: ' + resolved.city + (resolved.country ? ', ' + resolved.country : '') + ' — refreshing...');
        // R04: coordinate pins mirror as coordinates on the property — a
        // city label would swallow a genuine pin on round-trip.
        var rec = global.ApiService._readManualRecord ? global.ApiService._readManualRecord() : null;
        if (rec && rec.entry && rec.entry.type === 'coords') {
          self.syncCustomLocationProperty(rec.entry.latitude + ', ' + rec.entry.longitude);
        } else {
          self.syncCustomLocationProperty(resolved.city);
        }
        self.loadAtmosphere(true);
      }).catch(function(err) {
        self.setDomText(self.dom.locStatusLabel, 'Manual location failed: ' + (err && err.message) + ' — using automatic location');
        if (global.ApiService && global.ApiService.clearManualLocation) global.ApiService.clearManualLocation();
        self.loadAtmosphere(true);
      });
    },

    /**
     * Settings Backup & Restore (v0.8.6)
     *
     * Exports every user-tunable Lively property (INCLUDING API keys — the
     * user explicitly asked for keys) plus all app-owned localStorage entries
     * as one portable JSON file, and imports it back on any machine.
     *
     * SECURITY MODEL: the export is a plain JSON file containing credentials
     * in cleartext — documented; the user keeps the file safe. Import applies
     * only whitelisted property names (App.SETTINGS_PROPNAMES, mirroring the
     * LivelyBridge property dispatcher), URL-embedded key values are
     * charset-checked, and only app-owned storage keys
     * (LIVELY_HUD_*, local_wally_*) are restored. Values pass through the
     * existing property dispatcher and setters, which already coerce/clamp.
     * In production the import round-trips through the Lively host via
     * livelyPropertyValueChanged (host persists + re-delivers every property);
     * outside the host (preview/tests) values replay through the bridge
     * emitter instead.
     */
    SETTINGS_PROPNAMES: [
      'customLocation',
      'hudPosition', 'glassBlur', 'particleDensity', 'tempUnit', 'refreshInterval',
      'wallpaperProvider', 'unsplashApiKey', 'wallhavenApiKey', 'pexelsApiKey',
      'pixabayApiKey', 'weatherSimulation', 'contrastMode', 'showMediaFocusDock',
      'showNewsFeed', 'newsProvider', 'newsApiKey', 'currentsApiKey',
      'showHardwareMonitor', 'showNetworkUsage', 'showBatteryInfo', 'showCelestial',
      'showAqi', 'showEnvironmentalMetrics', 'weatherProvider',
      'openweathermapApiKey', 'aqiProvider', 'waqiApiKey', 'showForecastChart',
      'defaultForecastTab', 'showPomodoro', 'showMediaPlayer',
      'pomodoroFocusMinutes', 'pomodoroBreakMinutes', 'pomodoroLongBreakMinutes',
      'enableAudioVisualizer', 'enableDynamicSolarLighting'
    ],
    _SETTINGS_STORAGE_PREFIX: /^(LIVELY_HUD_|local_wally_)/,
    _URL_EMBEDDED_KEY_PROPS: ['openweathermapApiKey', 'waqiApiKey', 'pixabayApiKey'],
    // Every API-key property gets boundary validation on import (v0.8.11 R11):
    // non-string values and oversized strings are rejected; blank stays valid.
    // URL_EMBEDDED additionally restricts charset (query-parameter safety for
    // the documented provider key formats: hex/alphanumeric tokens).
    _KEY_PROPS: ['unsplashApiKey', 'wallhavenApiKey', 'pexelsApiKey', 'pixabayApiKey',
      'openweathermapApiKey', 'waqiApiKey', 'newsApiKey', 'currentsApiKey'],
    // Operational (non-user) storage state that must never ride backups (R09).
    // Extensible: any reservation/lock state added by multi-instance work joins here.
    _OPERATIONAL_STORAGE_KEYS: ['LIVELY_HUD_NEWS_QUOTA', 'LIVELY_HUD_NEWS_TIER', 'LIVELY_HUD_NEWS_IMG_BUDGET'],

    _buildSettingsPayload: function() {
      var props = {};
      var tracked = (global.LivelyBridge && global.LivelyBridge.properties) || {};
      for (var i = 0; i < this.SETTINGS_PROPNAMES.length; i++) {
        var name = this.SETTINGS_PROPNAMES[i];
        if (Object.prototype.hasOwnProperty.call(tracked, name)) {
          props[name] = tracked[name];
        }
      }
      var storage = {};
      try {
        var ls = global.localStorage;
        if (ls) {
          for (var k = 0; k < ls.length; k++) {
            var key = ls.key(k);
            if (!key || !this._SETTINGS_STORAGE_PREFIX.test(key)) continue;
            // Operational state (quota windows, reservations) is deliberately NOT
            // backed up: importing another machine's cooldown stamps would either
            // lock this machine out of fresh requests or lie about its windows (R09).
            if (this._OPERATIONAL_STORAGE_KEYS.indexOf(key) !== -1) continue;
            storage[key] = ls.getItem(key);
          }
        }
      } catch (e) {
        return { ok: false, error: 'Storage unavailable: ' + (e && e.message) };
      }
      return {
        ok: true,
        payload: {
          meta: {
            product: 'local-wally-hud',
            format: 1,
            includesApiKeys: true,
            exportedAt: new Date().toISOString()
          },
          livelyProperties: props,
          localStorage: storage
        }
      };
    },

    /**
     * Export through a real Save-As dialog when the runtime supports the
     * File System Access API (Chromium/WebView2 do): the user picks the
     * destination and filename. The picker needs user activation, so a
     * host-triggered export may reject it — in that case (and where the API
     * is missing) the classic blob download runs instead, with the status
     * line saying exactly which path was taken. Never claims success for
     * bytes that were not written.
     */
    exportSettings: function() {
      var self = this;
      if (this.dom.diagBackupStatus) this.setDomText(this.dom.diagBackupStatus, 'Preparing export...');
      var result = this._buildSettingsPayload();
      if (!result.ok) {
        if (this.dom.diagBackupStatus) this.setDomText(this.dom.diagBackupStatus, 'Export failed: ' + result.error);
        return;
      }
      var json = null;
      var fileName = '';
      try {
        json = JSON.stringify(result.payload, null, 2);
        var stamp = new Date();
        var pad = function(n) { return (n < 10 ? '0' : '') + n; };
        fileName = 'local-wally-settings-' +
          stamp.getFullYear() + pad(stamp.getMonth() + 1) + pad(stamp.getDate()) +
          '-' + pad(stamp.getHours()) + pad(stamp.getMinutes()) + pad(stamp.getSeconds()) + '.json';
      } catch (e) {
        this.setDomText(this.dom.diagBackupStatus, 'Export failed: ' + (e && e.message));
        return;
      }
      var nProps = Object.keys(result.payload.livelyProperties).length;
      var nKeys = Object.keys(result.payload.localStorage).length;
      var describe = function(target) {
        self.setDomText(self.dom.diagBackupStatus,
          'Exported ' + nProps + ' properties (incl. keys) + ' + nKeys + ' storage entries → ' + target);
      };

      var picker = (typeof global.showSaveFilePicker === 'function') ? global.showSaveFilePicker : null;
      if (picker) {
        picker.call(global, {
          suggestedName: fileName,
          types: [{ description: 'Local Wally settings', accept: { 'application/json': ['.json'] } }]
        }).then(function(handle) {
          return handle.createWritable().then(function(writable) {
            return writable.write(json).then(function() {
              return writable.close();
            });
          }).then(function() {
            return (handle && handle.name) || fileName;
          });
        }).then(function(name) {
          describe(name);
        }).catch(function(err) {
          if (err && err.name === 'AbortError') {
            self.setDomText(self.dom.diagBackupStatus, 'Export cancelled');
            return;
          }
          // No user activation (host-triggered) or picker unavailable here —
          // the download fallback keeps the export functional.
          self._exportViaDownload(json, fileName, describe);
        });
        return;
      }
      this._exportViaDownload(json, fileName, describe);
    },

    _exportViaDownload: function(json, fileName, describe) {
      try {
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
        describe(fileName + ' (Downloads — click Export from the D panel for a Save-As dialog)');
      } catch (e) {
        this.setDomText(this.dom.diagBackupStatus, 'Export failed: ' + (e && e.message));
      }
    },

    /**
     * Import picker: prefers the File System Access API (a proper dialog
     * owned by this window); focuses the window first so the dialog surfaces
     * in the foreground wherever the host allows; falls back to the hidden
     * file input. Cancelling is never an error.
     */
    openImportPicker: function() {
      var self = this;
      try { if (typeof global.focus === 'function') global.focus(); } catch (e) {}
      var picker = (typeof global.showOpenFilePicker === 'function') ? global.showOpenFilePicker : null;
      if (picker) {
        picker.call(global, {
          multiple: false,
          types: [{ description: 'Local Wally settings', accept: { 'application/json': ['.json'] } }]
        }).then(function(handles) {
          if (!handles || !handles.length) return;
          return handles[0].getFile().then(function(file) {
            self.importSettingsFile(file);
          });
        }).catch(function(err) {
          if (err && err.name === 'AbortError') return;
          self._openLegacyImportPicker();
        });
        return;
      }
      this._openLegacyImportPicker();
    },

    _openLegacyImportPicker: function() {
      if (!this.dom.diagImportFile) return;
      try { if (typeof global.focus === 'function') global.focus(); } catch (e) {}
      this.dom.diagImportFile.value = '';
      this.dom.diagImportFile.click();
    },

    /**
     * Validates one exported settings text. Returns {ok:true, payload} or
     * {ok:false, error}. Pure function — unit-tested in scratch suites.
     */
    _parseSettingsExport: function(text) {
      if (typeof text !== 'string') return { ok: false, error: 'No file content' };
      if (text.length > 2 * 1024 * 1024) return { ok: false, error: 'File too large for a settings export' };
      var data = null;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return { ok: false, error: 'Not valid JSON' };
      }
      if (!data || typeof data !== 'object' || !data.meta) return { ok: false, error: 'Missing meta section' };
      if (data.meta.product !== 'local-wally-hud') {
        return { ok: false, error: 'Not a Local Wally settings file' };
      }
      if (data.meta.format !== 1) {
        return { ok: false, error: 'Unsupported settings format version' };
      }
      if (!data.livelyProperties || typeof data.livelyProperties !== 'object') {
        return { ok: false, error: 'Missing or invalid livelyProperties section' };
      }
      if (typeof data.localStorage !== 'undefined' &&
          (data.localStorage === null || typeof data.localStorage !== 'object' ||
           typeof data.localStorage.length === 'number')) {
        return { ok: false, error: 'Invalid localStorage section' };
      }
      return { ok: true, payload: data };
    },

    /**
     * Publishes the manual-location property for the CURRENT session (v0.8.10).
     * Honesty note (v0.8.11 R14): the official Lively web API documents
     * host→page property delivery only; an outbound write function
     * (livelyPropertyValueChanged) is NOT part of that documented interface.
     * A host that exposes such a function gets used (feature-detected) and
     * MAY persist; otherwise this is a runtime-only bridge replay. Until a
     * real restart test on the target host confirms persistence, treat this
     * as runtime sync, not a persisted Customize write.
     */
    syncCustomLocationProperty: function(value) {
      try {
        if (typeof value !== 'string') return;
        if (typeof global.livelyPropertyValueChanged === 'function') {
          global.livelyPropertyValueChanged('customLocation', value);
        } else if (global.LivelyBridge && global.LivelyBridge.emitProperty) {
          global.LivelyBridge.emitProperty('customLocation', value);
        }
      } catch (e) {
        // The localStorage record carries the truth; panel sync is cosmetic.
      }
    },

    /**
     * Applies one validated payload (v0.8.6; honesty split v0.8.11 R14).
     * Host-write path (when the environment exposes an outbound write): each
     * value reaches the Lively property model and is counted as PERSISTENT.
     * Bridge-replay path: values apply to the running session only, counted
     * as RUNTIME — the caller must not claim persistence or auto-reload over
     * them. Storage keys of the app's own prefixes are restored verbatim;
     * operational state (quota/tier stamps) is never restored (R09); other
     * keys are ignored. Pure-ish — unit-tested in scratch suites.
     */
    _applySettingsPayload: function(payload) {
      var self = this;
      var applied = 0;
      var appliedPersist = 0;
      var skipped = 0;

      var hasHostWrite = typeof global.livelyPropertyValueChanged === 'function';
      for (var i = 0; i < this.SETTINGS_PROPNAMES.length; i++) {
        var name = this.SETTINGS_PROPNAMES[i];
        if (!Object.prototype.hasOwnProperty.call(payload.livelyProperties, name)) continue;
        var val = payload.livelyProperties[name];
        if (this._KEY_PROPS.indexOf(name) !== -1) {
          // API keys: non-string values and oversized strings are rejected at
          // the import boundary; blank stays valid. Keys actually embedded in
          // request URLs (query params) must additionally stay URL-charset-safe.
          if (typeof val !== 'string') { skipped++; continue; }
          if (val.length > 190) { skipped++; continue; }
          if (this._URL_EMBEDDED_KEY_PROPS.indexOf(name) !== -1 &&
              val.trim() && /[^A-Za-z0-9._~-]/.test(val.trim())) { skipped++; continue; }
        }
        applied++;
        if (hasHostWrite) {
          try {
            global.livelyPropertyValueChanged(name, val);
            appliedPersist++;
          } catch (e) {
            console.warn('[App] Backup import: host rejected property ' + name + ':', e && e.message);
            applied--;
          }
        } else if (global.LivelyBridge && global.LivelyBridge.emitProperty) {
          global.LivelyBridge.emitProperty(name, val);
        }
      }

      var storageRestored = 0;
      var storageSkipped = 0;
      var storageFailed = 0;
      var ls = null;
      try { ls = global.localStorage || null; } catch (e) { ls = null; }
      if (ls && payload.localStorage) {
        for (var key in payload.localStorage) {
          if (!Object.prototype.hasOwnProperty.call(payload.localStorage, key)) continue;
          if (!this._SETTINGS_STORAGE_PREFIX.test(key)) continue;
          // Operational state (e.g. old exports carrying quota stamps) is
          // NEVER restored: the local active cooldown stays authoritative (R09).
          if (this._OPERATIONAL_STORAGE_KEYS.indexOf(key) !== -1) { storageSkipped++; continue; }
          var raw = payload.localStorage[key];
          if (typeof raw !== 'string') continue;
          // Per-key failure isolation (v0.8.14): one failed write must not
          // abort the rest, and it must be REPORTED as a partial restore.
          try {
            ls.setItem(key, raw);
            storageRestored++;
          } catch (e) {
            storageFailed++;
          }
        }
      }

      return {
        applied: applied,
        appliedPersist: appliedPersist,
        skipped: skipped,
        storageRestored: storageRestored,
        storageSkipped: storageSkipped,
        storageFailed: storageFailed
      };
    },

    importSettingsFile: function(file) {
      var self = this;
      if (!file) return;
      if (this.dom.diagBackupStatus) this.setDomText(this.dom.diagBackupStatus, 'Reading ' + file.name + '...');
      var readDone = function(text) {
        try {
          var parse = self._parseSettingsExport(text);
          if (!parse.ok) {
            self.setDomText(self.dom.diagBackupStatus, 'Import failed: ' + parse.error);
            return;
          }
          var summary = self._applySettingsPayload(parse.payload);
          var runtimeOnly = summary.applied - summary.appliedPersist;
          var partial = summary.storageFailed > 0;
          var msg = 'Imported: ' + summary.applied + ' properties';
          if (summary.applied > 0) {
            msg += ' (' + summary.appliedPersist + ' submitted to host';
            if (runtimeOnly > 0) msg += ', ' + runtimeOnly + ' runtime-only';
            msg += ')';
          }
          if (summary.skipped) msg += ' — ' + summary.skipped + ' skipped';
          msg += ' + ' + summary.storageRestored + ' storage entries';
          if (summary.storageSkipped) msg += ' (' + summary.storageSkipped + ' operational skipped)';
          if (partial) {
            // Honest partial restore (v0.8.14): no full-success claim, no
            // automatic reload over a half-restored state.
            msg += '. PARTIAL: ' + summary.storageFailed + ' storage entr' +
              (summary.storageFailed === 1 ? 'y' : 'ies') + ' could not be written — re-run the import after freeing storage';
          }
          if (runtimeOnly > 0) {
            msg += '. Runtime-only values apply now; host persistence is unverified until a Lively restart test — update Lively\'s Customize panel to persist them.';
          }
          self.setDomText(self.dom.diagBackupStatus, msg);
          // Reload only for a complete, host-submitted import; a partial or
          // runtime-only restore must stay visible instead of being undone.
          if (!partial && runtimeOnly === 0 && summary.applied > 0) {
            setTimeout(function() { location.reload(); }, 1800);
          }
        } catch (e) {
          self.setDomText(self.dom.diagBackupStatus, 'Import failed: ' + (e && e.message));
        }
      };
      if (typeof file.text === 'function') {
        file.text().then(readDone).catch(function() {
          self.setDomText(self.dom.diagBackupStatus, 'Import failed: unreadable file');
        });
      } else {
        var reader = new FileReader();
        reader.onload = function() { readDone(String(reader.result || '')); };
        reader.onerror = function() {
          self.setDomText(self.dom.diagBackupStatus, 'Import failed: unreadable file');
        };
        reader.readAsText(file);
      }
    },

    getTimezoneContext: function() {
      var defaultLoc = (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.defaultLocation) || {};
      var tz = (this.state && this.state.weather && this.state.weather.timezone) ||
               (this.state && this.state.location && (this.state.location.timeZone || this.state.location.timezone)) ||
               (defaultLoc.timeZone || defaultLoc.timezone) || null;
      return tz;
    },

    updateClock: function() {
      if (this.isPlaybackPaused) return;
      var now = new Date();
      var tz = this.getTimezoneContext();
      var hStr = '--';
      var mStr = '--';
      var periodStr = '';
      var dateStr = '';

      if (tz) {
        try {
          if (!this._tzFormatters) this._tzFormatters = {};
          if (!this._tzFormatters[tz + '_clock']) {
            // 12-hour AM/PM clock via cached formatter + formatToParts (v0.8.4)
            this._tzFormatters[tz + '_clock'] = new Intl.DateTimeFormat('en-US', {
              timeZone: tz,
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });
          }
          if (!this._tzFormatters[tz + '_date']) {
            this._tzFormatters[tz + '_date'] = new Intl.DateTimeFormat('en-US', {
              timeZone: tz,
              weekday: 'long',
              month: 'short',
              day: 'numeric'
            });
          }
          var clockParts = this._tzFormatters[tz + '_clock'].formatToParts(now);
          for (var pi = 0; pi < clockParts.length; pi++) {
            if (clockParts[pi].type === 'hour') hStr = clockParts[pi].value;
            else if (clockParts[pi].type === 'minute') mStr = clockParts[pi].value;
            else if (clockParts[pi].type === 'dayPeriod') periodStr = clockParts[pi].value.replace(/\s+/g, ' ').toUpperCase();
          }
          dateStr = this._tzFormatters[tz + '_date'].format(now);
        } catch (e) {
          tz = null;
        }
      }

      if (!tz) {
        var hours = now.getHours();
        var minutes = now.getMinutes();
        periodStr = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        if (hours === 0) hours = 12;
        hStr = hours < 10 ? '0' + hours : '' + hours;
        mStr = minutes < 10 ? '0' + minutes : '' + minutes;
        if (!this._localDateFormatter) {
          this._localDateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        }
        dateStr = this._localDateFormatter.format(now);
      }

      if (this.dom.hudClock) {
        this.setDomText(this.dom.hudClock, hStr + ':' + mStr + (periodStr ? ' ' + periodStr : ''));
      }

      if (this.dom.hudDate) {
        this.setDomText(this.dom.hudDate, dateStr);
      }

      // Update remaining cache TTL in diagnostics and footer
      if (global.CacheManager) {
        var remainingMs = global.CacheManager.getRemainingTtlMs();
        var remSec = Math.floor(remainingMs / 1000);
        var remM = Math.floor(remSec / 60);
        var remS = remSec % 60;
        var sStr = remS < 10 ? '0' + remS : '' + remS;

        if (this.dom.diagCacheTtl) {
          // Compact storage-persistence indicator appended to the same label:
          // shown only while the cache is memory-only (LW16/CORR-6)
          var ttlText = remM + 'm ' + sStr + 's';
          if (global.CacheManager && typeof global.CacheManager.isPersisted === 'function' &&
              !global.CacheManager.isPersisted()) {
            ttlText += ' · RAM only';
          }
          this.setDomText(this.dom.diagCacheTtl, ttlText);
        }

        if (this.dom.syncStatus) {
          if (this.simulationMode > 0) {
            this.setDomText(this.dom.syncStatus, 'Sim Mode');
          } else if (this.state && this.state.isStalePaint) {
            // Stale-cache paint is on screen: disclose it with the same wording
            // the news list uses, until a current-generation refresh replaces
            // the snapshot (LW12/CORR-4)
            this.setDomText(this.dom.syncStatus, 'Cached');
          } else if (remainingMs > 0) {
            this.setDomText(this.dom.syncStatus, 'Sync in ' + remM + 'm');
          } else {
            this.setDomText(this.dom.syncStatus, 'Syncing...');
          }
        }
      }

      // Continuously refresh celestial ephemeris, sky gradient, and dynamic solar lighting (every 15s)
      // A negative elapsed value means the wall clock jumped backward — refresh
      // immediately so ephemeris state can never freeze on a stale timestamp (LW13)
      var elapsedCelestial = now.getTime() - this.lastCelestialUpdate;
      if (!this.lastCelestialUpdate || elapsedCelestial >= 15000 || elapsedCelestial < 0) {
        var defaultLoc = (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.defaultLocation) || {};
        var lat = typeof defaultLoc.latitude === 'number' ? defaultLoc.latitude : 35.6762;
        var lng = typeof defaultLoc.longitude === 'number' ? defaultLoc.longitude : 139.6503;
        if (this.state && this.state.location) {
          if (typeof this.state.location.latitude === 'number') lat = this.state.location.latitude;
          if (typeof this.state.location.longitude === 'number') lng = this.state.location.longitude;
        }

        var sunPos = (global.SunCalc && typeof global.SunCalc.getPosition === 'function') ? global.SunCalc.getPosition(now, lat, lng) : null;
        var moonPos = (global.SunCalc && typeof global.SunCalc.getMoonPosition === 'function') ? global.SunCalc.getMoonPosition(now, lat, lng) : null;
        var moonIllum = (global.SunCalc && typeof global.SunCalc.getMoonIllumination === 'function') ? global.SunCalc.getMoonIllumination(now) : null;

        this.renderCelestial(now, lat, lng, sunPos, moonPos, moonIllum);
        this.updateSky(sunPos, moonPos, moonIllum);
        if (this.solarLighting) {
          this.solarLighting.update(now, lat, lng, sunPos);
        }
        this.lastCelestialUpdate = now.getTime();
      }
    },

    renderCelestial: function(now, lat, lng, sunPos, moonPos, moonIllum) {
      if (!global.SunCalc) return;

      now = now || new Date();
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        var defaultLoc = (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.defaultLocation) || {};
        lat = Number.isFinite(defaultLoc.latitude) ? defaultLoc.latitude : 35.6762;
        lng = Number.isFinite(defaultLoc.longitude) ? defaultLoc.longitude : 139.6503;
        if (this.state && this.state.location) {
          if (Number.isFinite(this.state.location.latitude)) lat = this.state.location.latitude;
          if (Number.isFinite(this.state.location.longitude)) lng = this.state.location.longitude;
        }
      }

      var tz = this.getTimezoneContext();

      // Timezone-aware formatting helper with caching
      var self = this;
      function formatTime(d) {
        if (!d || isNaN(d.getTime())) return null;
        if (tz) {
          try {
            if (!self._tzFormatters) self._tzFormatters = {};
            var fmtKey = tz + '_HM';
            if (!self._tzFormatters[fmtKey]) {
              self._tzFormatters[fmtKey] = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              });
            }
            return self._tzFormatters[fmtKey].format(d);
          } catch (e) {}
        }
        var dh = d.getHours();
        var dm = d.getMinutes();
        return (dh < 10 ? '0' : '') + dh + ':' + (dm < 10 ? '0' : '') + dm;
      }

      // 1. Solar Ephemeris & Precise Solar Altitude Day/Night Recognition
      if (!sunPos && global.SunCalc && typeof global.SunCalc.getPosition === 'function') {
        try {
          sunPos = global.SunCalc.getPosition(now, lat, lng);
        } catch (e) {
          console.warn('[App] Error computing SunCalc sun position:', e);
        }
      }

    // Sun altitude > -0.01454 rad (-0.833 deg) is the geometric solar horizon accounting for atmospheric refraction and solar radius.
    // Non-finite altitude (stale/NaN inputs) must NOT silently paint night
    // (QA v0.8.17): fall back to the weather day flag below instead.
    var altitudeValid = !!(sunPos && typeof sunPos.altitude === 'number' && isFinite(sunPos.altitude));
    var isDay = altitudeValid ? (sunPos.altitude > -0.01454) : true;

    // Allow simulation mode (e.g. 4: Starry Night, 1: Clear Day) override
    if (typeof this.simulationMode === 'number' && this.simulationMode > 0) {
      if (this.simulationMode === 4) isDay = false;
      else if (this.simulationMode === 1) isDay = true;
    } else if ((!sunPos || !altitudeValid) && this.state && this.state.weather &&
               (typeof this.state.weather.isDay === 'number' || typeof this.state.weather.isDay === 'boolean')) {
      var dayFlag = this.state.weather.isDay;
      isDay = (typeof dayFlag === 'number') ? (dayFlag === 1) : !!dayFlag;
    }

      var sunriseStr = '--:--';
      var sunsetStr = '--:--';
      var noonStr = '--:--';
      var sunTimes = null;
      try {
        sunTimes = global.SunCalc.getTimes(now, lat, lng);
        sunriseStr = formatTime(sunTimes.sunrise);
        sunsetStr = formatTime(sunTimes.sunset);
        noonStr = formatTime(sunTimes.solarNoon);

        // Handle polar daylight/night edge cases gracefully
        if (!sunriseStr || !sunsetStr) {
          var noonTime = (sunTimes && sunTimes.solarNoon && !isNaN(sunTimes.solarNoon.getTime())) ? sunTimes.solarNoon : now;
          var noonPos = global.SunCalc.getPosition(noonTime, lat, lng);
          if (noonPos && typeof noonPos.altitude === 'number' && noonPos.altitude > -0.01454) {
            sunriseStr = sunriseStr || 'Polar Day';
            sunsetStr = sunsetStr || '24h Sun';
          } else {
            sunriseStr = sunriseStr || 'Polar Night';
            sunsetStr = sunsetStr || 'No Rise';
          }
        }
      } catch (e) {
        console.warn('[App] Error computing solar ephemeris:', e);
      }

      // Populate hidden fallback spans for backwards compatibility and automated tests
      if (this.dom.ephemerisSunrise) this.setDomText(this.dom.ephemerisSunrise, sunriseStr || '--:--');
      if (this.dom.ephemerisNoon) this.setDomText(this.dom.ephemerisNoon, noonStr || '--:--');
      if (this.dom.ephemerisSunset) this.setDomText(this.dom.ephemerisSunset, sunsetStr || '--:--');

      // 2. Lunar Ephemeris (Moon Phase, Illumination, Moonrise/Moonset)
      var moonTimes = null;
      var activePhase = { name: 'Full Moon', glyph: '🌕' };
      var illumPct = '--%';
      var lunarAge = '14.8';
      var isWaxing = true;
      var westernFullMoonName = '';
      var vedicPurnimaName = '';
      var activeShower = null;
      var moonriseStr = '--:--';
      var moonsetStr = '--:--';

      try {
        if (!moonIllum && global.SunCalc && typeof global.SunCalc.getMoonIllumination === 'function') {
          moonIllum = global.SunCalc.getMoonIllumination(now);
        }
        var fraction = (moonIllum && typeof moonIllum.fraction === 'number') ? moonIllum.fraction : 0;
        var phase = (moonIllum && typeof moonIllum.phase === 'number') ? moonIllum.phase : 0; // 0.0 to 1.0

        var phaseIndex = Math.round(phase * 8) % 8;
        activePhase = MOON_PHASES[phaseIndex] || MOON_PHASES[0];
        illumPct = Math.round(fraction * 100) + '%';
        lunarAge = (phase * 29.530588).toFixed(1);
        isWaxing = phase < 0.5;

        // Traditional Western Full Moon Names by month
        westernFullMoonName = WESTERN_NAMES[now.getMonth()] || 'Full Moon';

        // Cultural Vedic Purnima Names (traditional Hindu lunar calendar)
        vedicPurnimaName = VEDIC_NAMES[now.getMonth()] || 'Purnima';

        // Prominent Annual Meteor Showers
        var curM = now.getMonth();
        var curD = now.getDate();
        for (var si = 0; si < METEOR_SHOWERS.length; si++) {
          var ms = METEOR_SHOWERS[si];
          var inRange = false;
          if (ms.startM === ms.endM) {
            inRange = (curM === ms.startM && curD >= ms.startD && curD <= ms.endD);
          } else {
            inRange = (curM === ms.startM && curD >= ms.startD) || (curM === ms.endM && curD <= ms.endD);
          }
          if (inRange) {
            activeShower = ms;
            break;
          }
        }

        // Offline Moonrise and Moonset calculation via SunCalc
        if (typeof global.SunCalc.getMoonTimes === 'function') {
          moonTimes = global.SunCalc.getMoonTimes(now, lat, lng, false);
          if (moonTimes) {
            if (moonTimes.rise) {
              moonriseStr = formatTime(moonTimes.rise) || 'Moonrise';
            } else if (moonTimes.alwaysUp) {
              moonriseStr = 'Up 24h';
            } else if (moonTimes.alwaysDown) {
              moonriseStr = 'Down 24h';
            } else {
              moonriseStr = 'No Rise';
            }

            if (moonTimes.set) {
              moonsetStr = formatTime(moonTimes.set) || 'Moonset';
            } else if (moonTimes.alwaysUp) {
              moonsetStr = 'Up 24h';
            } else if (moonTimes.alwaysDown) {
              moonsetStr = 'Down 24h';
            } else {
              moonsetStr = 'No Set';
            }
          }
        }
      } catch (e) {
        console.warn('[App] Error computing lunar ephemeris:', e);
      }

      // Populate hidden fallback moon spans for tests
      if (this.dom.ephemerisMoonrise) this.setDomText(this.dom.ephemerisMoonrise, moonriseStr);
      if (this.dom.ephemerisMoonset) this.setDomText(this.dom.ephemerisMoonset, moonsetStr);

      // 3. Day vs Night Row Toggling (the night-moon item lives inside the
      //    moon row; the stale standalone toggles were dead code — QA v0.8.17)
      if (isDay) {
        if (this.dom.hudEphemerisSunRow) this.dom.hudEphemerisSunRow.classList.remove('is-hidden');
        if (this.dom.hudEphemerisMoonRow) this.dom.hudEphemerisMoonRow.classList.add('is-hidden');
      } else {
        if (this.dom.hudEphemerisSunRow) this.dom.hudEphemerisSunRow.classList.add('is-hidden');
        if (this.dom.hudEphemerisMoonRow) this.dom.hudEphemerisMoonRow.classList.remove('is-hidden');
      }

      // 4. Daytime 3-Card Calculations
      // Full-resolution analytics list preferred; old snapshots degrade to the
      // reduced chart projection (LW08)
      var stAny = this.state || {};
      var hourly = stAny.hourlyAnalytics ||
                   (stAny.weather && stAny.weather.hourlyAnalytics) ||
                   stAny.hourlyForecast ||
                   (stAny.weather && stAny.weather.hourlyForecast) || [];
      var rainVal = 'No Rain';
      var rainSub = 'Clear next 6h';
      var rainOutlookDetails = [];

      if (!hourly || hourly.length === 0) {
        rainVal = 'Unavailable';
        rainSub = 'No forecast data';
      } else {
        var maxPrecipProb = null;
        var maxPrecipMm = 0;
        var nextRainTime = null;
        var validPointsCount = 0;
        var nowMs = now.getTime();
        var horizonMs = nowMs + 6 * 3600 * 1000;

        for (var hi = 0; hi < hourly.length; hi++) {
          var pt = hourly[hi];
          if (!pt) continue;

          // Check timestamp to filter within the next 6 hours horizon
          var ptTimeMs = pt.timestamp;
          if (!ptTimeMs && pt.isoTime && this.isoTimeHasOffsetRe.test(pt.isoTime)) {
            var parsedIsoTime = new Date(pt.isoTime).getTime();
            if (!isNaN(parsedIsoTime)) ptTimeMs = parsedIsoTime;
          }
          if (!ptTimeMs && pt.time) {
            var parsedTime = new Date(pt.time).getTime();
            if (!isNaN(parsedTime)) ptTimeMs = parsedTime;
          }
          // Undated or non-finite points never participate in horizon analytics (LW03)
          if (!Number.isFinite(ptTimeMs)) continue;
          if (ptTimeMs < nowMs - 1800000 || ptTimeMs > horizonMs) {
            continue;
          }

          var prob = (typeof pt.precipProb === 'number') ? pt.precipProb : (typeof pt.precipitation_probability === 'number' ? pt.precipitation_probability : null);
          var mm = (typeof pt.precipMm === 'number') ? pt.precipMm : (typeof pt.precipitation === 'number' ? pt.precipitation : null);
          var ptTime = pt.time || pt.label || ((pt.hour < 10 ? '0' : '') + pt.hour + ':00');

          if (prob !== null || mm !== null) {
            validPointsCount++;
            var safeProb = prob !== null ? prob : 0;
            var safeMm = mm !== null ? mm : 0;
            rainOutlookDetails.push({ time: ptTime, prob: safeProb, mm: safeMm });
            if (prob !== null && (maxPrecipProb === null || prob > maxPrecipProb)) maxPrecipProb = prob;
            if (safeMm > maxPrecipMm) maxPrecipMm = safeMm;
            if (!nextRainTime && (safeProb >= 25 || safeMm >= 0.1)) {
              nextRainTime = ptTime;
            }
          }
          if (validPointsCount >= 6) break;
        }

        if (validPointsCount === 0 || maxPrecipProb === null) {
          rainVal = 'Unavailable';
          rainSub = 'No forecast data';
        } else if (maxPrecipProb >= 25 || maxPrecipMm >= 0.1) {
          rainVal = maxPrecipProb + '% Rain';
          rainSub = nextRainTime ? ('Likely at ' + nextRainTime) : (maxPrecipMm > 0 ? (maxPrecipMm + 'mm expected') : 'Scattered chance');
        } else {
          rainVal = 'No Rain';
          rainSub = 'Clear next 6h';
        }
      }

      if (this.dom.ephemerisRainVal) this.setDomText(this.dom.ephemerisRainVal, rainVal);
      if (this.dom.ephemerisRainSub) this.setDomText(this.dom.ephemerisRainSub, rainSub);

      // Daytime Card 2: Feels-Like Peak (Strictly today, excluding tomorrow)
      var peakVal = 'Unavailable';
      var peakSub = 'No forecast';
      var peakDetails = { peakTemp: null, peakTime: null, peakHumidity: null };

      if (hourly && hourly.length > 0) {
        var isF = (this.tempUnit === 'F');
        var highestApp = -Infinity;
        var highestTime = null;
        var highestHum = null;

        // Remaining-day window per DESIGN_BLUEPRINT §29.2: current hour through
        // LOCAL midnight in the location's IANA timezone. Each point's LOCAL
        // calendar-date key is computed with one cached formatter per timezone —
        // no whole-hour boundary search, no fixed 24h arithmetic, DST-exact on
        // 23h/25h days (LW02). Without a valid timezone the metric reports
        // unavailable instead of silently borrowing the host timezone.
        var ymdFmt = null;
        var todayKey = null;
        if (tz) {
          try {
            if (!self._tzFormatters) self._tzFormatters = {};
            if (!self._tzFormatters[tz + '_YMD']) {
              self._tzFormatters[tz + '_YMD'] = new Intl.DateTimeFormat('en-CA', {
                timeZone: tz,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
              });
            }
            ymdFmt = self._tzFormatters[tz + '_YMD'];
            todayKey = ymdFmt.format(now);
          } catch (e) {
            ymdFmt = null;
            todayKey = null;
          }
        }

        if (!todayKey) {
          peakVal = 'Unavailable';
          peakSub = 'No forecast timezone';
        } else {
          var nowMsPeak = now.getTime();
          for (var pi = 0; pi < hourly.length; pi++) {
            var hPt = hourly[pi];
            if (!hPt) continue;

            var hPtMs = hPt.timestamp;
            if (!hPtMs && hPt.isoTime && this.isoTimeHasOffsetRe.test(hPt.isoTime)) {
              var hParsedIso = new Date(hPt.isoTime).getTime();
              if (!isNaN(hParsedIso)) hPtMs = hParsedIso;
            }
            if (!hPtMs && hPt.time) {
              var hParsed = new Date(hPt.time).getTime();
              if (!isNaN(hParsed)) hPtMs = hParsed;
            }
            // Undated points never participate (LW03)
            if (!Number.isFinite(hPtMs)) continue;
            // From the current interval onward only: a point whose whole-hour
            // interval already ended is a past reading, never a remaining-day peak
            if (hPtMs + 3600000 <= nowMsPeak) continue;
            // Same LOCAL calendar date in the location tz — no tomorrow leak
            if (ymdFmt.format(new Date(hPtMs)) !== todayKey) continue;

            var appTemp = isF ? hPt.apparentF : hPt.apparentC;
            if (appTemp == null || isNaN(appTemp)) {
              var rawApp = hPt.apparent_temperature;
              if (rawApp != null && !isNaN(rawApp)) {
                appTemp = isF ? ((rawApp * 9 / 5) + 32) : rawApp;
              }
            }
            if (appTemp != null && !isNaN(appTemp)) {
              if (appTemp > highestApp) {
                highestApp = appTemp;
                highestTime = hPt.time || hPt.label || ((hPt.hour < 10 ? '0' : '') + hPt.hour + ':00');
                highestHum = hPt.humidity != null ? hPt.humidity : null;
              }
            }
          }

          if (highestApp !== -Infinity && highestTime) {
            peakVal = Math.round(highestApp) + '°';
            peakSub = 'at ' + highestTime;
            peakDetails.peakTemp = Math.round(highestApp);
            peakDetails.peakTime = highestTime;
            peakDetails.peakHumidity = highestHum;
          }
        }
      }

      if (this.dom.ephemerisPeakVal) this.setDomText(this.dom.ephemerisPeakVal, peakVal);
      if (this.dom.ephemerisPeakSub) this.setDomText(this.dom.ephemerisPeakSub, peakSub);

      // Daytime Card 3: Golden Hour / Daylight Left
      var daylightLabel = 'Daylight Left';
      var daylightVal = '--:--';
      var daylightSub = 'until sunset';

      if (!sunTimes || !sunTimes.sunrise || !sunTimes.sunset || isNaN(sunTimes.sunrise.getTime()) || isNaN(sunTimes.sunset.getTime())) {
        if (sunPos && typeof sunPos.altitude === 'number' && sunPos.altitude > -0.01454) {
          daylightLabel = 'Polar Day';
          daylightVal = '24h Sun';
          daylightSub = 'Above horizon';
        } else {
          daylightLabel = 'Polar Night';
          daylightVal = 'Continuous';
          daylightSub = 'Below horizon';
        }
      } else {
        var morningGoldenEnd = sunTimes.goldenHourEnd;
        var eveningGoldenStart = sunTimes.goldenHour;

        if (morningGoldenEnd && now >= sunTimes.sunrise && now < morningGoldenEnd) {
          daylightLabel = 'Golden Hour';
          var remMs = Math.max(0, morningGoldenEnd.getTime() - now.getTime());
          var remM = Math.max(1, Math.round(remMs / 60000));
          daylightVal = remM + 'm left';
          daylightSub = 'ends ' + (formatTime(morningGoldenEnd) || '--:--');
        } else if (eveningGoldenStart && sunTimes.sunset && now >= eveningGoldenStart && now < sunTimes.sunset) {
          daylightLabel = 'Golden Hour';
          var remMs = Math.max(0, sunTimes.sunset.getTime() - now.getTime());
          var remM = Math.max(1, Math.round(remMs / 60000));
          daylightVal = remM + 'm left';
          daylightSub = 'sunset ' + (formatTime(sunTimes.sunset) || '--:--');
        } else if (sunTimes.sunset && now < sunTimes.sunset) {
          daylightLabel = 'Daylight Left';
          var remMs = Math.max(0, sunTimes.sunset.getTime() - now.getTime());
          var remH = Math.floor(remMs / 3600000);
          var remM = Math.floor((remMs % 3600000) / 60000);
          daylightVal = (remH > 0 ? (remH + 'h ') : '') + remM + 'm';
          daylightSub = 'sunset ' + (formatTime(sunTimes.sunset) || '--:--');
        } else {
          daylightLabel = 'Dusk';
          daylightVal = formatTime(sunTimes.dusk || sunTimes.sunset) || 'Evening';
          daylightSub = 'after sunset';
        }
      }

      if (this.dom.ephemerisDaylightLabel) this.setDomText(this.dom.ephemerisDaylightLabel, daylightLabel);
      if (this.dom.ephemerisDaylightVal) this.setDomText(this.dom.ephemerisDaylightVal, daylightVal);
      if (this.dom.ephemerisDaylightSub) this.setDomText(this.dom.ephemerisDaylightSub, daylightSub);

      // 5. Nighttime 3-Card Calculations
      // Night Card 1: Next Morning Golden Hour Window
      var goldenVal = '--:--';
      var goldenSub = 'tomorrow';

      var nextSunrise = (sunTimes && sunTimes.sunrise && sunTimes.sunrise > now) ? sunTimes.sunrise : null;
      var nextGoldenEnd = (sunTimes && sunTimes.goldenHourEnd && sunTimes.goldenHourEnd > now) ? sunTimes.goldenHourEnd : null;

      if (!nextSunrise) {
        try {
          var tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
          var tomorrowTimes = global.SunCalc.getTimes(tomorrow, lat, lng);
          if (tomorrowTimes && tomorrowTimes.sunrise && !isNaN(tomorrowTimes.sunrise.getTime())) {
            nextSunrise = tomorrowTimes.sunrise;
            nextGoldenEnd = tomorrowTimes.goldenHourEnd;
          }
        } catch (e) {}
      }

      if (!nextSunrise || isNaN(nextSunrise.getTime())) {
        if (sunPos && typeof sunPos.altitude === 'number' && sunPos.altitude < -0.01454) {
          goldenVal = 'Polar Night';
          goldenSub = 'No sunrise';
        } else {
          goldenVal = 'Unavailable';
          goldenSub = 'Continuous';
        }
      } else {
        var diffMs = Math.max(0, nextSunrise.getTime() - now.getTime());
        var diffH = Math.floor(diffMs / 3600000);
        var diffM = Math.floor((diffMs % 3600000) / 60000);
        goldenVal = 'in ' + (diffH > 0 ? (diffH + 'h ') : '') + diffM + 'm';
        goldenSub = (formatTime(nextSunrise) || '--:--') + ' - ' + (nextGoldenEnd ? (formatTime(nextGoldenEnd) || '--:--') : '--:--');
      }

      if (this.dom.ephemerisGoldenVal) this.setDomText(this.dom.ephemerisGoldenVal, goldenVal);
      if (this.dom.ephemerisGoldenSub) this.setDomText(this.dom.ephemerisGoldenSub, goldenSub);

      // Night Card 2: Moon Phase, Illumination & Visibility Outlook
      var displayPhaseName = (activePhase.name === 'Full Moon') ? westernFullMoonName : activePhase.name;
      var isMoonAbove = false;
      var moonAltDeg = 0;
      if (!moonPos && global.SunCalc && typeof global.SunCalc.getMoonPosition === 'function') {
        try {
          moonPos = global.SunCalc.getMoonPosition(now, lat, lng);
        } catch (e) {}
      }
      if (moonPos && typeof moonPos.altitude === 'number') {
        isMoonAbove = moonPos.altitude > 0;
        moonAltDeg = Math.round(moonPos.altitude * 180 / Math.PI);
      }

      var cloudClarity = 'Conditions unavailable';
      if (this.state && this.state.weather && this.state.weather.conditionText) {
        var wCond = this.state.weather.conditionText.toLowerCase();
        if (wCond.indexOf('clear') !== -1 || wCond.indexOf('sunny') !== -1) {
          cloudClarity = 'Clear sky';
        } else if (wCond.indexOf('cloud') !== -1 || wCond.indexOf('overcast') !== -1) {
          cloudClarity = (wCond.indexOf('partly') !== -1) ? 'Partly cloudy' : 'Cloudy sky';
        } else if (wCond.indexOf('rain') !== -1 || wCond.indexOf('drizzle') !== -1 || wCond.indexOf('storm') !== -1) {
          cloudClarity = 'Rain / overcast';
        } else if (wCond.indexOf('fog') !== -1 || wCond.indexOf('mist') !== -1 || wCond.indexOf('haze') !== -1) {
          cloudClarity = 'Hazy sky';
        } else {
          cloudClarity = this.state.weather.conditionText;
        }
      }

      var moonStatusSub = (isMoonAbove ? ('Above horizon (' + moonAltDeg + '°)') : 'Below horizon') + ' · ' + cloudClarity;

      if (this.dom.ephemerisNightMoonGlyph) this.setDomText(this.dom.ephemerisNightMoonGlyph, activePhase.glyph);
      if (this.dom.ephemerisNightMoonPhase) this.setDomText(this.dom.ephemerisNightMoonPhase, displayPhaseName);
      if (this.dom.ephemerisNightMoonIllum) this.setDomText(this.dom.ephemerisNightMoonIllum, illumPct);
      if (this.dom.ephemerisNightMoonStatus) this.setDomText(this.dom.ephemerisNightMoonStatus, moonStatusSub);

      // Night Card 3: Next Sky Event (Chronologically sorted among valid future candidates)
      var eventLabel = 'Next Sky Event';
      var eventVal = 'Dawn';
      var eventSub = 'at --:--';

      var skyCandidates = [];
      // Prefer astronomical dawn (nightEnd); guard against SunCalc's Invalid Date at
      // circumpolar latitudes so it cannot mask a valid civil dawn (CORR-2)
      var neTime = sunTimes && sunTimes.nightEnd;
      var dawnTime = (neTime && !isNaN(neTime.getTime())) ? neTime : (sunTimes && sunTimes.dawn);
      if (dawnTime && !isNaN(dawnTime.getTime()) && dawnTime > now) {
        skyCandidates.push({ time: dawnTime, label: 'Astronomical Dawn', sub: 'first light' });
      }
      if (sunTimes && sunTimes.sunrise && sunTimes.sunrise > now) {
        skyCandidates.push({ time: sunTimes.sunrise, label: 'Sunrise', sub: 'morning' });
      }
      if (moonTimes && moonTimes.set && moonTimes.set > now) {
        skyCandidates.push({ time: moonTimes.set, label: 'Moonset', sub: 'tonight' });
      }
      if (moonTimes && moonTimes.rise && moonTimes.rise > now) {
        skyCandidates.push({ time: moonTimes.rise, label: 'Moonrise', sub: 'rising' });
      }

      skyCandidates.sort(function(a, b) { return a.time.getTime() - b.time.getTime(); });

      // Tomorrow's sun/moon times fallback when candidates are exhausted for today
      if (skyCandidates.length === 0) {
        try {
          var tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
          var tomorrowSunTimes = global.SunCalc.getTimes(tomorrow, lat, lng);
          var tNeTime = tomorrowSunTimes && tomorrowSunTimes.nightEnd;
          var tomorrowDawnTime = (tNeTime && !isNaN(tNeTime.getTime())) ? tNeTime : (tomorrowSunTimes && tomorrowSunTimes.dawn);
          if (tomorrowDawnTime && !isNaN(tomorrowDawnTime.getTime()) && tomorrowDawnTime > now) {
            skyCandidates.push({ time: tomorrowDawnTime, label: 'Astronomical Dawn', sub: 'first light' });
          }
          if (tomorrowSunTimes && tomorrowSunTimes.sunrise && tomorrowSunTimes.sunrise > now) {
            skyCandidates.push({ time: tomorrowSunTimes.sunrise, label: 'Sunrise', sub: 'morning' });
          }
          if (typeof global.SunCalc.getMoonTimes === 'function') {
            var tomorrowMoonTimes = global.SunCalc.getMoonTimes(tomorrow, lat, lng, false);
            if (tomorrowMoonTimes && tomorrowMoonTimes.set && tomorrowMoonTimes.set > now) {
              skyCandidates.push({ time: tomorrowMoonTimes.set, label: 'Moonset', sub: 'tonight' });
            }
            if (tomorrowMoonTimes && tomorrowMoonTimes.rise && tomorrowMoonTimes.rise > now) {
              skyCandidates.push({ time: tomorrowMoonTimes.rise, label: 'Moonrise', sub: 'rising' });
            }
          }
          skyCandidates.sort(function(a, b) { return a.time.getTime() - b.time.getTime(); });
        } catch (e) {}
      }

      if (skyCandidates.length > 0) {
        var earliestEvent = skyCandidates[0];
        eventLabel = earliestEvent.label;
        eventVal = formatTime(earliestEvent.time) || '--:--';
        eventSub = earliestEvent.sub;
      } else if (activeShower) {
        eventLabel = activeShower.name;
        eventVal = 'Meteor Peak';
        eventSub = activeShower.peak;
      } else {
        eventLabel = 'Next Sky Event';
        eventVal = 'Equinox / Peak';
        eventSub = 'See calendar';
      }

      if (this.dom.ephemerisEventLabel) this.setDomText(this.dom.ephemerisEventLabel, eventLabel);
      if (this.dom.ephemerisEventVal) this.setDomText(this.dom.ephemerisEventVal, eventVal);
      if (this.dom.ephemerisEventSub) this.setDomText(this.dom.ephemerisEventSub, eventSub);

      // Update Card Header Tooltip
      if (this.dom.hudEphemerisCard) {
        var celestialTooltip = isDay
          ? ('Solar Ephemeris: Daytime Outlook • Rain ' + rainVal + ' (' + rainSub + ') | Peak ' + peakVal + ' | ' + daylightLabel + ' ' + daylightVal + ' (Click to inspect ephemeris)')
          : ('Lunar Ephemeris: Nighttime Sky • Golden Hr ' + goldenVal + ' | ' + displayPhaseName + ' (' + illumPct + ') | ' + eventLabel + ' ' + eventVal + ' (Click to inspect ephemeris)');
        this.dom.hudEphemerisCard.title = celestialTooltip;
      }

      // Store cached celestial context for detail drawer & popover disclosure
      this.celestialData = {
        isDay: isDay,
        timeZone: tz,
        sunriseStr: sunriseStr,
        noonStr: noonStr,
        sunsetStr: sunsetStr,
        moonriseStr: moonriseStr,
        moonsetStr: moonsetStr,
        phase: activePhase,
        illumPct: illumPct,
        lunarAge: lunarAge,
        isWaxing: isWaxing,
        westernFullMoonName: westernFullMoonName,
        vedicPurnimaName: vedicPurnimaName,
        activeShower: activeShower,
        rainVal: rainVal,
        rainSub: rainSub,
        rainOutlookDetails: rainOutlookDetails,
        peakVal: peakVal,
        peakSub: peakSub,
        peakDetails: peakDetails,
        daylightLabel: daylightLabel,
        daylightVal: daylightVal,
        daylightSub: daylightSub,
        goldenVal: goldenVal,
        goldenSub: goldenSub,
        moonPos: moonPos,
        isMoonAbove: isMoonAbove,
        moonAltDeg: moonAltDeg,
        cloudClarity: cloudClarity,
        eventLabel: eventLabel,
        eventVal: eventVal,
        eventSub: eventSub,
        now: now
      };
    },

    // ==============================================================================
    // Hover Popover & Progressive Disclosure System
    // ==============================================================================

    initHoverPopovers: function() {
      if (this._hoverPopoversInitialized) return;
      this._hoverPopoversInitialized = true;
      var self = this;
      if (!this.dom.hudHoverPopover) {
        this.dom.hudHoverPopover = document.getElementById('hud-hover-popover');
        if (!this.dom.hudHoverPopover) {
          var el = document.createElement('div');
          el.id = 'hud-hover-popover';
          el.className = 'hud-hover-popover';
          if (typeof el.setAttribute === 'function') {
            el.setAttribute('role', 'tooltip');
            el.setAttribute('aria-hidden', 'true');
          }
          if (document.body && typeof document.body.appendChild === 'function') {
            document.body.appendChild(el);
          }
          this.dom.hudHoverPopover = el;
        }
      }

      var targets = [
        { el: this.dom.hudWeatherCard || (this.dom.hudTempVal && typeof this.dom.hudTempVal.closest === 'function' ? this.dom.hudTempVal.closest('#hud-weather-card') : null), type: 'weather' },
        { el: this.dom.hudMetricsRow, type: 'metrics' },
        { el: this.dom.metricWind, type: 'wind' },
        { el: this.dom.metricHumidity, type: 'humidity' },
        { el: this.dom.metricPrecip, type: 'precip' },
        { el: this.dom.hudForecastCard, type: 'forecast' },
        { el: this.dom.ephemerisDayRain, type: 'rain-outlook' },
        { el: this.dom.ephemerisDayPeak, type: 'peak-feels' },
        { el: this.dom.ephemerisDaySun, type: 'daylight' },
        { el: this.dom.ephemerisNightGolden, type: 'night-golden' },
        { el: this.dom.ephemerisNightMoon, type: 'night-moon' },
        { el: this.dom.ephemerisNightEvent, type: 'night-event' },
        { el: this.dom.hudAqiCard, type: 'aqi' },
        { el: this.dom.hudHwBlock, type: 'hw-block' },
        { el: document.getElementById('hw-cpu-row'), type: 'hw-cpu' },
        { el: document.getElementById('hw-gpu-row'), type: 'hw-gpu' },
        { el: document.getElementById('hw-ram-row'), type: 'hw-ram' },
        { el: document.getElementById('hw-disk-row'), type: 'hw-disk' },
        { el: this.dom.hwNetDownRow, type: 'hw-net-down' },
        { el: this.dom.hwNetUpRow, type: 'hw-net-up' },
        { el: this.dom.hwBatteryRow, type: 'hw-battery' },
        { el: this.dom.hudNewsBlock, type: 'news-block' },
        { el: this.dom.pomodoroCard, type: 'pomodoro' },
        { el: this.dom.mediaCard, type: 'media' }
      ];

      function attachHoverTarget(item) {
        if (!item || !item.el) return;
        var el = item.el;
        var type = item.type;

        if (typeof el.hasAttribute === 'function' && !el.hasAttribute('tabindex')) {
          el.setAttribute('tabindex', '0');
        }

        el.addEventListener('mouseenter', function() {
          self.showHoverPopover(el, type);
        });
        el.addEventListener('mouseleave', function() {
          self.hideHoverPopover();
        });
        el.addEventListener('focusin', function() {
          self.showHoverPopover(el, type);
        });
        el.addEventListener('focusout', function() {
          self.hideHoverPopover();
        });
        el.addEventListener('touchstart', function(e) {
          if (self.isHoverPopoverOpen && self.currentPopoverAnchor === el) {
            self.hideHoverPopover();
          } else {
            self.showHoverPopover(el, type);
          }
        }, { passive: true });
      }

      for (var i = 0; i < targets.length; i++) {
        attachHoverTarget(targets[i]);
      }

      if (!this._popoverGlobalListenersAttached) {
        this._popoverGlobalListenersAttached = true;
        window.addEventListener('resize', function() {
          if (self.isHoverPopoverOpen && self.currentPopoverAnchor) {
            self.showHoverPopover(self.currentPopoverAnchor, self._currentPopoverType);
          }
        });
        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape') {
            if (self.isHoverPopoverOpen) {
              self.hideHoverPopover();
            }
            if (self.isDetailOpen) {
              self.closeCardDetail();
            }
          }
        });
      }

      this.attachNewsDotListeners();
    },

    clearNewsTimers: function() {
      if (this.newsTimer) {
        clearInterval(this.newsTimer);
        this.newsTimer = null;
      }
      if (this.newsTransitionTimer) {
        clearTimeout(this.newsTransitionTimer);
        this.newsTransitionTimer = null;
      }
      if (this.dom.hudNewsLink) {
        this.dom.hudNewsLink.classList.remove('is-fading');
      }
    },

    attachNewsDotListeners: function() {
      var self = this;
      if (!this.dom.hudNewsDots || this._newsDotsDelegated) return;
      this._newsDotsDelegated = true;

      var container = this.dom.hudNewsDots;

      container.addEventListener('click', function(e) {
        var target = e.target;
        var dot = (target && typeof target.closest === 'function') ? target.closest('.news-dot') : null;
        if (!dot && target && target.classList && target.classList.contains('news-dot')) dot = target;
        if (!dot) return;
        e.stopPropagation();
        var idx = parseInt(dot.getAttribute('data-idx') || '0', 10);
        self.selectNewsStory(idx);
      });

      container.addEventListener('mouseover', function(e) {
        var target = e.target;
        var dot = (target && typeof target.closest === 'function') ? target.closest('.news-dot') : null;
        if (!dot && target && target.classList && target.classList.contains('news-dot')) dot = target;
        if (dot) self.showHoverPopover(dot, 'news-dot');
      });

      container.addEventListener('mouseout', function(e) {
        var target = e.target;
        var dot = (target && typeof target.closest === 'function') ? target.closest('.news-dot') : null;
        if (!dot && target && target.classList && target.classList.contains('news-dot')) dot = target;
        if (dot) self.hideHoverPopover();
      });

      container.addEventListener('focusin', function(e) {
        var target = e.target;
        var dot = (target && typeof target.closest === 'function') ? target.closest('.news-dot') : null;
        if (!dot && target && target.classList && target.classList.contains('news-dot')) dot = target;
        if (dot) self.showHoverPopover(dot, 'news-dot');
      });

      container.addEventListener('focusout', function(e) {
        var target = e.target;
        var dot = (target && typeof target.closest === 'function') ? target.closest('.news-dot') : null;
        if (!dot && target && target.classList && target.classList.contains('news-dot')) dot = target;
        if (dot) self.hideHoverPopover();
      });

      container.addEventListener('keydown', function(e) {
        var target = e.target;
        var dot = (target && typeof target.closest === 'function') ? target.closest('.news-dot') : null;
        if (!dot && target && target.classList && target.classList.contains('news-dot')) dot = target;
        if (!dot) return;

        var currentIdx = parseInt(dot.getAttribute('data-idx') || '0', 10);
        var visibleDots = container.querySelectorAll ? container.querySelectorAll('.news-dot:not([style*="display: none"])') : [];
        var count = visibleDots.length || (self.newsItems ? self.newsItems.length : 1);
        var targetIdx = -1;

        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          self.selectNewsStory(currentIdx);
          return;
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          targetIdx = (currentIdx + 1) % count;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          targetIdx = (currentIdx - 1 + count) % count;
        } else if (e.key === 'Home') {
          e.preventDefault();
          targetIdx = 0;
        } else if (e.key === 'End') {
          e.preventDefault();
          targetIdx = count - 1;
        }

        if (targetIdx >= 0 && targetIdx !== currentIdx) {
          self.selectNewsStory(targetIdx);
          var nextDot = container.querySelector ? container.querySelector('.news-dot[data-idx="' + targetIdx + '"]') : null;
          if (nextDot && typeof nextDot.focus === 'function') {
            nextDot.focus();
          }
        }
      });
    },

    selectNewsStory: function(idx) {
      if (!this.newsItems || this.newsItems.length === 0) return;
      this.clearNewsTimers();
      if (this.dom.hudNewsLink) {
        this.dom.hudNewsLink.classList.remove('is-fading');
      }
      this.currentNewsIdx = idx % this.newsItems.length;
      this.displayNewsItem(this.currentNewsIdx);

      var rotSec = (global.LOCAL_WALLY_CONFIG && typeof global.LOCAL_WALLY_CONFIG.newsRotateIntervalSeconds === 'number')
        ? Math.max(3, global.LOCAL_WALLY_CONFIG.newsRotateIntervalSeconds)
        : 7;
      if (!this.isPlaybackPaused && this.showNewsFeed && this.newsItems && this.newsItems.length > 1) {
        this.newsTimer = setInterval(this.rotateNews.bind(this), rotSec * 1000);
      }

      if (this.isHoverPopoverOpen && this.currentPopoverAnchor) {
        this.showHoverPopover(this.currentPopoverAnchor, 'news-dot');
      }
    },

    showHoverPopover: function(anchorEl, popoverType) {
      if (!this.dom.hudHoverPopover || !anchorEl) return;
      if (this.isDetailOpen) return;

      var content = this.getPopoverContent(popoverType, anchorEl);
      if (!content) return;

      var pop = this.dom.hudHoverPopover;
      var safeTitle = App.escapeHtml ? App.escapeHtml(content.title) : content.title;
      pop.innerHTML = '<div class="hud-popover-title">' + safeTitle + '</div>' +
                      '<div class="hud-popover-body">' + content.bodyHtml + '</div>';

      if (this.currentPopoverAnchor && this.currentPopoverAnchor !== anchorEl) {
        this.currentPopoverAnchor.removeAttribute('aria-describedby');
      }
      this.currentPopoverAnchor = anchorEl;
      this._currentPopoverType = popoverType;
      anchorEl.setAttribute('aria-describedby', 'hud-hover-popover');

      pop.classList.add('is-visible');
      pop.setAttribute('aria-hidden', 'false');
      this.isHoverPopoverOpen = true;

      var rect = anchorEl.getBoundingClientRect();
      var popW = pop.offsetWidth || 230;
      var popH = pop.offsetHeight || 90;
      var pad = 8;
      var vw = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 1920;
      var vh = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 1080;

      var top, left;
      if (rect.bottom + popH + pad <= vh) {
        top = rect.bottom + 6;
      } else if (rect.top - popH - 6 >= pad) {
        top = rect.top - popH - 6;
      } else {
        top = Math.max(pad, vh - popH - pad);
      }

      left = rect.left + (rect.width / 2) - (popW / 2);
      if (left < pad) left = pad;
      if (left + popW + pad > vw) left = vw - popW - pad;

      pop.style.top = Math.round(top) + 'px';
      pop.style.left = Math.round(left) + 'px';
      this._startPopoverLinger(anchorEl);
    },

    hideHoverPopover: function() {
      if (!this.dom.hudHoverPopover) return;
      if (this._popoverLingerTimer) {
        clearInterval(this._popoverLingerTimer);
        this._popoverLingerTimer = null;
      }
      if (this.currentPopoverAnchor) {
        this.currentPopoverAnchor.removeAttribute('aria-describedby');
        this.currentPopoverAnchor = null;
      }
      this.dom.hudHoverPopover.classList.remove('is-visible');
      this.dom.hudHoverPopover.setAttribute('aria-hidden', 'true');
      this.isHoverPopoverOpen = false;
    },

    /**
     * Popover linger guard (v0.8.8): popovers must never outlive mouse
     * presence. When another window covers the wallpaper the WebView receives
     * NO mouse events at all, so mouseleave never fires and a popover could
     * linger forever while the user's mouse is somewhere else (report). Rules:
     *  - no mouse movement seen anywhere in the page for >10s  -> hide,
     *  - movement exists but never enters the anchor/popover for >12s -> hide,
     *  - movement inside the anchor/popover resets both clocks (a deliberate
     *    reader keeps the popover alive).
     */
    _startPopoverLinger: function(anchorEl) {
      if (this._popoverLingerTimer) {
        clearInterval(this._popoverLingerTimer);
        this._popoverLingerTimer = null;
      }
      // Never arm tooltip work while parked (R13): hover/focus paths re-arm
      // naturally on resume; the loop is not running to serve the popover.
      if (this.isPlaybackPaused) return;
      var now = Date.now();
      this._popoverAnyMoveAt = now;
      this._popoverAnchorMoveAt = now;
      // Fresh open: position unknown until the first mousemove (v0.8.12).
      this._popoverLastX = null;
      this._popoverLastY = null;
      this.currentPopoverLingerAnchor = anchorEl;
      if (!this._popoverMouseMoveBound) {
        this._popoverMouseMoveBound = true;
        var selfRef = this;
        document.addEventListener('mousemove', function(e) {
          selfRef._popoverMouseMoveHandler(e);
        }, { passive: true, capture: true });
        // The OS delivers these when the cursor leaves our window entirely or
        // focus moves elsewhere — instant closes for paths where they fire.
        document.addEventListener('mouseleave', function() {
          if (selfRef.isHoverPopoverOpen) selfRef.hideHoverPopover();
        });
        if (typeof global.addEventListener === 'function') {
          global.addEventListener('blur', function() {
            if (selfRef.isHoverPopoverOpen) selfRef.hideHoverPopover();
          });
        }
      }
      var self = this;
      this._popoverLingerTimer = setInterval(function() {
        self._checkPopoverLinger();
      }, 1500);
    },

    _popoverMouseMoveHandler: function(e) {
      if (!this.isHoverPopoverOpen) return;
      var now = Date.now();
      this._popoverAnyMoveAt = now;
      this._popoverLastX = e.clientX;
      this._popoverLastY = e.clientY;
      var inside = false;
      var anchor = this.currentPopoverAnchor;
      var pop = this.dom.hudHoverPopover;
      if (anchor && typeof anchor.getBoundingClientRect === 'function') {
        var r = anchor.getBoundingClientRect();
        inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      }
      if (!inside && pop && typeof pop.getBoundingClientRect === 'function') {
        var pr = pop.getBoundingClientRect();
        inside = e.clientX >= pr.left && e.clientX <= pr.right && e.clientY >= pr.top && e.clientY <= pr.bottom;
      }
      if (inside) this._popoverAnchorMoveAt = now;
    },

    _popoverCursorInsideBounds: function() {
      // Unknown cursor position is NOT "outside" (v0.8.14): hover without a
      // subsequent mousemove, keyboard focus, and touch all open the popover
      // with no coordinates yet — those get the bounded inside grace instead
      // of the short outside expiry.
      if (this._popoverLastX === null || this._popoverLastY === null) return true;
      var x = this._popoverLastX;
      var y = this._popoverLastY;
      var anchor = this.currentPopoverAnchor;
      var pop = this.dom.hudHoverPopover;
      try {
        if (anchor && typeof anchor.getBoundingClientRect === 'function') {
          var r = anchor.getBoundingClientRect();
          if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
        }
        if (pop && typeof pop.getBoundingClientRect === 'function') {
          var pr = pop.getBoundingClientRect();
          if (x >= pr.left && x <= pr.right && y >= pr.top && y <= pr.bottom) return true;
        }
      } catch (e) {}
      return false;
    },

    /**
     * Position-aware staleness (v0.8.12; unknown-pointer fix v0.8.14). The
     * WebView receives NO mouse events while another window covers the
     * wallpaper, so mouseleave never fires and a popover can linger. Rules:
     *   - last known cursor OUTSIDE the anchor/popover  -> stale after 3s,
     *   - last known cursor INSIDE, or unknown (keyboard focus, touch, hover
     *     with no mousemove yet) -> 8s hard cap; micro-movements reset it,
     *   - instant close on document mouseleave / window blur where delivered.
     */
    _checkPopoverLinger: function() {
      if (!this.isHoverPopoverOpen) {
        if (this._popoverLingerTimer) {
          clearInterval(this._popoverLingerTimer);
          this._popoverLingerTimer = null;
        }
        return;
      }
      var now = Date.now();
      var sinceAny = now - (this._popoverAnyMoveAt || 0);
      var insideNow = this._popoverCursorInsideBounds();
      // Foreground accelerator (v0.8.15): when another window owns the
      // focus, the user is demonstrably working elsewhere — a popover that
      // survives silence on an unfocused page is stale after 1.5s, even when
      // the last known cursor position was over the card. (An actively
      // hovering reader keeps generating mousemove events, so this never
      // interrupts genuine interaction.)
      var pageFocused = true;
      try {
        pageFocused = (typeof document !== 'undefined' && typeof document.hasFocus === 'function')
          ? document.hasFocus()
          : true;
      } catch (e) { pageFocused = true; }
      if (!pageFocused && sinceAny > 1500) {
        this.hideHoverPopover();
        return;
      }
      if (insideNow ? (sinceAny > 8000) : (sinceAny > 3000)) {
        this.hideHoverPopover();
      }
    },

    getPopoverContent: function(type, el) {
      function esc(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      }

      var state = this.state || {};
      var weather = state.weather || {};
      var aqi = state.aqi || {};
      var isF = (this.tempUnit === 'F');
      var celestial = this.celestialData || {};

      function makeRows(rows) {
        var h = '<div class="hud-popover-rows">';
        for (var i = 0; i < rows.length; i++) {
          h += '<div class="hud-popover-row">' +
            '<span class="hud-popover-row-label">' + esc(rows[i][0]) + '</span>' +
            '<span class="hud-popover-row-val">' + esc(rows[i][1]) + '</span>' +
          '</div>';
        }
        h += '</div>';
        return h;
      }

      var tempC = weather.tempC != null ? weather.tempC : 20;
      var hum = weather.humidity != null ? weather.humidity : 55;
      var dewC = Math.round((tempC - ((100 - hum) / 5)) * 10) / 10;
      var dewStr = isF ? Math.round(((dewC * 9 / 5) + 32)) + '°F' : dewC + '°C';

      switch (type) {
        case 'weather':
          var minT = isF ? weather.tempMinF : weather.tempMinC;
          var maxT = isF ? weather.tempMaxF : weather.tempMaxC;
          return {
            title: 'Atmospheric Conditions',
            bodyHtml: makeRows([
              ['Min / Max Today', (minT != null ? minT + '°' : '--') + ' / ' + (maxT != null ? maxT + '°' : '--')],
              ['Relative Humidity', (weather.humidity != null ? weather.humidity + '%' : '--')],
              ['Dew Point', dewStr],
              ['Barometric Pressure', (weather.pressureHpa ? weather.pressureHpa + ' hPa' : '1013 hPa')],
              ['Surface Wind', (weather.windSpeedKm != null ? weather.windSpeedKm + ' km/h' : 'Calm') + (weather.windDirection ? ' · ' + weather.windDirection : '')]
            ])
          };

        case 'metrics':
          return {
            title: 'Environmental Metrics',
            bodyHtml: makeRows([
              ['Relative Humidity', (weather.humidity != null ? weather.humidity + '%' : '--')],
              ['Surface Wind', (weather.windSpeedKm != null ? weather.windSpeedKm + ' km/h' : 'Calm')],
              ['Precipitation', (weather.precipitationMm != null ? weather.precipitationMm + ' mm' : '0.0 mm')]
            ])
          };

        case 'wind':
          var gustEst = weather.windSpeedKm != null ? (weather.windSpeedKm * 1.35).toFixed(1) + ' km/h' : '--';
          return {
            title: 'Surface Wind Telemetry',
            bodyHtml: makeRows([
              ['Velocity', (weather.windSpeedKm != null ? weather.windSpeedKm + ' km/h (' + (weather.windSpeedMph || 0) + ' mph)' : 'Calm')],
              ['Direction', (weather.windDirection || 'Variable air flow')],
              ['Estimated Gusts', gustEst],
              ['Scale', (weather.windSpeedKm < 6 ? 'Light Air' : (weather.windSpeedKm < 20 ? 'Gentle Breeze' : 'Moderate Breeze'))]
            ])
          };

        case 'humidity':
          var comfort = hum < 30 ? 'Dry' : (hum <= 60 ? 'Comfortable' : 'Humid');
          return {
            title: 'Atmospheric Moisture',
            bodyHtml: makeRows([
              ['Relative Humidity', hum + '%'],
              ['Dew Point', dewStr],
              ['Comfort Index', comfort],
              ['Vapor Saturation', (hum * 0.173).toFixed(1) + ' g/m³ (est.)']
            ])
          };

        case 'precip':
          return {
            title: 'Precipitation Dynamics',
            bodyHtml: makeRows([
              ['Current Rate', (weather.precipitationMm != null ? weather.precipitationMm + ' mm/h' : '0.0 mm/h')],
              ['6h Rain Outlook', (celestial.rainVal || 'No Rain') + ' (' + (celestial.rainSub || 'Clear') + ')'],
              ['3h Accumulation', ((weather.precipitationMm || 0) * 3).toFixed(1) + ' mm (est.)']
            ])
          };

        case 'rain-outlook':
          var pts = celestial.rainOutlookDetails || [];
          var sumTxt = (celestial.rainVal || 'No Rain') + ' (' + (celestial.rainSub || 'Clear') + ')';
          var rows = [['Outlook Summary', sumTxt]];
          for (var r = 0; r < Math.min(3, pts.length); r++) {
            rows.push([pts[r].time, pts[r].prob + '% chance' + (pts[r].mm > 0 ? ' (' + pts[r].mm + 'mm)' : '')]);
          }
          return {
            title: '6-Hour Rain Outlook',
            bodyHtml: makeRows(rows)
          };

        case 'peak-feels':
          var pkHum = (celestial.peakDetails && celestial.peakDetails.peakHumidity != null) ? celestial.peakDetails.peakHumidity + '%' : 'Nominal';
          return {
            title: 'Feels-Like Thermal Peak',
            bodyHtml: makeRows([
              ['Projected Peak', celestial.peakVal || '--°'],
              ['Expected Time', celestial.peakSub || 'at --:--'],
              ['Peak Humidity', pkHum],
              ['Variance', 'Derived from apparent temperature model']
            ])
          };

        case 'daylight':
          return {
            title: 'Solar Arc & Daylight',
            bodyHtml: makeRows([
              ['Solar Status', (celestial.daylightVal || '--') + ' (' + (celestial.daylightSub || '') + ')'],
              ['Sunrise / Sunset', (celestial.sunriseStr || '--:--') + ' / ' + (celestial.sunsetStr || '--:--')],
              ['Solar Noon', celestial.noonStr || '--:--']
            ])
          };

        case 'night-golden':
          return {
            title: 'Next Golden Hour Window',
            bodyHtml: makeRows([
              ['Time Remaining', celestial.goldenVal || 'tomorrow'],
              ['Morning Window', celestial.goldenSub || '--:--'],
              ['Solar Geometry', 'Warm low-angle rays (+6° transit)']
            ])
          };

        case 'night-moon':
          var mPhase = celestial.phase || {};
          return {
            title: 'Lunar Ephemeris & Sky View',
            bodyHtml: makeRows([
              ['Phase & Illum', (mPhase.glyph || '🌕') + ' ' + (celestial.westernFullMoonName || mPhase.name || 'Moon') + ' (' + (celestial.illumPct || '--%') + ')'],
              ['Horizon Altitude', (celestial.isMoonAbove ? 'Above horizon' : 'Below horizon') + ' (' + (celestial.moonAltDeg || 0) + '°)'],
              ['Lunar Cycle Age', (celestial.lunarAge || '14.8') + ' days (' + (celestial.isWaxing ? 'Waxing' : 'Waning') + ')'],
              ['Sky View Clarity', celestial.cloudClarity || 'Clear sky']
            ])
          };

        case 'night-event':
          var shTxt = celestial.activeShower ? (celestial.activeShower.name + ' (' + celestial.activeShower.peak + ')') : 'None active';
          return {
            title: 'Upcoming Celestial Transit',
            bodyHtml: makeRows([
              ['Next Sky Event', celestial.eventVal || 'Dawn'],
              ['Observation Timing', celestial.eventSub || 'at --:--'],
              ['Meteor Shower', shTxt]
            ])
          };

        case 'forecast':
          var tab = (this.forecastChart && this.forecastChart.activeTab) ? this.forecastChart.activeTab.toUpperCase() : 'TEMPERATURE';
          return {
            title: 'Hourly Forecast Track',
            bodyHtml: makeRows([
              ['Active Metric', tab],
              ['Prediction Span', '8 sequential points across 24h'],
              ['Controls', 'Click tabs to view Precip, Wind, AQI']
            ])
          };

        case 'aqi':
          var aqiNum = aqi.europeanAqi != null ? aqi.europeanAqi : (aqi.value != null ? aqi.value : '--');
          var cat = aqi.category || 'Unavailable';
          var adv = aqiNum <= 50 ? 'Air quality is satisfactory.' : 'Sensitive individuals should reduce exertion.';
          return {
            title: 'Air Quality & Pollutants',
            bodyHtml: makeRows([
              ['Quality Status', cat + ' (' + aqiNum + ')'],
              ['PM2.5 / PM10', (aqi.pm25 != null ? aqi.pm25 + ' µg/m³' : '--') + ' / ' + (aqi.pm10 != null ? aqi.pm10 + ' µg/m³' : '--')],
              ['Health Advisory', adv]
            ])
          };

        case 'hw-block':
          return {
            title: 'Hardware Telemetry Monitor',
            bodyHtml: makeRows([
              ['Processor (CPU)', (this.dom.hwCpuVal ? this.dom.hwCpuVal.textContent : '--%')],
              ['Graphics (GPU)', (this.dom.hwGpuVal ? this.dom.hwGpuVal.textContent : '--%')],
              ['Memory (RAM)', (this.dom.hwRamVal ? this.dom.hwRamVal.textContent : '--%')],
              ['Storage (Disk)', (this.dom.hwDiskVal ? this.dom.hwDiskVal.textContent : '--%')]
            ])
          };

        case 'hw-cpu':
          return {
            title: 'Processor Telemetry',
            bodyHtml: makeRows([
              ['Current Load', (this.dom.hwCpuVal ? this.dom.hwCpuVal.textContent : '--%')],
              ['Device', (this.dom.hwCpuName ? this.dom.hwCpuName.textContent : 'Processor')],
              ['Telemetry', 'Dynamic rolling sparkline buffer']
            ])
          };

        case 'hw-gpu':
          return {
            title: 'Graphics 3D Telemetry',
            bodyHtml: makeRows([
              ['3D Utilization', (this.dom.hwGpuVal ? this.dom.hwGpuVal.textContent : '--%')],
              ['Engine', (this.dom.hwGpuName ? this.dom.hwGpuName.textContent : 'Graphics 3D')]
            ])
          };

        case 'hw-ram':
          return {
            title: 'Physical Memory Telemetry',
            bodyHtml: makeRows([
              ['Utilization', (this.dom.hwRamVal ? this.dom.hwRamVal.textContent : '--%')],
              ['Allocation', (this.dom.hwRamDetail ? this.dom.hwRamDetail.textContent : '-- / -- GB')]
            ])
          };

        case 'hw-disk':
          return {
            title: 'Storage Activity',
            bodyHtml: makeRows([
              ['Active Load', (this.dom.hwDiskVal ? this.dom.hwDiskVal.textContent : '--%')],
              ['Subsystem', (this.dom.hwDiskDetail ? this.dom.hwDiskDetail.textContent : 'Storage')]
            ])
          };

        case 'hw-net-down':
        case 'hw-net-up':
          return {
            title: 'Network Bandwidth',
            bodyHtml: makeRows([
              ['Download Rate', (this.dom.hwNetDownVal ? this.dom.hwNetDownVal.textContent : '0 Kbps')],
              ['Upload Rate', (this.dom.hwNetUpVal ? this.dom.hwNetUpVal.textContent : '0 Kbps')]
            ])
          };

        case 'hw-battery':
          return {
            title: 'Battery & Power Subsystem',
            bodyHtml: makeRows([
              ['Charge Level', (this.dom.hwBatteryVal ? this.dom.hwBatteryVal.textContent : '--%')],
              ['Status', (this.dom.hwBatteryStatus ? this.dom.hwBatteryStatus.textContent : 'Battery')]
            ])
          };

        case 'news-block':
          return {
            title: 'News Feed',
            bodyHtml: makeRows([
              ['Active Headline', (this.dom.hudNewsHeadline ? this.dom.hudNewsHeadline.textContent : 'News')],
              ['Source Outlet', (this.dom.hudNewsSource ? this.dom.hudNewsSource.textContent : 'News Source')],
              ['Feed Controls', 'Click story dots to jump; click to read']
            ])
          };

        case 'news-dot':
          var dotIdx = parseInt(el ? el.getAttribute('data-idx') : '0', 10);
          var story = (this.newsItems && this.newsItems[dotIdx]) || {};
          var storyAge = this.formatNewsAge(story);
          return {
            title: 'Story ' + (dotIdx + 1) + ' of ' + (this.newsItems ? this.newsItems.length : 1),
            bodyHtml: makeRows([
              ['Headline', story.title || 'Regional Story'],
              ['Source & Age', (storyAge ? storyAge + ' · ' : '') + (story.source || 'Regional Publisher')],
              ['Action', 'Click or press Enter to view this story now']
            ])
          };

        case 'pomodoro':
          return {
            title: 'Focus Timer Subsystem',
            bodyHtml: makeRows([
              ['Session Mode', (this.pomodoro ? this.pomodoro.mode.toUpperCase() : 'FOCUS')],
              ['Remaining', (this.pomodoro && this.dom.pomodoroTime ? this.dom.pomodoroTime.textContent : '25:00')],
              ['Status', (this.pomodoro && this.pomodoro.isRunning ? 'Running' : 'Paused')]
            ])
          };

        case 'media':
          return {
            title: 'Media Subsystem',
            bodyHtml: makeRows([
              ['Now Playing', (this.dom.mediaTitle ? this.dom.mediaTitle.textContent : 'No media playing')],
              ['Artist', (this.dom.mediaArtist ? this.dom.mediaArtist.textContent : 'Windows SMTC Idle')],
              ['Audio Engine', '60 FPS 32-Band Psychoacoustic FFT']
            ])
          };

        default:
          return null;
      }
    },

    openCardDetail: function(cardType, triggerEl) {
      if (this.isHoverPopoverOpen) this.hideHoverPopover();
      if (!this.dom.hudCardDetail) return;
      this.isDetailOpen = true;
      this.activeDetailCard = cardType;
      this.lastDetailTrigger = triggerEl;

      this.renderCardDetailContent(cardType);

      this.dom.hudCardDetail.classList.remove('is-hidden');
      this.dom.hudCardDetail.setAttribute('aria-hidden', 'false');

      if (this.dom.hudDetailClose && typeof this.dom.hudDetailClose.focus === 'function') {
        this.dom.hudDetailClose.focus();
      }
    },

    closeCardDetail: function() {
      if (!this.dom.hudCardDetail) return;
      this.isDetailOpen = false;
      this.activeDetailCard = null;

      this.dom.hudCardDetail.classList.add('is-hidden');
      this.dom.hudCardDetail.setAttribute('aria-hidden', 'true');

      if (this.lastDetailTrigger && typeof this.lastDetailTrigger.focus === 'function') {
        this.lastDetailTrigger.focus();
        this.lastDetailTrigger = null;
      }
    },

    renderCardDetailContent: function(cardType) {
      if (!this.dom.hudCardDetail || !this.dom.hudDetailBody) return;

      function esc(str) {
        if (str === null || str === undefined) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      var iconEl = this.dom.hudDetailIcon;
      var titleEl = this.dom.hudDetailTitle;
      var bodyEl = this.dom.hudDetailBody;

      var state = this.state || {};
      var weather = state.weather || {};
      var location = state.location || {};
      var aqi = state.aqi || {};
      var celestial = this.celestialData || {};
      var tempUnit = this.tempUnit || 'C';

      var html = '';

      switch (cardType) {
        case 'weather':
          if (iconEl) iconEl.textContent = '🌤️';
          if (titleEl) titleEl.textContent = 'Atmospheric Telemetry';

          var tempStr = '--';
          var curT = tempUnit === 'F' ? weather.tempF : weather.tempC;
          if (curT == null && weather.temp != null && Number.isFinite(weather.temp)) {
            curT = tempUnit === 'F' ? Math.round(weather.temp * 9 / 5 + 32) : Math.round(weather.temp);
          }
          if (curT != null && Number.isFinite(curT)) {
            tempStr = Math.round(curT) + '°' + tempUnit;
          }

          var feelsStr = '--';
          var curApp = tempUnit === 'F' ? weather.apparentF : weather.apparentC;
          if (curApp == null && weather.feelsLike != null && Number.isFinite(weather.feelsLike)) {
            curApp = tempUnit === 'F' ? Math.round(weather.feelsLike * 9 / 5 + 32) : Math.round(weather.feelsLike);
          }
          if (curApp != null && Number.isFinite(curApp)) {
            feelsStr = Math.round(curApp) + '°' + tempUnit;
          }

          var pVal = weather.precipitationMm != null ? weather.precipitationMm : (weather.precipMm != null ? weather.precipMm : 0.0);

          var locName = location.city || 'Local Area';
          if (location.country && location.city && location.country !== location.city) {
            locName += ', ' + location.country;
          }

          html = '<div class="hud-detail-grid">' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Current Temp</span>' +
              '<span class="hud-detail-item-val">' + esc(tempStr) + '</span>' +
              '<span class="hud-detail-item-sub">Feels like ' + esc(feelsStr) + '</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Condition</span>' +
              '<span class="hud-detail-item-val">' + esc(weather.conditionText || 'Fair') + '</span>' +
              '<span class="hud-detail-item-sub">Category: ' + esc(weather.category || 'CLEAR') + '</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Relative Humidity</span>' +
              '<span class="hud-detail-item-val">' + esc(weather.humidity != null ? weather.humidity + '%' : 'Unavailable') + '</span>' +
              '<span class="hud-detail-item-sub">Dew point equilibrium</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Surface Wind</span>' +
              '<span class="hud-detail-item-val">' + esc(weather.windSpeedKm != null ? weather.windSpeedKm + ' km/h' : 'Calm') + '</span>' +
              '<span class="hud-detail-item-sub">' + (weather.windDirection ? esc(weather.windDirection) : 'Variable direction') + '</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Precipitation</span>' +
              '<span class="hud-detail-item-val">' + esc(pVal != null ? pVal + ' mm' : '0.0 mm') + '</span>' +
              '<span class="hud-detail-item-sub">Surface accumulation</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Barometric Pressure</span>' +
              '<span class="hud-detail-item-val">' + esc(weather.pressureHpa ? weather.pressureHpa + ' hPa' : '1013 hPa') + '</span>' +
              '<span class="hud-detail-item-sub">Mean sea-level</span>' +
            '</div>' +
            '<div class="hud-detail-item full-width">' +
              '<span class="hud-detail-item-label">Location & Source</span>' +
              '<span class="hud-detail-item-val">' + esc(locName) + '</span>' +
              '<span class="hud-detail-item-sub">Provider: ' + esc(weather.provider || 'Open-Meteo API') + ' (Verified Live)</span>' +
            '</div>' +
          '</div>';
          break;

        case 'forecast':
          if (iconEl) iconEl.textContent = '📈';
          if (titleEl) titleEl.textContent = 'Hourly Forecast Analysis';

          var activeTab = (this.forecastChart && this.forecastChart.activeTab) || 'temp';
          var tabLabels = {
            temp: 'Temperature (°' + tempUnit + ')',
            feels_like: 'Feels Like (°' + tempUnit + ')',
            precip: 'Precipitation Probability (%)',
            wind: 'Surface Wind Speed (' + (tempUnit === 'F' ? 'mph' : 'km/h') + ')',
            humidity: 'Relative Humidity (%)',
            aqi: 'Air Quality Index'
          };
          var metricTitle = tabLabels[activeTab] || 'Forecast Metric';
          var points = (this.forecastChart && this.forecastChart.points) || [];

          var ptsHtml = '';
          if (points && points.length > 0) {
            ptsHtml = '<div class="hud-detail-grid">';
            var isF = (tempUnit === 'F');
            for (var pi = 0; pi < Math.min(8, points.length); pi++) {
              var pt = points[pi];
              var v = NaN;
              if (activeTab === 'temp') v = isF ? pt.tempF : pt.tempC;
              else if (activeTab === 'feels_like') v = isF ? pt.apparentF : pt.apparentC;
              else if (activeTab === 'precip') v = (pt.precipProb != null) ? pt.precipProb : (pt.value != null ? pt.value : NaN);
              else if (activeTab === 'wind') v = isF ? pt.windSpeedMph : pt.windSpeedKm;
              else if (activeTab === 'humidity') v = (pt.humidity != null) ? pt.humidity : NaN;
              else if (activeTab === 'aqi') v = (pt.aqi != null) ? pt.aqi : NaN;

              if (isNaN(v) && typeof pt.value === 'number') v = pt.value;

              var ptVal = (!isNaN(v) && typeof v === 'number') ? (Math.round(v * 10) / 10).toString() : (pt.value || '--');
              var suffix = '';
              if (activeTab === 'temp' || activeTab === 'feels_like') suffix = '°';
              else if (activeTab === 'precip' || activeTab === 'humidity') suffix = '%';
              else if (activeTab === 'wind') suffix = isF ? ' mph' : ' km/h';

              if (ptVal !== '--') ptVal += suffix;

              ptsHtml += '<div class="hud-detail-item">' +
                '<span class="hud-detail-item-label">' + esc(pt.label || pt.time || ('+' + (pi * 3) + 'h')) + '</span>' +
                '<span class="hud-detail-item-val">' + esc(ptVal) + '</span>' +
              '</div>';
            }
            ptsHtml += '</div>';
          } else {
            ptsHtml = '<div class="hud-detail-item full-width"><span class="hud-detail-item-val">No hourly forecast series cached.</span></div>';
          }

          html = '<div class="hud-detail-item full-width" style="margin-bottom: 6px;">' +
            '<span class="hud-detail-item-label">Active Forecast Horizon</span>' +
            '<span class="hud-detail-item-val">' + esc(metricTitle) + '</span>' +
            '<span class="hud-detail-item-sub">8 sequential prediction intervals (+24h horizon)</span>' +
          '</div>' + ptsHtml;
          break;

        case 'news':
          if (iconEl) iconEl.textContent = '📰';
          if (titleEl) titleEl.textContent = 'News Feed';

          var newsList = this.newsItems || state.news || [];
          if (newsList && newsList.length > 0) {
            html = '<div class="hud-detail-news-list">';
            for (var ni = 0; ni < newsList.length; ni++) {
              var nItem = newsList[ni];
              var rawUrl = nItem.link || nItem.url || '';
              var safeUrl = (typeof rawUrl === 'string' && /^https:\/\//i.test(rawUrl.trim())) ? rawUrl.trim() : '#';
              var ageLabel = this.formatNewsAge(nItem) || 'Recent';
              html += '<a class="hud-detail-news-item" data-news-index="' + ni + '" href="' + esc(safeUrl) + '" target="_blank" rel="noopener noreferrer">' +
                '<p class="hud-detail-news-title">' + esc(nItem.title || 'Untitled Story') + '</p>' +
                '<div class="hud-detail-news-meta">' +
                  '<span>' + esc(nItem.source || 'Publisher') + '</span>' +
                  '<span>' + esc(ageLabel) + '</span>' +
                '</div>' +
              '</a>';
            }
            html += '</div>';
          } else {
            html = '<div class="hud-detail-item full-width">' +
              '<span class="hud-detail-item-val">No regional news stories available.</span>' +
              '<span class="hud-detail-item-sub">Regional feed returned no usable stories for the current locality.</span>' +
            '</div>';
          }
          break;

        case 'aqi':
          if (iconEl) iconEl.textContent = '🍃';
          if (titleEl) titleEl.textContent = 'Air Quality & Pollutants';

          var aqiVal = (aqi.value != null) ? aqi.value : (aqi.europeanAqi != null ? aqi.europeanAqi : '--');
          var aqiCat = aqi.category || 'Unavailable';
          var pm25Val = aqi.pm25 != null ? aqi.pm25 + ' µg/m³' : '--';
          var pm10Val = aqi.pm10 != null ? aqi.pm10 + ' µg/m³' : '--';
          var no2Val = aqi.no2 != null ? aqi.no2 + ' µg/m³' : 'Nominal';
          var o3Val = aqi.o3 != null ? aqi.o3 + ' µg/m³' : 'Nominal';

          html = '<div class="hud-detail-grid">' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Air Quality Index</span>' +
              '<span class="hud-detail-item-val">' + esc(aqiVal) + '</span>' +
              '<span class="hud-detail-item-sub">Status: ' + esc(aqiCat) + '</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Data Provider</span>' +
              '<span class="hud-detail-item-val">' + esc(aqi.provider || 'Open-Meteo Air Quality') + '</span>' +
              '<span class="hud-detail-item-sub">European / US EPA Standard</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Fine Particulates (PM2.5)</span>' +
              '<span class="hud-detail-item-val">' + esc(pm25Val) + '</span>' +
              '<span class="hud-detail-item-sub">Respirable aerosol particles</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Coarse Dust (PM10)</span>' +
              '<span class="hud-detail-item-val">' + esc(pm10Val) + '</span>' +
              '<span class="hud-detail-item-sub">Inhalable coarse particles</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Nitrogen Dioxide (NO₂)</span>' +
              '<span class="hud-detail-item-val">' + esc(no2Val) + '</span>' +
              '<span class="hud-detail-item-sub">Combustion emissions</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Ground Ozone (O₃)</span>' +
              '<span class="hud-detail-item-val">' + esc(o3Val) + '</span>' +
              '<span class="hud-detail-item-sub">Photochemical oxidant</span>' +
            '</div>' +
            '<div class="hud-detail-item full-width">' +
              '<span class="hud-detail-item-label">General Health Context</span>' +
              '<span class="hud-detail-item-val">' + (aqiVal <= 50 ? 'Air quality is satisfactory. Outdoor activity is ideal.' : 'Moderate air quality. Sensitive individuals should consider reducing intense outdoor exposure.') + '</span>' +
              '<span class="hud-detail-item-sub">Standard environmental advisory</span>' +
            '</div>' +
          '</div>';
          break;

        case 'hardware':
          if (iconEl) iconEl.textContent = '⚡';
          if (titleEl) titleEl.textContent = 'Hardware System Telemetry';

          var cpuTxt = (this.dom.hwCpuVal ? this.dom.hwCpuVal.textContent : '--%');
          var cpuDev = (this.dom.hwCpuName ? this.dom.hwCpuName.textContent : 'Processor');
          var gpuTxt = (this.dom.hwGpuVal ? this.dom.hwGpuVal.textContent : '--%');
          var gpuDev = (this.dom.hwGpuName ? this.dom.hwGpuName.textContent : 'Graphics 3D');
          var ramTxt = (this.dom.hwRamVal ? this.dom.hwRamVal.textContent : '--%');
          var ramDet = (this.dom.hwRamDetail ? this.dom.hwRamDetail.textContent : 'Physical RAM');
          var diskTxt = (this.dom.hwDiskVal ? this.dom.hwDiskVal.textContent : '--%');
          var netDn = (this.dom.hwNetDownVal ? this.dom.hwNetDownVal.textContent : '0 Kbps');
          var netUp = (this.dom.hwNetUpVal ? this.dom.hwNetUpVal.textContent : '0 Kbps');

          html = '<div class="hud-detail-grid">' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">CPU Utilization</span>' +
              '<span class="hud-detail-item-val">' + esc(cpuTxt) + '</span>' +
              '<span class="hud-detail-item-sub">' + esc(cpuDev) + '</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">GPU 3D Engine</span>' +
              '<span class="hud-detail-item-val">' + esc(gpuTxt) + '</span>' +
              '<span class="hud-detail-item-sub">' + esc(gpuDev) + '</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Memory (RAM)</span>' +
              '<span class="hud-detail-item-val">' + esc(ramTxt) + '</span>' +
              '<span class="hud-detail-item-sub">' + esc(ramDet) + '</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Primary Storage</span>' +
              '<span class="hud-detail-item-val">' + esc(diskTxt) + '</span>' +
              '<span class="hud-detail-item-sub">Drive C: Activity</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Network Ingress</span>' +
              '<span class="hud-detail-item-val">' + esc(netDn) + '</span>' +
              '<span class="hud-detail-item-sub">Real-time download rate</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Network Egress</span>' +
              '<span class="hud-detail-item-val">' + esc(netUp) + '</span>' +
              '<span class="hud-detail-item-sub">Real-time upload rate</span>' +
            '</div>' +
            '<div class="hud-detail-item full-width">' +
              '<span class="hud-detail-item-label">Telemetry Ingestion Engine</span>' +
              '<span class="hud-detail-item-val">Windows IPC Hook via Lively Wallpaper Host</span>' +
              '<span class="hud-detail-item-sub">Hardware sampling rate: 2.0s cadence</span>' +
            '</div>' +
          '</div>';
          break;

        case 'battery':
          if (iconEl) iconEl.textContent = '🔋';
          if (titleEl) titleEl.textContent = 'Battery & Power Subsystem';

          var batPct = (this.lastBatteryPct != null ? this.lastBatteryPct : 100) + '%';
          var batChg = this.lastBatteryCharging ? 'Charging (AC Connected)' : 'Discharging (Battery Power)';

          html = '<div class="hud-detail-grid">' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Charge Level</span>' +
              '<span class="hud-detail-item-val">' + esc(batPct) + '</span>' +
              '<span class="hud-detail-item-sub">Internal pack capacity</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Power Source</span>' +
              '<span class="hud-detail-item-val">' + esc(batChg) + '</span>' +
              '<span class="hud-detail-item-sub">Navigator.getBattery() API</span>' +
            '</div>' +
            '<div class="hud-detail-item full-width">' +
              '<span class="hud-detail-item-label">Hardware Profile</span>' +
              '<span class="hud-detail-item-val">Portable Laptop / Surface Power Management</span>' +
              '<span class="hud-detail-item-sub">Auto-hides cleanly on desktop workstations lacking battery cells</span>' +
            '</div>' +
          '</div>';
          break;

        case 'ephemeris':
          if (iconEl) iconEl.textContent = '🌗';
          if (titleEl) titleEl.textContent = 'Ephemeris & Celestial Astronomy';

          var cPhase = celestial.phase || { name: 'Moon Phase', glyph: '🌕' };
          var showerTxt = celestial.activeShower
            ? (celestial.activeShower.name + ' Meteor Shower (Peak: ' + celestial.activeShower.peak + ')')
            : 'No major shower peak currently active';

          var outlookSection = '';
          if (celestial.isDay) {
            outlookSection =
              '<div class="hud-detail-item">' +
                '<span class="hud-detail-item-label">6h Rain Outlook</span>' +
                '<span class="hud-detail-item-val">' + esc(celestial.rainVal || 'No Rain') + '</span>' +
                '<span class="hud-detail-item-sub">' + esc(celestial.rainSub || 'Clear next 6h') + '</span>' +
              '</div>' +
              '<div class="hud-detail-item">' +
                '<span class="hud-detail-item-label">Feels-Like Peak</span>' +
                '<span class="hud-detail-item-val">' + esc(celestial.peakVal || '--°') + '</span>' +
                '<span class="hud-detail-item-sub">' + esc(celestial.peakSub || 'at --:--') + '</span>' +
              '</div>' +
              '<div class="hud-detail-item full-width">' +
                '<span class="hud-detail-item-label">' + esc(celestial.daylightLabel || 'Daylight Left') + '</span>' +
                '<span class="hud-detail-item-val">' + esc(celestial.daylightVal || '--:--') + '</span>' +
                '<span class="hud-detail-item-sub">' + esc(celestial.daylightSub || 'until sunset') + '</span>' +
              '</div>';
          } else {
            outlookSection =
              '<div class="hud-detail-item">' +
                '<span class="hud-detail-item-label">Next Golden Hour</span>' +
                '<span class="hud-detail-item-val">' + esc(celestial.goldenVal || '--:--') + '</span>' +
                '<span class="hud-detail-item-sub">' + esc(celestial.goldenSub || 'tomorrow') + '</span>' +
              '</div>' +
              '<div class="hud-detail-item">' +
                '<span class="hud-detail-item-label">' + esc(celestial.eventLabel || 'Next Sky Event') + '</span>' +
                '<span class="hud-detail-item-val">' + esc(celestial.eventVal || '--:--') + '</span>' +
                '<span class="hud-detail-item-sub">' + esc(celestial.eventSub || 'at --:--') + '</span>' +
              '</div>' +
              '<div class="hud-detail-item full-width">' +
                '<span class="hud-detail-item-label">Moon Visibility Outlook</span>' +
                '<span class="hud-detail-item-val">' + esc(celestial.moonAltDeg != null ? ('Altitude ' + celestial.moonAltDeg + '° (' + (celestial.isMoonAbove ? 'Above horizon' : 'Below horizon') + ')') : '--') + '</span>' +
                '<span class="hud-detail-item-sub">Sky condition: ' + esc(celestial.cloudClarity || 'Clear sky') + '</span>' +
              '</div>';
          }

          html = '<div class="hud-detail-grid">' +
            outlookSection +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Sunrise / Sunset</span>' +
              '<span class="hud-detail-item-val">' + esc(celestial.sunriseStr || '--:--') + ' / ' + esc(celestial.sunsetStr || '--:--') + '</span>' +
              '<span class="hud-detail-item-sub">Solar Noon: ' + esc(celestial.noonStr || '--:--') + '</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Moonrise / Moonset</span>' +
              '<span class="hud-detail-item-val">' + esc(celestial.moonriseStr || '--:--') + ' / ' + esc(celestial.moonsetStr || '--:--') + '</span>' +
              '<span class="hud-detail-item-sub">Bundled SunCalc 2.0 Engine</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Moon Phase & Illumination</span>' +
              '<span class="hud-detail-item-val">' + esc(cPhase.glyph) + ' ' + esc(cPhase.name) + '</span>' +
              '<span class="hud-detail-item-sub">' + esc(celestial.illumPct || '--%') + ' illuminated (' + (celestial.isWaxing ? 'Waxing' : 'Waning') + ')</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Lunar Cycle Age</span>' +
              '<span class="hud-detail-item-val">' + esc(celestial.lunarAge || '14.8') + ' days</span>' +
              '<span class="hud-detail-item-sub">29.53d synodic lunar month</span>' +
            '</div>' +
            '<div class="hud-detail-item full-width">' +
              '<span class="hud-detail-item-label">Traditional Western Full Moon</span>' +
              '<span class="hud-detail-item-val">' + esc(celestial.westernFullMoonName || 'Full Moon') + '</span>' +
              '<span class="hud-detail-item-sub">Universal Western Almanac designation</span>' +
            '</div>' +
            '<div class="hud-detail-item full-width">' +
              '<span class="hud-detail-item-label">Vedic Purnima Observance</span>' +
              '<span class="hud-detail-item-val">' + esc(celestial.vedicPurnimaName || 'Purnima') + '</span>' +
              '<span class="hud-detail-item-sub">Tradition: Hindu / Vedic Lunar Calendar</span>' +
            '</div>' +
            '<div class="hud-detail-item full-width">' +
              '<span class="hud-detail-item-label">Active Meteor Shower</span>' +
              '<span class="hud-detail-item-val">' + esc(showerTxt) + '</span>' +
              '<span class="hud-detail-item-sub">Annual astronomical transit schedule</span>' +
            '</div>' +
          '</div>';
          break;

        case 'media':
          if (iconEl) iconEl.textContent = '🎵';
          if (titleEl) titleEl.textContent = 'Media & Audio Subsystem';

          var track = (this.mediaVisualizer && this.mediaVisualizer.currentTrackData) || {};
          var trackTitle = track.title || 'No active media session';
          var trackArtist = track.artist || 'Windows SMTC Idle';
          var trackSrc = track.source || 'SMTC';
          var visEnabled = (this.mediaVisualizer && this.mediaVisualizer.enabled) ? 'Active (32 FFT frequency bands)' : 'Disabled';

          html = '<div class="hud-detail-grid">' +
            '<div class="hud-detail-item full-width">' +
              '<span class="hud-detail-item-label">Active Track</span>' +
              '<span class="hud-detail-item-val">' + esc(trackTitle) + '</span>' +
              '<span class="hud-detail-item-sub">Artist: ' + esc(trackArtist) + '</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Source Application</span>' +
              '<span class="hud-detail-item-val">' + esc(trackSrc) + '</span>' +
              '<span class="hud-detail-item-sub">SMTC Session</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Audio Spectrum Visualizer</span>' +
              '<span class="hud-detail-item-val">' + esc(visEnabled) + '</span>' +
              '<span class="hud-detail-item-sub">Zero-allocation TypedArray buffer</span>' +
            '</div>' +
            '<div class="hud-detail-item full-width">' +
              '<span class="hud-detail-item-label">Host Integration Note</span>' +
              '<span class="hud-detail-item-val">Windows SMTC Bridge</span>' +
              '<span class="hud-detail-item-sub">Lively Wallpaper forwards Title/Artist/Art. Dedicated app icons (e.g. Amazon Music) require host-side AppUserModelId (AUMID) forwarding.</span>' +
            '</div>' +
          '</div>';
          break;

        case 'pomodoro':
          if (iconEl) iconEl.textContent = '⏱️';
          if (titleEl) titleEl.textContent = 'Pomodoro Productivity Timer';

          var pomo = this.pomodoro || {};
          var pomoModeName = (pomo.mode === 'focus') ? 'Focus Session' : ((pomo.mode === 'break') ? 'Short Break' : 'Long Break');
          var pomoRem = this.dom.pomodoroTime ? this.dom.pomodoroTime.textContent : '25:00';
          var pomoStatus = pomo.isRunning ? 'Running (Active Cadence)' : 'Paused / Idle';

          html = '<div class="hud-detail-grid">' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Current Mode</span>' +
              '<span class="hud-detail-item-val">' + esc(pomoModeName) + '</span>' +
              '<span class="hud-detail-item-sub">' + esc(pomoStatus) + '</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Remaining Time</span>' +
              '<span class="hud-detail-item-val">' + esc(pomoRem) + '</span>' +
              '<span class="hud-detail-item-sub">Hardware-throttled ticker</span>' +
            '</div>' +
            '<div class="hud-detail-item full-width">' +
              '<span class="hud-detail-item-label">Interval Configuration</span>' +
              '<span class="hud-detail-item-val">Focus: ' + (pomo.focusMinutes || 25) + 'm | Break: ' + (pomo.breakMinutes || 5) + 'm | Long: ' + (pomo.longBreakMinutes || 15) + 'm</span>' +
              '<span class="hud-detail-item-sub">Completed focus sessions: ' + (pomo.completedFocusSessions || 0) + '</span>' +
            '</div>' +
            '<div class="hud-detail-item full-width">' +
              '<span class="hud-detail-item-label">Keyboard Controls</span>' +
              '<span class="hud-detail-item-val">Press <kbd>P</kbd> to start or pause focus timer</span>' +
              '<span class="hud-detail-item-sub">Zero CPU consumption when parked</span>' +
            '</div>' +
          '</div>';
          break;

        default:
          if (iconEl) iconEl.textContent = '📊';
          if (titleEl) titleEl.textContent = 'Telemetry Details';
          html = '<div class="hud-detail-item full-width"><span class="hud-detail-item-val">No telemetry details available for this card.</span></div>';
          break;
      }

      // Content signature: skip DOM replacement when the drawer markup is
      // unchanged — repeated refreshes add no nodes and cannot drop focus (LW01)
      var sigHash = 5381;
      for (var si = 0; si < html.length; si++) {
        sigHash = ((sigHash << 5) + sigHash + html.charCodeAt(si)) | 0;
      }
      var contentSig = cardType + ':' + html.length + ':' + sigHash;
      if (this._detailContentSig === contentSig) {
        return;
      }
      this._detailContentSig = contentSig;

      // Capture focus state inside the drawer before replacement (LW01)
      var restoreFocusKey = null;
      var activeEl = (typeof document !== 'undefined' && document.activeElement) ? document.activeElement : null;
      if (activeEl && bodyEl && typeof bodyEl.contains === 'function' && bodyEl.contains(activeEl)) {
        var focusIdxAttr = (typeof activeEl.getAttribute === 'function') ? activeEl.getAttribute('data-news-index') : null;
        if (focusIdxAttr != null) {
          restoreFocusKey = focusIdxAttr;
        } else if (bodyEl.querySelectorAll && typeof activeEl.classList === 'object' && activeEl.classList && activeEl.classList.contains &&
                   activeEl.classList.contains('hud-detail-news-item')) {
          var focusLinks = bodyEl.querySelectorAll('.hud-detail-news-item');
          for (var fi = 0; fi < focusLinks.length; fi++) {
            if (focusLinks[fi] === activeEl) { restoreFocusKey = String(fi); break; }
          }
        }
      }

      bodyEl.innerHTML = html;

      // Restore focus to the corresponding replacement link without scrolling;
      // if the story disappeared, fall back to the drawer's close control —
      // never the page background (LW01)
      if (restoreFocusKey != null) {
        var focusTarget = null;
        if (bodyEl.querySelector) {
          try { focusTarget = bodyEl.querySelector('.hud-detail-news-item[data-news-index="' + restoreFocusKey + '"]'); } catch (e) {}
        }
        if (!focusTarget && bodyEl.querySelectorAll) {
          var newLinks = bodyEl.querySelectorAll('.hud-detail-news-item');
          var fk = parseInt(restoreFocusKey, 10);
          if (!isNaN(fk) && fk >= 0 && fk < newLinks.length) focusTarget = newLinks[fk];
        }
        if (!focusTarget) focusTarget = this.dom.hudDetailClose;
        if (focusTarget && typeof focusTarget.focus === 'function') {
          try {
            focusTarget.focus({ preventScroll: true });
          } catch (e) {
            try { focusTarget.focus(); } catch (e2) {}
          }
        }
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

      // Paint a validated stale snapshot BEFORE awaiting the network so the HUD
      // boots into real cached data instead of placeholders (LW12). Rendering
      // it does not rewrite its timestamp or extend freshness; a successful
      // current-generation refresh replaces it below.
      if (!this.state && global.CacheManager && typeof global.CacheManager.getAny === 'function') {
        try {
          var staleSnap = global.CacheManager.getAny();
          if (staleSnap && staleSnap.weather && staleSnap.location) {
            var curWProv = (global.ApiService && global.ApiService.weatherProvider) || 'open-meteo';
            var curAProv = (global.ApiService && global.ApiService.aqiProvider) || 'open-meteo';
            var staleCtxOk = (!staleSnap.weatherProvider || staleSnap.weatherProvider === curWProv) &&
                             (!staleSnap.aqiProvider || staleSnap.aqiProvider === curAProv);
            if (staleCtxOk) {
              // Persisted stories paint at boot even when the atmosphere
              // snapshot predates them (v0.8.15): the news snapshot is the
              // durable store, so the card starts with last-known stories
              // instead of an empty state while the network revalidates.
              if ((!staleSnap.news || staleSnap.news.length === 0) &&
                  global.ApiService && typeof global.ApiService.getCachedNews === 'function') {
                var bootNews = global.ApiService.getCachedNews();
                if (bootNews && Array.isArray(bootNews.data) && bootNews.data.length > 0) {
                  staleSnap.news = bootNews.data.map(function(a) {
                    return Object.assign({}, a, { isStale: true });
                  });
                }
              }
              staleSnap.fromCache = true;
              staleSnap.isStalePaint = true;
              this.state = staleSnap;
              if (this.isPlaybackPaused) {
                this.pendingSnapshot = staleSnap;
              } else {
                this.renderAll(staleSnap);
              }
              console.log('[App] Painted validated stale snapshot before network revalidation');
            }
          }
        } catch (staleErr) {
          // Missing or corrupt cache falls through to the existing empty state
          console.warn('[App] Stale snapshot paint skipped:', staleErr && staleErr.message);
        }
      }

      var finishSync = function() {
        self.isSyncing = false;
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

    fetchNews: function() {
      var self = this;
      if (!global.ApiService || typeof global.ApiService.fetchNews !== 'function') return Promise.resolve([]);
      var loc = (this.state && this.state.location) || (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.defaultLocation) || {};
      var city = loc.city || 'Local Area';
      // Unknown country stays unknown (v0.8.15) — no invented 'US' on the news path.
      var country = loc.countryCode || '';
      // No force concept: news network eligibility is owned by the ApiService
      // quota firewall and can never be bypassed from the UI (LW06/CORR-3)
      return global.ApiService.fetchNews(city, country)
        .then(function(articles) {
          if (self.showDiagnostics) self.updateNewsDiagnostics();
          if (articles && articles.length > 0) {
            self.newsItems = articles;
            if (self.state) {
              self.state.news = articles;
            }
            if (!self.isPlaybackPaused) {
              self.renderNews(articles);
            }
            return articles;
          }
          // Empty network result: never blank a card that has a persisted
          // story snapshot — render the last-known stories as marked-stale
          // (v0.8.15) instead of letting an empty array wipe the card.
          var cached = (typeof global.ApiService.getCachedNews === 'function') ? global.ApiService.getCachedNews() : null;
          if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
            var stale = cached.data.map(function(a) {
              return Object.assign({}, a, { isStale: true });
            });
            self.newsItems = stale;
            if (self.state) {
              self.state.news = stale;
            }
            if (!self.isPlaybackPaused) {
              self.renderNews(stale);
            }
            return stale;
          }
          return articles;
        })
        .catch(function(err) {
          console.warn('[App] fetchNews failed:', err);
          return [];
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

      // Keep an open detail drawer fresh on snapshot refresh (A-F4);
      // preserve reader scroll position and surface failures per file convention (CORR-3)
      if (this.isDetailOpen && this.activeDetailCard) {
        var detailBodyEl = this.dom.hudDetailBody;
        var detailScrollTop = detailBodyEl ? detailBodyEl.scrollTop : 0;
        try {
          this.renderCardDetailContent(this.activeDetailCard);
        } catch (e) {
          console.warn('[App] Detail refresh failed:', e && e.message);
        }
        if (detailBodyEl) detailBodyEl.scrollTop = detailScrollTop;
      }
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
      var rawC = Number.isFinite(w.tempC) ? w.tempC : (Number.isFinite(w.temp) ? w.temp : null);
      var rawF = Number.isFinite(w.tempF) ? w.tempF : (rawC != null ? ((rawC * 9 / 5) + 32) : null);
      var temp = isF
        ? (Number.isFinite(rawF) ? Math.round(rawF) : '--')
        : (Number.isFinite(rawC) ? Math.round(rawC) : '--');
      var rawAppC = Number.isFinite(w.apparentC) ? w.apparentC : (Number.isFinite(w.feelsLike) ? w.feelsLike : rawC);
      var rawAppF = Number.isFinite(w.apparentF) ? w.apparentF : (rawAppC != null ? ((rawAppC * 9 / 5) + 32) : null);
      var apparent = isF
        ? (Number.isFinite(rawAppF) ? Math.round(rawAppF) : '--')
        : (Number.isFinite(rawAppC) ? Math.round(rawAppC) : '--');
      var high = isF
        ? (Number.isFinite(w.tempMaxF) ? Math.round(w.tempMaxF) : (Number.isFinite(w.high) ? Math.round(w.high) : '--'))
        : (Number.isFinite(w.tempMaxC) ? Math.round(w.tempMaxC) : (Number.isFinite(w.high) ? Math.round(w.high) : '--'));
      var low = isF
        ? (Number.isFinite(w.tempMinF) ? Math.round(w.tempMinF) : (Number.isFinite(w.low) ? Math.round(w.low) : '--'))
        : (Number.isFinite(w.tempMinC) ? Math.round(w.tempMinC) : (Number.isFinite(w.low) ? Math.round(w.low) : '--'));

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

      if (this.dom.hudWeatherCard) {
        var wUnit = isF ? '°F' : '°C';
        this.dom.hudWeatherCard.title = (w.conditionText || 'Weather') + ' • ' + temp + wUnit +
          ' (Feels like ' + apparent + '°) • High ' + high + '° / Low ' + low + '° (Click to inspect atmosphere)';
      }
      if (this.dom.hudMetricsRow) {
        var hStr = Number.isFinite(w.humidity) ? (Math.round(w.humidity) + '%') : '--';
        var wStr = isF
          ? (Number.isFinite(w.windSpeedMph) ? (w.windSpeedMph + ' mph') : '--')
          : (Number.isFinite(w.windSpeedKm) ? (w.windSpeedKm + ' km/h') : '--');
        var pStr = Number.isFinite(w.precipitationMm) ? ((w.precipitationMm || 0.0).toFixed(1) + ' mm') : '--';
        this.dom.hudMetricsRow.title = 'Humidity: ' + hStr + ' | Wind: ' + wStr + ' | Precip: ' + pStr + ' (Click to inspect metrics)';
      }
    },

    renderAqi: function(aqi) {
      if (!aqi) return;

      var aqiVal = (aqi.europeanAqi != null && Number.isFinite(aqi.europeanAqi))
        ? aqi.europeanAqi
        : ((aqi.value != null && Number.isFinite(aqi.value)) ? aqi.value : null);
      var isAvailable = aqi.available !== false && aqiVal != null;
      var unit = aqi.pollutantUnit || 'µg/m³';

      if (this.dom.hudAqiBadge) {
        this.dom.hudAqiBadge.style.background = isAvailable ? (aqi.color || '#10b981') : '#64748b';
      }
      if (this.dom.hudAqiCategory) {
        this.dom.hudAqiCategory.textContent = isAvailable
          ? ((aqi.category || 'Good') + ' (' + aqiVal + ')')
          : (aqi.category || 'Unavailable');
      }
      if (this.dom.hudAqiFill) {
        // European AQI 0 to 100 mapped to %
        var pct = isAvailable ? Math.min(100, Math.max(5, (aqiVal / 80) * 100)) : 0;
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
      if (this.dom.hudAqiCard) {
        var pm25Txt = (aqi.pm2_5 != null ? aqi.pm2_5 : (aqi.pm25 != null ? aqi.pm25 : '--'));
        var pm10Txt = (aqi.pm10 != null ? aqi.pm10 : '--');
        this.dom.hudAqiCard.title = isAvailable
          ? ('Air Quality: ' + (aqi.category || 'Good') + ' (AQI ' + aqiVal + ') | PM2.5: ' + pm25Txt + ' ' + unit + ' | PM10: ' + pm10Txt + ' ' + unit + ' (Click to inspect AQI)')
          : 'Air Quality: Unavailable (Click to inspect AQI)';
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

    /**
     * Computes a relative article age AT DISPLAY TIME from the normalized
     * `publishedMs` (LW15) — no frozen persisted timeAgo strings. Returns ''
     * when the publish instant is unknown so callers can use their fallback.
     * Stale-marked cache hits report 'Cached'.
     * @param {Object} item News article
     * @param {number} [nowMs]
     * @returns {string}
     */
    formatNewsAge: function(item, nowMs) {
      if (!item) return '';
      if (item.stale) return 'Cached';
      if (typeof item.publishedMs !== 'number' || !Number.isFinite(item.publishedMs)) {
        return item.timeAgo || '';
      }
      var ageMs = (nowMs || Date.now()) - item.publishedMs;
      if (ageMs < 0) ageMs = 0; // tolerate small clock skew: "Just now"
      var mins = Math.floor(ageMs / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return mins + 'm ago';
      var hours = Math.floor(mins / 60);
      if (hours < 24) return hours + 'h ago';
      var days = Math.floor(hours / 24);
      return days + 'd ago';
    },

    /**
     * Paints a telemetry bar fill via compositable scaleX instead of animated
     * width (LW17). The element keeps a fixed full width; transform-origin is
     * left. Legacy inline widths are cleared.
     * @param {Element} el Fill element
     * @param {number} pct 0-100 (clamped)
     */
    setBarFill: function(el, pct) {
      if (!el || !el.style) return;
      var frac = (typeof pct === 'number' && Number.isFinite(pct)) ? (pct / 100) : 0;
      if (frac < 0) frac = 0;
      else if (frac > 1) frac = 1;
      if (el.style.width) el.style.width = '';
      el.style.transform = 'scaleX(' + frac + ')';
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
            self.showBatteryUnavailableMode();
          });
        } catch (e) {
          self.hasPhysicalBattery = false;
          self.showBatteryUnavailableMode();
        }
      } else {
        self.hasPhysicalBattery = false;
        self.showBatteryUnavailableMode();
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
        // v0.8.18: the dummy signature is not proof of "no battery" — Windows
        // laptops on AC can report exactly this when charge times are unknown.
        // Show the row in an honest AC state instead of vanishing (no invented
        // numbers); real events upgrade it to live telemetry when they fire.
        this.showBatteryAcMode();
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

    /**
     * Honest AC-mode battery row (v0.8.18): shown when the host exposes only
     * the "no usable battery data" dummy. Never invents a percentage — the
     * row states AC Power with an unavailable level until a real battery
     * event corroborates live telemetry.
     */
    showBatteryAcMode: function() {
      if (!this.showBatteryInfo) {
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
      if (this.dom.hwBatteryVal) this.dom.hwBatteryVal.textContent = '--%';
      if (this.dom.hwBatteryStatus) this.dom.hwBatteryStatus.textContent = 'AC Power';
      if (this.dom.hwBatteryIcon) {
        this.dom.hwBatteryIcon.textContent = '⚡';
        this.dom.hwBatteryIcon.className = 'hw-battery-badge is-charging';
      }
      if (this.dom.hwBatteryBar) {
        this.setBarFill(this.dom.hwBatteryBar, 0);
        this.dom.hwBatteryBar.className = 'hw-bar-fill hw-battery-fill';
      }
    },

    /**
     * Honest "host does not expose battery data" row (v0.8.20): shown when
     * navigator.getBattery is missing or fails (common in hosted WebView2).
     * The user asked for the BAT row to always be visible — it is, with no
     * invented numbers.
     */
    showBatteryUnavailableMode: function() {
      if (!this.showBatteryInfo) {
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
      if (this.dom.hwBatteryVal) this.dom.hwBatteryVal.textContent = '--%';
      if (this.dom.hwBatteryStatus) this.dom.hwBatteryStatus.textContent = 'Not available';
      if (this.dom.hwBatteryIcon) {
        this.dom.hwBatteryIcon.textContent = '—';
        this.dom.hwBatteryIcon.className = 'hw-battery-badge';
      }
      if (this.dom.hwBatteryBar) {
        this.setBarFill(this.dom.hwBatteryBar, 0);
        this.dom.hwBatteryBar.className = 'hw-bar-fill hw-battery-fill';
      }
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
        this.setBarFill(this.dom.hwBatteryBar, pct);
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

    handleSystemInfo: function(data) {
      if (!data || this.isPlaybackPaused || !this.showHardwareMonitor) return;
      var setDomText = (typeof this.setDomText === 'function') ? this.setDomText.bind(this)
        : (typeof App !== 'undefined' && typeof App.setDomText === 'function') ? App.setDomText.bind(App)
        : function(n, t) { if (n && n.textContent !== t) n.textContent = t; };
      // Bar fills tolerate detached/mock receivers the same way setDomText does
      var setBar = (typeof this.setBarFill === 'function') ? this.setBarFill.bind(this)
        : function(el, pct) {
            if (!el || !el.style) return;
            var p = (typeof pct === 'number' && Number.isFinite(pct)) ? pct : 0;
            var frac = p / 100;
            if (frac < 0) frac = 0; else if (frac > 1) frac = 1;
            el.style.width = '';
            el.style.transform = 'scaleX(' + frac + ')';
          };

      this.lastHwUpdate = Date.now();
      this.lastHwData = data;

      // CPU load and name
      var cpuVal = (typeof data.CurrentCpu === 'number' && Number.isFinite(data.CurrentCpu)) ? Math.round(data.CurrentCpu) : 0;
      cpuVal = Math.max(0, Math.min(100, cpuVal));
      var cpuName = (typeof data.NameCpu === 'string' && data.NameCpu.trim()) ? data.NameCpu.trim() : 'Processor';
      this.pushHwHistory(this.hwCpuHistory, cpuVal);

      if (this.dom.hwCpuVal) setDomText(this.dom.hwCpuVal, cpuVal + '%');
      setBar(this.dom.hwCpuBar, cpuVal);
      if (this.sparklineEngine) this.sparklineEngine.render('cpu', this.hwCpuHistory);
      if (this.dom.hwCpuName) setDomText(this.dom.hwCpuName, cpuName);

      // GPU 3D load and name
      var gpuVal = (typeof data.CurrentGpu3D === 'number' && Number.isFinite(data.CurrentGpu3D)) ? Math.round(data.CurrentGpu3D) : 0;
      gpuVal = Math.max(0, Math.min(100, gpuVal));
      var gpuName = (typeof data.NameGpu === 'string' && data.NameGpu.trim()) ? data.NameGpu.trim() : 'Graphics 3D';
      this.pushHwHistory(this.hwGpuHistory, gpuVal);

      if (this.dom.hwGpuVal) setDomText(this.dom.hwGpuVal, gpuVal + '%');
      setBar(this.dom.hwGpuBar, gpuVal);
      if (this.sparklineEngine) this.sparklineEngine.render('gpu', this.hwGpuHistory);
      if (this.dom.hwGpuName) setDomText(this.dom.hwGpuName, gpuName);

      // RAM usage
      var totalRamMb = (typeof data.TotalRam === 'number' && Number.isFinite(data.TotalRam) && data.TotalRam > 0) ? data.TotalRam : 0;
      var freeRamMb = (typeof data.CurrentRamAvail === 'number' && Number.isFinite(data.CurrentRamAvail) && data.CurrentRamAvail >= 0) ? data.CurrentRamAvail : 0;
      var usedRamMb = totalRamMb > freeRamMb ? (totalRamMb - freeRamMb) : 0;
      var ramPct = totalRamMb > 0 ? Math.round((usedRamMb / totalRamMb) * 100) : 0;
      ramPct = Number.isFinite(ramPct) ? Math.max(0, Math.min(100, ramPct)) : 0;
      var usedGb = (usedRamMb / 1024).toFixed(1);
      var totalGb = (totalRamMb / 1024).toFixed(1);

      this.pushHwHistory(this.hwRamHistory, ramPct);
      if (this.dom.hwRamVal) setDomText(this.dom.hwRamVal, ramPct + '%');
      setBar(this.dom.hwRamBar, ramPct);
      if (this.sparklineEngine) this.sparklineEngine.render('ram', this.hwRamHistory);
      if (this.dom.hwRamDetail) {
        setDomText(this.dom.hwRamDetail, totalRamMb > 0 ? (usedGb + ' / ' + totalGb + ' GB') : 'Physical RAM');
      }

      // Disk / Storage
      var diskVal = (typeof data.CurrentDisk === 'number' && Number.isFinite(data.CurrentDisk)) ? Math.round(data.CurrentDisk) : null;
      if (diskVal === null && typeof data.DiskUsage === 'number' && Number.isFinite(data.DiskUsage)) {
        diskVal = Math.round(data.DiskUsage);
      }
      if (diskVal !== null) {
        diskVal = Math.max(0, Math.min(100, diskVal));
        this.pushHwHistory(this.hwDiskHistory, diskVal);
        if (this.dom.hwDiskVal) setDomText(this.dom.hwDiskVal, diskVal + '%');
        setBar(this.dom.hwDiskBar, diskVal);
        if (this.sparklineEngine) this.sparklineEngine.render('disk', this.hwDiskHistory);
        if (this.dom.hwDiskDetail) setDomText(this.dom.hwDiskDetail, 'Drive C:');
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

        if (this.dom.hwNetDownVal) setDomText(this.dom.hwNetDownVal, this.formatNetworkBandwidth(downKbps));
        var downPct = downKbps <= 0 ? 0 : Math.min(100, Math.max(2, Math.round((downKbps / 50000) * 100)));
        setBar(this.dom.hwNetDownBar, downPct);
        if (this.sparklineEngine) this.sparklineEngine.render('netDown', this.hwNetDownHistory);
      }

      if (rawUp !== null) {
        var upKbps = (data.NameNetCard || rawUp > 1000000) ? Math.round((rawUp * 8) / 1000) : rawUp;
        upKbps = Math.max(0, upKbps);
        this.pushHwHistory(this.hwNetUpHistory, upKbps);

        if (this.dom.hwNetUpVal) setDomText(this.dom.hwNetUpVal, this.formatNetworkBandwidth(upKbps));
        var upPct = upKbps <= 0 ? 0 : Math.min(100, Math.max(2, Math.round((upKbps / 15000) * 100)));
        setBar(this.dom.hwNetUpBar, upPct);
        if (this.sparklineEngine) this.sparklineEngine.render('netUp', this.hwNetUpHistory);
      }

      var netCard = (typeof data.NameNetCard === 'string' && data.NameNetCard.trim()) ? data.NameNetCard.trim() : null;
      if (netCard) {
        if (this.dom.hwNetDownName) setDomText(this.dom.hwNetDownName, netCard);
        if (this.dom.hwNetUpName) setDomText(this.dom.hwNetUpName, netCard);
      }

      // Laptop Battery Telemetry from Lively host
      var batteryPct = typeof data.BatteryPercent === 'number' ? data.BatteryPercent :
                       (typeof data.BatteryLevel === 'number' ? (data.BatteryLevel <= 1.0 ? Math.round(data.BatteryLevel * 100) : Math.round(data.BatteryLevel)) : null);
      var hasNoBatteryStatus = (typeof data.BatteryStatus === 'string' && /^(no battery|nobattery|notpresent|none|unknown)$/i.test(data.BatteryStatus.trim())) || data.HasBattery === false;
      if (hasNoBatteryStatus) {
        this.hasPhysicalBattery = false;
        this.hideBatteryRow();
      } else if (batteryPct !== null && batteryPct >= 0 && batteryPct <= 100) {
        var isCharging = data.BatteryStatus === 'Charging' || data.BatteryStatus === 1 || data.BatteryCharging === true;
        var statusStr = (typeof data.BatteryStatus === 'string' && data.BatteryStatus.trim()) ? data.BatteryStatus.trim() : (isCharging ? '⚡ Charging' : 'On Battery');
        this.syncBatteryState({
          level: batteryPct / 100,
          charging: isCharging,
          statusText: statusStr
        });
      }

      // Switch badge to Live
      if (this.dom.hudHwBadge) {
        setDomText(this.dom.hudHwBadge, 'Live');
        this.dom.hudHwBadge.className = 'hud-hw-badge is-live';
      }

      if (this.dom.hudHwBlock) {
        this.dom.hudHwBlock.title = 'Hardware: CPU ' + cpuVal + '% | GPU ' + gpuVal + '% | RAM ' + ramPct + '%' + (diskVal !== null ? ' | Disk ' + diskVal + '%' : '') + ' (Click to inspect hardware metrics)';
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
            if (self.dom.hwDiskVal) self.setDomText(self.dom.hwDiskVal, pct + '%');
            self.setBarFill(self.dom.hwDiskBar, pct);
            if (self.sparklineEngine) self.sparklineEngine.render('disk', self.hwDiskHistory);
            if (self.dom.hwDiskDetail) self.setDomText(self.dom.hwDiskDetail, usedGb + ' / ' + quotaGb + ' GB');
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
      if (this.dom.hwDiskVal) this.setDomText(this.dom.hwDiskVal, pct + '%');
      this.setBarFill(this.dom.hwDiskBar, pct);
      if (this.sparklineEngine) this.sparklineEngine.render('disk', this.hwDiskHistory);
      if (this.dom.hwDiskDetail) this.setDomText(this.dom.hwDiskDetail, 'System NVMe');
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

      if (this.dom.hwCpuVal) this.setDomText(this.dom.hwCpuVal, this.simulatedCpuLoad + '%');
      this.setBarFill(this.dom.hwCpuBar, this.simulatedCpuLoad);
      if (this.dom.hwCpuName) this.setDomText(this.dom.hwCpuName, 'Processor');

      if (this.dom.hwGpuVal) this.setDomText(this.dom.hwGpuVal, this.simulatedGpuLoad + '%');
      this.setBarFill(this.dom.hwGpuBar, this.simulatedGpuLoad);
      if (this.dom.hwGpuName) this.setDomText(this.dom.hwGpuName, 'Graphics 3D');

      if (this.dom.hwRamVal) this.setDomText(this.dom.hwRamVal, ramPct + '%');
      this.setBarFill(this.dom.hwRamBar, ramPct);
      if (this.dom.hwRamDetail) {
        this.setDomText(this.dom.hwRamDetail, this.simulatedRamUsed + ' / ' + this.simulatedRamTotal + ' GB');
      }

      if (this.dom.hwDiskVal) this.setDomText(this.dom.hwDiskVal, this.simulatedDiskPct + '%');
      this.setBarFill(this.dom.hwDiskBar, this.simulatedDiskPct);
      if (this.dom.hwDiskDetail) this.setDomText(this.dom.hwDiskDetail, 'Drive C:');

      // Network Down & Up DOM Updates
      var netDownFormatted = this.formatNetworkBandwidth(this.simulatedNetDown);
      var netUpFormatted = this.formatNetworkBandwidth(this.simulatedNetUp);
      if (this.dom.hwNetDownVal) this.setDomText(this.dom.hwNetDownVal, netDownFormatted);
      if (this.dom.hwNetUpVal) this.setDomText(this.dom.hwNetUpVal, netUpFormatted);
      if (this.dom.hwNetDownName) this.setDomText(this.dom.hwNetDownName, 'Download');
      if (this.dom.hwNetUpName) this.setDomText(this.dom.hwNetUpName, 'Upload');

      var downPct = this.simulatedNetDown <= 0 ? 0 : Math.min(100, Math.max(2, Math.round((this.simulatedNetDown / 50000) * 100)));
      this.setBarFill(this.dom.hwNetDownBar, downPct);
      var upPct = this.simulatedNetUp <= 0 ? 0 : Math.min(100, Math.max(2, Math.round((this.simulatedNetUp / 15000) * 100)));
      this.setBarFill(this.dom.hwNetUpBar, upPct);

      // Hardware-Accelerated Vector SVG Sparkline Renders
      if (this.sparklineEngine) {
        this.sparklineEngine.render('cpu', this.hwCpuHistory);
        this.sparklineEngine.render('gpu', this.hwGpuHistory);
        this.sparklineEngine.render('ram', this.hwRamHistory);
        this.sparklineEngine.render('disk', this.hwDiskHistory);
        this.sparklineEngine.render('netDown', this.hwNetDownHistory);
        this.sparklineEngine.render('netUp', this.hwNetUpHistory);
      }

      if (this.dom.hudHwBadge) {
        this.setDomText(this.dom.hudHwBadge, 'Standby');
        this.dom.hudHwBadge.className = 'hud-hw-badge is-standby';
      }
    },

    renderNews: function(items) {
      this.clearNewsTimers();

      // Real articles only — the empty/unavailable state renders explicitly
      // below; no synthetic fallback headlines (LW05)
      if (Array.isArray(items) && items.length > 0) {
        this.newsItems = items;
      }

      if (!this.newsItems || this.newsItems.length === 0) {
        if (this.dom.hudNewsHeadline) {
          this.dom.hudNewsHeadline.textContent = 'No stories right now — new stories arrive automatically';
        }
        if (this.dom.hudNewsDots) {
          this.dom.hudNewsDots.style.display = 'none';
        }
        this.applyStoryBackground(null);
        return;
      }

      this.currentNewsIdx = 0;
      this.displayNewsItem(0);
      this.attachNewsDotListeners();

      // Start rotation cycle if not paused
      var rotSec = (global.LOCAL_WALLY_CONFIG && typeof global.LOCAL_WALLY_CONFIG.newsRotateIntervalSeconds === 'number')
        ? Math.max(3, global.LOCAL_WALLY_CONFIG.newsRotateIntervalSeconds)
        : 7;
      if (!this.isPlaybackPaused && this.showNewsFeed && this.newsItems && this.newsItems.length > 1) {
        this.newsTimer = setInterval(this.rotateNews.bind(this), rotSec * 1000);
      }
    },

    /**
     * Story background decoration (v0.8.12): provider image when present,
     * else a cached keyword image, else — within a strict hourly budget — a
     * topical stock image searched from the headline keywords via the user's
     * own Pixabay/Unsplash key. Purely decorative: never invents news data,
     * and a missing key or exhausted budget simply leaves the plain card.
     */
    _decorateStoryBackground: function(item) {
      var self = this;
      var direct = (item && typeof item.image === 'string' && /^https:\/\//i.test(item.image)) ? item.image : null;
      if (direct) {
        this.applyStoryBackground(direct);
        return;
      }
      var cached = this._readNewsImageCache(item.title);
      if (cached) {
        this.applyStoryBackground(cached);
        return;
      }
      this.applyStoryBackground(null);
      // No usable key => no request AND no budget slot consumed (v0.8.14).
      var hasKey = (String((global.ApiService && global.ApiService.pixabayApiKey) || '').trim().length > 0) ||
                   (String((global.ApiService && global.ApiService.unsplashApiKey) || '').trim().length > 0);
      if (!hasKey) return;
      var keywords = this._newsImageKeywords(item.title);
      if (!keywords) return;
      var gen = this._newsImgGeneration = (this._newsImgGeneration || 0) + 1;
      var storyId = item.id;
      var storyTitle = item.title;
      this._fetchKeywordImage(keywords, function(url) {
        // Park / newer decoration invalidates late completion (single call).
        if (gen !== self._newsImgGeneration) return;
        if (!url) return;
        self._writeNewsImageCache(storyTitle, url);
        if (self.newsItems && self.newsItems.length) {
          var current = self.newsItems[self.currentNewsIdx % self.newsItems.length];
          if (current && current.id === storyId) {
            self.applyStoryBackground(url);
          }
        }
      });
    },

    /**
     * Headline → 3 significant keywords (stopwords stripped). Returns '' when
     * nothing usable remains, in which case no search is made.
     */
    _newsImageKeywords: function(title) {
      if (!title || typeof title !== 'string') return '';
      var stop = { a: 1, an: 1, the: 1, of: 1, in: 1, on: 1, at: 1, to: 1, for: 1, and: 1,
        or: 1, is: 1, are: 1, was: 1, were: 1, with: 1, from: 1, by: 1, as: 1, its: 1,
        it: 1, this: 1, that: 1, after: 1, before: 1, over: 1, under: 1, new: 1, says: 1,
        say: 1, will: 1, has: 1, have: 1, had: 1, not: 1, but: 1, how: 1, why: 1, what: 1,
        who: 1, his: 1, her: 1, their: 1, out: 1, up: 1, down: 1, into: 1, amid: 1 };
      var words = String(title).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
      var picked = [];
      for (var i = 0; i < words.length && picked.length < 3; i++) {
        var w = words[i];
        if (w.length >= 4 && !stop[w]) picked.push(w);
      }
      return picked.join(' ');
    },

    _newsImageBudgetOk: function() {
      // Persisted rolling-hour budget (v0.8.14): the advertised six
      // searches/hour hold across reloads — and across views only insofar as
      // the storage bucket is shared (documented; host verification pending).
      // Durable state is REQUIRED: if the budget cannot be read or written,
      // optional image searches fail closed (decoration only — the card just
      // stays plain).
      try {
        if (typeof global.localStorage === 'undefined' || !global.localStorage) return false;
        var now = Date.now();
        var state = null;
        var raw = global.localStorage.getItem('LIVELY_HUD_NEWS_IMG_BUDGET');
        if (raw) {
          try {
            var parsed = JSON.parse(raw);
            if (parsed && typeof parsed.windowStart === 'number' && typeof parsed.count === 'number' &&
                isFinite(parsed.windowStart) && isFinite(parsed.count) && parsed.count >= 0) {
              state = parsed;
            }
          } catch (e) { state = null; }
        }
        if (!state || (now - state.windowStart) > 60 * 60 * 1000 || state.windowStart > now) {
          state = { windowStart: now, count: 0 };
        }
        if (state.count >= 6) return false;
        state.count++;
        global.localStorage.setItem('LIVELY_HUD_NEWS_IMG_BUDGET', JSON.stringify(state));
        return true;
      } catch (e) {
        return false; // fail closed for optional decoration
      }
    },

    _readNewsImageCache: function(title) {
      try {
        var raw = global.localStorage && global.localStorage.getItem('LIVELY_HUD_NEWS_IMG_CACHE');
        if (!raw) return null;
        var list = JSON.parse(raw);
        if (!Array.isArray(list)) return null;
        var key = String(title || '').trim().toLowerCase().slice(0, 80);
        for (var i = list.length - 1; i >= 0; i--) {
          if (list[i] && list[i].k === key && typeof list[i].v === 'string' && /^https:\/\//i.test(list[i].v)) {
            return list[i].v;
          }
        }
      } catch (e) {}
      return null;
    },

    /**
     * 48-hour artifact retention (v0.8.18, user request): downloaded-artifact
     * CACHES are swept on boot and daily so nothing keeps growing. Kinds:
     *  - keyword-image cache entries older than the TTL (legacy entries
     *    without a timestamp are treated as expired — it is only a cache).
     *  - the news story snapshot envelope when older than the TTL (stories
     *    from two days ago are stale anyway; a fresh fetch backfills).
     * NOT touched: the single wallpaper url/credit reference (not growth —
     * it powers the instant-boot paint) and the bounded tier memory (≤40).
     */
    ARTIFACT_TTL_MS: 48 * 60 * 60 * 1000,

    purgeStaleArtifacts: function() {
      var ttl = this.ARTIFACT_TTL_MS;
      var now = Date.now();
      try {
        if (!global.localStorage) return;
        var raw = global.localStorage.getItem('LIVELY_HUD_NEWS_IMG_CACHE');
        if (raw) {
          var list = null;
          try { list = JSON.parse(raw); } catch (e) { list = null; }
          if (Array.isArray(list)) {
            var kept = list.filter(function(en) {
              return en && typeof en.at === 'number' && (now - en.at) < ttl;
            });
            if (kept.length !== list.length) {
              global.localStorage.setItem('LIVELY_HUD_NEWS_IMG_CACHE', JSON.stringify(kept));
            }
          } else {
            global.localStorage.removeItem('LIVELY_HUD_NEWS_IMG_CACHE');
          }
        }
        var snapRaw = global.localStorage.getItem('LIVELY_HUD_NEWS_SNAPSHOT');
        if (snapRaw) {
          var env = null;
          try { env = JSON.parse(snapRaw); } catch (e2) { env = null; }
          if (!env || typeof env.timestamp !== 'number' || (now - env.timestamp) > ttl) {
            global.localStorage.removeItem('LIVELY_HUD_NEWS_SNAPSHOT');
          }
        }
      } catch (e3) {}
    },

    _writeNewsImageCache: function(title, url) {
      try {
        if (!global.localStorage) return;
        var key = String(title || '').trim().toLowerCase().slice(0, 80);
        if (!key || !/^https:\/\//i.test(url)) return;
        var raw = global.localStorage.getItem('LIVELY_HUD_NEWS_IMG_CACHE');
        var list = [];
        if (raw) {
          try { var parsed = JSON.parse(raw); if (Array.isArray(parsed)) list = parsed; } catch (e2) { list = []; }
        }
        list = list.filter(function(entry) { return entry && entry.k !== key; });
        list.push({ k: key, v: url, at: Date.now() });
        while (list.length > 80) list.shift(); // bounded FIFO
        global.localStorage.setItem('LIVELY_HUD_NEWS_IMG_CACHE', JSON.stringify(list));
      } catch (e) {}
    },

    /**
     * Topical image search via the user's own keys (v0.8.12, hardened v0.8.14):
     * Pixabay first (CORS-enabled, key in query); on error or no usable image
     * — and only when another budget slot remains — fall through to Unsplash.
     * Every ACTUAL provider HTTP search consumes a persisted budget slot
     * (checked BEFORE the request). Fails closed on unavailable budget state.
     * Calls back exactly once with a validated https URL or null.
     */
    _fetchKeywordImage: function(keywords, cb) {
      var api = global.ApiService;
      if (!api) { cb(null); return; }
      var settled = false;
      var done = function(url) {
        if (settled) return;
        settled = true;
        cb(url);
      };
      var pixabayKey = String(api.pixabayApiKey || '').trim();
      var unsplashKey = String(api.unsplashApiKey || '').trim();

      var tryUnsplash = function() {
        if (!unsplashKey) { done(null); return; }
        if (!global.App || typeof global.App._newsImageBudgetOk !== 'function' ||
            !global.App._newsImageBudgetOk()) { done(null); return; }
        var uUrl = 'https://api.unsplash.com/search/photos?query=' + encodeURIComponent(keywords) +
          '&per_page=3&orientation=landscape&client_id=' + encodeURIComponent(unsplashKey);
        api.fetchWithTimeout(uUrl, 6000, {}).then(function(res) {
          if (!res.ok) throw new Error('unsplash http ' + res.status);
          return res.json();
        }).then(function(data) {
          var hit = data && Array.isArray(data.results) && data.results[0];
          var url = hit && hit.urls && typeof hit.urls.regular === 'string' && /^https:\/\//i.test(hit.urls.regular) ? hit.urls.regular : null;
          done(url);
        }).catch(function() { done(null); });
      };

      if (pixabayKey) {
        if (!global.App || typeof global.App._newsImageBudgetOk !== 'function' ||
            !global.App._newsImageBudgetOk()) { done(null); return; }
        var pUrl = 'https://pixabay.com/api/?key=' + encodeURIComponent(pixabayKey) +
          '&q=' + encodeURIComponent(keywords) +
          '&image_type=photo&orientation=horizontal&safesearch=true&per_page=3';
        api.fetchWithTimeout(pUrl, 6000, {}).then(function(res) {
          if (!res.ok) throw new Error('pixabay http ' + res.status);
          return res.json();
        }).then(function(data) {
          var hit = data && Array.isArray(data.hits) && data.hits[0];
          var url = hit && typeof hit.webformatURL === 'string' && /^https:\/\//i.test(hit.webformatURL) ? hit.webformatURL : null;
          if (url) { done(url); return; }
          tryUnsplash(); // empty result: fall through on a fresh slot
        }).catch(function() {
          tryUnsplash(); // provider error: fall through on a fresh slot
        });
        return;
      }
      if (unsplashKey) { tryUnsplash(); return; }
      done(null);
    },

    /**
     * News card story background (v0.8.9): paints the headline's image behind
     * a fixed dark scrim — text contrast is guaranteed by the CSS scrim, never
     * by the image itself. Loads off-DOM first; only a successfully decoded
     * image is applied (no broken-image flash); null/false clears it.
     */
    applyStoryBackground: function(imageUrl) {
      var block = this.dom.hudNewsBlock;
      var bg = this.dom.hudNewsBg;
      if (!bg || !block) return;

      var safe = (typeof imageUrl === 'string' && /^https:\/\//i.test(imageUrl.trim()))
        ? imageUrl.trim().replace(/"/g, '%22')
        : '';

      if (!safe) {
        if (bg.getAttribute('data-src')) {
          bg.setAttribute('data-src', '');
          bg.style.backgroundImage = '';
          block.classList.remove('has-story-image');
        }
        return;
      }

      if (bg.getAttribute('data-src') === safe && bg.style.backgroundImage) {
        return; // already painted this story
      }

      var self = this;
      var pre = new Image();
      pre.onload = function() {
        if (self.dom.hudNewsBg && self.dom.hudNewsBg.getAttribute('data-src') === safe) {
          self.dom.hudNewsBg.style.backgroundImage = 'url("' + safe + '")';
          if (self.dom.hudNewsBlock) self.dom.hudNewsBlock.classList.add('has-story-image');
        }
      };
      pre.onerror = function() {
        if (self.dom.hudNewsBg && self.dom.hudNewsBg.getAttribute('data-src') === safe) {
          self.dom.hudNewsBg.setAttribute('data-src', '');
          self.dom.hudNewsBg.style.backgroundImage = '';
          if (self.dom.hudNewsBlock) self.dom.hudNewsBlock.classList.remove('has-story-image');
        }
      };
      bg.setAttribute('data-src', safe);
      bg.style.backgroundImage = '';
      pre.src = safe;
    },

    /**
     * Honest empty-state copy; adds a one-line pointer when the News
     * Provider is set to the keyless Google News chain but API keys ARE
     * configured (v0.8.12 — the exact situation where a user sees an empty
     * card while a working keyed source sits one dropdown entry away).
     */
    newsEmptyMessage: function() {
      var base = 'No stories right now — new stories arrive automatically';
      try {
        var api = global.ApiService;
        if (!api) return base;
        var hasKeys = (String(api.newsApiKey || '').trim().length > 0) ||
                      (String(api.currentsApiKey || '').trim().length > 0);
        if (!hasKeys) return base;
        var sel = String(api.newsProvider || 'auto').toLowerCase();
        if (sel === 'google-news') {
          return base + ' — tip: set News Provider to "Auto (API keys first)" in Customize';
        }
        // Keyed providers active: if a region tier is pending for this
        // location, say so honestly (v0.8.15) — the card fills within the
        // next quota window instead of looking broken.
        var loc = (this.state && this.state.location) || {};
        if (typeof api.newsPendingSummary === 'function' &&
            api.newsPendingSummary(loc.city || '', loc.countryCode || '')) {
          return 'No local stories yet — regional stories arrive within 15 minutes';
        }
      } catch (e) {}
      return base;
    },

    displayNewsItem: function(idx) {
      if (this.dom.hudNewsLink) {
        this.dom.hudNewsLink.classList.remove('is-fading');
      }

      if (!this.newsItems || this.newsItems.length === 0) {
        if (this.dom.hudNewsHeadline) {
          this.setDomText(this.dom.hudNewsHeadline, this.newsEmptyMessage());
        }
        if (this.dom.hudNewsDots) {
          this.dom.hudNewsDots.style.display = 'none';
        }
        if (this.dom.hudNewsBlock) {
          this.dom.hudNewsBlock.title = 'News: No stories right now (checked again automatically)';
        }
        this.applyStoryBackground(null);
        return;
      }
      var item = this.newsItems[idx % this.newsItems.length];
      if (!item) return;

      var providerName = 'Google News';
      if (item.provider === 'newsapi') {
        providerName = 'NewsAPI';
      } else if (item.provider === 'currents') {
        providerName = 'Currents News';
      } else if (item.provider === 'google-news') {
        providerName = 'Google News';
      } else if (item.providerName) {
        providerName = item.providerName;
      }

      if (this.dom.hudNewsTitle) {
        this.setDomText(this.dom.hudNewsTitle, providerName);
      }
      if (this.dom.hudNewsHeadline) {
        this.setDomText(this.dom.hudNewsHeadline, item.title);
      }
      if (this.dom.hudNewsSource) {
        this.setDomText(this.dom.hudNewsSource, item.source || providerName);
      }
      if (this.dom.hudNewsLink) {
        var rawLink = item.link || '';
        var safeLink = (typeof rawLink === 'string' && /^https:\/\//i.test(rawLink.trim()))
          ? rawLink.trim()
          : 'https://news.google.com';
        this.dom.hudNewsLink.href = safeLink;
        this.dom.hudNewsLink.setAttribute('target', '_blank');
        this.dom.hudNewsLink.setAttribute('rel', 'noopener noreferrer');
        if (item.isWrapper) {
          this.dom.hudNewsLink.title = 'Open via Google News';
        } else {
          this.dom.hudNewsLink.title = 'Open Article (' + (item.source || providerName) + ')';
        }
      }

      if (this.dom.hudNewsBlock) {
        var sourceLabel = item.source ? (' — ' + item.source) : '';
        this.dom.hudNewsBlock.setAttribute('aria-label', providerName + ' news');
        this.dom.hudNewsBlock.title = providerName + ': ' + (item.title || 'News') + sourceLabel + ' (Click to inspect stories)';
      }
      this._decorateStoryBackground(item);

      if (this.dom.hudNewsDots) {
        var totalDots = this.newsItems.length;
        if (totalDots <= 1) {
          this.dom.hudNewsDots.style.display = 'none';
        } else {
          this.dom.hudNewsDots.style.display = 'flex';
          var count = Math.min(5, totalDots);
          var dots = this.dom.hudNewsDots.children;
          var activeIdx = (idx % totalDots) % count;
          for (var i = 0; i < dots.length; i++) {
            if (i < count) {
              dots[i].style.display = '';
              dots[i].setAttribute('data-idx', i);
              if (i === activeIdx) {
                dots[i].classList.add('is-active');
                dots[i].setAttribute('aria-selected', 'true');
                dots[i].setAttribute('tabindex', '0');
              } else {
                dots[i].classList.remove('is-active');
                dots[i].setAttribute('aria-selected', 'false');
                dots[i].setAttribute('tabindex', '-1');
              }
            } else {
              dots[i].style.display = 'none';
              dots[i].setAttribute('tabindex', '-1');
            }
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

      if (this.newsTransitionTimer) {
        clearTimeout(this.newsTransitionTimer);
      }
      this.newsTransitionTimer = setTimeout(function() {
        self.newsTransitionTimer = null;
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
      var incomingUrl = String(bg.url || '').replace(/["\\\n\r]/g, '');

      // Generation counter: only the newest desired wallpaper may touch the
      // buffers, credits, contrast state, or persisted boot cache. Obsolete
      // completions clean up and no-op (LW11).
      this._bgGeneration = (this._bgGeneration || 0) + 1;
      var gen = this._bgGeneration;

      // Double-buffered cross-fade preloader
      var preloader = new Image();
      preloader.crossOrigin = 'anonymous';
      preloader.onload = function() {
        preloader.onload = null;
        preloader.onerror = null;
        if (gen !== self._bgGeneration) {
          return; // superseded by a newer candidate (provider change / newer snapshot)
        }
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
          var providerLabel = (bg && bg.provider) ? (
            bg.provider === 'wallhaven' ? 'Wallhaven' :
            bg.provider === 'pexels' ? 'Pexels' :
            bg.provider === 'pixabay' ? 'Pixabay' :
            'Unsplash'
          ) : 'Unsplash';
          var photographerName = (bg && bg.photographer) || '';
          // Provider-first, generic-photographer-aware label (v0.8.16):
          // "Wallhaven" or "Pexels · Jane Doe" — never "Wallhaven Community".
          self.dom.unsplashCredit.textContent = self._wallpaperCreditLabel(providerLabel, photographerName) || 'Wallpaper';
          self.dom.unsplashCredit.classList.add('is-visible');
          self.positionWallpaperCredit();
          var rawCreditUrl = (bg && (bg.photographerUrl || bg.sourceUrl)) || '';
          var safeCreditUrl = (typeof rawCreditUrl === 'string' && /^https:\/\//i.test(rawCreditUrl.trim()))
            ? rawCreditUrl.trim()
            : 'https://unsplash.com';
          self.dom.unsplashCredit.href = safeCreditUrl;
          self.dom.unsplashCredit.setAttribute('title', 'Wallpaper source: ' + safeCreditUrl);
          self.dom.unsplashCredit.setAttribute('target', '_blank');
          self.dom.unsplashCredit.setAttribute('rel', 'noopener noreferrer');
        }

        // Persist wallpaper URL and credit to eliminate startup blank pop-in
        try {
          if (incomingUrl && typeof localStorage !== 'undefined') {
            localStorage.setItem('local_wally_cached_bg_url', incomingUrl);
            if (bg && bg.provider) {
              localStorage.setItem('local_wally_cached_bg_provider',
                bg.provider === 'wallhaven' ? 'Wallhaven' :
                bg.provider === 'pexels' ? 'Pexels' :
                bg.provider === 'pixabay' ? 'Pixabay' : 'Unsplash');
            }
            if (bg && bg.photographer) {
              localStorage.setItem('local_wally_cached_bg_photographer', bg.photographer);
            }
            if (bg && bg.photographerUrl && /^https:\/\//i.test(String(bg.photographerUrl).trim())) {
              localStorage.setItem('local_wally_cached_bg_photographer_url', String(bg.photographerUrl).trim());
            }
          }
        } catch (e) {}
      };
      preloader.onerror = function(err) {
        preloader.onload = null;
        preloader.onerror = null;
        // Newest-candidate failure keeps the currently visible image: nothing
        // to roll back here. Obsolete failures are dropped silently (LW11).
        if (gen !== self._bgGeneration) {
          return;
        }
        var safeErrUrl = (global.ApiService && typeof global.ApiService.sanitizeUrl === 'function')
          ? global.ApiService.sanitizeUrl(incomingUrl)
          : incomingUrl;
        console.warn('[App] Failed to preload resolution-matched wallpaper:', safeErrUrl, err);
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
        this.wakeAnimationLoop();
      }
    },

    updateSky: function(sunPos, moonPos, moonIllum) {
      if (!this.sky || !this.state) return;
      var now = new Date();
      var loc = this.state.location || { latitude: 35.6762, longitude: 139.6503 };
      this.sky.update(now, loc.latitude, loc.longitude, sunPos, moonPos, moonIllum);
    },

    hasActiveAnimation: function() {
      if (this.particles && typeof this.particles.hasActiveAnimation === 'function' && this.particles.hasActiveAnimation()) {
        return true;
      }
      if (this.mediaVisualizer && typeof this.mediaVisualizer.hasActiveAnimation === 'function' && this.mediaVisualizer.hasActiveAnimation()) {
        return true;
      }
      return false;
    },

    wakeAnimationLoop: function() {
      if (this.isPlaybackPaused || !this.isRunning) return;
      if (!this.animationFrameId) {
        this.lastFrameTime = performance.now();
        this._paceDeadline = 0; // reset pacing state on wake (LW07)
        if (!this._boundLoop) {
          this._boundLoop = this.loop.bind(this);
        }
        this.animationFrameId = requestAnimationFrame(this._boundLoop);
      }
    },

    startLoop: function() {
      if (this.isPlaybackPaused) return;
      if (this.isRunning) return;
      this.isRunning = true;
      if (typeof document !== 'undefined' && document.body && document.body.classList) {
        document.body.classList.remove('is-paused');
      }
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      this.lastFrameTime = performance.now();
      this._paceDeadline = 0; // reset pacing state on resume (LW07)
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
      // Dedicated news cadence: every 5 minutes. The quota firewall (and the
      // 5-minute provider windows) decide which attempts actually hit the
      // network — nothing here bypasses it (LW06).
      if (!this.newsFetchTimer && this.showNewsFeed) {
        var newsFetchTick = function() {
          if (this.isPlaybackPaused || !this.showNewsFeed) return;
          this.fetchNews();
        };
        this.newsFetchTimer = setInterval(newsFetchTick.bind(this), 300000);
      }
      if (this.pomodoro && this.showPomodoro) {
        this.pomodoro.resumeTicker();
      }
      if (this.pendingSnapshot) {
        var snap = this.pendingSnapshot;
        this.pendingSnapshot = null;
        this.renderAll(snap);
      }
      if (this.pendingNews) {
        var pNews = this.pendingNews;
        this.pendingNews = null;
        this.renderNews(pNews);
      }
      if (this.pendingTrack) {
        var pTrack = this.pendingTrack;
        this.pendingTrack = null;
        if (this.mediaVisualizer) {
          this.mediaVisualizer.handleTrackUpdate(pTrack);
        }
      }

      if (!this._boundLoop) {
        this._boundLoop = this.loop.bind(this);
      }
      // Guarded arm: no-ops when the pendingSnapshot drain above already woke the
      // loop chain (renderAll -> updateAtmosphereEngines -> wakeAnimationLoop),
      // preventing a second parallel RAF chain per vsync (C-F01).
      this.wakeAnimationLoop();
    },

    stopLoop: function() {
      this.isRunning = false;
      if (typeof document !== 'undefined' && document.body && document.body.classList) {
        document.body.classList.add('is-paused');
      }
      // Tooltip work stops with the loop: a parked wallpaper must not keep a
      // hover popover (or its linger interval) alive (v0.8.11 R13).
      if (this.isHoverPopoverOpen) {
        this.hideHoverPopover();
      }
      // Suggestion work stops too (R12): park invalidates in-flight queries.
      this._locSuggestGeneration = (this._locSuggestGeneration || 0) + 1;
      // Clear a pending debounce outright (v0.8.14): a parked wallpaper must
      // not launch a geocoder request from an expired timer.
      if (this._locSuggestDebounce) {
        clearTimeout(this._locSuggestDebounce);
        this._locSuggestDebounce = null;
      }
      // Optional image decoration stops as well: late completions must not
      // touch the DOM or the cache after parking (v0.8.14).
      this._newsImgGeneration = (this._newsImgGeneration || 0) + 1;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      this.clearNewsTimers();
      if (this.clockInterval) {
        clearInterval(this.clockInterval);
        this.clockInterval = null;
      }
      if (this.hwFallbackTimer) {
        clearInterval(this.hwFallbackTimer);
        this.hwFallbackTimer = null;
      }
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
      if (this.newsFetchTimer) {
        clearInterval(this.newsFetchTimer);
        this.newsFetchTimer = null;
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
      if (!this.isRunning || this.isPlaybackPaused) {
        this.animationFrameId = null;
        return;
      }
      this.animationFrameId = null;

      if (typeof currentTime !== 'number' || !Number.isFinite(currentTime)) {
        currentTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      }
      var FRAME_MS = 1000 / 60;

      // 60Hz pacing deadline that PRESERVES the fractional remainder across
      // frames (LW07): on 144Hz/165Hz displays the old reset-to-currentTime
      // logic discarded remainder time every frame (144Hz→48fps, 165Hz→55fps).
      // Re-initialized after wake or when we fell impossibly far behind.
      if (!this._paceDeadline || this._paceDeadline < currentTime - 10 * FRAME_MS) {
        this._paceDeadline = currentTime;
      }
      if (currentTime < this._paceDeadline - 1) { // 1ms allowance for timer jitter
        if (!this._boundLoop) {
          this._boundLoop = this.loop.bind(this);
        }
        this.animationFrameId = requestAnimationFrame(this._boundLoop);
        return;
      }

      // Physics always receive the ACTUAL elapsed time since the previous
      // RENDERED frame — never the pacing remainder or a fixed step (LW07).
      var elapsed = this.lastFrameTime ? (currentTime - this.lastFrameTime) : FRAME_MS;
      if (!Number.isFinite(elapsed) || elapsed < 0) elapsed = FRAME_MS;
      if (elapsed > 250) elapsed = 250; // long-frame-gap safety clamp (tab wake / GC pause)
      var dt = elapsed * 0.001; // Seconds
      this.lastFrameTime = currentTime;

      // Advance the deadline by one frame interval; if we are still behind,
      // clamp to scheduling the next frame one interval from now (catch-up guard)
      this._paceDeadline += FRAME_MS;
      if (this._paceDeadline <= currentTime) {
        this._paceDeadline = currentTime + FRAME_MS;
      }

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

          if (this.dom.diagFps) this.setDomText(this.dom.diagFps, String(this.fps));
          if (this.dom.diagFrametime) this.setDomText(this.dom.diagFrametime, (dt * 1000).toFixed(1) + 'ms');
          if (this.dom.diagParticles && this.particles) {
            this.setDomText(this.dom.diagParticles, String(this.particles.activePrecipCount));
          }
          this.updateGpuDiagnostics();
        }
      }

      // Check if scene has active continuous animations
      if (!this.hasActiveAnimation()) {
        this.animationFrameId = null;
        return; // Park RAF render loop until wakeAnimationLoop() is invoked
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
