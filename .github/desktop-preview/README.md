# SYNK macOS Preview 0.4.1

This directory contains byte-pinned sources from the published Windows Preview clients and an independent native macOS packaging script. No private configuration or account data is required. The public authentication configuration uses publishable keys and public OAuth client IDs.

The reviewed `mac-renderer-overlay.json` changes six Platform installation messages across three renderer files when creating the Mac build stage. It explains dragging the app into Applications. Frozen sources remain unchanged, and the build verifies each replacement matches exactly once and reports both source and overlay hashes.

On a native macOS runner with Node.js 24:

```sh
npm ci --no-audit --no-fund
node build.cjs --validate-only
node build.cjs --arch=arm64
# Use --arch=x64 on an Intel runner.
```

`dist/<arch>/deliverables/` contains WORLD, Workspace, and Platform DMGs plus checksums and verification reports. Platform bundles the same WORLD and Workspace DMGs. All three apps must retain their original bundle names when copied to `/Applications` so Platform can verify and find them.

These are ad-hoc signed Preview builds, without a Developer ID or Apple notarization. The minimum system is macOS 13. Internet access is required; no development server, Node.js installation, or source checkout is needed to use an installed app. The build never uploads artifacts or runs a signed release workflow.

The script verifies frozen source hashes, secret-file patterns, native architecture, final code signatures, actual read-only DMG contents, application bytes, and bundled child checksums. Separate native GUI QA must pass before publication. Download quarantine and Gatekeeper approval on another physical Mac are not proven by a CI run.
