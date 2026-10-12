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
  this.silenceFrames = 0;
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
    if (this.dom.time) {
      this.dom.time.textContent = mStr + ':' + sStr;
    }
    if (this.dom.card) {
      var pModeLabel = this.mode === 'focus' ? 'Focus' : this.mode === 'break' ? 'Short Break' : 'Long Break';
      this.dom.card.title = 'Pomodoro: ' + pModeLabel + ' (' + mStr + ':' + sStr + (this.isRunning ? ' - Running' : ' - Paused') + ') (Click to inspect focus controls)';
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
    var colors = this.colorMap[tab] || this.colorMap.temp;

    for (var i = 0; i < N; i++) {
      var p = pts[i] || {};
      var v = 0;
      var label = '';
      if (tab === 'temp') {
        v = isF ? p.tempF : p.tempC;
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          v = minB;
          label = '--';
        } else {
          label = Math.round(v) + '°';
        }
      } else if (tab === 'feels_like') {
        v = isF ? p.apparentF : p.apparentC;
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          v = minB;
          label = '--';
        } else {
          label = Math.round(v) + '°';
        }
      } else if (tab === 'precip') {
        v = p.precipProb != null ? p.precipProb : null;
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          v = minB;
          label = '--';
        } else {
          label = Math.round(v) + '%';
        }
      } else if (tab === 'wind') {
        v = isF ? p.windSpeedMph : p.windSpeedKm;
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          v = minB;
          label = '--';
        } else {
          label = Math.round(v) + (isF ? ' mph' : ' km/h');
        }
      } else if (tab === 'humidity') {
        v = p.humidity != null ? p.humidity : null;
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          v = minB;
          label = '--';
        } else {
          label = Math.round(v) + '%';
        }
      } else if (tab === 'aqi') {
        if (p.aqi != null && Number.isFinite(p.aqi)) {
          v = p.aqi;
          label = 'AQI ' + Math.round(v);
        } else {
          v = minB;
          label = '--';
        }
      }

      var norm = (range > 0) ? Math.max(0, Math.min(1, (v - minB) / range)) : 0.5;
      if (!Number.isFinite(norm)) norm = 0.5;
      var xVal = xStart + i * dx;
      var yVal = yBottom - norm * (yBottom - yTop);
      xs[i] = Number.isFinite(xVal) ? xVal : xStart;
      ys[i] = Number.isFinite(yVal) ? yVal : yBottom;

      var dotColor = colors.dot;
      if (tab === 'aqi') {
        dotColor = (p.aqi != null && p.aqiColor) ? p.aqiColor : '#94a3b8';
      }

      // Update dot
      var dot = this.dotPool[i];
      var dotTooltip = (p.label || p.time || '') + ': ' + label + (tab === 'temp' ? ' Temperature' : tab === 'feels_like' ? ' Feels Like' : tab === 'precip' ? ' Precip Chance' : tab === 'wind' ? ' Wind Speed' : tab === 'humidity' ? ' Humidity' : ' Air Quality');
      if (dot) {
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
      var docHidden = (typeof document !== 'undefined' && document.hidden) ? true : false;
      var livelyPaused = (global.LivelyBridge && global.LivelyBridge.isPaused) ? true : false;
      this.isPlaybackPaused = docHidden || livelyPaused;

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
        hudEphemerisMoon: document.getElementById('hud-ephemeris-moon'),
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
        ephemerisMoonGlyph: document.getElementById('ephemeris-moon-glyph'),
        ephemerisMoonPhase: document.getElementById('ephemeris-moon-phase'),
        ephemerisMoonIllum: document.getElementById('ephemeris-moon-illum'),
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
          if (this.dom.unsplashCredit && cachedPhotographer) {
            this.dom.unsplashCredit.textContent = 'Photo by ' + cachedPhotographer;
            var safePhotogUrl = (cachedPhotographerUrl && /^https:\/\//i.test(String(cachedPhotographerUrl).trim()))
              ? String(cachedPhotographerUrl).trim()
              : 'https://unsplash.com';
            this.dom.unsplashCredit.href = safePhotogUrl;
            this.dom.unsplashCredit.setAttribute('target', '_blank');
            this.dom.unsplashCredit.setAttribute('rel', 'noopener noreferrer');
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

      // Refresh button click
      if (this.dom.btnRefresh) {
        this.dom.btnRefresh.addEventListener('click', function() {
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
            var nProviders = ['google-news', 'newsapi', 'currents', 'rotate'];
            var npVal = (typeof val === 'number') ? (nProviders[val] || 'google-news') : (
              val === 'NewsAPI' ? 'newsapi' :
              val === 'Currents News' ? 'currents' :
              val === 'Rotate configured sources' ? 'rotate' :
              String(val).toLowerCase()
            );
            if (global.ApiService) global.ApiService.newsProvider = npVal;
            self.fetchNews(true);
            break;
          case 'newsApiKey':
            if (global.ApiService) global.ApiService.newsApiKey = val;
            self.fetchNews(true);
            break;
          case 'currentsApiKey':
            if (global.ApiService) global.ApiService.currentsApiKey = val;
            self.fetchNews(true);
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
      var dateStr = '';

      if (tz) {
        try {
          if (!this._tzFormatters) this._tzFormatters = {};
          if (!this._tzFormatters[tz + '_clock']) {
            this._tzFormatters[tz + '_clock'] = new Intl.DateTimeFormat('en-US', {
              timeZone: tz,
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
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
          var parts = this._tzFormatters[tz + '_clock'].format(now).split(':');
          if (parts.length === 2) {
            hStr = parts[0];
            mStr = parts[1];
          }
          dateStr = this._tzFormatters[tz + '_date'].format(now);
        } catch (e) {
          tz = null;
        }
      }

      if (!tz) {
        var hours = now.getHours();
        var minutes = now.getMinutes();
        hStr = hours < 10 ? '0' + hours : '' + hours;
        mStr = minutes < 10 ? '0' + minutes : '' + minutes;
        if (!this._localDateFormatter) {
          this._localDateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        }
        dateStr = this._localDateFormatter.format(now);
      }

      if (this.dom.hudClock) {
        this.setDomText(this.dom.hudClock, hStr + ':' + mStr);
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

      // Sun altitude > -0.01454 rad (-0.833 deg) is the geometric solar horizon accounting for atmospheric refraction and solar radius
      var isDay = (sunPos && typeof sunPos.altitude === 'number') ? (sunPos.altitude > -0.01454) : true;

      // Allow simulation mode (e.g. 4: Starry Night, 1: Clear Day) override
      if (typeof this.simulationMode === 'number' && this.simulationMode > 0) {
        if (this.simulationMode === 4) isDay = false;
        else if (this.simulationMode === 1) isDay = true;
      } else if (!sunPos && this.state && this.state.weather && typeof this.state.weather.isDay === 'boolean') {
        isDay = this.state.weather.isDay;
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

      // 3. Day vs Night Row Toggling
      if (isDay) {
        if (this.dom.hudEphemerisSunRow) this.dom.hudEphemerisSunRow.classList.remove('is-hidden');
        if (this.dom.hudEphemerisMoonRow) this.dom.hudEphemerisMoonRow.classList.add('is-hidden');
        if (this.dom.hudEphemerisMoon) this.dom.hudEphemerisMoon.classList.remove('is-hidden');
      } else {
        if (this.dom.hudEphemerisSunRow) this.dom.hudEphemerisSunRow.classList.add('is-hidden');
        if (this.dom.hudEphemerisMoonRow) this.dom.hudEphemerisMoonRow.classList.remove('is-hidden');
        if (this.dom.hudEphemerisMoon) this.dom.hudEphemerisMoon.classList.add('is-hidden');
      }

      // 4. Daytime 3-Card Calculations
      var hourly = (this.state && (this.state.hourlyForecast || (this.state.weather && this.state.weather.hourlyForecast))) || [];
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
          if (!ptTimeMs && pt.time) {
            var parsedTime = new Date(pt.time).getTime();
            if (!isNaN(parsedTime)) ptTimeMs = parsedTime;
          }
          if (ptTimeMs && (ptTimeMs < nowMs - 1800000 || ptTimeMs > horizonMs)) {
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

        var startOfDayMs = null;
        var endOfDayMs = null;
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
            todayKey = self._tzFormatters[tz + '_YMD'].format(now);
            var nowTime = now.getTime();
            var probe = nowTime - (nowTime % 3600000);
            var checkDate = new Date();
            while (probe > nowTime - 26 * 3600000) {
              checkDate.setTime(probe - 3600000);
              if (self._tzFormatters[tz + '_YMD'].format(checkDate) !== todayKey) {
                startOfDayMs = probe;
                break;
              }
              probe -= 3600000;
            }
            if (startOfDayMs != null) {
              endOfDayMs = startOfDayMs + 24 * 3600000;
            }
          } catch (e) {}
        }
        if (startOfDayMs == null) {
          var d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          startOfDayMs = d0.getTime();
          endOfDayMs = startOfDayMs + 86400000;
        }

        for (var pi = 0; pi < hourly.length; pi++) {
          var hPt = hourly[pi];
          if (!hPt) continue;

          // Exclude points outside current day
          var hPtMs = hPt.timestamp;
          if (!hPtMs && hPt.time) {
            var hParsed = new Date(hPt.time).getTime();
            if (!isNaN(hParsed)) hPtMs = hParsed;
          }

          if (hPtMs && (hPtMs < startOfDayMs || hPtMs >= endOfDayMs)) {
            continue;
          }

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
      if (sunTimes && sunTimes.dawn && sunTimes.dawn > now) {
        skyCandidates.push({ time: sunTimes.dawn, label: 'Civil Dawn', sub: 'first light' });
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
          if (tomorrowSunTimes && tomorrowSunTimes.dawn && tomorrowSunTimes.dawn > now) {
            skyCandidates.push({ time: tomorrowSunTimes.dawn, label: 'Civil Dawn', sub: 'first light' });
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
    },

    hideHoverPopover: function() {
      if (!this.dom.hudHoverPopover) return;
      if (this.currentPopoverAnchor) {
        this.currentPopoverAnchor.removeAttribute('aria-describedby');
        this.currentPopoverAnchor = null;
      }
      this.dom.hudHoverPopover.classList.remove('is-visible');
      this.dom.hudHoverPopover.setAttribute('aria-hidden', 'true');
      this.isHoverPopoverOpen = false;
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
            title: 'Regional Dispatch Feed',
            bodyHtml: makeRows([
              ['Active Headline', (this.dom.hudNewsHeadline ? this.dom.hudNewsHeadline.textContent : 'Regional News')],
              ['Source Outlet', (this.dom.hudNewsSource ? this.dom.hudNewsSource.textContent : 'News Source')],
              ['Feed Controls', 'Click story dots to jump; click to read']
            ])
          };

        case 'news-dot':
          var dotIdx = parseInt(el ? el.getAttribute('data-idx') : '0', 10);
          var story = (this.newsItems && this.newsItems[dotIdx]) || {};
          return {
            title: 'Story ' + (dotIdx + 1) + ' of ' + (this.newsItems ? this.newsItems.length : 1),
            bodyHtml: makeRows([
              ['Headline', story.title || 'Regional Story'],
              ['Source & Age', (story.timeAgo ? story.timeAgo + ' · ' : '') + (story.source || 'Regional Publisher')],
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
              '<span class="hud-detail-item-val">' + (weather.humidity != null ? weather.humidity + '%' : 'Unavailable') + '</span>' +
              '<span class="hud-detail-item-sub">Dew point equilibrium</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Surface Wind</span>' +
              '<span class="hud-detail-item-val">' + (weather.windSpeedKm != null ? weather.windSpeedKm + ' km/h' : 'Calm') + '</span>' +
              '<span class="hud-detail-item-sub">' + (weather.windDirection ? esc(weather.windDirection) : 'Variable direction') + '</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Precipitation</span>' +
              '<span class="hud-detail-item-val">' + (pVal != null ? pVal + ' mm' : '0.0 mm') + '</span>' +
              '<span class="hud-detail-item-sub">Surface accumulation</span>' +
            '</div>' +
            '<div class="hud-detail-item">' +
              '<span class="hud-detail-item-label">Barometric Pressure</span>' +
              '<span class="hud-detail-item-val">' + (weather.pressureHpa ? weather.pressureHpa + ' hPa' : '1013 hPa') + '</span>' +
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
          if (titleEl) titleEl.textContent = 'Regional News Dispatch';

          var newsList = this.newsItems || state.news || [];
          if (newsList && newsList.length > 0) {
            html = '<div class="hud-detail-news-list">';
            for (var ni = 0; ni < newsList.length; ni++) {
              var nItem = newsList[ni];
              var rawUrl = nItem.link || nItem.url || '';
              var safeUrl = (typeof rawUrl === 'string' && /^https:\/\//i.test(rawUrl.trim())) ? rawUrl.trim() : '#';
              html += '<a class="hud-detail-news-item" href="' + esc(safeUrl) + '" target="_blank" rel="noopener noreferrer">' +
                '<p class="hud-detail-news-title">' + esc(nItem.title || 'Untitled Story') + '</p>' +
                '<div class="hud-detail-news-meta">' +
                  '<span>' + esc(nItem.source || 'Regional Publisher') + '</span>' +
                  '<span>' + esc(nItem.timeAgo || 'Recent') + '</span>' +
                '</div>' +
              '</a>';
            }
            html += '</div>';
          } else {
            html = '<div class="hud-detail-item full-width">' +
              '<span class="hud-detail-item-val">No regional news stories available.</span>' +
              '<span class="hud-detail-item-sub">GDELT DOC 2.0 query returned 0 articles for current locality.</span>' +
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

      bodyEl.innerHTML = html;
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

    fetchNews: function(forceRefresh) {
      var self = this;
      if (!global.ApiService || typeof global.ApiService.fetchNews !== 'function') return Promise.resolve([]);
      var loc = (this.state && this.state.location) || (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.defaultLocation) || {};
      var city = loc.city || 'Local Area';
      var country = loc.countryCode || 'US';
      return global.ApiService.fetchNews(city, country, forceRefresh)
        .then(function(articles) {
          if (articles && articles.length > 0) {
            self.newsItems = articles;
            if (self.state) {
              self.state.news = articles;
            }
            if (!self.isPlaybackPaused) {
              self.renderNews(articles);
            }
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

    handleSystemInfo: function(data) {
      if (!data || this.isPlaybackPaused || !this.showHardwareMonitor) return;
      var setDomText = (typeof this.setDomText === 'function') ? this.setDomText.bind(this)
        : (typeof App !== 'undefined' && typeof App.setDomText === 'function') ? App.setDomText.bind(App)
        : function(n, t) { if (n && n.textContent !== t) n.textContent = t; };

      this.lastHwUpdate = Date.now();
      this.lastHwData = data;

      // CPU load and name
      var cpuVal = (typeof data.CurrentCpu === 'number' && Number.isFinite(data.CurrentCpu)) ? Math.round(data.CurrentCpu) : 0;
      cpuVal = Math.max(0, Math.min(100, cpuVal));
      var cpuName = (typeof data.NameCpu === 'string' && data.NameCpu.trim()) ? data.NameCpu.trim() : 'Processor';
      this.pushHwHistory(this.hwCpuHistory, cpuVal);

      if (this.dom.hwCpuVal) setDomText(this.dom.hwCpuVal, cpuVal + '%');
      if (this.dom.hwCpuBar) this.dom.hwCpuBar.style.width = cpuVal + '%';
      if (this.sparklineEngine) this.sparklineEngine.render('cpu', this.hwCpuHistory);
      if (this.dom.hwCpuName) setDomText(this.dom.hwCpuName, cpuName);

      // GPU 3D load and name
      var gpuVal = (typeof data.CurrentGpu3D === 'number' && Number.isFinite(data.CurrentGpu3D)) ? Math.round(data.CurrentGpu3D) : 0;
      gpuVal = Math.max(0, Math.min(100, gpuVal));
      var gpuName = (typeof data.NameGpu === 'string' && data.NameGpu.trim()) ? data.NameGpu.trim() : 'Graphics 3D';
      this.pushHwHistory(this.hwGpuHistory, gpuVal);

      if (this.dom.hwGpuVal) setDomText(this.dom.hwGpuVal, gpuVal + '%');
      if (this.dom.hwGpuBar) this.dom.hwGpuBar.style.width = gpuVal + '%';
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
      if (this.dom.hwRamBar) this.dom.hwRamBar.style.width = ramPct + '%';
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
        if (this.dom.hwDiskBar) this.dom.hwDiskBar.style.width = diskVal + '%';
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
        if (this.dom.hwNetDownBar) {
          var downPct = downKbps <= 0 ? 0 : Math.min(100, Math.max(2, Math.round((downKbps / 50000) * 100)));
          this.dom.hwNetDownBar.style.width = downPct + '%';
        }
        if (this.sparklineEngine) this.sparklineEngine.render('netDown', this.hwNetDownHistory);
      }

      if (rawUp !== null) {
        var upKbps = (data.NameNetCard || rawUp > 1000000) ? Math.round((rawUp * 8) / 1000) : rawUp;
        upKbps = Math.max(0, upKbps);
        this.pushHwHistory(this.hwNetUpHistory, upKbps);

        if (this.dom.hwNetUpVal) setDomText(this.dom.hwNetUpVal, this.formatNetworkBandwidth(upKbps));
        if (this.dom.hwNetUpBar) {
          var upPct = upKbps <= 0 ? 0 : Math.min(100, Math.max(2, Math.round((upKbps / 15000) * 100)));
          this.dom.hwNetUpBar.style.width = upPct + '%';
        }
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
            if (self.dom.hwDiskBar) self.dom.hwDiskBar.style.width = pct + '%';
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
      if (this.dom.hwDiskBar) this.dom.hwDiskBar.style.width = pct + '%';
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
      if (this.dom.hwCpuBar) this.dom.hwCpuBar.style.width = this.simulatedCpuLoad + '%';
      if (this.dom.hwCpuName) this.setDomText(this.dom.hwCpuName, 'Processor');

      if (this.dom.hwGpuVal) this.setDomText(this.dom.hwGpuVal, this.simulatedGpuLoad + '%');
      if (this.dom.hwGpuBar) this.dom.hwGpuBar.style.width = this.simulatedGpuLoad + '%';
      if (this.dom.hwGpuName) this.setDomText(this.dom.hwGpuName, 'Graphics 3D');

      if (this.dom.hwRamVal) this.setDomText(this.dom.hwRamVal, ramPct + '%');
      if (this.dom.hwRamBar) this.dom.hwRamBar.style.width = ramPct + '%';
      if (this.dom.hwRamDetail) {
        this.setDomText(this.dom.hwRamDetail, this.simulatedRamUsed + ' / ' + this.simulatedRamTotal + ' GB');
      }

      if (this.dom.hwDiskVal) this.setDomText(this.dom.hwDiskVal, this.simulatedDiskPct + '%');
      if (this.dom.hwDiskBar) this.dom.hwDiskBar.style.width = this.simulatedDiskPct + '%';
      if (this.dom.hwDiskDetail) this.setDomText(this.dom.hwDiskDetail, 'Drive C:');

      // Network Down & Up DOM Updates
      var netDownFormatted = this.formatNetworkBandwidth(this.simulatedNetDown);
      var netUpFormatted = this.formatNetworkBandwidth(this.simulatedNetUp);
      if (this.dom.hwNetDownVal) this.setDomText(this.dom.hwNetDownVal, netDownFormatted);
      if (this.dom.hwNetUpVal) this.setDomText(this.dom.hwNetUpVal, netUpFormatted);
      if (this.dom.hwNetDownName) this.setDomText(this.dom.hwNetDownName, 'Download');
      if (this.dom.hwNetUpName) this.setDomText(this.dom.hwNetUpName, 'Upload');

      if (this.dom.hwNetDownBar) {
        var downPct = this.simulatedNetDown <= 0 ? 0 : Math.min(100, Math.max(2, Math.round((this.simulatedNetDown / 50000) * 100)));
        this.dom.hwNetDownBar.style.width = downPct + '%';
      }
      if (this.dom.hwNetUpBar) {
        var upPct = this.simulatedNetUp <= 0 ? 0 : Math.min(100, Math.max(2, Math.round((this.simulatedNetUp / 15000) * 100)));
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

      if (this.dom.hudHwBadge) {
        this.setDomText(this.dom.hudHwBadge, 'Standby');
        this.dom.hudHwBadge.className = 'hud-hw-badge is-standby';
      }
    },

    renderNews: function(items) {
      this.clearNewsTimers();

      if (Array.isArray(items) && items.length > 0) {
        this.newsItems = items;
      } else if (!this.newsItems || this.newsItems.length === 0) {
        if (global.ApiService && typeof global.ApiService.getCuratedNews === 'function') {
          this.newsItems = global.ApiService.getCuratedNews('Local Area');
        }
      }

      if (!this.newsItems || this.newsItems.length === 0) {
        if (this.dom.hudNewsHeadline) {
          this.dom.hudNewsHeadline.textContent = 'Regional dispatch unavailable';
        }
        if (this.dom.hudNewsDots) {
          this.dom.hudNewsDots.style.display = 'none';
        }
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

    displayNewsItem: function(idx) {
      if (this.dom.hudNewsLink) {
        this.dom.hudNewsLink.classList.remove('is-fading');
      }

      if (!this.newsItems || this.newsItems.length === 0) {
        if (this.dom.hudNewsHeadline) {
          this.setDomText(this.dom.hudNewsHeadline, 'Regional dispatch unavailable');
        }
        if (this.dom.hudNewsDots) {
          this.dom.hudNewsDots.style.display = 'none';
        }
        if (this.dom.hudNewsBlock) {
          this.dom.hudNewsBlock.title = 'Regional News Dispatch: Unavailable (Click to inspect feed)';
        }
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
        this.dom.hudNewsBlock.setAttribute('aria-label', providerName + ' Dispatch');
        this.dom.hudNewsBlock.title = providerName + ' Dispatch: ' + (item.title || 'Regional News') + sourceLabel + ' (Click to inspect stories)';
      }

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
      var incomingUrl = bg.url;

      // Double-buffered cross-fade preloader
      var preloader = new Image();
      preloader.crossOrigin = 'anonymous';
      preloader.onload = function() {
        preloader.onload = null;
        preloader.onerror = null;
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
          var photographerName = (bg && bg.photographer) || (providerLabel + ' Artist');
          self.dom.unsplashCredit.textContent = 'Photo by ' + photographerName + ' (' + providerLabel + ')';
          var rawCreditUrl = (bg && (bg.photographerUrl || bg.sourceUrl)) || '';
          var safeCreditUrl = (typeof rawCreditUrl === 'string' && /^https:\/\//i.test(rawCreditUrl.trim()))
            ? rawCreditUrl.trim()
            : 'https://unsplash.com';
          self.dom.unsplashCredit.href = safeCreditUrl;
          self.dom.unsplashCredit.setAttribute('target', '_blank');
          self.dom.unsplashCredit.setAttribute('rel', 'noopener noreferrer');
        }

        // Persist wallpaper URL and photographer credit to eliminate startup blank pop-in
        try {
          if (incomingUrl && typeof localStorage !== 'undefined') {
            localStorage.setItem('local_wally_cached_bg_url', incomingUrl);
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
      this.animationFrameId = requestAnimationFrame(this._boundLoop);
    },

    stopLoop: function() {
      this.isRunning = false;
      if (typeof document !== 'undefined' && document.body && document.body.classList) {
        document.body.classList.add('is-paused');
      }
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

      var elapsed = currentTime - this.lastFrameTime;
      // Cap at 60 FPS (skip frames if called faster than ~16ms on 120Hz/144Hz/240Hz monitors, allowing 14.5ms for timer jitter on 60Hz)
      if (elapsed < 14.5) {
        if (!this._boundLoop) {
          this._boundLoop = this.loop.bind(this);
        }
        this.animationFrameId = requestAnimationFrame(this._boundLoop);
        return;
      }

      var dt = elapsed * 0.001; // Seconds
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
