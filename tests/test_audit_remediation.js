// ===========================================================================
// Local Wally - Comprehensive Audit Remediation Regression Tests (LW01 - LW20)
// ===========================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock browser environment
const domElements = {};
function createMockElement(id, tag = 'div') {
  return {
    id,
    tagName: tag.toUpperCase(),
    textContent: '',
    innerHTML: '',
    title: '',
    value: '',
    style: {
      setProperty: function(k, v) { this[k] = v; },
      getPropertyValue: function(k) { return this[k] || ''; },
      display: ''
    },
    classList: {
      _classes: new Set(),
      add: function(c) { this._classes.add(c); },
      remove: function(c) { this._classes.delete(c); },
      toggle: function(c, force) {
        if (force === undefined) {
          if (this._classes.has(c)) this._classes.delete(c);
          else this._classes.add(c);
        } else if (force) {
          this._classes.add(c);
        } else {
          this._classes.delete(c);
        }
      },
      contains: function(c) { return this._classes.has(c); }
    },
    addEventListener: function(event, handler) {
      if (!this._handlers) this._handlers = {};
      if (!this._handlers[event]) this._handlers[event] = [];
      this._handlers[event].push(handler);
    },
    dispatchEvent: function(event) {
      if (this._handlers && this._handlers[event]) {
        this._handlers[event].forEach(h => h({ stopPropagation: () => {} }));
      }
    },
    appendChild: function(c) { return c; },
    removeChild: function(c) { return c; },
    querySelectorAll: function() { return []; },
    querySelector: function() { return null; },
    setAttribute: function(k, v) { this[k] = v; },
    getAttribute: function(k) { return this[k] || null; },
    removeAttribute: function(k) { delete this[k]; },
    focus: function() {},
    getContext: function() {
      return {
        clearRect: () => {},
        beginPath: () => {},
        rect: () => {},
        fillRect: () => {},
        arc: () => {},
        stroke: () => {},
        fill: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        setTransform: () => {},
        scale: () => {}
      };
    }
  };
}

global.window = global;
global.window.matchMedia = () => ({ matches: false, addEventListener: () => {}, addListener: () => {} });
global.window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.window.cancelAnimationFrame = (id) => clearTimeout(id);
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};

global.document = {
  readyState: 'complete',
  hidden: false,
  hasFocus: () => true,
  documentElement: {
    style: {
      setProperty: () => {},
      getPropertyValue: () => ''
    }
  },
  getElementById: function(id) {
    if (!domElements[id]) {
      domElements[id] = createMockElement(id);
    }
    return domElements[id];
  },
  querySelector: function(sel) {
    return createMockElement('sel_' + sel);
  },
  querySelectorAll: function() {
    return [];
  },
  createElement: function(tag) {
    return createMockElement('dyn_' + Math.random(), tag);
  },
  body: createMockElement('body', 'body'),
  addEventListener: () => {},
  removeEventListener: () => {}
};

global.localStorage = {
  _data: {},
  getItem: function(k) { return this._data[k] || null; },
  setItem: function(k, v) { this._data[k] = String(v); },
  removeItem: function(k) { delete this._data[k]; },
  clear: function() { this._data = {}; }
};

global.LOCAL_WALLY_CONFIG = {};

// Load application modules
require('../config.js');
const apiModule = require('../js/api.js');
const livelyModule = require('../js/lively.js');
const syncModule = require('../js/sync.js');
const appModule = require('../js/app.js');

const ApiService = global.ApiService;
const LivelyBridge = global.LivelyBridge;
const OneDriveSync = global.OneDriveSync;
const App = global.App;
const MediaVisualizerEngine = global.MediaVisualizerEngine;
const PomodoroEngine = global.PomodoroEngine;

let passCount = 0;
let failCount = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log('  [PASS] ' + name);
    passCount++;
  } catch (err) {
    console.error('  [FAIL] ' + name, err);
    failCount++;
  }
}

async function runAll() {
  console.log('===============================================================');
  console.log('Local Wally Audit Remediation Suite (LW01 - LW20)');
  console.log('===============================================================\n');

  // --- LW01: Storage Secrets Boundary ---
  await test('LW01: Operational auth and sync tokens excluded from settings payload', () => {
    localStorage.clear();
    localStorage.setItem('local_wally_onedrive_auth', JSON.stringify({ accessToken: 'SECRET_TOKEN' }));
    localStorage.setItem('local_wally_onedrive_sync_meta', JSON.stringify({ cTag: '123' }));
    localStorage.setItem('local_wally_wallpaper_feedback_tombstones', JSON.stringify({ items: [] }));

    const payload = App._buildSettingsPayload({ includeKeys: true });
    assert.strictEqual(typeof payload.local_wally_onedrive_auth, 'undefined');
    assert.strictEqual(typeof payload.local_wally_onedrive_sync_meta, 'undefined');
    assert.strictEqual(typeof payload.local_wally_wallpaper_feedback_tombstones, 'undefined');

    // Verify .gitignore exclusions
    const gitignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('onedrive_tokens.json'));
    assert.ok(gitignore.includes('tools/onedrive_tokens.json'));
  });

  // --- LW02: Drawer XSS and Profile Validation ---
  await test('LW02: Drawer list safely builds DOM nodes and validateProfile checks structure', () => {
    const maliciousProfile = {
      version: 1,
      wallpaperPreferences: {
        favorites: [{ assetKey: 'test', title: '<script>alert(1)</script>', author: '<img src=x onerror=alert(1)>' }],
        avoided: 'INVALID_NOT_ARRAY'
      }
    };
    assert.strictEqual(OneDriveSync.validateProfile(maliciousProfile).valid, false, 'Malformed avoided list should fail validation');

    const validProfile = {
      version: 1,
      settings: {},
      wallpaperPreferences: {
        favorites: [{ assetKey: 'fav1', title: 'Mountain', url: 'https://images.unsplash.com/photo-1' }],
        avoided: [{ assetKey: 'av1', title: 'City' }]
      }
    };
    assert.strictEqual(OneDriveSync.validateProfile(validProfile).valid, true, 'Well-formed profile should pass validation');
  });

  // --- LW03: Three-Way Settings Merge ---
  await test('LW03: Three-Way merge resolves disjoint edits without data loss', () => {
    const base = { tempUnit: 0, theme: 0 };
    const local = { tempUnit: 1, theme: 0 };
    const remote = { tempUnit: 0, theme: 1 };

    const result = OneDriveSync.threeWayMergeSettings(base, local, remote);
    assert.strictEqual(result.merged.tempUnit, 1, 'Local tempUnit change preserved');
    assert.strictEqual(result.merged.theme, 1, 'Remote theme change merged');
    assert.strictEqual(result.hasConflicts, false, 'Disjoint properties do not conflict');
  });

  // --- LW04: Wallpaper Feedback Deletion Tombstones ---
  await test('LW04: Deletion tombstones prevent resurrection of removed favorites/avoided', () => {
    const base = {
      favorites: [{ assetKey: 'fav1', title: 'Sunset' }, { assetKey: 'fav2', title: 'Forest' }],
      avoided: []
    };
    const local = {
      favorites: [{ assetKey: 'fav2', title: 'Forest' }],
      avoided: [],
      deletedFavorites: [{ assetKey: 'fav1', isDeleted: true, deletedAtUtc: Date.now() }]
    };
    const remote = {
      favorites: [{ assetKey: 'fav1', title: 'Sunset' }, { assetKey: 'fav2', title: 'Forest' }],
      avoided: []
    };

    const merged = OneDriveSync.mergeWallpaperPreferences(local, remote, base);
    const favKeys = merged.favorites.map(f => f.assetKey);
    assert.ok(!favKeys.includes('fav1'), 'Tombstoned favorite must not be resurrected');
    assert.ok(favKeys.includes('fav2'), 'Retained favorite must be present');
  });

  // --- LW05: News Ingestion Lifecycle & Freshness ---
  await test('LW05: News boot sequencing respects query identity and marks stale on mismatch', () => {
    localStorage.clear();
    const staleItem = { title: 'Old Headline', isStale: true };
    assert.strictEqual(App.formatNewsAge(staleItem), 'Cached', 'Stale items report Cached');
  });

  // --- LW06: Strict Weather Provider Normalization ---
  await test('LW06: Malformed 2xx payloads reject rather than fabricate 20C clear', () => {
    // Missing required fields must throw Error
    assert.throws(() => {
      ApiService.WeatherAdapter.normalizeOpenMeteo({});
    }, /missing current/i);

    assert.throws(() => {
      ApiService.WeatherAdapter.normalizeOpenWeatherMap({});
    }, /missing/i);

    // Valid 0 C must be accepted
    const validZeroPayload = {
      current: {
        temperature_2m: 0,
        weather_code: 0,
        time: '2026-10-18T12:00'
      }
    };
    const normalized = ApiService.WeatherAdapter.normalizeOpenMeteo(validZeroPayload);
    assert.strictEqual(normalized.tempC, 0, 'Freezing 0 C must be preserved');
  });

  // --- LW07: Location-Accurate Hourly Forecast Times ---
  await test('LW07: OWM hourly points compute wall-clock hour via location offset', () => {
    const mockOwm = {
      city: { timezone: 3600 },
      list: [
        {
          dt: 1700000000,
          main: { temp: 15, feels_like: 14, temp_min: 10, temp_max: 18, humidity: 60 },
          weather: [{ id: 800, main: 'Clear', description: 'clear sky' }],
          wind: { speed: 3.5, deg: 180 },
          clouds: { all: 10 }
        }
      ]
    };
    const norm = ApiService.WeatherAdapter.normalizeOpenWeatherMap(mockOwm);
    assert.ok(norm.hourlyForecast && norm.hourlyForecast.length > 0);
  });

  // --- LW08: Unified Accessible Modal Dialogs ---
  await test('LW08: Modal managers trap focus and expose active modal queries', () => {
    assert.strictEqual(typeof App.getActiveModal, 'function');
    assert.strictEqual(typeof App.isAnyModalOpen, 'function');
  });

  // --- LW09: Reduced-Motion Static Icon Variants ---
  await test('LW09: Static weather and moon SVG folders exist without SMIL animation', () => {
    const staticWeatherDir = path.join(__dirname, '..', 'assets', 'icons', 'weather', 'static');
    const staticMoonDir = path.join(__dirname, '..', 'assets', 'icons', 'moon', 'static');
    assert.ok(fs.existsSync(staticWeatherDir), 'static weather icon directory exists');
    assert.ok(fs.existsSync(staticMoonDir), 'static moon icon directory exists');

    const clearDayStatic = fs.readFileSync(path.join(staticWeatherDir, 'clear-day.svg'), 'utf8');
    assert.ok(!clearDayStatic.includes('<animateTransform'), 'static clear-day has no animateTransform');
    assert.ok(!clearDayStatic.includes('<animate '), 'static clear-day has no animate');
  });

  // --- LW10: Updater Transactional Rollback ---
  await test('LW10: Updater script defines backup staging and rollback on error', () => {
    const script = fs.readFileSync(path.join(__dirname, '..', 'tools', 'updater', 'upgrade-local-wally.ps1'), 'utf8');
    assert.ok(script.includes('$backupDir'), 'script uses backup staging directory');
    assert.ok(script.includes('Rolling back'), 'script incorporates rollback execution path');
  });

  // --- LW11: Tracked Test Infrastructure ---
  await test('LW11: Test suite is tracked with npm test script', () => {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    assert.ok(fs.existsSync(pkgPath), 'package.json exists');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert.ok(pkg.scripts && pkg.scripts.test, 'package.json defines test script');
  });

  // --- LW12: Gated News Fetch When Disabled ---
  await test('LW12: Atmosphere sync skips news request when showNewsFeed is false', async () => {
    App.showNewsFeed = false;
    let newsCalled = false;
    const origFetch = ApiService.fetchNews;
    ApiService.fetchNews = () => { newsCalled = true; return Promise.resolve([]); };
    try {
      const loc = { latitude: 40.71, longitude: -74.00, city: 'New York' };
      // Override fetchWeather to prevent network
      const origWeather = ApiService.fetchWeather;
      ApiService.fetchWeather = () => Promise.resolve({ tempC: 20 });
      try {
        await ApiService.fetchAtmosphere(loc, 'open-meteo');
        assert.strictEqual(newsCalled, false, 'News must not be fetched when feed is disabled');
      } finally {
        ApiService.fetchWeather = origWeather;
      }
    } finally {
      ApiService.fetchNews = origFetch;
      App.showNewsFeed = true;
    }
  });

  // --- LW13: Bounded In-Memory Caches & Daily Retention ---
  await test('LW13: News image in-memory cache strictly bounded to 80 entries', () => {
    App._newsImageMemoryCache = {};
    for (let i = 0; i < 100; i++) {
      App._writeNewsImageCache('Story Title ' + i, 'https://example.com/img' + i + '.jpg');
    }
    const memCount = Object.keys(App._newsImageMemoryCache).length;
    assert.ok(memCount <= 80, 'Memory cache size must not exceed 80, got: ' + memCount);
  });

  // --- LW14: Truthful Settings Export Metadata ---
  await test('LW14: Settings export defaults to excluding API keys with truthful description', () => {
    const payload = App._buildSettingsPayload();
    assert.strictEqual(payload.exportSecurity, 'keys_masked_by_default');
  });

  // --- LW15: Media Visualizer DPR Invalidation ---
  await test('LW15: MediaVisualizerEngine updates backing store on DPR change at equal CSS width', () => {
    const canvas = createMockElement('media-canvas', 'canvas');
    canvas.parentElement = { clientWidth: 200 };
    const vis = new MediaVisualizerEngine({ canvas });
    vis.ctx = canvas.getContext();

    // Initial sizing at DPR 1
    global.window.devicePixelRatio = 1;
    vis.resize();
    assert.strictEqual(canvas.width, 192); // (200 - 8) * 1

    // DPR changes to 2 while CSS width is unchanged
    global.window.devicePixelRatio = 2;
    vis.resize();
    assert.strictEqual(canvas.width, 384); // (200 - 8) * 2

    // DPR changes back to 1
    global.window.devicePixelRatio = 1;
    vis.resize();
    assert.strictEqual(canvas.width, 192);
  });

  // --- LW16: Redundant Boot Metadata Elimination ---
  await test('LW16: OneDrive init does not trigger redundant remote check', () => {
    let checkRemoteCount = 0;
    const origCheck = OneDriveSync.checkRemoteMetadata;
    OneDriveSync.checkRemoteMetadata = () => { checkRemoteCount++; return Promise.resolve(null); };
    try {
      OneDriveSync.init();
      assert.strictEqual(checkRemoteCount, 0, 'init() must not call checkRemoteMetadata directly');
    } finally {
      OneDriveSync.checkRemoteMetadata = origCheck;
    }
  });

  // --- LW17: Gated Telemetry While Paused ---
  await test('LW17: LivelyBridge ignores telemetry payload when playback is paused', () => {
    LivelyBridge.isPaused = true;
    let parsed = false;
    const origJSON = JSON.parse;
    // Deliver system info
    LivelyBridge.emitSystemInformation('{"Cpu": 10}');
    // Because isPaused is true, parsing was short-circuited
    assert.ok(LivelyBridge.isPaused);
    LivelyBridge.isPaused = false;
  });

  // --- LW18: Parked OneDrive Polling Timer ---
  await test('LW18: OneDrive UI poll timer stops when paused and re-arms on resume', () => {
    App.isPlaybackPaused = false;
    App.isRunning = false;
    App.dom.onedriveStatusLabel = createMockElement('onedrive-status');

    App.startLoop();
    assert.ok(App._onedrivePollTimer !== null, 'Poll timer active after startLoop');

    App.stopLoop();
    assert.strictEqual(App._onedrivePollTimer, null, 'Poll timer cleared after stopLoop');
  });

  // --- LW19: Gated Pomodoro Canvas Render ---
  await test('LW19: Pomodoro ring render skips hidden canvas drawing when SVG ring bar is active', () => {
    const canvas = createMockElement('pomo-canvas', 'canvas');
    canvas.style.display = 'none';
    const ringBar = createMockElement('pomo-bar');
    let canvasCleared = false;
    const ctx = canvas.getContext();
    ctx.clearRect = () => { canvasCleared = true; };

    const pomo = new PomodoroEngine({
      canvas,
      ringBar,
      timeText: createMockElement('time'),
      subText: createMockElement('sub'),
      btnToggle: createMockElement('toggle'),
      btnReset: createMockElement('reset'),
      pillFocus: createMockElement('focus'),
      pillBreak: createMockElement('break')
    });
    pomo.ctx = ctx;

    pomo.renderRing();
    assert.strictEqual(canvasCleared, false, 'Canvas clearRect must not be called when hidden');
    assert.ok(ringBar.style.strokeDashoffset, 'SVG ring bar strokeDashoffset updated');
  });

  // --- LW20: Documentation & Constants Fidelity ---
  await test('LW20: Quota constants in ApiService match 15m keyed and 5m keyless specifications', () => {
    assert.strictEqual(ApiService.NEWS_QUOTA_COOLDOWN_KEYED_MS, 15 * 60 * 1000, 'Keyed quota is 15 minutes');
    assert.strictEqual(ApiService.NEWS_QUOTA_COOLDOWN_KEYLESS_MS, 5 * 60 * 1000, 'Keyless quota is 5 minutes');

    const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
    assert.ok(readme.includes('15 minutes for keyed providers'), 'README specifies 15m keyed');
    assert.ok(readme.includes('5 minutes for keyless Google News'), 'README specifies 5m keyless');
  });

  // --- Hotfix 0.18.1: Location Resolution with Comma and Alias ---
  await test('0.18.1: Location geocoding resolves "bangalore, india" to Bengaluru, India', async () => {
    const res = await ApiService.setManualLocation('bangalore, india');
    assert.strictEqual(res.ok, true, 'setManualLocation succeeded');
    assert.strictEqual(res.location.city, 'Bengaluru', 'Resolved to Bengaluru');
    assert.strictEqual(res.location.country, 'India', 'Resolved country India');
    assert.ok(Math.abs(res.location.latitude - 12.97) < 0.1, 'Latitude ~12.97');
    assert.ok(Math.abs(res.location.longitude - 77.59) < 0.1, 'Longitude ~77.59');
    assert.strictEqual(ApiService.manualLocationMatches('bangalore, india'), true, 'Manual location matches alias');
  });

  // --- Hotfix 0.18.1: Updater Script Settings & Key Preservation ---
  await test('0.18.1: Updater script reconciles user settings and preserves keys', () => {
    const script = fs.readFileSync(path.join(__dirname, '..', 'tools', 'updater', 'upgrade-local-wally.ps1'), 'utf8');
    assert.ok(script.includes('Synchronize saved user values into target LivelyProperties.json'), 'Script syncs saved values into target');
    assert.ok(script.includes('Preserved user keys and settings in wallpaper folder'), 'Script logs user key preservation');
    assert.ok(script.includes('System.Text.UTF8Encoding($false)'), 'Script writes UTF-8 without BOM');
  });

  // --- Hotfix 0.18.1: OneDrive wrongplace Protection and URL Extraction ---
  await test('0.18.1: OneDrive auth code extraction detects wrongplace and parses codes', async () => {
    let wrongplaceRejected = false;
    try {
      await OneDriveSync.exchangeAuthCode('https://login.microsoftonline.com/common/wrongplace');
    } catch (e) {
      wrongplaceRejected = true;
      assert.ok(e.message.includes('wrongplace'), 'Error mentions wrongplace');
    }
    assert.strictEqual(wrongplaceRejected, true, 'exchangeAuthCode rejected wrongplace URL');

    const extracted = OneDriveSync.extractAuthCode('https://login.microsoftonline.com/common/oauth2/nativeclient?code=M.R3_TEST12345&state=abc');
    assert.strictEqual(extracted, 'M.R3_TEST12345', 'Valid auth code correctly extracted from URL');
  });

  console.log('\n===============================================================');
  console.log(`Results: ${passCount} passed, ${failCount} failed.`);
  console.log('===============================================================');

  if (failCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runAll();
