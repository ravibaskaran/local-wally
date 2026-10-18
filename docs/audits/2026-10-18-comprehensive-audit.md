# Local Wally comprehensive performance, functional, and NFR audit

**Verdict:** Current code contains two P1 credential/data-loss risks and meaningful P2 correctness, privacy, accessibility, update-safety, and testability defects. Fix LW01 and LW03 first, then the remaining correctness and trust-boundary items. This source audit does not attribute renderer CPU usage or establish that every conditional host concern is present in the installed Lively build.

| Audit datum | Value |
|---|---|
| Repository | Local Wally, E:/utils/lively/local-wally |
| Audited HEAD | d04b384e2b373b909cd483605ee1ff6cf8561ba5 |
| Candidate status | GitHub connector compare_commits for the audited SHA versus remote main returned identical (ahead 0 / behind 0). |
| Source changes | None. Only this report and its paired remediation prompt are intended outputs. |
| Scope | User behavior and non-functional requirements (NFRs), especially ingestion, cache/news/sync, secrets/backups, accessibility, pause/resume, rendering, memory, updater, tests, and WebView2/Lively evidence. |
| Baseline | Current README, walkthrough, LivelyProperties, configuration, and reachable implementation. ONEDRIVE_SYNC_AND_HUD_FEATURES_DESIGN.md and other pre-existing untracked material are not approved product requirements. |

## Executive summary

Local Wally is a local Windows desktop wallpaper/dashboard with weather, forecast, AQI, news, photos, favorites/avoidance, OneDrive settings sync, media visualization, Pomodoro, and hardware telemetry. Assumed normal load: one active wallpaper instance per desktop, occasional location/provider changes, and multiple devices sharing a OneDrive profile. No formal SLA or approved complete product requirements document was supplied.

Highest-risk confirmed paths:

1. OAuth tokens and per-device OneDrive sync metadata can cross ordinary backup/static-file boundaries despite the sync module's explicit token-exclusion contract (LW01).
2. A changed remote profile can replace unsynced local settings without a three-way conflict merge (LW03).
3. App-level news fallback can show stories from a different location; malformed successful weather data can be fabricated and labeled live; OWM forecast hours can use the desktop timezone (LW05–LW07).
4. Favorite metadata is rendered as HTML, sync merges cannot represent deletion, and modal semantics exceed implemented focus handling (LW02, LW04, LW08).
5. The updater overlays files in place and critical behavior tests are outside tracked CI/test paths (LW10–LW11).

There are 20 confirmed issue groups, LW01–LW20. “Confirmed” means a concrete reachable source path and a trigger were identified, not that every user installation has experienced the impact. C01–C09 remain conditional and are not implementation instructions unless the stated evidence is obtained. Safe mock tests corroborated several paths; no real provider, OneDrive account, updater install, screen reader, or complete renderer benchmark was used.

## Assumptions and evidence standard

- P1 means high-impact credential or user-data risk; P2 means meaningful correctness, security, accessibility, or reliability impact; P3 means a minor opportunity with unmeasured impact or a documentation-level concern. “Unmeasured” alone does not make a finding P3.
- Source-confirmed means the relevant path exists in code. It does not imply live exploitation or observed user impact.
- Mock-reproduced means an offline VM/mock produced the described result.
- Measured is reserved for an explicit runtime sample. A process metric is not causal proof. Source-derived request/memory bounds are not runtime measurements.
- Location, API keys, OAuth state, operational quotas, cloud sync, backups, provider fallbacks, units, DST, audio, weather animation, lightning, blur, and user configuration are functionality or privacy boundaries. Performance work must preserve them.
- README's approximately 0% parked CPU/GPU and less than 60 MB RAM statements are not formal service-level objectives. They need repeatable test conditions before being generalized.
- No token files, credentials, private account data, or denied secret paths were inspected. LW01 describes code capable of storing/serving token material; no claim is made that any token file exists.

## Functional and NFR coverage

| Area | Baseline checked | Result |
|---|---|---|
| Weather, forecast, providers, units, freshness | README/provider claims; config; adapters/normalizers in js/api.js; App render paths | Provider fallback and unit conversions are present. LW06 exposes malformed-2xx fabrication; LW07 exposes OWM timezone labels. |
| Location and city customization | Manual/persisted/default lookup and callers; location mocks | No further location defect confirmed in this phase. Startup's premature news request is LW05. ISP-gateway mismatch is documented behavior, not a new defect. |
| AQI | Open-Meteo/WAQI normalization and fallback callers | No additional AQI correctness defect confirmed. |
| News | Startup, identity, quotas, cache, stale UI, RSS proxy cascade | LW05 query/order/stale marker defect. Keyed cooldown is 15 minutes; keyless Google News is 5 minutes; README is stale (LW20). RSS attempts are serial and may reach 10 × 5 seconds source-derived worst case; not a main-thread stall or measured boot delay (LW12). |
| Photos, favorites, avoidance | Provider metadata, HTML rendering, local persistence, sync merge, undo | LW02 unsafe interpolation; LW04 deletion/resurrection semantics. |
| OneDrive OAuth/profile sync | js/sync.js, backup/import, helper, static server | LW01 token and device checkpoint boundary; LW03 local overwrite; LW04 tombstones; LW16 redundant metadata call; LW14 UI/backup mismatch. |
| Accessibility and motion | LivelyProperties, ARIA modal roles, open/close, key handlers, reduced-motion CSS, external SVG | LW08 modal focus handling; LW09 external SVG SMIL is outside reliable host CSS control. |
| Pause/resume, memory, background work | App timers, news image cache, telemetry handlers | LW12 hidden news; LW13 purge/reachability and memory map; LW17 parse work; LW18 empty polling callback. |
| Graphics and high DPI | Canvas sizing, visible SVG timer ring, SVG assets | LW09 and LW15 source-confirmed; LW19 is minor and subject to caller grep. |
| Updates, tests, documentation | Updater, .gitignore, scratch runner, README | LW10 non-transactional overlay; LW11 reproducibility gap; LW20 quota and measurement-claim accuracy. |
| WebView2/native Lively | Pinned upstream evidence and parent runtime observation | C01–C07 remain conditional/observational; no host-side change is authorized by this source audit. |

## Confirmed findings

### P1 — Must fix before expanding use

#### LW01 — OAuth credentials and device sync checkpoints cross backup/served-file boundaries

- **Evidence:** js/sync.js:14,154-172 stores the OAuth record at local_wally_onedrive_auth; line 15 defines local_wally_onedrive_sync_meta. js/app.js:5050,5077-5089 exports matching local_wally_ and LIVELY_HUD_ storage keys except its narrow operational-key list at 5058-5060, which omits both keys. Import accepts the same prefix at 5345-5358. tools/onedrive-login.ps1:103-119 writes onedrive_tokens.json to the repository root and tools folder if those parents exist. The only inspected consumer, js/sync.js:103-118, fetches onedrive_tokens.json from the wallpaper root. .gitignore:1-23 has no token-file exclusion. serve.js:45-62 serves ordinary files under its root.
- **Trigger and impact:** An authenticated user exports settings or runs the helper. The backup may include access/refresh token data and a portable sync cTag/checkpoint; the helper may put token JSON in a root served by the local static server. A refresh token can authorize actions within granted scope; a copied cTag can cause one device to treat another device's state as its own baseline. No actual token file was read or assumed to exist.
- **Minimal root fix:** Immediately exclude OAuth/auth state and per-device synchronization metadata from ordinary backup export/import, and add ignore/defense-in-depth controls. The current helper handoff is required by the only inspected consumer (js/sync.js:103-118), which fetches the root onedrive_tokens.json; relocating the file, denying that endpoint, or deleting helper writes is therefore BLOCKED until a verified existing protected handoff is proven or a maintainer approves a replacement. Do not invent native APIs, break the CLI login, or claim full LW01 closure from the independent backup/ignore changes.
- **Regression acceptance:** Sentinel-only tests prove auth and sync-meta keys and token-shaped JSON never appear in backup bytes or import state. Reject legacy backups containing auth/checkpoint keys while retaining legitimate preferences and bounded product caches per contract. Verify the existing helper handoff remains functional while migration is blocked. Only after an approved, verified replacement exists should tests assert that generic static serving cannot expose token JSON and the new helper/browser/CLI path still authenticates. Never put real tokens in fixtures or logs; report LW01 as partially mitigated/blocked until the handoff boundary is safely replaced.

#### LW03 — Remote profile changes overwrite unsynced local settings

- **Evidence:** js/sync.js:763-787 captures local settings and stored cTag. In the remote-changed branch at 834-863, favorites/avoid lists are merged, but remote settings are applied directly at 848-852; sync metadata is then advanced to the remote cTag at 856-860. _handleConflict is reached only on a conditional upload conflict at 824-826, not on the ordinary changed-remote path.
- **Trigger and impact:** Device A edits local settings since its last successful baseline; Device B uploads a newer profile; A next sees a changed cTag, downloads B's profile, applies it, and records it as synced. A's unsynced setting values can be lost without a conflict signal. Timestamps alone are not a safe common base.
- **Minimal root fix:** Persist a last-common profile/base and dirty state. Three-way merge disjoint setting edits; preserve both sides and report an explicit conflict for same-setting divergent edits. Do not checkpoint the cTag or claim success until local apply and persistence are confirmed. Define first-connect behavior deliberately and non-destructively.
- **Regression acceptance:** Mock two devices with disjoint edits, same-key conflict, remote edit racing local upload, and first connection to an existing remote profile. Verify disjoint changes survive, same-key conflicts preserve both values until resolution, and failed apply does not advance metadata or claim success.

### P2 — Must fix for correctness, privacy, accessibility, or reliability

#### LW02 — Favorite metadata is interpolated into HTML

- **Evidence:** js/app.js:2652-2668 inserts URL, photographer, provider, and assetKey into innerHTML/attributes. Provider metadata originates at js/api.js:2707-2708,2804-2805,2843-2844. Sync profile validation checks top-level/settings keys but not nested favorite records (js/sync.js:665-694); merge writes those objects (835-845).
- **Trigger and impact:** A controlled provider response or imported/synced profile contains HTML/attribute-breaking values, such as a quote plus an event-handler attribute. It can alter the DOM or execute script in the wallpaper WebView. This is a trust-boundary risk; no live exploit was attempted and no current provider compromise is claimed.
- **Minimal root fix:** Construct elements and assign labels with textContent. Validate URLs as bounded HTTPS values before assigning links or src; validate field type, length, and key at provider/import boundaries. Do not interpolate untrusted metadata into innerHTML.
- **Regression acceptance:** Fixtures with quotes, tags, event-handler text, javascript:/data: URLs, oversized values, and malformed keys render inert or reject safely. Normal favorites still render, apply, remove, sync, and undo.

#### LW04 — Favorite and avoidance deletion cannot be represented in sync merge

- **Evidence:** js/sync.js:744-760 unions non-empty items by key without a deletion marker. The active sync branch applies this strategy to favorites and avoided records at 835-845; the same union appears in mergeProfiles at 709-729.
- **Trigger and impact:** Device A removes a favorite or un-avoids an item while offline; Device B still has the old record. The merge treats absence as “not observed,” so an old favorite/avoid entry can persist or return. Avoidance may stop being honored or a removed favorite may reappear.
- **Minimal root fix:** Add versioned deletion/undo records or an equivalent explicit operation model. Define deterministic favorite/avoid resolution. Keep deletion markers at least through the justified stale-device horizon and account conservatively for clock skew; do not expire them earlier without proof. Bound/compact only after safe acknowledgement.
- **Regression acceptance:** Two-device offline remove/avoid/unavoid/undo tests cover stale reconnect, same-item concurrent edits, clock skew, duplicate keys, and migration from profiles without tombstones. Verify no silent resurrection/loss.

#### LW05 — News may use the wrong location and App stale fallbacks bypass identity checks

- **Evidence:** App.init calls applyInitialConfig before first loadAtmosphere (js/app.js:2358-2389); config enables the news feed at 2417-2420 and setShowNewsFeed(true) immediately calls fetchNews at 4106-4127. Before atmosphere state exists, App.fetchNews consults manual/persisted location, then defaultLocation (7807-7832), while ApiService.fetchAtmosphere separately resolves location and starts news (js/api.js:4123-4128). A wrong first query can consume a provider-wide quota. At boot and after an empty result, App reads the raw one-slot news envelope without checking its query (app.js:7729-7735,7845-7860), bypassing API identity/provider validation (api.js:3928-3934,4055-4060). These App paths set isStale:true; the formatter checks item.stale only (app.js:8196-8200).
- **Trigger and impact:** Actual resolved location differs from configured/default city at first boot, or user switches A→B while B is quota-blocked/offline/empty. A's headlines may be shown as B's regional feed. The correct query may wait through the 5-minute keyless or 15-minute keyed cooldown; cached items may not be labeled Cached.
- **Minimal root fix:** Establish current location before first news request. Keep stale selection and identity in ApiService; remove or query/provider-validate App raw-envelope fallback. Use the stale property expected by UI. Preserve provider quotas and same-query stale fallback.
- **Regression acceptance:** Mock startup where default, persisted/manual, and resolved location differ; only resolved query is fetched. Seed A envelope then request B under empty/cooldown/network error; verify no A story renders for B. Same-query stale data remains available and visibly says Cached. Preserve 15-minute keyed and 5-minute keyless windows.

#### LW06 — Malformed HTTP-OK weather data becomes synthetic live weather

- **Evidence:** normalizeOpenMeteo defaults missing WMO code to 0/Clear and temperature to 20°C (js/api.js:1333-1343), then emits freshness live at 1390-1395. The Open-Meteo adapter normalizes any successful JSON without required-field validation (1620-1638). OWM has analogous 20°C/ID-800 defaults at 1646-1656 and reports live at 1731-1738.
- **Trigger and impact:** Provider, proxy, or schema regression returns a 2xx object such as {} or invalid current fields. The wallpaper presents plausible invented temperature/condition as live instead of fallback/stale/unavailable. Reproduced offline: normalizeOpenMeteo({}) returned 20°C, Clear Sky, live.
- **Minimal root fix:** Validate mandatory current fields and structure at the adapter boundary; require a finite temperature (zero remains valid). Route malformed success through existing provider fallback and stale/offline paths. Optional missing measures can remain nullable/degraded, but do not fabricate conditions or report live provenance.
- **Regression acceptance:** {}, null, wrong types, invalid required values, and partial optional fields have explicit tests. Valid 0°C and partial optional data remain valid. Malformed success never yields fabricated 20°C/Clear/live; fallback/stale/unavailable status is truthful.

#### LW07 — OWM forecast points use desktop timezone, not forecast location timezone

- **Evidence:** OWM timezone is parsed at js/api.js:1684-1694 and returned at 1730, but buildOwmPoint uses Date.getHours at 1751-1753 and builds time/label/hour from that value at 1766-1771. Open-Meteo uses the location-aware formatter at 1409-1422.
- **Trigger and impact:** Desktop timezone differs from query location or location is in a different DST state. OWM forecast labels use desktop wall time. Offline VM on Asia/Calcutta with OWM Asia/Tokyo epoch data yielded point hour 05 rather than Tokyo hour 09.
- **Minimal root fix:** Format absolute timestamps in the provider location zone. Support IANA zones and numeric offsets from OWM 2.5 (normalized as ±HH:MM); do not silently use host-local time when a provider offset is valid. Reuse formatTzHour for IANA values and add correct fixed-offset handling.
- **Regression acceptance:** Fixed epoch tests under a host zone different from provider IANA and numeric-offset zones; verify time, label, and hour agree. Include IANA DST transitions and preserve absolute timestamps/sampling.

#### LW08 — Modal ARIA semantics exceed focus and hotkey behavior

- **Evidence:** Favorites and OneDrive dialogs declare modal roles (index.html:679-708). Favorites open/close only toggles visibility/ARIA (js/app.js:2564-2585); OneDrive modal logic is at 2903-2960. The global Tab trap is explicitly limited to details (3508-3527); Escape can close other dialogs (3530-3544), but app hotkeys are guarded only by isDetailOpen (3550-3562).
- **Trigger and impact:** Keyboard or assistive-tech user opens Favorites or OneDrive. Tab can reach background controls, focus may not return to the invoking control, and app hotkeys can fire behind a modal even though aria-modal=true.
- **Minimal root fix:** Establish one active-modal policy: trap Tab/Shift+Tab, route Escape to the topmost eligible modal, suppress app hotkeys while any modal is open, save/restore the invoker when usable, otherwise focus a safe fallback.
- **Regression acceptance:** Keyboard-only tests cover every open/close path, focus wrap, Escape ordering, hotkey suppression, hidden/disabled invoker fallback, and focus restoration. Verify accessibility tree and operation without a pointer; preserve dialog actions.

#### LW09 — Reduced-motion policy does not control SMIL inside external SVG images

- **Evidence:** Reduced-motion CSS disables host-document CSS animations at css/style.css:3101-3128; pause CSS applies animation-play-state at 2375-2377. Weather/moon glyphs load as external SVG img elements (js/app.js:6132-6135; index.html:98,103,108,205). SVG files contain SMIL animation (assets/icons/weather/rain.svg:8,12-14; assets/icons/moon/moon-full.svg:15-21).
- **Trigger and impact:** OS reduced-motion preference or wallpaper pause while an external SVG has an active SMIL timeline. CSS in the host document does not reliably control the nested SVG document, so motion can continue. Actual paused SMIL CPU cost is not measured.
- **Minimal root fix:** Provide a static equivalent for reduced-motion or a controllable SVG rendering path; preserve default animated assets and their normal behavior. Do not assume host CSS pauses an external SVG's SMIL timeline.
- **Regression acceptance:** Test active, paused, reduced-motion at boot, and live preference change for rain/moon glyphs. Reduced presentation remains understandable; normal motion remains intact.

#### LW10 — Updater can leave an installation partially overlaid

- **Evidence:** tools/updater/upgrade-local-wally.ps1:115-120 copies extracted files directly into the install. ErrorActionPreference is Stop at line 13; catch at 176-179 reports failure but does not restore earlier copied files.
- **Trigger and impact:** Disk-full, file lock, process exit, or a copy failure partway through. A directory can contain a mix of old/new files; retry may not restore consistency. No real installation was touched.
- **Minimal root fix:** Stage and validate outside the install, then use a recoverable transaction or verified rollback snapshot. Preserve customization, provider keys, OAuth/login state, and Lively SaveData. Do not perform destructive migration without backup.
- **Regression acceptance:** Temporary fixture only; inject failure before copy, mid-copy, and during swap. Prior install remains runnable/restored; new files are all applied or none; settings/favorites/auth references survive. Never test against a real installation.

#### LW11 — Critical behavior tests are not reproducible from tracked checkout/CI

- **Evidence:** .gitignore:19 ignores scratch/. Existing suites and scratch/run_all_tests.js:14-20 live there. Parent's tracked inventory found no tracked test target/runner/workflow; .github has only issue templates.
- **Trigger and impact:** Fresh checkout lacks ignored suites; regressions in ingestion/cache, sync, UI, and pause/resume can merge without reproducible automated checks.
- **Minimal root fix:** Promote a curated dependency-free Node assertion suite into tracked tests, provide a standard timeout-bounded runner, and add PR/release CI. Focus on production behavior, not blind promotion of brittle historical regex tests or mutating scripts.
- **Regression acceptance:** Clean checkout runs one documented command without credentials/provider network; seeded failure yields nonzero; CI visibly executes it. Add regressions for LW01–LW10 and lifecycle findings, with mocked provider/clock/storage/Graph and temporary updater fixtures.

#### LW12 — News requests and rendering can run while the feature is hidden; RSS cascade can be long

- **Evidence:** setShowNewsFeed(false) stops its own timer at js/app.js:4128-4137, but ApiService.fetchAtmosphere unconditionally calls fetchNews at js/api.js:4123-4129 during cache-miss refresh. When that asynchronous request settles, it attaches the result and calls renderNews without a showNewsFeed guard at api.js:4180-4198; renderNews paints and decorates stories at app.js:8714-8736 even when its container is hidden. Startup applies the toggle at app.js:2417-2420. Balanced RSS fallback serially attempts up to five proxies for geographic feed then five for fallback feed (api.js:3119-3159,3179-3185), each with 5-second timeout.
- **Trigger and impact:** User disables news while weather refresh is due. Invisible news still consumes request/quota/resources; if a stock-photo key is configured and no cached decoration exists, rendering can also enter the decorative-image search path (app.js:8754-8787). Source-derived serial worst case is 10 × 5 seconds; asynchronous path is not proof of a 50-second main-thread stall or boot delay.
- **Minimal root fix:** Gate news fetch/render at unified pipeline on feed-enabled state; when enabled later, issue one request for current location. Preserve weather/AQI readiness and quota firewall; retain current fallback order absent a separate product/privacy decision.
- **Regression acceptance:** Mock disabled boot/refresh and later re-enable. Assert no news HTTP calls while disabled, exactly one current-location request upon enable, weather/AQI complete, and quotas are not bypassed. Count proxy attempts only with mock failures.

#### LW13 — Artifact purge is not re-armed after pause and image memory cache is not capped

- **Evidence:** Boot purge and daily timer are set at js/app.js:2363-2369. Pause clears it at 9479-9482; startLoop restores other timers at 9379-9405 but not purge. Persistent news image cache is capped at 80 FIFO entries (8843-8865,8911-8926), while writes also add every unique key to _newsImageMemoryCache without eviction (8911-8927); purge alone resets that map (8879-8881).
- **Trigger and impact:** Wallpaper pauses across the 48-hour retention sweep, resumes, and no purge runs until the next process start, breaking the retention/lifecycle contract; this keeps LW13 at P2. Separately, unique cached image URL strings can grow in the in-memory map beyond the persistent 80-entry limit because FIFO eviction does not remove them. That is a small, unmeasured retention cost; no severe OOM is proven.
- **Minimal root fix:** Re-arm exactly one daily purge timer idempotently on resume. Keep memory cache consistent with the same bounded retained set or rebuild it from persisted bounded entries. Never purge wallpaper settings, favorites, or auth state.
- **Regression acceptance:** Fake-clock pause past retention/resume test proves one timer and stale cache purge. Add >80 unique images and assert persistent and memory caches remain bounded/consistent; cover storage-disabled behavior.

#### LW14 — Export UI promises API keys but actual handler masks them

- **Evidence:** LivelyProperties.json:289-296,319-321 and docs/walkthrough.md:271 promise API keys/full setup in export. _buildSettingsPayload masks keys by default (js/app.js:5062-5075), and exportSettings calls it without changing default (5119-5123). Restore skips masked values at 5308-5316.
- **Trigger and impact:** User exports and restores on another machine; provider keys are masked and skipped, contrary to the full-setup promise. OAuth tokens must remain excluded under LW01; this concerns optional provider API keys only.
- **Minimal root fix:** Keep masked export default but offer explicit informed include-provider-keys consent with sensitive-file warning, or accurately change every UI/help/walkthrough promise to say keys are omitted/re-entry required. Never export OneDrive OAuth tokens.
- **Regression acceptance:** Test the actual export handler in default and consent modes, then import. Provider keys round-trip only after consent or docs accurately report omission. Local OAuth/auth state is absent in both modes.

### P3 — Small, unmeasured, or documentation-level improvements

#### LW15 — Visualizer misses DPR-only resize changes

- **Evidence:** js/app.js:142-165 resets canvas backing size/transform only when CSS width changes by more than 2 pixels; DPR is read inside that branch at 152.
- **Trigger and impact:** Move wallpaper between monitors with equal CSS width but different devicePixelRatio, or change scale. Canvas may retain old backing resolution and look blurred. This is a clarity defect, not frame-rate evidence.
- **Minimal root fix:** Include DPR in invalidation and update backing size/transform once if logical size or DPR changes.
- **Regression acceptance:** Equal CSS width across DPR 1→2→1 refreshes backing dimensions, transform, gradient exactly once; audio processing/output unchanged.

#### LW16 — OneDrive boot metadata request is discarded, then sync checks again

- **Evidence:** js/sync.js:87-102 invokes checkRemoteMetadata during init and discards successful result; normal sync calls it again at 763-788.
- **Trigger and impact:** Authenticated startup followed by normal sync can issue redundant Graph metadata requests. This is a small source-derived request cost; no real-account count was measured.
- **Minimal root fix:** Remove the unused boot check or feed its result into one bounded, freshness-validated sync decision. Do not cache indefinitely or suppress authorization/error recovery.
- **Regression acceptance:** Mock Graph request counts for connected startup, periodic sync, stale metadata, and failure; one check per decision and unchanged auth/sync results.

#### LW17 — Telemetry JSON is parsed before paused/disabled consumer guard

- **Evidence:** js/lively.js:199-209 parses system-info string before dispatch; App.handleSystemInfo returns if paused or hardware monitor disabled at js/app.js:8432-8434.
- **Trigger and impact:** Host keeps sending telemetry while paused or monitor-off. Parsing/dispatch still occurs, although App DOM updates are rejected. Event rate/cost are not measured and other listeners may need the event.
- **Minimal root fix:** Add a pre-parse guard only if bridge has a reliable consumer-state contract and no other listener needs the event. Otherwise leave bridge intact; do not claim native collection or IPC stops.
- **Regression acceptance:** Mock object/string payloads with paused, disabled, enabled states and a second subscriber. Preserve delivery to every active consumer and correct DOM behavior. Profile before quantifying savings.

#### LW18 — Empty OneDrive UI poll callback wakes every three seconds while paused

- **Evidence:** js/app.js:2896-2900 installs a 3-second interval whose callback only checks pause; stopLoop clears other timers but not it (9470-9482), despite README.md:36 saying pause halts all timers and polling.
- **Trigger and impact:** Long-paused wallpaper retains an interval executing an empty guard about 20 times per minute. This count is source-derived; CPU/battery savings would be small unless measured otherwise.
- **Minimal root fix:** Stop interval on pause and restore one on resume, or document why retaining it is safer. Prevent duplicate intervals.
- **Regression acceptance:** Fake timer proves zero callbacks while paused and exactly one current-status cadence on resume; connected/disconnected status behavior unchanged.

#### LW19 — Hidden legacy Pomodoro canvas draws beside visible SVG ring

- **Evidence:** index.html:525 hides pomodoro-canvas; visible SVG path updates at js/app.js:1024-1027, while canvas drawing follows at 1030-1055 if a context exists.
- **Trigger and impact:** Timer tick updates the visible SVG and may also clear/draw an invisible canvas once per second. This is minor source-level work, not a hot loop or measured battery issue.
- **Minimal root fix:** Grep all callers; remove/gate legacy canvas only after confirming no fallback uses it. Preserve SVG ring, timer, colors, modes.
- **Regression acceptance:** Each timer mode/tick updates visible SVG and does not require canvas. If fallback exists, test before removal; measure only if claiming savings.

#### LW20 — News quota docs conflict with implementation; idle/RAM claims lack reproducible conditions

- **Evidence:** README.md:99,120 says all providers have a 15-minute news firewall. Actual constants distinguish keyed 15-minute and keyless 5-minute cooldowns (js/api.js:3381-3394,3525-3530); App cadence is 5 minutes (js/app.js:9397-9405). README calls roughly 0% parked CPU/GPU an informal target (35), and claims less than 60 MB RAM (133-134) without a reproducible measurement protocol.
- **Trigger and impact:** Users may wait incorrectly or misunderstand why keyless news refreshes sooner. Resource statements may be read as universal guarantees despite varying host, runtime, screen resolution, and active features.
- **Minimal root fix:** Correct docs to keyed 15-minute/keyless 5-minute provider cooldown without changing quota constants. Qualify idle/RAM numbers as a measured target only if machine, runtime, resolution, active/paused state, and measurement procedure are recorded; otherwise remove the hard claim.
- **Regression acceptance:** Docs match constants and scheduler. Future CPU/RAM claims are reproducible under recorded conditions; do not advertise a new total-memory or zero-resource guarantee from this audit.

## Conditional register — investigate, do not automatically patch

These items are distinct from LW01–LW20. They lack direct proof that the installed user's runtime uses the exact source/conditions, or require product/host policy approval.

| ID | Conditional signal and evidence | Required proof before action |
|---|---|---|
| C01 | Pinned upstream Lively HardwareUsageService at commit 25a0a5f4ed1988ff42117d3a17feb321062237fe appears to have an error path that can bypass its normal one-second wait (HardwareUsageService.cs:79-110,159-203). [Pinned source](https://github.com/lively-community/lively/blob/25a0a5f4ed1988ff42117d3a17feb321062237fe/src/Lively/Lively.Common.Services/HardwareUsageService.cs). | Match exact source/build to installed host and inject a failing counter to prove retry cadence. Fix only in owned Lively source, never installed/Store binaries or wallpaper repo. Any backoff must preserve calibration, cancellation, and recovery. |
| C02 | Same pinned upstream NAudioVisualizerService.cs:66-106 appears to allocate a smoothed array per callback via smooth.ToArray(). | Confirm source version, callback serialization/rate; benchmark allocations and latency. Optimize only if output and callback semantics are unchanged. Exact callback frequency was not measured. |
| C03 | Host property persistence is injected (js/app.js:5302-5331); sync advances metadata after remote apply without using/awaiting apply result (js/sync.js:848-860). | Test actual supported host callback/API with missing/no-op writer and restart. Do not invent native persistence APIs. Checkpoint only after confirmed apply through an existing contract; preserve offline fallback. |
| C04 | Cloud profile includes user-supplied provider API keys (js/sync.js:20-32,597-605,516-537). They are readable in the user's OneDrive profile. TLS is used; this is not evidence of exfiltration or compromise. | Product threat-model/consent decision. Do not silently strip keys or add homemade encryption. Any encryption needs supported key management/recovery and migration plan. |
| C05 | Particle backing canvas can be full viewport (js/app.js:3321-3324; js/particles.js:210-232,246-269). At 2560×1440×4 bytes, one RGBA surface is 14,745,600 bytes (~14.1 MiB) theoretical backing storage, not measured resident RAM. Wallpaper mode suppresses precipitation but storm flash remains meaningful. | Profile actual renderer memory over dimensions/DPR; preserve thunder/lightning. Lazy allocation only after storm and resize lifecycle tests. No proof it exceeds a target. |
| C06 | Paused host may or may not freeze external SMIL/renderer work. LW09 confirms a reduced-motion control gap, not actual paused CPU usage. | Inspect/measure exact WebView2/Lively visibility/suspension behavior. Do not introduce renderer suspend/resume APIs unless installed SDK/host contract and resume paths are verified. |
| C07 | Parent's limited runtime sample: PID 79964 Lively.Player.WebView2 used 19.703 CPU-seconds over 30.04 wall-seconds (~65.59% of one logical core). Wallpaper, renderer child, paused state, GPU, and cause were unknown; CIM attribution was denied. Installed package/plugin 1.0.164.0 / 1.0.0.0 is not Local Wally source version. | Use ETW/WPR or equivalent with known wallpaper, active/paused state, renderer/GPU attribution. Do not infer C01/C02, disable GPU acceleration, lower FPS/quality, restart apps, or change settings from this number. |
| C08 | Publisher signature/manifest verification for downloaded updater payload may improve provenance; no trusted signing key/release chain was established. | Maintainer decision: define trusted publisher/key rotation/release process. Never invent or hard-code an unverified key; this is not a proven TLS compromise. |
| C09 | Inspected code does not establish automatic upload on every local edit; sync appears cadence/manual-driven. | Clarify intended UX before adding auto-sync. Do not increase Graph traffic or change privacy expectations to meet aspirational untracked design notes. |

## Rejected hypotheses and explicit non-findings

- Current source does not establish an unbounded idle requestAnimationFrame loop, full-canvas clear on every active frame, >60 FPS render loop, stable-DPR clipping, or per-frame full-resolution contrast work. Do not repeat these claims without a trace; inspected contrast work is throttled/debounced.
- Weather/news TTLs differ intentionally. Do not collapse them because the README quota sentence is stale.
- Paused App.handleSystemInfo returns before App DOM work (js/app.js:8432-8434). Parsing/bridge activity before that guard is not continued DOM rendering.
- Do not remove provider fallbacks, cloud sync, audio/media, Pomodoro, storm/lightning, animated icons, glass blur, or user settings solely to save resources.
- C01/C02/C06/C07 do not prove the installed renderer is defective or that Local Wally caused the host CPU sample.

## Validation and coverage gaps

| Check | Result | What it proves / does not prove |
|---|---|---|
| node scratch/test_v083_audit_fixes.js | 62 passed, 0 failed | Mocked current audit-fix paths; ignored scratch suite is not a clean-clone CI gate. |
| node scratch/test_v087_location.js | All assertions passed | Mocked location cascade/basic behavior; not live geolocation/IP accuracy. |
| node scratch/test_news_battery_v0820_fixes.js | All assertions passed (4 checks) | Mocked news/battery fixes; not live RSS provider or quota behavior. |
| node scratch/qa_boot_matrix.js | 10 storage × pause/play cases, 0 failures | Earlier safe lifecycle matrix; not live Lively/WebView2 integration. |
| Offline VM: normalizeOpenMeteo({}) | 20°C / Clear Sky / live | Reproduces LW06 normalizer output without provider request. |
| Offline VM: OWM Asia/Tokyo on Asia/Calcutta host | point hour 05 vs Tokyo 09 | Reproduces LW07 without provider data. |
| Static review of token paths | No token files read | Shows code boundary only; does not establish whether token file exists or was served. |

Not checked: live providers/rate limits, actual OneDrive multi-device races, export bytes from running Lively, updater execution, screen-reader behavior, real GPU/renderer profile, installed Lively source equivalence, aggregate RAM, or every ignored historical script. No basis to claim complete functional completeness, an SLA, or a global CPU/RAM number.

## Recommended order

1. Close token/checkpoint export and static-file exposure (LW01), and unsynced-setting overwrite (LW03).
2. Fix untrusted favorite rendering and deletion semantics (LW02, LW04).
3. Fix news identity/order, malformed weather, and OWM timezone correctness (LW05–LW07).
4. Restore modal accessibility and reduced-motion parity (LW08–LW09); make updates recoverable and tests tracked (LW10–LW11).
5. Gate hidden news work, repair retention/pause lifecycle, and reconcile backup promises (LW12–LW14).
6. Take P3 changes and documentation corrections after regression coverage. Keep C01–C09 gated on evidence/approval.
