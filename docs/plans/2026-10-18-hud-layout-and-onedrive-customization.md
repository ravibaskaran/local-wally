# HUD Layout Fixes & OneDrive Customization Implementation Plan

> **For Agent:** Implementation plan for HUD layout overlap fixes, next update scheduling display, Lively customization OneDrive buttons, browser-based OAuth, and custom OneDrive folder backups.

**Goal:** Eliminate weather card text/badge collision at root level using relative flex layout, display live observation time with scheduled next update time, add Lively Customise controls for OneDrive with browser-launched authentication, and support backups to any user-specified OneDrive folder.

**Architecture:** 
- Restructure `#hud-weather-card` into a clean two-row relative flow layout: a top status bar (`.hud-weather-status-bar`) housing `#hud-weather-freshness` and `#hud-weather-next-update` with zero absolute positioning, and a bottom row (`.hud-weather-main-row`) housing the weather icon, temperature, condition text, feels-like, and high/low values.
- Compute relative observation timestamp (`Live · @ 9:25 AM`) and dynamically projected next update timestamp (`Next: 9:40 AM`) driven by `CacheManager.getRemainingTtlMs()` and respecting 12h/24h clock preferences.
- Add `onedriveFolder`, `onedriveConnect`, `onedriveSync`, and `onedriveDisconnect` properties to `LivelyProperties.json` and wire them in `js/app.js` and `LivelyBridge`.
- Enhance `OneDriveSync` in `js/sync.js` with `Files.ReadWrite` scope, configurable `folderPath` supporting any root or nested folder, automatic browser launching via `window.open`, and automated clipboard user code copy.

**Tech Stack:** Vanilla JavaScript (ES5/ES6 WebView2 Chromium), CSS3 Flexbox (zero absolute overlap), Microsoft Graph API v1.0, RFC 8628 OAuth 2.0 Device Authorization Grant, Lively Wallpaper IPC Bridge.

---

### Task 1: Weather Card Relative Layout & Next Update Scheduling (DOM & CSS)

**Files:**
- Modify: `index.html:70-95`
- Modify: `css/style.css:1468-1585,3400-3486`

**Step 1: Write the failing test**
Create `scratch/test_weather_layout_and_schedule.js`:
- Verify `#hud-weather-card` contains `.hud-weather-status-bar` and `.hud-weather-main-row`.
- Verify `#hud-weather-freshness` is inside `.hud-weather-status-bar` and has NO `position: absolute`.
- Verify `#hud-weather-next-update` exists inside `.hud-weather-status-bar`.
- Verify `.hud-condition-meta` is inside `.hud-weather-main-row` and does not share coordinates with freshness badge.

**Step 2: Run test to verify it fails**
Run: `node scratch/test_weather_layout_and_schedule.js`
Expected: FAIL (elements and structure not yet created).

**Step 3: Implement minimal code in `index.html` and `css/style.css`**
- In `index.html`: Restructure `#hud-weather-card` into `.hud-weather-status-bar` (containing `#hud-weather-freshness` and `#hud-weather-next-update`) and `.hud-weather-main-row` (containing `.hud-temp-wrap` and `.hud-condition-meta`).
- In `css/style.css`:
  - Change `.hud-temp-block` to `display: flex; flex-direction: column; gap: 6px; padding: 6px 10px 8px;`.
  - Style `.hud-weather-status-bar` as relative flex container with `justify-content: space-between; align-items: center; width: 100%;`.
  - Remove absolute positioning from `.hud-weather-badge-wrap` and `.weather-freshness-badge`.
  - Add `.weather-next-update-pill` styling matching glass aesthetic.
  - Style `.hud-weather-main-row` as relative flex container with `justify-content: space-between; align-items: center; width: 100%;`.

**Step 4: Run test to verify it passes**
Run: `node scratch/test_weather_layout_and_schedule.js`
Expected: PASS.

---

### Task 2: Weather Timing & Scheduled Next Update Formatting (`js/app.js`)

**Files:**
- Modify: `js/app.js` (around `renderWeather` and `updateClock`)
- Test: `scratch/test_weather_layout_and_schedule.js`

**Step 1: Add timing test cases to test suite**
- Verify `renderWeather` updates `#hud-weather-freshness` with `Live · @ <Time>` (or `Live · Just now (@ <Time>)`) and `#hud-weather-next-update` with `Next: <NextTime>`.
- Verify 12h/24h clock preferences format both timestamps consistently.
- Verify `updateClock` refreshes `#hud-weather-next-update` as remaining TTL counts down.

**Step 2: Run test to verify it fails**
Run: `node scratch/test_weather_layout_and_schedule.js`
Expected: FAIL on next update text assertions.

**Step 3: Implement minimal logic in `js/app.js`**
- Cache `this.dom.hudWeatherNextUpdate = document.getElementById('hud-weather-next-update');`.
- Add helper `formatTimestampClock(timestamp)` to `App.prototype` respecting `this.clockFormat`.
- In `renderWeather(w, location)`:
  - Extract `fetchedAt` from `prov.fetchedAtUtc` (or fallback).
  - Format observation time string.
  - Calculate `nextSyncMs = global.CacheManager ? global.CacheManager.getRemainingTtlMs() : (this.settings.refreshInterval * 60000);`.
  - Format `nextSyncTimeStr`.
  - Set `this.dom.hudWeatherFreshness.textContent = 'Live · @ ' + timeStr;`.
  - Set `this.dom.hudWeatherNextUpdate.textContent = 'Next: ' + nextTimeStr;`.
- In `updateClock()`:
  - If `this.dom.hudWeatherNextUpdate` exists and weather data is active, update next sync projected time or relative remaining minutes.

**Step 4: Run test to verify it passes**
Run: `node scratch/test_weather_layout_and_schedule.js`
Expected: PASS.

---

### Task 3: OneDrive Any-Folder Synchronization Engine (`js/sync.js`)

**Files:**
- Modify: `js/sync.js`
- Test: `scratch/test_onedrive_folder_and_browser_oauth.js`

**Step 1: Write failing test**
Create `scratch/test_onedrive_folder_and_browser_oauth.js`:
- Test `OneDriveSync.setFolderPath('Backups/Local-Wally')`.
- Test `getEndpoint(false)` and `getEndpoint(true)`:
  - Default `Apps/Local Wally` -> points to `me/drive/special/approot:/local-wally-settings.json`.
  - Custom `Backups/My Setup` -> points to `me/drive/root:/Backups/My%20Setup/local-wally-settings.json`.
- Test `SCOPE` includes `Files.ReadWrite`.
- Test `startDeviceAuth` initiates browser opening and clipboard copy hooks.

**Step 2: Run test to verify it fails**
Run: `node scratch/test_onedrive_folder_and_browser_oauth.js`
Expected: FAIL (custom folder routing and methods not implemented).

**Step 3: Implement minimal code in `js/sync.js`**
- Update `SCOPE` to `'Files.ReadWrite Files.ReadWrite.AppFolder offline_access'`.
- Add `folderPath: 'Apps/Local Wally'` to `OneDriveSync`.
- Add `setFolderPath(path)`: sanitizes path, trims slashes, updates `localStorage.setItem('local_wally_onedrive_folder', path)`.
- Implement `getEndpoint(isContent)`: routes `special/approot` for default and `root:/<segments>/` for custom paths.
- Update `checkRemoteMetadata`, `downloadProfile`, and `uploadProfile` to use `this.getEndpoint(false)` / `this.getEndpoint(true)`.

**Step 4: Run test to verify it passes**
Run: `node scratch/test_onedrive_folder_and_browser_oauth.js`
Expected: PASS.

---

### Task 4: Lively Customization Properties & Browser OAuth Wiring

**Files:**
- Modify: `LivelyProperties.json`
- Modify: `config.js`
- Modify: `js/app.js`
- Modify: `index.html` (add folder input to diagnostics panel)
- Test: `scratch/test_onedrive_folder_and_browser_oauth.js`

**Step 1: Add integration tests**
- Verify `LivelyProperties.json` contains `onedriveFolder`, `onedriveConnect`, `onedriveSync`, `onedriveDisconnect`.
- Verify `livelyPropertyListener` handles `onedriveConnect` by launching browser and opening auth modal.
- Verify `livelyPropertyListener` handles `onedriveSync` and `onedriveFolder`.

**Step 2: Run test to verify it fails**
Run: `node scratch/test_onedrive_folder_and_browser_oauth.js`
Expected: FAIL.

**Step 3: Implement minimal code**
- In `LivelyProperties.json`: Add `onedriveFolder` (textbox), `onedriveConnect` (button), `onedriveSync` (button), and `onedriveDisconnect` (button).
- In `config.js`: Add `oneDrive.folderPath: 'Apps/Local Wally'`.
- In `js/app.js`:
  - In `livelyPropertyListener`: add switch cases for `onedriveConnect`, `onedriveSync`, `onedriveFolder`, `onedriveDisconnect`.
  - In `openOneDriveAuthModal()`: when `startDeviceAuth` resolves, call `window.open(authData.verification_uri, '_blank')` and copy `authData.user_code` to clipboard via `navigator.clipboard.writeText`.
  - In Diagnostics panel: bind `#diag-onedrive-folder` to sync with `OneDriveSync.folderPath`.

**Step 4: Run test to verify it passes**
Run: `node scratch/test_onedrive_folder_and_browser_oauth.js`
Expected: PASS.

---

### Task 5: Full Regression Testing & Subagent Verification

**Files:**
- Run all 36+ test suites in `scratch/test_*.js`.
- Audit with independent subagents across Functional, Security, and Performance lenses.
- Verify zero em/en dashes, zero AI attribution, zero location leakage.

---

### Task 6: Documentation, Packaging, and Release

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md` (Version 0.17.0 notes)
- Modify: `docs/walkthrough.md`
- Modify: `docs/walkthrough.html`
- Modify: `docs/index.html`
- Version bump in `js/app.js` to `0.17.0`.
- Mirror to `E:\utils\lively\wallpapers\ubvvowpx.ym4\`.
- Build `local-wally.zip` via `node scratch/package_release.js`.
- Git commit, tag `v0.17.0`, push, and publish GitHub Release.
