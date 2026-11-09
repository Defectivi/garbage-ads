# Native migration verification

Source baseline: browser repository commit `dc4d87f`. Existing browser source, package scripts, assets and saves were not modified. The native project is contained in `Frostbound-native/`.

## Completed core checks

- `cargo test -p frostbound-core --locked --target-dir target/core-tests`: final core run, 15 integration tests passed, zero failures (plus empty unit/doc-test suites).
- `cargo test --workspace --locked`: passed. The same 15 integration cases pass in the complete workspace build; desktop/core unit harnesses and doc tests contain no additional cases.
- `cargo clippy -p frostbound-core --all-targets --target-dir target/core-tests -- -D warnings`: passed.
- Browser-generated RNG fixtures compare all sampled integer derive results and 30 Mulberry32 outputs, including a supplementary Unicode character in a derive label.
- The first RNG run exposed a JSON float-decoder rounding difference. `serde_json` now enables `float_roundtrip`; the exact comparison passes. The first desktop compile exposed private system parameter types; their module visibility was corrected.

Core tests cover atomic duplicate-cost spending, resource limits, exact food effects/rejections/paused cooldowns, gathering timing/interruption/finite depletion, fuel priority/storm consumption/expansion cap, movement-only hunger, furnace healing, save validation and encounter persistence, death recovery, deterministic generation and unchanged fixed-step state with Budget Meal Mode enabled.

The local toolchain is installed only in `.tools/`; no system PATH modification was made. Cargo dependencies and build outputs are ignored. Bevy's first build is substantial; no Rust performance advantage is assumed from compilation.

## Desktop verification

- `cargo build -p frostbound-desktop --locked`: passed. This produced a native Windows executable, not a browser/webview wrapper. The first full graphics-dependency build took roughly fourteen minutes; subsequent desktop-only builds took about sixteen seconds on this host.
- `cargo fmt --all --check`: passed.
- `cargo clippy --workspace --all-targets --locked -- -D warnings`: passed after collapsing a nested input condition. Four Bevy system functions have scoped argument-count/type-complexity allowances for their framework-supplied parameters.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Smoke.ps1`: passed. The executable opened a real 1280x800 native window, loaded the survivor model, rendered the scene, captured gameplay/inventory, round-tripped the native save and exited successfully.
- The same command with `-Budget`: passed. Both runs were checked for fresh PNG/JSON artifacts, successful exit and no panic/error logs.
- `Build.ps1` with the same process-scoped PowerShell invocation: passed; copies the executable, local assets and documentation to `build/`. The build is the development profile with optimized dependencies, not an optimized release build.
- `Smoke.ps1 -Executable <absolute path to build/Frostbound.exe>`: passed against the packaged executable and its adjacent assets, after the final build. The executable is approximately 70 MiB. No release-profile build, installer, code signing or public release was performed.

Native runtime adapter: NVIDIA GeForce GTX 1650, DirectX 12, on the available Windows host. Gameplay captures showed approximately **118 loop FPS** by default and **30 loop FPS** when capped. At the five-second capture, saved simulation elapsed time was **5.0000s** and **4.9833s** respectively (one fixed tick apart); both runs reached **7.000s** before pausing in inventory. These are short observations of this preview on one host, not a browser/native comparison, GPU presentation measurement, sustained benchmark or guarantee for other devices. The Rust preview currently simulates fewer/different features than the browser game, so comparing their FPS would be misleading.

With the computer-use skill, a normal native session was observed and controlled: Enter starts, E opens/closes inventory, clicking fish spends exactly one item and shows the paused three-second cooldown, another click rejects without spending, Escape opens Pause, Settings toggles the cap, F5 writes the isolated native slot and F9 restores it. Fuel remained at 30s across the observed paused settings actions. Actual restored inventory and graphics preference were checked in the native save. A movement key was delivered, but sustained movement, camera gestures and full combat animation were not manually established by that short input check. The test window was closed afterward. The Windows accessibility tree currently exposes the window rather than the in-game buttons; full assistive-technology support is pending.

Initial runtime attempts failed: minimal Bevy scene registration omitted GLB component types (including `TransformTreeChanged`), and the DX12 indirect-batch path asserted inside wgpu. The client now explicitly registers scene types and uses direct drawing. Windows initially emitted stale third-party Vulkan capture-hook warnings; the client now selects DX12 on Windows without modifying system settings. Tone mapping and the reused static weight-600 font were corrected after visual inspection. Direct PowerShell script execution was blocked by this host's execution policy; the verified process-scoped invocation changes no global policy, and `Run.cmd` avoids that issue for source launches. Early shell launches did not reliably expose a GUI process exit code, so `Smoke.ps1` uses `System.Diagnostics.Process` and verifies fresh artifacts as well as the exit status.

Artifacts are in ignored `captures/default-*`, `captures/budget-*` and smoke log files. Core tests alone were not used to claim runtime success.

## Design review

The native preview follows the existing snow/slate/amber identity and Oxanium typography. It labels its migration scope and unsupported save imports. Only implemented actions appear in menus. A game HUD and task menus replace web-page layouts; no fabricated content or new generated assets were added. Keyboard selection and text values supplement color and pointer interactions. Runtime title/inventory/pause/settings captures were inspected at 1280x800. The antislop contrast checker passed the paper/slate, paper/button and muted/slate text pairs at **14.31:1**, **10.43:1** and **9.71:1**. This is not a claim of a complete accessibility audit.

## Limits

This milestone does not establish feature parity, browser-save import, physical-device compatibility, a release-quality animation system, full screen-reader support or improved rendering performance. See `README.md` for the explicit migration backlog. Native saves use a distinct format and directory; browser documents remain unsupported rather than partially consumed.
