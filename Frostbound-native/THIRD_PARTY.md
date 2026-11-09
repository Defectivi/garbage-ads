# Asset and dependency provenance

- `assets/models/wayfarer.glb` and `bear-ivory.glb` are copied unchanged from this repository's original procedural character assets at browser commit `dc4d87f`. Their generators remain in the browser project's `src/rendering` directory. No third-party game artwork was copied.
- `assets/fonts/Oxanium.ttf` is a TTF conversion of the existing `@fontsource/oxanium` Latin weight-600 WOFF file. The font's SIL Open Font License is bundled in `assets/licenses/Oxanium-OFL.txt`. FontTools was used only during asset preparation and is not a game runtime dependency.
- Bevy 0.17.3 is used under its upstream MIT/Apache-2.0 terms. Cargo dependency versions and checksums are recorded in `Cargo.lock`; upstream package manifests retain their license metadata in Cargo's registry. A complete redistributable dependency-notice bundle is still required before a public release.
- The local Rust toolchain, Cargo registry, FontTools installation, test captures and executable outputs are not committed or included in source exports.

This document does not assign a new license to the user's game or repository.
