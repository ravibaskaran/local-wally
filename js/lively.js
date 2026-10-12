/**
 * LivelyBridge - Host Lifecycle & Settings Interop Engine
 * 
 * Implements native Lively Wallpaper IPC interfaces:
 *  1. window.livelyWallpaperPlaybackChanged(data) -> Drops CPU/GPU loop to 0.0% when paused
 *  2. window.livelyPropertyListener(name, val) -> Dynamic Lively Settings Menu reactivity
 *  3. Fallback: document.visibilitychange -> Automatic parking when display/window is occluded
 */
(function(global) {
  'use strict';

  var initialDocHidden = (typeof document !== 'undefined' && document.hidden) ? true : false;

  var LivelyBridge = {
    isPaused: initialDocHidden,
    listeners: {
      playback: [],
      property: [],
      systemInfo: [],
      currentTrack: [],
      audioData: []
    },
    properties: {},

    /**
     * Retrieves active external configuration object merged with runtime Lively properties
     * @returns {Object}
     */
    getConfig: function() {
      var cfg = global.LOCAL_WALLY_CONFIG || {};
      return Object.assign({}, cfg, this.properties);
    },

    /**
     * Registers a callback for playback state changes (pause / resume).
     * Immediately dispatches current paused state to the newly registered subscriber.
     * @param {function(boolean)} cb Called with isPaused flag
     */
    onPlaybackChange: function(cb) {
      if (typeof cb === 'function') {
        this.listeners.playback.push(cb);
        try {
          cb(this.isPaused);
        } catch (e) {
          console.error('[LivelyBridge] Error in initial playback listener:', e);
        }
      }
    },

    /**
     * Registers a callback for property/setting changes
     * @param {function(string, any)} cb Called with (name, value)
     */
    onPropertyChange: function(cb) {
      if (typeof cb === 'function') {
        this.listeners.property.push(cb);
      }
    },

    /**
     * Registers a callback for real-time hardware telemetry updates
     * @param {function(Object)} cb Called with parsed hardware payload
     */
    onSystemInfo: function(cb) {
      if (typeof cb === 'function') {
        this.listeners.systemInfo.push(cb);
      }
    },

    /**
     * Registers a callback for Windows SMTC current track telemetry updates
     * @param {function(Object)} cb Called with parsed track metadata object
     */
    onCurrentTrack: function(cb) {
      if (typeof cb === 'function') {
        this.listeners.currentTrack.push(cb);
      }
    },

    /**
     * Registers a callback for 60 FPS audio FFT frequency bins [0.0..1.0]
     * @param {function(Array<number>)} cb Called with 128 normalized float bins
     */
    onAudioData: function(cb) {
      if (typeof cb === 'function') {
        this.listeners.audioData.push(cb);
      }
    },

    hostPaused: false,
    documentHidden: (typeof document !== 'undefined' && document.hidden) ? true : false,

    updatePlaybackState: function() {
      var shouldPause = this.hostPaused || this.documentHidden;
      if (this.isPaused === shouldPause) return;
      this.isPaused = shouldPause;
      console.log('[LivelyBridge] Playback state changed: isPaused =', shouldPause);

      for (var i = 0; i < this.listeners.playback.length; i++) {
        try {
          this.listeners.playback[i](shouldPause);
        } catch (e) {
          console.error('[LivelyBridge] Error in playback listener:', e);
        }
      }
    },

    setPaused: function(paused) {
      this.hostPaused = !!paused;
      this.updatePlaybackState();
    },

    emitProperty: function(name, val) {
      var isSecret = /key|token|secret|password/i.test(name);
      var logVal = isSecret ? (val ? '********' : '<empty>') : val;
      console.log('[LivelyBridge] Property changed:', name, logVal);
      this.properties[name] = val;
      for (var i = 0; i < this.listeners.property.length; i++) {
        try {
          this.listeners.property[i](name, val);
        } catch (e) {
          console.error('[LivelyBridge] Error in property listener:', e);
        }
      }
    },

    emitSystemInfo: function(info) {
      for (var i = 0; i < this.listeners.systemInfo.length; i++) {
        try {
          this.listeners.systemInfo[i](info);
        } catch (e) {
          console.error('[LivelyBridge] Error in systemInfo listener:', e);
        }
      }
    },

    emitCurrentTrack: function(data) {
      var track = null;
      try {
        track = typeof data === 'string' ? JSON.parse(data) : data;
      } catch (err) {
        console.warn('[LivelyBridge] Failed to parse track payload:', err);
        track = null;
      }

      for (var i = 0; i < this.listeners.currentTrack.length; i++) {
        try {
          this.listeners.currentTrack[i](track);
        } catch (e) {
          console.error('[LivelyBridge] Error in currentTrack listener:', e);
        }
      }
    },

    emitAudioData: function(audioArray) {
      if (!audioArray || typeof audioArray.length !== 'number' || audioArray.length <= 0) return;
      for (var i = 0; i < this.listeners.audioData.length; i++) {
        try {
          this.listeners.audioData[i](audioArray);
        } catch (e) {
          console.error('[LivelyBridge] Error in audioData listener:', e);
        }
      }
    },

    emitPlaybackChange: function(data) {
      try {
        var info = typeof data === 'string' ? JSON.parse(data) : data;
        if (info && typeof info.IsPaused !== 'undefined') {
          this.hostPaused = !!info.IsPaused;
          this.updatePlaybackState();
        }
      } catch (err) {
        console.warn('[LivelyBridge] Failed to parse playback payload:', err);
      }
    },

    initialized: false,

    init: function() {
      if (this.initialized) return;
      this.initialized = true;
      var self = this;

      // 1. Lively Host Native Playback Listener
      global.livelyWallpaperPlaybackChanged = function(data) {
        self.emitPlaybackChange(data);
      };

      // 2. Lively Host Native Property Listener
      global.livelyPropertyListener = function(name, val) {
        self.emitProperty(name, val);
      };

      // 3. Lively Host Native System Information Listener
      global.livelySystemInformation = function(data) {
        try {
          var info = typeof data === 'string' ? JSON.parse(data) : data;
          if (info) {
            self.emitSystemInfo(info);
          }
        } catch (err) {
          console.warn('[LivelyBridge] Failed to parse system information payload:', err);
        }
      };

      // 4. Lively Host Native Current Track (Windows SMTC) Listener
      global.livelyCurrentTrack = function(data) {
        self.emitCurrentTrack(data);
      };

      // 5. Lively Host Native Audio Visualizer Listener (128 normalized float bins)
      global.livelyAudioListener = function(audioArray) {
        self.emitAudioData(audioArray);
      };

      // 6. Page Visibility API fallback (WebView2 native parking)
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', function() {
          self.documentHidden = !!document.hidden;
          self.updatePlaybackState();
        });
      }
    }
  };

  // Immediate global hook fallback in case host invokes before init()
  global.livelyWallpaperPlaybackChanged = function(data) {
    if (global.LivelyBridge && global.LivelyBridge.emitPlaybackChange) {
      global.LivelyBridge.emitPlaybackChange(data);
    }
  };

  global.livelyPropertyListener = function(name, val) {
    if (global.LivelyBridge && global.LivelyBridge.emitProperty) {
      global.LivelyBridge.emitProperty(name, val);
    }
  };

  global.livelySystemInformation = function(data) {
    if (global.LivelyBridge && global.LivelyBridge.emitSystemInfo) {
      try {
        var info = typeof data === 'string' ? JSON.parse(data) : data;
        if (info) global.LivelyBridge.emitSystemInfo(info);
      } catch (err) {
        console.warn('[LivelyBridge] Early system info parse error:', err);
      }
    }
  };

  global.livelyCurrentTrack = function(data) {
    if (global.LivelyBridge && global.LivelyBridge.emitCurrentTrack) {
      global.LivelyBridge.emitCurrentTrack(data);
    }
  };

  global.livelyAudioListener = function(audioArray) {
    if (global.LivelyBridge && global.LivelyBridge.emitAudioData) {
      global.LivelyBridge.emitAudioData(audioArray);
    }
  };

  global.LivelyBridge = LivelyBridge;
})(typeof window !== 'undefined' ? window : this);
