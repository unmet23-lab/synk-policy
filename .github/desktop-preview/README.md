# SYNK desktop Preview builders

## Platform 0.4.3 performance update

`build-platform-performance.cjs` builds Platform 0.4.3 with two byte-pinned runtime changes. Executable and ASAR checks stream physical file bytes in bounded chunks and verify SHA-256 freshly at each inspection or launch. Installation chooses the newest available installer while retaining hash-only approval for already-installed newer clients. No integrity checks are skipped.

The published WORLD and Workspace 0.4.1 child installers remain unchanged. Windows Platform also recognizes the verified WORLD 0.4.2 installation without downgrading it. WORLD content is served over HTTPS and receives the rendering and wardrobe loading improvements without a child reinstall.

Native Windows candidate QA passed 16 checks, including actual embedded installer extraction. Native Apple Silicon and Intel DMG and Platform QA passed in [run 38164405927](https://github.com/unmet23-lab/synk-policy/actions/runs/38164405927). Intel CI uses software graphics; physical MacBook GPU performance and download quarantine approval remain separate checks.

Run `node build-platform-performance.cjs --validate-only`, then `--platform=win32` or `--arch=arm64|x64` on the matching native operating system. This builder never publishes or installs. The original 0.4.1 frozen sources and build defaults remain unchanged.

## Original macOS Preview 0.4.1

This directory contains byte-pinned sources from the published Windows Preview clients and an independent native macOS packaging script. No private configuration or account data is required. The public authentication configuration uses publishable keys and public OAuth client IDs.

The reviewed `mac-renderer-overlay.json` changes six Platform installation messages across three renderer files when creating the Mac build stage. It explains dragging the app into Applications. Frozen sources remain unchanged, and the build verifies each replacement matches exactly once and reports both source and overlay hashes.

On a native macOS runner with Node.js 24:

```sh
npm ci --no-audit --no-fund
node build.cjs --validate-only
node build.cjs --arch=arm64
# For x64, first run bash build-vulkan-loader.sh on a Mac, then --arch=x64.
```

`dist/<arch>/deliverables/` contains WORLD, Workspace, and Platform DMGs plus checksums and verification reports. Platform bundles the same WORLD and Workspace DMGs. All three apps must retain their original bundle names when copied to `/Applications` so Platform can verify and find them.

These are ad-hoc signed Preview builds, without a Developer ID or Apple notarization. The minimum system is macOS 13. Internet access is required; no development server, Node.js installation, or source checkout is needed to use an installed app. The build never uploads artifacts or runs a signed release workflow.

Intel packaging includes the missing Chromium 151+ Vulkan loader, compiled from pinned official Khronos SDK 1.4.363.0 sources. The loader and its license/provenance are added before code signing. App source and normal GPU selection stay unchanged. The Intel GitHub runner has no hardware GPU, so native CI alone uses explicit SwiftShader flags; those flags are not added to the application. This verifies CPU execution and real public game actions, not physical Intel GPU performance. Native Intel DMG QA passed in run 38160482694. The separate packaged x64 Rosetta check did not advance the game (38161673838); a detached-inspector experiment also timed out (38162193973). Intel-on-Apple-Silicon is therefore outside this Preview's supported combinations. Apple Silicon users must use the arm64 DMGs, whose native checks passed.

The script verifies frozen source hashes, secret-file patterns, native architecture, final code signatures, actual read-only DMG contents, application bytes, and bundled child checksums. Separate native GUI QA must pass before publication. Download quarantine and Gatekeeper approval on another physical Mac are not proven by a CI run.
