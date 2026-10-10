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

  var LivelyBridge = {
    isPaused: false,
    listeners: {
      playback: [],
      property: [],
      systemInfo: []
    },

    /**
     * Retrieves active external configuration object
     * @returns {Object}
     */
    getConfig: function() {
      return global.LOCAL_WALLY_CONFIG || {};
    },

    /**
     * Registers a callback for playback state changes (pause / resume)
     * @param {function(boolean)} cb Called with isPaused flag
     */
    onPlaybackChange: function(cb) {
      if (typeof cb === 'function') {
        this.listeners.playback.push(cb);
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

    setPaused: function(paused) {
      if (this.isPaused === paused) return;
      this.isPaused = paused;
      console.log('[LivelyBridge] Playback state changed: isPaused =', paused);

      for (var i = 0; i < this.listeners.playback.length; i++) {
        try {
          this.listeners.playback[i](paused);
        } catch (e) {
          console.error('[LivelyBridge] Error in playback listener:', e);
        }
      }
    },

    emitProperty: function(name, val) {
      console.log('[LivelyBridge] Property changed:', name, val);
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

    init: function() {
      var self = this;

      // 1. Lively Host Native Playback Listener
      global.livelyWallpaperPlaybackChanged = function(data) {
        try {
          var info = typeof data === 'string' ? JSON.parse(data) : data;
          if (info && typeof info.IsPaused !== 'undefined') {
            self.setPaused(!!info.IsPaused);
          }
        } catch (err) {
          console.warn('[LivelyBridge] Failed to parse playback payload:', err);
        }
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

      // 4. Page Visibility API fallback (WebView2 native parking)
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', function() {
          if (document.hidden) {
            self.setPaused(true);
          } else {
            self.setPaused(false);
          }
        });
      }
    }
  };

  // Immediate global hook fallback in case host invokes before init()
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

  global.LivelyBridge = LivelyBridge;
})(typeof window !== 'undefined' ? window : this);
