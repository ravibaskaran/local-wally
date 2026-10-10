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
     * Fetches current weather and daily forecast from Open-Meteo
     */
    fetchWeather: function(lat, lon) {
      var url = 'https://api.open-meteo.com/v1/forecast?' +
        'latitude=' + encodeURIComponent(lat) +
        '&longitude=' + encodeURIComponent(lon) +
        '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m' +
        '&daily=temperature_2m_max,temperature_2m_min' +
        '&timezone=auto';

      return this.fetchWithTimeout(url, 5000)
        .then(function(res) {
          if (!res.ok) throw new Error('Open-Meteo weather HTTP ' + res.status);
          return res.json();
        })
        .then(function(data) {
          var current = data.current || {};
          var daily = data.daily || {};
          var wmo = current.weather_code != null ? current.weather_code : 0;
          var wmoMeta = ApiService.interpretWmoCode(wmo);

          var tempC = current.temperature_2m != null ? current.temperature_2m : 20.0;
          var apparentC = current.apparent_temperature != null ? current.apparent_temperature : tempC;
          var tempMaxC = (daily.temperature_2m_max && daily.temperature_2m_max[0] != null) ? daily.temperature_2m_max[0] : (tempC + 3);
          var tempMinC = (daily.temperature_2m_min && daily.temperature_2m_min[0] != null) ? daily.temperature_2m_min[0] : (tempC - 4);

          return {
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
        });
    },

    /**
     * Fetches Air Quality Indices from Open-Meteo AQI API
     */
    fetchAqi: function(lat, lon) {
      var url = 'https://air-quality-api.open-meteo.com/v1/air-quality?' +
        'latitude=' + encodeURIComponent(lat) +
        '&longitude=' + encodeURIComponent(lon) +
        '&current=european_aqi,pm10,pm2_5';

      return this.fetchWithTimeout(url, 5000)
        .then(function(res) {
          if (!res.ok) throw new Error('Open-Meteo AQI HTTP ' + res.status);
          return res.json();
        })
        .then(function(data) {
          var cur = data.current || {};
          var eq = cur.european_aqi != null ? cur.european_aqi : 20;
          var meta = ApiService.interpretEuropeanAqi(eq);
          return {
            europeanAqi: meta.value,
            category: meta.category,
            color: meta.color,
            pm2_5: cur.pm2_5 != null ? Math.round(cur.pm2_5 * 10) / 10 : 8.0,
            pm10: cur.pm10 != null ? Math.round(cur.pm10 * 10) / 10 : 14.0
          };
        })
        .catch(function(err) {
          console.warn('[ApiService] AQI fetch error, using fallback:', err.message);
          return {
            europeanAqi: 22,
            category: 'Good',
            color: '#10b981',
            pm2_5: 7.5,
            pm10: 12.0
          };
        });
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
          return Promise.resolve(cached);
        }
      }

      return self.getLocation().then(function(loc) {
        return Promise.all([
          self.fetchWeather(loc.latitude, loc.longitude),
          self.fetchAqi(loc.latitude, loc.longitude),
          self.fetchRegionalNews(loc.city, loc.countryCode || loc.country)
        ]).then(function(results) {
          var weather = results[0];
          var aqi = results[1];
          var news = results[2];

          return self.fetchContextualImage(weather.category, weather.isDay, weather.keyword)
            .then(function(bg) {
              var payload = {
                timestamp: Date.now(),
                location: loc,
                weather: weather,
                aqi: aqi,
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
