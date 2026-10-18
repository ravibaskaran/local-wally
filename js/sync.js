/**
 * OneDriveSync - Cloud Settings Synchronization Engine
 * Implements OAuth 2.0 Device Authorization Grant (RFC 8628)
 * and Microsoft Graph AppFolder profile synchronization.
 *
 * All network activity is local-first, backgrounded, and non-blocking.
 * Location data, coordinates, history, operational caches, and tokens
 * are strictly excluded from the synchronized cloud payload.
 */
(function(global) {
  'use strict';

  var DEFAULT_CLIENT_ID = 'd50ca740-c83f-4d1b-b616-12c519384f0c';
  var AUTH_STORAGE_KEY = 'local_wally_onedrive_auth';
  var SYNC_META_STORAGE_KEY = 'local_wally_onedrive_sync_meta';
  var SETTINGS_FILENAME = 'local-wally-settings.json';
  var REQUEST_TIMEOUT_MS = 3500;
  var SCOPE = 'Files.ReadWrite Files.ReadWrite.AppFolder offline_access';

  // Strict allowlist of setting keys that may enter the cloud profile
  var ALLOWED_SETTINGS_KEYS = [
    'hudPosition', 'glassBlur', 'particleDensity', 'tempUnit', 'refreshInterval',
    'wallpaperProvider', 'unsplashApiKey', 'wallhavenApiKey', 'pexelsApiKey',
    'pixabayApiKey', 'weatherSimulation', 'contrastMode', 'showMediaFocusDock',
    'showNewsFeed', 'newsProvider', 'newsApiKey', 'currentsApiKey', 'newsFocus', 'onedriveFolder',
    'showHardwareMonitor', 'showNetworkUsage', 'showBatteryInfo', 'showCelestial',
    'showAqi', 'showEnvironmentalMetrics', 'weatherProvider',
    'weatherapiKey', 'openweathermapApiKey', 'aqiProvider', 'waqiApiKey',
    'showForecastChart', 'defaultForecastTab', 'showPomodoro', 'showMediaPlayer',
    'focusTimerMode', 'pomodoroFocusMinutes', 'pomodoroBreakMinutes', 'pomodoroLongBreakMinutes',
    'enableAudioVisualizer', 'enableDynamicSolarLighting'
  ];

  // Forbidden keys pattern to ensure no location or credentials leak
  var FORBIDDEN_KEY_PATTERN = /(customLocation|lastGpsLocation|lastKnownCity|latitude|longitude|coords|location|token|auth|secret|password|cache)/i;

  var OneDriveSync = {
    DEFAULT_CLIENT_ID: DEFAULT_CLIENT_ID,
    CLIENT_ID: DEFAULT_CLIENT_ID,
    REDIRECT_URI: 'https://login.microsoftonline.com/common/oauth2/nativeclient',
    SCOPE: SCOPE,
    TIMEOUT_MS: REQUEST_TIMEOUT_MS,
    clientId: DEFAULT_CLIENT_ID,
    state: 'not_connected', // 'not_connected', 'checking', 'up_to_date', 'syncing', 'auth_pending', 'sign_in_needed', 'offline', 'conflict', 'error'
    lastSyncTime: 0,
    lastError: null,
    activeDeviceAuth: null,
    _pollTimer: null,
    _syncInFlight: false,

    folderPath: 'Apps/Local Wally',
    FOLDER_STORAGE_KEY: 'local_wally_onedrive_folder',

    setFolderPath: function(folder) {
      var sanitized = (folder || '').trim().replace(/^[\/\\]+|[\/\\]+$/g, '').replace(/\\/g, '/');
      this.folderPath = sanitized || 'Apps/Local Wally';
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(this.FOLDER_STORAGE_KEY, this.folderPath);
        }
      } catch (e) {}
      return this.folderPath;
    },

    getStoredFolderPath: function() {
      try {
        if (typeof localStorage !== 'undefined') {
          var stored = localStorage.getItem(this.FOLDER_STORAGE_KEY);
          if (stored) return stored.trim();
        }
      } catch (e) {}
      return null;
    },

    getEndpoint: function(isContent) {
      var folder = (this.folderPath || '').trim().replace(/^[\/\\]+|[\/\\]+$/g, '').replace(/\\/g, '/');
      var base;
      if (!folder || folder.toLowerCase() === 'apps/local wally' || folder.toLowerCase() === 'special/approot') {
        base = 'https://graph.microsoft.com/v1.0/me/drive/special/approot:/' + SETTINGS_FILENAME;
      } else {
        var segments = folder.split('/').map(encodeURIComponent).join('/');
        base = 'https://graph.microsoft.com/v1.0/me/drive/root:/' + segments + '/' + SETTINGS_FILENAME;
      }
      return isContent ? (base + ':/content') : base;
    },

    init: function(options) {
      options = options || {};
      var cfg = (global.LOCAL_WALLY_CONFIG && global.LOCAL_WALLY_CONFIG.oneDrive) || {};
      this.clientId = options.clientId || cfg.clientId || DEFAULT_CLIENT_ID;
      var storedFolder = this.getStoredFolderPath();
      this.folderPath = options.folderPath || storedFolder || (cfg && cfg.folderPath) || 'Apps/Local Wally';

      var auth = this.getStoredAuth();
      if (auth && auth.refreshToken) {
        this.state = 'up_to_date';
        var meta = this.getStoredSyncMeta();
        this.lastSyncTime = meta ? (meta.lastSyncTime || 0) : 0;
        // Boot metadata is checked during scheduled sync to avoid duplicate requests (LW16)
      } else {
        this.state = 'not_connected';
        var self = this;
        if (typeof global.fetch === 'function') {
          try {
            global.fetch('onedrive_tokens.json').then(function(res) {
              if (res && res.ok) return res.json();
            }).then(function(tokens) {
              if (tokens && tokens.refreshToken && !self.isConnected()) {
                self.setStoredAuth(tokens);
                self.state = 'up_to_date';
                var meta = self.getStoredSyncMeta();
                self.lastSyncTime = meta ? (meta.lastSyncTime || 0) : 0;
                self.sync(false);
              }
            }).catch(function() {});
          } catch (e) {}
        }
      }
      return this;
    },

    isConnected: function() {
      var auth = this.getStoredAuth();
      return !!(auth && auth.refreshToken);
    },

    getStatus: function() {
      return {
        connected: this.isConnected(),
        state: this.state,
        lastSyncTime: this.lastSyncTime,
        lastError: this.lastError,
        userCode: this.activeDeviceAuth ? this.activeDeviceAuth.user_code : null,
        verificationUri: this.activeDeviceAuth ? this.activeDeviceAuth.verification_uri : null
      };
    },

    getDeviceId: function() {
      try {
        var id = localStorage.getItem('local_wally_device_id');
        if (!id) {
          id = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
          localStorage.setItem('local_wally_device_id', id);
        }
        return id;
      } catch (e) {
        return 'dev_default';
      }
    },

    getStoredAuth: function() {
      try {
        var raw = localStorage.getItem(AUTH_STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch (e) {}
      return null;
    },

    setStoredAuth: function(auth) {
      try {
        if (!auth) {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        } else {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
        }
      } catch (e) {}
    },

    getStoredSyncMeta: function() {
      try {
        var raw = localStorage.getItem(SYNC_META_STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch (e) {}
      return null;
    },

    setStoredSyncMeta: function(meta) {
      try {
        if (!meta) {
          localStorage.removeItem(SYNC_META_STORAGE_KEY);
        } else {
          localStorage.setItem(SYNC_META_STORAGE_KEY, JSON.stringify(meta));
        }
      } catch (e) {}
    },

    // RFC 8628: Start Device Authorization Grant
    startDeviceAuth: function() {
      var self = this;
      self.lastError = null;
      var endpoint = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode';
      var params = 'client_id=' + encodeURIComponent(self.clientId) +
                   '&scope=' + encodeURIComponent(SCOPE);

      return self._fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      }, 5000).then(function(res) {
        if (!res.ok) throw new Error('Device auth failed with HTTP ' + res.status);
        return res.json();
      }).then(function(data) {
        if (!data || !data.device_code || !data.user_code) {
          throw new Error('Invalid device auth response');
        }
        self.activeDeviceAuth = data;
        self.state = 'auth_pending';

        // Automatically launch default browser to verification portal
        try {
          if (typeof window !== 'undefined' && typeof window.open === 'function') {
            window.open(data.verification_uri || 'https://microsoft.com/devicelogin', '_blank');
          }
        } catch (e) {
          console.warn('[OneDriveSync] Browser launch:', e && e.message);
        }

        // Automatically copy user code to clipboard
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(data.user_code);
          }
        } catch (e) {}

        return data;
      });
    },

    // RFC 8628: Poll token endpoint
    pollToken: function(deviceCode, intervalSeconds, onComplete, onError) {
      var self = this;
      if (self._pollTimer) {
        clearTimeout(self._pollTimer);
        self._pollTimer = null;
      }

      var endpoint = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
      var intervalMs = Math.max(2000, (intervalSeconds || 5) * 1000);
      var deadline = Date.now() + ((self.activeDeviceAuth && self.activeDeviceAuth.expires_in) || 900) * 1000;

      function pollStep() {
        if (!self.activeDeviceAuth) return;
        if (Date.now() > deadline) {
          self.activeDeviceAuth = null;
          self.state = 'not_connected';
          self.lastError = 'Device code expired (timeout). Please try connecting again.';
          if (typeof onError === 'function') onError(new Error(self.lastError));
          return;
        }

        var isPaused = (global.LivelyBridge && global.LivelyBridge.isPaused) ||
                       (typeof document !== 'undefined' && document.hidden);
        if (isPaused) {
          self._pollTimer = setTimeout(pollStep, intervalMs);
          return;
        }

        var params = 'grant_type=urn:ietf:params:oauth:grant-type:device_code' +
                     '&client_id=' + encodeURIComponent(self.clientId) +
                     '&device_code=' + encodeURIComponent(deviceCode);

        self._fetchWithTimeout(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params
        }, 5000).then(function(res) {
          return res.json();
        }).then(function(data) {
          if (data.access_token) {
            // Success!
            var expiresAt = Date.now() + ((data.expires_in || 3600) * 1000) - 60000;
            var auth = {
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              expiresAt: expiresAt
            };
            self.setStoredAuth(auth);
            self.activeDeviceAuth = null;
            self.state = 'up_to_date';
            if (typeof onComplete === 'function') onComplete(auth);
            // Run initial sync after successful auth
            self.sync(false);
          } else if (data.error === 'authorization_pending') {
            self._pollTimer = setTimeout(pollStep, intervalMs);
          } else if (data.error === 'slow_down') {
            intervalMs += 5000;
            self._pollTimer = setTimeout(pollStep, intervalMs);
          } else if (data.error === 'expired_token') {
            self.activeDeviceAuth = null;
            self.state = 'not_connected';
            self.lastError = 'Device code expired. Please try connecting again.';
            if (typeof onError === 'function') onError(new Error(self.lastError));
          } else if (data.error === 'access_denied') {
            self.activeDeviceAuth = null;
            self.state = 'not_connected';
            self.lastError = 'Sign-in was cancelled by user.';
            if (typeof onError === 'function') onError(new Error(self.lastError));
          } else {
            self.activeDeviceAuth = null;
            self.state = 'error';
            self.lastError = data.error_description || data.error || 'Token error';
            if (typeof onError === 'function') onError(new Error(self.lastError));
          }
        }).catch(function(err) {
          // Network hiccup during poll: retry
          self._pollTimer = setTimeout(pollStep, intervalMs);
        });
      }

      self._pollTimer = setTimeout(pollStep, intervalMs);
    },

    cancelDeviceAuth: function() {
      if (this._pollTimer) {
        clearTimeout(this._pollTimer);
        this._pollTimer = null;
      }
      this.activeDeviceAuth = null;
      if (this.state === 'auth_pending') {
        this.state = this.isConnected() ? 'up_to_date' : 'not_connected';
      }
    },

    getOAuthUrl: function() {
      var endpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
      return endpoint + '?client_id=' + encodeURIComponent(this.clientId || DEFAULT_CLIENT_ID) +
        '&response_type=code' +
        '&redirect_uri=' + encodeURIComponent(this.REDIRECT_URI) +
        '&scope=' + encodeURIComponent(SCOPE) +
        '&response_mode=query';
    },

    extractAuthCode: function(codeOrUrl) {
      if (!codeOrUrl || typeof codeOrUrl !== 'string') return null;
      var str = codeOrUrl.trim();
      if (!str) return null;

      var codeIdx = str.indexOf('code=');
      if (codeIdx !== -1) {
        var sub = str.substring(codeIdx + 5);
        var ampIdx = sub.indexOf('&');
        var hashIdx = sub.indexOf('#');
        var endPos = sub.length;
        if (ampIdx !== -1 && ampIdx < endPos) endPos = ampIdx;
        if (hashIdx !== -1 && hashIdx < endPos) endPos = hashIdx;
        var rawCode = sub.substring(0, endPos);
        try {
          return decodeURIComponent(rawCode).trim();
        } catch (e) {
          return rawCode.trim();
        }
      }

      var cleaned = str.replace(/^["']|["']$/g, '').trim();
      return cleaned || null;
    },

    exchangeAuthCode: function(codeOrUrl) {
      var self = this;
      if (codeOrUrl && typeof codeOrUrl === 'string' && codeOrUrl.indexOf('wrongplace') !== -1) {
        return Promise.reject(new Error("You reached the 'wrongplace' page. Click your browser's Back button once to reveal the URL with your code, or run tools/onedrive-login.bat."));
      }
      var code = self.extractAuthCode(codeOrUrl);
      if (!code) {
        return Promise.reject(new Error('Please paste a valid authorization code or redirect URL.'));
      }

      var endpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      var params = 'grant_type=authorization_code' +
                   '&client_id=' + encodeURIComponent(self.clientId || DEFAULT_CLIENT_ID) +
                   '&code=' + encodeURIComponent(code) +
                   '&redirect_uri=' + encodeURIComponent(self.REDIRECT_URI);

      return self._fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      }, 8000).then(function(res) {
        return res.json().catch(function() {
          throw new Error('Invalid JSON response from token endpoint');
        }).then(function(data) {
          if (!res.ok || (data && data.error)) {
            var msg = (data && (data.error_description || data.error)) || ('Token exchange failed with HTTP ' + res.status);
            throw new Error(msg);
          }
          return data;
        });
      }).then(function(data) {
        if (!data || !data.access_token) {
          throw new Error('No access token returned from Microsoft');
        }
        var authRecord = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + ((data.expires_in || 3600) * 1000),
          tokenType: data.token_type || 'Bearer',
          scope: data.scope || SCOPE
        };
        self.setStoredAuth(authRecord);
        self.state = 'up_to_date';
        self.lastError = null;

        // Trigger sync to upload or restore settings immediately
        self.sync(true);

        return data;
      });
    },

    refreshToken: function() {
      var self = this;
      var auth = self.getStoredAuth();
      if (!auth || !auth.refreshToken) {
        self.state = 'sign_in_needed';
        return Promise.reject(new Error('No refresh token available'));
      }

      var endpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      var params = 'grant_type=refresh_token' +
                   '&client_id=' + encodeURIComponent(self.clientId || DEFAULT_CLIENT_ID) +
                   '&refresh_token=' + encodeURIComponent(auth.refreshToken);

      return self._fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      }, 8000).then(function(res) {
        if (!res.ok) {
          if (res.status === 400 || res.status === 401) {
            self.state = 'sign_in_needed';
            self.lastError = 'Sign-in expired. Please reconnect OneDrive.';
          }
          throw new Error('Token refresh HTTP ' + res.status);
        }
        return res.json();
      }).then(function(data) {
        if (!data || !data.access_token) {
          throw new Error('Invalid token refresh response');
        }
        var expiresAt = Date.now() + ((data.expires_in || 3600) * 1000) - 60000;
        var updatedAuth = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || auth.refreshToken,
          expiresAt: expiresAt,
          tokenType: data.token_type || auth.tokenType || 'Bearer',
          scope: data.scope || auth.scope || SCOPE
        };
        self.setStoredAuth(updatedAuth);
        return updatedAuth.accessToken;
      });
    },

    getValidAccessToken: function() {
      var self = this;
      var auth = self.getStoredAuth();
      if (!auth || !auth.refreshToken) {
        self.state = 'not_connected';
        return Promise.reject(new Error('OneDrive not connected'));
      }
      if (auth.accessToken && typeof auth.expiresAt === 'number' && Date.now() < auth.expiresAt) {
        return Promise.resolve(auth.accessToken);
      }
      return self.refreshToken();
    },

    checkRemoteMetadata: function() {
      var self = this;
      return self.getValidAccessToken().then(function(token) {
        var endpoint = self.getEndpoint(false);
        return self._fetchWithTimeout(endpoint, {
          method: 'GET',
          headers: { 'Authorization': 'Bearer ' + token }
        }, REQUEST_TIMEOUT_MS);
      }).then(function(res) {
        if (res.status === 404) {
          return { exists: false, cTag: null, eTag: null, lastModifiedDateTime: null };
        }
        if (!res.ok) throw new Error('Graph metadata check HTTP ' + res.status);
        return res.json().then(function(item) {
          return {
            exists: true,
            id: item.id,
            cTag: item.cTag || null,
            eTag: item.eTag || null,
            lastModifiedDateTime: item.lastModifiedDateTime || null,
            size: item.size || 0
          };
        });
      });
    },

    downloadProfile: function() {
      var self = this;
      return self.getValidAccessToken().then(function(token) {
        var endpoint = self.getEndpoint(true);
        return self._fetchWithTimeout(endpoint, {
          method: 'GET',
          headers: { 'Authorization': 'Bearer ' + token }
        }, REQUEST_TIMEOUT_MS);
      }).then(function(res) {
        if (!res.ok) throw new Error('Graph download HTTP ' + res.status);
        return res.json();
      }).then(function(profile) {
        var valid = self.validateProfile(profile);
        if (!valid.ok) throw new Error('Downloaded profile invalid: ' + valid.error);
        return profile;
      });
    },

    uploadProfile: function(payload, eTag) {
      var self = this;
      var validation = self.validateProfile(payload);
      if (!validation.ok) {
        return Promise.reject(new Error('Cannot upload invalid profile: ' + validation.error));
      }

      return self.getValidAccessToken().then(function(token) {
        var endpoint = self.getEndpoint(true);
        var headers = {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json; charset=utf-8'
        };
        if (eTag) {
          headers['If-Match'] = eTag;
        }

        return self._fetchWithTimeout(endpoint, {
          method: 'PUT',
          headers: headers,
          body: JSON.stringify(payload, null, 2)
        }, REQUEST_TIMEOUT_MS);
      }).then(function(res) {
        if (res.status === 412) {
          return { ok: false, conflict: true, status: 412 };
        }
        if (!res.ok) throw new Error('Graph upload HTTP ' + res.status);
        return res.json().then(function(meta) {
          return {
            ok: true,
            conflict: false,
            cTag: meta.cTag,
            eTag: meta.eTag,
            lastModifiedDateTime: meta.lastModifiedDateTime
          };
        });
      });
    },

    // Strict Data Filtering Contract
    buildSyncPayload: function(settings, wallpaperFeedback, prevRevision) {
      if (!settings) {
        settings = {};
        var app = global.App || global.app;
        if (app && typeof app.getTrackedProperties === 'function') {
          settings = app.getTrackedProperties();
        } else if (global.LivelyBridge && global.LivelyBridge.properties) {
          settings = global.LivelyBridge.properties;
        } else {
          for (var kIdx = 0; kIdx < ALLOWED_SETTINGS_KEYS.length; kIdx++) {
            var sKey = ALLOWED_SETTINGS_KEYS[kIdx];
            var storedVal = localStorage.getItem('LIVELY_HUD_' + sKey.toUpperCase()) || localStorage.getItem(sKey);
            if (storedVal !== null) {
              try {
                settings[sKey] = JSON.parse(storedVal);
              } catch (e) {
                settings[sKey] = storedVal;
              }
            }
          }
        }
      }

      if (!wallpaperFeedback) {
        try {
          var rawFb = (typeof localStorage !== 'undefined') ? localStorage.getItem('local_wally_wallpaper_feedback') : null;
          if (rawFb) {
            var parsedFb = JSON.parse(rawFb);
            if (parsedFb && typeof parsedFb === 'object') {
              wallpaperFeedback = parsedFb;
            }
          }
        } catch (e) {}
        if (!wallpaperFeedback && global.ApiService && typeof global.ApiService.getWallpaperFeedback === 'function') {
          wallpaperFeedback = global.ApiService.getWallpaperFeedback();
        }
        if (!wallpaperFeedback) {
          wallpaperFeedback = { favorites: [], avoided: [] };
        }
      }

      var sanitizedSettings = {};
      for (var i = 0; i < ALLOWED_SETTINGS_KEYS.length; i++) {
        var key = ALLOWED_SETTINGS_KEYS[i];
        if (Object.prototype.hasOwnProperty.call(settings, key)) {
          var val = settings[key];
          // Assert not forbidden
          if (FORBIDDEN_KEY_PATTERN.test(key)) continue;
          sanitizedSettings[key] = val;
        }
      }

      // Sanitize wallpaper preferences metadata (no image bytes, no location)
      var favs = Array.isArray(wallpaperFeedback.favorites) ? wallpaperFeedback.favorites : [];
      var avoided = Array.isArray(wallpaperFeedback.avoided) ? wallpaperFeedback.avoided : [];

      var sanitizedFavorites = [];
      for (var f = 0; f < Math.min(100, favs.length); f++) {
        var fav = favs[f];
        if (!fav) continue;
        sanitizedFavorites.push({
          assetKey: fav.assetKey || (fav.provider && fav.id ? (fav.provider + ':' + fav.id) : (fav.id || fav.url)),
          provider: fav.provider || 'custom',
          id: fav.id ? String(fav.id) : '',
          url: fav.url || '',
          sourceUrl: fav.sourceUrl || '',
          photographer: fav.photographer || '',
          photographerUrl: fav.photographerUrl || '',
          description: fav.description || '',
          updatedAtUtc: fav.updatedAtUtc || Date.now()
        });
      }

      var sanitizedAvoided = [];
      for (var a = 0; a < Math.min(200, avoided.length); a++) {
        var av = avoided[a];
        if (!av) continue;
        sanitizedAvoided.push({
          assetKey: av.assetKey || (av.provider && av.id ? (av.provider + ':' + av.id) : (av.id || av.url)),
          provider: av.provider || 'custom',
          id: av.id ? String(av.id) : '',
          description: av.description || '',
          updatedAtUtc: av.updatedAtUtc || Date.now()
        });
      }

      var revision = (typeof prevRevision === 'number' && prevRevision >= 0) ? prevRevision + 1 : 1;

      var now = Date.now();
      return {
        schema: 'local-wally.settings/v1',
        schemaVersion: 1,
        profileRevision: revision,
        deviceId: this.getDeviceId(),
        savedAtUtc: now,
        updatedAtUtc: now,
        clientVersion: '0.15.0',
        settings: sanitizedSettings,
        wallpaperFeedback: {
          favorites: sanitizedFavorites,
          avoided: sanitizedAvoided
        },
        wallpaperPreferences: {
          favorites: sanitizedFavorites,
          avoided: sanitizedAvoided
        }
      };
    },

    validateProfile: function(profile) {
      if (!profile || typeof profile !== 'object') {
        return { ok: false, valid: false, error: 'Profile must be an object' };
      }
      if (profile.schema && profile.schema !== 'local-wally.settings/v1') {
        return { ok: false, valid: false, error: 'Unsupported schema: ' + profile.schema };
      }
      if (typeof profile.schemaVersion === 'number' && profile.schemaVersion !== 1) {
        return { ok: false, valid: false, error: 'Unsupported schemaVersion: ' + profile.schemaVersion };
      }

      var topKeys = Object.keys(profile);
      for (var t = 0; t < topKeys.length; t++) {
        var tk = topKeys[t];
        if (FORBIDDEN_KEY_PATTERN.test(tk)) {
          return { ok: false, valid: false, error: 'Forbidden top-level key: ' + tk };
        }
      }

      if (profile.settings && typeof profile.settings === 'object') {
        var keys = Object.keys(profile.settings);
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];
          if (FORBIDDEN_KEY_PATTERN.test(k)) {
            return { ok: false, valid: false, error: 'Forbidden key found in settings: ' + k };
          }
        }
      }

      // Nested validation for wallpaper preferences (LW02)
      var wp = profile.wallpaperPreferences || profile.wallpaperFeedback;
      if (wp && typeof wp === 'object') {
        var validateWpList = function(list, name) {
          if (list == null) return null;
          if (!Array.isArray(list)) return name + ' must be an array';
          for (var idx = 0; idx < list.length; idx++) {
            var item = list[idx];
            if (!item) continue;
            if (typeof item === 'string') {
              if (item.length > 250 || /<[a-z!/]/i.test(item)) {
                return 'Invalid string entry in ' + name;
              }
            } else if (typeof item === 'object') {
              if (item.title && (typeof item.title !== 'string' || item.title.length > 250 || /<[a-z!/]/i.test(item.title))) {
                return 'Invalid title in ' + name;
              }
              if (item.author && (typeof item.author !== 'string' || item.author.length > 200 || /<[a-z!/]/i.test(item.author))) {
                return 'Invalid author in ' + name;
              }
              if (item.url && (typeof item.url !== 'string' || !/^https:\/\/[^"'\s<>]+$/i.test(item.url) || item.url.length > 2000)) {
                return 'Invalid or non-HTTPS URL in ' + name;
              }
              if (item.photographer && (typeof item.photographer !== 'string' || item.photographer.length > 200 || /<[a-z!/]/i.test(item.photographer))) {
                return 'Invalid photographer in ' + name;
              }
              if (item.assetKey && (typeof item.assetKey !== 'string' || item.assetKey.length > 250 || /<[a-z!/]/i.test(item.assetKey))) {
                return 'Invalid assetKey in ' + name;
              }
            } else {
              return 'Invalid item type in ' + name;
            }
          }
          return null;
        };
        var errFav = validateWpList(wp.favorites, 'favorites');
        if (errFav) return { ok: false, valid: false, error: errFav };
        var errAvoid = validateWpList(wp.avoided, 'avoided');
        if (errAvoid) return { ok: false, valid: false, error: errAvoid };
      }

      return { ok: true, valid: true };
    },

    mergeProfiles: function(localProfile, remoteProfile) {
      if (!localProfile) return remoteProfile;
      if (!remoteProfile) return localProfile;

      var localTime = (typeof localProfile.savedAtUtc === 'number') ? localProfile.savedAtUtc : (localProfile.updatedAtUtc || 0);
      var remoteTime = (typeof remoteProfile.savedAtUtc === 'number') ? remoteProfile.savedAtUtc : (remoteProfile.updatedAtUtc || 0);

      var remoteIsNewer = (remoteTime >= localTime);
      var mergedSettings = remoteIsNewer
        ? Object.assign({}, localProfile.settings || {}, remoteProfile.settings || {})
        : Object.assign({}, remoteProfile.settings || {}, localProfile.settings || {});

      var localFb = localProfile.wallpaperFeedback || localProfile.wallpaperPreferences || { favorites: [], avoided: [] };
      var remoteFb = remoteProfile.wallpaperFeedback || remoteProfile.wallpaperPreferences || { favorites: [], avoided: [] };

      var mergedFavorites = this.mergeWallpaperPreferences(localFb.favorites, remoteFb.favorites);
      var mergedAvoided = this.mergeWallpaperPreferences(localFb.avoided, remoteFb.avoided);

      var avoidedKeySet = new Set();
      for (var a = 0; a < mergedAvoided.length; a++) {
        var av = mergedAvoided[a];
        var ak = typeof av === 'string' ? av : (av.assetKey || (av.provider && av.id ? (av.provider + ':' + av.id) : (av.id || av.url)));
        if (ak) avoidedKeySet.add(ak);
      }

      var filteredFavorites = mergedFavorites.filter(function(fav) {
        var fk = typeof fav === 'string' ? fav : (fav.assetKey || (fav.provider && fav.id ? (fav.provider + ':' + fav.id) : (fav.id || fav.url)));
        return !avoidedKeySet.has(fk);
      });

      var fbPayload = {
        favorites: filteredFavorites.slice(0, 100),
        avoided: mergedAvoided.slice(0, 200)
      };

      return {
        schema: 'local-wally.settings/v1',
        schemaVersion: 1,
        savedAtUtc: Math.max(localTime, remoteTime, Date.now()),
        updatedAtUtc: Math.max(localTime, remoteTime, Date.now()),
        deviceId: remoteIsNewer ? (remoteProfile.deviceId || this.getDeviceId()) : (localProfile.deviceId || this.getDeviceId()),
        settings: mergedSettings,
        wallpaperFeedback: fbPayload,
        wallpaperPreferences: fbPayload
      };
    },

    threeWayMergeSettings: function(baseSettings, localSettings, remoteSettings) {
      baseSettings = baseSettings || {};
      localSettings = localSettings || {};
      remoteSettings = remoteSettings || {};

      var merged = {};
      var conflicts = {};
      var allKeys = {};
      var k;

      for (k in baseSettings) { if (Object.prototype.hasOwnProperty.call(baseSettings, k)) allKeys[k] = true; }
      for (k in localSettings) { if (Object.prototype.hasOwnProperty.call(localSettings, k)) allKeys[k] = true; }
      for (k in remoteSettings) { if (Object.prototype.hasOwnProperty.call(remoteSettings, k)) allKeys[k] = true; }

      for (k in allKeys) {
        var baseVal = baseSettings[k];
        var localVal = localSettings[k];
        var remoteVal = remoteSettings[k];

        var localChanged = (localVal !== baseVal);
        var remoteChanged = (remoteVal !== baseVal);

        if (localChanged && !remoteChanged) {
          // Local modified only - preserve local edit
          merged[k] = localVal;
        } else if (!localChanged && remoteChanged) {
          // Remote modified only - apply remote update
          merged[k] = remoteVal;
        } else if (!localChanged && !remoteChanged) {
          // Neither modified
          merged[k] = (localVal !== undefined) ? localVal : baseVal;
        } else {
          // Both modified!
          if (localVal === remoteVal) {
            merged[k] = localVal;
          } else {
            // Divergent edit on same key
            conflicts[k] = { local: localVal, remote: remoteVal, base: baseVal };
            // Conservative resolution: keep local value so local user does not lose unsaved work
            merged[k] = localVal;
          }
        }
      }

      return {
        merged: merged,
        conflicts: conflicts,
        hasConflicts: Object.keys(conflicts).length > 0
      };
    },

    mergeWallpaperPreferences: function(localList, remoteList) {
      if (localList && typeof localList === 'object' && !Array.isArray(localList)) {
        var localFavs = (localList.favorites || []).concat(localList.deletedFavorites || []);
        var remoteFavs = ((remoteList && remoteList.favorites) || []).concat((remoteList && remoteList.deletedFavorites) || []);
        var localAvoid = (localList.avoided || []).concat(localList.deletedAvoided || []);
        var remoteAvoid = ((remoteList && remoteList.avoided) || []).concat((remoteList && remoteList.deletedAvoided) || []);

        return {
          favorites: this.mergeWallpaperPreferences(localFavs, remoteFavs),
          avoided: this.mergeWallpaperPreferences(localAvoid, remoteAvoid)
        };
      }
      var map = Object.create(null);
      var combined = (localList || []).concat(remoteList || []);
      for (var i = 0; i < combined.length; i++) {
        var item = combined[i];
        if (!item) continue;
        var key = typeof item === 'string' ? item : (item.assetKey || (item.provider && item.id ? (item.provider + ':' + item.id) : (item.id || item.url)));
        if (!key) continue;

        var isDel = !!(item.isDeleted || item.deletedAtUtc);
        var itemTime = (typeof item.deletedAtUtc === 'number') ? item.deletedAtUtc : ((typeof item.updatedAtUtc === 'number') ? item.updatedAtUtc : (item.savedAt || 0));

        if (!map[key]) {
          map[key] = {
            item: item,
            isDeleted: isDel,
            time: itemTime
          };
        } else {
          var existing = map[key];
          if (itemTime >= existing.time) {
            map[key] = {
              item: item,
              isDeleted: isDel,
              time: itemTime
            };
          }
        }
      }

      var result = [];
      for (var k in map) {
        if (!map[k].isDeleted) {
          result.push(map[k].item);
        }
      }
      return result;
    },

    sync: function(forceUpload) {
      var self = this;
      if (!self.isConnected()) {
        self.state = 'not_connected';
        return Promise.resolve({ ok: false, state: 'not_connected' });
      }

      if (self._syncInFlight) {
        return Promise.resolve({ ok: true, state: self.state, inFlight: true });
      }

      self._syncInFlight = true;
      self.state = 'syncing';

      var app = global.App || global.app;
      var currentSettings = (app && typeof app.getTrackedProperties === 'function')
        ? app.getTrackedProperties()
        : (global.LivelyBridge ? global.LivelyBridge.properties : {});
      var currentFeedback = (global.ApiService && typeof global.ApiService.getWallpaperFeedback === 'function')
        ? global.ApiService.getWallpaperFeedback()
        : { favorites: [], avoided: [] };

      var storedMeta = self.getStoredSyncMeta() || { cTag: null, eTag: null, lastSyncTime: 0, profileRevision: 0 };

      return self.checkRemoteMetadata().then(function(meta) {
        if (!meta.exists) {
          // First upload to cloud
          var payload = self.buildSyncPayload(currentSettings, currentFeedback, storedMeta.profileRevision || 0);
          return self.uploadProfile(payload, null).then(function(upRes) {
            if (upRes.ok) {
              self.state = 'up_to_date';
              self.lastSyncTime = Date.now();
              self.setStoredSyncMeta({
                cTag: upRes.cTag,
                eTag: upRes.eTag,
                lastSyncTime: self.lastSyncTime,
                profileRevision: payload.profileRevision,
                lastSyncedSettings: payload.settings
              });
              return { ok: true, state: 'up_to_date', action: 'uploaded' };
            }
            throw new Error('Initial upload failed');
          });
        }

        // Remote exists
        if (meta.cTag && meta.cTag === storedMeta.cTag) {
          // Cloud content is unchanged
          if (forceUpload) {
            var payloadToPush = self.buildSyncPayload(currentSettings, currentFeedback, storedMeta.profileRevision || 0);
            return self.uploadProfile(payloadToPush, meta.eTag).then(function(upRes) {
              if (upRes.ok) {
                self.state = 'up_to_date';
                self.lastSyncTime = Date.now();
                self.setStoredSyncMeta({
                  cTag: upRes.cTag,
                  eTag: upRes.eTag,
                  lastSyncTime: self.lastSyncTime,
                  profileRevision: payloadToPush.profileRevision,
                  lastSyncedSettings: payloadToPush.settings
                });
                return { ok: true, state: 'up_to_date', action: 'uploaded' };
              }
              // Conflict
              return self._handleConflict(currentSettings, currentFeedback, meta);
            });
          }

          self.state = 'up_to_date';
          self.lastSyncTime = Date.now();
          return { ok: true, state: 'up_to_date', action: 'none' };
        }

        // Remote content differs: download and apply/merge
        return self.downloadProfile().then(function(remoteProfile) {
          // Normalize remote wallpaper preferences defensively
          var remoteWp = remoteProfile.wallpaperPreferences || remoteProfile.wallpaperFeedback || { favorites: [], avoided: [] };
          var mergedFavorites = self.mergeWallpaperPreferences(currentFeedback.favorites, remoteWp.favorites);
          var mergedAvoided = self.mergeWallpaperPreferences(currentFeedback.avoided, remoteWp.avoided);

          if (global.ApiService && typeof global.ApiService.saveWallpaperFeedback === 'function') {
            global.ApiService.saveWallpaperFeedback({
              favorites: mergedFavorites,
              avoided: mergedAvoided
            });
          }

          // 3-way settings merge: base vs local vs remote (LW03)
          var baseSettings = storedMeta.lastSyncedSettings || null;
          var settingsToApply;
          var mergeResult = null;
          if (baseSettings) {
            mergeResult = self.threeWayMergeSettings(baseSettings, currentSettings, remoteProfile.settings);
            settingsToApply = mergeResult.merged;
          } else {
            // First connect or no stored base: preserve disjoint edits, remote wins for identical keys
            settingsToApply = Object.assign({}, currentSettings || {}, remoteProfile.settings || {});
          }

          // Apply merged settings locally
          var applyFn = app && (app.applySettingsPayload || app._applySettingsPayload);
          if (app && typeof applyFn === 'function') {
            applyFn.call(app, { livelyProperties: settingsToApply }, true);
          }

          self.state = 'up_to_date';
          self.lastSyncTime = Date.now();
          self.setStoredSyncMeta({
            cTag: meta.cTag,
            eTag: meta.eTag,
            lastSyncTime: self.lastSyncTime,
            profileRevision: remoteProfile.profileRevision || 1,
            lastSyncedSettings: settingsToApply
          });

          return {
            ok: true,
            state: 'up_to_date',
            action: 'downloaded',
            conflicts: mergeResult ? mergeResult.conflicts : null
          };
        });
      }).catch(function(err) {
        console.warn('[OneDriveSync] Sync error:', err && err.message);
        self.lastError = err && err.message;
        if (self.state !== 'sign_in_needed') {
          self.state = (err.message && /offline|network|timeout/i.test(err.message)) ? 'offline' : 'error';
        }
        return { ok: false, state: self.state, error: err.message };
      }).then(function(result) {
        self._syncInFlight = false;
        return result;
      });
    },

    _handleConflict: function(localSettings, localFeedback, meta) {
      var self = this;
      return self.downloadProfile().then(function(remoteProfile) {
        var remoteWp = remoteProfile.wallpaperPreferences || remoteProfile.wallpaperFeedback || { favorites: [], avoided: [] };
        var mergedFavorites = self.mergeWallpaperPreferences(localFeedback.favorites, remoteWp.favorites);
        var mergedAvoided = self.mergeWallpaperPreferences(localFeedback.avoided, remoteWp.avoided);
        var mergedSettings = Object.assign({}, remoteProfile.settings, localSettings);

        var nextRev = Math.max(remoteProfile.profileRevision || 1, 1) + 1;
        var mergedPayload = self.buildSyncPayload(mergedSettings, { favorites: mergedFavorites, avoided: mergedAvoided }, nextRev);

        return self.uploadProfile(mergedPayload, meta.eTag).then(function(upRes) {
          if (upRes.ok) {
            self.state = 'up_to_date';
            self.lastSyncTime = Date.now();
            self.setStoredSyncMeta({
              cTag: upRes.cTag,
              eTag: upRes.eTag,
              lastSyncTime: self.lastSyncTime,
              profileRevision: mergedPayload.profileRevision
            });
            return { ok: true, state: 'up_to_date', action: 'merged' };
          }
          self.state = 'conflict';
          return { ok: false, state: 'conflict' };
        });
      });
    },

    disconnect: function() {
      if (this._pollTimer) {
        clearTimeout(this._pollTimer);
        this._pollTimer = null;
      }
      this.activeDeviceAuth = null;
      this.setStoredAuth(null);
      this.setStoredSyncMeta(null);
      this.state = 'not_connected';
      this.lastSyncTime = 0;
      this.lastError = null;
    },

    _fetchWithTimeout: function(url, options, timeoutMs) {
      timeoutMs = timeoutMs || REQUEST_TIMEOUT_MS;
      var fetchFn = (typeof window !== 'undefined' && window.fetch) || global.fetch || (typeof globalThis !== 'undefined' && globalThis.fetch);
      if (!fetchFn) {
        return Promise.reject(new Error('Global fetch unavailable in environment'));
      }
      var opts = Object.assign({}, options);
      var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      if (controller && !opts.signal) {
        opts.signal = controller.signal;
      }
      return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() {
          if (controller) {
            try { controller.abort(); } catch (e) {}
          }
          reject(new Error('OneDrive request timed out after ' + timeoutMs + 'ms'));
        }, timeoutMs);

        fetchFn(url, opts).then(function(res) {
          clearTimeout(timer);
          resolve(res);
        }, function(err) {
          clearTimeout(timer);
          reject(err);
        });
      });
    }
  };

  OneDriveSync.signOut = OneDriveSync.disconnect;
  OneDriveSync.isAuthenticated = OneDriveSync.isConnected;
  OneDriveSync.REDIRECT_URI = 'https://login.microsoftonline.com/common/oauth2/nativeclient';

  global.OneDriveSync = OneDriveSync;
  if (typeof window !== 'undefined') window.OneDriveSync = OneDriveSync;
  if (typeof globalThis !== 'undefined') globalThis.OneDriveSync = OneDriveSync;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
