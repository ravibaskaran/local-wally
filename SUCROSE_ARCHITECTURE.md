# Local Wally Dual-Host Architecture: Lively and Sucrose

**Status:** Proposed architecture for design review. This document defines the target boundaries and release artifacts; it does not authorize implementation before the design is reviewed.

Local Wally should remain one web application with two host integrations. Keep the current Lively experience working, add a Sucrose integration at the host boundary, and produce separate Lively and Sucrose packages from the same application source. Do not fork Sucrose or add a native helper unless validation proves a required feature cannot be delivered through Sucrose's Web wallpaper APIs.

## Decision summary

| Decision | Direction |
|---|---|
| Application source | One shared HTML/CSS/JavaScript application for both hosts. |
| Host-specific behavior | Separate adapters translate each host's callbacks into the app's existing state and events. |
| Lively compatibility | Preserve the current Lively entry points, settings, behavior, and release package. |
| Sucrose compatibility | Add a Web wallpaper package using Sucrose's manifest, properties, and declared JavaScript bridge callbacks. |
| Release artifacts | Produce exactly `local-wally-lively.zip` and `local-wally-sucrose.zip`; each contains the matching host metadata and the shared runtime files. |
| External helpers | None by default. Prefer Sucrose's supported web bridge and existing browser APIs. |
| Unavailable telemetry | Report unavailable honestly; do not fake metrics. For disk telemetry on Sucrose, maintainer approved Option B: adapt the DSK card to report System Drive (C:) used capacity with explicit label `'DISK (C:)'`. |
| Implementation gate | First produce and review a detailed design that resolves the open questions in this document. No code changes are authorized by the AG design task. |

The repository's current `scratch/package_release.js` creates one Lively-oriented `local-wally.zip`. The eventual release workflow should stage both package roots independently so host metadata cannot leak into the wrong archive. Preserve the existing Lively artifact's contents and behavior unless a separately reviewed change explicitly changes them.

## Target runtime structure

```text
Shared Local Wally application
├── UI and visual engines
│   ├── Weather, AQI, news, and wallpaper presentation
│   ├── Forecast charts, sparklines, astronomy, and weather effects
│   ├── Media visualizer, media card, and focus timer
│   └── Hover details, news interactions, and responsive layout
├── Data and state services
│   ├── Provider adapters and normalized application models
│   ├── Cache, request deduplication, and provider rotation
│   └── Settings application and validation
└── Host boundary
    ├── Lively adapter: current playback, properties, telemetry, media, and audio hooks
    └── Sucrose adapter: declared Sucrose properties, system callbacks, and audio/media callback

Build outputs
├── local-wally-lively.zip   (LivelyInfo.json + LivelyProperties.json + shared runtime)
└── local-wally-sucrose.zip  (SucroseInfo.json + SucroseProperties.json + SucroseCompatible.json + shared runtime)
```

These are conceptual boundaries, not a mandate to reorganize existing modules. The design phase must map them onto the current source tree and reuse existing helpers wherever possible. Shared UI and data modules must not call host globals directly; host-specific globals belong in the corresponding adapter.

## Host adapter contract

Both adapters should expose the smallest common set of app-facing operations needed by the existing code: apply a setting, publish telemetry, publish media metadata/audio samples, and report playback or visibility state where that host provides it. The design must map these operations onto current app call sites before proposing new interfaces.

| Capability | Lively source | Sucrose source | App-facing behavior |
|---|---|---|---|
| Custom settings | Existing Lively property callback/map | `SucrosePropertyListener(name, value)` per setting | Apply a validated setting through the same app settings path. |
| CPU | `livelySystemInformation` payload | `SystemProcessor` callback, including `Name` and `Now` | Update CPU label, current value, and sparkline. |
| GPU | Existing Lively GPU telemetry | `SystemGraphic` callback, including `Name`, `Manufacturer`, and `Now` | Update GPU label and utilization after confirming metric semantics. |
| RAM | Existing Lively memory fields | `SystemMemory`, with usage values documented in GiB and percentages | Normalize units and preserve existing display semantics. |
| Network | Existing Lively transfer fields | `SystemNetwork`; `Upload` and `Download` are bytes per second | Convert units at the boundary and update both channels. |
| Battery | Existing Lively/browser battery sources | `SystemBattery`, including charge and power-line state | Preserve the current availability and desktop-device behavior. |
| Storage / disk activity | Current Local Wally disk metric source | `SystemStorage` documents drive collections (`LogicalDrivers`), not active-time/utilization | Approved Option B: calculate System Drive (C:) used capacity %, relabel HUD to `'DISK (C:)'`, and detail used/total GB. |
| Now playing | `livelyCurrentTrack` | Sucrose audio payload metadata, including title, artist, artwork, and `SourceAppId` | Feed the existing media card; map known app IDs and retain a generic fallback. |
| Audio spectrum | `livelyAudioListener` | `SystemAudio`; 128 normalized mono bins and optional left/right arrays | Reuse existing 32-band rendering without per-frame allocations. |
| Playback parking | Lively playback IPC and current visibility fallback | Sucrose performance pause/close behavior plus browser lifecycle signals where available | Stop app-owned RAF loops and timers while inactive; resume without timer drift. |

Sucrose's system callback payloads carry a `State` validity flag. The adapter must ignore invalid samples without clearing the last valid display. It must not assume the Sucrose GPU load exactly matches Lively's 3D-engine value, or that a Sucrose storage list provides disk utilization. Confirm those semantics against current Sucrose source/runtime before claiming parity.

## Functionality to preserve

The implementation design must account for the complete current Local Wally scope documented in `DESIGN_BLUEPRINT.md` and verified against the live source tree:

- Weather and AQI provider selection, normalization, caching, error handling, and fallback behavior.
- Regional news provider selection, safe publisher links, cache/quota rules, carousel, clickable dots, story images, and hover/details.
- Wallpaper provider selection and rotation, API-key settings, local-weather search context, screen-ratio/resolution matching, recent-item avoidance, and double-buffered swaps.
- Clock, timezone-correct solar/lunar calculations, day/night presentation, sky events, lighting, moon phases, cloud strata, weather-adaptive effects, particles, and local animated SVG assets.
- HUD position and responsive layout, high-DPI canvases, contrast, accessibility, and contextual popovers/drawers.
- CPU/GPU/RAM/disk/network/battery presentation and sparklines, with honest unavailable states where the host cannot supply a metric.
- SMTC/media identity, album art, audio presence, audio visualization, music quick launch, and URI fallback behavior.
- All focus timer modes, pause/resume correctness, settings backup/restore, and diagnostic/support behavior.

The detailed design must classify every feature as **shared unchanged**, **adapter-backed**, **host-setting/package change**, **degraded with explicit fallback**, or **blocked pending host support**. It must not label a feature ported merely because the UI renders a placeholder.

## Settings and credentials

Keep the Lively and Sucrose customization schemas separate. The Sucrose package should define `SucroseProperties.json` controls and translate their values into the existing application settings model. Sucrose sends one property per callback, while the current Lively integration may receive a property map; both paths must converge on the same validation and apply logic.

Include all user-facing Local Wally settings that currently exist, including provider selection, optional API keys, location, display/layout options, timer mode, and feature toggles. Do not put user keys in source files, generated defaults, diagnostics, or logs. A Sucrose password box masks text in the settings panel; it does not make a key secret from the local wallpaper runtime or its network requests.

Settings backup/restore needs explicit design coverage. Determine whether existing Lively-specific buttons can be represented in the Sucrose customization panel or whether the shared wallpaper UI should own the import/export interaction. Preserve API-key redaction and safe import validation.

## Caching, origins, and network behavior

Keep provider fetches, timeouts, cancellation, normalization, rate limits, and cache TTL policy in shared services. Neither adapter may cause property changes, hover events, redraws, or story selection to bypass the existing request firewall.

**Open risk:** Sucrose's detailed Web architecture documentation says web content is served from a loopback HTTP server using an automatically selected free port; the WebView engine overview describes local serving as `file:///`. Since web storage is origin-scoped, a changing HTTP port could prevent Local Wally's `localStorage` snapshots from carrying across engine restarts. Verify the actual current runtime URL and persistence behavior before relying on persistent weather/news/wallpaper caches. The Sucrose settings system should be the source of truth for user preferences; browser storage remains a cache, not the only copy of settings.

Also test provider CORS behavior from the actual Sucrose origin, image loading, XML/proxy parsing, geolocation permissions, manual location, and IP/offline fallbacks. Sucrose does not document a wallpaper geolocation callback, so do not assume permission behavior matches Lively. Test whether multi-monitor modes create multiple active fetchers; prevent unexpected duplicate API consumption where possible without introducing a helper service.

## Lifecycle and performance requirements

- Continue to use native browser/WebView2, Canvas, SVG, CSS, and TypedArrays; add no charting or runtime package dependency.
- Preserve zero allocations in Local Wally-owned animation-frame loops. Host callback parsing and Sucrose's own data bridge are outside that narrow guarantee and must be measured separately.
- Keep a single RAF owner and cancel it when the host parks the wallpaper, when an animation has no active work, or when visibility/lifecycle state requires it.
- Rebase wall-clock timers after suspension; do not try to catch up by firing accumulated intervals.
- Sucrose's Heavy pause suspends live engine/browser threads; Light pause pauses rendering only. Test both, and document the recommended Sucrose performance setting for maximum savings.
- Measure Local Wally's engine and Sucrose background overhead separately. Do not claim 0% total platform CPU based only on the wallpaper page being suspended.
- Verify hardware acceleration is enabled for the selected Sucrose browser engine and test iGPU/dGPU, 60 FPS animation, quiet idle, audio silence, and resume behavior.

## Release packaging

Generate the two archives from isolated staging directories using the existing release tooling where practical:

| Artifact | Required host files | Shared files |
|---|---|---|
| `local-wally-lively.zip` | `LivelyInfo.json`, `LivelyProperties.json` | Entry HTML, CSS, runtime JavaScript, configuration, assets, and applicable license/readme files. |
| `local-wally-sucrose.zip` | `SucroseInfo.json`, `SucroseProperties.json`, `SucroseCompatible.json`, Sucrose thumbnail/preview and required package metadata | The same compatible entry HTML, CSS, runtime JavaScript, configuration, assets, and applicable license/readme files. |

The Sucrose manifest must use Web type (`Type: 2`) and a valid local entry source. Set its app-version field to a version supported by the target Sucrose release, not a guessed future version. Keep each archive self-contained; do not reference files outside its package root. The Lively archive must remain importable in Lively and must not accidentally include Sucrose-only metadata; the Sucrose archive must not require Lively metadata to launch.

The release script should fail atomically if either archive fails to build or validate. Validate each archive's file list, required manifests, entry point, assets, and host-specific exclusions before publishing. Keep the two output names explicit in release documentation and GitHub release upload instructions.

## Design-stage validation questions

The next design must answer each item with evidence, not assumptions:

1. What are the current Local Wally module boundaries and all active feature entry points? Which modules actually need edits for dual hosting?
2. Which current Sucrose release should be the compatibility baseline? Which Sucrose JS callbacks and package schemas exist in that version?
3. Does Sucrose expose disk active-time or disk utilization to a Web wallpaper? If not, confirm the gap in source/docs and define the honest fallback; assess an upstream request before any fork/helper.
4. Does Sucrose's GPU metric mean the same thing as Local Wally's current GPU 3D metric? What calibration or label change is warranted?
5. What URL/origin does the selected engine actually use? Does `localStorage` persist across restart, provider setting changes, and multi-monitor modes?
6. Which pause/resume and visibility signals reach the Web page? Does the page need an adapter callback, or does host suspension plus existing browser lifecycle handling suffice?
7. Does WebView geolocation work with user permission? What are the failure timeouts and manual/IP fallback behavior?
8. How do Sucrose settings represent all current properties, password fields, backup/restore actions, and defaults without losing user settings?
9. Do news links, custom music URI schemes, and wallpaper external requests behave correctly under Sucrose? What API request duplication occurs in each display mode?
10. What is the smallest release-script change that produces and validates both independent artifacts while preserving the existing Lively workflow?

For each unresolved item, include: evidence link or source path, impact, confidence, proposed decision, and whether user/maintainer confirmation is needed. Mark unknowns as unknown rather than silently selecting an implementation.

## Acceptance gates before implementation

- [ ] Feature parity matrix covers every current blueprint feature and current source entry point.
- [ ] Disk telemetry, GPU semantics, cache persistence, geolocation, lifecycle, and multi-monitor behavior have verified answers or explicit approved fallbacks.
- [ ] Sucrose settings map one-to-one to supported properties; Lively settings and behavior remain intact.
- [ ] Proposed file-level change list names callers, package files, tests, docs, and release tooling, with no implementation changes made during design.
- [ ] Performance plan measures RAF allocations, idle/paused CPU, telemetry bridge overhead, and network request counts.
- [ ] Separate Lively and Sucrose archive manifests, inclusion/exclusion rules, names, and validation steps are specified.
- [ ] No third-party dependency or native helper is introduced without demonstrating it is necessary to preserve a named Local Wally feature.

## Current documentation references

Checked 2026-10-16. Sucrose's GitHub release page listed stable `v26.7.5.0` and pre-release `v26.10.5.0`; recheck before implementation.

- [Sucrose releases](https://github.com/Taiizor/Sucrose/releases)
- [Create Compatibility](https://github.com/Taiizor/Sucrose/wiki/Create-Compatibility)
- [Create Package Format](https://github.com/Taiizor/Sucrose/wiki/Create-Package-Format)
- [Create Customization Controls](https://github.com/Taiizor/Sucrose/wiki/Create-Customization-Controls)
- [Create System API](https://github.com/Taiizor/Sucrose/wiki/Create-System-API)
- [Create Audio API](https://github.com/Taiizor/Sucrose/wiki/Create-Audio-API)
- [Create Web Architecture](https://github.com/Taiizor/Sucrose/wiki/Create-Web-Architecture)
- [WebView engine](https://github.com/Taiizor/Sucrose/wiki/Engine-WebView)
- [Performance Rules](https://github.com/Taiizor/Sucrose/wiki/Performance-Rules)
- [Multi-Monitor Setup](https://github.com/Taiizor/Sucrose/wiki/Multi-Monitor)
- [Extending Sucrose](https://github.com/Taiizor/Sucrose/wiki/Extending-Sucrose)
- [MDN: `localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
