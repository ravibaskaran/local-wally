/**
 * SkyEngine - Dynamic Celestial Atmosphere & Gradient Engine
 * 
 * Uses SunCalc offline astronomical calculations to compute solar and lunar vectors.
 * Smoothly interpolates sky and horizon gradients based on solar altitude:
 *  - High Day (> 0.15 rad): Radiant azure / cerulean gradient
 *  - Golden Hour (0.0 to 0.15 rad): Rich amber, rose, and indigo blend
 *  - Dusk / Sunset (-0.10 to 0.0 rad): Violet, crimson, and fiery horizon
 *  - Nautical Twilight (-0.25 to -0.10 rad): Deep cobalt to midnight navy
 *  - Deep Night (< -0.25 rad): Obsidian black to deep slate starfield
 * 
 * Renders celestial body (Glowing Sun disc or Phased Moon) with zero per-frame CPU overhead.
 */
(function(global) {
  'use strict';

  function hexToRgb(hex) {
    var clean = hex.replace('#', '');
    var r = parseInt(clean.substring(0, 2), 16);
    var g = parseInt(clean.substring(2, 4), 16);
    var b = parseInt(clean.substring(4, 6), 16);
    return {
      r: r,
      g: g,
      b: b,
      str: 'rgb(' + r + ',' + g + ',' + b + ')'
    };
  }

  function lerpColor(cA, cB, t) {
    var r = Math.round(cA.r + (cB.r - cA.r) * t);
    var g = Math.round(cA.g + (cB.g - cA.g) * t);
    var b = Math.round(cA.b + (cB.b - cA.b) * t);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // Atmospheric Keyframes for Sky Gradient (pre-parsed at script load time)
  var PALETTES = {
    DAY: {
      top: hexToRgb('#1e40af'),
      mid: hexToRgb('#3b82f6'),
      horizon: hexToRgb('#93c5fd')
    },
    GOLDEN_HOUR: {
      top: hexToRgb('#312e81'),
      mid: hexToRgb('#b91c1c'),
      horizon: hexToRgb('#f59e0b')
    },
    DUSK: {
      top: hexToRgb('#1e1b4b'),
      mid: hexToRgb('#701a75'),
      horizon: hexToRgb('#c2410c')
    },
    TWILIGHT: {
      top: hexToRgb('#0f172a'),
      mid: hexToRgb('#1e1b4b'),
      horizon: hexToRgb('#312e81')
    },
    NIGHT: {
      top: hexToRgb('#020617'),
      mid: hexToRgb('#090d16'),
      horizon: hexToRgb('#0f172a')
    }
  };

  function SkyEngine(skyContainerElement, celestialContainerElement) {
    this.container = skyContainerElement;
    this.celestialEl = celestialContainerElement;
    this.lastAltitude = null;
    this.lastUpdate = 0;
    this.sunEl = null;
    this.moonEl = null;
    this.moonDiscEl = null;
    this.initCelestialElements();
  }

  /**
   * Pre-creates reusable Sun and Moon nodes to eliminate DOM thrashing and GC overhead
   */
  SkyEngine.prototype.initCelestialElements = function() {
    if (!this.celestialEl) return;

    this.sunEl = this.celestialEl.querySelector('#celestial-sun');
    if (!this.sunEl) {
      this.sunEl = document.createElement('div');
      this.sunEl.id = 'celestial-sun';
      this.sunEl.className = 'celestial-sun is-hidden';
      this.sunEl.innerHTML = '<div class="sun-corona"></div><div class="sun-core"></div>';
      this.celestialEl.appendChild(this.sunEl);
    }

    this.moonEl = this.celestialEl.querySelector('#celestial-moon');
    if (!this.moonEl) {
      this.moonEl = document.createElement('div');
      this.moonEl.id = 'celestial-moon';
      this.moonEl.className = 'celestial-moon is-hidden';
      this.moonEl.innerHTML =
        '<div class="moon-aura"></div>' +
        '<div class="moon-disc">' +
          '<div class="moon-crater c1"></div>' +
          '<div class="moon-crater c2"></div>' +
        '</div>';
      this.celestialEl.appendChild(this.moonEl);
    }

    this.moonDiscEl = this.moonEl.querySelector('.moon-disc');
  };

  /**
   * Computes current solar & lunar altitude and updates background gradient
   * @param {Date} date
   * @param {number} lat
   * @param {number} lon
   */
  SkyEngine.prototype.update = function(date, lat, lon, sunPos, moonPos, moonIllum) {
    if (!global.SunCalc) return;
    if (typeof lat !== 'number' || !Number.isFinite(lat) || typeof lon !== 'number' || !Number.isFinite(lon)) return;

    var sPos = sunPos || global.SunCalc.getPosition(date, lat, lon);
    var altitude = (sPos && typeof sPos.altitude === 'number' && Number.isFinite(sPos.altitude)) ? sPos.altitude : 0;
    var azimuth = (sPos && typeof sPos.azimuth === 'number' && Number.isFinite(sPos.azimuth)) ? sPos.azimuth : 0;

    this.lastAltitude = altitude;
    this.applySkyGradient(altitude);
    this.renderCelestialBody(date, lat, lon, altitude, azimuth, moonPos, moonIllum);
  };

  /**
   * Interpolates gradient colors smoothly across solar altitude threshold boundaries
   */
  SkyEngine.prototype.applySkyGradient = function(alt) {
    var top, mid, horizon;

    if (alt >= 0.15) {
      // Full Daylight
      top = PALETTES.DAY.top.str;
      mid = PALETTES.DAY.mid.str;
      horizon = PALETTES.DAY.horizon.str;
    } else if (alt >= 0.0) {
      // Interpolate Golden Hour -> Day
      var t = alt / 0.15;
      top = lerpColor(PALETTES.GOLDEN_HOUR.top, PALETTES.DAY.top, t);
      mid = lerpColor(PALETTES.GOLDEN_HOUR.mid, PALETTES.DAY.mid, t);
      horizon = lerpColor(PALETTES.GOLDEN_HOUR.horizon, PALETTES.DAY.horizon, t);
    } else if (alt >= -0.10) {
      // Interpolate Dusk -> Golden Hour
      var t2 = (alt - (-0.10)) / 0.10;
      top = lerpColor(PALETTES.DUSK.top, PALETTES.GOLDEN_HOUR.top, t2);
      mid = lerpColor(PALETTES.DUSK.mid, PALETTES.GOLDEN_HOUR.mid, t2);
      horizon = lerpColor(PALETTES.DUSK.horizon, PALETTES.GOLDEN_HOUR.horizon, t2);
    } else if (alt >= -0.25) {
      // Interpolate Twilight -> Dusk
      var t3 = (alt - (-0.25)) / 0.15;
      top = lerpColor(PALETTES.TWILIGHT.top, PALETTES.DUSK.top, t3);
      mid = lerpColor(PALETTES.TWILIGHT.mid, PALETTES.DUSK.mid, t3);
      horizon = lerpColor(PALETTES.TWILIGHT.horizon, PALETTES.DUSK.horizon, t3);
    } else {
      // Deep Night
      top = PALETTES.NIGHT.top.str;
      mid = PALETTES.NIGHT.mid.str;
      horizon = PALETTES.NIGHT.horizon.str;
    }

    if (this.container) {
      this.container.style.background = 'linear-gradient(180deg, ' + top + ' 0%, ' + mid + ' 55%, ' + horizon + ' 100%)';
    }
  };

  /**
   * Renders the Sun or Moon disc based on celestial coordinates
   */
  SkyEngine.prototype.renderCelestialBody = function(date, lat, lon, sunAlt, sunAzimuth, moonPos, moonIllum) {
    if (!this.celestialEl) return;
    if (!this.sunEl || !this.moonEl) {
      this.initCelestialElements();
    }
    if (!this.sunEl || !this.moonEl) return;

    var safeSunAlt = (typeof sunAlt === 'number' && Number.isFinite(sunAlt)) ? sunAlt : 0;
    var safeSunAzimuth = (typeof sunAzimuth === 'number' && Number.isFinite(sunAzimuth)) ? sunAzimuth : 0;
    var isSunVisible = safeSunAlt > -0.08;
    var w = window.innerWidth || 1920;
    var h = window.innerHeight || 1080;

    if (isSunVisible) {
      // Map sun position to screen coordinates
      // Azimuth: -PI (South) to 0 (North) to PI. Map to width.
      var sunX = Math.round(((safeSunAzimuth + Math.PI) / (Math.PI * 2)) * w - 40);
      // Altitude: 0 at horizon (75% height), PI/2 at zenith (15% height)
      var normAlt = Math.max(0, Math.min(1.2, safeSunAlt / 1.1));
      var sunY = Math.round((h * 0.75) - (normAlt * (h * 0.60)) - 40);

      this.sunEl.style.transform = 'translate3d(' + sunX + 'px, ' + sunY + 'px, 0)';
      this.sunEl.style.opacity = '1';
      this.sunEl.classList.remove('is-hidden');
      this.sunEl.classList.add('is-active');

      this.moonEl.style.opacity = '0';
      this.moonEl.classList.remove('is-active');
      this.moonEl.classList.add('is-hidden');
    } else {
      // Render Moon
      var mPos = moonPos || (global.SunCalc.getMoonPosition(date, lat, lon) || {});
      var mIllum = moonIllum || (global.SunCalc.getMoonIllumination(date) || {});

      var safeMoonAzimuth = (typeof mPos.azimuth === 'number' && Number.isFinite(mPos.azimuth)) ? mPos.azimuth : 0;
      var safeMoonAltitude = (typeof mPos.altitude === 'number' && Number.isFinite(mPos.altitude)) ? mPos.altitude : 0;

      var moonX = Math.round(((safeMoonAzimuth + Math.PI) / (Math.PI * 2)) * w - 30);
      var normMoonAlt = Math.max(0, Math.min(1.2, safeMoonAltitude / 1.1));
      var moonY = Math.round((h * 0.75) - (normMoonAlt * (h * 0.55)) - 30);

      // Visual phase text descriptor
      var phaseText = 'Moon';
      if (moonIllum.phase < 0.05 || moonIllum.phase > 0.95) phaseText = 'New Moon';
      else if (moonIllum.phase < 0.22) phaseText = 'Waxing Crescent';
      else if (moonIllum.phase < 0.28) phaseText = 'First Quarter';
      else if (moonIllum.phase < 0.45) phaseText = 'Waxing Gibbous';
      else if (moonIllum.phase < 0.55) phaseText = 'Full Moon';
      else if (moonIllum.phase < 0.72) phaseText = 'Waning Gibbous';
      else if (moonIllum.phase < 0.78) phaseText = 'Last Quarter';
      else phaseText = 'Waning Crescent';

      this.moonEl.setAttribute('title', phaseText);
      this.moonEl.style.transform = 'translate3d(' + moonX + 'px, ' + moonY + 'px, 0)';
      this.moonEl.style.opacity = '1';
      this.moonEl.classList.remove('is-hidden');
      this.moonEl.classList.add('is-active');

      if (this.moonDiscEl) {
        this.moonDiscEl.style.opacity = (0.55 + moonIllum.fraction * 0.45).toFixed(2);
      }

      this.sunEl.style.opacity = '0';
      this.sunEl.classList.remove('is-active');
      this.sunEl.classList.add('is-hidden');
    }
  };

  global.SkyEngine = SkyEngine;
})(typeof window !== 'undefined' ? window : this);
