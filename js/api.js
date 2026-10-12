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
    newsProvider: (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.newsProvider) || 'google-news',
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

    /**
     * Resolves geographical coordinates.
     * Tries HTML5 Geolocation with 4s timeout, then falls back silently to IP-based lookup.
     * Ensures city, latitude, and longitude are cleanly returned and formatted.
     * @returns {Promise<{latitude: number, longitude: number, city: string, region: string, country: string, source: string}>}
     */
    getLocation: function() {
      return new Promise(function(resolve) {
        var resolved = false;

        function finish(result) {
          if (!resolved) {
            resolved = true;
            resolve(result);
          }
        }

        function formatLocation(lat, lon, city, region, country, countryCode, source) {
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
            countryCode = countryCode || 'US';
          }
          return {
            latitude: Math.round(numLat * 10000) / 10000,
            longitude: Math.round(numLon * 10000) / 10000,
            city: (city && String(city).trim()) || 'Local Area',
            region: (region && String(region).trim()) || '',
            country: (country && String(country).trim()) || '',
            countryCode: (countryCode && String(countryCode).trim().toUpperCase()) || 'US',
            source: source || 'unknown'
          };
        }

        // Helper: fetch with safety timeout to prevent hanging on dead networks
        function fetchJsonWithTimeout(url, timeoutMs) {
          return ApiService.fetchWithTimeout(url, timeoutMs || 3500, { cache: 'no-store' })
            .then(function(res) {
              if (!res.ok) throw new Error('HTTP ' + res.status);
              return res.json();
            });
        }

        // 1. Try HTML5 Geolocation (4s timeout)
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          var geoTimeout = setTimeout(function() {
            if (!resolved) {
              fallbackToIp(finish);
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
                      finish(formatLocation(
                        gpsLat,
                        gpsLon,
                        data.city || 'Local Area',
                        data.region || '',
                        data.country_name || data.country || '',
                        data.country_code || data.country || 'US',
                        'gps'
                      ));
                    })
                    .catch(function() {
                      finish(formatLocation(gpsLat, gpsLon, 'Local Area', '', '', 'US', 'gps'));
                    });
                } else {
                  fallbackToIp(finish);
                }
              },
              function(err) {
                clearTimeout(geoTimeout);
                // Silently fall back to IP locator
                fallbackToIp(finish);
              },
              { timeout: 4000, maximumAge: 600000, enableHighAccuracy: false }
            );
          } catch (e) {
            clearTimeout(geoTimeout);
            fallbackToIp(finish);
          }
        } else {
          fallbackToIp(finish);
        }

        function fallbackToIp(cb) {
          fetchJsonWithTimeout('https://ipapi.co/json/', 3500)
            .then(function(data) {
              if (data && (typeof data.latitude === 'number' || !isNaN(parseFloat(data.latitude))) &&
                  (typeof data.longitude === 'number' || !isNaN(parseFloat(data.longitude)))) {
                cb(formatLocation(
                  data.latitude,
                  data.longitude,
                  data.city || 'Local City',
                  data.region || '',
                  data.country_name || data.country || '',
                  data.country_code || data.country || 'US',
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
              var defCountryCode = defaultLoc.countryCode || (defCity === 'Tokyo' ? 'JP' : 'US');
              cb(formatLocation(defLat, defLon, defCity, 'Local Region', defCountry, defCountryCode, 'default'));
            });
        }
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
        var timeout = timeoutMs || 5000;
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
              reject(new Error('Network request timed out: ' + url));
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
            if (hourlyAqi.times && Array.isArray(hourlyAqi.times) && pt.isoTime) {
              for (var t = 0; t < hourlyAqi.times.length; t++) {
                if (hourlyAqi.times[t] === pt.isoTime || (hourlyAqi.times[t] && pt.isoTime && hourlyAqi.times[t].indexOf(pt.isoTime.substring(0, 13)) === 0)) {
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

        var hourlyForecast = [];
        var timeArr = hourly.time || [];
        var count = Math.min(24, timeArr.length);
        var step = count >= 8 ? Math.floor(count / 8) : 1;
        for (var i = 0; i < 8 && i < count; i++) {
          var idx = Math.min(i * step, count - 1);
          if (idx >= 0 && timeArr[idx]) {
            var tStr = timeArr[idx];
            var ptDate = new Date(tStr);
            var h = !isNaN(ptDate.getTime()) ? ptDate.getHours() : ((new Date().getHours() + i * 3) % 24);
            var lbl = (i === 0) ? 'Now' : ((h % 12 || 12) + (h >= 12 ? ' PM' : ' AM'));
            var ptTempC = (hourly.temperature_2m && hourly.temperature_2m[idx] != null && Number.isFinite(hourly.temperature_2m[idx])) ? hourly.temperature_2m[idx] : null;
            var ptAppC = (hourly.apparent_temperature && hourly.apparent_temperature[idx] != null && Number.isFinite(hourly.apparent_temperature[idx])) ? hourly.apparent_temperature[idx] : null;
            var ptPrecipProb = (hourly.precipitation_probability && hourly.precipitation_probability[idx] != null && Number.isFinite(hourly.precipitation_probability[idx])) ? hourly.precipitation_probability[idx] : null;
            var ptPrecipMm = (hourly.precipitation && hourly.precipitation[idx] != null && Number.isFinite(hourly.precipitation[idx])) ? hourly.precipitation[idx] : null;
            var ptWindKm = (hourly.wind_speed_10m && hourly.wind_speed_10m[idx] != null && Number.isFinite(hourly.wind_speed_10m[idx])) ? hourly.wind_speed_10m[idx] : null;
            var ptHum = (hourly.relative_humidity_2m && hourly.relative_humidity_2m[idx] != null && Number.isFinite(hourly.relative_humidity_2m[idx])) ? hourly.relative_humidity_2m[idx] : null;
            var ptWmo = (hourly.weather_code && hourly.weather_code[idx] != null && Number.isFinite(hourly.weather_code[idx])) ? hourly.weather_code[idx] : wmo;

            hourlyForecast.push({
              time: (h < 10 ? '0' : '') + h + ':00',
              isoTime: tStr,
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
            });
          }
        }

        var result = Object.assign({}, weather, {
          weather: weather,
          hourlyForecast: hourlyForecast,
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
        for (var p = 0; p < 8 && p < countPts; p++) {
          var idx = Math.min(p * step, countPts - 1);
          var pt = series[idx];
          if (pt) {
            var ptDetails = (pt.data && pt.data.instant && pt.data.instant.details) || {};
            var ptNext = (pt.data && (pt.data.next_1_hours || pt.data.next_6_hours)) || {};
            var ptSym = (ptNext.summary && ptNext.summary.symbol_code) || sym;
            var ptWmo = ApiService.metSymbolToWmo(ptSym);
            var tStr = pt.time || '';
            var ptDate = new Date(tStr);
            var h = !isNaN(ptDate.getTime()) ? ptDate.getHours() : ((new Date().getHours() + p * 3) % 24);
            var lbl = (p === 0) ? 'Now' : ((h % 12 || 12) + (h >= 12 ? ' PM' : ' AM'));
            var ptT = (ptDetails.air_temperature != null && Number.isFinite(ptDetails.air_temperature)) ? ptDetails.air_temperature : null;
            var ptWind = (ptDetails.wind_speed != null && Number.isFinite(ptDetails.wind_speed)) ? Math.round(ptDetails.wind_speed * 3.6 * 10) / 10 : null;
            var ptHum = (ptDetails.relative_humidity != null && Number.isFinite(ptDetails.relative_humidity)) ? ptDetails.relative_humidity : null;
            var ptP = (ptNext.details && ptNext.details.precipitation_amount != null && Number.isFinite(ptNext.details.precipitation_amount)) ? ptNext.details.precipitation_amount : null;
            var ptProb = (ptNext.details && ptNext.details.probability_of_precipitation != null && Number.isFinite(ptNext.details.probability_of_precipitation)) ? ptNext.details.probability_of_precipitation : null;

            hourlyForecast.push({
              time: (h < 10 ? '0' : '') + h + ':00',
              isoTime: tStr,
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
            });
          }
        }

        return Object.assign({}, weather, {
          weather: weather,
          hourlyForecast: hourlyForecast,
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
          '&timezone=auto';

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
        var step = isThreeHourly ? 1 : (count >= 8 ? Math.floor(count / 8) : 1);
        for (var i = 0; i < 8 && i < count; i++) {
          var idx = Math.min(i * step, count - 1);
          var item = list[idx];
          if (item) {
            var iMain = item.main || item;
            var iWind = item.wind || item;
            var iW = (item.weather && item.weather[0]) || {};
            var iWmo = ApiService.owmToWmo(iW.id || 800);
            var dt = item.dt ? new Date(item.dt * 1000) : new Date(Date.now() + i * 3 * 3600000);
            var h = dt.getHours();
            var lbl = (i === 0) ? 'Now' : ((h % 12 || 12) + (h >= 12 ? ' PM' : ' AM'));
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

            hourlyForecast.push({
              time: (h < 10 ? '0' : '') + h + ':00',
              isoTime: item.dt ? new Date(item.dt * 1000).toISOString() : null,
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
            });
          }
        }

        return Object.assign({}, weather, {
          weather: weather,
          hourlyForecast: hourlyForecast,
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
        var eq = cur.european_aqi != null ? cur.european_aqi : 20;
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
          var rawAqi = typeof d.aqi === 'number' ? d.aqi : 25;
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
          var rawAqi2 = typeof d2.aqi === 'number' ? d2.aqi : 25;
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
          '&forecast_hours=24';

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

    getWallpaperRotateCursor: function() {
      try {
        if (typeof localStorage !== 'undefined') {
          var val = parseInt(localStorage.getItem('local_wally_wallpaper_rotate_cursor'), 10);
          if (!isNaN(val) && val >= 0) return val;
        }
      } catch (e) {}
      return 0;
    },

    setWallpaperRotateCursor: function(cursor) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('local_wally_wallpaper_rotate_cursor', String(cursor));
        }
      } catch (e) {}
    },

    getRecentWallpapers: function() {
      try {
        if (typeof localStorage !== 'undefined') {
          var raw = localStorage.getItem('local_wally_recent_wallpapers');
          if (raw) {
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
          }
        }
      } catch (e) {}
      return [];
    },

    addRecentWallpaper: function(idOrUrl) {
      if (!idOrUrl || typeof idOrUrl !== 'string') return;
      try {
        if (typeof localStorage !== 'undefined') {
          var recents = this.getRecentWallpapers();
          var idx = recents.indexOf(idOrUrl);
          if (idx !== -1) {
            recents.splice(idx, 1);
          }
          recents.unshift(idOrUrl);
          if (recents.length > 80) {
            recents = recents.slice(0, 80);
          }
          localStorage.setItem('local_wally_recent_wallpapers', JSON.stringify(recents));
        }
      } catch (e) {}
    },

    mapWeatherToQuery: function(weatherCategory, isDay, customKeyword) {
      if (customKeyword && typeof customKeyword === 'string' && customKeyword.trim()) {
        return customKeyword.trim();
      }
      var cat = (weatherCategory || '').toUpperCase();
      switch (cat) {
        case 'CLEAR':
          return isDay ? 'clear sky landscape' : 'night sky landscape';
        case 'CLOUDY':
        case 'OVERCAST':
          return 'cloudy landscape';
        case 'RAIN':
        case 'DRIZZLE':
          return 'rainy landscape';
        case 'SNOW':
          return 'snowy landscape';
        case 'FOG':
        case 'MIST':
          return 'misty landscape';
        case 'THUNDERSTORM':
        case 'STORM':
          return 'stormy landscape';
        default:
          return 'nature landscape';
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
        var self = this;
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
        var self = this;
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
        var self = this;
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
        var self = this;
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
     * Backward-compatible alias for fetchWallpaper
     */
    fetchContextualImage: function(weatherCategory, isDay, customKeyword) {
      return this.fetchWallpaper(weatherCategory, isDay, customKeyword);
    },

    /**
     * Curated fallback dispatches when network or CORS gateways are unavailable
     * @param {string} city
     * @returns {Array<{title: string, source: string, link: string}>}
     */
    getCuratedNews: function(city) {
      var targetCity = (city && String(city).trim()) || 'Metropolitan';
      return [
        {
          title: 'Atmospheric telemetry & localized microclimate network initialized for ' + targetCity,
          source: 'Meteorology Hub',
          link: 'https://news.google.com',
          provider: 'google-news',
          providerName: 'Google News',
          isWrapper: true
        },
        {
          title: 'Global energy grid resilience metrics show steady gains across smart sectors',
          source: 'Reuters Tech',
          link: 'https://news.google.com',
          provider: 'google-news',
          providerName: 'Google News',
          isWrapper: true
        },
        {
          title: 'Satellite observations confirm historical seasonal solar irradiance patterns',
          source: 'Science Daily',
          link: 'https://news.google.com',
          provider: 'google-news',
          providerName: 'Google News',
          isWrapper: true
        },
        {
          title: 'Regional urban infrastructure upgrades incorporate high-efficiency sensors',
          source: 'Associated Press',
          link: 'https://news.google.com',
          provider: 'google-news',
          providerName: 'Google News',
          isWrapper: true
        },
        {
          title: 'High-precision environmental monitoring standards adopted for smart cities',
          source: 'Nature Ambient',
          link: 'https://news.google.com',
          provider: 'google-news',
          providerName: 'Google News',
          isWrapper: true
        }
      ];
    },

    /**
     * Location-based regional news via GDELT DOC 2.0 API (Keyless & Proxy-Free)
     * Queries GDELT using URLSearchParams, city/alias mapping, and country filtering.
     * @param {string} cityName
     * @param {string} [countryCode]
     * @returns {Promise<Array<{title: string, source: string, link: string, seendate?: string, domain?: string}>>}
     */
    fetchGdeltNews: function(cityName, countryCode) {
      var cleanCity = (cityName && String(cityName).trim()) || '';
      var cleanCountry = (countryCode && String(countryCode).trim().toUpperCase()) || '';

      if (!cleanCity || cleanCity === 'Local' || cleanCity === 'Metropolitan') {
        return Promise.reject(new Error('City unspecified for GDELT query'));
      }

      // City alias mapping for major metropolitan centers where common variants exist
      var cityAliases = {
        'bengaluru': '(Bengaluru OR Bangalore)',
        'bangalore': '(Bengaluru OR Bangalore)',
        'mumbai': '(Mumbai OR Bombay)',
        'bombay': '(Mumbai OR Bombay)',
        'kolkata': '(Kolkata OR Calcutta)',
        'calcutta': '(Kolkata OR Calcutta)',
        'chennai': '(Chennai OR Madras)',
        'madras': '(Chennai OR Madras)',
        'kyiv': '(Kyiv OR Kiev)',
        'kiev': '(Kyiv OR Kiev)'
      };

      var cityKey = cleanCity.toLowerCase();
      var cityQuery = cityAliases[cityKey] || ('"' + cleanCity.replace(/["\\]/g, '') + '"');

      // Country qualification filter when available
      var fullQuery = cityQuery;
      if (cleanCountry && cleanCountry.length === 2) {
        fullQuery += ' sourcecountry:' + cleanCountry;
      }

      function executeQuery(q) {
        var params = new URLSearchParams();
        params.set('query', q);
        params.set('mode', 'artlist');
        params.set('format', 'json');
        params.set('timespan', '2d');
        params.set('maxrecords', '25');
        params.set('sort', 'datedesc');

        var url = 'https://api.gdeltproject.org/api/v2/doc/doc?' + params.toString();

        return ApiService.fetchWithTimeout(url, 7000)
          .then(function(res) {
            if (!res.ok) throw new Error('GDELT HTTP ' + res.status);
            return res.text();
          })
          .then(function(rawText) {
            if (!rawText || typeof rawText !== 'string') {
              throw new Error('Empty GDELT response');
            }
            var trimmed = rawText.trim();
            if (trimmed.charAt(0) !== '{') {
              throw new Error('Invalid GDELT JSON payload');
            }
            var data = JSON.parse(trimmed);
            if (!data || !Array.isArray(data.articles) || data.articles.length === 0) {
              throw new Error('No articles found in GDELT response');
            }

            var results = [];
            var seenTitles = {};
            var seenLinks = {};

            for (var i = 0; i < data.articles.length && results.length < 5; i++) {
              var item = data.articles[i];
              if (!item) continue;

              var rawTitle = item.title || '';
              var rawUrl = item.url || '';
              var rawDomain = item.domain || '';
              var rawCountry = item.sourcecountry || '';

              // Protocol validation for safe external links
              if (!rawUrl || !/^https?:\/\//i.test(rawUrl.trim())) continue;
              var safeUrl = rawUrl.trim();

              // Title cleanup and entity decoding
              var cleanTitle = rawTitle
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .trim();

              if (!cleanTitle || cleanTitle.length < 10) continue;

              // Title deduplication
              var titleKey = cleanTitle.toLowerCase().substring(0, 40);
              if (seenTitles[titleKey] || seenLinks[safeUrl]) continue;
              seenTitles[titleKey] = true;
              seenLinks[safeUrl] = true;

              // Source attribution
              var sourceName = rawDomain || rawCountry || 'Regional News';
              if (sourceName.indexOf('.') !== -1) {
                sourceName = sourceName.replace(/^www\./i, '');
              }

              results.push({
                title: cleanTitle,
                source: sourceName,
                link: safeUrl,
                seendate: item.seendate || null,
                domain: rawDomain || null,
                provider: 'google-news',
                providerName: 'Google News',
                isWrapper: false
              });
            }

            if (results.length === 0) {
              throw new Error('Zero valid articles after GDELT normalization');
            }
            return results;
          });
      }

      // Try city + country, fallback to city alone if first attempt produces no results
      return executeQuery(fullQuery)
        .catch(function() {
          if (fullQuery !== cityQuery) {
            return executeQuery(cityQuery);
          }
          throw new Error('GDELT city query yielded no articles');
        });
    },

    /**
     * Proximity-targeted regional news feed via GDELT DOC 2.0 with Google News RSS & Curated fallback
     * @param {string} cityName
     * @param {string} [countryCode]
     * @returns {Promise<Array<{title: string, source: string, link: string}>>} Top 5 articles
     */
    fetchRegionalNews: function(cityName, countryCode) {
      var self = this;
      var cleanCity = (cityName && String(cityName).trim()) || 'Local';
      var cleanCountry = (countryCode && String(countryCode).trim().toUpperCase()) || 'US';
      if (cleanCountry.length !== 2) {
        cleanCountry = 'US';
      }

      var geoUrl = 'https://news.google.com/rss/headlines/section/geo/' + encodeURIComponent(cleanCity) +
        '?hl=en&gl=' + cleanCountry + '&ceid=' + cleanCountry + ':en';
      var fallbackUrl = 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en';

      function requestXml(rssUrl) {
        var primaryProxy = (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.primaryCorsProxy) || 'https://api.allorigins.win/raw?url=';
        var fallbackProxy = (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.fallbackCorsProxy) || 'https://corsproxy.io/?url=';
        var primaryUrl = primaryProxy + encodeURIComponent(rssUrl);
        var fallbackProxyUrl = fallbackProxy + encodeURIComponent(rssUrl);

        return ApiService.fetchWithTimeout(primaryUrl, 5000)
          .then(function(res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.text();
          })
          .catch(function() {
            return ApiService.fetchWithTimeout(fallbackProxyUrl, 5000)
              .then(function(res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.text();
              });
          });
      }

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

          var rawTitle = titleEl ? (titleEl.textContent || '') : '';
          var rawLink = linkEl ? (linkEl.textContent || linkEl.getAttribute('href') || '') : '';
          var sourceName = sourceEl ? (sourceEl.textContent || '') : '';

          // Validate protocol to prevent javascript: or malformed URLs (XSS defense)
          var safeLink = (typeof rawLink === 'string' && /^https?:\/\//i.test(rawLink.trim()))
            ? rawLink.trim()
            : 'https://news.google.com';

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

      // 1. Try GDELT DOC 2.0 API first (keyless, proxy-free, direct JSON)
      return self.fetchGdeltNews(cleanCity, cleanCountry)
        .catch(function(gdeltErr) {
          // 2. Fall back to Google News RSS if GDELT fails or has no records
          console.warn('[ApiService] GDELT news unavailable, attempting Google News RSS:', gdeltErr.message);
          return requestXml(geoUrl)
            .then(parseItems)
            .catch(function() {
              return requestXml(fallbackUrl).then(parseItems);
            });
        })
        .catch(function(err) {
          // 3. Fall back to curated telemetry news if both remote APIs fail
          console.warn('[ApiService] Regional news fetch error, using curated dispatch fallback:', err.message);
          return self.getCuratedNews(cleanCity);
        });
    },

    NewsAdapter: {
      'google-news': function(city, countryCode) {
        return ApiService.fetchRegionalNews(city, countryCode).then(function(articles) {
          return (articles || []).map(function(a) {
            return {
              id: a.link || a.title,
              title: a.title,
              description: a.description || a.title,
              link: a.link,
              source: a.source || 'Google News',
              published: a.published || '',
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
        var cleanCountry = (countryCode && String(countryCode).trim()) || '';
        var disambiguatedQuery = cleanCountry ? (cleanCity + ' ' + cleanCountry) : cleanCity;

        // NOTE: Official NewsAPI documentation specifies /v2/everything supports 'q', but NOT 'country'.
        // Country parameter on /v2/everything causes HTTP 400 parameterInvalid.
        var url = 'https://newsapi.org/v2/everything?q=' + encodeURIComponent(disambiguatedQuery) +
          '&sortBy=publishedAt&pageSize=10&language=en';

        return self.fetchWithTimeout(url, 6000, {
          headers: {
            'X-Api-Key': key
          }
        })
          .then(function(res) {
            if (!res.ok) throw new Error('NewsAPI HTTP ' + res.status);
            return res.json();
          })
          .then(function(data) {
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
                  provider: 'newsapi',
                  providerName: 'NewsAPI',
                  isWrapper: false
                });
              }
            }
            if (results.length === 0) throw new Error('No valid https articles found in NewsAPI response');
            return results;
          });
      },

      currents: function(city, countryCode) {
        var self = ApiService;
        var key = (self.currentsApiKey || '').trim();
        if (!key) {
          return Promise.reject(new Error('Currents API key missing'));
        }

        var cleanCity = (city && String(city).trim()) || 'Local';
        var cleanCountry = (countryCode && String(countryCode).trim().toUpperCase()) || '';

        var url = 'https://api.currentsapi.services/v1/search?keywords=' + encodeURIComponent(cleanCity);
        if (cleanCountry && cleanCountry.length === 2) {
          url += '&country=' + encodeURIComponent(cleanCountry.toLowerCase());
        }

        return self.fetchWithTimeout(url, 6000, {
          headers: {
            'Authorization': key
          }
        })
          .then(function(res) {
            if (!res.ok) throw new Error('Currents HTTP ' + res.status);
            return res.json();
          })
          .then(function(data) {
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
                  provider: 'currents',
                  providerName: 'Currents News',
                  isWrapper: false
                });
              }
            }
            if (results.length === 0) throw new Error('No valid https articles found in Currents response');
            return results;
          });
      }
    },

    NEWS_CACHE_TTL_MS: 15 * 60 * 1000,
    _activeNewsPromise: null,

    getNewsRotateCursor: function() {
      try {
        if (typeof localStorage !== 'undefined') {
          var val = parseInt(localStorage.getItem('local_wally_news_rotate_cursor'), 10);
          if (!isNaN(val) && val >= 0) return val;
        }
      } catch (e) {}
      return 0;
    },

    setNewsRotateCursor: function(cursor) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('local_wally_news_rotate_cursor', String(cursor));
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
     * Regional news dispatcher with 15-minute cache firewall, rotation when keyed providers exist,
     * in-flight request de-duplication, safe https validation, and single Google News fallback.
     */
    fetchNews: function(cityName, countryCode, forceRefresh) {
      var self = this;
      var cleanCity = (cityName && String(cityName).trim()) || 'Local Area';
      var cleanCountry = (countryCode && String(countryCode).trim().toUpperCase()) || 'US';
      if (cleanCountry.length !== 2) cleanCountry = 'US';
      var queryKey = cleanCity.toLowerCase() + '_' + cleanCountry.toLowerCase();

      // Check 15-minute cache firewall: survives reloads, prevents duplicate requests
      var cachedEnvelope = self.getCachedNews();
      var now = Date.now();
      if (!forceRefresh && cachedEnvelope && cachedEnvelope.timestamp) {
        var age = now - cachedEnvelope.timestamp;
        if (age >= 0 && age < self.NEWS_CACHE_TTL_MS && Array.isArray(cachedEnvelope.data) && cachedEnvelope.data.length > 0) {
          return Promise.resolve(cachedEnvelope.data);
        }
      }

      // In-flight request de-duplication
      if (self._activeNewsPromise) {
        return self._activeNewsPromise;
      }

      var eligible = ['google-news'];
      if (self.newsApiKey && String(self.newsApiKey).trim().length > 0) {
        eligible.push('newsapi');
      }
      if (self.currentsApiKey && String(self.currentsApiKey).trim().length > 0) {
        eligible.push('currents');
      }

      var shouldRotate = (self.newsProvider === 'rotate') || (eligible.length > 1);
      var primaryProvider = 'google-news';

      if (shouldRotate) {
        var cursor = self.getNewsRotateCursor();
        primaryProvider = eligible[cursor % eligible.length];
        self.setNewsRotateCursor((cursor + 1) % eligible.length);
      } else {
        var selected = (self.newsProvider || 'google-news').toLowerCase();
        if (selected === 'newsapi' && (!self.newsApiKey || !self.newsApiKey.trim())) {
          primaryProvider = 'google-news';
        } else if (selected === 'currents' && (!self.currentsApiKey || !self.currentsApiKey.trim())) {
          primaryProvider = 'google-news';
        } else {
          primaryProvider = selected;
        }
      }

      function executeAdapter(prov) {
        var fn = self.NewsAdapter[prov] || self.NewsAdapter['google-news'];
        return fn.call(self, cleanCity, cleanCountry);
      }

      self._activeNewsPromise = executeAdapter(primaryProvider)
        .then(function(articles) {
          if (!articles || articles.length === 0) throw new Error('No articles from ' + primaryProvider);
          self.setCachedNews(primaryProvider, queryKey, articles);
          return articles;
        })
        .catch(function(err) {
          console.warn('[ApiService] Primary news provider ' + primaryProvider + ' failed:', err.message);
          if (primaryProvider !== 'google-news') {
            console.log('[ApiService] Falling back once to Google News...');
            return executeAdapter('google-news').then(function(fallbackArticles) {
              if (fallbackArticles && fallbackArticles.length > 0) {
                self.setCachedNews('google-news', queryKey, fallbackArticles);
                return fallbackArticles;
              }
              throw new Error('Google News fallback returned empty feed');
            });
          }
          throw err;
        })
        .catch(function(fatalErr) {
          console.warn('[ApiService] News fetch failed completely, checking cached or curated:', fatalErr.message);
          if (cachedEnvelope && Array.isArray(cachedEnvelope.data) && cachedEnvelope.data.length > 0) {
            return cachedEnvelope.data;
          }
          return self.getCuratedNews(cleanCity);
        })
        .finally(function() {
          self._activeNewsPromise = null;
        });

      return self._activeNewsPromise;
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
          return Promise.resolve(cached);
        }
      }

      return self.getLocation().then(function(loc) {
        // Fetch news asynchronously in the background so it never blocks ready weather updates
        var newsPromise = self.fetchNews(loc.city, loc.countryCode || loc.country, forceRefresh)
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
          var aqi = aqiResult.aqi || aqiResult;
          var hourlyAqi = aqiResult.hourlyAqi || null;

          var hourlyForecast = self.normalizeForecastPoints(rawHourly, weather, aqi, hourlyAqi);
          weather.hourlyForecast = hourlyForecast;

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
                news: [],
                background: bg,
                fromCache: false
              };

              if (global.CacheManager) {
                global.CacheManager.set(payload, providerContext);
              }

              // When background news settles, attach to payload, persist, and update UI without overwriting newer weather
              newsPromise.then(function(newsArticles) {
                if (newsArticles && newsArticles.length) {
                  payload.news = newsArticles;
                  if (global.CacheManager) {
                    var currentCached = global.CacheManager.get(providerContext);
                    if (currentCached) {
                      currentCached.news = newsArticles;
                      global.CacheManager.set(currentCached, providerContext);
                    } else {
                      global.CacheManager.set(payload, providerContext);
                    }
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
              });

              return payload;
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
              return anyCached;
            }
            return global.CacheManager.getMockData();
          }
          throw err;
        });
      });
    }
  };

  global.ApiService = ApiService;
})(typeof window !== 'undefined' ? window : this);
