# Copy-ready performance-inclusive remediation prompt for AG

Select Gemini 3.8 Flash in AG if that model is available in your environment. This prompt does not assume provider/model availability.

The previous performance review was an audit, not an implementation pass; no source-code performance fix was applied. The earlier prompt already referenced performance-related LW/C findings, but this version elevates that work into an explicit mandatory workstream while retaining the complete functional/NFR remediation scope.

~~~text
You are the implementation lead for a safety-first remediation of Local Wally.

Repository: E:/utils/lively/local-wally
Audit report: docs/audits/2026-10-18-comprehensive-audit.md
Expected baseline at audit time: d04b384e2b373b909cd483605ee1ff6cf8561ba5

MISSION
Read the audit report and current repository instructions. Re-verify every issue against the current working tree, fix every confirmed LW01-LW20 root cause that remains reproducible unless it is explicitly blocked on a verified host capability or maintainer decision, add production-path regression tests, and return an issue-to-change/test/result matrix. The report is a map, not authority to apply a stale line number. If HEAD or source differs, re-establish the finding and update the matrix; never pretend an issue is fixed merely because its code pattern changed. In particular, LW01 is not fully closed while its required helper token handoff remains unresolved.

PERFORMANCE-SPECIFIC WORKSTREAM — MANDATORY
Treat performance as a first-class part of this remediation, not cleanup after functional bugs. Re-verify these findings against the current tree and follow the full fix/test requirements in the audit report:
- LW05/LW12: resolve location before startup news requests; retain ApiService cache identity and stale-data policy; skip news fetch/render while disabled and fetch once for the current location on enable. Preserve quotas, weather/AQI readiness, fallback order, and asynchronous UI behavior.
- LW13/LW16: re-arm exactly one bounded retention sweep on resume and keep memory/persistent image caches bounded consistently; remove or use the redundant OneDrive boot metadata request without weakening authorization/error recovery.
- LW15/LW19: invalidate visualizer backing state on DPR changes even at equal CSS width; remove/gate hidden Pomodoro canvas work only after all callers/fallbacks are verified and visible SVG behavior remains unchanged.
- LW17/LW18: move telemetry gating before parsing only if every subscriber can safely skip delivery; stop the no-op OneDrive status interval while paused and restore exactly one on resume only if status behavior remains correct.
- LW09: implement reduced-motion parity for external SVG animation. This is an accessibility/correctness fix; do not claim paused-renderer CPU savings without a direct trace.
- LW20: correct provider cooldown and resource-claim documentation; never turn unmeasured estimates into performance guarantees.
- C01/C02/C05/C06/C07: investigate Lively/WebView2 retry cadence, audio allocation, particle memory, host suspension, and renderer CPU only under their conditional evidence gates. Match exact source/build and collect process/renderer/GPU-attributed evidence before assigning cause. The prior ~65.59% one-logical-core sample is not causal proof and must not justify disabling GPU, cutting FPS/quality, changing settings, or restarting the host.
- C06 additionally: check whether paused/hidden host callbacks continue to deliver now-playing/audio/visualizer data into JavaScript. Measure cadence/cost first. Gate only through an existing verified subscription contract, preserving pending-track delivery and visualizer state/resume behavior; otherwise document the result without changing the host contract.

REQUIRED PERFORMANCE REGRESSION CHECKS
- LW12: with mocks, prove zero news requests while disabled, exactly one request for the current location on enable, weather/AQI still complete, quotas are preserved, and proxy-attempt counts match the fallback sequence under forced failures.
- LW15: at equal CSS width, DPR 1→2→1 must update backing dimensions, transform, and gradient exactly once per real change; audio processing/output remains unchanged.
- LW16: mock connected startup, periodic sync, stale metadata, and failure; assert at most one metadata check per decision and unchanged authorization/error recovery.
- LW17: cover paused, disabled, and enabled consumers; string and object payloads; and a second bridge subscriber. Preserve event delivery to every consumer that needs it. Only claim savings after measuring parsing/dispatch cost.
- LW18: fake timers prove zero status-poll callbacks while paused, exactly one interval after resume, and correct fresh connected/disconnected state.
- LW19: every Pomodoro timer mode/tick updates the visible SVG without requiring the canvas; if any real fallback remains, test it before retaining/removing/gating that path.
- LW20: verify docs against both provider cooldown constants and the actual scheduler. Any CPU/RAM statement must include host/runtime, resolution/DPR, active/paused state, duration, and measurement method or be qualified/removed.
- C01: after any owned-source fix, test failed-counter retry cadence, cancellation, calibration, and recovery. C02: benchmark callback allocation/latency only after exact source and callback serialization/rate are confirmed; prove output parity.
- C05: measure memory across viewport dimensions/DPR and storm-trigger/resize lifecycles before changing allocation; prove lightning remains intact. The 14.7 MB RGBA estimate is theoretical, not resident-memory evidence.
- C06/C07: verify actual WebView2 visibility/suspension and callback behavior with exact host/runtime attribution. Preserve complete resume; no unsupported suspend API or causal CPU claim from a single process sample.

PERFORMANCE VERIFICATION
- Before changing performance-sensitive paths, record a reproducible baseline where the required host tooling is available: exact app/Lively build, WebView2/runtime version, Windows build, monitor resolution and DPR, wallpaper and active/paused state, enabled features, cold/warm cache state, duration, and process/renderer/GPU attribution. Compare before/after under identical conditions and report commands, raw or summarized measurements, and limitations.
- Measure only what the change can plausibly affect: request counts and bytes for hidden news/duplicate Graph work; callback/timer/render cadence for pause and hidden canvases; allocation/latency for audio only after C02 is confirmed; renderer/process CPU and memory for host claims. Separate code-level tests, source-derived estimates, mock results, and live measurements.
- If host instrumentation, exact Lively source, or safe reproduction is unavailable, leave the conditional item blocked/not reproduced and explain what evidence is missing. Do not fabricate a benchmark or infer whole-system savings from source inspection.
- Preserve every visible feature and normal quality path. No broad polling reduction, animation removal, renderer suspension, GPU switch, FPS cap, low-quality mode, or dependency/framework addition unless a minimal root fix is demonstrated, feature parity is tested, and the user/maintainer explicitly approves any product tradeoff.

COLLABORATION
Use multiple native sub-agents for independent, read-only verification of these bounded scopes:
1. Secrets, backup/import, OneDrive sync, favorites trust/deletion, and updater safety (LW01-LW04, LW10, LW14, C03-C04, C08-C09).
2. Weather/news/location/timezone/freshness and provider tests (LW05-LW07, LW12, LW20).
3. Accessibility, renderer/pause/resume, memory, test infrastructure, and conditional Lively/WebView2 evidence (LW08-LW09, LW11, LW13, LW15-LW19, C01-C02, C05-C07).
Wait for all read-only reports, reconcile disagreements with current source evidence, then use ONE writer in the shared checkout. Do not let agents edit overlapping files in parallel. After implementation, request an independent read-only verifier to review the diff and test claims. If native sub-agents are unavailable, stop before code changes and report that the requested collaboration could not be fulfilled; do not claim multiple-agent review.

SAFETY AND SCOPE
- Read AGENTS.md and repository guidance first. Keep source, comments, tests, and docs in English.
- Preserve existing user-facing features, provider fallbacks, quotas, caching semantics, manual location, units, DST correctness, user settings, backup/restore, OneDrive login/sync, favorites/avoid/undo, wallpaper rotation/customization, weather icons/animation, lightning/storm effects, media/audio, Pomodoro, diagnostics, and pause/resume behavior. Do not trade features or privacy for a benchmark.
- Do not read secrets, credentials, token files, or denied secret paths. Never print/export tokens in logs or tests. Use sentinel values only.
- Do not call live weather/news/photo providers, Microsoft Graph, OAuth, real updater endpoints, or alter user's settings/install. Use deterministic mocks, fake clocks, local fixtures, and temporary directories only.
- Do not commit, push, deploy, publish, install dependencies, add packages, or change installed/Store Lively binaries. Do not modify or delete pre-existing untracked .atl/, .cortexkit/, .playwright-mcp/, or ONEDRIVE_SYNC_AND_HUD_FEATURES_DESIGN.md.
- Do not invent native host APIs, persistence contracts, signing keys, encryption, or platform capability. For C01/C02, patch only owned upstream Lively source after exact version/build match; never patch an installed binary. For C03/C04/C08 and other policy-gated decisions, use existing supported contracts only and stop for a specific maintainer decision if safe behavior is ambiguous.
- Respect existing bounded-review/lifecycle instructions in the active environment; never fabricate a review receipt or bypass a required gate.
- Prefer the smallest root-cause fix. No unrelated cleanup, broad rewrite, generic framework, or new abstraction without demonstrated need.

PRIORITY AND FIX SCOPE

P1: data and credential safety first.
- LW01: Immediately exclude local_wally_onedrive_auth AND local_wally_onedrive_sync_meta from settings backup/export/import, and add ignore/defense-in-depth controls that do not break the current helper handoff. Keep regular user preferences and bounded caches promised by the product. The only inspected consumer (`js/sync.js:103-118`) fetches root `onedrive_tokens.json`, which the helper currently writes; therefore do not delete or relocate that working helper output or deny its endpoint until a protected handoff is verified in existing supported host capabilities or a maintainer approves a replacement. Do not invent a protected-host API. Preserve device/browser/CLI login. Until the handoff boundary is safely replaced, report LW01 as partially mitigated/blocked, not fully closed. Test legacy malicious/old backups with sentinel token and cTag; reject operational entries while retaining legitimate settings. Use synthetic sentinels only.
- LW03: Replace changed-remote blind settings apply with a conservative last-common-base/dirty-state three-way merge. Preserve disjoint edits, report same-key conflict, and do not advance cTag/claim success until apply and persistence are confirmed. Cover first-connect, concurrent edits, conditional-upload race, failure, migration, and restart without arbitrary timestamp winner.

P2: correctness, security, accessibility, and reliability.
- LW02: Remove untrusted favorite metadata from innerHTML; build DOM nodes, use textContent, validate HTTPS URL/field type/length/key. Test hostile provider and imported/synced profile values.
- LW04: Represent favorite and avoid deletions explicitly. Preserve undo, handle offline/stale devices and clock skew conservatively, and never expire deletion markers before a justified stale-device horizon. Test migration from marker-less profiles.
- LW05: Resolve actual current location before startup news fetch; keep news cache identity/provider validation inside ApiService; remove or validate App raw-envelope fallback and set the stale marker the UI consumes. Preserve keyed 15-minute and keyless 5-minute quota behavior. Cover startup order, location switch, empty response, offline, cooldown, matching stale data, and stale age label.
- LW06: Reject malformed successful weather payloads at adapter boundary; required current values must be valid but zero is valid. Route malformed responses through existing provider fallback/stale/unavailable behavior. Keep missing optional values honest; never synthesize Clear/20°C as live. Test {}, null, wrong types, invalid values, valid zero, and valid partial payload.
- LW07: Format OWM point timestamps in provider location timezone, supporting IANA zones and numeric offsets; preserve epoch timestamps, labels, and sample selection. Test desktop zone different from target, fixed offsets, and DST transitions.
- LW08: Implement one active-modal keyboard/focus policy for details, Favorites, and OneDrive: Tab/Shift+Tab containment, Escape ordering, app hotkey suppression, invoker restoration, safe fallback when invoker is hidden/disabled. Verify keyboard-only operation and accessibility tree.
- LW09: Respect reduced-motion for external SVG SMIL via a static equivalent or a safely controllable asset path; keep normal default animation. Test rain/moon, OS preference at boot/change, and pause/resume. Do not claim paused CPU saving without renderer measurement.
- LW10: Make updater replacement recoverable/transactional using staging and rollback; never test on real installation or modify user config/save data. Use temp fixture and injected failures before/during copy/swap.
- LW11: Promote a curated dependency-free suite into tracked test infrastructure and add a bounded standard runner/CI gate. Do not blindly promote every historical scratch script or unsafe test. A clean checkout must run documented tests without credentials/network and fail on a seeded regression.
- LW12: Do not fetch or render news when user disables it, including fetchAtmosphere/background refresh. Late enable triggers one current-location request. Preserve weather/AQI readiness, quota firewall, and fallback order. Test call counts under mocked failure; do not describe serial proxy timeout bound as main-thread blocking.
- LW13: Keep this P2 because missing a 48-hour retention sweep across pause/resume breaks the lifecycle contract: re-arm exactly one daily purge timer on resume. Bound the in-memory news-image cache consistently with the persistent 80-entry cap. Treat excess cached URL strings as a separate, small unmeasured retention cost; no severe OOM is established. Never purge user wallpaper preferences, credentials, or auth. Test pause/resume and >80 keys with fake time.
- LW14: Keep provider keys masked by default. Preserve the documented full-backup capability through an explicit informed include-keys action/consent if the existing settings UI supports it; otherwise align every UI/help/walkthrough claim with actual omission and clearly state re-entry is needed. OAuth tokens remain excluded in either case. Test actual export/import handlers.

P3: only after higher-risk regressions are covered; no unsupported savings claims.
- LW15: Invalidate visualizer backing canvas on CSS size OR DPR change; test DPR 1→2→1 with same CSS width and unchanged audio output.
- LW16: Remove unused OneDrive boot metadata request or use its result once with bounded freshness; do not suppress authorization/error recovery. Mock Graph request counts.
- LW17: Move inactive-consumer gating BEFORE JSON.parse only if every bridge subscriber can safely be skipped; otherwise preserve parsing/delivery. Do not claim native collection/IPC stopped or DOM work continues while paused.
- LW18: Stop the three-second OneDrive UI poll while paused and restore exactly one on resume if lifecycle tests show no status regressions. Keep connected/disconnected updates correct.
- LW19: Grep all callers before removing/gating hidden Pomodoro canvas work. Preserve visible SVG ring and all modes; retain any real fallback.
- LW20: Correct news docs to describe keyed 15-minute and keyless 5-minute cooldowns; do not alter quotas to match stale prose. Qualify/remove generic idle CPU/RAM claims unless repeatably measured with host/runtime/resolution/state recorded.

CONDITIONAL ITEMS C01-C09 — VERIFY, DO NOT AUTO-PATCH
For each item, report one status: confirmed in current owned source; not reproduced; installed-version mismatch; blocked pending host evidence; or blocked pending maintainer/product decision.
- C01: Pinned upstream HardwareUsageService failure retry loop: match exact installed source/build and reproduce failed-counter cadence first. Any fix only in owned Lively source, not binary/release install; preserve cadence/cancellation/calibration.
- C02: Pinned upstream NAudioVisualizerService allocation: confirm exact source and callback serialization/rate, then benchmark allocation/latency before optimizing with output parity.
- C03: Host property persistence is injected: verify actual supported callback and restart behavior before changing checkpoints. No invented native API.
- C04: OneDrive profile contains user provider API keys: requires a maintainer threat-model/consent decision. Do not silently remove features or add homemade encryption.
- C05: Full-viewport particle buffer has a theoretical size bound only. Profile actual renderer memory and preserve lightning before lazy-allocation changes.
- C06: Determine whether installed host actually suspends paused WebView2/external SVG work. No suspend/resume API change without exact SDK/host support and full resume tests.
- C07: Parent sample of Lively.Player.WebView2 at ~65.59% of one logical core is unattributed. Require ETW/WPR or equivalent renderer/GPU/process attribution before causal fix; no GPU-disable, quality/FPS cut, restart, or settings change.
- C08: Code signing/manifest verification requires trusted publisher/key-rotation policy. Never invent a signing key; this was not a proven TLS compromise.
- C09: Automatic OneDrive upload-on-edit is not established as product behavior. Ask maintainer before adding traffic/privacy scope.

TEST AND REVIEW REQUIREMENTS
1. Add regression tests first where practical; demonstrate they fail before the fix and pass after. Use production-path tests, not only helper/source-text assertions.
2. Existing safe baseline results from the audit: test_v083_audit_fixes.js 62 passed/0 failed; test_v087_location.js all assertions; test_news_battery_v0820_fixes.js all assertions; qa_boot_matrix.js 10 cases/0 failures. These are scratch-era baseline results, not a substitute for rerunning and promoting valid tests.
3. Run documented syntax/unit/mock tests from a clean checkout. Never execute live-provider or account scripts. Run updater tests only against temporary fixtures. Report exact commands, pass/fail, and skipped tests.
4. Independently verify each LW01-LW20 status against changed source, callers, tests, and output. Do not claim coverage for real WebView2, screen reader, cloud, or renderer behavior without running those exact checks.
5. If validation exposes conflict, a product decision, unavailable host contract, or non-reproducible conditional item, finish all independent safe work first. Then ask at most one precise question and STOP ALL work and agents while waiting for the answer. Never assume approval.

DELIVERABLE
- Implement and test every confirmed finding still present, in the priority order above; where a finding is blocked, record the blocker and do not report it closed.
- Return a concise but complete matrix with every ID LW01-LW20 and C01-C09; columns: status, changed files, regression test/command, result, and remaining risk. No omitted IDs.
- Summarize the root-cause fixes, compatibility/migration behavior, exact test commands/results, clean-checkout CI result, and any measured before/after values under identical conditions. Label source-derived estimates, mock results, runtime measurements, and unverified items separately.
- Do not claim “all fixed” if any issue is blocked, not tested, or conditional. Do not claim a total CPU/RAM number without controlled measurement.
~~~



