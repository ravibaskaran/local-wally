/**
 * ApiService - Network Ingestion & Weather Telemetry Normalizer
 * Integrates:
 *  1. Zero-config Geolocation (navigator.geolocation -> ipapi.co fallback)
 *  2. Open-Meteo Weather Forecast (Free, zero-key, high-precision)
 *  3. Open-Meteo Air Quality Index (European AQI, PM2.5, PM10)
 *  4. Contextual Unsplash Landscape Engine (with curated offline fallbacks)
 */
(function(global) {
  'use strict';

  // WMO Weather Interpretation Codes
  var WMO_MAP = {
    0:  { text: 'Clear Sky', category: 'CLEAR', icon: 'sun', keyword: 'sunny landscape nature' },
    1:  { text: 'Mainly Clear', category: 'CLEAR', icon: 'sun-cloud', keyword: 'clear blue sky landscape' },
    2:  { text: 'Partly Cloudy', category: 'PARTLY_CLOUDY', icon: 'cloud-sun', keyword: 'scenic clouds nature' },
    3:  { text: 'Overcast', category: 'OVERCAST', icon: 'cloud', keyword: 'overcast mood landscape forest' },
    45: { text: 'Foggy', category: 'FOG', icon: 'fog', keyword: 'misty fog forest mountain' },
    48: { text: 'Depositing Rime Fog', category: 'FOG', icon: 'fog', keyword: 'foggy misty landscape' },
    51: { text: 'Light Drizzle', category: 'DRIZZLE', icon: 'drizzle', keyword: 'light rain mist nature' },
    53: { text: 'Moderate Drizzle', category: 'DRIZZLE', icon: 'drizzle', keyword: 'rainy forest nature' },
    55: { text: 'Dense Drizzle', category: 'DRIZZLE', icon: 'drizzle', keyword: 'heavy drizzle landscape' },
    56: { text: 'Light Freezing Drizzle', category: 'DRIZZLE', icon: 'drizzle-snow', keyword: 'cold misty winter' },
    57: { text: 'Dense Freezing Drizzle', category: 'DRIZZLE', icon: 'drizzle-snow', keyword: 'freezing rain landscape' },
    61: { text: 'Slight Rain', category: 'RAIN', icon: 'rain', keyword: 'gentle rain nature woods' },
    63: { text: 'Moderate Rain', category: 'RAIN', icon: 'rain', keyword: 'rainy forest lake' },
    65: { text: 'Heavy Rain', category: 'RAIN', icon: 'rain-heavy', keyword: 'heavy rain mood nature' },
    66: { text: 'Light Freezing Rain', category: 'RAIN', icon: 'rain-snow', keyword: 'freezing rain cold nature' },
    67: { text: 'Heavy Freezing Rain', category: 'RAIN', icon: 'rain-snow', keyword: 'winter cold storm' },
    71: { text: 'Slight Snow Fall', category: 'SNOW', icon: 'snow', keyword: 'gentle snowfall winter mountains' },
    73: { text: 'Moderate Snow Fall', category: 'SNOW', icon: 'snow', keyword: 'snowy mountain winter landscape' },
    75: { text: 'Heavy Snow Fall', category: 'SNOW', icon: 'snow-heavy', keyword: 'blizzard winter pines' },
    77: { text: 'Snow Grains', category: 'SNOW', icon: 'snow', keyword: 'snow covered trees' },
    80: { text: 'Slight Rain Showers', category: 'RAIN', icon: 'rain-showers', keyword: 'rain showers countryside' },
    81: { text: 'Moderate Rain Showers', category: 'RAIN', icon: 'rain-showers', keyword: 'rainy green hills' },
    82: { text: 'Violent Rain Showers', category: 'RAIN', icon: 'rain-heavy', keyword: 'stormy rainfall landscape' },
    85: { text: 'Slight Snow Showers', category: 'SNOW', icon: 'snow', keyword: 'winter snow mountain' },
    86: { text: 'Heavy Snow Showers', category: 'SNOW', icon: 'snow-heavy', keyword: 'heavy snow winter peaks' },
    95: { text: 'Thunderstorm', category: 'THUNDERSTORM', icon: 'thunder', keyword: 'thunderstorm mountains dramatic' },
    96: { text: 'Thunderstorm with Slight Hail', category: 'THUNDERSTORM', icon: 'thunder-hail', keyword: 'dramatic lightning storm nature' },
    99: { text: 'Thunderstorm with Heavy Hail', category: 'THUNDERSTORM', icon: 'thunder-hail', keyword: 'dark storm nature lightning' }
  };

  // Curated high-res WebP landscape imagery for offline/demo/keyless operation
  var CURATED_LANDSCAPES = {
    CLEAR_DAY: [
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1920&q=80',
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1920&q=80',
      'https://images.unsplash.com/photo-1426604966848-d7adac402bff?auto=format&fit=crop&w=1920&q=80'
    ],
    CLEAR_NIGHT: [
      'https://images.unsplash.com/photo-1509773896068-7fd415d91e2e?auto=format&fit=crop&w=1920&q=80',
      'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80',
      'https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?auto=format&fit=crop&w=1920&q=80'
    ],
    RAIN: [
      'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1920&q=80',
      'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?auto=format&fit=crop&w=1920&q=80'
    ],
    SNOW: [
      'https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?auto=format&fit=crop&w=1920&q=80',
      'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=1920&q=80'
    ],
    OVERCAST: [
      'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?auto=format&fit=crop&w=1920&q=80',
      'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1920&q=80'
    ],
    THUNDERSTORM: [
      'https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?auto=format&fit=crop&w=1920&q=80',
      'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1920&q=80'
    ]
  };

  var ApiService = {
    weatherProvider: (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.weatherProvider) || 'open-meteo',
    openweathermapApiKey: (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.openweathermapApiKey) || '',
    aqiProvider: (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.aqiProvider) || 'open-meteo',
    waqiApiKey: (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.waqiApiKey) || '',
    wallpaperProvider: (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.wallpaperProvider) || 'unsplash',
    unsplashApiKey: (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.unsplashApiKey) || '',
    wallhavenApiKey: (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.wallhavenApiKey) || '',
    pexelsApiKey: (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.pexelsApiKey) || '',
    pixabayApiKey: (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.pixabayApiKey) || '',
    newsProvider: (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.newsProvider) || 'auto',
    newsApiKey: (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.newsApiKey) || '',
    currentsApiKey: (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.currentsApiKey) || '',

    /**
     * Detects native physical display dimensions
     * @returns {{width: number, height: number}}
     */
    getNativeResolution: function() {
      var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
      var screenW = (typeof window !== 'undefined' && window.screen && window.screen.width) ? window.screen.width : 1920;
      var screenH = (typeof window !== 'undefined' && window.screen && window.screen.height) ? window.screen.height : 1080;
      var width = Math.round(screenW * dpr) || 1920;
      var height = Math.round(screenH * dpr) || 1080;
      return { width: width, height: height };
    },

    /**
     * Formats an image URL with exact screen dimensions for 1:1 pixel screen fill
     * @param {string} rawUrl
     * @param {number} [width]
     * @param {number} [height]
     * @returns {string}
     */
    formatImageUrl: function(rawUrl, width, height) {
      if (!rawUrl) return '';
      if (!width || !height) {
        var res = this.getNativeResolution();
        width = res.width;
        height = res.height;
      }
      var base = rawUrl;
      var queryIdx = rawUrl.indexOf('?');
      if (queryIdx !== -1) {
        base = rawUrl.substring(0, queryIdx);
      }
      return base + '?auto=format&fit=crop&w=' + width + '&h=' + height + '&q=85';
    },

    // ---- Location cascade (v0.8.7) ------------------------------------------
    // Order: manual entry → persisted auto location (prompt-free, instant) →
    // silent auto-detection. HTML5 Geolocation is consulted ONLY when the
    // permission state is already 'granted' — a wallpaper never raises a
    // permission dialog; without a prior grant the silent IP lookup runs.

    _LOCATION_AUTO_STORE_KEY: 'LIVELY_HUD_LOCATION_AUTO',
    _LOCATION_MANUAL_CACHE_KEY: 'LIVELY_HUD_LOCATION_MANUAL',
    _GEODING_BASE: 'https://geocoding-api.open-meteo.com/v1/search',

    _locationChangedListeners: [],
    _locationBgRefreshInFlight: false,

    /**
     * Registers a callback for adopted location changes detected silently in
     * the background after boot painted a persisted location.
     */
    onLocationChanged: function(cb) {
      if (typeof cb === 'function' && this._locationChangedListeners.indexOf(cb) === -1) {
        this._locationChangedListeners.push(cb);
      }
    },

    offLocationChanged: function(cb) {
      var idx = this._locationChangedListeners.indexOf(cb);
      if (idx !== -1) {
        this._locationChangedListeners.splice(idx, 1);
      }
    },

    _notifyLocationChanged: function(loc) {
      for (var i = 0; i < this._locationChangedListeners.length; i++) {
        try {
          this._locationChangedListeners[i](loc);
        } catch (e) {
          console.error('[ApiService] Location change listener error:', e);
        }
      }
    },

    /**
     * Resolves geographical coordinates for the whole pipeline.
     * Cascade:
     *   1. Manual location (user entry via the diagnostic panel) — wins when
     *      set; geocoded once and cached, boots stay instant and offline-safe.
     *   2. Persisted auto location — instant paint, no detection, no prompts;
     *      a silent background re-detect adopts city changes via
     *      onLocationChanged listeners.
     *   3. Silent detection — HTML5 Geolocation only when its permission is
     *      already 'granted' (never prompts), then the keyless IP lookup
     *      (ipapi.co), then config.defaultLocation.
     * @returns {Promise<{latitude, longitude, city, region, country, countryCode, source}>}
     */
    getLocation: function() {
      var self = this; // used by the manual-fallback catch below

      var manual = this._readManualRecord();
      if (manual && manual.entry) {
        // A broken/offline manual entry never breaks the atmosphere pipeline:
        // fall back to silent automatic detection without persisting. A
        // SUPERSEDED resolution (a newer intent landed while this one ran)
        // gets one retry against the LATEST record instead — the stale boot
        // path must not jump to auto-detection while a newer manual intent
        // is in flight (v0.8.14).
        return this._resolveManual(manual).catch(function(manualErr) {
          var superseded = /superseded/i.test(String((manualErr && manualErr.message) || ''));
          if (superseded) {
            var latest = self._readManualRecord();
            if (latest && latest.entry) {
              return self._resolveManual(latest).catch(function() {
                return self._runLocationDetect(false);
              });
            }
          }
          console.warn('[ApiService] Manual location unavailable, falling back to automatic:', (manualErr && manualErr.message) || manualErr);
          return self._runLocationDetect(false);
        });
      }

      var persisted = this._readPersistedLocation();
      if (persisted && persisted.location) {
        this._scheduleBackgroundLocationRefresh(persisted);
        return Promise.resolve(persisted.location);
      }

      return this._runLocationDetect(true);
    },

    _runLocationDetect: function(persist) {
      var self = this;

      var finish = function(loc) {
        if (persist) {
          self._writePersistedLocation(loc);
        }
        return Promise.resolve(loc);
      };
      return new Promise(function(resolve) {
        var settled = false;
        var finishOnce = function(result) {
          if (settled) return;
          settled = true;
          finish(result).then(resolve, resolve);
        };

        function formatLocation(lat, lon, city, region, country, countryCode, source) {
          return self._formatLocation(lat, lon, city, region, country, countryCode, source);
        }

        // Helper: fetch with safety timeout to prevent hanging on dead networks
        function fetchJsonWithTimeout(url, timeoutMs) {
          return self._fetchJsonWithTimeout(url, timeoutMs);
        }

        // 1. HTML5 Geolocation — silently only when already granted (v0.8.7):
        //    navigator.permissions.query performs no prompt; any other state
        //    ('prompt', 'denied', unsupported API) skips GPS without asking.
        var gpsProbe = Promise.resolve(null);
        if (typeof navigator !== 'undefined' && navigator.geolocation && navigator.permissions &&
            typeof navigator.permissions.query === 'function') {
          gpsProbe = navigator.permissions.query({ name: 'geolocation' });
        }

        gpsProbe.then(function(status) {
          if (!status || status.state !== 'granted' || typeof navigator === 'undefined' || !navigator.geolocation) {
            fallbackToIp(finishOnce);
            return;
          }
          var geoTimeout = setTimeout(function() {
            if (!settled) {
              fallbackToIp(finishOnce);
            }
          }, 4000);

          try {
            navigator.geolocation.getCurrentPosition(
              function(pos) {
                clearTimeout(geoTimeout);
                if (pos && pos.coords) {
                  var gpsLat = pos.coords.latitude;
                  var gpsLon = pos.coords.longitude;

                  // Reverse lookup city/country via ipapi.co to enrich GPS coordinates
                  fetchJsonWithTimeout('https://ipapi.co/json/', 3000)
                    .then(function(data) {
                      finishOnce(formatLocation(
                        gpsLat,
                        gpsLon,
                        data.city || 'Local Area',
                        data.region || '',
                        data.country_name || data.country || '',
                        data.country_code || '',
                        'gps'
                      ));
                    })
                    .catch(function() {
                      finishOnce(formatLocation(gpsLat, gpsLon, 'Local Area', '', '', '', 'gps'));
                    });
                } else {
                  fallbackToIp(finishOnce);
                }
              },
              function(err) {
                clearTimeout(geoTimeout);
                // Silently fall back to IP locator
                fallbackToIp(finishOnce);
              },
              { timeout: 4000, maximumAge: 600000, enableHighAccuracy: false }
            );
          } catch (e) {
            clearTimeout(geoTimeout);
            fallbackToIp(finishOnce);
          }
        }, function() {
          fallbackToIp(finishOnce);
        });

        function fallbackToIp(cb) {
          fetchJsonWithTimeout('https://ipapi.co/json/', 3500)
            .then(function(data) {
              if (data && (typeof data.latitude === 'number' || !isNaN(parseFloat(data.latitude))) &&
                  (typeof data.longitude === 'number' || !isNaN(parseFloat(data.longitude)))) {
                cb(formatLocation(
                  data.latitude,
                  data.longitude,
                  (data.city && String(data.city).trim()) || '',
                  data.region || '',
                  data.country_name || data.country || '',
                  data.country_code || data.country || '',
                  'ip'
                ));
              } else {
                throw new Error('Invalid IP geo payload');
              }
            })
            .catch(function(err) {
              // Silently fallback to configured default location
              var defaultLoc = (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.defaultLocation) || {};
              var defLat = typeof defaultLoc.latitude === 'number' ? defaultLoc.latitude : 35.6762;
              var defLon = typeof defaultLoc.longitude === 'number' ? defaultLoc.longitude : 139.6503;
              var defCity = defaultLoc.city || 'Tokyo';
              var defCountry = defaultLoc.country || 'Japan';
              var defCountryCode = defaultLoc.countryCode || (defCity === 'Tokyo' ? 'JP' : '');
              cb(formatLocation(defLat, defLon, defCity, 'Local Region', defCountry, defCountryCode, 'default'));
            });
        }
      });
    },

    /**
     * Shared coordinate validity: finite numbers inside geographic ranges.
     * Zeros are legitimate (gulf of Guinea); 91/181/Infinity/NaN are not (R08).
     */
    _isValidCoordPair: function(lat, lon) {
      return typeof lat === 'number' && Number.isFinite(lat) &&
             typeof lon === 'number' && Number.isFinite(lon) &&
             lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    },

    /**
     * One consistent degraded-city predicate (R06): empty, placeholder, and
     * un-enriched labels never count as real locality names anywhere.
     */
    _isPlaceholderCity: function(name) {
      var s = (name == null) ? '' : String(name).trim();
      return !s || /^(local( (area|city))?|metropolitan|manual area)$/i.test(s);
    },

    /**
     * Silent background re-detect for boots that painted a persisted
     * location. Adopts only when CITY (or country) actually changed —
     * coordinate jitter never flips the user's town. Notifies
     * onLocationChanged listeners so the HUD re-syncs for the new place.
     */
    _scheduleBackgroundLocationRefresh: function(persisted) {
      var self = this;
      if (this._locationBgRefreshInFlight) return;
      this._locationBgRefreshInFlight = true;

      var done = function(loc) {
        self._locationBgRefreshInFlight = false;
        if (!loc) return;
        var prev = persisted.location;
        // Source-quality gate: only adopt candidates at least as trustworthy
        // as what the persisted record holds. Offline config-defaults and
        // un-enriched/degraded labels ('Local City'/'Local Area') never
        // overwrite a real persisted city (R06).
        var qualified = (loc.source === 'ip' || loc.source === 'gps') &&
          !self._isPlaceholderCity(loc.city);
        var changed =
          String(prev.city).toLowerCase() !== String(loc.city).toLowerCase() ||
          String(prev.countryCode || '').toUpperCase() !== String(loc.countryCode || '').toUpperCase();
        if (qualified && changed) {
          self._writePersistedLocation(loc);
          self._notifyLocationChanged(loc);
        }
      };

      Promise.resolve()
        .then(function() { return self._runLocationDetect(false); })
        .then(done, function() { self._locationBgRefreshInFlight = false; });
    },

    _readPersistedLocation: function() {
      try {
        var raw = global.localStorage && global.localStorage.getItem(this._LOCATION_AUTO_STORE_KEY);
        if (!raw) return null;
        var rec = JSON.parse(raw);
        if (!rec || !rec.location || !this._isValidCoordPair(rec.location.latitude, rec.location.longitude)) {
          return null;
        }
        return rec;
      } catch (e) {
        return null;
      }
    },

    _writePersistedLocation: function(loc) {
      try {
        global.localStorage && global.localStorage.setItem(
          this._LOCATION_AUTO_STORE_KEY,
          JSON.stringify({ location: loc, detectedAt: new Date().toISOString() })
        );
      } catch (e) {
        // Storage unavailable — detection stays ephemeral (rule: memory-first)
      }
    },

    /**
     * Reads the user's manual-location record, or null.
     * Record: { entry: {type:'name', name} | {type:'coords', latitude, longitude},
     *          resolved: {location object} | null }
     */
    _readManualRecord: function() {
      try {
        var raw = global.localStorage && global.localStorage.getItem(this._LOCATION_MANUAL_CACHE_KEY);
        if (raw) {
          var rec = JSON.parse(raw);
          if (rec && rec.entry) {
            // Self-heal against corrupt/hand-crafted records: reject entries
            // that lack the fields their type requires — or fall outside
            // geographic ranges — instead of feeding undefined into coordinate
            // math downstream (R08). Zeros remain legitimate coordinates.
            if (rec.entry.type === 'coords' &&
                this._isValidCoordPair(rec.entry.latitude, rec.entry.longitude)) {
              return this._sanitizeManualRecord(rec);
            }
            if (rec.entry.type === 'name' &&
                rec.entry.name && String(rec.entry.name).trim() && String(rec.entry.name).length <= 80) {
              return this._sanitizeManualRecord(rec);
            }
            console.warn('[ApiService] Discarding invalid manual location record');
            return null;
          }
        }
      } catch (e) {
        // fall through to memory-only record
      }
      return this._memoryManualRecord || null;
    },

    /**
     * Normalizes record internals at the trust boundary (R08/R05): resolved
     * location objects must carry in-range coordinates or they are dropped
     * (the entry survives and re-resolves); alias strings must be bounded.
     */
    _sanitizeManualRecord: function(rec) {
      if (rec.resolved) {
        if (!this._isValidCoordPair(rec.resolved.latitude, rec.resolved.longitude)) {
          rec.resolved = null;
        }
      }
      if (rec.entry && typeof rec.entry.alias === 'string' && rec.entry.alias.length > 80) {
        rec.entry.alias = '';
      }
      if (rec.entry && rec.entry.alias != null && typeof rec.entry.alias !== 'string') {
        rec.entry.alias = '';
      }
      return rec;
    },

    _writeManualRecord: function(rec) {
      try {
        if (global.localStorage) {
          global.localStorage.setItem(this._LOCATION_MANUAL_CACHE_KEY, JSON.stringify(rec));
          return;
        }
      } catch (e) {
        // Storage unavailable — fall through to the memory-only record
      }
      this._memoryManualRecord = rec;
    },

    // Manual-location intent generation (R02): every NEW user intent — typed
    // entry, suggestion pick, clear/Auto, Customize delivery — bumps this
    // counter. Asynchronous continuations capture it and become silent no-ops
    // when superseded: late geocodes can never restore an abandoned intent,
    // clear a newer valid result, or clobber storage/property mirrors.
    _manualIntentGeneration: 0,

    /**
     * Well-formedness guard (QA v0.8.17): lone UTF-16 surrogates (from
     * malformed paste/IME input) make encodeURIComponent THROW
     * "URIError: URI malformed" synchronously. Sanitize every user-entered
     * location string up front so the intent pipeline can only ever reject
     * through its promise contract, never throw into a property handler.
     */
    _toWellFormedSafe: function(input) {
      var s = String(input == null ? '' : input);
      try {
        if (typeof s.toWellFormed === 'function') return s.toWellFormed();
      } catch (e) {}
      try {
        return s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD');
      } catch (e2) {
        // No lookbehind support: drop unpaired surrogates outright.
        return s.replace(/[\uD800-\uDFFF]/g, '\uFFFD');
      }
    },

    /**
     * Sets the manual location override. Accepts either a city name
     * ("Bengaluru") or "lat, lon" coordinates. City entries are geocoded via
     * the keyless Open-Meteo geocoding API (CORS-open) and cached so boots
     * use them without any network. Every call is a fresh intent (R02); a
     * name that cannot resolve CLEARS the previous override so Auto takes
     * over honestly (R07). Returns a Promise of { ok:true, location },
     * { ok:false, error }, or { ok:false, superseded:true } for stale work.
     */
    setManualLocation: function(text, preResolved) {
      var self = this;
      var gen = ++this._manualIntentGeneration;
      var raw = this._toWellFormedSafe(text).trim();
      if (!raw) {
        var emptyErr = new Error('Location entry is empty');
        emptyErr.generation = gen;
        return Promise.reject(emptyErr);
      }

      // Coordinates first: "-12.9716, 77.5946"
      var coords = raw.match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
      if (coords) {
        var lat = parseFloat(coords[1]);
        var lon = parseFloat(coords[2]);
        if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
          var rangeErr = new Error('Coordinates out of range');
          rangeErr.generation = gen;
          return Promise.reject(rangeErr);
        }
        // Best-effort reverse geocode gives the pin a real city/country
        // (cached in the record). Without it, the record stays city-less and
        // the news chain slides to world news rather than guessing a region.
        return this._reverseGeocode(lat, lon)
          .catch(function() { return null; })
          .then(function(place) {
            if (gen !== self._manualIntentGeneration) {
              return { ok: false, superseded: true, generation: gen, error: 'Superseded by a newer location intent' };
            }
            var validPlace = place && self._isValidCoordPair(place.latitude, place.longitude);
            var rec = validPlace ? {
              entry: { type: 'coords', latitude: lat, longitude: lon },
              resolved: self._formatLocation(place.latitude, place.longitude, place.name, place.admin1 || '', place.country || '', place.country_code || '', 'manual')
            } : {
              entry: { type: 'coords', latitude: lat, longitude: lon },
              resolved: self._formatLocation(lat, lon, 'Manual Area', '', '', '', 'manual')
            };
            self._writeManualRecord(rec);
            return { ok: true, location: rec.resolved, generation: gen };
          });
      }

      if (raw.length > 80) {
        var longErr = new Error('Location name too long');
        longErr.generation = gen;
        return Promise.reject(longErr);
      }
      // A suggestion already carries its coordinates — skip the re-geocode
      // (and its re-ranking surprises): clicking "Bengaluru, India" must land
      // exactly on the row the user picked. Range-validated (v0.8.14); an
      // invalid pre-resolution falls through to the normal geocode path.
      if (preResolved && this._isValidCoordPair(preResolved.latitude, preResolved.longitude)) {
        var direct = {
          entry: { type: 'name', name: preResolved.name || raw, alias: raw },
          resolved: this._formatLocation(
            preResolved.latitude, preResolved.longitude,
            preResolved.name || raw, preResolved.admin1 || '',
            preResolved.country || '', preResolved.country_code || '', 'manual'
          )
        };
        this._writeManualRecord(direct);
        return Promise.resolve({ ok: true, location: direct.resolved, generation: gen });
      }
      return this._geocodeCity(raw, 1).then(function(list) {
        if (gen !== self._manualIntentGeneration) {
          return { ok: false, superseded: true, generation: gen, error: 'Superseded by a newer location intent' };
        }
        if (!list || !list.length) {
          // R07: the LATEST requested name cannot resolve — the previous
          // override is cleared and Auto takes over (generation-checked, so
          // an obsolete failure can never clear a newer valid result).
          self.clearManualLocation();
          return { ok: false, error: 'No matching place found — check spelling' };
        }
        var top = list[0];
        // Validate the geocoder result before it can become active
        // (v0.8.14): invalid remote coordinates fail like any unresolvable
        // latest name — override cleared, Auto takes over (R07).
        if (!self._isValidCoordPair(top.latitude, top.longitude)) {
          self.clearManualLocation();
          return { ok: false, error: 'Geocoder returned invalid coordinates — check spelling' };
        }
        var rec = {
          // Canonical name (geocoder spelling) + the user's submitted alias
          // both live on the record (R05): re-delivery of either short-circuits
          // without a second geocoder call.
          entry: { type: 'name', name: top.name || raw, alias: raw },
          resolved: self._formatLocation(
            top.latitude, top.longitude, top.name, top.admin1 || '',
            top.country || '', top.country_code || '', 'manual'
          )
        };
        self._writeManualRecord(rec);
        return { ok: true, location: rec.resolved, generation: gen };
      }).catch(function(err) {
        // Tag EVERY rejection with its generation (QA v0.8.17): the UI catch
        // handler must distinguish an OBSOLETE failure (network error from an
        // older intent) from the latest one — an untagged stale failure could
        // otherwise clear a newer location.
        if (err && typeof err.generation !== 'number') err.generation = gen;
        throw err;
      });
    },

    /**
     * Marks the start of a manual-location intent and returns the new
     * generation (v0.8.14). The Customize dispatcher calls this BEFORE its
     * identical-value short-circuit, so even a re-delivered value invalidates
     * pending older work — a pending B can never resolve after the user has
     * visibly returned to the saved location A.
     */
    beginManualIntent: function() {
      return ++this._manualIntentGeneration;
    },

    clearManualLocation: function() {
      // Clearing IS a fresh intent (R02): pending geocodes for the previous
      // manual entry become no-ops.
      this._manualIntentGeneration++;
      try {
        global.localStorage && global.localStorage.removeItem(this._LOCATION_MANUAL_CACHE_KEY);
      } catch (e) {
        // best effort
      }
      this._memoryManualRecord = null;
    },

    /**
     * True when the requested manual entry already matches the stored record
     * (v0.8.10): guards Customize-panel re-delivery and property round-trips
     * from re-geocoding an identical entry. Name entries compare
     * case-insensitively; coordinate entries compare within ~5 km (0.05°) so
     * re-typing coordinates at different precision still matches.
     */
    manualLocationMatches: function(text) {
      var rec = this._readManualRecord();
      if (!text || typeof text !== 'string' || !rec || !rec.entry) return false;
      var t = text.trim().toLowerCase();
      if (rec.entry.type === 'name') {
        // The user may re-deliver the canonical geocoded name (Bengaluru),
        // the alias they typed (Bangalore), or the resolved city label —
        // all three match (R05).
        var candidates = [];
        if (rec.entry.name) candidates.push(String(rec.entry.name));
        if (rec.entry.alias) candidates.push(String(rec.entry.alias));
        if (rec.resolved && rec.resolved.city) candidates.push(String(rec.resolved.city));
        for (var i = 0; i < candidates.length; i++) {
          if (candidates[i].trim().toLowerCase() === t) return true;
        }
        return false;
      }
      if (rec.entry.type === 'coords') {
        var m = /^(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(text.trim());
        if (m) {
          return Math.abs(parseFloat(m[1]) - rec.entry.latitude) < 0.05 &&
                 Math.abs(parseFloat(m[2]) - rec.entry.longitude) < 0.05;
        }
        return false;
      }
      return false;
    },

    /**
     * Resolves the stored manual record (used on boot). Falls back to auto
     * detection when geocoding fails at boot time.
     */
    _resolveManual: function(rec) {
      var self = this;
      var gen = this._manualIntentGeneration;
      if (rec.entry.type === 'coords') {
        // Reuse the saved, validated enrichment (reverse-geocoded city/country)
        // when it matches the pin's own geometry; never re-invent it, and
        // never fabricate a country for an unenriched pin (R03).
        if (rec.resolved &&
            this._isValidCoordPair(rec.resolved.latitude, rec.resolved.longitude) &&
            Math.abs(rec.resolved.latitude - rec.entry.latitude) < 1e-6 &&
            Math.abs(rec.resolved.longitude - rec.entry.longitude) < 1e-6) {
          return Promise.resolve(rec.resolved);
        }
        return Promise.resolve(this._formatLocation(
          rec.entry.latitude, rec.entry.longitude, 'Manual Area', '', '', '', 'manual'
        ));
      }
      if (rec.resolved &&
          typeof rec.resolved.latitude === 'number' && typeof rec.resolved.longitude === 'number') {
        return Promise.resolve(rec.resolved);
      }
      // Cache miss (first boot after import without resolved payload): re-geocode once.
      return this._geocodeCity(rec.entry.name, 1).then(function(list) {
        // A newer user intent (typed entry, clear, property delivery) during
        // the boot re-geocode invalidates this write (R02).
        if (gen !== self._manualIntentGeneration) {
          throw new Error('Manual resolution superseded');
        }
        if (!list || !list.length) {
          throw new Error('No matching place for "' + rec.entry.name + '"');
        }
        var top = list[0];
        // Validate the geocoder result before it can be trusted (v0.8.14):
        // out-of-range or non-finite coordinates are treated as unresolvable.
        if (!self._isValidCoordPair(top.latitude, top.longitude)) {
          throw new Error('Geocoder returned invalid coordinates for "' + rec.entry.name + '"');
        }
        var resolved = self._formatLocation(
          top.latitude, top.longitude, top.name, top.admin1 || '',
          top.country || '', top.country_code || '', 'manual'
        );
        self._writeManualRecord({ entry: rec.entry, resolved: resolved });
        return resolved;
      });
    },

    _REVERSE_GEO_BASE: 'https://api.bigdatacloud.net/data/reverse-geocode-client',

    /**
     * Keyless reverse geocode (BigDataCloud client API, CORS-open) so a
     * coordinates pin resolves to a real city/country once and stays cached.
     * Best-effort: callers degrade to the honest 'Manual Area' record.
     */
    _reverseGeocode: function(lat, lon) {
      var url = this._REVERSE_GEO_BASE + '?latitude=' + encodeURIComponent(lat) +
        '&longitude=' + encodeURIComponent(lon) + '&localityLanguage=en';
      return this._fetchJsonWithTimeout(url, 5000).then(function(data) {
        if (!data || (!data.city && !data.locality && !data.principalSubdivision)) {
          throw new Error('No reverse-geocode result');
        }
        return {
          latitude: lat,
          longitude: lon,
          name: data.city || data.locality || data.principalSubdivision,
          admin1: data.principalSubdivision || '',
          country: data.countryName || '',
          country_code: data.countryCode || ''
        };
      });
    },

    /**
     * Keyless autocomplete geocoding (Open-Meteo). Used by the manual-input
     * suggestions dropdown (min threshold applied by the caller) and by
     * setManualLocation. Returns [{latitude, longitude, name, admin1,
     * country, country_code}].
     */
    _geocodeCity: function(name, count) {
      var safeName = this._toWellFormedSafe ? this._toWellFormedSafe(name) : String(name || '');
      var url = this._GEODING_BASE + '?name=' + encodeURIComponent(safeName) +
        '&count=' + (count || 6) + '&language=en&format=json';
      return this._fetchJsonWithTimeout(url, 5000).then(function(data) {
        var out = [];
        var results = (data && data.results) || [];
        for (var i = 0; i < results.length && out.length < (count || 6); i++) {
          var r = results[i];
          if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number' || !r.name) continue;
          out.push({
            latitude: r.latitude,
            longitude: r.longitude,
            name: String(r.name),
            admin1: r.admin1 ? String(r.admin1) : '',
            country: r.country ? String(r.country) : '',
            country_code: r.country_code ? String(r.country_code) : ''
          });
        }
        return out;
      });
    },

    _formatLocation: function(lat, lon, city, region, country, countryCode, source) {
      var defaultLoc = (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.defaultLocation) || {};
      var defLat = typeof defaultLoc.latitude === 'number' ? defaultLoc.latitude : 35.6762;
      var defLon = typeof defaultLoc.longitude === 'number' ? defaultLoc.longitude : 139.6503;
      var defCity = defaultLoc.city || 'Tokyo';
      var defCountry = defaultLoc.country || 'Japan';

      var numLat = parseFloat(lat);
      var numLon = parseFloat(lon);

      if (isNaN(numLat) || isNaN(numLon)) {
        numLat = defLat;
        numLon = defLon;
        city = city || defCity;
        country = country || defCountry;
        countryCode = countryCode || (city === 'Tokyo' ? 'JP' : '');
      }
      return {
        latitude: Math.round(numLat * 10000) / 10000,
        longitude: Math.round(numLon * 10000) / 10000,
        city: (city && String(city).trim()) || 'Local Area',
        region: (region && String(region).trim()) || '',
        country: (country && String(country).trim()) || '',
        countryCode: (countryCode && String(countryCode).trim().toUpperCase()) || '',
        source: source || 'unknown'
      };
    },

    /**
     * Fetch helper with safety timeout to prevent hanging on dead networks.
     */
    _fetchJsonWithTimeout: function(url, timeoutMs) {
      return ApiService.fetchWithTimeout(url, timeoutMs || 3500, { cache: 'no-store' })
        .then(function(res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        });
    },

    /**
     * Interprets WMO weather code into semantic metadata
     */
    interpretWmoCode: function(code) {
      if (WMO_MAP[code]) {
        return WMO_MAP[code];
      }
      return {
        text: 'Moderate Weather',
        category: 'PARTLY_CLOUDY',
        icon: 'cloud-sun',
        keyword: 'nature mountain landscape'
      };
    },

    /**
     * Interprets European AQI index into rating & hex color
     */
    /**
     * Interprets European AQI index into rating & hex color.
     * Non-finite or missing AQI strictly returns unavailable state (never fabricated ratings).
     */
    interpretEuropeanAqi: function(val) {
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        return { value: null, category: 'Unavailable', color: '#94a3b8', available: false };
      }
      if (val <= 20) return { value: Math.round(val), category: 'Good', color: '#10b981', available: true };
      if (val <= 40) return { value: Math.round(val), category: 'Fair', color: '#3b82f6', available: true };
      if (val <= 60) return { value: Math.round(val), category: 'Moderate', color: '#f59e0b', available: true };
      if (val <= 80) return { value: Math.round(val), category: 'Poor', color: '#ef4444', available: true };
      return { value: Math.round(val), category: 'Very Poor', color: '#8b5cf6', available: true };
    },

    /**
     * Strips query strings from URLs to prevent API keys or tokens from leaking in error messages and logs.
     */
    sanitizeUrl: function(rawUrl) {
      if (typeof rawUrl !== 'string') return '';
      var qIdx = rawUrl.indexOf('?');
      if (qIdx === -1) return rawUrl;
      return rawUrl.substring(0, qIdx) + '?[redacted]';
    },

    /**
     * Resilient fetch helper with timeout guard.
     * Ensures the timeout deadline covers body consumption (json/text/blob),
     * aborts the underlying network request via AbortController on timeout,
     * and honors caller-provided AbortSignal options.
     */
    fetchWithTimeout: function(url, timeoutMs, options) {
      var self = this;
      var safeUrl = (this && typeof this.sanitizeUrl === 'function')
        ? this.sanitizeUrl(url)
        : (function(u) { var q = (u || '').indexOf('?'); return q === -1 ? u : u.substring(0, q) + '?[redacted]'; })(url);

      return new Promise(function(resolve, reject) {
        options = options || {};
        // Reject non-numeric/invalid timeout values instead of feeding NaN to
        // setTimeout (LW18): {} or undefined falls back to the 5s default.
        var timeout = (typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0)
          ? timeoutMs
          : 5000;
        var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var timedOut = false;
        var headersResolved = false;

        var onCallerAbort = function() {
          if (controller) {
            try { controller.abort(); } catch (e) {}
          }
        };

        var cleanupSignal = function() {
          if (options.signal && typeof options.signal.removeEventListener === 'function') {
            options.signal.removeEventListener('abort', onCallerAbort);
          }
        };

        var timer = setTimeout(function() {
          timedOut = true;
          cleanupSignal();
          if (controller) {
            try { controller.abort(); } catch (e) {}
          }
          if (!headersResolved) {
            reject(new Error('Network request timed out: ' + safeUrl));
          }
        }, timeout);

        var fetchOptions = {};
        for (var key in options) {
          if (Object.prototype.hasOwnProperty.call(options, key)) {
            fetchOptions[key] = options[key];
          }
        }

        if (controller) {
          fetchOptions.signal = controller.signal;
          if (options.signal) {
            if (options.signal.aborted) {
              try { controller.abort(); } catch (e) {}
            } else if (typeof options.signal.addEventListener === 'function') {
              options.signal.addEventListener('abort', onCallerAbort);
            }
          }
        }

        fetch(url, fetchOptions)
          .then(function(res) {
            headersResolved = true;
            if (timedOut) {
              clearTimeout(timer);
              cleanupSignal();
              reject(new Error('Network request timed out: ' + safeUrl));
              return;
            }

            // Wrap body consumption methods so the deadline covers full stream read
            var wrapBodyMethod = function(methodName) {
              if (typeof res[methodName] === 'function') {
                var origMethod = res[methodName].bind(res);
                res[methodName] = function() {
                  if (timedOut) {
                    clearTimeout(timer);
                    cleanupSignal();
                    return Promise.reject(new Error('Network request timed out: ' + safeUrl));
                  }
                  return origMethod()
                    .then(function(data) {
                      clearTimeout(timer);
                      cleanupSignal();
                      return data;
                    })
                    .catch(function(err) {
                      clearTimeout(timer);
                      cleanupSignal();
                      if (timedOut) {
                        throw new Error('Network request timed out: ' + safeUrl);
                      }
                      throw err;
                    });
                };
              }
            };

            wrapBodyMethod('json');
            wrapBodyMethod('text');
            wrapBodyMethod('blob');
            wrapBodyMethod('arrayBuffer');

            resolve(res);
          })
          .catch(function(err) {
            clearTimeout(timer);
            cleanupSignal();
            if (timedOut) {
              reject(new Error('Network request timed out: ' + safeUrl));
            } else {
              reject(err);
            }
          });
      });
    },

    /**
     * Map OpenWeatherMap Condition ID to WMO Code
     */
    owmToWmo: function(id) {
      id = (typeof id === 'number' && Number.isFinite(id)) ? id : parseInt(id, 10);
      if (id >= 200 && id < 300) return 95;
      if (id >= 300 && id < 400) return 53;
      if (id === 500) return 61;
      if (id === 501) return 63;
      if (id >= 502 && id <= 504) return 65;
      if (id === 511) return 66;
      if (id >= 520 && id < 600) return 80;
      if (id === 600) return 71;
      if (id === 601) return 73;
      if (id >= 602 && id <= 622) return 75;
      if (id >= 700 && id < 800) return 45;
      if (id === 800) return 0;
      if (id === 801) return 1;
      if (id === 802) return 2;
      if (id >= 803) return 3;
      return 2;
    },

    /**
     * Map Yr.no / MET Norway symbol_code to WMO Code
     */
    metSymbolToWmo: function(sym) {
      if (!sym) return 2;
      var s = String(sym).toLowerCase();
      if (s.indexOf('thunder') !== -1) return 95;
      if (s.indexOf('snow') !== -1) {
        if (s.indexOf('heavy') !== -1) return 75;
        if (s.indexOf('light') !== -1) return 71;
        return 73;
      }
      if (s.indexOf('sleet') !== -1) return 66;
      if (s.indexOf('rain') !== -1) {
        if (s.indexOf('heavy') !== -1) return 65;
        if (s.indexOf('light') !== -1) return 61;
        if (s.indexOf('showers') !== -1) return 80;
        return 63;
      }
      if (s.indexOf('fog') !== -1) return 45;
      if (s.indexOf('cloudy') !== -1) {
        if (s.indexOf('partly') !== -1) return 2;
        return 3;
      }
      if (s.indexOf('fair') !== -1) return 1;
      if (s.indexOf('clearsky') !== -1) return 0;
      return 2;
    },

    /**
     * Generates a clean, realistic 8-point interpolated diurnal forecast across the next 24 hours.
     * Guarantees the multi-tab SVG chart always has smooth valid vectors regardless of provider outages.
     */
    generateSyntheticForecast: function(weather, aqi) {
      var pts = [];
      var baseHour = new Date().getHours();
      var baseTemp = (weather && typeof weather.tempC === 'number') ? weather.tempC : 20.0;
      var baseHum = (weather && typeof weather.humidity === 'number') ? weather.humidity : 55;
      var baseWind = (weather && typeof weather.windSpeedKm === 'number') ? weather.windSpeedKm : 10.0;
      var basePrecip = (weather && typeof weather.precipitationMm === 'number') ? weather.precipitationMm : 0.0;
      var hasValidAqi = (aqi && aqi.available !== false && typeof aqi.europeanAqi === 'number' && Number.isFinite(aqi.europeanAqi));
      var baseAqi = hasValidAqi ? aqi.europeanAqi : null;
      var cond = (weather && weather.conditionText) || 'Partly Cloudy';

      for (var i = 0; i < 8; i++) {
        var h = (baseHour + i * 3) % 24;
        var lbl = (i === 0) ? 'Now' : ((h % 12 || 12) + (h >= 12 ? ' PM' : ' AM'));
        var offset = Math.sin((h - 8) / 24 * Math.PI * 2) * 3.2;
        var tC = Math.round((baseTemp + offset) * 10) / 10;
        var tF = Math.round(((tC * 9 / 5) + 32) * 10) / 10;
        var windK = Math.round((baseWind + Math.cos(i) * 2.0) * 10) / 10;
        var aqiVal = hasValidAqi ? Math.max(5, Math.min(100, Math.round(baseAqi + Math.sin(i) * 4))) : null;
        var aqiMeta = this.interpretEuropeanAqi(aqiVal);

        pts.push({
          time: (h < 10 ? '0' : '') + h + ':00',
          label: lbl,
          hour: h,
          tempC: tC,
          tempF: tF,
          apparentC: Math.round((tC - 0.5) * 10) / 10,
          apparentF: Math.round((((tC - 0.5) * 9 / 5) + 32) * 10) / 10,
          precipProb: Math.round(Math.max(0, (basePrecip > 0 ? 60 : 10) + Math.sin(i) * 10)),
          precipMm: Math.round(basePrecip * 10) / 10,
          windSpeedKm: windK,
          windSpeedMph: Math.round(windK * 0.621371 * 10) / 10,
          humidity: Math.round(Math.max(20, Math.min(95, baseHum - offset * 2))),
          aqi: aqiMeta.value,
          aqiColor: aqiMeta.color,
          aqiCategory: aqiMeta.category,
          conditionText: cond
        });
      }
      return pts;
    },

    /**
     * Normalizes hourly series points and binds European AQI telemetry.
     * Safely validates and sanitizes all numerical forecast metrics against
     * non-finite values (NaN, Infinity, -Infinity, null, undefined) while
     * strictly preserving legitimate zero and negative numbers.
     */
    normalizeForecastPoints: function(points, weather, aqi, hourlyAqi) {
      if (!points || !points.length) {
        return [];
      }

      function parseNum(val) {
        if (typeof val === 'number' && Number.isFinite(val)) {
          return val;
        }
        if (typeof val === 'string' && val.trim() !== '') {
          var num = Number(val);
          if (Number.isFinite(num)) return num;
        }
        return null;
      }

      var hasValidAqi = (aqi && aqi.available !== false && typeof aqi.europeanAqi === 'number' && Number.isFinite(aqi.europeanAqi));
      var baseAqi = hasValidAqi ? aqi.europeanAqi : null;

      for (var i = 0; i < points.length; i++) {
        var pt = points[i];
        if (!pt) continue;

        // Preserve actual values; missing remains null
        var tC = parseNum(pt.tempC != null ? pt.tempC : pt.temperature_2m);
        pt.tempC = tC;
        pt.tempF = (tC != null) ? Math.round(((tC * 9 / 5) + 32) * 10) / 10 : null;

        var appC = parseNum(pt.apparentC != null ? pt.apparentC : pt.apparent_temperature);
        pt.apparentC = appC;
        pt.apparentF = (appC != null) ? Math.round(((appC * 9 / 5) + 32) * 10) / 10 : null;

        var pProb = parseNum(pt.precipProb != null ? pt.precipProb : pt.precipitation_probability);
        pt.precipProb = (pProb != null) ? Math.max(0, Math.min(100, Math.round(pProb))) : null;

        var pMm = parseNum(pt.precipMm != null ? pt.precipMm : pt.precipitation);
        pt.precipMm = (pMm != null && pMm >= 0) ? Math.round(pMm * 10) / 10 : null;

        var wKm = parseNum(pt.windSpeedKm != null ? pt.windSpeedKm : pt.wind_speed_10m);
        pt.windSpeedKm = (wKm != null && wKm >= 0) ? Math.round(wKm * 10) / 10 : null;
        pt.windSpeedMph = (pt.windSpeedKm != null) ? Math.round(pt.windSpeedKm * 0.621371 * 10) / 10 : null;

        var hum = parseNum(pt.humidity != null ? pt.humidity : pt.relative_humidity_2m);
        pt.humidity = (hum != null) ? Math.max(0, Math.min(100, Math.round(hum))) : null;

        // Bind & sanitize AQI (never invent fallback 22 or Good)
        var ptAqiVal = baseAqi;
        if (hourlyAqi) {
          if (Array.isArray(hourlyAqi)) {
            if (hourlyAqi.length >= points.length) {
              var aqiStep = Math.floor(hourlyAqi.length / points.length);
              var aqiIdx = Math.min(i * aqiStep, hourlyAqi.length - 1);
              if (hourlyAqi[aqiIdx] != null && Number.isFinite(hourlyAqi[aqiIdx])) ptAqiVal = hourlyAqi[aqiIdx];
            } else if (hourlyAqi[i] != null && Number.isFinite(hourlyAqi[i])) {
              ptAqiVal = hourlyAqi[i];
            }
          } else if (hourlyAqi.values && Array.isArray(hourlyAqi.values)) {
            var valArr = hourlyAqi.values;
            var matched = false;
            // Align by validated absolute instants, never chart indices (LW08/LW10):
            // unixtime seconds on either side convert to ms; offset-bearing ISO
            // strings parse absolutely. Legacy zoneless string matching is kept
            // as a fallback for old cached payloads.
            var ptTsMs = (typeof pt.timestamp === 'number' && Number.isFinite(pt.timestamp)) ? pt.timestamp : null;
            if (hourlyAqi.times && Array.isArray(hourlyAqi.times)) {
              for (var t = 0; t < hourlyAqi.times.length; t++) {
                var aqiInstant = ApiService.toEpochMs(hourlyAqi.times[t]);
                if (aqiInstant != null && ptTsMs != null) {
                  if (Math.abs(aqiInstant - ptTsMs) < 1800000) {
                    if (valArr[t] != null && Number.isFinite(valArr[t])) {
                      ptAqiVal = valArr[t];
                      matched = true;
                      break;
                    }
                  }
                } else if (pt.isoTime && (hourlyAqi.times[t] === pt.isoTime || (hourlyAqi.times[t] && hourlyAqi.times[t].indexOf && pt.isoTime && hourlyAqi.times[t].indexOf(pt.isoTime.substring(0, 13)) === 0))) {
                  if (valArr[t] != null && Number.isFinite(valArr[t])) {
                    ptAqiVal = valArr[t];
                    matched = true;
                    break;
                  }
                }
              }
            }
            if (!matched) {
              var aqiStep2 = Math.floor(valArr.length / points.length);
              var aqiIdx2 = Math.min(i * aqiStep2, valArr.length - 1);
              if (valArr[aqiIdx2] != null && Number.isFinite(valArr[aqiIdx2])) ptAqiVal = valArr[aqiIdx2];
            }
          }
        }
        var meta = (typeof ptAqiVal === 'number' && Number.isFinite(ptAqiVal))
          ? this.interpretEuropeanAqi(Math.max(0, ptAqiVal))
          : { value: null, category: 'Unavailable', color: '#94a3b8', available: false };
        pt.aqi = meta.value;
        pt.aqiColor = meta.color;
        pt.aqiCategory = meta.category;
      }
      return points;
    },

    /**
     * Multi-Provider Weather Adapters
     */
    /**
     * Converts an Open-Meteo time field (unixtime seconds OR ISO string) to an
     * absolute epoch-ms instant. Zoneless ISO strings resolve via the request's
     * fixed utc_offset_seconds; offset-bearing strings parse natively (LW10).
     */
    toEpochMs: function(v, fixedOffsetMs) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        return (v > 1e12) ? v : v * 1000;
      }
      if (typeof v === 'string' && v) {
        var s = v.trim();
        if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(s)) {
          var abs = Date.parse(s);
          if (Number.isFinite(abs)) return abs;
          return null;
        }
        if (typeof fixedOffsetMs === 'number' && Number.isFinite(fixedOffsetMs)) {
          var isoM = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s);
          if (isoM) return Date.UTC(+isoM[1], +isoM[2] - 1, +isoM[3], +isoM[4], +isoM[5]) - fixedOffsetMs;
        }
      }
      return null;
    },

    /**
     * Formats the wall-clock hour (0-23) of an absolute instant in the given
     * IANA timezone — DST-aware presentation (LW10). One cached Intl formatter
     * per timezone. Falls back to host-local hour when tz is unusable.
     */
    formatTzHour: function(tz, epochMs) {
      if (Number.isFinite(epochMs) && tz) {
        try {
          if (!this._tzHourFormatters) this._tzHourFormatters = {};
          if (!this._tzHourFormatters[tz]) {
            this._tzHourFormatters[tz] = new Intl.DateTimeFormat('en-US', {
              timeZone: tz,
              hour: '2-digit',
              hour12: false
            });
          }
          var parsed = parseInt(this._tzHourFormatters[tz].format(new Date(epochMs)), 10);
          if (Number.isFinite(parsed)) return (parsed === 24) ? 0 : parsed;
        } catch (e) { /* fall through to host-local */ }
      }
      var d = new Date(epochMs);
      return isNaN(d.getTime()) ? null : d.getHours();
    },

    WeatherAdapter: {
      normalizeOpenMeteo: function(data) {
        var current = data.current || {};
        var daily = data.daily || {};
        var hourly = data.hourly || {};
        var wmo = current.weather_code != null ? current.weather_code : 0;
        var wmoMeta = ApiService.interpretWmoCode(wmo);

        var tempC = current.temperature_2m != null ? current.temperature_2m : 20.0;
        var apparentC = current.apparent_temperature != null ? current.apparent_temperature : tempC;
        var tempMaxC = (daily.temperature_2m_max && daily.temperature_2m_max[0] != null) ? daily.temperature_2m_max[0] : (tempC + 3);
        var tempMinC = (daily.temperature_2m_min && daily.temperature_2m_min[0] != null) ? daily.temperature_2m_min[0] : (tempC - 4);

        var weather = {
          tempC: Math.round(tempC * 10) / 10,
          tempF: Math.round(((tempC * 9 / 5) + 32) * 10) / 10,
          apparentC: Math.round(apparentC * 10) / 10,
          apparentF: Math.round(((apparentC * 9 / 5) + 32) * 10) / 10,
          tempMaxC: Math.round(tempMaxC * 10) / 10,
          tempMinC: Math.round(tempMinC * 10) / 10,
          tempMaxF: Math.round(((tempMaxC * 9 / 5) + 32) * 10) / 10,
          tempMinF: Math.round(((tempMinC * 9 / 5) + 32) * 10) / 10,
          wmoCode: wmo,
          conditionText: wmoMeta.text,
          category: wmoMeta.category,
          icon: wmoMeta.icon,
          keyword: wmoMeta.keyword,
          humidity: current.relative_humidity_2m != null ? current.relative_humidity_2m : 55,
          windSpeedKm: current.wind_speed_10m != null ? Math.round(current.wind_speed_10m * 10) / 10 : 10.0,
          windSpeedMph: current.wind_speed_10m != null ? Math.round((current.wind_speed_10m * 0.621371) * 10) / 10 : 6.2,
          precipitationMm: current.precipitation != null ? current.precipitation : 0.0,
          isDay: current.is_day != null ? current.is_day : 1,
          timezone: data.timezone || null
        };

        var locTz = data.timezone || null;
        var locOffsetMs = (typeof data.utc_offset_seconds === 'number') ? data.utc_offset_seconds * 1000 : null;
        var timeArr = hourly.time || [];
        var count = Math.min(24, timeArr.length);

        // Resolve any entry (unixtime seconds or ISO string) to an absolute
        // instant; old cached ISO payloads keep the v0.8.2 offset-aware path (LW10).
        function resolveInstant(tVal) {
          return ApiService.toEpochMs(tVal, locOffsetMs);
        }

        // DST-aware wall-clock hour for an instant in the location timezone
        function hourFor(tVal, ts) {
          if (ts != null && locTz) return ApiService.formatTzHour(locTz, ts);
          if (typeof tVal === 'string') {
            var hm = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(tVal);
            if (hm) return +hm[4]; // naive string IS location wall clock
          }
          if (ts != null) {
            if (locOffsetMs != null) {
              return new Date(ts + locOffsetMs).getUTCHours();
            }
            var d = new Date(ts);
            return isNaN(d.getTime()) ? null : d.getHours();
          }
          return null;
        }

        function buildPoint(tVal, ts, arrIdx, hour, isFirst) {
          var h = hour;
          var lbl = (isFirst) ? 'Now' : ((h % 12 || 12) + (h >= 12 ? ' PM' : ' AM'));
          var ptTempC = (hourly.temperature_2m && hourly.temperature_2m[arrIdx] != null && Number.isFinite(hourly.temperature_2m[arrIdx])) ? hourly.temperature_2m[arrIdx] : null;
          var ptAppC = (hourly.apparent_temperature && hourly.apparent_temperature[arrIdx] != null && Number.isFinite(hourly.apparent_temperature[arrIdx])) ? hourly.apparent_temperature[arrIdx] : null;
          var ptPrecipProb = (hourly.precipitation_probability && hourly.precipitation_probability[arrIdx] != null && Number.isFinite(hourly.precipitation_probability[arrIdx])) ? hourly.precipitation_probability[arrIdx] : null;
          var ptPrecipMm = (hourly.precipitation && hourly.precipitation[arrIdx] != null && Number.isFinite(hourly.precipitation[arrIdx])) ? hourly.precipitation[arrIdx] : null;
          var ptWindKm = (hourly.wind_speed_10m && hourly.wind_speed_10m[arrIdx] != null && Number.isFinite(hourly.wind_speed_10m[arrIdx])) ? hourly.wind_speed_10m[arrIdx] : null;
          var ptHum = (hourly.relative_humidity_2m && hourly.relative_humidity_2m[arrIdx] != null && Number.isFinite(hourly.relative_humidity_2m[arrIdx])) ? hourly.relative_humidity_2m[arrIdx] : null;
          var ptWmo = (hourly.weather_code && hourly.weather_code[arrIdx] != null && Number.isFinite(hourly.weather_code[arrIdx])) ? hourly.weather_code[arrIdx] : wmo;

          return {
            time: (h < 10 ? '0' : '') + h + ':00',
            isoTime: (ts != null) ? new Date(ts).toISOString() : tStr0(tVal),
            timestamp: ts,
            label: lbl,
            hour: h,
            tempC: (ptTempC != null) ? Math.round(ptTempC * 10) / 10 : null,
            tempF: (ptTempC != null) ? Math.round(((ptTempC * 9 / 5) + 32) * 10) / 10 : null,
            apparentC: (ptAppC != null) ? Math.round(ptAppC * 10) / 10 : null,
            apparentF: (ptAppC != null) ? Math.round(((ptAppC * 9 / 5) + 32) * 10) / 10 : null,
            precipProb: (ptPrecipProb != null) ? Math.max(0, Math.min(100, Math.round(ptPrecipProb))) : null,
            precipMm: (ptPrecipMm != null) ? Math.round(ptPrecipMm * 10) / 10 : null,
            windSpeedKm: (ptWindKm != null) ? Math.round(ptWindKm * 10) / 10 : null,
            windSpeedMph: (ptWindKm != null) ? Math.round((ptWindKm * 0.621371) * 10) / 10 : null,
            humidity: (ptHum != null) ? Math.max(0, Math.min(100, Math.round(ptHum))) : null,
            aqi: null,
            aqiColor: '#94a3b8',
            aqiCategory: 'Unavailable',
            conditionText: ApiService.interpretWmoCode(ptWmo).text
          };
        }

        function tStr0(tVal) {
          return (typeof tVal === 'string') ? tVal : null;
        }

        // Full-resolution analytics series: every available hourly measurement
        // with an absolute timestamp (LW08) — the chart's 8-point projection is
        // display-only and no longer the analytics source.
        var hourlyAnalytics = [];
        for (var a = 0; a < count; a++) {
          var aVal = timeArr[a];
          if (aVal == null) continue;
          var aTs = resolveInstant(aVal);
          var aHour = hourFor(aVal, aTs);
          if (aHour == null) continue;
          hourlyAnalytics.push(buildPoint(aVal, aTs, a, aHour, false));
        }

        // 8-point chart projection sampled from the CURRENT interval forward,
        // not blindly from the first provider row (LW08).
        var hourlyForecast = [];
        var nowMs = Date.now();
        var startIdx = 0;
        for (var s = 0; s < count; s++) {
          var sTs = resolveInstant(timeArr[s]);
          if (sTs != null && sTs + 3600000 > nowMs) { startIdx = s; break; }
        }
        var remaining = count - startIdx;
        var step = (remaining >= 8) ? Math.floor(remaining / 8) : 1;
        for (var i = 0; i < 8; i++) {
          var idx = startIdx + i * step;
          if (idx > count - 1) break;
          var tStr = timeArr[idx];
          if (tStr == null) continue;
          var ptTs = resolveInstant(tStr);
          var h = hourFor(tStr, ptTs);
          if (h == null) continue;
          hourlyForecast.push(buildPoint(tStr, ptTs, idx, h, i === 0));
        }

        var result = Object.assign({}, weather, {
          weather: weather,
          hourlyForecast: hourlyForecast,
          hourlyAnalytics: hourlyAnalytics,
          hourly: hourlyForecast
        });
        return result;
      },

      normalizeMetNorway: function(data) {
        var series = (data.properties && data.properties.timeseries) || [];
        if (!series.length) throw new Error('Empty MET Norway timeseries');

        var cur = series[0] || {};
        var details = (cur.data && cur.data.instant && cur.data.instant.details) || {};
        var next1 = (cur.data && (cur.data.next_1_hours || cur.data.next_6_hours)) || {};
        var sym = (next1.summary && next1.summary.symbol_code) || 'partlycloudy_day';
        var wmo = ApiService.metSymbolToWmo(sym);
        var wmoMeta = ApiService.interpretWmoCode(wmo);

        var tempC = details.air_temperature != null ? details.air_temperature : 20.0;
        var windSpeedKm = details.wind_speed != null ? Math.round(details.wind_speed * 3.6 * 10) / 10 : 10.0;
        var humidity = details.relative_humidity != null ? details.relative_humidity : 55;
        var precipMm = (next1.details && next1.details.precipitation_amount != null) ? next1.details.precipitation_amount : 0.0;

        var maxT = tempC;
        var minT = tempC;
        var checkCount = Math.min(24, series.length);
        for (var c = 0; c < checkCount; c++) {
          var entT = series[c].data && series[c].data.instant && series[c].data.instant.details && series[c].data.instant.details.air_temperature;
          if (entT != null) {
            if (entT > maxT) maxT = entT;
            if (entT < minT) minT = entT;
          }
        }

        var weather = {
          tempC: Math.round(tempC * 10) / 10,
          tempF: Math.round(((tempC * 9 / 5) + 32) * 10) / 10,
          apparentC: Math.round(tempC * 10) / 10,
          apparentF: Math.round(((tempC * 9 / 5) + 32) * 10) / 10,
          tempMaxC: Math.round(maxT * 10) / 10,
          tempMinC: Math.round(minT * 10) / 10,
          tempMaxF: Math.round(((maxT * 9 / 5) + 32) * 10) / 10,
          tempMinF: Math.round(((minT * 9 / 5) + 32) * 10) / 10,
          wmoCode: wmo,
          conditionText: wmoMeta.text,
          category: wmoMeta.category,
          icon: wmoMeta.icon,
          keyword: wmoMeta.keyword,
          humidity: Math.round(humidity),
          windSpeedKm: windSpeedKm,
          windSpeedMph: Math.round(windSpeedKm * 0.621371 * 10) / 10,
          precipitationMm: Math.round(precipMm * 10) / 10,
          isDay: sym.indexOf('night') === -1 ? 1 : 0,
          timezone: (data && data.timezone) || null
        };

        var hourlyForecast = [];
        var countPts = Math.min(24, series.length);
        var step = countPts >= 8 ? Math.floor(countPts / 8) : 1;

        function buildMetPoint(pt, isFirst, seqIdx) {
          var ptDetails = (pt.data && pt.data.instant && pt.data.instant.details) || {};
          var ptNext = (pt.data && (pt.data.next_1_hours || pt.data.next_6_hours)) || {};
          var ptSym = (ptNext.summary && ptNext.summary.symbol_code) || sym;
          var ptWmo = ApiService.metSymbolToWmo(ptSym);
          var tStr = pt.time || '';
          var ptDate = new Date(tStr);
          var h = !isNaN(ptDate.getTime()) ? ptDate.getHours() : ((new Date().getHours() + seqIdx * 3) % 24);
          var lbl = (isFirst) ? 'Now' : ((h % 12 || 12) + (h >= 12 ? ' PM' : ' AM'));
          var ptT = (ptDetails.air_temperature != null && Number.isFinite(ptDetails.air_temperature)) ? ptDetails.air_temperature : null;
          var ptWind = (ptDetails.wind_speed != null && Number.isFinite(ptDetails.wind_speed)) ? Math.round(ptDetails.wind_speed * 3.6 * 10) / 10 : null;
          var ptHum = (ptDetails.relative_humidity != null && Number.isFinite(ptDetails.relative_humidity)) ? ptDetails.relative_humidity : null;
          var ptP = (ptNext.details && ptNext.details.precipitation_amount != null && Number.isFinite(ptNext.details.precipitation_amount)) ? ptNext.details.precipitation_amount : null;
          var ptProb = (ptNext.details && ptNext.details.probability_of_precipitation != null && Number.isFinite(ptNext.details.probability_of_precipitation)) ? ptNext.details.probability_of_precipitation : null;

          return {
            time: (h < 10 ? '0' : '') + h + ':00',
            isoTime: tStr,
            timestamp: !isNaN(ptDate.getTime()) ? ptDate.getTime() : null,
            label: lbl,
            hour: h,
            tempC: (ptT != null) ? Math.round(ptT * 10) / 10 : null,
            tempF: (ptT != null) ? Math.round(((ptT * 9 / 5) + 32) * 10) / 10 : null,
            apparentC: (ptT != null) ? Math.round(ptT * 10) / 10 : null,
            apparentF: (ptT != null) ? Math.round(((ptT * 9 / 5) + 32) * 10) / 10 : null,
            precipProb: (ptProb != null) ? Math.max(0, Math.min(100, Math.round(ptProb))) : null,
            precipMm: (ptP != null) ? Math.round(ptP * 10) / 10 : null,
            windSpeedKm: (ptWind != null) ? ptWind : null,
            windSpeedMph: (ptWind != null) ? Math.round(ptWind * 0.621371 * 10) / 10 : null,
            humidity: (ptHum != null) ? Math.max(0, Math.min(100, Math.round(ptHum))) : null,
            aqi: null,
            aqiColor: '#94a3b8',
            aqiCategory: 'Unavailable',
            conditionText: ApiService.interpretWmoCode(ptWmo).text
          };
        }

        // Full-resolution analytics series with absolute timestamps (LW08)
        var hourlyAnalytics = [];
        for (var m = 0; m < countPts; m++) {
          if (series[m]) hourlyAnalytics.push(buildMetPoint(series[m], false, m));
        }

        for (var p = 0; p < 8 && p < countPts; p++) {
          var idx = Math.min(p * step, countPts - 1);
          var pt = series[idx];
          if (pt) {
            hourlyForecast.push(buildMetPoint(pt, p === 0, p));
          }
        }

        return Object.assign({}, weather, {
          weather: weather,
          hourlyForecast: hourlyForecast,
          hourlyAnalytics: hourlyAnalytics,
          hourly: hourlyForecast
        });
      },

      'open-meteo': function(lat, lon, options) {
        var url = 'https://api.open-meteo.com/v1/forecast?' +
          'latitude=' + encodeURIComponent(lat) +
          '&longitude=' + encodeURIComponent(lon) +
          '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m' +
          '&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m' +
          '&daily=temperature_2m_max,temperature_2m_min' +
          '&forecast_hours=24' +
          '&timezone=auto' +
          '&timeformat=unixtime';

        return ApiService.fetchWithTimeout(url, 5000)
          .then(function(res) {
            if (!res.ok) throw new Error('Open-Meteo weather HTTP ' + res.status);
            return res.json();
          })
          .then(function(data) {
            return ApiService.WeatherAdapter.normalizeOpenMeteo(data);
          });
      },

      'met-norway': function(lat, lon, options) {
        console.warn('[ApiService] MET Norway direct browser queries require custom User-Agent headers unsupported in browser context; routing cleanly to Open-Meteo.');
        return ApiService.WeatherAdapter['open-meteo'](lat, lon, options);
      },

      normalizeOpenWeatherMap: function(data) {
        var isOneCall = !!(data && data.current);
        var cur = isOneCall ? data.current : ((data.list && data.list[0]) || {});
        var main = cur.main || cur;
        var wind = cur.wind || cur;
        var weather0 = (cur.weather && cur.weather[0]) || {};
        var wmo = ApiService.owmToWmo(weather0.id || 800);
        var wmoMeta = ApiService.interpretWmoCode(wmo);

        var tempC = (main.temp != null) ? main.temp : 20.0;
        var apparentC = (main.feels_like != null) ? main.feels_like : tempC;
        var rawWind = (wind.speed != null) ? wind.speed : (wind.wind_speed != null ? wind.wind_speed : 2.8);
        var windSpeedKm = Math.round(rawWind * 3.6 * 10) / 10;
        var humidity = (main.humidity != null) ? main.humidity : 55;
        var precipMm = 0.0;
        if (cur.rain) {
          precipMm = cur.rain['1h'] != null ? cur.rain['1h'] : (cur.rain['3h'] != null ? cur.rain['3h'] / 3 : 0.0);
        }

        var maxT = tempC;
        var minT = tempC;
        if (data.daily && data.daily[0] && data.daily[0].temp) {
          if (data.daily[0].temp.max != null) maxT = data.daily[0].temp.max;
          if (data.daily[0].temp.min != null) minT = data.daily[0].temp.min;
        } else {
          var checkList = data.list || data.hourly || [];
          var checkCount = Math.min(8, checkList.length);
          for (var c = 0; c < checkCount; c++) {
            var itemT = (checkList[c].main && checkList[c].main.temp != null) ? checkList[c].main.temp : checkList[c].temp;
            if (itemT != null) {
              if (itemT > maxT) maxT = itemT;
              if (itemT < minT) minT = itemT;
            }
          }
        }

        var weather = {
          tempC: Math.round(tempC * 10) / 10,
          tempF: Math.round(((tempC * 9 / 5) + 32) * 10) / 10,
          apparentC: Math.round(apparentC * 10) / 10,
          apparentF: Math.round(((apparentC * 9 / 5) + 32) * 10) / 10,
          tempMaxC: Math.round(maxT * 10) / 10,
          tempMinC: Math.round(minT * 10) / 10,
          tempMaxF: Math.round(((maxT * 9 / 5) + 32) * 10) / 10,
          tempMinF: Math.round(((minT * 9 / 5) + 32) * 10) / 10,
          wmoCode: wmo,
          conditionText: wmoMeta.text,
          category: wmoMeta.category,
          icon: wmoMeta.icon,
          keyword: wmoMeta.keyword,
          humidity: Math.round(humidity),
          windSpeedKm: windSpeedKm,
          windSpeedMph: Math.round(windSpeedKm * 0.621371 * 10) / 10,
          precipitationMm: Math.round(precipMm * 10) / 10,
          isDay: (weather0.icon && weather0.icon.indexOf('n') !== -1) ? 0 : 1,
          timezone: data.timezone || null
        };

        var hourlyForecast = [];
        var list = data.hourly || data.list || [];
        var count = Math.min(24, list.length);
        var isThreeHourly = !data.hourly && Array.isArray(data.list);

        function buildOwmPoint(item, i, isFirst) {
          var iMain = item.main || item;
          var iWind = item.wind || item;
          var iW = (item.weather && item.weather[0]) || {};
          var iWmo = ApiService.owmToWmo(iW.id || 800);
          var dt = item.dt ? new Date(item.dt * 1000) : new Date(Date.now() + i * 3 * 3600000);
          var h = dt.getHours();
          var lbl = (isFirst) ? 'Now' : ((h % 12 || 12) + (h >= 12 ? ' PM' : ' AM'));
          var ptT = (iMain.temp != null && Number.isFinite(iMain.temp)) ? iMain.temp : null;
          var ptApp = (iMain.feels_like != null && Number.isFinite(iMain.feels_like)) ? iMain.feels_like : null;
          var ptRawWind = (iWind.speed != null && Number.isFinite(iWind.speed)) ? iWind.speed : (iWind.wind_speed != null && Number.isFinite(iWind.wind_speed) ? iWind.wind_speed : null);
          var ptWind = (ptRawWind != null) ? Math.round(ptRawWind * 3.6 * 10) / 10 : null;
          var ptHum = (iMain.humidity != null && Number.isFinite(iMain.humidity)) ? iMain.humidity : null;
          var ptProb = (item.pop != null && Number.isFinite(item.pop)) ? Math.max(0, Math.min(100, Math.round(item.pop * 100))) : null;
          var ptP = null;
          if (item.rain) {
            if (item.rain['1h'] != null && Number.isFinite(item.rain['1h'])) ptP = item.rain['1h'];
            else if (item.rain['3h'] != null && Number.isFinite(item.rain['3h'])) ptP = item.rain['3h'] / 3;
          }

          return {
            time: (h < 10 ? '0' : '') + h + ':00',
            isoTime: item.dt ? new Date(item.dt * 1000).toISOString() : null,
            timestamp: dt.getTime(),
            label: lbl,
            hour: h,
            tempC: (ptT != null) ? Math.round(ptT * 10) / 10 : null,
            tempF: (ptT != null) ? Math.round(((ptT * 9 / 5) + 32) * 10) / 10 : null,
            apparentC: (ptApp != null) ? Math.round(ptApp * 10) / 10 : null,
            apparentF: (ptApp != null) ? Math.round(((ptApp * 9 / 5) + 32) * 10) / 10 : null,
            precipProb: ptProb,
            precipMm: (ptP != null) ? Math.round(ptP * 10) / 10 : null,
            windSpeedKm: ptWind,
            windSpeedMph: (ptWind != null) ? Math.round(ptWind * 0.621371 * 10) / 10 : null,
            humidity: (ptHum != null) ? Math.max(0, Math.min(100, Math.round(ptHum))) : null,
            aqi: null,
            aqiColor: '#94a3b8',
            aqiCategory: 'Unavailable',
            conditionText: ApiService.interpretWmoCode(iWmo).text
          };
        }

        // Full-resolution analytics series with absolute timestamps (LW08)
        var hourlyAnalytics = [];
        for (var o = 0; o < count; o++) {
          if (list[o]) hourlyAnalytics.push(buildOwmPoint(list[o], o, false));
        }

        // Chart projection from the CURRENT interval forward (LW08); when every
        // row is already past (e.g. fixtures), sampling clamps to the first row.
        var nowMs = Date.now();
        var startIdx = 0;
        for (var s = 0; s < count; s++) {
          var sDt = list[s] && list[s].dt;
          if (typeof sDt === 'number' && Number.isFinite(sDt) && sDt * 1000 + 3600000 > nowMs) { startIdx = s; break; }
        }
        var remaining = count - startIdx;
        var step = isThreeHourly ? 1 : ((remaining >= 8) ? Math.floor(remaining / 8) : 1);
        for (var i = 0; i < 8; i++) {
          var idx = startIdx + i * step;
          if (idx > count - 1) break;
          var item = list[idx];
          if (item) {
            hourlyForecast.push(buildOwmPoint(item, i, i === 0));
          }
        }

        return Object.assign({}, weather, {
          weather: weather,
          hourlyForecast: hourlyForecast,
          hourlyAnalytics: hourlyAnalytics,
          hourly: hourlyForecast
        });
      },

      'openweathermap': function(lat, lon, options) {
        var key = (options && options.key) || ApiService.openweathermapApiKey || (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.openweathermapApiKey) || '';
        key = String(key || '').trim();
        if (!key) {
          console.warn('[ApiService] No OpenWeatherMap API key provided, falling back to open-meteo');
          return ApiService.WeatherAdapter['open-meteo'](lat, lon, options);
        }

        var oneCallUrl = 'https://api.openweathermap.org/data/3.0/onecall?' +
          'lat=' + encodeURIComponent(lat) +
          '&lon=' + encodeURIComponent(lon) +
          '&appid=' + encodeURIComponent(key) +
          '&units=metric' +
          '&exclude=minutely,daily,alerts';

        var forecast25Url = 'https://api.openweathermap.org/data/2.5/forecast?' +
          'lat=' + encodeURIComponent(lat) +
          '&lon=' + encodeURIComponent(lon) +
          '&appid=' + encodeURIComponent(key) +
          '&units=metric';

        return ApiService.fetchWithTimeout(oneCallUrl, 5000)
          .then(function(res) {
            if (!res.ok) throw new Error('One Call 3.0 HTTP ' + res.status);
            return res.json();
          })
          .catch(function() {
            return ApiService.fetchWithTimeout(forecast25Url, 5000)
              .then(function(res) {
                if (!res.ok) throw new Error('OpenWeatherMap 2.5 HTTP ' + res.status);
                return res.json();
              });
          })
          .then(function(data) {
            return ApiService.WeatherAdapter.normalizeOpenWeatherMap(data);
          })
          .catch(function(err) {
            console.warn('[ApiService] OpenWeatherMap fetch failed, falling back to open-meteo:', err.message);
            return ApiService.WeatherAdapter['open-meteo'](lat, lon, options);
          });
      }
    },

    /**
     * Multi-Provider AQI Adapters
     */
    AqiAdapter: {
      normalizeOpenMeteo: function(data) {
        var cur = data.current || {};
        if (cur.european_aqi == null || !Number.isFinite(cur.european_aqi)) {
          // Degenerate success payload: report unavailable instead of fabricating a value (B-NFB-03)
          var unavailableAqi = {
            available: false,
            europeanAqi: null,
            aqi: null,
            category: 'Unavailable',
            color: '#64748b',
            badgeColor: '#64748b',
            pm2_5: null,
            pm25: null,
            pm10: null,
            pollutantUnit: 'µg/m³'
          };
          return {
            available: false,
            europeanAqi: null,
            aqi: unavailableAqi,
            hourlyAqi: null,
            category: 'Unavailable'
          };
        }
        var eq = cur.european_aqi;
        var meta = ApiService.interpretEuropeanAqi(eq);
        var aqi = {
          available: true,
          pollutantUnit: 'µg/m³',
          europeanAqi: meta.value,
          aqi: meta.value,
          category: meta.category,
          color: meta.color,
          badgeColor: meta.color,
          pm2_5: cur.pm2_5 != null ? Math.round(cur.pm2_5 * 10) / 10 : null,
          pm25: cur.pm2_5 != null ? Math.round(cur.pm2_5 * 10) / 10 : null,
          pm10: cur.pm10 != null ? Math.round(cur.pm10 * 10) / 10 : null
        };
        var hourlyAqi = null;
        if (data.hourly && data.hourly.european_aqi) {
          hourlyAqi = {
            times: data.hourly.time || [],
            values: data.hourly.european_aqi || []
          };
        }
        return Object.assign({}, aqi, {
          aqi: aqi,
          hourlyAqi: hourlyAqi
        });
      },

      normalizeWaqi: function(data) {
        if (data && data.status === 'ok' && data.data) {
          var d = data.data;
          if (typeof d.aqi !== 'number') {
            // Degenerate success payload: report unavailable instead of fabricating a value (B-NFB-03)
            var unavailableWaqi = {
              available: false,
              europeanAqi: null,
              aqi: null,
              category: 'Unavailable',
              color: '#64748b',
              badgeColor: '#64748b',
              pm2_5: null,
              pm25: null,
              pm10: null,
              pollutantUnit: 'AQI'
            };
            return {
              available: false,
              europeanAqi: null,
              aqi: unavailableWaqi,
              hourlyAqi: null,
              category: 'Unavailable'
            };
          }
          var rawAqi = d.aqi;
          var eqVal;
          if (rawAqi <= 50) eqVal = Math.round(rawAqi * 0.4);
          else if (rawAqi <= 100) eqVal = 20 + Math.round((rawAqi - 50) * 0.4);
          else if (rawAqi <= 150) eqVal = 40 + Math.round((rawAqi - 100) * 0.4);
          else if (rawAqi <= 200) eqVal = 60 + Math.round((rawAqi - 150) * 0.4);
          else eqVal = Math.min(100, 80 + Math.round((rawAqi - 200) * 0.2));

          var meta = ApiService.interpretEuropeanAqi(eqVal);
          var pm25 = (d.iaqi && d.iaqi.pm25 && d.iaqi.pm25.v != null) ? d.iaqi.pm25.v : null;
          var pm10 = (d.iaqi && d.iaqi.pm10 && d.iaqi.pm10.v != null) ? d.iaqi.pm10.v : null;

          var aqi = {
            available: true,
            pollutantUnit: 'AQI',
            europeanAqi: meta.value,
            aqi: meta.value,
            category: meta.category,
            color: meta.color,
            badgeColor: meta.color,
            pm2_5: pm25 != null ? Math.round(pm25 * 10) / 10 : null,
            pm25: pm25 != null ? Math.round(pm25 * 10) / 10 : null,
            pm10: pm10 != null ? Math.round(pm10 * 10) / 10 : null
          };
          return Object.assign({}, aqi, {
            aqi: aqi,
            hourlyAqi: null
          });
        }
        // Direct object support without data wrapper
        if (data && (typeof data.aqi === 'number' || (data.data && typeof data.data.aqi === 'number'))) {
          var d2 = data.data || data;
          var candAqi2 = (typeof data.aqi === 'number' && Number.isFinite(data.aqi)) ? data.aqi
            : ((data.data && typeof data.data.aqi === 'number' && Number.isFinite(data.data.aqi)) ? data.data.aqi : null);
          if (candAqi2 === null) {
            // Degenerate success payload: report unavailable instead of fabricating a value (B-NFB-03)
            var unavailableWaqi2 = {
              available: false,
              europeanAqi: null,
              aqi: null,
              category: 'Unavailable',
              color: '#64748b',
              badgeColor: '#64748b',
              pm2_5: null,
              pm25: null,
              pm10: null,
              pollutantUnit: 'AQI'
            };
            return {
              available: false,
              europeanAqi: null,
              aqi: unavailableWaqi2,
              hourlyAqi: null,
              category: 'Unavailable'
            };
          }
          var rawAqi2 = candAqi2;
          var eqVal2;
          if (rawAqi2 <= 50) eqVal2 = Math.round(rawAqi2 * 0.4);
          else if (rawAqi2 <= 100) eqVal2 = 20 + Math.round((rawAqi2 - 50) * 0.4);
          else if (rawAqi2 <= 150) eqVal2 = 40 + Math.round((rawAqi2 - 100) * 0.4);
          else if (rawAqi2 <= 200) eqVal2 = 60 + Math.round((rawAqi2 - 150) * 0.4);
          else eqVal2 = Math.min(100, 80 + Math.round((rawAqi2 - 200) * 0.2));

          var meta2 = ApiService.interpretEuropeanAqi(eqVal2);
          var pm25_2 = (d2.iaqi && d2.iaqi.pm25 && d2.iaqi.pm25.v != null) ? d2.iaqi.pm25.v : null;
          var pm10_2 = (d2.iaqi && d2.iaqi.pm10 && d2.iaqi.pm10.v != null) ? d2.iaqi.pm10.v : null;

          var aqi2 = {
            available: true,
            pollutantUnit: 'AQI',
            europeanAqi: meta2.value,
            aqi: meta2.value,
            category: meta2.category,
            color: meta2.color,
            badgeColor: meta2.color,
            pm2_5: pm25_2 != null ? Math.round(pm25_2 * 10) / 10 : null,
            pm25: pm25_2 != null ? Math.round(pm25_2 * 10) / 10 : null,
            pm10: pm10_2 != null ? Math.round(pm10_2 * 10) / 10 : null
          };
          return Object.assign({}, aqi2, {
            aqi: aqi2,
            hourlyAqi: null
          });
        }
        throw new Error('WAQI status not ok');
      },

      'open-meteo': function(lat, lon, options) {
        var url = 'https://air-quality-api.open-meteo.com/v1/air-quality?' +
          'latitude=' + encodeURIComponent(lat) +
          '&longitude=' + encodeURIComponent(lon) +
          '&current=european_aqi,pm10,pm2_5' +
          '&hourly=european_aqi,pm10,pm2_5' +
          '&forecast_hours=24' +
          '&timeformat=unixtime';

        return ApiService.fetchWithTimeout(url, 5000)
          .then(function(res) {
            if (!res.ok) throw new Error('Open-Meteo AQI HTTP ' + res.status);
            return res.json();
          })
          .then(function(data) {
            return ApiService.AqiAdapter.normalizeOpenMeteo(data);
          })
          .catch(function(err) {
            console.warn('[ApiService] AQI fetch error, reporting unavailable:', err.message);
            var unavailableAqi = {
              available: false,
              europeanAqi: null,
              aqi: null,
              category: 'Unavailable',
              color: '#64748b',
              badgeColor: '#64748b',
              pm2_5: null,
              pm25: null,
              pm10: null,
              pollutantUnit: 'µg/m³'
            };
            return {
              available: false,
              europeanAqi: null,
              aqi: unavailableAqi,
              hourlyAqi: null,
              category: 'Unavailable'
            };
          });
      },

      'waqi': function(lat, lon, options) {
        var token = (options && options.key) || ApiService.waqiApiKey || (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.waqiApiKey) || 'demo';
        token = String(token || 'demo').trim();
        var url = 'https://api.waqi.info/feed/geo:' + encodeURIComponent(lat) + ';' + encodeURIComponent(lon) + '/?token=' + encodeURIComponent(token);

        return ApiService.fetchWithTimeout(url, 5000)
          .then(function(res) {
            if (!res.ok) throw new Error('WAQI HTTP ' + res.status);
            return res.json();
          })
          .then(function(data) {
            return ApiService.AqiAdapter.normalizeWaqi(data);
          })
          .catch(function(err) {
            console.warn('[ApiService] WAQI fetch error, falling back to open-meteo AQI:', err.message);
            return ApiService.AqiAdapter['open-meteo'](lat, lon, options);
          });
      }
    },

    /**
     * Dispatcher for weather telemetry by provider
     */
    fetchWeather: function(lat, lon, provider, options) {
      var p = provider || this.weatherProvider || 'open-meteo';
      var adapter = this.WeatherAdapter[p] || this.WeatherAdapter['open-meteo'];
      return adapter(lat, lon, options);
    },

    /**
     * Dispatcher for Air Quality telemetry by provider
     */
    fetchAqi: function(lat, lon, provider, options) {
      var p = provider || this.aqiProvider || 'open-meteo';
      var adapter = this.AqiAdapter[p] || this.AqiAdapter['open-meteo'];
      return adapter(lat, lon, options);
    },

    // Rotation cursor + recents state lives in memory FIRST; persistence is a
    // best-effort mirror so a failed localStorage never resets rotation to a
    // phantom cursor (LW14).
    _wallpaperRotateCursor: null,

    getWallpaperRotateCursor: function() {
      if (typeof this._wallpaperRotateCursor === 'number' && this._wallpaperRotateCursor >= 0) {
        return this._wallpaperRotateCursor;
      }
      var loaded = null;
      try {
        if (typeof localStorage !== 'undefined') {
          var val = parseInt(localStorage.getItem('local_wally_wallpaper_rotate_cursor'), 10);
          if (!isNaN(val) && val >= 0) loaded = val;
        }
      } catch (e) {}
      this._wallpaperRotateCursor = (loaded != null) ? loaded : 0;
      return this._wallpaperRotateCursor;
    },

    setWallpaperRotateCursor: function(cursor) {
      var val = parseInt(cursor, 10);
      if (isNaN(val) || val < 0) val = 0;
      this._wallpaperRotateCursor = val;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('local_wally_wallpaper_rotate_cursor', String(val));
        }
      } catch (e) {}
    },

    _recentWallpapers: null,

    getRecentWallpapers: function() {
      if (Array.isArray(this._recentWallpapers)) {
        return this._recentWallpapers;
      }
      var loaded = null;
      try {
        if (typeof localStorage !== 'undefined') {
          var raw = localStorage.getItem('local_wally_recent_wallpapers');
          if (raw) {
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) loaded = parsed.slice(0, 80);
          }
        }
      } catch (e) {}
      this._recentWallpapers = loaded || [];
      return this._recentWallpapers;
    },

    addRecentWallpaper: function(idOrUrl) {
      if (!idOrUrl || typeof idOrUrl !== 'string') return;
      var recents = this.getRecentWallpapers().slice();
      var idx = recents.indexOf(idOrUrl);
      if (idx !== -1) {
        recents.splice(idx, 1);
      }
      recents.unshift(idOrUrl);
      if (recents.length > 80) {
        recents = recents.slice(0, 80);
      }
      this._recentWallpapers = recents;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('local_wally_recent_wallpapers', JSON.stringify(recents));
        }
      } catch (e) {}
    },

    mapWeatherToQuery: function(weatherCategory, isDay, customKeyword) {
      if (customKeyword && typeof customKeyword === 'string' && customKeyword.trim()) {
        return customKeyword.trim();
      }
      var cat = (weatherCategory || '').toUpperCase();
      // v0.8.8: EVERY category carries a night variant — a night wallpaper
      // must never show a daylight scene (user report: green daytime field
      // at 8:58 PM). Stock sites match 'night ' tags well across providers.
      var nightPrefix = isDay ? '' : 'night ';
      switch (cat) {
        case 'CLEAR':
          return isDay ? 'clear sky landscape' : 'night sky landscape';
        case 'CLOUDY':
        case 'OVERCAST':
          return nightPrefix + 'cloudy landscape';
        case 'RAIN':
        case 'DRIZZLE':
          return nightPrefix + 'rainy landscape';
        case 'SNOW':
          return nightPrefix + 'snowy landscape';
        case 'FOG':
        case 'MIST':
          return nightPrefix + 'misty landscape';
        case 'THUNDERSTORM':
        case 'STORM':
          return nightPrefix + 'stormy landscape';
        default:
          return nightPrefix + 'nature landscape';
      }
    },

    rankWallpaperCandidates: function(candidates, targetWidth, targetHeight) {
      if (!Array.isArray(candidates) || candidates.length === 0) return [];
      var targetAspect = targetWidth / targetHeight;
      var recentSet = new Set(this.getRecentWallpapers());

      return candidates.slice().sort(function(a, b) {
        var aInRecent = recentSet.has(a.id) || recentSet.has(a.url);
        var bInRecent = recentSet.has(b.id) || recentSet.has(b.url);

        if (aInRecent && !bInRecent) return 1;
        if (!aInRecent && bInRecent) return -1;

        var aHasDims = (typeof a.width === 'number' && a.width > 0 && typeof a.height === 'number' && a.height > 0);
        var bHasDims = (typeof b.width === 'number' && b.width > 0 && typeof b.height === 'number' && b.height > 0);

        if (aHasDims && bHasDims) {
          var aAspect = a.width / a.height;
          var bAspect = b.width / b.height;
          var aDiff = Math.abs(aAspect - targetAspect);
          var bDiff = Math.abs(bAspect - targetAspect);

          var aSufficient = a.width >= targetWidth * 0.75 && a.height >= targetHeight * 0.75;
          var bSufficient = b.width >= targetWidth * 0.75 && b.height >= targetHeight * 0.75;
          if (aSufficient && !bSufficient) return -1;
          if (!aSufficient && bSufficient) return 1;

          return aDiff - bDiff;
        }
        if (aHasDims && !bHasDims) return -1;
        if (!aHasDims && bHasDims) return 1;
        return 0;
      });
    },

    WallpaperAdapter: {
      unsplash: function(weatherCategory, isDay, query, nativeRes) {
        var self = ApiService;
        var key = (self.unsplashApiKey || '').trim();
        var fallbackSet;

        if (weatherCategory === 'RAIN' || weatherCategory === 'DRIZZLE') {
          fallbackSet = CURATED_LANDSCAPES.RAIN;
        } else if (weatherCategory === 'SNOW') {
          fallbackSet = CURATED_LANDSCAPES.SNOW;
        } else if (weatherCategory === 'THUNDERSTORM') {
          fallbackSet = CURATED_LANDSCAPES.THUNDERSTORM;
        } else if (weatherCategory === 'OVERCAST' || weatherCategory === 'FOG') {
          fallbackSet = CURATED_LANDSCAPES.OVERCAST;
        } else {
          fallbackSet = isDay ? CURATED_LANDSCAPES.CLEAR_DAY : CURATED_LANDSCAPES.CLEAR_NIGHT;
        }

        var defaultFallbackUrl = fallbackSet[Math.floor(Math.random() * fallbackSet.length)];
        var formattedFallbackUrl = self.formatImageUrl(defaultFallbackUrl, nativeRes.width, nativeRes.height);

        if (!key) {
          return Promise.resolve({
            provider: 'unsplash',
            id: 'curated-' + Math.floor(Math.random() * 100000),
            url: formattedFallbackUrl,
            sourceUrl: 'https://unsplash.com',
            photographer: 'Ambient Nature',
            photographerUrl: 'https://unsplash.com',
            width: nativeRes.width,
            height: nativeRes.height,
            description: 'Ambient nature landscape'
          });
        }

        var apiUrl = 'https://api.unsplash.com/photos/random?query=' +
          encodeURIComponent(query) +
          '&orientation=landscape&featured=true' +
          '&w=' + nativeRes.width + '&h=' + nativeRes.height;

        return self.fetchWithTimeout(apiUrl, 6000, {
          headers: {
            'Authorization': 'Client-ID ' + key,
            'Accept-Version': 'v1'
          }
        })
          .then(function(res) {
            if (!res.ok) throw new Error('Unsplash HTTP ' + res.status);
            return res.json();
          })
          .then(function(photo) {
            if (photo && photo.urls && (photo.urls.raw || photo.urls.full || photo.urls.regular)) {
              var sourceUrl = photo.urls.raw || photo.urls.full || photo.urls.regular;
              var finalUrl = self.formatImageUrl(sourceUrl, nativeRes.width, nativeRes.height);
              return {
                provider: 'unsplash',
                id: photo.id ? String(photo.id) : '',
                url: finalUrl,
                sourceUrl: (photo.links && photo.links.html) || 'https://unsplash.com',
                photographer: (photo.user && photo.user.name) || 'Unsplash Artist',
                photographerUrl: (photo.user && photo.user.links && photo.user.links.html) || 'https://unsplash.com',
                width: photo.width || nativeRes.width,
                height: photo.height || nativeRes.height,
                description: photo.description || photo.alt_description || ''
              };
            }
            throw new Error('Invalid Unsplash payload');
          })
          .catch(function(err) {
            console.warn('[ApiService] Unsplash query failed, using resolution-scaled fallback:', err.message);
            return {
              provider: 'unsplash',
              id: 'curated-' + Math.floor(Math.random() * 100000),
              url: formattedFallbackUrl,
              sourceUrl: 'https://unsplash.com',
              photographer: 'Ambient Nature',
              photographerUrl: 'https://unsplash.com',
              width: nativeRes.width,
              height: nativeRes.height,
              description: 'Ambient nature landscape'
            };
          });
      },

      wallhaven: function(query, nativeRes) {
        var self = ApiService;
        var key = (self.wallhavenApiKey || '').trim();
        if (!key) {
          return Promise.reject(new Error('Wallhaven API key missing'));
        }

        var apiUrl = 'https://wallhaven.cc/api/v1/search?q=' + encodeURIComponent(query) +
          '&categories=100&purity=100&sorting=random&order=desc&ratios=16x9,16x10,21x9' +
          '&atleast=' + nativeRes.width + 'x' + nativeRes.height;

        return self.fetchWithTimeout(apiUrl, 6000, {
          headers: {
            'X-API-Key': key
          }
        })
          .then(function(res) {
            if (!res.ok) throw new Error('Wallhaven HTTP ' + res.status);
            return res.json();
          })
          .then(function(data) {
            if (!data || !Array.isArray(data.data) || data.data.length === 0) {
              throw new Error('No Wallhaven wallpapers found');
            }
            var candidates = data.data.map(function(item) {
              return {
                provider: 'wallhaven',
                id: String(item.id),
                url: item.path,
                sourceUrl: item.url || ('https://wallhaven.cc/w/' + item.id),
                photographer: 'Wallhaven Community',
                photographerUrl: item.url || 'https://wallhaven.cc',
                width: item.dimension_x,
                height: item.dimension_y,
                description: 'Wallhaven wallpaper #' + item.id
              };
            });
            var ranked = self.rankWallpaperCandidates(candidates, nativeRes.width, nativeRes.height);
            return ranked[0];
          });
      },

      pexels: function(query, nativeRes) {
        var self = ApiService;
        var key = (self.pexelsApiKey || '').trim();
        if (!key) {
          return Promise.reject(new Error('Pexels API key missing'));
        }

        var apiUrl = 'https://api.pexels.com/v1/search?query=' + encodeURIComponent(query) +
          '&orientation=landscape&per_page=20';

        return self.fetchWithTimeout(apiUrl, 6000, {
          headers: {
            'Authorization': key
          }
        })
          .then(function(res) {
            if (!res.ok) throw new Error('Pexels HTTP ' + res.status);
            return res.json();
          })
          .then(function(data) {
            if (!data || !Array.isArray(data.photos) || data.photos.length === 0) {
              throw new Error('No Pexels photos found');
            }
            var candidates = data.photos.map(function(photo) {
              var chosenUrl = (photo.src && (photo.src.large2x || photo.src.original || photo.src.landscape)) || '';
              return {
                provider: 'pexels',
                id: String(photo.id),
                url: chosenUrl,
                sourceUrl: photo.url || 'https://www.pexels.com',
                photographer: photo.photographer || 'Pexels Creator',
                photographerUrl: photo.photographer_url || photo.url || 'https://www.pexels.com',
                width: photo.width,
                height: photo.height,
                description: photo.alt || ''
              };
            });
            var ranked = self.rankWallpaperCandidates(candidates, nativeRes.width, nativeRes.height);
            return ranked[0];
          });
      },

      pixabay: function(query, nativeRes) {
        var self = ApiService;
        var key = (self.pixabayApiKey || '').trim();
        if (!key) {
          return Promise.reject(new Error('Pixabay API key missing'));
        }

        var apiUrl = 'https://pixabay.com/api/?key=' + encodeURIComponent(key) +
          '&q=' + encodeURIComponent(query) +
          '&image_type=photo&orientation=horizontal&safesearch=true&per_page=20';

        return self.fetchWithTimeout(apiUrl, 6000)
          .then(function(res) {
            if (!res.ok) throw new Error('Pixabay HTTP ' + res.status);
            return res.json();
          })
          .then(function(data) {
            if (!data || !Array.isArray(data.hits) || data.hits.length === 0) {
              throw new Error('No Pixabay photos found');
            }
            var candidates = data.hits.map(function(hit) {
              var chosenUrl = hit.fullHDURL || hit.largeImageURL || hit.imageURL || hit.webformatURL || '';
              return {
                provider: 'pixabay',
                id: String(hit.id),
                url: chosenUrl,
                sourceUrl: hit.pageURL || 'https://pixabay.com',
                photographer: hit.user || 'Pixabay Creator',
                photographerUrl: hit.pageURL || 'https://pixabay.com',
                width: hit.imageWidth,
                height: hit.imageHeight,
                description: hit.tags || ''
              };
            });
            var ranked = self.rankWallpaperCandidates(candidates, nativeRes.width, nativeRes.height);
            return ranked[0];
          });
      }
    },

    /**
     * Unified wallpaper dispatcher supporting Unsplash, Wallhaven, Pexels, Pixabay,
     * rotation of configured sources, weather relevance, screen fit, and recent history.
     */
    fetchWallpaper: function(weatherCategory, isDay, customKeyword) {
      var self = this;
      var nativeRes = self.getNativeResolution();
      var query = self.mapWeatherToQuery(weatherCategory, isDay, customKeyword);

      var eligible = ['unsplash'];
      if (self.wallhavenApiKey && String(self.wallhavenApiKey).trim().length > 0) eligible.push('wallhaven');
      if (self.pexelsApiKey && String(self.pexelsApiKey).trim().length > 0) eligible.push('pexels');
      if (self.pixabayApiKey && String(self.pixabayApiKey).trim().length > 0) eligible.push('pixabay');

      var isRotate = (self.wallpaperProvider === 'rotate');
      var primary = 'unsplash';

      if (isRotate) {
        var cursor = self.getWallpaperRotateCursor();
        primary = eligible[cursor % eligible.length];
        self.setWallpaperRotateCursor((cursor + 1) % eligible.length);
      } else {
        var selected = (self.wallpaperProvider || 'unsplash').toLowerCase();
        if (selected !== 'unsplash' && eligible.indexOf(selected) === -1) {
          primary = 'unsplash';
        } else {
          primary = selected;
        }
      }

      function callProvider(prov) {
        switch (prov) {
          case 'wallhaven':
            return self.WallpaperAdapter.wallhaven.call(self, query, nativeRes);
          case 'pexels':
            return self.WallpaperAdapter.pexels.call(self, query, nativeRes);
          case 'pixabay':
            return self.WallpaperAdapter.pixabay.call(self, query, nativeRes);
          case 'unsplash':
          default:
            return self.WallpaperAdapter.unsplash.call(self, weatherCategory, isDay, query, nativeRes);
        }
      }

      return callProvider(primary)
        .then(function(candidate) {
          if (!candidate || !candidate.url) throw new Error('Empty candidate from ' + primary);
          self.addRecentWallpaper(candidate.id || candidate.url);
          return candidate;
        })
        .catch(function(err) {
          console.warn('[ApiService] Primary wallpaper provider ' + primary + ' failed:', err.message);
          if (primary !== 'unsplash') {
            console.log('[ApiService] Falling back once to Unsplash...');
            return callProvider('unsplash').then(function(fallbackCandidate) {
              if (fallbackCandidate && fallbackCandidate.url) {
                self.addRecentWallpaper(fallbackCandidate.id || fallbackCandidate.url);
              }
              return fallbackCandidate;
            });
          }
          throw err;
        });
    },

    /**
     * Normalizes provider publication timestamps to a validated epoch-ms
     * `publishedMs` (LW15). Handles GDELT compact UTC stamps, RSS zone-bearing
     * RFC-822 dates, and offset-bearing ISO strings (NewsAPI / Currents).
     * Zoneless date strings are NEVER interpreted via the host timezone;
     * stamps further than 24h in the future are treated as unknown metadata.
     * @param {string|number} raw
     * @returns {number|null}
     */
    parseNewsTimestamp: function(raw) {
      if (raw == null) return null;
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        var numMs = (raw > 1e12) ? raw : (raw > 1e9 ? raw * 1000 : null);
        if (numMs == null) return null;
        return (numMs - Date.now() > 24 * 3600 * 1000) ? null : numMs;
      }
      if (typeof raw !== 'string') return null;
      var s = raw.trim();
      if (!s) return null;

      // GDELT DOC 2.0 compact UTC: 20261012T093000Z
      var compact = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s);
      if (compact) {
        var compactMs = Date.UTC(+compact[1], +compact[2] - 1, +compact[3], +compact[4], +compact[5], +compact[6]);
        // Same future policy as every other branch (CORR-2)
        return (compactMs - Date.now() > 24 * 3600 * 1000) ? null : compactMs;
      }

      // Reject zoneless/date-only strings: Date.parse would silently apply the
      // host timezone (a bare YYYY-MM-DD even ends in "-DD", which superficially
      // resembles an offset) — require a time component plus an explicit zone
      if (!/[T ]\d{2}:\d{2}/.test(s)) return null;
      var zoneStripped = s.replace(/\s*\([^)]*\)\s*$/, '');
      var hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2}|UT|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT)$/i.test(zoneStripped);
      if (!hasExplicitZone) return null;

      var ms = Date.parse(zoneStripped);
      if (!Number.isFinite(ms)) return null;
      // Documented future policy: beyond 24h ahead is corrupt metadata → unknown
      if (ms - Date.now() > 24 * 3600 * 1000) return null;
      return ms;
    },

    /**
     * Normalizes a NewsAPI payload (everything or top-headlines) into the
     * shared news article shape; carries the optional story image (v0.8.9).
     */
    _normalizeNewsapiPayload: function(data) {
      if (!data || !Array.isArray(data.articles) || data.articles.length === 0) {
        throw new Error('No articles returned from NewsAPI');
      }
      var results = [];
      for (var i = 0; i < data.articles.length && results.length < 5; i++) {
        var a = data.articles[i];
        var title = (a.title || '').trim();
        var link = (a.url || '').trim();
        if (title && /^https:\/\//i.test(link)) {
          results.push({
            id: link,
            title: title,
            description: (a.description || title).trim(),
            link: link,
            source: (a.source && a.source.name) || a.author || 'NewsAPI',
            published: a.publishedAt || '',
            publishedMs: ApiService.parseNewsTimestamp(a.publishedAt),
            image: (typeof a.urlToImage === 'string' && /^https:\/\//i.test(a.urlToImage.trim())) ? a.urlToImage.trim() : null,
            provider: 'newsapi',
            providerName: 'NewsAPI',
            isWrapper: false
          });
        }
      }
      if (results.length === 0) throw new Error('No valid https articles found in NewsAPI response');
      return results;
    },

    /**
     * Proximity-targeted regional news feed via Google News RSS proxy cascade (v0.10.0)
     * @param {string} cityName
     * @param {string} [countryCode]
     * @returns {Promise<Array<{title: string, source: string, link: string}>>} Top 5 articles
     */
    fetchRegionalNews: function(cityName, countryCode) {
      var self = this;
      var cleanCity = (cityName && String(cityName).trim()) || 'Local';
      // Unknown/invalid country codes become EMPTY — never an invented region
      // (R03). Empty country slides the chain to the world edition.
      var cleanCountry = (countryCode && String(countryCode).trim().toUpperCase()) || '';
      if (cleanCountry.length !== 2) {
        cleanCountry = '';
      }

      var cityUsable = !this._isPlaceholderCity(cityName);
      var geoUrl = 'https://news.google.com/rss/headlines/section/geo/' + encodeURIComponent(cleanCity) +
        '?hl=en&gl=' + cleanCountry + '&ceid=' + cleanCountry + ':en';
      // Country-level edition (was hardcoded US) — keyless users outside the US
      // get their own regional news instead of American headlines.
      // Country-level news edition (was hardcoded US; empty country = world
      // edition) — local news for any region, honest for city-less pins.
      var fallbackUrl = (cleanCountry)
        ? 'https://news.google.com/rss?hl=en&gl=' + cleanCountry + '&ceid=' + cleanCountry + ':en'
        : 'https://news.google.com/rss?hl=en';

      function parseItems(xmlString) {
        if (!xmlString || typeof xmlString !== 'string') {
          throw new Error('Empty XML response');
        }

        var parser = new DOMParser();
        var xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        if (!xmlDoc) {
          throw new Error('XML parsing failed: document null');
        }
        var parseError = xmlDoc.querySelector ? xmlDoc.querySelector('parsererror') : (xmlDoc.getElementsByTagName ? xmlDoc.getElementsByTagName('parsererror')[0] : null);
        if (parseError) {
          throw new Error('XML parsing failed: ' + parseError.textContent);
        }

        var itemNodes = xmlDoc.querySelectorAll('item');
        if (!itemNodes || itemNodes.length === 0) {
          itemNodes = xmlDoc.getElementsByTagName('item');
        }

        var articles = [];
        for (var i = 0; i < itemNodes.length && articles.length < 5; i++) {
          var node = itemNodes[i];
          var titleEl = node.querySelector('title') || node.getElementsByTagName('title')[0];
          var linkEl = node.querySelector('link') || node.getElementsByTagName('link')[0];
          var sourceEl = node.querySelector('source') || node.getElementsByTagName('source')[0];
          var pubDateEl = node.querySelector('pubDate') || (node.getElementsByTagName ? node.getElementsByTagName('pubDate')[0] : null);

          var rawTitle = titleEl ? (titleEl.textContent || '') : '';
          var rawLink = linkEl ? (linkEl.textContent || linkEl.getAttribute('href') || '') : '';
          var sourceName = sourceEl ? (sourceEl.textContent || '') : '';
          var rawPubDate = pubDateEl ? (pubDateEl.textContent || '') : '';

          // Validate protocol to prevent javascript: or malformed URLs (XSS defense)
          if (!rawLink || typeof rawLink !== 'string' || !/^https:\/\//i.test(rawLink.trim())) {
            continue; // Skip stories without a safe HTTPS destination (Issue 6)
          }
          var safeLink = rawLink.trim();

          var cleanTitle = rawTitle.trim();
          var dashIndex = cleanTitle.lastIndexOf(' - ');
          if (dashIndex !== -1) {
            if (!sourceName) {
              sourceName = cleanTitle.substring(dashIndex + 3).trim();
            }
            cleanTitle = cleanTitle.substring(0, dashIndex).trim();
          }

          var isWrapper = /news\.google\.com/i.test(safeLink);
          if (cleanTitle) {
            articles.push({
              title: cleanTitle,
              source: sourceName || 'Google News',
              link: safeLink,
              published: rawPubDate,
              publishedMs: ApiService.parseNewsTimestamp(rawPubDate),
              provider: 'google-news',
              providerName: 'Google News',
              isWrapper: isWrapper
            });
          }
        }

        if (articles.length === 0) {
          throw new Error('No news items found in feed');
        }
        return articles;
      }

      function requestXml(rssUrl) {
        // Multi-proxy CORS cascade (v0.10.0). Cycles through free public CORS gateways
        // until a response is received, supporting both raw and JSON-wrapped responses.
        var proxies = [
          (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.primaryCorsProxy) || 'https://api.allorigins.win/raw?url=',
          (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.middleCorsProxy) || 'https://api.codetabs.com/v1/proxy?quest=',
          (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.fallbackCorsProxy) || 'https://corsproxy.io/?url=',
          'https://cors.x2u.in/',
          'https://api.allorigins.win/get?url='
        ];

        function attemptProxy(idx) {
          var proxyBase = proxies[idx];
          var targetUrl = (proxyBase.indexOf('?') !== -1)
            ? (proxyBase + encodeURIComponent(rssUrl))
            : (proxyBase + rssUrl);

          return ApiService.fetchWithTimeout(targetUrl, 5000)
            .then(function(res) {
              if (!res.ok) throw new Error('HTTP ' + res.status);
              return res.text();
            })
            .then(function(rawText) {
              var xmlString = rawText;
              if (rawText && typeof rawText === 'string' && rawText.trim().charAt(0) === '{') {
                try {
                  var json = JSON.parse(rawText.trim());
                  if (json && typeof json.contents === 'string') {
                    xmlString = json.contents;
                  }
                } catch (e) {}
              }
              return parseItems(xmlString);
            })
            .catch(function(err) {
              if (idx + 1 < proxies.length) return attemptProxy(idx + 1);
              throw err;
            });
        }

        return attemptProxy(0);
      }

      // Proximity-targeted geo RSS feed first; fall back to country/world edition
      var geoAttempt = (cityUsable && cleanCountry)
        ? requestXml(geoUrl)
        : Promise.reject(new Error('Geo RSS skipped: no usable locality/country'));
      return geoAttempt.catch(function() {
        return requestXml(fallbackUrl);
      });
      // Terminal fallback policy (LW05): errors propagate to fetchNews, which
      // serves matching real cached stories (stale-marked) or an explicit
      // unavailable state — never fabricated headlines.
    },

    NewsAdapter: {
      'google-news': function(city, countryCode) {
        return ApiService.fetchRegionalNews(city, countryCode).then(function(articles) {
          return (articles || []).filter(function(a) {
            return a && a.link && /^https:\/\//i.test(a.link);
          }).map(function(a) {
            return {
              id: a.link || a.title,
              title: a.title,
              description: a.description || a.title,
              link: a.link,
              source: a.source || 'Google News',
              published: a.published || '',
              publishedMs: (typeof a.publishedMs === 'number') ? a.publishedMs : ApiService.parseNewsTimestamp(a.published || a.seendate),
              provider: 'google-news',
              providerName: 'Google News',
              isWrapper: !!a.isWrapper
            };
          });
        });
      },

      newsapi: function(city, countryCode) {
        var self = ApiService;
        var key = (self.newsApiKey || '').trim();
        if (!key) {
          return Promise.reject(new Error('NewsAPI key missing'));
        }

        var cleanCity = (city && String(city).trim()) || 'Local';
        var cleanCountry = (countryCode && String(countryCode).trim().toUpperCase()) || '';

        /**
         * Region ladder tiers (v0.8.9; one-per-window accounting since
         * v0.8.11 R01): tier 0 = everything?q=<city + country>, tier 1 =
         * country top headlines. Every GET goes through _keyedNewsRequest so
         * each HTTP call consumes its own 15-minute window; the free plan's
         * possible CORS block is caught and the next tier pends.
         */
        var tierKey = 'newsapi|' + cleanCity.toLowerCase() + '|' + cleanCountry;
        var tiers = [
          { tier: 0, run: function() {
              // NOTE: Official NewsAPI docs: /v2/everything supports 'q', NOT 'country'.
              var disambiguatedQuery = cleanCountry ? (cleanCity + ' ' + cleanCountry) : cleanCity;
              var url = 'https://newsapi.org/v2/everything?q=' + encodeURIComponent(disambiguatedQuery) +
                '&sortBy=publishedAt&pageSize=10&language=en';
              return self._keyedNewsRequest('newsapi', url, 6000, { 'X-Api-Key': key })
                .then(function(res) {
                  if (!res.ok) throw new Error('NewsAPI HTTP ' + res.status);
                  return res.json();
                })
                .then(self._normalizeNewsapiPayload);
            } },
          { tier: 1, run: function() {
              if (!cleanCountry || cleanCountry.length !== 2) {
                return Promise.reject(new Error('No country code for NewsAPI country tier'));
              }
              var url = 'https://newsapi.org/v2/top-headlines?country=' + encodeURIComponent(cleanCountry.toLowerCase()) + '&pageSize=10';
              return self._keyedNewsRequest('newsapi', url, 6000, { 'X-Api-Key': key })
                .then(function(res) {
                  if (!res.ok) throw new Error('NewsAPI HTTP ' + res.status);
                  return res.json();
                })
                .then(self._normalizeNewsapiPayload);
            } }
        ];

        return self._runKeyedTier('newsapi', tierKey, tiers);
      },

      currents: function(city, countryCode) {
        var self = ApiService;
        var key = (self.currentsApiKey || '').trim();
        if (!key) {
          return Promise.reject(new Error('Currents API key missing'));
        }

        var cleanCity = (city && String(city).trim()) || 'Local';
        var cleanCountry = (countryCode && String(countryCode).trim().toUpperCase()) || '';

        var queryCity = cleanCity;
        if (/^bengaluru$/i.test(cleanCity)) {
          queryCity = 'Bengaluru OR Bangalore';
        }

        /**
         * Region ladder tiers: tier 0 = city keyword search with language=en,
         * tier 1 = country top stories with language=en. If both come back empty,
         * Currents rejects cleanly so the cross-provider ladder falls through to
         * Google News instead of serving unrelated international wire stories.
         */
        var tierKey = 'currents|' + cleanCity.toLowerCase() + '|' + cleanCountry;
        var tiers = [
          { tier: 0, run: function() {
              var url = 'https://api.currentsapi.services/v1/search?keywords=' + encodeURIComponent(queryCity) + '&language=en';
              if (cleanCountry && cleanCountry.length === 2) {
                url += '&country=' + encodeURIComponent(cleanCountry.toLowerCase());
              }
              return self._keyedNewsRequest('currents', url, 6000, { 'Authorization': key })
                .then(function(res) {
                  if (!res.ok) throw new Error('Currents HTTP ' + res.status);
                  return res.json();
                })
                .then(self._normalizeCurrentsPayload);
            } },
          { tier: 1, run: function() {
              if (!cleanCountry || cleanCountry.length !== 2) {
                return Promise.reject(new Error('No country code for Currents country tier'));
              }
              var url = 'https://api.currentsapi.services/v1/latest?country=' + encodeURIComponent(cleanCountry.toLowerCase()) + '&language=en';
              return self._keyedNewsRequest('currents', url, 6000, { 'Authorization': key })
                .then(function(res) {
                  if (!res.ok) throw new Error('Currents HTTP ' + res.status);
                  return res.json();
                })
                .then(self._normalizeCurrentsPayload);
            } }
        ];

        return self._runKeyedTier('currents', tierKey, tiers);
      }
    },

    NEWS_CACHE_TTL_MS: 5 * 60 * 1000,
    /**
     * Region-ladder tier memory (v0.8.9): deepest successful query tier per
     * provider|city|country identity. Tier 0 = city keywords, 1 = country top
     * stories, 2 = world. Lets small towns that return zero city-hits skip
     * straight to the working tier on later calls (quota-safe: with the 15-min
     * keyed cooldown the steady state stays at one network call per window).
     */
    _newsVariantTier: {},
    /**
     * Normalizes a Currents payload (search or /latest) into the shared news
     * article shape; carries the optional story image (v0.8.9).
     */
    _normalizeCurrentsPayload: function(data) {
      if (!data || !Array.isArray(data.news) || data.news.length === 0) {
        throw new Error('No articles returned from Currents');
      }
      var results = [];
      for (var i = 0; i < data.news.length && results.length < 5; i++) {
        var item = data.news[i];
        var title = (item.title || '').trim();
        var link = (item.url || '').trim();
        if (title && /^https:\/\//i.test(link)) {
          results.push({
            id: String(item.id || link),
            title: title,
            description: (item.description || title).trim(),
            link: link,
            source: (item.author || '').trim() || 'Currents News',
            published: item.published || '',
            publishedMs: ApiService.parseNewsTimestamp(item.published),
            image: (typeof item.image === 'string' && /^https:\/\//i.test(item.image.trim())) ? item.image.trim() : null,
            provider: 'currents',
            providerName: 'Currents News',
            isWrapper: false
          });
        }
      }
      if (results.length === 0) throw new Error('No valid https articles found in Currents response');
      return results;
    },
    // Quota firewall: >= cooldown between network attempts PER actual provider,
    // counting failed attempts, independent of any refresh/force flag (LW06).
    // Response caching (query/provider aware) stays separate.
    // KEYED (Currents, NewsAPI): deliberately HARD-CODED at 15 minutes. This is
    // a quota-safety guarantee, not a tunable: 15 min = at most 96 network
    // calls/day per keyed provider, under every known free-tier daily ceiling
    // (NewsAPI ~100/day; Currents 200/day). Do not expose it in Lively
    // Properties or config.js — a user-facing knob would invite 5-minute
    // polling and burned keys. (v0.8.5)
    NEWS_QUOTA_COOLDOWN_KEYED_MS: 15 * 60 * 1000,
    // KEYLESS (Google News chain: GDELT + public RSS gateways): a true 5-minute
    // window so automatic news updates stay fresh without touching API quotas.
    NEWS_QUOTA_COOLDOWN_KEYLESS_MS: 5 * 60 * 1000,
    NEWS_QUOTA_COOLDOWN_MS: 15 * 60 * 1000, // deprecated alias kept for older scratch suites
    _NEWS_QUOTA_SKEW_MAX_MS: 24 * 60 * 60 * 1000,
    _NEWS_QUOTA_STORE_KEY: 'LIVELY_HUD_NEWS_QUOTA',
    // In-flight map keyed by normalized request identity, cleaned on settle, bounded (LW04)
    _newsInflight: {},
    _newsInflightCount: 0,
    // Insertion order for single-entry (oldest-first) eviction (CORR-7)
    _newsInflightOrder: [],
    // Request generation: latest initiated identity wins; superseded results
    // may never mutate cache, pending snapshots, or visible UI (LW04)
    _newsLatestIdentity: null,
    _newsQuota: null,
    _newsQuotaLoaded: false,

    getNewsRotateCursor: function() {
      if (typeof this._newsRotateCursor === 'number' && this._newsRotateCursor >= 0) {
        return this._newsRotateCursor;
      }
      var loaded = null;
      try {
        if (typeof localStorage !== 'undefined') {
          var val = parseInt(localStorage.getItem('local_wally_news_rotate_cursor'), 10);
          if (!isNaN(val) && val >= 0) loaded = val;
        }
      } catch (e) {}
      this._newsRotateCursor = (loaded != null) ? loaded : 0;
      return this._newsRotateCursor;
    },

    setNewsRotateCursor: function(cursor) {
      var val = parseInt(cursor, 10);
      if (isNaN(val) || val < 0) val = 0;
      this._newsRotateCursor = val;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('local_wally_news_rotate_cursor', String(val));
        }
      } catch (e) {}
    },

    getCachedNews: function() {
      try {
        if (typeof localStorage !== 'undefined') {
          var raw = localStorage.getItem('LIVELY_HUD_NEWS_SNAPSHOT');
          if (raw) {
            var envelope = JSON.parse(raw);
            if (envelope && typeof envelope.timestamp === 'number' && Array.isArray(envelope.data)) {
              return envelope;
            }
          }
        }
      } catch (e) {}
      return null;
    },

    setCachedNews: function(provider, queryKey, articles) {
      try {
        if (typeof localStorage !== 'undefined') {
          var envelope = {
            timestamp: Date.now(),
            provider: provider,
            query: queryKey,
            data: articles
          };
          localStorage.setItem('LIVELY_HUD_NEWS_SNAPSHOT', JSON.stringify(envelope));
        }
      } catch (e) {}
    },

    /**
     * Monotonic in-session clock for quota pacing (LW06).
     */
    _newsNow: function() {
      try {
        if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
          return performance.now();
        }
      } catch (e) {}
      return Date.now();
    },

    _loadNewsQuota: function() {
      if (this._newsQuotaLoaded) return;
      this._newsQuotaLoaded = true;
      this._newsQuota = {};
      try {
        if (typeof localStorage !== 'undefined') {
          var raw = localStorage.getItem(this._NEWS_QUOTA_STORE_KEY);
          if (raw) {
            var parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              for (var prov in parsed) {
                if (Object.prototype.hasOwnProperty.call(parsed, prov) &&
                    typeof parsed[prov] === 'number' && Number.isFinite(parsed[prov])) {
                  this._newsQuota[prov] = { monoMs: null, epochMs: parsed[prov] };
                }
              }
            }
          }
        }
      } catch (e) {}
    },

    /**
     * Persists the quota stamps. Returns TRUE only when the write actually
     * landed (v0.8.14): keyed reservations are durable evidence — if this
     * cannot be written, the caller fails the request CLOSED instead of
     * granting a private in-memory window that the next reload forgets.
     */
    _persistNewsQuota: function() {
      try {
        if (typeof localStorage === 'undefined' || !localStorage || !this._newsQuota) return false;
        var flat = {};
        for (var prov in this._newsQuota) {
          if (Object.prototype.hasOwnProperty.call(this._newsQuota, prov)) {
            flat[prov] = this._newsQuota[prov].epochMs;
          }
        }
        localStorage.setItem(this._NEWS_QUOTA_STORE_KEY, JSON.stringify(flat));
        return true;
      } catch (e) {
        return false;
      }
    },

    /**
     * True when the provider's quota cooldown has elapsed. Persisted wall-clock
     * stamps are validated conservatively: backward clock jumps are respected
     * (no retry loop); absurdly future-dated stamps (>24h) are treated as
     * corrupt and reset once (LW06).
     */
    _newsCooldownMsFor: function(provider) {
      // Tiered quota firewall: keyed providers keep the hard-coded 15-minute
      // window; the keyless Google News chain refreshes on a 5-minute window.
      return (provider === 'newsapi' || provider === 'currents')
        ? this.NEWS_QUOTA_COOLDOWN_KEYED_MS
        : this.NEWS_QUOTA_COOLDOWN_KEYLESS_MS;
    },

    _newsCooldownReady: function(provider) {
      this._loadNewsQuota();
      var entry = this._newsQuota[provider];
      if (!entry) return true;
      var cooldown = this._newsCooldownMsFor(provider);
      var epochElapsed = Date.now() - entry.epochMs;
      if (epochElapsed < 0) {
        if (epochElapsed < -this._NEWS_QUOTA_SKEW_MAX_MS) {
          delete this._newsQuota[provider];
          this._persistNewsQuota();
          return true;
        }
        return false;
      }
      if (epochElapsed < cooldown) return false;
      if (entry.monoMs != null) {
        var monoElapsed = this._newsNow() - entry.monoMs;
        if (monoElapsed < cooldown) return false;
      }
      return true;
    },

    /**
     * Marks an attempt and reports whether the stamp became DURABLE
     * (v0.8.14): returns the persistence result so keyed reservations can
     * fail closed when the quota store cannot be written. The in-memory mark
     * happens regardless, so even a failed write still blocks further
     * attempts in this session.
     */
    _markNewsAttempt: function(provider) {
      this._loadNewsQuota();
      this._newsQuota[provider] = { monoMs: this._newsNow(), epochMs: Date.now() };
      return this._persistNewsQuota();
    },

    /**
     * Atomic quota reservation for ONE keyed news HTTP request (R01/R10).
     * The window is reserved at the actual request boundary — every keyed
     * GET consumes eligibility — and, when the host exposes the Web Locks
     * API, the read-check-persist critical section is serialized across
     * wallpaper instances sharing this storage bucket (rereads persisted
     * stamps inside the lock, merges, checks, then persists the
     * reservation before the request is issued). Without Web Locks this is
     * the single-instance guarantee; multi-instance safety stays honestly
     * documented as unverified (release notes). Reservation/coordination
     * failure fails CLOSED for keyed requests; cache and keyless operation
     * are unaffected. Resolves true when THIS instance may issue the GET.
     */
    _reserveNewsWindow: function(provider) {
      var self = this;
      var runCritical = function() {
        self._newsQuotaLoaded = false;
        self._newsQuota = null;
        self._loadNewsQuota();          // reread shared state inside the lock
        if (!self._newsCooldownReady(provider)) return false;
        // The reservation must be DURABLE before the GET is issued: a failed
        // quota-store write fails the keyed request CLOSED (v0.8.14). The
        // in-memory mark still blocks this session either way.
        return self._markNewsAttempt(provider) === true;
      };
      var locksApi = null;
      try {
        locksApi = (typeof navigator !== 'undefined' && navigator && navigator.locks) ? navigator.locks : null;
      } catch (e) {
        locksApi = null;
      }
      if (locksApi && typeof locksApi.request === 'function') {
        return locksApi.request('local-wally:news-quota', function() {
          return Promise.resolve(runCritical());
        }).catch(function() {
          return false; // fail closed for keyed requests
        });
      }
      return Promise.resolve(runCritical());
    },

    /**
     * The single gate every KEYED news HTTP call must pass (R01): reserves
     * the provider's window first — one HTTP GET = one consumed window —
     * then issues the request. Never bypass; never batch several GETs into
     * one reservation.
     */
    _keyedNewsRequest: function(provider, url, timeoutMs, headers) {
      var self = this;
      return this._reserveNewsWindow(provider).then(function(granted) {
        if (!granted) {
          return Promise.reject(new Error('Quota window active for ' + provider + ' — deferring to the next eligible window'));
        }
        return self.fetchWithTimeout(url, timeoutMs, { headers: headers });
      });
    },

    _NEWS_TIER_STORE_KEY: 'LIVELY_HUD_NEWS_TIER',

    /**
     * Lightweight in-memory per-provider outcome record for the D-panel news
     * status line (v0.8.15) — how the user can SEE why a card is empty:
     * attempted query, result count, tier and time of the last attempt.
     */
    _newsLastOutcome: {},

    _noteNewsOutcome: function(provider, ok, info) {
      info = info || {};
      this._newsLastOutcome[provider] = {
        at: Date.now(),
        ok: !!ok,
        tier: (typeof info.tier === 'number') ? info.tier : null,
        count: (typeof info.count === 'number') ? info.count : null,
        note: info.note || ''
      };
    },

    /**
     * Human-readable news pipeline state for the D panel (v0.8.15):
     * per-provider last outcome + remaining quota window + pending tier.
     */
    newsStatusSummary: function(city, country) {
      var self = this;
      var cleanCity = String(city || '').trim();
      var cc = String(country || '').trim().toUpperCase();
      var lines = [];
      var providers = [];
      if (String(self.currentsApiKey || '').trim()) providers.push('currents');
      if (String(self.newsApiKey || '').trim()) providers.push('newsapi');
      providers.push('google-news');
      providers.forEach(function(prov) {
        var label = prov === 'google-news' ? 'Google News (keyless)' : prov;
        var parts = [];
        var outcome = self._newsLastOutcome[prov];
        if (outcome) {
          var mins = Math.max(0, Math.round((Date.now() - outcome.at) / 60000));
          var when = mins < 1 ? 'just now' : (mins + 'm ago');
          if (outcome.ok && outcome.count) {
            parts.push(outcome.count + ' stories (' + when + (outcome.tier != null ? ', tier ' + outcome.tier : '') + ')');
          } else {
            parts.push('no stories (' + (outcome.note || 'empty') + ', ' + when + (outcome.tier != null ? ', tier ' + outcome.tier : '') + ')');
          }
        } else {
          parts.push('no attempt this session');
        }
        if (prov !== 'google-news') {
          // Remaining window from the persisted quota stamp
          self._loadNewsQuota();
          var entry = self._newsQuota && self._newsQuota[prov];
          if (entry && typeof entry.epochMs === 'number') {
            var remain = self._newsCooldownMsFor(prov) - (Date.now() - entry.epochMs);
            if (remain > 0) {
              parts.push('window opens in ' + Math.max(1, Math.ceil(remain / 60000)) + 'm');
            }
          }
          // Pending tier for the current location identity
          if (cleanCity) {
            var tierKey = prov + '|' + cleanCity.toLowerCase() + '|' + cc;
            var state = self._readNewsTierState(tierKey);
            if (state && state.status === 'pending') {
              parts.push('next: tier ' + state.tier);
            }
          }
        }
        lines.push(label + ': ' + parts.join(' · '));
      });
      return lines.join('\n');
    },

    /**
     * True when a keyed provider has a PENDING tier for this location — the
     * honest "regional stories arrive within 15 minutes" condition (v0.8.15).
     */
    newsPendingSummary: function(city, country) {
      var cleanCity = String(city || '').trim().toLowerCase();
      var cc = String(country || '').trim().toUpperCase();
      if (!cleanCity) return null;
      var providers = [];
      if (String(this.currentsApiKey || '').trim()) providers.push('currents');
      if (String(this.newsApiKey || '').trim()) providers.push('newsapi');
      for (var i = 0; i < providers.length; i++) {
        var state = this._readNewsTierState(providers[i] + '|' + cleanCity + '|' + cc);
        if (state && state.status === 'pending') {
          return { provider: providers[i], tier: state.tier };
        }
      }
      return null;
    },

    _readNewsTierState: function(tierKey) {
      if (this._newsVariantTier[tierKey]) {
        if (this._newsVariantTier[tierKey].tier >= 2 && tierKey.indexOf('currents|') === 0) {
          delete this._newsVariantTier[tierKey];
          return null;
        }
        return this._newsVariantTier[tierKey];
      }
      try {
        if (typeof localStorage !== 'undefined') {
          var raw = localStorage.getItem(this._NEWS_TIER_STORE_KEY);
          if (raw) {
            var parsed = JSON.parse(raw);
            if (parsed && parsed[tierKey] && typeof parsed[tierKey].tier === 'number' &&
                (parsed[tierKey].status === 'ok' || parsed[tierKey].status === 'pending')) {
              if (parsed[tierKey].tier >= 2 && tierKey.indexOf('currents|') === 0) {
                delete parsed[tierKey];
                try { localStorage.setItem(this._NEWS_TIER_STORE_KEY, JSON.stringify(parsed)); } catch (e2) {}
                return null;
              }
              this._newsVariantTier[tierKey] = parsed[tierKey];
              return parsed[tierKey];
            }
          }
        }
      } catch (e) {}
      return null;
    },

    /**
     * Persists one tier entry. City hints are DISPOSABLE and bounded
     * (v0.8.14): beyond 40 total entries the oldest city hints are evicted;
     * country-level keys (`<provider>||<CC>`) are reusable and exempt.
     * Corrupt persisted data is discarded rather than propagated; a failed
     * write is tolerated here because the tier store is an optimization,
     * not a safety boundary.
     */
    _writeNewsTierState: function(tierKey, state) {
      this._newsVariantTier[tierKey] = state;
      try {
        if (typeof localStorage !== 'undefined' && localStorage) {
          var parsed = {};
          try {
            var raw = localStorage.getItem(this._NEWS_TIER_STORE_KEY);
            if (raw) parsed = JSON.parse(raw) || {};
          } catch (e2) { parsed = {}; }
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) parsed = {};
          parsed[tierKey] = state;
          var keys = Object.keys(parsed);
          if (keys.length > 40) {
            for (var i = 0; i < keys.length && Object.keys(parsed).length > 40; i++) {
              if (keys[i].indexOf('||') === -1 && keys[i] !== tierKey) {
                delete parsed[keys[i]];
              }
            }
          }
          localStorage.setItem(this._NEWS_TIER_STORE_KEY, JSON.stringify(parsed));
        }
      } catch (e) {}
    },

    /**
     * One-tier-per-window keyed adapter runner (R01). Exactly ONE keyed HTTP
     * GET is issued per attempt. On success the tier is remembered as
     * working; on empty/failure the NEXT tier is retained as pending intent
     * for the next eligible window (a remembered working tier earns one
     * same-tier retry before advancing — bounded reset-once semantics).
     * Discovery across region tiers therefore spans cooldown windows by
     * design; the cross-provider ladder still tries other eligible
     * providers in the SAME attempt.
     *
     * v0.8.12: country-level memory. When a tier has proven to work for ANY
     * location in a country, a NEW location in that country starts directly
     * at that tier — so a manual city like Bengaluru inherits India's
     * working tier immediately instead of rediscovering tiers window by
     * window. Country keys live at `<provider>||<CC>` and only ever store
     * successes.
     */
    _runKeyedTier: function(provider, tierKey, tiers) {
      var self = this;
      var countryTierKey = null;
      var sep = tierKey.lastIndexOf('|');
      if (sep !== -1) {
        var cc = tierKey.slice(sep + 1);
        if (cc && cc.length === 2) {
          countryTierKey = provider + '||' + cc;
        }
      }
      var remembered = self._readNewsTierState(tierKey);
      var startIdx = 0;
      if (remembered && remembered.tier > 0) {
        for (var i = 0; i < tiers.length; i++) {
          if (tiers[i].tier === remembered.tier) { startIdx = i; break; }
        }
      }
      // Fresh identities (no exact state) start at the CITY tier (tier 0):
      // local news is the better product when it exists. The country memory
      // is the FALLBACK TARGET — if the city tier comes back empty, the
      // proven reusable country tier is pended directly (v0.8.14), so an
      // empty-city location still lands on real news in its next eligible
      // window instead of walking tiers one by one.
      var countryFallbackTier = null;
      if (!remembered && countryTierKey) {
        var countryState = self._readNewsTierState(countryTierKey);
        if (countryState && countryState.status === 'ok' && countryState.tier >= 1 && countryState.tier < tiers.length) {
          countryFallbackTier = countryState.tier;
        }
      }
      var entry = tiers[startIdx];
      if (!entry) {
        return Promise.reject(new Error(provider + ' has no runnable region tier'));
      }
      return entry.run().then(
        function(articles) {
          self._noteNewsOutcome(provider, true, { tier: entry.tier, count: articles.length });
          self._writeNewsTierState(tierKey, { tier: entry.tier, status: 'ok' });
          // Country-level memory is for REUSABLE tiers only (v0.8.14): tier 0
          // is city-specific and must never overwrite the proven country/world
          // hint; among reusable tiers the best (lowest) proven one wins.
          if (countryTierKey && entry.tier >= 1) {
            var existingCountry = self._readNewsTierState(countryTierKey);
            if (!existingCountry || existingCountry.status !== 'ok' || existingCountry.tier > entry.tier) {
              self._writeNewsTierState(countryTierKey, { tier: entry.tier, status: 'ok' });
            }
          }
          return articles;
        },
        function(err) {
          console.warn('[ApiService] ' + provider + ' tier ' + entry.tier + ' empty or failed: ' + (err && err.message));
          self._noteNewsOutcome(provider, false, { tier: entry.tier, note: (err && err.message) ? String(err.message).slice(0, 60) : 'empty' });
          var sameTierRetry = !!(remembered && remembered.status === 'ok');
          var nextTier;
          if (sameTierRetry) {
            nextTier = entry.tier; // remembered working tier: one same-tier retry
          } else if (entry.tier === 0 && countryFallbackTier !== null) {
            nextTier = countryFallbackTier; // empty city: jump to the proven country tier
          } else {
            nextTier = entry.tier + 1;
          }
          var hasNext = false;
          for (var j = 0; j < tiers.length; j++) {
            if (tiers[j].tier === nextTier) { hasNext = true; break; }
          }
          if (!hasNext) nextTier = entry.tier; // last tier: retry it next window
          self._writeNewsTierState(tierKey, { tier: nextTier, status: 'pending' });
          return Promise.reject(new Error(provider + ' window consumed — next tier pending for the next eligible window'));
        }
      );
    },

    /**
     * Regional news dispatcher with identity-bound request isolation (LW04),
     * an unbypassable per-provider quota firewall (LW06/v0.8.11 R01: every
     * KEYED HTTP GET reserves its own 15-minute window at the request
     * boundary — one GET per window per provider; the keyless chain is one
     * logical attempt per 5-minute window), a 5-minute query-aware response
     * cache, rotation when keyed providers exist, and a cross-provider
     * ladder (keyed first, keyless last; every leg inside its own window).
     * Terminal failures surface matching real cached stories (stale-marked)
     * or an empty unavailable state — never fabricated headlines (LW05).
     * There is deliberately NO force parameter: nothing may bypass the
     * quota firewall.
     */
    fetchNews: function(cityName, countryCode) {
      var self = this;
      var cleanCity = (cityName && String(cityName).trim()) || 'Local Area';
      // Unknown/invalid country codes become EMPTY, never an invented region
      // (R03): cache/query identities stay compatible, and the RSS chain
      // slides to the world edition for country-less pins.
      var cleanCountry = (countryCode && String(countryCode).trim().toUpperCase()) || '';
      if (cleanCountry.length !== 2) cleanCountry = '';
      var queryKey = cleanCity.toLowerCase() + '_' + cleanCountry.toLowerCase();

      var eligible = ['google-news'];
      if (self.newsApiKey && String(self.newsApiKey).trim().length > 0) {
        eligible.push('newsapi');
      }
      if (self.currentsApiKey && String(self.currentsApiKey).trim().length > 0) {
        eligible.push('currents');
      }

      var shouldRotate = (self.newsProvider === 'rotate');
      var isFixedMode = (self.newsProvider && self.newsProvider !== 'rotate' && self.newsProvider !== 'auto');
      var primaryProvider = 'google-news';

      if (shouldRotate) {
        var cursor = self.getNewsRotateCursor();
        primaryProvider = eligible[cursor % eligible.length];
      } else {
        var selected = (self.newsProvider || 'auto').toLowerCase();
        if (selected.indexOf('auto') === 0) {
          // Auto (API keys first): Currents is CORS-open from WebView2 (null or
          // localhost origin), NewsAPI's free plan blocks browser preflight, and
          // keyless installs fall back to the Google News chain.
          primaryProvider = eligible.indexOf('currents') !== -1 ? 'currents'
            : (eligible.indexOf('newsapi') !== -1 ? 'newsapi' : 'google-news');
        } else if (selected === 'newsapi' && (!self.newsApiKey || !self.newsApiKey.trim())) {
          primaryProvider = 'google-news';
        } else if (selected === 'currents' && (!self.currentsApiKey || !self.currentsApiKey.trim())) {
          primaryProvider = 'google-news';
        } else {
          primaryProvider = selected;
        }
      }

      // Normalized request identity: {location query, country, provider/mode} (LW04)
      var identity = shouldRotate
        ? ('rotate|' + eligible.join('+') + '|' + queryKey)
        : (primaryProvider + '|' + queryKey);
      self._newsLatestIdentity = identity;

      function envelopeMatches(envelope) {
        if (!envelope || envelope.query !== queryKey) return false;
        if (isFixedMode) {
          return envelope.provider === primaryProvider;
        }
        return (envelope.provider === primaryProvider) || (eligible.indexOf(envelope.provider) !== -1);
      }

      function markStale(list) {
        return (list || []).map(function(a) {
          return (a && typeof a === 'object') ? Object.assign({}, a, { stale: true }) : a;
        });
      }

      function isSuperseded() {
        return self._newsLatestIdentity !== identity;
      }

      // Query/provider-aware response cache: reads never consume quota (LW06)
      var cachedEnvelope = self.getCachedNews();
      if (cachedEnvelope && cachedEnvelope.timestamp) {
        var age = Date.now() - cachedEnvelope.timestamp;
        if (age >= 0 && age < self.NEWS_CACHE_TTL_MS &&
            envelopeMatches(cachedEnvelope) &&
            Array.isArray(cachedEnvelope.data) && cachedEnvelope.data.length > 0) {
          return Promise.resolve(cachedEnvelope.data);
        }
      }

      // Deduplicate only EQUIVALENT in-flight requests (LW04)
      if (self._newsInflight[identity]) {
        return self._newsInflight[identity];
      }

      // Rotate mode must not stall on a cooldown-locked provider (CORR-1):
      // if the cursor-selected primary is inside its quota window, attempt with
      // the first cooldown-READY eligible provider for this request instead.
      if (!self._newsCooldownReady(primaryProvider) && shouldRotate) {
        for (var ri = 0; ri < eligible.length; ri++) {
          if (self._newsCooldownReady(eligible[ri])) {
            primaryProvider = eligible[ri];
            break;
          }
        }
      }

      // Quota firewall — cannot be bypassed by settings events or refresh paths (LW06)
      if (!self._newsCooldownReady(primaryProvider)) {
        if (cachedEnvelope && cachedEnvelope.timestamp &&
            envelopeMatches(cachedEnvelope) &&
            Array.isArray(cachedEnvelope.data) && cachedEnvelope.data.length > 0) {
          return Promise.resolve(markStale(cachedEnvelope.data));
        }
        var anyStoredCooldown = self.getCachedNews();
        if (anyStoredCooldown && Array.isArray(anyStoredCooldown.data) && anyStoredCooldown.data.length > 0) {
          return Promise.resolve(markStale(anyStoredCooldown.data));
        }
        // Explicit unavailable state within cooldown; intent already updated
        return Promise.resolve([]);
      }

      if (shouldRotate) {
        var rotCursor = self.getNewsRotateCursor();
        self.setNewsRotateCursor((rotCursor + 1) % eligible.length);
      }

      function executeAdapter(prov) {
        var fn = self.NewsAdapter[prov] || self.NewsAdapter['google-news'];
        return fn.call(self, cleanCity, cleanCountry);
      }

      // Keyed adapters reserve their window at the ACTUAL HTTP request
      // boundary (R01: one keyed GET = one consumed 15-minute window); the
      // keyless Google News chain is one logical attempt per its 5-minute
      // window, marked here before firing (failed attempts count).
      if (primaryProvider === 'google-news') {
        self._markNewsAttempt(primaryProvider);
      }

      var request = executeAdapter(primaryProvider)
        .then(function(articles) {
          if (!articles || articles.length === 0) throw new Error('No articles from ' + primaryProvider);
          if (isSuperseded()) return []; // late result may not touch cache/UI (LW04)
          self.setCachedNews(primaryProvider, queryKey, articles);
          return articles;
        })
        .catch(function(err) {
          console.warn('[ApiService] Primary news provider ' + primaryProvider + ' failed:', err.message);
          if (isSuperseded()) return [];
          // Cross-provider ladder (v0.8.9): try every remaining ELIGIBLE
          // provider (both keyed first, then the keyless Google News chain),
          // each leg inside its own quota window — no firewall bypass.
          // Keyed providers first, keyless Google News chain last (v0.8.9)
          var remaining = [];
          for (var pi = 0; pi < eligible.length; pi++) {
            var prov = eligible[pi];
            if (prov !== primaryProvider && prov !== 'google-news') remaining.push(prov);
          }
          if (primaryProvider !== 'google-news') {
            remaining.push('google-news');
          }
          var attemptLeg = function(idx) {
            if (idx >= remaining.length) throw err;
            var prov = remaining[idx];
            if (isSuperseded()) return [];
            if (!self._newsCooldownReady(prov)) {
              console.warn('[ApiService] ' + prov + ' is inside its quota window; skipping ladder leg');
              return attemptLeg(idx + 1);
            }
            if (prov === 'google-news') {
              // The keyless chain is one logical attempt per window (R01);
              // keyed adapters reserve per HTTP GET via _keyedNewsRequest.
              self._markNewsAttempt(prov);
            }
            return executeAdapter(prov).then(function(legArticles) {
              if (!legArticles || legArticles.length === 0) {
                throw new Error('News ladder leg ' + prov + ' returned empty');
              }
              if (isSuperseded()) return [];
              self.setCachedNews(prov, queryKey, legArticles);
              return legArticles;
            }).catch(function(legErr) {
              console.warn('[ApiService] News ladder leg ' + prov + ' failed: ' + (legErr && legErr.message));
              return attemptLeg(idx + 1);
            });
          };
          return attemptLeg(0);
        })
        .catch(function(fatalErr) {
          console.warn('[ApiService] News fetch failed completely:', fatalErr.message);
          if (isSuperseded()) return [];
          // Terminal fallback: matching real cached stories, stale-marked (LW05)
          if (cachedEnvelope && Array.isArray(cachedEnvelope.data) && cachedEnvelope.data.length > 0 &&
              envelopeMatches(cachedEnvelope)) {
            return markStale(cachedEnvelope.data);
          }
          // As resilient fallback (v0.10.0), return any stored news from earlier run if available
          if (cachedEnvelope && Array.isArray(cachedEnvelope.data) && cachedEnvelope.data.length > 0) {
            return markStale(cachedEnvelope.data);
          }
          var anyStored = self.getCachedNews();
          if (anyStored && Array.isArray(anyStored.data) && anyStored.data.length > 0) {
            return markStale(anyStored.data);
          }
          return []; // explicit news-unavailable state
        })
        .finally(function() {
          if (self._newsInflight[identity] === request) {
            delete self._newsInflight[identity];
            self._newsInflightCount = Math.max(0, self._newsInflightCount - 1);
          }
          var orderIdx = self._newsInflightOrder.indexOf(identity);
          if (orderIdx !== -1) {
            self._newsInflightOrder.splice(orderIdx, 1);
          }
        });

      self._newsInflight[identity] = request;
      self._newsInflightCount++;
      self._newsInflightOrder.push(identity);
      // Bounded in-flight map: evict the OLDEST entry past a hard cap so live
      // dedupe entries survive — only the single oldest identity loses
      // protection (CORR-7), never the whole map.
      if (self._newsInflightOrder.length > 16) {
        var oldestIdentity = self._newsInflightOrder.shift();
        if (oldestIdentity != null && self._newsInflight[oldestIdentity] !== undefined) {
          delete self._newsInflight[oldestIdentity];
          self._newsInflightCount = Math.max(0, self._newsInflightCount - 1);
        }
      }

      return request;
    },

    /**
     * Unified Atmosphere Ingestion Pipeline guarded by 15-minute Cache Firewall
     * @param {boolean} forceRefresh Ignore cache if true
     * @returns {Promise<Object>} Complete atmosphere snapshot
     */
    fetchAtmosphere: function(forceRefresh) {
      var self = this;
      var wProv = self.weatherProvider || 'open-meteo';
      var aProv = self.aqiProvider || 'open-meteo';
      var providerContext = { weatherProvider: wProv, aqiProvider: aProv };

      if (!forceRefresh && global.CacheManager) {
        var cached = global.CacheManager.get(providerContext);
        if (cached) {
          cached.fromCache = true;
          if (!cached.hourlyForecast && cached.weather) {
            cached.hourlyForecast = self.normalizeForecastPoints([], cached.weather, cached.aqi);
          }
          if (cached.weather && !cached.weather.hourlyForecast) {
            cached.weather.hourlyForecast = cached.hourlyForecast;
          }
          // Old snapshots without the full-resolution analytics list degrade
          // safely to the reduced chart list (LW08)
          if (!cached.hourlyAnalytics) {
            cached.hourlyAnalytics = cached.hourlyForecast || [];
          }
          if (cached.weather && !cached.weather.hourlyAnalytics) {
            cached.weather.hourlyAnalytics = cached.hourlyAnalytics;
          }
          return Promise.resolve(cached);
        }
      }

      return self.getLocation().then(function(loc) {
        // Fetch news asynchronously in the background so it never blocks ready weather updates.
        // News network eligibility is decided by its own quota firewall — an
        // atmosphere/wallpaper force refresh can no longer bypass it (LW06).
        var newsPromise = self.fetchNews(loc.city, loc.countryCode || loc.country)
          .catch(function(err) {
            console.warn('[ApiService] Regional news fetch error (non-fatal):', err.message);
            return [];
          });

        return Promise.all([
          self.fetchWeather(loc.latitude, loc.longitude, wProv),
          self.fetchAqi(loc.latitude, loc.longitude, aProv)
        ]).then(function(results) {
          var weatherResult = results[0] || {};
          var aqiResult = results[1] || {};

          var weather = weatherResult.weather || weatherResult;
          var rawHourly = weatherResult.hourlyForecast || [];
          var rawAnalytics = weatherResult.hourlyAnalytics || rawHourly;
          var aqi = aqiResult.aqi || aqiResult;
          var hourlyAqi = aqiResult.hourlyAqi || null;

          var hourlyForecast = self.normalizeForecastPoints(rawHourly, weather, aqi, hourlyAqi);
          var hourlyAnalytics = (rawAnalytics !== rawHourly)
            ? self.normalizeForecastPoints(rawAnalytics, weather, aqi, hourlyAqi)
            : hourlyForecast;
          weather.hourlyForecast = hourlyForecast;
          weather.hourlyAnalytics = hourlyAnalytics;

          return self.fetchWallpaper(weather.category, weather.isDay, weather.keyword)
            .catch(function(bgErr) {
              console.warn('[ApiService] Wallpaper fetch failed (non-fatal):', bgErr.message);
              return self.WallpaperAdapter.unsplash.call(self, weather.category, weather.isDay, weather.keyword, self.getNativeResolution());
            })
            .then(function(bg) {
              var payload = {
                timestamp: Date.now(),
                weatherProvider: wProv,
                aqiProvider: aProv,
                location: loc,
                weather: weather,
                aqi: aqi,
                hourlyForecast: hourlyForecast,
                hourlyAnalytics: hourlyAnalytics,
                news: [],
                background: bg,
                fromCache: false
              };

              if (global.CacheManager) {
                global.CacheManager.set(payload, providerContext);
              }

              // When background news settles, attach to the matching active
              // snapshot WITHOUT extending atmosphere freshness (LW16) and
              // without letting a superseded request restore stale state (LW04).
              newsPromise.then(function(newsArticles) {
                if (newsArticles && newsArticles.length) {
                  payload.news = newsArticles;
                  if (global.CacheManager && typeof global.CacheManager.update === 'function') {
                    global.CacheManager.update(function(data) {
                      if (data) data.news = newsArticles;
                    });
                  }
                  var appInstance = global.App || global.app;
                  if (appInstance) {
                    if (appInstance.isPlaybackPaused) {
                      if (appInstance.pendingSnapshot) {
                        appInstance.pendingSnapshot.news = newsArticles;
                      } else {
                        appInstance.pendingNews = newsArticles;
                      }
                    } else if (typeof appInstance.renderNews === 'function') {
                      appInstance.renderNews(newsArticles);
                    }
                  }
                }
              }).catch(function(e) {
                console.warn('[ApiService] News attach failed:', e && e.message);
              });

              return payload;
            });
        });
      }).catch(function(err) {
        console.error('[ApiService] Pipeline failed:', err);
        // Return any expired cache or mock data as safe harbor
        if (global.CacheManager) {
          var anyCached = global.CacheManager.getAny();
          if (anyCached) {
            anyCached.fromCache = true;
            anyCached.isEmergency = true;
            if (!anyCached.hourlyForecast && anyCached.weather) {
              anyCached.hourlyForecast = self.normalizeForecastPoints([], anyCached.weather, anyCached.aqi);
            }
            if (anyCached.weather && !anyCached.weather.hourlyForecast) {
              anyCached.weather.hourlyForecast = anyCached.hourlyForecast;
            }
            if (!anyCached.hourlyAnalytics) {
              anyCached.hourlyAnalytics = anyCached.hourlyForecast || [];
            }
            if (anyCached.weather && !anyCached.weather.hourlyAnalytics) {
              anyCached.weather.hourlyAnalytics = anyCached.hourlyAnalytics;
            }
            return anyCached;
          }
          return global.CacheManager.getMockData();
        }
        throw err;
      });
    }
  };

  global.ApiService = ApiService;
})(typeof window !== 'undefined' ? window : this);
