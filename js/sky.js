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

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function parseHex(hex) {
    hex = hex.replace('#', '');
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16)
    };
  }

  function lerpColor(hexA, hexB, t) {
    var cA = parseHex(hexA);
    var cB = parseHex(hexB);
    var r = Math.round(lerp(cA.r, cB.r, t));
    var g = Math.round(lerp(cA.g, cB.g, t));
    var b = Math.round(lerp(cA.b, cB.b, t));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // Atmospheric Keyframes for Sky Gradient
  var PALETTES = {
    DAY: {
      top: '#1e40af',    // Deep azure
      mid: '#3b82f6',    // Sky blue
      horizon: '#93c5fd' // Soft cyan-tinted light
    },
    GOLDEN_HOUR: {
      top: '#312e81',    // Indigo
      mid: '#b91c1c',    // Crimson rose
      horizon: '#f59e0b' // Radiant warm amber
    },
    DUSK: {
      top: '#1e1b4b',    // Deep twilight violet
      mid: '#701a75',    // Magenta plum
      horizon: '#c2410c' // Ember orange
    },
    TWILIGHT: {
      top: '#0f172a',    // Dark slate
      mid: '#1e1b4b',    // Deep indigo
      horizon: '#312e81' // Cobalt
    },
    NIGHT: {
      top: '#020617',    // Obsidian void
      mid: '#090d16',    // Deep slate
      horizon: '#0f172a' // Midnight blue
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
  SkyEngine.prototype.update = function(date, lat, lon) {
    if (!global.SunCalc) return;

    var sunPos = global.SunCalc.getPosition(date, lat, lon);
    var altitude = sunPos.altitude; // Radians (-PI/2 to PI/2)
    var azimuth = sunPos.azimuth;

    this.lastAltitude = altitude;
    this.applySkyGradient(altitude);
    this.renderCelestialBody(date, lat, lon, altitude, azimuth);
  };

  /**
   * Interpolates gradient colors smoothly across solar altitude threshold boundaries
   */
  SkyEngine.prototype.applySkyGradient = function(alt) {
    var top, mid, horizon;

    if (alt >= 0.15) {
      // Full Daylight
      top = PALETTES.DAY.top;
      mid = PALETTES.DAY.mid;
      horizon = PALETTES.DAY.horizon;
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
      top = PALETTES.NIGHT.top;
      mid = PALETTES.NIGHT.mid;
      horizon = PALETTES.NIGHT.horizon;
    }

    if (this.container) {
      this.container.style.background = 'linear-gradient(180deg, ' + top + ' 0%, ' + mid + ' 55%, ' + horizon + ' 100%)';
    }
  };

  /**
   * Renders the Sun or Moon disc based on celestial coordinates
   */
  SkyEngine.prototype.renderCelestialBody = function(date, lat, lon, sunAlt, sunAzimuth) {
    if (!this.celestialEl) return;
    if (!this.sunEl || !this.moonEl) {
      this.initCelestialElements();
    }
    if (!this.sunEl || !this.moonEl) return;

    var isSunVisible = sunAlt > -0.08;
    var w = window.innerWidth || 1920;
    var h = window.innerHeight || 1080;

    if (isSunVisible) {
      // Map sun position to screen coordinates
      // Azimuth: -PI (South) to 0 (North) to PI. Map to width.
      var sunX = Math.round(((sunAzimuth + Math.PI) / (Math.PI * 2)) * w - 40);
      // Altitude: 0 at horizon (75% height), PI/2 at zenith (15% height)
      var normAlt = Math.max(0, Math.min(1.2, sunAlt / 1.1));
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
      var moonPos = global.SunCalc.getMoonPosition(date, lat, lon);
      var moonIllum = global.SunCalc.getMoonIllumination(date);

      var moonX = Math.round(((moonPos.azimuth + Math.PI) / (Math.PI * 2)) * w - 30);
      var normMoonAlt = Math.max(0, Math.min(1.2, moonPos.altitude / 1.1));
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
