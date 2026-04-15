# AI 3D Avatar Project Changelog

All notable changes to the AI-Driven 3D Interactive Avatar project will be documented in this file.

---

## [1.1.0] - 2026-04-15 (Current)

### ✨ Fully Functional VRM/FBX Pipeline & Retargeting

**The key milestone of applying Mixamo FBX animations dynamically at runtime to any parsed VRM file.**

#### Added
- **MixamoRetargeter**: Full integration of the official `@pixiv/three-vrm` algorithm to apply world-space transform retargeting, correcting Mixamo-to-VRM bone axis/coordinate space mismatches.
- **FBXAnimationLoader Module**: Completely abstracts the FBX file loading, tracks mixing, and base pose overriding during an active animation state.
- **Animation Dashboard**: A UI panel on the left side of the screen allowing users to browse, search, and manually test available `.fbx` animations dynamically without using the chat.

#### Fixed
- **Puppeteer Integration Debugged**: Fixed end-to-end integration issues in automated tests caused by misaligned node imports globally.
- **Animation Manifest Sync**: Corrected file path and naming discrepancies located within `animationsManifest.js` to exactly match local file system structure, preventing 404 blockages on load.
- **Rig Hierarchy Twisting**: Addressed unnatural arm and wrist bending during Mixamo retargeting by replacing local quaternion transfer with a complete parent-world compensation model. 

---

## [1.0.0] - 2026-04-14

### ✨ AI Brain, Modularization & Lip Syncing Core Release

**The foundational release of the autonomous agent architecture.**

#### Added
- **AIBridge**: Connects the `three.js` presentation frontend to local instances of `llama.cpp` using REST API streaming formats.
- **CommandParser**: Instructs the LLM to yield deterministic JSON strings containing `{ action, emotion, say }` variables.
- **SpeechEngine**: Connected `@andresaya/edge-tts` to pipeline high-fidelity cloud text-to-speech audio streams.
- **Amplitude-based LipSyncing**: Added `LipSyncController` utilizing the `AudioContext` and `AnalyserNode` to determine active volume dB limits and drive VRM parameters (`aa`, `ih`, `ou`).
- **Autonomous & Mood Persistence Loop**: Added `AutonomousBehavior` to handle long-running timeouts and execute spontaneous sighs or looks when idle, and `MoodEngine` to bias the prompt sent to the LLM based on recent conversation history. 
- **Procedural Base Animations**: Added noise-driven spine interpolation, eye blinking timers, and rhythmic pseudo-breathing in `ProceduralAnimations.js`.

#### Fixed
- Separated monolithic application structure into `/ai`, `/avatar`, and `/voice` class sub-categories. 
- Clean up WebGL canvas auto-resize issues on window snapping.

---

## [0.1.0] - Pre-Alpha

### ✨ Three.js Initialization

#### Added
- Setup of Vite basic scaffolding.
- First functional drops of `GLTFLoader` rendering basic `model.vrm` to the Canvas.
- Implemented `OrbitControls`.
- Implemented ambient, key, fill, and rim lighting models with a dark stylized scene rendering pipeline.
