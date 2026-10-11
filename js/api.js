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
    unsplashApiKey: (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.unsplashApiKey) || '',

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
          return new Promise(function(resolveFetch, rejectFetch) {
            var timer = setTimeout(function() {
              rejectFetch(new Error('Fetch timeout: ' + url));
            }, timeoutMs || 3500);

            fetch(url, { cache: 'no-store' })
              .then(function(res) {
                clearTimeout(timer);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
              })
              .then(function(data) {
                resolveFetch(data);
              })
              .catch(function(err) {
                clearTimeout(timer);
                rejectFetch(err);
              });
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
              cb(formatLocation(defLat, defLon, defCity, 'Local Region', defCountry, 'US', 'default'));
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
    interpretEuropeanAqi: function(val) {
      if (typeof val !== 'number') {
        return { value: 20, category: 'Good', color: '#10b981' };
      }
      if (val <= 20) return { value: Math.round(val), category: 'Good', color: '#10b981' };
      if (val <= 40) return { value: Math.round(val), category: 'Fair', color: '#3b82f6' };
      if (val <= 60) return { value: Math.round(val), category: 'Moderate', color: '#f59e0b' };
      if (val <= 80) return { value: Math.round(val), category: 'Poor', color: '#ef4444' };
      return { value: Math.round(val), category: 'Very Poor', color: '#8b5cf6' };
    },

    /**
     * Resilient fetch helper with timeout guard
     */
    fetchWithTimeout: function(url, timeoutMs, options) {
      return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() {
          reject(new Error('Network request timed out: ' + url));
        }, timeoutMs || 5000);

        fetch(url, options)
          .then(function(res) {
            clearTimeout(timer);
            resolve(res);
          })
          .catch(function(err) {
            clearTimeout(timer);
            reject(err);
          });
      });
    },

    /**
     * Map OpenWeatherMap Condition ID to WMO Code
     */
    owmToWmo: function(id) {
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
      var baseAqi = (aqi && typeof aqi.europeanAqi === 'number') ? aqi.europeanAqi : 22;
      var cond = (weather && weather.conditionText) || 'Partly Cloudy';

      for (var i = 0; i < 8; i++) {
        var h = (baseHour + i * 3) % 24;
        var lbl = (i === 0) ? 'Now' : ((h % 12 || 12) + (h >= 12 ? ' PM' : ' AM'));
        var offset = Math.sin((h - 8) / 24 * Math.PI * 2) * 3.2;
        var tC = Math.round((baseTemp + offset) * 10) / 10;
        var tF = Math.round(((tC * 9 / 5) + 32) * 10) / 10;
        var windK = Math.round((baseWind + Math.cos(i) * 2.0) * 10) / 10;
        var aqiVal = Math.max(5, Math.min(100, Math.round(baseAqi + Math.sin(i) * 4)));
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
     */
    normalizeForecastPoints: function(points, weather, aqi, hourlyAqi) {
      if (!points || !points.length || points.length < 8) {
        return this.generateSyntheticForecast(weather, aqi);
      }
      var baseAqi = (aqi && typeof aqi.europeanAqi === 'number') ? aqi.europeanAqi : 22;
      for (var i = 0; i < points.length; i++) {
        var pt = points[i];
        var ptAqiVal = (hourlyAqi && hourlyAqi[pt.hour] != null) ? hourlyAqi[pt.hour] : baseAqi;
        var meta = this.interpretEuropeanAqi(ptAqiVal);
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
          isDay: current.is_day != null ? current.is_day : 1
        };

        var hourlyForecast = [];
        var timeArr = hourly.time || [];
        var count = Math.min(24, timeArr.length);
        var step = count >= 8 ? Math.floor(count / 8) : 1;
        for (var i = 0; i < 8; i++) {
          var idx = Math.min(i * step, count - 1);
          if (idx >= 0 && timeArr[idx]) {
            var tStr = timeArr[idx];
            var m = tStr.match(/T(\d\d):/);
            var h = m ? parseInt(m[1], 10) : ((new Date().getHours() + i * 3) % 24);
            var lbl = (i === 0) ? 'Now' : ((h % 12 || 12) + (h >= 12 ? ' PM' : ' AM'));
            var ptTempC = (hourly.temperature_2m && hourly.temperature_2m[idx] != null) ? hourly.temperature_2m[idx] : tempC;
            var ptAppC = (hourly.apparent_temperature && hourly.apparent_temperature[idx] != null) ? hourly.apparent_temperature[idx] : ptTempC;
            var ptPrecipProb = (hourly.precipitation_probability && hourly.precipitation_probability[idx] != null) ? hourly.precipitation_probability[idx] : 0;
            var ptPrecipMm = (hourly.precipitation && hourly.precipitation[idx] != null) ? hourly.precipitation[idx] : 0.0;
            var ptWindKm = (hourly.wind_speed_10m && hourly.wind_speed_10m[idx] != null) ? hourly.wind_speed_10m[idx] : weather.windSpeedKm;
            var ptHum = (hourly.relative_humidity_2m && hourly.relative_humidity_2m[idx] != null) ? hourly.relative_humidity_2m[idx] : weather.humidity;
            var ptWmo = (hourly.weather_code && hourly.weather_code[idx] != null) ? hourly.weather_code[idx] : wmo;

            hourlyForecast.push({
              time: (h < 10 ? '0' : '') + h + ':00',
              label: lbl,
              hour: h,
              tempC: Math.round(ptTempC * 10) / 10,
              tempF: Math.round(((ptTempC * 9 / 5) + 32) * 10) / 10,
              apparentC: Math.round(ptAppC * 10) / 10,
              apparentF: Math.round(((ptAppC * 9 / 5) + 32) * 10) / 10,
              precipProb: Math.round(ptPrecipProb),
              precipMm: Math.round(ptPrecipMm * 10) / 10,
              windSpeedKm: Math.round(ptWindKm * 10) / 10,
              windSpeedMph: Math.round((ptWindKm * 0.621371) * 10) / 10,
              humidity: Math.round(ptHum),
              aqi: 20,
              aqiColor: '#10b981',
              aqiCategory: 'Good',
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
          isDay: sym.indexOf('night') === -1 ? 1 : 0
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
            var m = tStr.match(/T(\d\d):/);
            var h = m ? parseInt(m[1], 10) : ((new Date().getHours() + p * 3) % 24);
            var lbl = (p === 0) ? 'Now' : ((h % 12 || 12) + (h >= 12 ? ' PM' : ' AM'));
            var ptT = ptDetails.air_temperature != null ? ptDetails.air_temperature : tempC;
            var ptWind = ptDetails.wind_speed != null ? Math.round(ptDetails.wind_speed * 3.6 * 10) / 10 : windSpeedKm;
            var ptHum = ptDetails.relative_humidity != null ? ptDetails.relative_humidity : humidity;
            var ptP = (ptNext.details && ptNext.details.precipitation_amount != null) ? ptNext.details.precipitation_amount : 0.0;
            var ptProb = (ptNext.details && ptNext.details.probability_of_precipitation != null) ? ptNext.details.probability_of_precipitation : (ptP > 0 ? 65 : 0);

            hourlyForecast.push({
              time: (h < 10 ? '0' : '') + h + ':00',
              label: lbl,
              hour: h,
              tempC: Math.round(ptT * 10) / 10,
              tempF: Math.round(((ptT * 9 / 5) + 32) * 10) / 10,
              apparentC: Math.round(ptT * 10) / 10,
              apparentF: Math.round(((ptT * 9 / 5) + 32) * 10) / 10,
              precipProb: Math.round(ptProb),
              precipMm: Math.round(ptP * 10) / 10,
              windSpeedKm: ptWind,
              windSpeedMph: Math.round(ptWind * 0.621371 * 10) / 10,
              humidity: Math.round(ptHum),
              aqi: 20,
              aqiColor: '#10b981',
              aqiCategory: 'Good',
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
        var directUrl = 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon);
        var primaryProxy = (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.primaryCorsProxy) || 'https://api.allorigins.win/raw?url=';
        var fallbackProxy = (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.fallbackCorsProxy) || 'https://corsproxy.io/?url=';

        function requestMet() {
          return ApiService.fetchWithTimeout(directUrl, 4000)
            .then(function(res) {
              if (!res.ok) throw new Error('HTTP ' + res.status);
              return res.json();
            })
            .catch(function() {
              return ApiService.fetchWithTimeout(primaryProxy + encodeURIComponent(directUrl), 4500)
                .then(function(res) {
                  if (!res.ok) throw new Error('HTTP ' + res.status);
                  return res.json();
                })
                .catch(function() {
                  return ApiService.fetchWithTimeout(fallbackProxy + encodeURIComponent(directUrl), 4500)
                    .then(function(res) {
                      if (!res.ok) throw new Error('HTTP ' + res.status);
                      return res.json();
                    });
                });
            });
        }

        return requestMet()
          .then(function(data) {
            return ApiService.WeatherAdapter.normalizeMetNorway(data);
          })
          .catch(function(err) {
            console.warn('[ApiService] MET Norway fetch failed, falling back to open-meteo:', err.message);
            return ApiService.WeatherAdapter['open-meteo'](lat, lon, options);
          });
      },

      normalizeOpenWeatherMap: function(data) {
        var list = data.list || data.hourly || [];
        if (!list.length) throw new Error('Empty OpenWeatherMap list');

        var cur = list[0];
        var main = cur.main || cur || {};
        var wind = cur.wind || cur || {};
        var weather0 = (cur.weather && cur.weather[0]) || {};
        var wmo = ApiService.owmToWmo(weather0.id || 800);
        var wmoMeta = ApiService.interpretWmoCode(wmo);

        var tempC = (main.temp != null) ? main.temp : (cur.temp != null ? cur.temp : 20.0);
        var apparentC = (main.feels_like != null) ? main.feels_like : (cur.feels_like != null ? cur.feels_like : tempC);
        var rawWind = (wind.speed != null) ? wind.speed : (cur.wind_speed != null ? cur.wind_speed : 2.8);
        var windSpeedKm = Math.round(rawWind * 3.6 * 10) / 10;
        var humidity = (main.humidity != null) ? main.humidity : (cur.humidity != null ? cur.humidity : 55);
        var precipMm = (cur.rain && cur.rain['3h'] != null) ? (cur.rain['3h'] / 3) : 0.0;

        var maxT = tempC;
        var minT = tempC;
        var checkCount = Math.min(8, list.length);
        for (var c = 0; c < checkCount; c++) {
          var itemT = (list[c].main && list[c].main.temp != null) ? list[c].main.temp : list[c].temp;
          if (itemT != null) {
            if (itemT > maxT) maxT = itemT;
            if (itemT < minT) minT = itemT;
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
          isDay: (weather0.icon && weather0.icon.indexOf('n') !== -1) ? 0 : 1
        };

        var hourlyForecast = [];
        for (var i = 0; i < 8 && i < list.length; i++) {
          var item = list[i];
          var iMain = item.main || item || {};
          var iWind = item.wind || item || {};
          var iW = (item.weather && item.weather[0]) || {};
          var iWmo = ApiService.owmToWmo(iW.id || 800);
          var dt = item.dt ? new Date(item.dt * 1000) : new Date(Date.now() + i * 3 * 3600000);
          var h = dt.getHours();
          var lbl = (i === 0) ? 'Now' : ((h % 12 || 12) + (h >= 12 ? ' PM' : ' AM'));
          var ptT = (iMain.temp != null) ? iMain.temp : (item.temp != null ? item.temp : tempC);
          var ptApp = (iMain.feels_like != null) ? iMain.feels_like : (item.feels_like != null ? item.feels_like : ptT);
          var ptRawWind = (iWind.speed != null) ? iWind.speed : (item.wind_speed != null ? item.wind_speed : 2.8);
          var ptWind = Math.round(ptRawWind * 3.6 * 10) / 10;
          var ptHum = (iMain.humidity != null) ? iMain.humidity : (item.humidity != null ? item.humidity : humidity);
          var ptProb = item.pop != null ? Math.round(item.pop * 100) : 0;
          var ptP = (item.rain && item.rain['3h'] != null) ? (item.rain['3h'] / 3) : 0.0;

          hourlyForecast.push({
            time: (h < 10 ? '0' : '') + h + ':00',
            label: lbl,
            hour: h,
            tempC: Math.round(ptT * 10) / 10,
            tempF: Math.round(((ptT * 9 / 5) + 32) * 10) / 10,
            apparentC: Math.round(ptApp * 10) / 10,
            apparentF: Math.round(((ptApp * 9 / 5) + 32) * 10) / 10,
            precipProb: ptProb,
            precipMm: Math.round(ptP * 10) / 10,
            windSpeedKm: ptWind,
            windSpeedMph: Math.round(ptWind * 0.621371 * 10) / 10,
            humidity: Math.round(ptHum),
            aqi: 20,
            aqiColor: '#10b981',
            aqiCategory: 'Good',
            conditionText: ApiService.interpretWmoCode(iWmo).text
          });
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

        var url = 'https://api.openweathermap.org/data/2.5/forecast?lat=' + encodeURIComponent(lat) +
          '&lon=' + encodeURIComponent(lon) +
          '&appid=' + encodeURIComponent(key) +
          '&units=metric';

        return ApiService.fetchWithTimeout(url, 5000)
          .then(function(res) {
            if (!res.ok) throw new Error('OpenWeatherMap HTTP ' + res.status);
            return res.json();
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
          europeanAqi: meta.value,
          aqi: meta.value,
          category: meta.category,
          color: meta.color,
          badgeColor: meta.color,
          pm2_5: cur.pm2_5 != null ? Math.round(cur.pm2_5 * 10) / 10 : 8.0,
          pm25: cur.pm2_5 != null ? Math.round(cur.pm2_5 * 10) / 10 : 8.0,
          pm10: cur.pm10 != null ? Math.round(cur.pm10 * 10) / 10 : 14.0
        };
        var hourlyAqi = (data.hourly && data.hourly.european_aqi) || null;
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
          var pm25 = (d.iaqi && d.iaqi.pm25 && d.iaqi.pm25.v != null) ? d.iaqi.pm25.v : 8.0;
          var pm10 = (d.iaqi && d.iaqi.pm10 && d.iaqi.pm10.v != null) ? d.iaqi.pm10.v : 14.0;

          var aqi = {
            europeanAqi: meta.value,
            aqi: meta.value,
            category: meta.category,
            color: meta.color,
            badgeColor: meta.color,
            pm2_5: Math.round(pm25 * 10) / 10,
            pm25: Math.round(pm25 * 10) / 10,
            pm10: Math.round(pm10 * 10) / 10
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
          var pm25_2 = (d2.iaqi && d2.iaqi.pm25 && d2.iaqi.pm25.v != null) ? d2.iaqi.pm25.v : 8.0;
          var pm10_2 = (d2.iaqi && d2.iaqi.pm10 && d2.iaqi.pm10.v != null) ? d2.iaqi.pm10.v : 14.0;

          var aqi2 = {
            europeanAqi: meta2.value,
            aqi: meta2.value,
            category: meta2.category,
            color: meta2.color,
            badgeColor: meta2.color,
            pm2_5: Math.round(pm25_2 * 10) / 10,
            pm25: Math.round(pm25_2 * 10) / 10,
            pm10: Math.round(pm10_2 * 10) / 10
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
            console.warn('[ApiService] AQI fetch error, using fallback:', err.message);
            var fallbackAqi = {
              europeanAqi: 22,
              aqi: 22,
              category: 'Good',
              color: '#10b981',
              badgeColor: '#10b981',
              pm2_5: 7.5,
              pm25: 7.5,
              pm10: 12.0
            };
            return Object.assign({}, fallbackAqi, {
              aqi: fallbackAqi,
              hourlyAqi: null
            });
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

    /**
     * Contextual Image Loader with Unsplash API integration and curated fallbacks.
     * Enforces dynamic native resolution matching (&w=${width}&h=${height}&fit=crop&q=85)
     * for seamless 1:1 pixel screen fill.
     */
    fetchContextualImage: function(weatherCategory, isDay, customKeyword) {
      var self = this;
      return new Promise(function(resolve) {
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

        var nativeRes = self.getNativeResolution();
        var defaultFallbackUrl = fallbackSet[Math.floor(Math.random() * fallbackSet.length)];
        var formattedFallbackUrl = self.formatImageUrl(defaultFallbackUrl, nativeRes.width, nativeRes.height);

        // If no user API key, return curated scenic landscape formatted with native resolution immediately
        if (!key) {
          resolve({
            url: formattedFallbackUrl,
            photographer: 'Ambient Nature',
            photographerUrl: 'https://unsplash.com'
          });
          return;
        }

        var searchQuery = customKeyword || (isDay ? 'nature landscape' : 'night sky landscape');
        var apiUrl = 'https://api.unsplash.com/photos/random?query=' +
          encodeURIComponent(searchQuery) +
          '&orientation=landscape&featured=true' +
          '&w=' + nativeRes.width + '&h=' + nativeRes.height;

        self.fetchWithTimeout(apiUrl, 6000, {
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
              resolve({
                url: finalUrl,
                photographer: (photo.user && photo.user.name) || 'Unsplash Artist',
                photographerUrl: (photo.user && photo.user.links && photo.user.links.html) || 'https://unsplash.com'
              });
            } else {
              throw new Error('Invalid Unsplash payload');
            }
          })
          .catch(function(err) {
            console.warn('[ApiService] Unsplash query failed, using resolution-scaled fallback:', err.message);
            resolve({
              url: formattedFallbackUrl,
              photographer: 'Ambient Nature',
              photographerUrl: 'https://unsplash.com'
            });
          });
      });
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
          link: 'https://news.google.com'
        },
        {
          title: 'Global energy grid resilience metrics show steady gains across smart sectors',
          source: 'Reuters Tech',
          link: 'https://news.google.com'
        },
        {
          title: 'Satellite observations confirm historical seasonal solar irradiance patterns',
          source: 'Science Daily',
          link: 'https://news.google.com'
        },
        {
          title: 'Regional urban infrastructure upgrades incorporate high-efficiency sensors',
          source: 'Associated Press',
          link: 'https://news.google.com'
        },
        {
          title: 'High-precision environmental monitoring standards adopted for smart cities',
          source: 'Nature Ambient',
          link: 'https://news.google.com'
        }
      ];
    },

    /**
     * Proximity-targeted regional news feed via Google News RSS & XML DOMParser
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

        function fetchWithTimeout(url, timeoutMs) {
          return new Promise(function(resolve, reject) {
            var isDone = false;
            var timer = setTimeout(function() {
              isDone = true;
              reject(new Error('Gateway timeout'));
            }, timeoutMs || 5000);

            fetch(url)
              .then(function(res) {
                clearTimeout(timer);
                if (!isDone) {
                  if (!res.ok) reject(new Error('HTTP ' + res.status));
                  else resolve(res.text());
                }
              })
              .catch(function(err) {
                clearTimeout(timer);
                if (!isDone) reject(err);
              });
          });
        }

        return fetchWithTimeout(primaryUrl, 5000).catch(function() {
          return fetchWithTimeout(fallbackProxyUrl, 5000);
        });
      }

      function parseItems(xmlString) {
        if (!xmlString || typeof xmlString !== 'string') {
          throw new Error('Empty XML response');
        }

        var parser = new DOMParser();
        var xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        var parseError = xmlDoc.querySelector('parsererror');
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

          if (cleanTitle) {
            articles.push({
              title: cleanTitle,
              source: sourceName || 'Google News',
              link: safeLink
            });
          }
        }

        if (articles.length === 0) {
          throw new Error('No news items found in feed');
        }
        return articles;
      }

      return requestXml(geoUrl)
        .then(parseItems)
        .catch(function() {
          return requestXml(fallbackUrl).then(parseItems);
        })
        .catch(function(err) {
          console.warn('[ApiService] Regional news fetch error, using curated dispatch fallback:', err.message);
          return self.getCuratedNews(cleanCity);
        });
    },

    /**
     * Unified Atmosphere Ingestion Pipeline guarded by 15-minute Cache Firewall
     * @param {boolean} forceRefresh Ignore cache if true
     * @returns {Promise<Object>} Complete atmosphere snapshot
     */
    fetchAtmosphere: function(forceRefresh) {
      var self = this;

      if (!forceRefresh && global.CacheManager) {
        var cached = global.CacheManager.get();
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
        var wProv = self.weatherProvider || 'open-meteo';
        var aProv = self.aqiProvider || 'open-meteo';

        return Promise.all([
          self.fetchWeather(loc.latitude, loc.longitude, wProv),
          self.fetchAqi(loc.latitude, loc.longitude, aProv),
          self.fetchRegionalNews(loc.city, loc.countryCode || loc.country)
        ]).then(function(results) {
          var weatherResult = results[0] || {};
          var aqiResult = results[1] || {};
          var news = results[2] || [];

          var weather = weatherResult.weather || weatherResult;
          var rawHourly = weatherResult.hourlyForecast || [];
          var aqi = aqiResult.aqi || aqiResult;
          var hourlyAqi = aqiResult.hourlyAqi || null;

          var hourlyForecast = self.normalizeForecastPoints(rawHourly, weather, aqi, hourlyAqi);
          weather.hourlyForecast = hourlyForecast;

          return self.fetchContextualImage(weather.category, weather.isDay, weather.keyword)
            .then(function(bg) {
              var payload = {
                timestamp: Date.now(),
                location: loc,
                weather: weather,
                aqi: aqi,
                hourlyForecast: hourlyForecast,
                news: news,
                background: bg,
                fromCache: false
              };

              if (global.CacheManager) {
                global.CacheManager.set(payload);
              }

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
